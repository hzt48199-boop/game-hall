/* 军棋 AI(困难档): 对手棋子概率推断 + 信息集确定化采样(determinization) + 两层前瞻(己方一步 + 对方最佳应手)的期望评估。
   只使用己方视角(view)与公开战斗日志(view.log,仅含阵亡方身份),不偷看对方棋子。限时 timeMs(默认 1000ms)。 */
(function () {
  var L = (typeof require === 'function') ? require('./luzhanqi.js') : GH.Luzhanqi;
  var TY = 'SJDRTBCLEXMF'.split(''), TV = { S: 100, J: 80, D: 70, R: 60, T: 50, B: 40, C: 30, L: 20, E: 28, X: 45, M: 22, F: 1000 };
  var BIT = {}; TY.forEach(function (t, i) { BIT[t] = 1 << i; });
  var ALL = (1 << 12) - 1, MOVABLE = ALL & ~BIT.M & ~BIT.F;
  function bits(mask) { var out = []; for (var i = 0; i < 12; i++) if (mask & (1 << i)) out.push(TY[i]); return out; }

  /* 推断: 返回 { pieces:[{r,c,mask,moved,id}], rem:{type:count} } */
  function infer(view, seat) {
    var opp = 3 - seat, pieces = [], i;
    var log = view.log || null;
    var pos = {}; // "r,c" -> piece
    if (log) {
      L.STATIONS.forEach(function (st, k) {
        var a = L.absPos(opp, st[0], st[1]), m = ALL;
        if (!(st[0] === 5 && (st[1] === 1 || st[1] === 3))) m &= ~BIT.F;
        if (st[0] < 4) m &= ~BIT.M; if (st[0] === 0) m &= ~BIT.X;
        var p = { r: a[0], c: a[1], mask: m, moved: false, alive: true }; pieces.push(p); pos[a[0] + ',' + a[1]] = p;
      });
      var myPos = null; // 己方棋子位置不跟踪(类型己方已知),只在需要时由日志读出
      log.forEach(function (e) {
        var from = e.fr + ',' + e.fc, to = e.tr + ',' + e.tc;
        if (e.p === opp) {
          var a = pos[from]; if (!a) return;
          a.moved = true; a.mask &= ~(BIT.M | BIT.F);
          if (e.out === 'move') { delete pos[from]; a.r = e.tr; a.c = e.tc; pos[to] = a; }
          else if (e.out === 'win' || e.out === 'flag') { // 对手攻击己方并获胜: 其类型须能胜过 e.dd
            var keep = 0; bits(a.mask).forEach(function (t) { if (L.battle(t, e.dd) === 'win') keep |= BIT[t]; }); if (keep) a.mask = keep;
            delete pos[from]; a.r = e.tr; a.c = e.tc; pos[to] = a;
          } else { a.alive = false; delete pos[from]; if (e.out === 'both' || e.out === 'lose') { /* 阵亡,身份已公开 */ } }
        } else { // 己方进攻
          var d = pos[to];
          if (e.out === 'move') return;
          if (!d) return;
          if (e.out === 'win' || e.out === 'both' || e.out === 'flag') { d.alive = false; delete pos[to]; }
          else if (e.out === 'lose') { // 对方存活: 其类型 t 须满足 battle(我方类型, t)==='lose'
            var my = e.da, keep2 = 0; bits(d.mask).forEach(function (t) { if (L.battle(my, t) === 'lose') keep2 |= BIT[t]; }); if (keep2) d.mask = keep2;
          }
        }
      });
      pieces = pieces.filter(function (p) { return p.alive; });
      // 与当前棋盘位置核对(防御性): 不一致则回退
      var okAll = true; pieces.forEach(function (p) { var b = view.board[p.r] && view.board[p.r][p.c]; if (!b || b.p !== opp) okAll = false; });
      var cnt = 0; for (var r = 0; r < 12; r++) for (var c = 0; c < 5; c++) { var q = view.board[r][c]; if (q && q.p === opp) cnt++; }
      if (!okAll || cnt !== pieces.length) { log = null; pieces = []; }
    }
    if (!log) {
      for (var r2 = 0; r2 < 12; r2++) for (var c2 = 0; c2 < 5; c2++) { var q2 = view.board[r2][c2]; if (q2 && q2.p === opp) pieces.push({ r: r2, c: c2, mask: q2.mv ? MOVABLE : ALL, moved: !!q2.mv, alive: true }); }
    }
    var rem = {}; for (var t in L.COUNTS) rem[t] = L.COUNTS[t];
    (view.dead || []).forEach(function (d) { if (d.p === opp && rem[d.t] > 0) rem[d.t]--; });
    return { pieces: pieces, rem: rem };
  }
  function rnd(n) { return Math.floor(Math.random() * n); }
  // 采样一个与约束一致的对手布局: 返回 pieces 对应的类型数组
  function sample(inf) {
    var ps = inf.pieces;
    for (var tries = 0; tries < 30; tries++) {
      var rem = {}; for (var t in inf.rem) rem[t] = inf.rem[t];
      var order = ps.map(function (p, i) { return { i: i, n: bits(p.mask).length + Math.random() * 0.9 }; }).sort(function (a, b) { return a.n - b.n; });
      var out = new Array(ps.length), ok = true;
      for (var k = 0; k < order.length && ok; k++) {
        var i = order[k].i, cands = bits(ps[i].mask).filter(function (t2) { return rem[t2] > 0; }), tot = 0;
        if (!cands.length) { ok = false; break; }
        cands.forEach(function (t2) { tot += rem[t2]; });
        var x = Math.random() * tot, pick = cands[cands.length - 1];
        for (var j = 0; j < cands.length; j++) { x -= rem[cands[j]]; if (x < 0) { pick = cands[j]; break; } }
        out[i] = pick; rem[pick]--;
      }
      if (ok) return out;
    }
    // 回退: 忽略约束
    var pool = []; for (var t3 in inf.rem) for (var n = 0; n < inf.rem[t3]; n++) pool.push(t3);
    while (pool.length < ps.length) pool.push('L');
    for (var a = pool.length - 1; a > 0; a--) { var b = rnd(a + 1), tmp = pool[a]; pool[a] = pool[b]; pool[b] = tmp; }
    return ps.map(function (p, i) { return pool[i]; });
  }
  function mobileCount(board, side) { var n = 0; for (var r = 0; r < 12; r++) for (var c = 0; c < 5; c++) { var p = board[r][c]; if (p && p.p === side && p.t !== 'M' && p.t !== 'F' && L.movesFrom(board, r, c).length) n++; } return n; }
  function evalBoard(board, me) {
    var sc = 0, opp = 3 - me, myFlag = false, opFlag = false;
    for (var r = 0; r < 12; r++) for (var c = 0; c < 5; c++) {
      var p = board[r][c]; if (!p) continue;
      var v = TV[p.t], s = p.p === me ? 1 : -1;
      if (p.t === 'F') { if (p.p === me) myFlag = true; else opFlag = true; continue; }
      sc += s * v;
      if (p.t !== 'M') { var adv = p.p === 1 ? 11 - r : r; // 前进程度(朝对方底线)
        sc += s * adv * 0.35 * (p.t === 'S' || p.t === 'J' || p.t === 'D' ? 1 : 0.5); }
    }
    if (!myFlag) return -5000; if (!opFlag) return 5000;
    // 逼近: 己方可动棋子离"对方未移动的大本营棋子"越近越好;对方棋子逼近己方大本营则扣分
    var tops = me === 1 ? [[0, 1], [0, 3]] : [[11, 1], [11, 3]], mine = me === 1 ? [[11, 1], [11, 3]] : [[0, 1], [0, 3]];
    for (var r2 = 0; r2 < 12; r2++) for (var c2 = 0; c2 < 5; c2++) {
      var q = board[r2][c2]; if (!q || q.t === 'M' || q.t === 'F') continue;
      if (q.p === me) { var dm = 99; tops.forEach(function (h) { var d = Math.abs(h[0] - r2) + Math.abs(h[1] - c2); if (d < dm) dm = d; }); sc += (14 - dm) * 0.4 * (q.t === 'E' ? 1.2 : 1); }
      else { var dd = 99; mine.forEach(function (h) { var d = Math.abs(h[0] - r2) + Math.abs(h[1] - c2); if (d < dd) dd = d; }); if (dd <= 2) sc -= (3 - dd) * 12; sc -= (14 - dd) * 0.2; }
    }
    sc += (mobileCount(board, me) - mobileCount(board, opp)) * 1.5;
    return sc;
  }
  function applyMove(board, m) { // 返回撤销信息
    var a = board[m.fr][m.fc], d = board[m.tr][m.tc], res = { a: a, d: d, am: a.mv, out: 'move' };
    board[m.fr][m.fc] = null;
    if (!d) { board[m.tr][m.tc] = a; a.mv = true; }
    else {
      var o = L.battle(a.t, d.t); res.out = o;
      if (o === 'win' || o === 'flag') { board[m.tr][m.tc] = a; a.mv = true; }
      else if (o === 'lose') { /* 攻方消失 */ }
      else board[m.tr][m.tc] = null;
    }
    return res;
  }
  function undoMove(board, m, u) { board[m.fr][m.fc] = u.a; board[m.tr][m.tc] = u.d; u.a.mv = u.am; }
  function allMoves(board, side) { var out = []; for (var r = 0; r < 12; r++) for (var c = 0; c < 5; c++) { var p = board[r][c]; if (p && p.p === side) { var ms = L.movesFrom(board, r, c); for (var i = 0; i < ms.length; i++) out.push(ms[i]); } } return out; }

  function hardMove(view, seat, opts) {
    opts = opts || {}; var t0 = Date.now(), limit = opts.timeMs || 1000, opp = 3 - seat;
    var myMoves = L.legalMoves(view, seat); if (!myMoves.length) return null;
    if (myMoves.length === 1) return myMoves[0];
    var inf = infer(view, seat), totals = new Array(myMoves.length).fill(0), nSamp = 0;
    var log = view.log || [], lastMine = null;
    for (var li = log.length - 1; li >= 0; li--) if (log[li].p === seat) { lastMine = log[li]; break; }
    var rounds = 0;
    do {
      var types = sample(inf), board = [];
      for (var r = 0; r < 12; r++) { board.push([]); for (var c = 0; c < 5; c++) { var q = view.board[r][c]; board[r].push(q ? { t: q.t, p: q.p, mv: q.mv } : null); } }
      inf.pieces.forEach(function (p, i) { var b = board[p.r][p.c]; if (b) b.t = types[i]; });
      for (var mi = 0; mi < myMoves.length; mi++) {
        var m = myMoves[mi], u = applyMove(board, m), v;
        if (u.out === 'flag') v = 6000;
        else {
          // 对方最佳应手(假设其了解我方棋子,偏保守)
          var oms = allMoves(board, opp), worst = Infinity;
          if (!oms.length) worst = 4000; // 对方无子可动
          else {
            var base = evalBoard(board, seat), cap = 0;
            for (var oi = 0; oi < oms.length; oi++) {
              var om = oms[oi], tgt = board[om.tr][om.tc];
              if (!tgt) { continue; } // 非吃子应手: 以当前评估计
              var u2 = applyMove(board, om), e = evalBoard(board, seat); undoMove(board, om, u2);
              if (e < worst) worst = e;
            }
            if (worst === Infinity || worst > base) worst = base;
            // 第三层: 对方应手后,我方最好的吃子(仅在评估值有提升空间时)
            var mms = allMoves(board, seat), gain = worst;
            if (worst > -4000) for (var gi = 0; gi < mms.length; gi++) { var gm = mms[gi]; if (!board[gm.tr][gm.tc]) continue; var u3 = applyMove(board, gm), e3 = evalBoard(board, seat); undoMove(board, gm, u3); if (e3 > gain) gain = e3; }
            worst = worst * 0.6 + gain * 0.4;
          }
          v = worst;
        }
        undoMove(board, m, u);
        // 小幅惩罚来回走(避免循环)
        if (lastMine && lastMine.tr === m.fr && lastMine.tc === m.fc && lastMine.fr === m.tr && lastMine.fc === m.tc) v -= 2;
        totals[mi] += v;
      }
      nSamp++; rounds++;
    } while (Date.now() - t0 < limit * 0.8 && nSamp < 400);
    var best = 0, bestV = -Infinity;
    for (var k = 0; k < myMoves.length; k++) { var avg = totals[k] / nSamp + Math.random() * 0.01; if (avg > bestV) { bestV = avg; best = k; } }
    return { fr: myMoves[best].fr, fc: myMoves[best].fc, tr: myMoves[best].tr, tc: myMoves[best].tc };
  }
  var API = { hardMove: hardMove, infer: infer, sample: sample };
  if (typeof module !== 'undefined' && module.exports) module.exports = API; else (self.GH = self.GH || {}).AILuzhanqi = API;
})();
