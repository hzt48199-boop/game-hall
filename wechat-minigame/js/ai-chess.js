/* Chess AI: negamax alpha-beta with iterative deepening, quiescence search, transposition table, MVV-LVA / killer / history ordering,
   repetition-aware scoring, and a PST evaluation. Levels: 1 easy (depth 1 + random choice among decent moves), 2 normal (depth 3),
   3 hard (iterative deepening up to depth 8 within opts.timeMs). computeMove(state, seat, level, opts) -> {from, to, promo} | null */
(function () {
  var C = (typeof require === 'function') ? require('./chess.js') : GH.Chess, X = C._;
  var MATE = 30000;
  var VAL = [0, 100, 320, 330, 500, 900, 0];
  var T = {
    1: [0, 0, 0, 0, 0, 0, 0, 0, 50, 50, 50, 50, 50, 50, 50, 50, 10, 10, 20, 30, 30, 20, 10, 10, 5, 5, 10, 25, 25, 10, 5, 5, 0, 0, 0, 20, 20, 0, 0, 0, 5, -5, -10, 0, 0, -10, -5, 5, 5, 10, 10, -20, -20, 10, 10, 5, 0, 0, 0, 0, 0, 0, 0, 0],
    2: [-50, -40, -30, -30, -30, -30, -40, -50, -40, -20, 0, 0, 0, 0, -20, -40, -30, 0, 10, 15, 15, 10, 0, -30, -30, 5, 15, 20, 20, 15, 5, -30, -30, 0, 15, 20, 20, 15, 0, -30, -30, 5, 10, 15, 15, 10, 5, -30, -40, -20, 0, 5, 5, 0, -20, -40, -50, -40, -30, -30, -30, -30, -40, -50],
    3: [-20, -10, -10, -10, -10, -10, -10, -20, -10, 0, 0, 0, 0, 0, 0, -10, -10, 0, 5, 10, 10, 5, 0, -10, -10, 5, 5, 10, 10, 5, 5, -10, -10, 0, 10, 10, 10, 10, 0, -10, -10, 10, 10, 10, 10, 10, 10, -10, -10, 5, 0, 0, 0, 0, 5, -10, -20, -10, -10, -10, -10, -10, -10, -20],
    4: [0, 0, 0, 0, 0, 0, 0, 0, 5, 10, 10, 10, 10, 10, 10, 5, -5, 0, 0, 0, 0, 0, 0, -5, -5, 0, 0, 0, 0, 0, 0, -5, -5, 0, 0, 0, 0, 0, 0, -5, -5, 0, 0, 0, 0, 0, 0, -5, -5, 0, 0, 0, 0, 0, 0, -5, 0, 0, 0, 5, 5, 0, 0, 0],
    5: [-20, -10, -10, -5, -5, -10, -10, -20, -10, 0, 0, 0, 0, 0, 0, -10, -10, 0, 5, 5, 5, 5, 0, -10, -5, 0, 5, 5, 5, 5, 0, -5, 0, 0, 5, 5, 5, 5, 0, -5, -10, 5, 5, 5, 5, 5, 0, -10, -10, 0, 5, 0, 0, 0, 0, -10, -20, -10, -10, -5, -5, -10, -10, -20],
    6: [-30, -40, -40, -50, -50, -40, -40, -30, -30, -40, -40, -50, -50, -40, -40, -30, -30, -40, -40, -50, -50, -40, -40, -30, -30, -40, -40, -50, -50, -40, -40, -30, -20, -30, -30, -40, -40, -30, -30, -20, -10, -20, -20, -20, -20, -20, -20, -10, 20, 20, 0, 0, 0, 0, 20, 20, 20, 30, 10, 0, 0, 10, 30, 20],
    7: [-50, -40, -30, -20, -20, -30, -40, -50, -30, -20, -10, 0, 0, -10, -20, -30, -30, -10, 20, 30, 30, 20, -10, -30, -30, -10, 30, 40, 40, 30, -10, -30, -30, -10, 30, 40, 40, 30, -10, -30, -30, -10, 20, 30, 30, 20, -10, -30, -30, -30, 0, 0, 0, 0, -30, -30, -50, -30, -30, -30, -30, -30, -30, -50]
  };
  function evaluate(pos) { // from the side to move's point of view
    var b = pos.b, score = 0, mat = 0, wb = 0, bb = 0, wpf = [0, 0, 0, 0, 0, 0, 0, 0], bpf = [0, 0, 0, 0, 0, 0, 0, 0], s, p, a, r, f;
    for (s = 0; s < 64; s++) { p = b[s]; if (p && Math.abs(p) !== 6) mat += VAL[Math.abs(p)]; }
    var endgame = mat < 2600;
    for (s = 0; s < 64; s++) {
      p = b[s]; if (!p) continue; a = Math.abs(p); r = s >> 3; f = s & 7;
      var ti = p > 0 ? (7 - r) * 8 + f : r * 8 + f, pst = a === 6 ? (endgame ? T[7][ti] : T[6][ti]) : T[a][ti];
      var v = VAL[a] + pst;
      if (p > 0) { score += v; if (a === 1) wpf[f]++; else if (a === 3) wb++; } else { score -= v; if (a === 1) bpf[f]++; else if (a === 3) bb++; }
    }
    if (wb >= 2) score += 30; if (bb >= 2) score -= 30;
    for (f = 0; f < 8; f++) { if (wpf[f] > 1) score -= 12 * (wpf[f] - 1); if (bpf[f] > 1) score += 12 * (bpf[f] - 1); }
    // passed pawns
    for (s = 8; s < 56; s++) {
      p = b[s]; if (Math.abs(p) !== 1) continue; r = s >> 3; f = s & 7; var passed = true, k, ff, rr;
      for (ff = Math.max(0, f - 1); ff <= Math.min(7, f + 1) && passed; ff++) for (rr = p > 0 ? r + 1 : r - 1; rr >= 1 && rr <= 6; rr += p > 0 ? 1 : -1) if (b[rr * 8 + ff] === -p) { passed = false; break; }
      if (passed) { var adv = p > 0 ? r : 7 - r; var bonus = [0, 0, 5, 12, 25, 45, 80, 0][adv]; score += p > 0 ? bonus : -bonus; }
    }
    return pos.side === 1 ? score : -score;
  }
  var nodes, deadline, stop, tt, killers, hist;
  function ordScore(pos, m, ttMove, ply) {
    if (m === ttMove) return 1e7;
    var from = m & 63, to = (m >> 6) & 63, promo = (m >> 12) & 7, cap = Math.abs(pos.b[to]), mover = Math.abs(pos.b[from]);
    if (cap || (m >> 15) === 1) return 1e6 + (cap || 1) * 10 - mover + (promo ? 800 : 0);
    if (promo) return 9e5 + promo;
    if (killers[ply] && (killers[ply][0] === m || killers[ply][1] === m)) return 8e5;
    return hist[(pos.side === 1 ? 0 : 4096) + (from << 6) + to] || 0;
  }
  function isRep(pos) {
    var k = pos.keys, n = k.length, cur = k[n - 1], lim = Math.min(pos.half, n - 1);
    for (var i = 2; i <= lim; i += 2) if (k[n - 1 - i] === cur) return true;
    return false;
  }
  function qsearch(pos, alpha, beta, ply) {
    nodes++;
    var stand = evaluate(pos); if (stand >= beta) return stand; if (stand > alpha) alpha = stand;
    if (ply > 40) return stand;
    var ms = gen(pos), ki = pos.side === 1 ? 0 : 1, i;
    ms = ms.map(function (m) { return [ordScore(pos, m, 0, 99), m]; }).sort(function (a, b) { return b[0] - a[0]; });
    for (i = 0; i < ms.length; i++) {
      var m = ms[i][1]; X.make(pos, m);
      if (X.attacked(pos, pos.k[ki], pos.side)) { X.unmake(pos, m); continue; }
      var sc = -qsearch(pos, -beta, -alpha, ply + 1); X.unmake(pos, m);
      if (sc >= beta) return sc; if (sc > alpha) alpha = sc;
    }
    return alpha;
  }
  function gen(pos) { return X.gen(pos, true); }
  function search(pos, depth, alpha, beta, ply) {
    if ((++nodes & 2047) === 0 && Date.now() > deadline) stop = true;
    if (stop) return 0;
    if (ply > 0 && (isRep(pos) || pos.half >= 100)) return 0;
    var ki = pos.side === 1 ? 0 : 1, chk = X.attacked(pos, pos.k[ki], -pos.side);
    if (chk && ply < 40) depth++;
    if (depth <= 0) return qsearch(pos, alpha, beta, ply);
    var key = X.posKey(pos), e = tt.get(key), ttMove = 0, a0 = alpha;
    if (e) { ttMove = e.m; if (e.d >= depth && ply > 0) { if (e.f === 0) return e.s; if (e.f === 1 && e.s >= beta) return e.s; if (e.f === 2 && e.s <= alpha) return e.s; } }
    var ms = X.gen(pos, false);
    var sc = ms.map(function (m) { return [ordScore(pos, m, ttMove, ply), m]; }).sort(function (a, b) { return b[0] - a[0]; });
    var best = -MATE - 1, bestM = 0, legal = 0, i;
    for (i = 0; i < sc.length; i++) {
      var m = sc[i][1]; X.make(pos, m);
      if (X.attacked(pos, pos.k[ki], pos.side)) { X.unmake(pos, m); continue; }
      legal++;
      var quiet = !(pos.b[(m >> 6) & 63] !== 0 && false) && sc[i][0] < 8e5, v;
      if (legal > 4 && depth >= 3 && quiet && !chk) { v = -search(pos, depth - 2, -alpha - 1, -alpha, ply + 1); if (v > alpha) v = -search(pos, depth - 1, -beta, -alpha, ply + 1); }
      else v = -search(pos, depth - 1, -beta, -alpha, ply + 1);
      X.unmake(pos, m);
      if (stop) return 0;
      if (v > best) { best = v; bestM = m; }
      if (v > alpha) alpha = v;
      if (alpha >= beta) {
        if (sc[i][0] < 8e5) { var kk = killers[ply] || (killers[ply] = [0, 0]); if (kk[0] !== m) { kk[1] = kk[0]; kk[0] = m; } hist[(pos.side === 1 ? 0 : 4096) + ((m & 63) << 6) + ((m >> 6) & 63)] = (hist[(pos.side === 1 ? 0 : 4096) + ((m & 63) << 6) + ((m >> 6) & 63)] || 0) + depth * depth; }
        break;
      }
    }
    if (!legal) return chk ? -MATE + ply : 0;
    if (tt.size > 400000) tt.clear();
    tt.set(key, { d: depth, s: best, f: best <= a0 ? 2 : best >= beta ? 1 : 0, m: bestM });
    return best;
  }
  function rootScores(pos, depth, ms) { // full-window score for each root move (used by easy / normal)
    var ki = pos.side === 1 ? 0 : 1, out = [];
    for (var i = 0; i < ms.length; i++) { var m = ms[i]; X.make(pos, m); var v = (pos.half >= 100 || isRep(pos)) ? 0 : -search(pos, depth - 1, -MATE, MATE, 1); X.unmake(pos, m); out.push([v, m]); }
    return out;
  }
  function computeMove(state, seat, level, opts) {
    opts = opts || {}; if (state.over) return null;
    var pos = X.posFromState(state), legal = X.legalMoves(pos); if (!legal.length) return null;
    if (legal.length === 1) return X.moveToObj(legal[0]);
    nodes = 0; stop = false; tt = new Map(); killers = []; hist = {};
    var best = legal[0], i;
    if (level <= 2) {
      deadline = Date.now() + (opts.timeMs || 4000) * 2;
      var depth = level === 1 ? 1 : 3, sc = rootScores(pos, depth, legal);
      sc.sort(function (a, b) { return b[0] - a[0]; });
      var margin = level === 1 ? 140 : 12, pool = sc.filter(function (x) { return x[0] >= sc[0][0] - margin; });
      if (level === 1 && Math.random() < 0.15) pool = sc.slice(0, Math.min(sc.length, 6)); // occasional slip
      best = pool[Math.floor(Math.random() * pool.length)][1];
      return X.moveToObj(best);
    }
    deadline = Date.now() + (opts.timeMs || 2000);
    var maxD = opts.maxDepth || 8, bestScore = 0;
    for (var d = 1; d <= maxD; d++) {
      var alpha = -MATE - 1, beta = MATE + 1, iterBest = 0, iterScore = -MATE - 1, ki = pos.side === 1 ? 0 : 1;
      var ttm = tt.get(X.posKey(pos)); var ord = legal.map(function (m) { return [m === best ? 1e9 : ordScore(pos, m, ttm ? ttm.m : 0, 0), m]; }).sort(function (a, b) { return b[0] - a[0]; });
      for (i = 0; i < ord.length; i++) {
        var m = ord[i][1]; X.make(pos, m);
        var v = (pos.half >= 100 || isRep(pos)) ? 0 : -search(pos, d - 1, -beta, -alpha, 1); X.unmake(pos, m);
        if (stop) break;
        if (v > iterScore) { iterScore = v; iterBest = m; } if (v > alpha) alpha = v;
      }
      if (stop) { if (iterBest && d > 1 && iterScore > bestScore - 150) best = iterBest; break; } // use a partial iteration only if it is not worse
      best = iterBest; bestScore = iterScore;
      if (Math.abs(bestScore) > MATE - 100 || Date.now() > deadline - (opts.timeMs || 2000) * 0.55) break;
    }
    return X.moveToObj(best);
  }
  var API = { computeMove: computeMove, evaluate: evaluate, search: search, _stats: function () { return nodes; } };
  if (typeof module !== 'undefined' && module.exports) module.exports = API; else (self.GH = self.GH || {}).AIChess = API;
})();
