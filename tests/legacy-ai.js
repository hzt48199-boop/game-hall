/* 三种棋的电脑 AI。level: 1简单 2普通 3困难。
   computeMove(game, state, seat, level) -> 走法对象(五子棋 {x,y}; 其他 {fr,fc,tr,tc}),无棋可走返回 null。
   军棋 AI 只使用 view(己方视角),不偷看对方棋子。 */
(function () {
  var Gomoku = (typeof require === 'function') ? require('../shared/gomoku.js') : GH.Gomoku;
  var Xiangqi = (typeof require === 'function') ? require('../shared/xiangqi.js') : GH.Xiangqi;
  var Luzhanqi = (typeof require === 'function') ? require('../shared/luzhanqi.js') : GH.Luzhanqi;
  var N = 15;
  function rnd(n) { return Math.floor(Math.random() * n); }

  /* ---------------- 五子棋 ---------------- */
  var DIRS = [[1, 0], [0, 1], [1, 1], [1, -1]];
  function runScore(len, open) {
    if (len >= 5) return 100000;
    if (len === 4) return open === 2 ? 10000 : open === 1 ? 1000 : 0;
    if (len === 3) return open === 2 ? 1000 : open === 1 ? 100 : 0;
    if (len === 2) return open === 2 ? 100 : open === 1 ? 10 : 0;
    return open === 2 ? 10 : open === 1 ? 1 : 0;
  }
  // 假设 p 落在 (x,y) 后经过该点的四个方向棋形得分
  function cellScore(b, x, y, p) {
    var total = 0;
    for (var d = 0; d < 4; d++) {
      var dx = DIRS[d][0], dy = DIRS[d][1], len = 1, open = 0, k;
      for (var s = -1; s <= 1; s += 2) {
        k = 1;
        while (true) {
          var nx = x + dx * k * s, ny = y + dy * k * s;
          if (nx < 0 || ny < 0 || nx >= N || ny >= N) break;
          var v = b[ny * N + nx];
          if (v === p) { len++; k++; continue; }
          if (v === 0) open++;
          break;
        }
      }
      total += runScore(len, open);
    }
    return total;
  }
  function candidates(b, radius) {
    var out = [], any = false;
    for (var y = 0; y < N; y++) for (var x = 0; x < N; x++) {
      if (b[y * N + x] !== 0) { any = true; continue; }
      var near = false;
      for (var dy = -radius; dy <= radius && !near; dy++) for (var dx = -radius; dx <= radius; dx++) {
        var nx = x + dx, ny = y + dy;
        if (nx >= 0 && ny >= 0 && nx < N && ny < N && b[ny * N + nx] !== 0) { near = true; break; }
      }
      if (near) out.push([x, y]);
    }
    if (!any) out.push([7, 7]);
    return out;
  }
  function orderedCands(b, me, limit) {
    var opp = 3 - me;
    var arr = candidates(b, 2).map(function (c) {
      var a = cellScore(b, c[0], c[1], me), d = cellScore(b, c[0], c[1], opp);
      return { x: c[0], y: c[1], s: a * 1.0 + d * 0.9, a: a, d: d };
    });
    arr.sort(function (u, v) { return v.s - u.s; });
    return limit ? arr.slice(0, limit) : arr;
  }
  // 全盘评估(me 视角): 扫描所有连续同色棋段
  function evalBoard(b, me) {
    var sc = [0, 0, 0];
    for (var d = 0; d < 4; d++) {
      var dx = DIRS[d][0], dy = DIRS[d][1];
      for (var y = 0; y < N; y++) for (var x = 0; x < N; x++) {
        var p = b[y * N + x];
        if (!p) continue;
        var px = x - dx, py = y - dy;
        if (px >= 0 && py >= 0 && px < N && py < N && b[py * N + px] === p) continue; // 非段首
        var len = 0, cx = x, cy = y;
        while (cx >= 0 && cy >= 0 && cx < N && cy < N && b[cy * N + cx] === p) { len++; cx += dx; cy += dy; }
        var open = 0;
        if (px >= 0 && py >= 0 && px < N && py < N && b[py * N + px] === 0) open++;
        if (cx >= 0 && cy >= 0 && cx < N && cy < N && b[cy * N + cx] === 0) open++;
        sc[p] += runScore(len, open);
      }
    }
    return sc[me] - sc[3 - me] * 1.1;
  }
  function gomokuSearch(b, me, toMove, depth, alpha, beta) {
    if (depth === 0) return evalBoard(b, me);
    var cands = orderedCands(b, toMove, 8);
    if (!cands.length) return 0;
    var maximizing = toMove === me, best = maximizing ? -Infinity : Infinity;
    for (var i = 0; i < cands.length; i++) {
      var c = cands[i];
      if (c.a >= 100000) return maximizing ? 1e7 + depth : -1e7 - depth; // 立即获胜
      b[c.y * N + c.x] = toMove;
      var v = gomokuSearch(b, me, 3 - toMove, depth - 1, alpha, beta);
      b[c.y * N + c.x] = 0;
      if (maximizing) { if (v > best) best = v; if (best > alpha) alpha = best; }
      else { if (v < best) best = v; if (best < beta) beta = best; }
      if (alpha >= beta) break;
    }
    return best;
  }
  function gomokuMove(s, seat, level) {
    var b = s.board.slice();
    var cands = orderedCands(b, seat, 0);
    if (!cands.length) return null;
    // 必胜 / 必防
    for (var i = 0; i < cands.length; i++) if (cands[i].a >= 100000) return { x: cands[i].x, y: cands[i].y };
    var blockAll = cands.filter(function (c) { return c.d >= 100000; });
    if (blockAll.length && level >= 2) return { x: blockAll[0].x, y: blockAll[0].y };
    if (level === 1) { var top = cands.slice(0, 6); var pick = top[rnd(top.length)]; return { x: pick.x, y: pick.y }; }
    if (level === 2) return { x: cands[0].x, y: cands[0].y };
    var best = null, bestV = -Infinity, top8 = cands.slice(0, 8);
    for (var j = 0; j < top8.length; j++) {
      var c = top8[j];
      b[c.y * N + c.x] = seat;
      var v = gomokuSearch(b, seat, 3 - seat, 2, -Infinity, Infinity) + c.s * 0.01;
      b[c.y * N + c.x] = 0;
      if (v > bestV) { bestV = v; best = c; }
    }
    return { x: best.x, y: best.y };
  }

  /* ---------------- 象棋 ---------------- */
  var XV = { k: 10000, r: 900, c: 450, n: 400, a: 200, b: 200, p: 100 };
  function xqEval(board, side) {
    var sc = 0;
    for (var r = 0; r < 10; r++) for (var c = 0; c < 9; c++) {
      var ch = board[r][c]; if (!ch) continue;
      var t = ch.toLowerCase(), own = ch === ch.toUpperCase() ? 1 : 2, v = XV[t];
      if (t === 'p') { var adv = own === 1 ? 9 - r : r; if (adv >= 5) v += 60 + (c >= 3 && c <= 5 ? 20 : 0); else v += 0; }
      else if (t === 'r' || t === 'n' || t === 'c') v += 12 - Math.abs(c - 4) * 3;
      sc += own === side ? v : -v;
    }
    return sc;
  }
  var MATE = 100000;
  function xqSearch(board, side, depth, alpha, beta, ply) {
    if (depth === 0) return xqEval(board, side);
    var ms = Xiangqi.pseudoMoves(board, side);
    if (!ms.length) return -MATE + ply;
    ms.forEach(function (m) { var t = board[m.tr][m.tc]; m.o = t ? XV[t.toLowerCase()] * 10 - XV[board[m.fr][m.fc].toLowerCase()] : 0; });
    ms.sort(function (a, b) { return b.o - a.o; });
    var best = -Infinity;
    for (var i = 0; i < ms.length; i++) {
      var m = ms[i], cap = board[m.tr][m.tc];
      if (cap && cap.toLowerCase() === 'k') return MATE - ply;
      board[m.tr][m.tc] = board[m.fr][m.fc]; board[m.fr][m.fc] = null;
      var v = -xqSearch(board, 3 - side, depth - 1, -beta, -alpha, ply + 1);
      board[m.fr][m.fc] = board[m.tr][m.tc]; board[m.tr][m.tc] = cap;
      if (v > best) best = v;
      if (best > alpha) alpha = best;
      if (alpha >= beta) break;
    }
    return best;
  }
  function xiangqiMove(s, seat, level) {
    var board = s.board.map(function (r) { return r.slice(); });
    var ms = Xiangqi.legalMoves(board, seat);
    if (!ms.length) return null;
    var depth = level === 1 ? 1 : level === 2 ? 2 : 3, best = null, bestV = -Infinity;
    for (var i = ms.length - 1; i > 0; i--) { var j = rnd(i + 1), t = ms[i]; ms[i] = ms[j]; ms[j] = t; }
    ms.forEach(function (m) { var t = board[m.tr][m.tc]; m.o = t ? XV[t.toLowerCase()] : 0; });
    ms.sort(function (a, b) { return b.o - a.o; });
    for (var k = 0; k < ms.length; k++) {
      var m = ms[k], cap = board[m.tr][m.tc];
      board[m.tr][m.tc] = board[m.fr][m.fc]; board[m.fr][m.fc] = null;
      var v = -xqSearch(board, 3 - seat, depth - 1, -Infinity, Infinity, 1);
      if (level >= 2 && Xiangqi.legalMoves(board, 3 - seat).length === 0) v = MATE * 2; // 直接将死/困毙优先
      board[m.fr][m.fc] = board[m.tr][m.tc]; board[m.tr][m.tc] = cap;
      if (level === 1) v += rnd(150);
      if (v > bestV) { bestV = v; best = m; }
    }
    return { fr: best.fr, fc: best.fc, tr: best.tr, tc: best.tc };
  }

  /* ---------------- 军棋 ---------------- */
  function luzhanqiMove(view, seat, level) {
    var ms = Luzhanqi.legalMoves(view, seat);
    if (!ms.length) return null;
    var opp = 3 - seat, rem = {};
    for (var k in Luzhanqi.COUNTS) rem[k] = Luzhanqi.COUNTS[k];
    view.dead.forEach(function (d) { if (d.p === opp && rem[d.t] > 0) rem[d.t]--; });
    var forward = seat === 1 ? -1 : 1, best = null, bestV = -Infinity;
    var noise = level === 1 ? 60 : level === 2 ? 8 : 2;
    ms.forEach(function (m) {
      var att = view.board[m.fr][m.fc], tgt = view.board[m.tr][m.tc], v = 0;
      if (tgt) {
        var wsum = 0, ev = 0;
        for (var t in rem) {
          var w = rem[t]; if (!w) continue;
          if (tgt.mv && (t === 'M' || t === 'F')) continue;
          if (!tgt.mv && Luzhanqi.isHQ(m.tr, m.tc) && t === 'F') w *= 4;
          if (!tgt.mv && !Luzhanqi.isHQ(m.tr, m.tc) && t === 'F') w = 0; // 军旗只会在大本营
          if (!tgt.mv && t === 'M') { var depthRows = seat === 1 ? m.tr <= 1 : m.tr >= 10; w *= depthRows ? 2 : 0.3; }
          var out = Luzhanqi.battle(att.t, t), val;
          if (out === 'flag' || (out === 'win' && t === 'F')) val = 1000;
          else if (out === 'win') val = Luzhanqi.TYPES[t].v;
          else if (out === 'lose') val = -Luzhanqi.TYPES[att.t].v;
          else val = Luzhanqi.TYPES[t].v - Luzhanqi.TYPES[att.t].v;
          ev += w * val; wsum += w;
        }
        v = wsum ? ev / wsum : 0;
        if (level === 1) v = v * 0.3;
      } else {
        v = (m.tr - m.fr) * forward * 3;
        if (att.t === 'S' || att.t === 'J') v -= 1;
        if (Luzhanqi.isCamp(m.tr, m.tc)) v += 2;
        if (att.t === 'E' && level >= 2) v += 0.5;
      }
      v += Math.random() * noise;
      if (v > bestV) { bestV = v; best = m; }
    });
    return { fr: best.fr, fc: best.fc, tr: best.tr, tc: best.tc };
  }
  function computeMove(game, state, seat, level) {
    level = level || 2;
    if (game === 'gomoku') return gomokuMove(state, seat, level);
    if (game === 'xiangqi') return xiangqiMove(state, seat, level);
    if (game === 'luzhanqi') return luzhanqiMove(Luzhanqi.view(state, seat), seat, level);
    return null;
  }
  var API = { computeMove: computeMove, gomokuMove: gomokuMove, xiangqiMove: xiangqiMove, luzhanqiMove: luzhanqiMove };
  if (typeof module !== 'undefined' && module.exports) module.exports = API; else (self.GH = self.GH || {}).AI = API;
})();
