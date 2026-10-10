/* Texas Hold'em engine (2-6 players). VIRTUAL CHIPS ONLY - for entertainment only, no cash value, not redeemable.
   Cards 0..51: rank = 2 + (id >> 2) (2..14, A = 14), suit = id & 3 (0 spade, 1 heart, 2 club, 3 diamond).
   One state = one hand. Stacks carry between hands via newGame({stacks}) / nextStacks(). Seats 1..n.
   Blinds sb/bb (default 10/20), buy-in 1000. Actions: {a:'fold'} {a:'check'} {a:'call'} {a:'raise', to:N} (N = total bet this round) {a:'allin'}.
   Side pots are built from each player's total contribution; ties split pots (odd chip to the first winner left of the dealer). */
(function () {
  var CAT = ['High card', 'Pair', 'Two pair', 'Three of a kind', 'Straight', 'Flush', 'Full house', 'Four of a kind', 'Straight flush'];
  var RN = { 11: 'J', 12: 'Q', 13: 'K', 14: 'A' }, RNAME = { 2: 'Twos', 3: 'Threes', 4: 'Fours', 5: 'Fives', 6: 'Sixes', 7: 'Sevens', 8: 'Eights', 9: 'Nines', 10: 'Tens', 11: 'Jacks', 12: 'Queens', 13: 'Kings', 14: 'Aces' };
  var RSING = { 2: 'Two', 3: 'Three', 4: 'Four', 5: 'Five', 6: 'Six', 7: 'Seven', 8: 'Eight', 9: 'Nine', 10: 'Ten', 11: 'Jack', 12: 'Queen', 13: 'King', 14: 'Ace' };
  var SUITC = ['♠', '♥', '♣', '♦'];
  function rankOf(id) { return 2 + (id >> 2); }
  function suitOf(id) { return id & 3; }
  function rankName(r) { return RN[r] || String(r); }
  function cardName(id) { return rankName(rankOf(id)) + SUITC[suitOf(id)]; }
  var P5 = [50625, 3375, 225, 15, 1], CATM = 759375;
  function pack(cat, ranks) { var s = cat * CATM; for (var i = 0; i < 5; i++) s += (ranks[i] || 0) * P5[i]; return s; }
  function straightHigh(has) { for (var hi = 14; hi >= 5; hi--) { var ok = true; for (var k = 0; k < 5; k++) { var r = hi - k; if (r === 1) r = 14; if (!has[r]) { ok = false; break; } } if (ok) return hi; } return 0; }
  /* best 5-card hand from 5..7 cards -> numeric score (higher is better) */
  function evalCards(cs) {
    var rc = [], i, r, s, has = [], suits = [[], [], [], []];
    for (i = 0; i < 15; i++) { rc.push(0); has.push(false); }
    for (i = 0; i < cs.length; i++) { r = 2 + (cs[i] >> 2); s = cs[i] & 3; rc[r]++; has[r] = true; suits[s].push(r); }
    var fl = -1; for (s = 0; s < 4; s++) if (suits[s].length >= 5) fl = s;
    if (fl >= 0) { var fh = []; for (i = 0; i < 15; i++) fh.push(false); suits[fl].forEach(function (x) { fh[x] = true; }); var sh = straightHigh(fh); if (sh) return pack(8, [sh]); }
    var quads = [], trips = [], pairs = [], singles = [];
    for (r = 14; r >= 2; r--) { if (rc[r] === 4) quads.push(r); else if (rc[r] === 3) trips.push(r); else if (rc[r] === 2) pairs.push(r); else if (rc[r] === 1) singles.push(r); }
    function kick(ex, n) { var out = []; for (var q = 14; q >= 2 && out.length < n; q--) if (rc[q] && ex.indexOf(q) < 0) out.push(q); return out; }
    if (quads.length) return pack(7, [quads[0]].concat(kick([quads[0]], 1)));
    if (trips.length && (trips.length > 1 || pairs.length)) { var pr = trips.length > 1 ? Math.max(trips[1], pairs[0] || 0) : pairs[0]; return pack(6, [trips[0], pr]); }
    if (fl >= 0) return pack(5, suits[fl].slice().sort(function (a, b) { return b - a; }).slice(0, 5));
    var st = straightHigh(has); if (st) return pack(4, [st]);
    if (trips.length) return pack(3, [trips[0]].concat(kick([trips[0]], 2)));
    if (pairs.length >= 2) return pack(2, [pairs[0], pairs[1]].concat(kick([pairs[0], pairs[1]], 1)));
    if (pairs.length === 1) return pack(1, [pairs[0]].concat(kick([pairs[0]], 3)));
    return pack(0, kick([], 5));
  }
  function catOf(score) { return Math.floor(score / CATM); }
  function describe(score) { // English description, e.g. "Pair of Kings"
    var c = catOf(score), rem = score - c * CATM, r = []; for (var i = 0; i < 5; i++) { r.push(Math.floor(rem / P5[i])); rem %= P5[i]; }
    switch (c) {
      case 0: return 'High card ' + RSING[r[0]];
      case 1: return 'Pair of ' + RNAME[r[0]];
      case 2: return 'Two pair, ' + RNAME[r[0]] + ' and ' + RNAME[r[1]];
      case 3: return 'Three of a kind, ' + RNAME[r[0]];
      case 4: return RSING[r[0]] + '-high straight';
      case 5: return RSING[r[0]] + '-high flush';
      case 6: return 'Full house, ' + RNAME[r[0]] + ' over ' + RNAME[r[1]];
      case 7: return 'Four of a kind, ' + RNAME[r[0]];
      default: return r[0] === 14 ? 'Royal flush' : RSING[r[0]] + '-high straight flush';
    }
  }
  function shuffleDeck(rng) { var d = []; for (var i = 0; i < 52; i++) d.push(i); for (var j = 51; j > 0; j--) { var k = Math.floor(rng() * (j + 1)), t = d[j]; d[j] = d[k]; d[k] = t; } return d; }

  function nextSeat(s, from, pred) { for (var i = 1; i <= s.n; i++) { var p = ((from - 1 + i) % s.n) + 1; if (pred(p)) return p; } return 0; }
  function canAct(s, p) { return s.status[p] === 'active'; }
  function live(s, p) { return s.status[p] === 'active' || s.status[p] === 'allin'; }
  function postBlind(s, p, amt) { var a = Math.min(amt, s.stacks[p]); s.stacks[p] -= a; s.bets[p] += a; s.contrib[p] += a; s.pot += a; if (s.stacks[p] === 0) s.status[p] = 'allin'; return a; }
  function newGame(o) {
    o = o || {}; var rng = o.rng || Math.random, n = Math.max(2, Math.min(6, Math.floor(o.n || 4))), sb = o.sb || 10, bb = o.bb || 20, buyin = o.buyin || 1000;
    var s = { game: 'holdem', n: n, sb: sb, bb: bb, buyin: buyin, handNo: o.handNo || 1, dealer: ((Math.floor(o.dealer || 1) - 1) % n) + 1, phase: 'preflop', turn: 0, board: [], hands: [null], deck: [], stacks: [0], start: [0], bets: [0], contrib: [0], status: [''], acted: [false], raiseOpen: [false],
      currentBet: 0, minRaise: bb, pot: 0, over: false, showdown: false, winners: [], pots: [], scores: [0], reason: '', log: [], event: null, seq: 0, hnames: [''], sbSeat: 0, bbSeat: 0 };
    var d = shuffleDeck(rng), p, i;
    for (p = 1; p <= n; p++) {
      var st = o.stacks && o.stacks[p] >= 0 ? o.stacks[p] : buyin; if (st < bb && !o.keepBroke) st = buyin;
      s.stacks.push(st); s.start.push(st); s.bets.push(0); s.contrib.push(0); s.status.push(st > 0 ? 'active' : 'out'); s.acted.push(false); s.raiseOpen.push(true); s.scores.push(0); s.hnames.push('');
      s.hands.push([d[(p - 1) * 2], d[(p - 1) * 2 + 1]]);
    }
    s.deck = d.slice(n * 2);
    var inHand = function (q) { return s.status[q] !== 'out'; };
    if (n === 2) { s.sbSeat = s.dealer; s.bbSeat = nextSeat(s, s.dealer, inHand); } else { s.sbSeat = nextSeat(s, s.dealer, inHand); s.bbSeat = nextSeat(s, s.sbSeat, inHand); }
    postBlind(s, s.sbSeat, sb); postBlind(s, s.bbSeat, bb);
    s.currentBet = Math.max(s.bets[s.sbSeat], s.bets[s.bbSeat]);
    s.event = { t: 'deal', seat: 0 }; s.seq++;
    var first = nextSeat(s, s.bbSeat, function (q) { return canAct(s, q); });
    s.turn = first; advance(s, true);
    return s;
  }
  function liveCount(s) { var c = 0; for (var p = 1; p <= s.n; p++) if (live(s, p)) c++; return c; }
  function needsAction(s, p) { return canAct(s, p) && (!s.acted[p] || s.bets[p] < s.currentBet); }
  /* after an action (or at the start of a round): choose the next actor, or close the round */
  function advance(s, fromStart) {
    if (s.over) return;
    if (liveCount(s) === 1) return awardUncontested(s);
    var cur = s.turn || s.dealer, p = fromStart && s.turn && needsAction(s, s.turn) ? s.turn : nextSeat(s, cur, function (q) { return needsAction(s, q); });
    if (p && (function () { var c = 0; for (var q = 1; q <= s.n; q++) if (canAct(s, q)) c++; if (c === 1 && s.bets[p] >= s.currentBet) return false; return true; })()) { s.turn = p; return; }
    nextStreet(s);
  }
  function resetRound(s) { s.currentBet = 0; s.minRaise = s.bb; for (var p = 1; p <= s.n; p++) { s.bets[p] = 0; s.acted[p] = false; s.raiseOpen[p] = true; } }
  function nextStreet(s) {
    resetRound(s);
    if (s.phase === 'river') return showdown(s);
    var ev;
    if (s.phase === 'preflop') { s.board.push(s.deck.shift(), s.deck.shift(), s.deck.shift()); s.phase = 'flop'; ev = 'flop'; }
    else if (s.phase === 'flop') { s.board.push(s.deck.shift()); s.phase = 'turn'; ev = 'turn'; }
    else { s.board.push(s.deck.shift()); s.phase = 'river'; ev = 'river'; }
    s.event = { t: ev, seat: 0 }; s.seq++;
    var actors = 0; for (var q = 1; q <= s.n; q++) if (canAct(s, q)) actors++;
    if (actors <= 1) { s.turn = 0; return nextStreet(s); } // everyone all-in (or one left with nobody to bet against): run it out
    s.turn = nextSeat(s, s.dealer, function (q) { return canAct(s, q); }); advance(s, true);
  }
  function settle(s) { for (var p = 1; p <= s.n; p++) s.scores[p] = s.stacks[p] - s.start[p]; }
  function awardUncontested(s) {
    var w = 0; for (var p = 1; p <= s.n; p++) if (live(s, p)) w = p;
    s.stacks[w] += s.pot; s.pots = [{ amount: s.pot, eligible: [w], winners: [w] }]; s.pot = 0;
    s.over = true; s.phase = 'over'; s.turn = 0; s.winners = [w]; s.showdown = false; s.reason = 'Everyone else folded'; s.final = { t: 'win', seat: w }; settle(s);
  }
  function showdown(s) {
    var scoreOf = [0], p;
    for (p = 1; p <= s.n; p++) scoreOf.push(live(s, p) ? evalCards(s.hands[p].concat(s.board)) : -1);
    var levels = [], seen = {};
    for (p = 1; p <= s.n; p++) if (s.contrib[p] > 0 && !seen[s.contrib[p]]) { seen[s.contrib[p]] = 1; levels.push(s.contrib[p]); }
    levels.sort(function (a, b) { return a - b; });
    var prev = 0, pots = [], all = {};
    levels.forEach(function (lv) {
      var amt = 0, elig = [];
      for (var q = 1; q <= s.n; q++) { amt += Math.max(0, Math.min(s.contrib[q], lv) - prev); if (live(s, q) && s.contrib[q] >= lv) elig.push(q); }
      prev = lv; if (!amt) return;
      if (!elig.length) { var last = pots[pots.length - 1]; if (last) { last.amount += amt; } return; } // dead money goes to the previous pot
      pots.push({ amount: amt, eligible: elig, winners: [] });
    });
    pots.forEach(function (pt) {
      var best = -1; pt.eligible.forEach(function (q) { if (scoreOf[q] > best) best = scoreOf[q]; });
      pt.winners = pt.eligible.filter(function (q) { return scoreOf[q] === best; });
      var share = Math.floor(pt.amount / pt.winners.length), extra = pt.amount - share * pt.winners.length;
      var order = []; for (var i = 1; i <= s.n; i++) { var q = ((s.dealer - 1 + i) % s.n) + 1; if (pt.winners.indexOf(q) >= 0) order.push(q); }
      order.forEach(function (q, k) { s.stacks[q] += share + (k < extra ? 1 : 0); all[q] = 1; });
    });
    for (p = 1; p <= s.n; p++) if (scoreOf[p] >= 0) s.hnames[p] = describe(scoreOf[p]);
    s.pots = pots; s.pot = 0; s.over = true; s.phase = 'over'; s.turn = 0; s.showdown = true; s.winners = Object.keys(all).map(Number).sort();
    s.reason = s.winners.length > 1 ? 'Split pot' : 'Seat ' + s.winners[0] + ' wins with ' + s.hnames[s.winners[0]]; s.final = { t: 'showdown', seat: s.winners[0] }; settle(s);
  }
  function options(s, seat) {
    var o = { turn: false, fold: false, check: false, call: 0, canRaise: false, raiseMin: 0, raiseMax: 0, allin: 0 };
    if (s.over || seat < 1 || seat > s.n || s.turn !== seat || !canAct(s, seat)) return o;
    var st = s.stacks[seat], need = s.currentBet - s.bets[seat];
    o.turn = true; o.fold = true; o.check = need <= 0; o.call = need > 0 ? Math.min(need, st) : 0; o.allin = st + s.bets[seat];
    var others = 0; for (var p = 1; p <= s.n; p++) if (p !== seat && canAct(s, p)) others++;
    if (s.raiseOpen[seat] && st > need && others > 0) { o.canRaise = true; o.raiseMin = Math.min(s.currentBet + s.minRaise, o.allin); o.raiseMax = o.allin; if (s.currentBet === 0) o.raiseMin = Math.min(Math.max(s.bb, 1), o.allin); }
    return o;
  }
  function log(s, e) { s.log.push(e); if (s.log.length > 60) s.log.shift(); }
  function afterAct(s, seat, kind, amt) { log(s, { seat: seat, a: kind, amt: amt || 0, street: s.phase }); s.event = { t: kind, seat: seat, amt: amt || 0 }; s.seq++; advance(s); }
  function put(s, seat, amt) { s.stacks[seat] -= amt; s.bets[seat] += amt; s.contrib[seat] += amt; s.pot += amt; if (s.stacks[seat] === 0) s.status[seat] = 'allin'; }
  function raiseTo(s, seat, to) {
    var add = to - s.bets[seat], inc = to - s.currentBet; put(s, seat, add);
    var full = inc >= s.minRaise;
    if (to > s.currentBet) { if (full) { s.minRaise = inc; for (var p = 1; p <= s.n; p++) if (p !== seat && canAct(s, p)) { s.raiseOpen[p] = true; } } s.currentBet = to; }
    s.acted[seat] = true; s.raiseOpen[seat] = false;
    if (!full) for (var q = 1; q <= s.n; q++) if (q !== seat && s.acted[q]) s.raiseOpen[q] = false; // a short all-in does not reopen the betting
    return add;
  }
  function move(s, seat, mv) {
    if (s.over) return { ok: false, err: 'The hand is over' };
    if (!Number.isInteger(seat) || seat < 1 || seat > s.n || !canAct(s, seat)) return { ok: false, err: 'You are not in this hand' };
    if (seat !== s.turn) return { ok: false, err: 'Not your turn' };
    if (!mv || typeof mv.a !== 'string') return { ok: false, err: 'Invalid action' };
    var o = options(s, seat), amt;
    if (mv.a === 'fold') { s.status[seat] = 'folded'; s.acted[seat] = true; afterAct(s, seat, 'fold'); return { ok: true }; }
    if (mv.a === 'check') { if (!o.check) return { ok: false, err: 'You cannot check - call or fold' }; s.acted[seat] = true; s.raiseOpen[seat] = false; afterAct(s, seat, 'check'); return { ok: true }; }
    if (mv.a === 'call') { if (o.check) return { ok: false, err: 'Nothing to call - check instead' }; amt = o.call; put(s, seat, amt); s.acted[seat] = true; s.raiseOpen[seat] = false; afterAct(s, seat, s.status[seat] === 'allin' ? 'allin' : 'call', amt); return { ok: true }; }
    if (mv.a === 'allin') {
      if (s.stacks[seat] <= 0) return { ok: false, err: 'Invalid action' };
      if (o.allin <= s.currentBet) { amt = s.stacks[seat]; put(s, seat, amt); s.acted[seat] = true; s.raiseOpen[seat] = false; afterAct(s, seat, 'allin', amt); return { ok: true }; }
      if (!o.canRaise) { amt = s.stacks[seat]; put(s, seat, amt); s.acted[seat] = true; s.raiseOpen[seat] = false; afterAct(s, seat, 'allin', amt); return { ok: true }; }
      amt = raiseTo(s, seat, o.allin); afterAct(s, seat, 'allin', amt); return { ok: true };
    }
    if (mv.a === 'raise') {
      if (!o.canRaise) return { ok: false, err: 'You cannot raise now' };
      var to = Math.floor(+mv.to); if (!(to >= o.raiseMin && to <= o.raiseMax)) return { ok: false, err: 'Raise must be between ' + o.raiseMin + ' and ' + o.raiseMax };
      var isAll = to === o.allin, prior = s.currentBet; amt = raiseTo(s, seat, to); afterAct(s, seat, isAll ? 'allin' : (prior > 0 ? 'raise' : 'bet'), amt); return { ok: true };
    }
    return { ok: false, err: 'Unknown action' };
  }
  function resign(s, seat) { if (s.over || seat < 1 || seat > s.n || !canAct(s, seat)) return; if (seat === s.turn) { s.status[seat] = 'folded'; s.acted[seat] = true; afterAct(s, seat, 'fold'); } else { s.status[seat] = 'folded'; s.acted[seat] = true; log(s, { seat: seat, a: 'fold', amt: 0, street: s.phase }); s.event = { t: 'fold', seat: seat }; s.seq++; advance(s, true); } }
  function view(s, seat) {
    var v = {}; for (var k in s) if (k !== 'deck' && k !== 'hands') v[k] = s[k];
    v.hands = [null];
    for (var p = 1; p <= s.n; p++) { var show = p === seat || (s.over && s.showdown && live(s, p)); v.hands.push(show && s.hands[p] ? s.hands[p].slice() : null); }
    v.seat = seat; v.hasCards = []; for (var q = 1; q <= s.n; q++) v.hasCards[q] = s.status[q] !== 'out';
    if (seat >= 1 && seat <= s.n && s.hands[seat] && live(s, seat)) v.myHand = s.board.length ? describe(evalCards(s.hands[seat].concat(s.board))) : '';
    return v;
  }
  /* stacks for the next hand: carry over; busted players re-buy (virtual) */
  function nextStacks(s) { var a = [0]; for (var p = 1; p <= s.n; p++) a.push(s.stacks[p] < s.bb ? s.buyin : s.stacks[p]); return a; }
  var API = { id: 'holdem', name: "Texas Hold'em", nSeats: 6, CAT: CAT, rankOf: rankOf, suitOf: suitOf, rankName: rankName, cardName: cardName, evalCards: evalCards, catOf: catOf, describe: describe,
    newGame: newGame, move: move, resign: resign, view: view, options: options, nextStacks: nextStacks, shuffleDeck: shuffleDeck, liveCount: liveCount };
  if (typeof module !== 'undefined' && module.exports) module.exports = API; else (self.GH = self.GH || {}).Holdem = API;
})();
