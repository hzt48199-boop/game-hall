/* 斗地主规则引擎(3 人,纯虚拟积分)。座位 1..3。
   牌用 0..53 的整数: 0..51 → 点数 3..15(3..10,J=11,Q=12,K=13,A=14,2=15)各 4 花色; 52=小王(16) 53=大王(17)。
   叫分: 每人依次叫一次(0=不叫,1/2/3 须高于当前最高叫分),叫 3 分立即成为地主;三人都不叫则重新发牌。
   牌型: 单张 对子 三张 三带一 三带二 顺子(>=5) 连对(>=3) 飞机(>=2 个连续三张,可带同数量单张或对子) 四带二(两单/两对) 炸弹 火箭。
   计分: 底分 × 叫分 × 2^(炸弹数+火箭数) × (春天/反春 ×2);地主赢两个农民各付、输各得。 */
(function () {
  var NAMES = { 3: '3', 4: '4', 5: '5', 6: '6', 7: '7', 8: '8', 9: '9', 10: '10', 11: 'J', 12: 'Q', 13: 'K', 14: 'A', 15: '2', 16: 'Small Joker', 17: 'Big Joker' };
  function rankOf(id) { return id < 52 ? 3 + (id >> 2) : 16 + (id - 52); }
  function suitOf(id) { return id < 52 ? id & 3 : 4; }
  function sortHand(h) { return h.sort(function (a, b) { return rankOf(b) - rankOf(a) || a - b; }); }
  function counts(cards) { var c = {}; for (var i = 0; i < cards.length; i++) { var r = rankOf(cards[i]); c[r] = (c[r] || 0) + 1; } return c; }
  function ranksSorted(c) { return Object.keys(c).map(Number).sort(function (a, b) { return a - b; }); }
  function consecutive(rs) { for (var i = 1; i < rs.length; i++) if (rs[i] !== rs[i - 1] + 1) return false; return true; }

  /* 判定牌型: 返回 {type, rank, len, n} 或 null。rank=用于比较大小的主点数,len=顺子/连对/飞机的组数 */
  function classify(cards) {
    var n = cards.length; if (!n) return null;
    var c = counts(cards), rs = ranksSorted(c), nr = rs.length, i, k;
    if (n === 1) return { type: 'single', rank: rs[0], len: 1, n: 1 };
    if (n === 2) { if (nr === 1) return { type: 'pair', rank: rs[0], len: 1, n: 2 }; if (c[16] && c[17]) return { type: 'rocket', rank: 99, len: 1, n: 2 }; return null; }
    if (n === 3) return nr === 1 ? { type: 'triple', rank: rs[0], len: 1, n: 3 } : null;
    if (n === 4) {
      if (nr === 1) return { type: 'bomb', rank: rs[0], len: 1, n: 4 };
      for (i = 0; i < nr; i++) if (c[rs[i]] === 3) return { type: 'triple1', rank: rs[i], len: 1, n: 4 };
      return null;
    }
    // 顺子
    if (n >= 5 && nr === n && rs[nr - 1] <= 14 && consecutive(rs)) return { type: 'straight', rank: rs[nr - 1], len: n, n: n };
    // 连对
    if (n >= 6 && n % 2 === 0 && nr === n / 2 && rs[nr - 1] <= 14 && consecutive(rs) && rs.every(function (r) { return c[r] === 2; })) return { type: 'pairstraight', rank: rs[nr - 1], len: nr, n: n };
    if (n === 5) { if (nr === 2 && ((c[rs[0]] === 3 && c[rs[1]] === 2) || (c[rs[0]] === 2 && c[rs[1]] === 3))) return { type: 'triple2', rank: c[rs[0]] === 3 ? rs[0] : rs[1], len: 1, n: 5 }; return null; }
    // 四带二
    for (i = 0; i < nr; i++) if (c[rs[i]] === 4) {
      var rest = []; rs.forEach(function (r) { if (r !== rs[i]) rest.push(r); });
      var restN = n - 4;
      if (n === 6) return { type: 'four2', rank: rs[i], len: 1, n: 6 };       // 带两张单牌(含一对)
      if (n === 8 && rest.every(function (r) { return c[r] % 2 === 0; }) && restN === 4) return { type: 'four22', rank: rs[i], len: 1, n: 8 };
    }
    // 飞机: 以最高的合法起点判定
    var best = null;
    var tr = rs.filter(function (r) { return c[r] >= 3 && r <= 14; });
    for (var wing = 0; wing <= 2; wing++) {
      var per = 3 + (wing === 0 ? 0 : wing === 1 ? 1 : 2);
      if (n % per !== 0) continue; var kk = n / per; if (kk < 2) continue;
      for (var st = 0; st + kk <= tr.length; st++) {
        var run = tr.slice(st, st + kk); if (!consecutive(run)) continue;
        var remain = n - 3 * kk, ok = true;
        if (wing === 2) { // 剩余牌必须全是成对的
          var cc = {}; for (var q in c) cc[q] = c[q]; run.forEach(function (r) { cc[r] -= 3; });
          for (var q2 in cc) if (cc[q2] % 2 !== 0) ok = false;
          if (ok && Object.keys(cc).reduce(function (a, q3) { return a + cc[q3] / 2; }, 0) !== kk) ok = false;
        }
        if (ok && wing === 1) { /* 翼为 kk 张任意牌 */ }
        if (ok) { var cand = { type: wing === 0 ? 'plane' : wing === 1 ? 'plane1' : 'plane2', rank: run[run.length - 1], len: kk, n: n }; if (!best || cand.rank > best.rank) best = cand; }
      }
    }
    return best;
  }
  function isBombish(t) { return t === 'bomb' || t === 'rocket'; }
  /* play 能否压过 last(last 为 classify 结果,null 表示自由出牌) */
  function beats(play, last) {
    if (!play) return false; if (!last) return true;
    if (last.type === 'rocket') return false;
    if (play.type === 'rocket') return true;
    if (play.type === 'bomb') return last.type !== 'bomb' || play.rank > last.rank;
    if (last.type === 'bomb') return false;
    return play.type === last.type && play.n === last.n && play.len === last.len && play.rank > last.rank;
  }

  function shuffleDeck(rng) { var d = []; for (var i = 0; i < 54; i++) d.push(i); for (var j = 53; j > 0; j--) { var k = Math.floor(rng() * (j + 1)), t = d[j]; d[j] = d[k]; d[k] = t; } return d; }
  function deal(s, rng) {
    var d = shuffleDeck(rng);
    s.hands = [null, sortHand(d.slice(0, 17)), sortHand(d.slice(17, 34)), sortHand(d.slice(34, 51))];
    s.bottom = sortHand(d.slice(51, 54));
    s.bid = { bids: [null, null, null, null], high: 0, highSeat: 0, count: 0 };
    s.firstBidder = 1 + Math.floor(rng() * 3); s.turn = s.firstBidder;
    s.event = { t: 'deal', seat: 0 }; s.seq++;
  }
  function newGame(opts) {
    opts = opts || {}; var rng = opts.rng || Math.random;
    var s = { game: 'doudizhu', phase: 'bid', hands: null, bottom: [], bid: null, landlord: 0, turn: 1, firstBidder: 1, last: null, passes: 0, plays: [], mult: 1, bombs: 0, spring: false,
      winner: 0, winners: [], over: false, reason: '', scores: [0, 0, 0, 0], base: opts.base || 1, redeals: 0, seq: 0, event: null, counts: [0, 17, 17, 17], playedCount: [0, 0, 0, 0], _rng: rng };
    deal(s, rng); return s;
  }
  function removeCards(hand, cards) {
    var h = hand.slice();
    for (var i = 0; i < cards.length; i++) { var k = h.indexOf(cards[i]); if (k < 0) return null; h.splice(k, 1); }
    return h;
  }
  function finish(s, winSeat) {
    s.over = true; s.phase = 'over'; var ll = s.landlord, landlordWin = winSeat === ll;
    var farmerPlays = 0, landlordPlays = s.playedCount[ll];
    for (var p = 1; p <= 3; p++) if (p !== ll) farmerPlays += s.playedCount[p];
    var spring = false;
    if (landlordWin && farmerPlays === 0) spring = true;           // 春天
    if (!landlordWin && landlordPlays === 1) spring = true;         // 反春(地主只出过一手)
    s.spring = spring;
    var m = s.mult * (spring ? 2 : 1), per = s.base * s.bid.high * m;
    s.finalMult = s.bid.high * m;
    s.winners = []; for (var q = 1; q <= 3; q++) if ((q === ll) === landlordWin) s.winners.push(q);
    s.winner = winSeat;
    for (q = 1; q <= 3; q++) {
      if (q === ll) s.scores[q] = landlordWin ? 2 * per : -2 * per; else s.scores[q] = landlordWin ? -per : per;
    }
    s.reason = (landlordWin ? 'Landlord wins' : 'Farmers win') + (spring ? (landlordWin ? ' (Spring x2)' : ' (Reverse spring x2)') : '') + ', multiplier ' + s.finalMult;
    s.event = { t: 'win', seat: winSeat }; s.seq++;
  }
  function move(s, seat, mv) {
    if (s.over) return { ok: false, err: 'The hand is over' };
    if (seat !== s.turn) return { ok: false, err: 'Not your turn' };
    if (!mv || typeof mv !== 'object') return { ok: false, err: 'Invalid action' };
    if (s.phase === 'bid') {
      var b = mv.bid; if (!Number.isInteger(b) || b < 0 || b > 3) return { ok: false, err: 'Invalid bid' };
      if (b !== 0 && b <= s.bid.high) return { ok: false, err: 'Bid must be higher than ' + s.bid.high };
      s.bid.bids[seat] = b; s.bid.count++; if (b > 0) { s.bid.high = b; s.bid.highSeat = seat; }
      s.event = { t: 'bid', seat: seat, v: b }; s.seq++;
      if (b === 3 || s.bid.count >= 3) {
        if (s.bid.high === 0) { // 流局重新发牌
          s.redeals++; deal(s, s._rng || Math.random); s.event = { t: 'redeal', seat: 0 }; return { ok: true, kind: 'redeal' };
        }
        s.landlord = s.bid.highSeat; s.hands[s.landlord] = sortHand(s.hands[s.landlord].concat(s.bottom)); s.phase = 'play'; s.turn = s.landlord;
        s.counts = [0, s.hands[1].length, s.hands[2].length, s.hands[3].length]; s.last = null; s.passes = 0;
        s.event = { t: 'landlord', seat: s.landlord }; s.seq++;
        return { ok: true, kind: 'landlord' };
      }
      s.turn = seat % 3 + 1; return { ok: true, kind: 'bid' };
    }
    // 出牌阶段
    if (mv.pass) {
      if (!s.last) return { ok: false, err: 'You lead - you must play' };
      s.passes++; s.plays.push({ seat: seat, pass: true }); s.event = { t: 'pass', seat: seat }; s.seq++;
      if (s.passes >= 2) { s.last = null; s.passes = 0; }
      s.turn = seat % 3 + 1; return { ok: true, kind: 'pass' };
    }
    var cards = mv.cards; if (!Array.isArray(cards) || !cards.length || cards.length > 20 || cards.some(function (x) { return !Number.isInteger(x) || x < 0 || x > 53; })) return { ok: false, err: 'Invalid play' };
    if (new Set(cards).size !== cards.length) return { ok: false, err: 'Invalid play' };
    var rest = removeCards(s.hands[seat], cards); if (!rest) return { ok: false, err: 'You do not have those cards' };
    var cl = classify(cards); if (!cl) return { ok: false, err: 'Not a valid combination' };
    if (s.last && !beats(cl, s.last.cl)) return { ok: false, err: 'That does not beat the last play' };
    var wasLast = !!s.last;
    s.hands[seat] = rest; s.counts[seat] = rest.length; s.playedCount[seat]++;
    s.last = { seat: seat, cards: sortHand(cards.slice()), cl: cl }; s.passes = 0;
    s.plays.push({ seat: seat, cards: s.last.cards, type: cl.type, lead: !wasLast });
    var kind = 'play';
    if (cl.type === 'bomb') { s.bombs++; s.mult *= 2; kind = 'bomb'; } else if (cl.type === 'rocket') { s.bombs++; s.mult *= 2; kind = 'rocket'; }
    s.event = { t: kind, seat: seat, type: cl.type }; s.seq++;
    if (!rest.length) { finish(s, seat); return { ok: true, kind: 'win' }; }
    s.turn = seat % 3 + 1; return { ok: true, kind: kind };
  }
  function resign(s, seat) { if (s.over) return; if (s.phase === 'bid') { s.over = true; s.phase = 'over'; s.reason = 'A player left'; s.winners = []; return; } var ll = s.landlord; finish(s, seat === ll ? (ll % 3 + 1) : ll); s.reason = 'A player left, ' + s.reason; }
  /* 视角: 只显示自己的手牌;其他人只给张数;地主确定后底牌公开 */
  function view(s, seat) {
    var v = {};
    for (var k in s) if (k !== '_rng' && k !== 'hands') v[k] = s[k];
    v.hands = [null, null, null, null];
    for (var p = 1; p <= 3; p++) v.hands[p] = (p === seat || s.over) ? s.hands[p].slice() : null;
    v.counts = [0, s.hands[1].length, s.hands[2].length, s.hands[3].length];
    if (s.phase === 'bid') v.bottom = [];
    return v;
  }
  /* ---- 出牌枚举(AI 与界面提示共用) ---- */
  function groupByRank(hand) { var g = {}; hand.forEach(function (id) { var r = rankOf(id); (g[r] = g[r] || []).push(id); }); return g; }
  function takeLowestKickers(g, excludeRanks, size, n) { // 选 n 个"组"(size=1 单张/2 对子)的最小可用牌
    var out = [], rs = Object.keys(g).map(Number).sort(function (a, b) { return a - b; });
    for (var i = 0; i < rs.length && out.length < n * size; i++) { var r = rs[i]; if (excludeRanks.indexOf(r) >= 0) continue; if (g[r].length >= size) { if (size === 1 || g[r].length >= 2) out = out.concat(g[r].slice(0, size)); } }
    return out.length === n * size ? out : null;
  }
  /* 枚举全部(带限制的)合法出牌。last=null 为领出。kickers 只取最小的若干种以限制数量。 */
  function genMoves(hand, last) {
    var g = groupByRank(hand), rs = Object.keys(g).map(Number).sort(function (a, b) { return a - b; }), out = [], i, j;
    var lastCl = last ? last.cl || last : null;
    function add(cards) { var cl = classify(cards); if (cl && beats(cl, lastCl)) out.push({ cards: cards, cl: cl }); }
    var want = lastCl ? lastCl.type : null;
    function can(t) { return !want || want === t || t === 'bomb' || t === 'rocket'; }
    if (can('single') && (!want || want === 'single')) rs.forEach(function (r) { add([g[r][0]]); });
    if (!want || want === 'pair') rs.forEach(function (r) { if (g[r].length >= 2) add(g[r].slice(0, 2)); });
    if (!want || want === 'triple') rs.forEach(function (r) { if (g[r].length >= 3) add(g[r].slice(0, 3)); });
    if (!want || want === 'triple1') rs.forEach(function (r) { if (g[r].length >= 3) { var seenK = 0; rs.forEach(function (k) { if (k !== r && seenK < 3) { seenK++; add(g[r].slice(0, 3).concat([g[k][0]])); } }); } });
    if (!want || want === 'triple2') rs.forEach(function (r) { if (g[r].length >= 3) { var seenK = 0; rs.forEach(function (k) { if (k !== r && g[k].length >= 2 && seenK < 3) { seenK++; add(g[r].slice(0, 3).concat(g[k].slice(0, 2))); } }); } });
    var runs = function (minLen, need, cap) { // 连续点数(<=14)的区间
      var res = []; for (var a = 0; a < rs.length; a++) { if (rs[a] > 14) break; var b = a, len = 0; while (b < rs.length && rs[b] <= 14 && (b === a || rs[b] === rs[b - 1] + 1) && g[rs[b]].length >= need) { len++; b++; if (len >= minLen) res.push([a, b]); } } return res; };
    if (!want || want === 'straight') runs(5, 1).forEach(function (ab) { var cs = []; for (var x = ab[0]; x < ab[1]; x++) cs.push(g[rs[x]][0]); if (!want || cs.length === lastCl.n) add(cs); });
    if (!want || want === 'pairstraight') runs(3, 2).forEach(function (ab) { var cs = []; for (var x = ab[0]; x < ab[1]; x++) cs = cs.concat(g[rs[x]].slice(0, 2)); if (!want || cs.length === lastCl.n) add(cs); });
    if (!want || want === 'plane' || want === 'plane1' || want === 'plane2') runs(2, 3).forEach(function (ab) {
      var k = ab[1] - ab[0], tri = [], trR = []; for (var x = ab[0]; x < ab[1]; x++) { tri = tri.concat(g[rs[x]].slice(0, 3)); trR.push(rs[x]); }
      if (!want || want === 'plane') add(tri);
      if (!want || want === 'plane1') { var w1 = takeLowestKickers(g, trR, 1, k); if (w1) add(tri.concat(w1)); }
      if (!want || want === 'plane2') { var w2 = takeLowestKickers(g, trR, 2, k); if (w2) add(tri.concat(w2)); }
    });
    if (!want || want === 'four2') rs.forEach(function (r) { if (g[r].length === 4) { var w = takeLowestKickers(g, [r], 1, 2); if (w) add(g[r].concat(w)); } });
    if (!want || want === 'four22') rs.forEach(function (r) { if (g[r].length === 4) { var w = takeLowestKickers(g, [r], 2, 2); if (w) add(g[r].concat(w)); } });
    rs.forEach(function (r) { if (g[r].length === 4) add(g[r].slice()); });
    if (g[16] && g[17]) add([g[16][0], g[17][0]]);
    return out;
  }
  var API = { id: 'doudizhu', name: 'Dou Dizhu', nSeats: 3, NAMES: NAMES, rankOf: rankOf, suitOf: suitOf, sortHand: sortHand, classify: classify, beats: beats, newGame: newGame, move: move, resign: resign, view: view,
    genMoves: genMoves, groupByRank: groupByRank, counts: counts, removeCards: removeCards, shuffleDeck: shuffleDeck };
  if (typeof module !== 'undefined' && module.exports) module.exports = API; else (self.GH = self.GH || {}).Doudizhu = API;
})();
