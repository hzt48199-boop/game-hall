/* 五子棋 AI(自由规则:五连及以上即胜)。
   困难档: 迭代加深 α-β(PVS 风格窗口)+ 棋形表驱动的走法排序 + 增量线型评估(带缓存)
           + VCF(连续冲四)与 VCT(活三/冲四威胁序列)搜索 + 对手威胁防守检测;限时(默认 1500ms)。
   简单/普通档: 沿用第一期的启发式(见 ai.js)。 */
(function () {
  var N = 15, PAD = 4, W = N + 2 * PAD, SZ = W * W;
  var DIRS = [1, W, W + 1, W - 1];
  function P(x, y) { return (y + PAD) * W + (x + PAD); }
  var INB = new Uint8Array(SZ); for (var yy = 0; yy < N; yy++) for (var xx = 0; xx < N; xx++) INB[P(xx, yy)] = 1;

  /* ---- 单线扫描: cells 元素 0 空 1 己 2 敌 3 墙 ---- */
  function scanLine(cells, L, mustInc) {
    var r = { five: 0, live4: 0, four: 0, live3: 0, w3: 0, w2: 0, w1: 0 };
    var F = [], s, k, e, i;
    function winCount(arr, st, en) { // 统计所有 5 窗口
      var comp = [];
      for (var a = Math.max(0, st); a + 4 <= en && a + 4 < L; a++) {
        var own = 0, emp = 0, bad = 0, ep = -1;
        for (var q = a; q < a + 5; q++) { var v = arr[q]; if (v === 1) own++; else if (v === 0) { emp++; ep = q; } else bad = 1; }
        if (bad) continue;
        if (own === 5) comp.push(-1); else if (own === 4) comp.push(ep);
      }
      return comp;
    }
    // 五连(含长连)
    var run = 0; for (i = 0; i < L; i++) { if (cells[i] === 1) { run++; if (run >= 5) { r.five = 1; } } else run = 0; }
    var lo = 0, hi = L - 1;
    if (mustInc !== undefined && mustInc >= 0) { lo = Math.max(0, mustInc - 4); hi = Math.min(L - 1, mustInc + 4); }
    var comps = {}, nc = 0, tmp;
    for (s = lo; s + 4 <= hi + 0 && s + 4 < L; s++) {
      if (mustInc >= 0 && !(s <= mustInc && mustInc <= s + 4)) continue;
      var own = 0, emp = 0, bad = 0, ep = -1;
      for (k = s; k < s + 5; k++) { var v = cells[k]; if (v === 1) own++; else if (v === 0) { emp++; ep = k; } else bad = 1; }
      if (bad) continue;
      if (own === 4) { if (!comps[ep]) { comps[ep] = 1; nc++; } }
      else if (own === 3) r.w3++; else if (own === 2) r.w2++; else if (own === 1) r.w1++;
    }
    if (!r.five) { if (nc >= 2) r.live4 = 1; else if (nc === 1) r.four = 1; }
    if (!r.five && !r.live4) {
      // 活三: 存在空位 e,在 e 落己子后形成活四(两个不同的成五点)
      for (e = lo; e <= hi && !r.live3; e++) {
        if (cells[e] !== 0) continue; cells[e] = 1;
        var cp = {}, n2 = 0;
        for (s = Math.max(0, e - 4); s <= e && s + 4 < L; s++) {
          var o2 = 0, bad2 = 0, ep2 = -1;
          for (k = s; k < s + 5; k++) { var v2 = cells[k]; if (v2 === 1) o2++; else if (v2 === 0) ep2 = k; else bad2 = 1; }
          if (!bad2 && o2 === 4 && !cp[ep2]) { cp[ep2] = 1; n2++; }
        }
        cells[e] = 0; if (n2 >= 2) r.live3 = 1;
      }
    }
    return r;
  }
  function lineScore(r) { return r.five * 1000000 + r.live4 * 20000 + r.four * 1100 + r.live3 * 1200 + r.w3 * 30 + r.w2 * 5 + r.w1 * 0.5; }
  function placeScore(r) { return r.five * 100000 + r.live4 * 10000 + r.four * 1500 + r.live3 * 1500 + r.w3 * 60 + r.w2 * 8 + r.w1 * 1; }
  // 中心落子的 9 格模式表(相对编码,中心恒为己方)
  var PT = new Int32Array(65536).fill(-1);
  var PTF = new Uint8Array(65536); // 位0=五 1=活四 2=冲四 3=活三
  var PORD = [-4, -3, -2, -1, 1, 2, 3, 4];
  function ptLookup(pat) {
    var v = PT[pat]; if (v >= 0) return v;
    var cells = new Array(9), t = pat; cells[4] = 1;
    for (var i = 0; i < 8; i++) { var c = t & 3; t >>= 2; cells[i < 4 ? i : i + 1] = c; }
    var r = scanLine(cells, 9, 4); v = Math.round(placeScore(r)); PT[pat] = v; PTF[pat] = r.five | (r.live4 << 1) | (r.four << 2) | (r.live3 << 3); return v;
  }
  var LCACHE = {}; function cacheFor(L) { return LCACHE[L] || (LCACHE[L] = new Map()); }

  /* ---- 棋盘 ---- */
  function Board(state) {
    var b = this; b.b = new Int8Array(SZ).fill(3); b.near = new Int16Array(SZ); b.stones = 0; b.hist = [];
    for (var y = 0; y < N; y++) for (var x = 0; x < N; x++) b.b[P(x, y)] = 0;
    // 线: 方向 d ∈ {0:横,1:竖,2:斜\,3:反斜/}
    b.lineId = [new Int32Array(SZ).fill(-1), new Int32Array(SZ).fill(-1), new Int32Array(SZ).fill(-1), new Int32Array(SZ).fill(-1)];
    b.linePos = [new Int32Array(SZ), new Int32Array(SZ), new Int32Array(SZ), new Int32Array(SZ)];
    b.lines = [];
    var starts = [[], [], [], []], i;
    for (i = 0; i < N; i++) { starts[0].push([0, i]); starts[1].push([i, 0]); }
    for (i = 0; i < N; i++) { starts[2].push([i, 0]); if (i > 0) starts[2].push([0, i]); }
    for (i = 0; i < N; i++) { starts[3].push([i, 0]); if (i > 0) starts[3].push([N - 1, i]); }
    var dxy = [[1, 0], [0, 1], [1, 1], [-1, 1]];
    for (var d = 0; d < 4; d++) starts[d].forEach(function (s) {
      var cells = [], x = s[0], y = s[1];
      while (x >= 0 && y >= 0 && x < N && y < N) { cells.push(P(x, y)); x += dxy[d][0]; y += dxy[d][1]; }
      if (cells.length < 5) return;
      var id = b.lines.length; b.lines.push(cells);
      cells.forEach(function (p, k) { b.lineId[d][p] = id; b.linePos[d][p] = k; });
    });
    b.ls = [new Float64Array(b.lines.length), new Float64Array(b.lines.length), new Float64Array(b.lines.length)]; // [颜色][线]
    b.tot = [0, 0, 0];
    b.buf = new Array(16);
    if (state) for (var j = 0; j < state.moves.length; j++) b.play(P(state.moves[j].x, state.moves[j].y), state.moves[j].p);
  }
  Board.prototype.lineEval = function (id, color) { // color 视角的线分
    var cells = this.lines[id], L = cells.length, key = 0, bd = this.b, i, v;
    for (i = 0; i < L; i++) { v = bd[cells[i]]; key = key * 3 + v; }
    var m = cacheFor(L), kk = key * 2 + (color - 1), got = m.get(kk);
    if (got !== undefined) return got;
    var buf = this.buf; for (i = 0; i < L; i++) { v = bd[cells[i]]; buf[i] = v === 0 ? 0 : (v === color ? 1 : 2); }
    got = lineScore(scanLine(buf, L, -1)); m.set(kk, got); return got;
  };
  Board.prototype.updLines = function (p) {
    for (var d = 0; d < 4; d++) {
      var id = this.lineId[d][p]; if (id < 0) continue;
      for (var c = 1; c <= 2; c++) { var nv = this.lineEval(id, c); this.tot[c] += nv - this.ls[c][id]; this.ls[c][id] = nv; }
    }
  };
  Board.prototype.play = function (p, color) {
    this.b[p] = color; this.stones++; this.hist.push(p);
    for (var dy = -2; dy <= 2; dy++) for (var dx = -2; dx <= 2; dx++) this.near[p + dy * W + dx]++;
    this.updLines(p);
  };
  Board.prototype.undo = function () {
    var p = this.hist.pop(); this.b[p] = 0; this.stones--;
    for (var dy = -2; dy <= 2; dy++) for (var dx = -2; dx <= 2; dx++) this.near[p + dy * W + dx]--;
    this.updLines(p);
  };
  Board.prototype.pat = function (p, d, color) {
    var bd = this.b, off = DIRS[d], pat = 0, i, v;
    for (i = 0; i < 8; i++) { v = bd[p + PORD[i] * off]; if (v !== 0 && v !== 3) v = (v === color ? 1 : 2); pat |= v << (2 * i); }
    return pat;
  };
  Board.prototype.cellScore = function (p, color) { var s = 0; for (var d = 0; d < 4; d++) s += ptLookup(this.pat(p, d, color)); return s; };
  Board.prototype.flags = function (p, color) { var f = 0; for (var d = 0; d < 4; d++) { var pt = this.pat(p, d, color); ptLookup(pt); f |= PTF[pt] << 0; } return f; };
  Board.prototype.fiveAt = function (p, color) { // 在空位 p 落 color 是否成五
    var bd = this.b;
    for (var d = 0; d < 4; d++) { var off = DIRS[d], n = 1, q = p + off; while (bd[q] === color) { n++; q += off; } q = p - off; while (bd[q] === color) { n++; q -= off; } if (n >= 5) return true; }
    return false;
  };
  Board.prototype.cands = function () { var out = [], bd = this.b, nr = this.near; for (var y = 0; y < N; y++) { var base = (y + PAD) * W + PAD; for (var x = 0; x < N; x++) { var p = base + x; if (bd[p] === 0 && nr[p] > 0) out.push(p); } } return out; };
  Board.prototype.fiveCells = function (color) { var cs = this.cands(), out = []; for (var i = 0; i < cs.length; i++) if (this.fiveAt(cs[i], color)) out.push(cs[i]); return out; };
  // 在 p 落 color 后,形成的"再下一手可成五"的点(不同点集合)。调用时 p 已落子。
  Board.prototype.completions = function (p, color) {
    var bd = this.b, out = [];
    for (var d = 0; d < 4; d++) {
      var off = DIRS[d];
      for (var s = -4; s <= 0; s++) {
        var own = 0, ep = -1, bad = 0;
        for (var k = 0; k < 5; k++) { var q = p + (s + k) * off, v = bd[q]; if (v === color) own++; else if (v === 0) ep = q; else { bad = 1; break; } }
        if (!bad && own === 4 && ep >= 0 && out.indexOf(ep) < 0) out.push(ep);
      }
    }
    return out;
  };

  /* ---- 威胁搜索 ---- */
  function Ctx(deadline) { this.deadline = deadline; this.nodes = 0; this.timeout = false; }
  Ctx.prototype.check = function () { if ((++this.nodes & 127) === 0 && Date.now() > this.deadline) this.timeout = true; return this.timeout; };
  // VCF: me 先手,只下"冲四"(含直接成五),返回获胜首着或 -1
  function vcf(B, me, depth, ctx) {
    if (ctx.check()) return -1;
    var opp = 3 - me, i;
    var mine = B.fiveCells(me); if (mine.length) return mine[0];
    if (depth <= 0) return -1;
    var theirs = B.fiveCells(opp), moves;
    if (theirs.length >= 2) return -1;
    if (theirs.length === 1) moves = [theirs[0]];
    else {
      moves = []; var cs = B.cands();
      for (i = 0; i < cs.length; i++) { var f = B.flags(cs[i], me); if (f & 14) moves.push(cs[i]); } // 活四/冲四/(活三不算)
      moves = moves.filter(function (p) { return (B.flags(p, me) & 6) !== 0; });
      moves.sort(function (a, b) { return B.cellScore(b, me) - B.cellScore(a, me); });
    }
    for (i = 0; i < moves.length; i++) {
      var p = moves[i];
      B.play(p, me);
      var comps = B.completions(p, me);
      if (comps.length === 0) { B.undo(); continue; }
      if (comps.length >= 2) { B.undo(); return p; }
      var f1 = comps[0];
      if (B.b[f1] !== 0) { B.undo(); continue; }
      B.play(f1, opp);
      var r = B.fiveAt(f1, opp) ? -1 : vcf(B, me, depth - 1, ctx);   // (f1 成五已被 theirs 排除,保险)
      B.undo(); B.undo();
      if (ctx.timeout) return -1;
      if (r >= 0) return p;
    }
    return -1;
  }
  // 防守候选: me 在 p 落子形成活三后,对手可能的应对点
  function threatReplies(B, me, p) {
    var out = [], bd = B.b, seen = {};
    function add(q) { if (bd[q] === 0 && !seen[q]) { seen[q] = 1; out.push(q); } }
    for (var d = 0; d < 4; d++) {
      var off = DIRS[d], pt = B.pat(p, d, me); ptLookup(pt);
      if (!(PTF[pt] & 12)) continue; // 该方向有四/活三
      for (var k = -5; k <= 5; k++) add(p + k * off);
    }
    return out;
  }
  // VCT: me 先手,攻击手段为冲四/活三,防守方应对点有限;depth 为活三层数
  function vct(B, me, depth, ctx) {
    if (ctx.check()) return -1;
    var f = vcf(B, me, 12, ctx); if (f >= 0) return f;
    if (depth <= 0 || ctx.timeout) return -1;
    var opp = 3 - me, theirs = B.fiveCells(opp);
    if (theirs.length) return -1;                    // 有人要成五时不做 VCT
    var cs = B.cands(), moves = [], i;
    for (i = 0; i < cs.length; i++) if (B.flags(cs[i], me) & 8) moves.push(cs[i]);
    moves.sort(function (a, b) { return B.cellScore(b, me) - B.cellScore(a, me); });
    if (moves.length > 8) moves.length = 8;
    for (i = 0; i < moves.length; i++) {
      var p = moves[i]; B.play(p, me);
      var reps = threatReplies(B, me, p);
      // 对手自己的冲四也算应对
      var cs2 = B.cands(); for (var j = 0; j < cs2.length; j++) if (reps.indexOf(cs2[j]) < 0 && (B.flags(cs2[j], opp) & 6)) reps.push(cs2[j]);
      var allWin = reps.length > 0 && reps.length <= 22;
      for (j = 0; j < reps.length && allWin; j++) {
        var q = reps[j]; B.play(q, opp);
        var opp5 = B.fiveAt(q, opp);
        var r = opp5 ? -1 : vctAfterReply(B, me, depth, ctx);
        B.undo();
        if (r < 0) allWin = false;
        if (ctx.timeout) { allWin = false; break; }
      }
      B.undo();
      if (allWin) return p;
      if (ctx.timeout) return -1;
    }
    return -1;
  }
  function vctAfterReply(B, me, depth, ctx) { // 对手应对后轮到 me
    var m = B.fiveCells(me); if (m.length) return m[0];
    return vct(B, me, depth - 1, ctx);
  }

  /* ---- α-β ---- */
  var WIN = 1000000;
  function orderedMoves(B, me, limit, pv) {
    var cs = B.cands(), opp = 3 - me, arr = [], i;
    for (i = 0; i < cs.length; i++) { var p = cs[i], s = B.cellScore(p, me) + B.cellScore(p, opp) * 0.95; if (p === pv) s += 1e9; arr.push([s, p]); }
    arr.sort(function (a, b) { return b[0] - a[0]; });
    if (limit && arr.length > limit) arr.length = limit;
    return arr.map(function (x) { return x[1]; });
  }
  var WIDTH = [0, 14, 12, 10, 8, 8, 6, 6, 5, 5, 5, 4];
  function search(B, me, depth, alpha, beta, ply, ctx) { // negamax,返回 me 视角分
    if (ctx.check()) return 0;
    var opp = 3 - me;
    if (B.fiveCells(me).length) return WIN - ply;
    var theirs = B.fiveCells(opp), moves;
    if (theirs.length >= 2) return -WIN + ply + 1;
    if (B.stones >= N * N) return 0;
    if (depth <= 0) return (B.tot[me] * 1.1 - B.tot[opp]) * 1;
    if (theirs.length === 1) moves = [theirs[0]];
    else moves = orderedMoves(B, me, WIDTH[Math.min(depth, 11)] || 4);
    if (!moves.length) return 0;
    var best = -Infinity;
    for (var i = 0; i < moves.length; i++) {
      var p = moves[i]; B.play(p, me);
      var v = -search(B, opp, depth - 1, -beta, -alpha, ply + 1, ctx);
      B.undo();
      if (ctx.timeout) return 0;
      if (v > best) best = v;
      if (best > alpha) alpha = best;
      if (alpha >= beta) break;
    }
    return best;
  }
  function hardMove(state, me, opts) {
    opts = opts || {}; var t0 = Date.now(), limit = opts.timeMs || 1500, deadline = t0 + limit, opp = 3 - me;
    var B = new Board(state);
    if (B.stones === 0) return { x: 7, y: 7 };
    function out(p) { var q = p - (PAD * W + PAD); return { x: q % W, y: Math.floor(q / W) }; }
    function conv(p) { return { x: (p % W) - PAD, y: Math.floor(p / W) - PAD }; }
    var mine = B.fiveCells(me); if (mine.length) return conv(mine[0]);
    var theirs = B.fiveCells(opp); if (theirs.length) return conv(theirs[0]);
    var ctxV = new Ctx(t0 + limit * 0.3), r;
    r = vcf(B, me, 14, ctxV); if (r >= 0) return conv(r);
    // 防守: 对手是否有 VCF 威胁(轮到对手时)
    var cands = orderedMoves(B, me, 0, -1);
    var threat = false, ctxO = new Ctx(t0 + limit * 0.45);
    var oppV = vcf(B, opp, 14, ctxO); if (oppV >= 0) threat = true;
    var oppVct = -1;
    ctxO.deadline = t0 + limit * 0.55; ctxO.timeout = false;
    if (!threat) { oppVct = vct(B, opp, 2, ctxO); if (oppVct >= 0) threat = true; }
    var ctxM = new Ctx(t0 + limit * 0.6);
    if (!threat) { r = vct(B, me, 3, ctxM); if (r >= 0) return conv(r); }
    var pool = cands.slice(0, threat ? 40 : 22);
    if (threat) { // 只保留能化解威胁的着法(逐个验证,总时间受限)
      var safe = [], fEnd = t0 + limit * 0.7, ctxS = new Ctx(fEnd);
      for (var i = 0; i < pool.length; i++) {
        var p = pool[i], now = Date.now(); if (now > fEnd) { safe.push(p); continue; } // 超时: 未验证的候选保留
        var slice = Math.max(6, (fEnd - now) / (pool.length - i));
        B.play(p, me);
        var ok = true;
        if (!B.fiveCells(me).length) {
          var oc = B.fiveCells(opp);
          if (oc.length >= 2) ok = false;
          else if (!oc.length) {
            ctxS.timeout = false; ctxS.deadline = Math.min(fEnd, now + slice);
            if (vcf(B, opp, 14, ctxS) >= 0) ok = false;
            else if (oppVct >= 0) { ctxS.timeout = false; ctxS.deadline = Math.min(fEnd, Date.now() + slice); if (vct(B, opp, 2, ctxS) >= 0) ok = false; }
          }
        }
        B.undo(); if (ok) safe.push(p);
      }
      if (safe.length) pool = safe; else pool = pool.slice(0, 8);
    }
    if (pool.length === 1) return conv(pool[0]);
    // 迭代加深
    var ctx = new Ctx(deadline), best = pool[0], bestV = -Infinity;
    for (var depth = 2; depth <= (opts.maxDepth || 10); depth++) {
      var curBest = -1, curV = -Infinity, alpha = -Infinity, order = pool.slice();
      if (best >= 0) { order.splice(order.indexOf(best), 1); order.unshift(best); }
      ctx.timeout = false;
      for (var j = 0; j < order.length; j++) {
        var q = order[j]; B.play(q, me);
        var v = B.fiveCells(me).length ? WIN : -search(B, opp, depth - 1, -Infinity, -alpha, 1, ctx);
        B.undo();
        if (ctx.timeout) break;
        if (v > curV) { curV = v; curBest = q; } if (v > alpha) alpha = v;
      }
      if (ctx.timeout) { if (curBest >= 0 && curV > bestV - 100000) { /* 未完成层: 若已搜完首着且更优则采用 */ } break; }
      best = curBest; bestV = curV;
      if (Math.abs(bestV) > WIN / 2) break;
      if (Date.now() > deadline) break;
    }
    return conv(best);
  }
  var API = { hardMove: hardMove, Board: Board, vcf: vcf, vct: vct, Ctx: Ctx, P: P, conv: function (p) { return { x: (p % W) - PAD, y: Math.floor(p / W) - PAD }; } };
  if (typeof module !== 'undefined' && module.exports) module.exports = API; else (self.GH = self.GH || {}).AIGomoku = API;
})();
