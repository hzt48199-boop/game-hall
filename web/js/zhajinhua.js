/* 炸金花(三张牌)规则引擎,2~6 人,纯虚拟积分(欢乐豆),仅供娱乐。座位 1..n。
   牌: 0..51,点数 = 2 + (id>>2)(2..14,A=14),花色 = id&3。
   牌型大小: 豹子(三条) > 同花顺 > 金花(同花) > 顺子 > 对子 > 单张。
   A-2-3 默认按"最小的顺子"处理(opts.a23='low'),可设为 'off'(A-2-3 不算顺子);Q-K-A 是最大顺子。
   可选规则 opts.special235=true(默认关闭): 不同花的 2-3-5 可以吃豹子,其余情形仍按最小的单张。
   下注: 每人先交底注 ante 进池;unit 为当前"单注";未看牌(暗注)跟注付 unit,已看牌(明注)跟注付 2×unit;
   加注 = 把 unit 提高到更高一档(档位 = 底注 × [1,2,5,10]),付新单注(明注付 2×);
   比牌 = 已看牌者指定另一名未弃牌的玩家比大小,付 2×自己的跟注额,输家出局(平局算发起者输),第 2 轮起(或只剩两人)才能比牌;
   一轮 = 所有未出局玩家各行动一次,超过 maxRounds 轮自动封顶开牌;轮到的人豆不够跟注时也直接开牌。
   每局每人带入 stack(默认 1000)虚拟欢乐豆,结算 = 期末 − 期初,零和。 */
