/* 炸金花电脑 AI(基于手牌强度 + 底池赔率)。三种风格: tight(保守) aggressive(激进) bluff(诈唬);三档强度:
   1 简单: 近乎随机,只粗略参考牌型;
   2 普通: 手牌强度百分位 + 风格阈值 + 底池赔率,不分析对手;
   3 困难: 在普通档上加入对手行为建模(对手加注 / 明牌跟注会让其牌力分布向强牌偏移,win ≈ Π s^(1+γ))、
           按局势选择比牌对象、按风格诈唬与慢打,并只使用己方视角(不偷看别人的牌)。
   computeMove(view, seat, level, opts) → {a:'look'|'call'|'raise'|'fold'|'compare', ...},opts.style 可指定风格。 */
(function () {
  var Z = (typeof require === 'function') ? require('./zhajinhua.js') : GH.Zhajinhua;
  var STYLES = ['tight', 'aggressive', 'bluff'];
  var SORTED = null;
  function table() { // 全部 22100 种三张牌的分数,用于求"手牌强度百分位"
    if (SORTED) return SORTED;
    var arr = [];
    for (var a = 0; a < 52; a++) for (var b = a + 1; b < 52; b++) for (var c = b + 1; c < 52; c++) arr.push(Z.evalHand([a, b, c]).score);
    arr.sort(function (x, y) { return x - y; }); SORTED = arr; return arr;
  }
  function strength(score) { // 比它小的占比 + 一半平局
    var t = table(), lo = 0, hi = t.length, mid;
    while (lo < hi) { mid = (lo + hi) >> 1; if (t[mid] < score) lo = mid + 1; else hi = mid; }
    var a = lo; hi = t.length; while (lo < hi) { mid = (lo + hi) >> 1; if (t[mid] <= score) lo = mid + 1; else hi = mid; }
    return (a + (lo - a) / 2) / t.length;
  }
  var BASE = { look: { tight: 0.7, aggressive: 0.35, bluff: 0.12 }, fold: { tight: 0.45, aggressive: 0.28, bluff: 0.3 }, raise: { tight: 0.88, aggressive: 0.62, bluff: 0.65 },
    bluffP: { tight: 0.02, aggressive: 0.1, bluff: 0.25 }, blindRaise: { tight: 0.05, aggressive: 0.25, bluff: 0.35 } };
  function pickRaise(o, steps) { if (!o.raise.length) return null; var r = o.raise.slice().sort(function (a, b) { return a.unit - b.unit; }); return { a: 'raise', unit: r[Math.min(r.length - 1, steps - 1)].unit }; }
  function safe(o, mv) { // 保证返回合法着法
    if (mv.a === 'look') return mv;
    if (mv.a === 'raise' && o.raise.some(function (x) { return x.unit === mv.unit; })) return mv;
    if (mv.a === 'compare' && o.compare.some(function (x) { return x.target === mv.target; })) return mv;
    if (mv.a === 'call' && o.call) return mv;
    if (mv.a === 'fold') return mv;
    return o.call ? { a: 'call' } : { a: 'fold' };
  }
  /* 困难档: 对手"仍在局中"的范围模型。未看牌的对手会跟任何牌 → 强度均匀 U(0,1);
     已看牌仍在局中 → 至少高于对方的弃牌线(约 0.3 起随轮数上升);加过注 → 至少约 0.6。
     我方对某对手的胜率 = (s - L)/(1 - L);对多人取乘积。再按底池赔率(含风格系数)决定弃牌 / 加注 / 比牌 / 跟注。 */
  function rangeLow(v, p) {
    var L = 0; if (v.seen[p]) L = 0.3 + 0.02 * Math.min(6, v.round - 1); if (v.raises[p] > 0) L = Math.max(L, 0.6 + 0.04 * (v.raises[p] - 1)); return Math.min(L, 0.92);
  }
  function winVs(v, p, s) { var L = rangeLow(v, p); return Math.max(0, Math.min(1, (s - L) / (1 - L))); }
  var H = { mult: { tight: 1.2, aggressive: 0.6, bluff: 0.9 }, raise: { tight: 0.62, aggressive: 0.4, bluff: 0.45 } };
  function hardMove(v, o, seat, s, style, others, rnd) {
    var k = others.length, w = 1; others.forEach(function (p) { w *= winVs(v, p, s); });
    var cost = o.callCost, pot = v.pot, potTh = cost / (pot + cost), committed = v.contrib[seat] / v.stack0, round = v.round;
    var cheap = cost <= 0.06 * pot;
    if (o.compare.length) { // 比牌: 选对手范围最弱(我最容易赢)的一个
      var bt = -1, bw = -1; o.compare.forEach(function (c) { var x = winVs(v, c.target, s); if (x > bw) { bw = x; bt = c.target; } });
      var want = (k === 1 && bw >= 0.5) || (k === 2 && bw >= 0.7 && round >= 2) || (round >= v.maxRounds - 1 && bw >= 0.5) || (cost > 0.2 * v.stack0 && bw >= 0.6);
      if (want) return safe(o, { a: 'compare', target: bt });
    }
    var foldLine = potTh * H.mult[style] - 0.5 * committed * potTh;
    if (w < foldLine && !cheap) {
      var bp = BASE.bluffP[style] * (k <= 2 ? 1.5 : 0.7); var anyRaiser = others.some(function (p) { return v.raises[p] > 0; });
      if (!anyRaiser && rnd() < bp) { var rb = pickRaise(o, 1); if (rb) return safe(o, rb); }
      return { a: 'fold' };
    }
    if (w >= H.raise[style] && o.raise.length && v.unit < v.levels[3]) {
      var pr = style === 'aggressive' ? 0.8 : 0.55; if (w > 0.85 && round === 1 && rnd() < 0.4) pr = 0; // 极强牌第一轮慢打
      if (rnd() < pr) return safe(o, pickRaise(o, w > 0.85 ? 2 : 1));
    }
    return safe(o, { a: 'call' });
  }
  function computeMove(v, seat, level, opts) {
    opts = opts || {}; level = level || 2;
    var o = Z.options(v, seat); if (!o.turn) return null;
    var style = opts.style || STYLES[seat % 3], rnd = Math.random;
    var others = []; for (var p = 1; p <= v.n; p++) if (p !== seat && v.status[p] === 'active') others.push(p);
    var k = others.length, round = v.round, pot = v.pot, seen = v.seen[seat];
    // ---- 看牌决策 ----
    if (!seen) {
      var lookP = BASE.look[style] + 0.12 * (round - 1) + (k === 1 ? 0.3 : 0) + (v.unit >= v.levels[2] ? 0.3 : 0);
      if (level === 1) lookP = 0.5;
      if (rnd() < lookP) return { a: 'look' };
      var br = level === 1 ? 0.08 : BASE.blindRaise[style];
      if (rnd() < br) { var rr = pickRaise(o, style === 'bluff' && level >= 3 && rnd() < 0.3 ? 2 : 1); if (rr) return safe(o, rr); }
      return safe(o, { a: 'call' });
    }
    var hand = v.hands[seat]; if (!hand) return safe(o, { a: 'call' });
    var s = strength(Z.evalHand(hand, v.opts).score);
    if (level === 1) {
      var q = rnd();
      if (s < 0.35 && q < 0.4) return safe(o, { a: 'fold' });
      if (s > 0.7 && q < 0.2) { var r1 = pickRaise(o, 1); if (r1) return safe(o, r1); }
      if (q > 0.93 && o.compare.length) return safe(o, { a: 'compare', target: o.compare[Math.floor(rnd() * o.compare.length)].target });
      return safe(o, { a: 'call' });
    }
    if (level >= 3) return hardMove(v, o, seat, s, style, others, rnd);
    // ---- 对手建模(仅普通档以下的简化) ----
    var gs = others.map(function (p) {
      var g = (level >= 3 ? 0.35 : 0.0) * v.raises[p] + (level >= 3 && v.seen[p] ? 0.2 * Math.min(3, round - 1) : 0);
      return Math.min(2.5, g);
    });
    var meanG = k ? gs.reduce(function (a, b) { return a + b; }, 0) / k : 0, maxG = gs.length ? Math.max.apply(null, gs) : 0;
    var sEff = level >= 3 ? Math.pow(s, 1 + meanG) : s;
    var cost = o.callCost, potTh = cost / (pot + cost), committed = v.contrib[seat] / v.stack0;
    var foldLine = BASE.fold[style] + 0.025 * (round - 1) + 0.5 * potTh - 0.25 * committed - (k === 1 ? 0.1 : 0);
    var cheap = cost <= 0.06 * pot;
    // 比牌: 少数人 / 接近封顶 / 下注已重
    if (o.compare.length && s >= 0.5) {
      var want = (k <= 2 && s >= 0.6 && round >= 2 && rnd() < (style === 'tight' ? 0.6 : 0.4)) || (round >= v.maxRounds - 1 && s >= 0.5) || (cost > 0.25 * v.stack0 && s >= 0.55) || (level >= 3 && k === 1 && sEff >= 0.55);
      if (want) {
        var tgt = o.compare[0].target;
        if (level >= 3) { var bi = -1, bg = 9; o.compare.forEach(function (c) { var g = gs[others.indexOf(c.target)]; if (g < bg) { bg = g; bi = c.target; } }); tgt = bi; }
        else tgt = o.compare[Math.floor(rnd() * o.compare.length)].target;
        return safe(o, { a: 'compare', target: tgt });
      }
    }
    if (sEff < foldLine && !cheap) {
      var bp = BASE.bluffP[style] * (level >= 3 ? (k <= 2 && maxG < 0.4 ? 2 : 1) : 0.5);
      if (rnd() < bp) { var rb = pickRaise(o, 1); if (rb) return safe(o, rb); return safe(o, { a: 'call' }); }
      return { a: 'fold' };
    }
    var rl = BASE.raise[style] - (k === 1 ? 0.05 : 0) + (maxG > 1.2 ? 0.05 : 0);
    if (sEff >= rl && o.raise.length && !(v.unit >= v.levels[3])) {
      var pr = style === 'aggressive' ? 0.8 : 0.55; if (level >= 3 && sEff > 0.97 && round === 1 && rnd() < 0.4) pr = 0; // 极强牌第一轮慢打
      if (rnd() < pr) return safe(o, pickRaise(o, sEff > 0.97 ? 2 : 1));
    }
    return safe(o, { a: 'call' });
  }
  var API = { computeMove: computeMove, strength: strength, STYLES: STYLES };
  if (typeof module !== 'undefined' && module.exports) module.exports = API; else (self.GH = self.GH || {}).AIZhajinhua = API;
})();
