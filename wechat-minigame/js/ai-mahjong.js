/* 麻将 AI。level 1 简单: 随机打孤张,偶尔碰;level 2 普通: 向听数最小化(不看牌河/防守);
   level 3 困难: 向听数 + 进张数(ukeire,按场上可见牌数修正) + 番型倾向(清一色/字牌刻/役牌) + 防守(估计对手威胁,
   在落后且牌型差时改打最安全的牌) + 吃碰杠取舍(只在不降低牌效/提高番数时副露)。AI 只使用视角信息(view),不看他人手牌/牌墙。 */
(function () {
  var M = (typeof require === 'function') ? require('./mahjong.js') : GH.Mahjong;
  function rnd(n) { return Math.floor(Math.random() * n); }
  function visibleCounts(v, seat) {
    var vis = new Array(34).fill(0), i, p;
    v.hands[seat].forEach(function (t) { vis[t]++; });
    for (p = 1; p <= 4; p++) {
      v.discards[p].forEach(function (t) { vis[t]++; });
      v.melds[p].forEach(function (m) { m.tiles.forEach(function (t) { vis[t]++; }); });
    }
    if (v.claim && v.claim.tile >= 0 && v.discards[v.claim.from] && v.discards[v.claim.from].indexOf(v.claim.tile) < 0) vis[v.claim.tile]++;
    return vis;
  }
  function shantenOf(c, nm) { return M.shanten(c, nm); }
  // 对手威胁估计 0..1
  function threat(v, p) {
    var ml = v.melds[p].length, t = ml * 0.28 + (v.discards[p].length > 8 ? 0.2 : 0) + (v.discards[p].length > 12 ? 0.15 : 0);
    if (v.melds[p].some(function (m) { return m.type === 'ankong' || m.type === 'kong' || m.type === 'addkong'; })) t += 0.1;
    return Math.min(1, t);
  }
  function tileDanger(v, seat, t, vis) {
    var d = 0, p;
    for (p = 1; p <= 4; p++) {
      if (p === seat) continue;
      var th = threat(v, p); if (th < 0.2) th = 0.15;
      var risk;
      if (v.discards[p].indexOf(t) >= 0) risk = 0.05; // 对手自己打过
      else if (t >= 27) { var seen = 0; seen = 0; risk = vis[t] >= 3 ? 0.08 : vis[t] >= 2 ? 0.25 : 0.5; }
      else { var r = t % 9; risk = (r === 0 || r === 8) ? 0.3 : (r === 1 || r === 7) ? 0.5 : 0.8; if (vis[t] >= 3) risk *= 0.5; }
      // 对手在某花色上副露多 → 该花色更危险
      var suitMelds = v.melds[p].filter(function (m) { return M.suitOf(m.tiles[0]) === M.suitOf(t); }).length; if (suitMelds) risk = Math.min(1, risk * 1.5);
      d += th * risk;
    }
    return d;
  }
  function ukeire(c, nm, base, vis) {
    var n = 0;
    for (var k = 0; k < 34; k++) { var left = 4 - vis[k]; if (left <= 0 || c[k] >= 4) continue; c[k]++; var s = shantenOf(c, nm); c[k]--; if (s < base) n += left; }
    return n;
  }
  function dominantSuit(hand, melds) {
    var cnt = [0, 0, 0, 0]; hand.forEach(function (t) { cnt[M.suitOf(t)]++; }); melds.forEach(function (m) { m.tiles.forEach(function (t) { cnt[M.suitOf(t)]++; }); });
    var bs = 0; for (var s = 1; s < 3; s++) if (cnt[s] > cnt[bs]) bs = s;
    return { suit: bs, n: cnt[bs] + cnt[3] * 0.5, honors: cnt[3] };
  }
  function discardChoice(v, seat, level, opts) {
    var hand = v.hands[seat], nm = v.melds[seat].length, c = M.toCounts(hand), kinds = [], k;
    for (k = 0; k < 34; k++) if (c[k]) kinds.push(k);
    if (level === 1) { // 简单: 优先打字牌孤张,否则随机
      var iso = kinds.filter(function (t) { return c[t] === 1 && (t >= 27 || (t % 9 === 0 || t % 9 === 8)); }); var pool = iso.length ? iso : kinds; return pool[rnd(pool.length)];
    }
    var vis = visibleCounts(v, seat), res = [], bestSh = 99;
    kinds.forEach(function (t) { c[t]--; var s = shantenOf(c, nm); c[t]++; res.push({ t: t, sh: s }); if (s < bestSh) bestSh = s; });
    if (level === 2) {
      var best2 = res.filter(function (r) { return r.sh === bestSh; }); // 同向听: 先打字牌/幺九孤张
      best2.sort(function (a, b) { return value2(a.t, c) - value2(b.t, c); }); return best2[0].t;
    }
    // 困难
    var dom = dominantSuit(hand, v.melds[seat]), flush = dom.n >= 9 && v.hands[seat].length <= 14;
    var behindDefense = false, maxTh = 0; for (var p = 1; p <= 4; p++) if (p !== seat) maxTh = Math.max(maxTh, threat(v, p));
    var cands = res.filter(function (r) { return r.sh <= bestSh + (bestSh >= 3 ? 1 : 0); });
    var late = v.wallCount < 40;
    behindDefense = bestSh >= 2 && maxTh >= 0.5 || (bestSh >= 3 && maxTh >= 0.3 && late);
    var scored = cands.map(function (r) {
      var uk = 0; if (r.sh === bestSh || bestSh <= 2) { c[r.t]--; uk = ukeire(c, nm, r.sh, vis); c[r.t]++; }
      var s = -r.sh * 200 + uk * 3;
      // 保留价值: 箭牌/风刻对子,同色
      if (r.t >= 31 && c[r.t] >= 2) s -= 18; if (r.t >= 27 && r.t < 31 && c[r.t] >= 2 && (r.t === 27 || r.t === 27 + ((seat - v.dealer + 4) % 4))) s -= 14;
      if (flush) { if (M.suitOf(r.t) !== dom.suit && r.t < 27) s += 10; else if (M.suitOf(r.t) === dom.suit) s -= 6; }
      if (r.t >= 27 && c[r.t] === 1) s += 4; // 孤字牌易弃
      var dang = tileDanger(v, seat, r.t, vis);
      s -= dang * (behindDefense ? 140 : 14);
      if (behindDefense && r.sh > bestSh) s -= 40;
      return { t: r.t, s: s };
    });
    scored.sort(function (a, b) { return b.s - a.s; }); return scored[0].t;
  }
  function value2(t, c) { var v = c[t] * 10; if (t >= 27) v -= 4; else if (t % 9 === 0 || t % 9 === 8) v -= 2; return v; }

  function claimChoice(v, seat, level, o) {
    var hand = v.hands[seat], nm = v.melds[seat].length, c = M.toCounts(hand), tile = v.claim.tile;
    if (o.hu) return { a: 'hu' };
    if (level === 1) { if (o.pong && Math.random() < 0.4) return { a: 'pong' }; return { a: 'pass' }; }
    var cur = shantenOf(c, nm), best = { a: 'pass' }, bestSh = cur, honorValue = tile >= 31 || tile === 27 || tile === 27 + ((seat - v.dealer + 4) % 4);
    function afterBest(cc, m2) { var bs = 99; for (var k = 0; k < 34; k++) if (cc[k]) { cc[k]--; var s = shantenOf(cc, m2); cc[k]++; if (s < bs) bs = s; } return bs; }
    var vis = visibleCounts(v, seat);
    if (o.pong) { c[tile] -= 2; var s1 = afterBest(c, nm + 1); c[tile] += 2; if (s1 < bestSh || (s1 === bestSh && honorValue && cur >= 1)) { best = { a: o.kong && (honorValue || cur <= 1) && level >= 3 && s1 <= cur ? 'kong' : 'pong' }; bestSh = s1; } }
    if (o.chi && level >= 2) o.chi.forEach(function (pr) { c[pr[0]]--; c[pr[1]]--; var s2 = afterBest(c, nm + 1); c[pr[0]]++; c[pr[1]]++; var gain = cur - s2; if (s2 < bestSh && (gain >= 1) && (level < 3 || (cur >= 2 || nm >= 1))) { best = { a: 'chi', tiles: pr }; bestSh = s2; } });
    if (level >= 3 && best.a !== 'pass' && cur <= 0 && nm === 0 && best.a !== 'kong') return { a: 'pass' }; // 听牌的门清手不轻易副露
    return best;
  }
  function computeMove(v, seat, level, opts) {
    opts = opts || {}; var o = M.options(v, seat); if (!o) return null;
    if (v.phase === 'claim') return claimChoice(v, seat, level, o);
    if (o.hu) return { a: 'hu' };
    var hand = v.hands[seat], nm = v.melds[seat].length;
    if (level >= 2 && (o.ankong.length || o.addkong.length)) {
      var c = M.toCounts(hand), cur = shantenOf(c, nm);
      for (var i = 0; i < o.ankong.length; i++) { var t = o.ankong[i]; c[t] -= 4; var s = shantenOf(c, nm + 1); c[t] += 4; if (s <= cur - 0 && (level >= 3 ? true : t >= 27 || t % 9 > 0)) { if (level < 3 || s <= cur) return { a: 'ankong', tile: t }; } }
      if (level >= 3) for (var j = 0; j < o.addkong.length; j++) { var t2 = o.addkong[j]; if (c[t2] >= 1) { c[t2]--; var s3 = shantenOf(c, nm); c[t2]++; if (s3 <= cur) return { a: 'addkong', tile: t2 }; } }
    }
    return { a: 'discard', tile: discardChoice(v, seat, level, opts) };
  }
  var API = { computeMove: computeMove, discardChoice: discardChoice };
  if (typeof module !== 'undefined' && module.exports) module.exports = API; else (self.GH = self.GH || {}).AIMahjong = API;
})();