(function () {
  var CATS = ['', 'High card', 'Pair', 'Straight', 'Flush', 'Straight flush', 'Three of a kind'];
  var RANKN = { 11: 'J', 12: 'Q', 13: 'K', 14: 'A' };
  var SUITC = ['♠', '♥', '♣', '♦'];
  function rankOf(id) { return 2 + (id >> 2); }
  function suitOf(id) { return id & 3; }
  function rankName(r) { return RANKN[r] || String(r); }
  function cardName(id) { return SUITC[suitOf(id)] + rankName(rankOf(id)); }

  /* 评估三张牌 → {cat, key, score, name, is235}。 score 越大牌越大,可直接比较(特殊 235 规则在 compareHands 里处理) */
  function evalHand(cards, opts) {
    opts = opts || {};
    var rs = cards.map(rankOf).sort(function (a, b) { return b - a; });
    var flush = suitOf(cards[0]) === suitOf(cards[1]) && suitOf(cards[1]) === suitOf(cards[2]);
    var cat, key;
    var run = rs[0] - 1 === rs[1] && rs[1] - 1 === rs[2];
    var a23 = rs[0] === 14 && rs[1] === 3 && rs[2] === 2 && opts.a23 !== 'off';
    var straight = run || a23, high = a23 ? 3 : rs[0];
    if (rs[0] === rs[2]) { cat = 6; key = [rs[0]]; }
    else if (straight && flush) { cat = 5; key = [high]; }
    else if (flush) { cat = 4; key = rs.slice(); }
    else if (straight) { cat = 3; key = [high]; }
    else if (rs[0] === rs[1]) { cat = 2; key = [rs[0], rs[2]]; }
    else if (rs[1] === rs[2]) { cat = 2; key = [rs[1], rs[0]]; }
    else { cat = 1; key = rs.slice(); }
    var score = cat * 1000000 + (key[0] || 0) * 10000 + (key[1] || 0) * 100 + (key[2] || 0);
    var is235 = !flush && rs[0] === 5 && rs[1] === 3 && rs[2] === 2;
    var name = CATS[cat];
    if (cat === 6) name = 'Three of a kind ' + rankName(rs[0]) + rankName(rs[0]) + rankName(rs[0]);
    return { cat: cat, key: key, score: score, name: name, is235: is235 };
  }
  /* >0: a 大;<0: b 大;0: 完全相同(花色不分大小) */
  function compareHands(a, b, opts) {
    opts = opts || {};
    var ea = evalHand(a, opts), eb = evalHand(b, opts);
    if (opts.special235) {
      if (ea.is235 && eb.cat === 6) return 1;
      if (eb.is235 && ea.cat === 6) return -1;
    }
    return ea.score - eb.score;
  }

  function shuffleDeck(rng) { var d = []; for (var i = 0; i < 52; i++) d.push(i); for (var j = 51; j > 0; j--) { var k = Math.floor(rng() * (j + 1)), t = d[j]; d[j] = d[k]; d[k] = t; } return d; }
  function sortHand(h) { return h.sort(function (a, b) { return rankOf(b) - rankOf(a) || a - b; }); }
  function cyc(s, from) { var q = []; for (var i = 1; i <= s.n; i++) { var p = ((from - 1 + i) % s.n) + 1; if (s.status[p] === 'active') q.push(p); } return q; }
  function activeList(s) { var a = []; for (var p = 1; p <= s.n; p++) if (s.status[p] === 'active') a.push(p); return a; }

  function newGame(o) {
    o = o || {}; var rng = o.rng || Math.random;
    var n = Math.max(2, Math.min(6, Math.floor(o.n || 4))), ante = o.ante || 10, stack0 = o.stack || 1000;
    var s = { game: 'zhajinhua', phase: 'bet', n: n, ante: ante, stack0: stack0, unit: ante, levels: [ante, ante * 2, ante * 5, ante * 10], round: 1, maxRounds: o.maxRounds || 10,
      dealer: ((Math.floor(o.dealer || 1) - 1) % n) + 1, turn: 0, queue: [], pot: 0, stacks: [0], contrib: [0], status: [''], seen: [false], raises: [0], calls: [0], cards: [null], knows: [null],
      log: [], event: null, seq: 0, over: false, showdown: false, winners: [], scores: [0], reason: '', opts: { special235: !!o.special235, a23: o.a23 === 'off' ? 'off' : 'low' }, _rng: rng };
    var d = shuffleDeck(rng);
    for (var p = 1; p <= n; p++) {
      s.stacks.push(stack0 - ante); s.contrib.push(ante); s.status.push('active'); s.seen.push(false); s.raises.push(0); s.calls.push(0);
      s.cards.push(sortHand(d.slice((p - 1) * 3, p * 3))); s.knows.push([]); s.scores.push(0); s.pot += ante;
    }
    s.queue = cyc(s, s.dealer); s.turn = s.queue[0];
    s.event = { t: 'deal', seat: 0 }; s.seq++;
    checkTurn(s);
    return s;
  }
  function callCost(s, p) { return s.seen[p] ? 2 * s.unit : s.unit; }
  function pay(s, p, amt) { s.stacks[p] -= amt; s.contrib[p] += amt; s.pot += amt; }
  function pushLog(s, e) { e.round = s.round; s.log.push(e); if (s.log.length > 40) s.log.shift(); }

  function finish(s, winners, reason, showdown) {
    s.over = true; s.phase = 'over'; s.showdown = !!showdown; s.winners = winners.slice(); s.turn = 0; s.queue = [];
    var share = Math.floor(s.pot / winners.length), extra = s.pot - share * winners.length;
    winners.forEach(function (w, i) { s.stacks[w] += share + (i === 0 ? extra : 0); });
    for (var p = 1; p <= s.n; p++) s.scores[p] = s.stacks[p] - s.stack0;
    s.reason = reason; s.final = { t: showdown ? 'showdown' : 'win', seat: winners[0] }; // 不覆盖最后一个动作事件(音效按动作播放,结算音由界面播)
  }
  function doShowdown(s, why) {
    var act = activeList(s), best = [act[0]];
    for (var i = 1; i < act.length; i++) { var c = compareHands(s.cards[act[i]], s.cards[best[0]], s.opts); if (c > 0) best = [act[i]]; else if (c === 0) best.push(act[i]); }
    var e = evalHand(s.cards[best[0]], s.opts);
    finish(s, best, why + ', ' + (best.length > 1 ? best.length + ' players tie and split the pot' : 'seat ' + best[0] + ' wins with ' + e.name), true);
  }
  /* 一个行动结束后推进: 只剩一人 → 结束;队列空 → 新一轮(超过封顶则开牌);豆不够跟注 → 开牌 */
  function checkTurn(s) {
    if (s.over) return;
    var act = activeList(s);
    if (act.length === 1) return finish(s, [act[0]], 'All other players folded or lost a comparison - seat ' + act[0] + ' wins', false);
    if (!s.queue.length) {
      s.round++;
      if (s.round > s.maxRounds) return doShowdown(s, 'Round limit (' + s.maxRounds + ') reached - showdown');
      s.queue = cyc(s, s.dealer);
    }
    s.turn = s.queue[0];
    if (s.stacks[s.turn] < callCost(s, s.turn)) return doShowdown(s, 'Seat ' + s.turn + ' cannot afford to call - showdown');
  }
  function dropFromQueue(s, p) { var i = s.queue.indexOf(p); if (i >= 0) s.queue.splice(i, 1); }

  function options(s, seat) {
    var o = { turn: false, look: false, fold: false, call: 0, raise: [], compare: [], callCost: 0 };
    if (s.over || seat < 1 || seat > s.n || s.status[seat] !== 'active') return o;
    o.look = !s.seen[seat];
    if (s.turn !== seat) return o;
    o.turn = true; o.fold = true; o.callCost = callCost(s, seat);
    var st = s.stacks[seat];
    if (st >= o.callCost) o.call = o.callCost;
    s.levels.forEach(function (u) { if (u > s.unit) { var c = s.seen[seat] ? 2 * u : u; if (c <= st) o.raise.push({ unit: u, cost: c }); } });
    var act = activeList(s);
    if (s.seen[seat] && (s.round >= 2 || act.length === 2) && st >= 2 * o.callCost) act.forEach(function (p) { if (p !== seat) o.compare.push({ target: p, cost: 2 * o.callCost }); });
    return o;
  }

  function foldSeat(s, seat, kind) {
    s.status[seat] = 'folded'; dropFromQueue(s, seat);
    pushLog(s, { seat: seat, a: 'fold' }); s.event = { t: 'fold', seat: seat }; s.seq++; checkTurn(s);
  }
  function move(s, seat, mv) {
    if (s.over) return { ok: false, err: 'The hand is over' };
    if (!Number.isInteger(seat) || seat < 1 || seat > s.n || s.status[seat] !== 'active') return { ok: false, err: 'You are not in this hand' };
    if (!mv || typeof mv !== 'object' || typeof mv.a !== 'string') return { ok: false, err: 'Invalid action' };
    if (mv.a === 'look') {
      if (s.seen[seat]) return { ok: false, err: 'You have already looked' };
      s.seen[seat] = true; pushLog(s, { seat: seat, a: 'look' }); s.event = { t: 'look', seat: seat }; s.seq++;
      if (s.turn && s.stacks[s.turn] < callCost(s, s.turn)) checkTurn(s); // 看牌会让明注变贵: 重新检查是否开牌
      return { ok: true, kind: 'look' };
    }
    if (seat !== s.turn) return { ok: false, err: 'Not your turn' };
    var o = options(s, seat);
    if (mv.a === 'fold') { foldSeat(s, seat); return { ok: true, kind: 'fold' }; }
    if (mv.a === 'call') {
      if (!o.call) return { ok: false, err: 'Not enough beans' };
      pay(s, seat, o.call); s.calls[seat]++; dropFromQueue(s, seat);
      pushLog(s, { seat: seat, a: 'call', amt: o.call }); s.event = { t: 'call', seat: seat, amt: o.call }; s.seq++; checkTurn(s); return { ok: true, kind: 'call' };
    }
    if (mv.a === 'raise') {
      var r = o.raise.filter(function (x) { return x.unit === mv.unit; })[0];
      if (!r) return { ok: false, err: 'Invalid raise level or not enough beans' };
      pay(s, seat, r.cost); s.unit = r.unit; s.raises[seat]++; dropFromQueue(s, seat);
      pushLog(s, { seat: seat, a: 'raise', amt: r.cost, unit: r.unit }); s.event = { t: 'raise', seat: seat, amt: r.cost, unit: r.unit }; s.seq++; checkTurn(s); return { ok: true, kind: 'raise' };
    }
    if (mv.a === 'compare') {
      if (!s.seen[seat]) return { ok: false, err: 'Look at your cards before comparing' };
      var t = o.compare.filter(function (x) { return x.target === mv.target; })[0];
      if (!t) return { ok: false, err: s.round < 2 && activeList(s).length > 2 ? 'Comparing is allowed from round 2' : 'Cannot compare with that player (or not enough beans)' };
      pay(s, seat, t.cost);
      var c = compareHands(s.cards[seat], s.cards[t.target], s.opts), loser = c > 0 ? t.target : seat; // 平局发起者输
      s.status[loser] = 'lost'; dropFromQueue(s, loser); dropFromQueue(s, seat);
      s.knows[seat].push(t.target); s.knows[t.target].push(seat);
      pushLog(s, { seat: seat, a: 'compare', target: t.target, loser: loser, amt: t.cost }); s.event = { t: 'compare', seat: seat, target: t.target, loser: loser, amt: t.cost }; s.seq++;
      checkTurn(s); return { ok: true, kind: 'compare', loser: loser };
    }
    return { ok: false, err: 'Unknown action' };
  }
  function resign(s, seat) { // 离开 / 认输 = 弃牌
    if (s.over || seat < 1 || seat > s.n || s.status[seat] !== 'active') return;
    foldSeat(s, seat);
  }
  /* 视角: 只看得到自己已看过的牌、比牌时对方亮给自己的牌;开牌结算后未弃牌者亮牌 */
  function view(s, seat) {
    var v = {};
    for (var k in s) if (k !== '_rng' && k !== 'cards' && k !== 'knows') v[k] = s[k];
    v.hands = [null]; v.handNames = [null]; v.knows = (s.knows[seat] || []).slice();
    for (var p = 1; p <= s.n; p++) {
      var vis = (p === seat && s.seen[p]) || (s.knows[seat] && s.knows[seat].indexOf(p) >= 0) || (s.over && s.showdown && s.status[p] === 'active');
      v.hands.push(vis ? s.cards[p].slice() : null); v.handNames.push(vis ? evalHand(s.cards[p], s.opts).name : '');
    }
    v.seat = seat; v.levels = s.levels.slice(); v.queue = s.queue.slice();
    return v;
  }
  var API = { id: 'zhajinhua', name: 'Zha Jin Hua', nSeats: 6, CATS: CATS, rankOf: rankOf, suitOf: suitOf, cardName: cardName, rankName: rankName, evalHand: evalHand, compareHands: compareHands,
    newGame: newGame, move: move, resign: resign, view: view, options: options, callCost: callCost, activeList: activeList, shuffleDeck: shuffleDeck };
  if (typeof module !== 'undefined' && module.exports) module.exports = API; else (self.GH = self.GH || {}).Zhajinhua = API;
})();
