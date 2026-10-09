/* 象棋 AI(困难档): 一维 90 格棋盘 + 预生成走法表; 迭代加深 PVS α-β; Zobrist 置换表; 静态搜索(吃子);
   走法排序 = 置换表着法 > MVV-LVA 吃子 > 杀手着法 > 历史启发; 空着裁剪; 将军延伸; 棋子-位置价值表; 重复局面处理(长将判负、其余循环记和)。
   默认限时 2000ms,通常搜索深度 6~9 层(随局面不同)。 */
(function () {
  var SQ = 90;
  // 棋子编码: 红 1..7 = 帅 仕 相 马 车 炮 兵; 黑 +8
  var CODE = { K: 1, A: 2, B: 3, N: 4, R: 5, C: 6, P: 7 };
  var VAL = [0, 0, 200, 200, 420, 900, 450, 100];
  function sideOf(p) { return p === 0 ? -1 : (p < 8 ? 0 : 1); } // 0 红 1 黑
  function typeOf(p) { return p & 7; }
  function rowOf(s) { return (s / 9) | 0; }
  function colOf(s) { return s % 9; }
  function ok(r, c) { return r >= 0 && r < 10 && c >= 0 && c < 9; }
  function inPalace(side, r, c) { return c >= 3 && c <= 5 && (side === 0 ? r >= 7 : r <= 2); }

  /* ---- 走法表 ---- */
  var KM = [[], []], AM = [[], []], BM = [[], []], NM = [], RAYS = [], PM = [[], []], nAtk = [], pAtk = [[], []];
  var ORTH = [[-1, 0], [1, 0], [0, -1], [0, 1]], DIAG = [[1, 1], [1, -1], [-1, 1], [-1, -1]];
  (function () {
    var s, r, c, i, side;
    for (s = 0; s < SQ; s++) { KM[0][s] = []; KM[1][s] = []; AM[0][s] = []; AM[1][s] = []; BM[0][s] = []; BM[1][s] = []; NM[s] = []; RAYS[s] = []; PM[0][s] = []; PM[1][s] = []; nAtk[s] = []; pAtk[0][s] = []; pAtk[1][s] = []; }
    for (s = 0; s < SQ; s++) {
      r = rowOf(s); c = colOf(s);
      for (side = 0; side < 2; side++) {
        for (i = 0; i < 4; i++) { var kr = r + ORTH[i][0], kc = c + ORTH[i][1]; if (ok(kr, kc) && inPalace(side, kr, kc) && inPalace(side, r, c)) KM[side][s].push(kr * 9 + kc); }
        for (i = 0; i < 4; i++) { var ar = r + DIAG[i][0], ac = c + DIAG[i][1]; if (ok(ar, ac) && inPalace(side, ar, ac) && inPalace(side, r, c)) AM[side][s].push(ar * 9 + ac); }
        for (i = 0; i < 4; i++) { var br = r + DIAG[i][0] * 2, bc = c + DIAG[i][1] * 2; if (ok(br, bc) && (side === 0 ? br >= 5 : br <= 4) && (side === 0 ? r >= 5 : r <= 4)) BM[side][s].push([br * 9 + bc, (r + DIAG[i][0]) * 9 + c + DIAG[i][1]]); }
        var f = side === 0 ? -1 : 1;
        if (ok(r + f, c)) PM[side][s].push((r + f) * 9 + c);
        if (side === 0 ? r <= 4 : r >= 5) { if (c > 0) PM[side][s].push(r * 9 + c - 1); if (c < 8) PM[side][s].push(r * 9 + c + 1); }
      }
      for (i = 0; i < 4; i++) { // 马: 腿位于相邻格
        var lr = r + ORTH[i][0], lc = c + ORTH[i][1]; if (!ok(lr, lc)) continue;
        var tg = ORTH[i][0] !== 0 ? [[r + 2 * ORTH[i][0], c - 1], [r + 2 * ORTH[i][0], c + 1]] : [[r - 1, c + 2 * ORTH[i][1]], [r + 1, c + 2 * ORTH[i][1]]];
        tg.forEach(function (t) { if (ok(t[0], t[1])) NM[s].push([t[0] * 9 + t[1], lr * 9 + lc]); });
      }
      for (i = 0; i < 4; i++) { var ray = [], xr = r + ORTH[i][0], xc = c + ORTH[i][1]; while (ok(xr, xc)) { ray.push(xr * 9 + xc); xr += ORTH[i][0]; xc += ORTH[i][1]; } RAYS[s].push(ray); }
    }
    for (s = 0; s < SQ; s++) {
      NM[s].forEach(function (m) { nAtk[m[0]].push([s, m[1]]); }); // 位于 s 的马可跳到 m[0],腿 m[1]
      for (side = 0; side < 2; side++) PM[side][s].forEach(function (t) { pAtk[side][t].push(s); });
    }
  })();

  /* ---- Zobrist ---- */
  var seed = 0x9E3779B9; function rnd32() { seed ^= seed << 13; seed ^= seed >>> 17; seed ^= seed << 5; return seed | 0; }
  var ZK = [], ZK2 = []; for (var zi = 0; zi < 16; zi++) { ZK.push(new Int32Array(SQ)); ZK2.push(new Int32Array(SQ)); for (var zs = 0; zs < SQ; zs++) { ZK[zi][zs] = rnd32(); ZK2[zi][zs] = rnd32(); } }
  var ZSIDE = rnd32(), ZSIDE2 = rnd32();

  /* ---- 棋子-位置表(红方视角,黑方镜像) ---- */
  var PST = []; // PST[piece][sq] 含子力
  (function () {
    for (var p = 1; p < 16; p++) PST.push(null); PST = [null];
    var tabs = {};
    for (var t = 1; t <= 7; t++) tabs[t] = new Int16Array(SQ);
    for (var s = 0; s < SQ; s++) {
      var r = rowOf(s), c = colOf(s), adv = 9 - r, cen = 4 - Math.abs(c - 4);
      tabs[1][s] = 0;
      tabs[2][s] = VAL[2] + (r === 8 && c === 4 ? 6 : 0);
      tabs[3][s] = VAL[3] + (r === 9 && (c === 2 || c === 6) ? 4 : 0) + (r === 7 && c === 4 ? 6 : 0);
      var kn = VAL[4] + cen * 5 + Math.min(adv, 7) * 4 - ((c === 0 || c === 8) ? 14 : 0) - (r === 9 && (c === 1 || c === 7) ? 6 : 0) + (r <= 2 ? 6 : 0);
      tabs[4][s] = kn;
      tabs[5][s] = VAL[5] + Math.min(adv, 8) * 3 + cen * 1 + (r <= 1 ? 14 : 0) + (r === 9 && (c === 0 || c === 8) ? -8 : 0);
      tabs[6][s] = VAL[6] + cen * 3 + (c === 4 ? 8 : 0) + Math.min(adv, 6) * 2 + (r === 9 ? -3 : 0);
      var pv = [80, 85, 90, 95, 100, 150, 175, 210, 215, 110][adv]; if (adv >= 5) pv += cen * 4;
      tabs[7][s] = pv;
    }
    var out = [new Int16Array(SQ)];
    for (var q = 1; q < 16; q++) out.push(new Int16Array(SQ));
    for (var tt = 1; tt <= 7; tt++) for (var sq = 0; sq < SQ; sq++) {
      out[tt][sq] = tabs[tt][sq];
      var mr = 9 - rowOf(sq), mc = 8 - colOf(sq); out[tt + 8][sq] = tabs[tt][mr * 9 + mc];
    }
    PST = out;
  })();
  var MATE = 30000, INF = 32000;

  /* ---- 局面 ---- */
  function Pos() {
    this.b = new Int8Array(SQ); this.side = 0; this.k1 = 0; this.k2 = 0; this.sc = 0; this.ksq = [-1, -1];
    this.stK1 = []; this.stK2 = []; this.stCap = []; this.stChk = []; this.stMove = [];
  }
  Pos.prototype.put = function (s, p) { this.b[s] = p; this.k1 ^= ZK[p][s]; this.k2 ^= ZK2[p][s]; this.sc += (p < 8 ? 1 : -1) * PST[p][s]; if ((p & 7) === 1) this.ksq[p < 8 ? 0 : 1] = s; };
  Pos.prototype.fromBoard = function (board, turn) { // board 为引擎的 10x9 字符数组
    for (var r = 0; r < 10; r++) for (var c = 0; c < 9; c++) {
      var ch = board[r][c]; if (!ch) continue;
      var t = CODE[ch.toUpperCase()], p = ch === ch.toUpperCase() ? t : t + 8; this.put(r * 9 + c, p);
    }
    this.side = turn === 1 ? 0 : 1; if (this.side) { this.k1 ^= ZSIDE; this.k2 ^= ZSIDE2; }
  };
  Pos.prototype.make = function (m) {
    var from = m & 127, to = m >> 7, p = this.b[from], cap = this.b[to];
    this.stK1.push(this.k1); this.stK2.push(this.k2); this.stCap.push(cap); this.stMove.push(m);
    var sg = p < 8 ? 1 : -1;
    this.k1 ^= ZK[p][from] ^ ZK[p][to] ^ ZSIDE; this.k2 ^= ZK2[p][from] ^ ZK2[p][to] ^ ZSIDE2;
    this.sc += sg * (PST[p][to] - PST[p][from]);
    if (cap) { this.k1 ^= ZK[cap][to]; this.k2 ^= ZK2[cap][to]; this.sc -= (cap < 8 ? 1 : -1) * PST[cap][to]; }
    this.b[to] = p; this.b[from] = 0;
    if ((p & 7) === 1) this.ksq[p < 8 ? 0 : 1] = to;
    this.side ^= 1;
  };
  Pos.prototype.unmake = function () {
    var m = this.stMove.pop(), from = m & 127, to = m >> 7, cap = this.stCap.pop(), p = this.b[to];
    this.k1 = this.stK1.pop(); this.k2 = this.stK2.pop();
    this.b[from] = p; this.b[to] = cap;
    this.sc -= (p < 8 ? 1 : -1) * (PST[p][to] - PST[p][from]);
    if (cap) this.sc += (cap < 8 ? 1 : -1) * PST[cap][to];
    if ((p & 7) === 1) this.ksq[p < 8 ? 0 : 1] = from;
    this.side ^= 1;
  };
  // 格 sq 是否被 by 方攻击(用于将军/飞将判断;sq 为将帅所在格时含"将帅对面")
  Pos.prototype.attacked = function (sq, by) {
    var b = this.b, off = by * 8, i, j, ray, p, seen;
    var rook = 5 + off, cannon = 6 + off, knight = 4 + off, king = 1 + off, pawn = 7 + off;
    for (i = 0; i < 4; i++) {
      ray = RAYS[sq][i]; seen = 0;
      for (j = 0; j < ray.length; j++) {
        p = b[ray[j]]; if (!p) continue;
        if (seen === 0) { if (p === rook) return true; if (p === king && i < 2) return true; seen = 1; }
        else { if (p === cannon) return true; break; }
      }
    }
    var na = nAtk[sq]; for (i = 0; i < na.length; i++) if (b[na[i][0]] === knight && !b[na[i][1]]) return true;
    var pa = pAtk[by][sq]; for (i = 0; i < pa.length; i++) if (b[pa[i]] === pawn) return true;
    return false;
  };
  Pos.prototype.inCheck = function (side) { return this.attacked(this.ksq[side], 1 - side); };
  // 生成伪合法走法到 out(返回数量); caps 仅吃子
  Pos.prototype.gen = function (out, caps) {
    var b = this.b, side = this.side, n = 0, s, p, t, i, j, ray, q, d;
    var lo = side === 0 ? 1 : 9, hi = lo + 6;
    for (s = 0; s < SQ; s++) {
      p = b[s]; if (p < lo || p > hi) continue; t = p & 7;
      switch (t) {
        case 1: d = KM[side][s]; for (i = 0; i < d.length; i++) { q = b[d[i]]; if ((!q && !caps) || (q && sideOf(q) !== side)) out[n++] = s | (d[i] << 7); }
          // 飞将: 同列直接面对对方将帅
          ray = RAYS[s][side === 0 ? 0 : 1]; for (j = 0; j < ray.length; j++) { q = b[ray[j]]; if (q) { if (q === (side === 0 ? 9 : 1)) out[n++] = s | (ray[j] << 7); break; } }
          break;
        case 2: d = AM[side][s]; for (i = 0; i < d.length; i++) { q = b[d[i]]; if ((!q && !caps) || (q && sideOf(q) !== side)) out[n++] = s | (d[i] << 7); } break;
        case 3: d = BM[side][s]; for (i = 0; i < d.length; i++) { if (b[d[i][1]]) continue; q = b[d[i][0]]; if ((!q && !caps) || (q && sideOf(q) !== side)) out[n++] = s | (d[i][0] << 7); } break;
        case 4: d = NM[s]; for (i = 0; i < d.length; i++) { if (b[d[i][1]]) continue; q = b[d[i][0]]; if ((!q && !caps) || (q && sideOf(q) !== side)) out[n++] = s | (d[i][0] << 7); } break;
        case 5: for (i = 0; i < 4; i++) { ray = RAYS[s][i]; for (j = 0; j < ray.length; j++) { q = b[ray[j]]; if (!q) { if (!caps) out[n++] = s | (ray[j] << 7); } else { if (sideOf(q) !== side) out[n++] = s | (ray[j] << 7); break; } } } break;
        case 6: for (i = 0; i < 4; i++) { ray = RAYS[s][i]; j = 0; for (; j < ray.length; j++) { q = b[ray[j]]; if (!q) { if (!caps) out[n++] = s | (ray[j] << 7); } else break; }
          for (j++; j < ray.length; j++) { q = b[ray[j]]; if (q) { if (sideOf(q) !== side) out[n++] = s | (ray[j] << 7); break; } } } break;
        case 7: d = PM[side][s]; for (i = 0; i < d.length; i++) { q = b[d[i]]; if ((!q && !caps) || (q && sideOf(q) !== side)) out[n++] = s | (d[i] << 7); } break;
      }
    }
    return n;
  };
  Pos.prototype.hasLegal = function () {
    var mv = new Int32Array(128), n = this.gen(mv, false), side = this.side;
    for (var i = 0; i < n; i++) { this.make(mv[i]); var bad = this.inCheck(side); this.unmake(); if (!bad) return true; }
    return false;
  };

  /* ---- 搜索 ---- */
  var TTN = 1 << 20, TTM = TTN - 1;
  var tk = new Int32Array(TTN), tk2 = new Int32Array(TTN), tv = new Int16Array(TTN), tm = new Int16Array(TTN), td = new Int8Array(TTN), tf = new Int8Array(TTN);
  var killers = [], history = new Int32Array(SQ * SQ), mvbuf = [], scbuf = [];
  for (var pl = 0; pl < 64; pl++) { killers.push([0, 0]); mvbuf.push(new Int32Array(128)); scbuf.push(new Int32Array(128)); }
  var S = { pos: null, nodes: 0, deadline: 0, stop: false, keys: [], chks: [], base: 0 };

  function evalPos(pos) {
    var v = pos.sc; // 红方视角
    return (pos.side === 0 ? v : -v) + 8;
  }
  function checkStop() { if ((S.nodes & 1023) === 0 && Date.now() > S.deadline) S.stop = true; return S.stop; }
  // 重复检测: 返回 null(无重复) 或 数值(从当前走子方视角)
  function repScore(pos, ply, givesCheck) {
    var keys = S.keys, n = keys.length - 1; // keys[n] 为当前局面
    for (var j = n - 2; j >= 0; j -= 2) {
      if (keys[j][0] === pos.k1 && keys[j][1] === pos.k2) {
        var aAll = true, bAll = true; // a=刚走完的一方(当前局面的上一手方), b=另一方
        for (var i = n; i > j; i--) { if ((n - i) % 2 === 0) { if (!S.chks[i]) aAll = false; } else { if (!S.chks[i]) bAll = false; } }
        if (aAll && !bAll) return MATE - ply;      // a 长将 → a 判负 → 当前走子方(b)获胜
        if (bAll && !aAll) return -(MATE - ply);
        return 0;
      }
    }
    return null;
  }
  function pushKey(pos, chk) { S.keys.push([pos.k1, pos.k2]); S.chks.push(chk); }
  function popKey() { S.keys.pop(); S.chks.pop(); }
  function scoreMoves(pos, mv, n, sc, ttm, ply) {
    var b = pos.b;
    for (var i = 0; i < n; i++) {
      var m = mv[i], from = m & 127, to = m >> 7, cap = b[to], s;
      if (m === ttm) s = 1e7;
      else if (cap) s = 1e6 + VAL[cap & 7] * 16 - VAL[b[from] & 7] / 4 + (cap & 7 === 1 ? 1e5 : 0);
      else if (m === killers[ply][0]) s = 9e5; else if (m === killers[ply][1]) s = 8.9e5;
      else s = history[from * SQ + to];
      sc[i] = s;
    }
  }
  function pick(mv, sc, n, i) { var bi = i, bs = sc[i]; for (var j = i + 1; j < n; j++) if (sc[j] > bs) { bs = sc[j]; bi = j; } if (bi !== i) { var tm_ = mv[i]; mv[i] = mv[bi]; mv[bi] = tm_; var ts = sc[i]; sc[i] = sc[bi]; sc[bi] = ts; } return mv[i]; }

  function qsearch(pos, alpha, beta, ply) {
    S.nodes++; if (checkStop()) return 0;
    var stand = evalPos(pos);
    if (ply >= 60) return stand;
    if (stand >= beta) return stand;
    if (stand > alpha) alpha = stand;
    var mv = mvbuf[ply], sc = scbuf[ply], n = pos.gen(mv, true), side = pos.side;
    scoreMoves(pos, mv, n, sc, 0, ply);
    for (var i = 0; i < n; i++) {
      var m = pick(mv, sc, n, i);
      if ((pos.b[m >> 7] & 7) === 1) return MATE - ply; // 吃将
      pos.make(m);
      if (pos.inCheck(side)) { pos.unmake(); continue; }
      var v = -qsearch(pos, -beta, -alpha, ply + 1);
      pos.unmake();
      if (S.stop) return 0;
      if (v >= beta) return v;
      if (v > alpha) alpha = v;
    }
    return alpha;
  }
  function search(pos, depth, alpha, beta, ply, allowNull) {
    S.nodes++; if (checkStop()) return 0;
    var side = pos.side, inChk = pos.inCheck(side), isPV = beta - alpha > 1;
    if (inChk && ply < 40) depth++;
    if (depth <= 0) return qsearch(pos, alpha, beta, ply);
    if (ply >= 60) return evalPos(pos);
    var idx = pos.k1 & TTM, ttm = 0, alpha0 = alpha;
    if (tk[idx] === pos.k1 && tk2[idx] === pos.k2) {
      ttm = tm[idx];
      if (td[idx] >= depth && !isPV) {
        var sv = tv[idx], fl = tf[idx];
        if (sv > MATE - 100) sv -= ply; else if (sv < -MATE + 100) sv += ply;
        if (fl === 0) return sv; if (fl === 1 && sv >= beta) return sv; if (fl === 2 && sv <= alpha) return sv;
      }
    }
    // 空着裁剪
    if (allowNull && !inChk && !isPV && depth >= 3) {
      var maj = 0, b = pos.b, lo = side === 0 ? 4 : 12; for (var s0 = 0; s0 < SQ; s0++) { var q0 = b[s0]; if (q0 >= lo && q0 <= lo + 2) maj++; }
      if (maj >= 2) {
        pos.stK1.push(pos.k1); pos.stK2.push(pos.k2); pos.k1 ^= ZSIDE; pos.k2 ^= ZSIDE2; pos.side ^= 1;
        var nv = -search(pos, depth - 3, -beta, -beta + 1, ply + 1, false);
        pos.side ^= 1; pos.k1 = pos.stK1.pop(); pos.k2 = pos.stK2.pop();
        if (S.stop) return 0; if (nv >= beta) return nv;
      }
    }
    var mv = mvbuf[ply], sc = scbuf[ply], n = pos.gen(mv, false), best = -INF, bestM = 0, legal = 0, i;
    scoreMoves(pos, mv, n, sc, ttm, ply);
    for (i = 0; i < n; i++) {
      var m = pick(mv, sc, n, i), cap = pos.b[m >> 7];
      if ((cap & 7) === 1) return MATE - ply;
      pos.make(m);
      if (pos.inCheck(side)) { pos.unmake(); continue; }
      legal++;
      var gives = pos.inCheck(1 - side);
      pushKey(pos, gives);
      var v, rs = repScore(pos, ply + 1, gives);
      if (rs !== null) v = -rs; // rs 为对方(当前走子方的对手)视角 → 取反
      else {
        var ext = 0;
        if (legal === 1) v = -search(pos, depth - 1 + ext, -beta, -alpha, ply + 1, true);
        else {
          var red = (depth >= 3 && legal > 6 && !cap && !inChk && !gives) ? 1 : 0;
          v = -search(pos, depth - 1 - red, -alpha - 1, -alpha, ply + 1, true);
          if (v > alpha && (isPV || red)) v = -search(pos, depth - 1, -beta, -alpha, ply + 1, true);
        }
      }
      popKey(); pos.unmake();
      if (S.stop) return 0;
      if (v > best) { best = v; bestM = m; }
      if (v > alpha) { alpha = v; if (v >= beta) { if (!cap) { if (killers[ply][0] !== m) { killers[ply][1] = killers[ply][0]; killers[ply][0] = m; } history[(m & 127) * SQ + (m >> 7)] += depth * depth; } break; } }
    }
    if (legal === 0) return -MATE + ply; // 被将死或困毙(象棋困毙判负)
    var flag = best <= alpha0 ? 2 : best >= beta ? 1 : 0, store = best;
    if (store > MATE - 100) store += ply; else if (store < -MATE + 100) store -= ply;
    if (td[idx] <= depth || tk[idx] !== pos.k1) { tk[idx] = pos.k1; tk2[idx] = pos.k2; tv[idx] = store; tm[idx] = bestM; td[idx] = depth; tf[idx] = flag; }
    return best;
  }
  function toMove(m) { var f = m & 127, t = m >> 7; return { fr: rowOf(f), fc: colOf(f), tr: rowOf(t), tc: colOf(t) }; }
  function fromMove(o) { return (o.fr * 9 + o.fc) | ((o.tr * 9 + o.tc) << 7); }

  /* 取得对局历史(用于重复局面检测): 重放 state.moves */
  function buildPos(state, seat) {
    var X = typeof require === 'function' ? require('./xiangqi.js') : GH.Xiangqi;
    var pos = new Pos(), start = X.initialBoard();
    var keys = [], chks = [];
    if (state.moves && state.moves.length) {
      pos.fromBoard(start, 1); keys.push([pos.k1, pos.k2]); chks.push(false);
      for (var i = 0; i < state.moves.length; i++) {
        var mm = state.moves[i]; pos.make(fromMove(mm)); var side = pos.side;
        keys.push([pos.k1, pos.k2]); chks.push(pos.inCheck(side));
      }
      // 以当前局面为准(防御性校验)
      var cur = new Pos(); cur.fromBoard(state.board, state.turn);
      if (cur.k1 === pos.k1 && cur.k2 === pos.k2) return { pos: pos, keys: keys, chks: chks };
    }
    pos = new Pos(); pos.fromBoard(state.board, state.turn); return { pos: pos, keys: [[pos.k1, pos.k2]], chks: [false] };
  }
  function hardMove(state, seat, opts) {
    opts = opts || {}; var limit = opts.timeMs || 2000, t0 = Date.now();
    if (!state.moves || state.moves.length === 0) { // 极简开局库: 红方首着在常见开局中随机
      var bookR = [{ fr: 7, fc: 1, tr: 7, tc: 4 }, { fr: 7, fc: 7, tr: 7, tc: 4 }, { fr: 9, fc: 1, tr: 7, tc: 2 }, { fr: 9, fc: 7, tr: 7, tc: 6 }, { fr: 9, fc: 2, tr: 7, tc: 4 }];
      if (state.turn === 1) return bookR[Math.floor(Math.random() * bookR.length)];
    } else if (state.moves.length === 1 && state.turn === 2) {
      var f = state.moves[0];
      if (f.tr === 7 && f.tc === 4) return Math.random() < 0.5 ? { fr: 0, fc: 7, tr: 2, tc: 6 } : { fr: 0, fc: 1, tr: 2, tc: 2 };
    }
    var bp = buildPos(state, seat), pos = bp.pos;
    S.keys = bp.keys; S.chks = bp.chks; S.deadline = t0 + limit; S.stop = false; S.nodes = 0;
    history.fill(0); for (var k = 0; k < 64; k++) { killers[k][0] = 0; killers[k][1] = 0; }
    var side = pos.side, root = [], mv = new Int32Array(128), n = pos.gen(mv, false), i;
    for (i = 0; i < n; i++) { pos.make(mv[i]); var bad = pos.inCheck(side); pos.unmake(); if (!bad) root.push(mv[i]); }
    if (!root.length) return null;
    if (root.length === 1) return toMove(root[0]);
    var best = root[0], bestV = -INF, lastDepth = 0, scores = {};
    // 开局随机扰动: 前几步给出同分走法的微小随机性
    for (var depth = 1; depth <= (opts.maxDepth || 14); depth++) {
      var alpha = -INF, curBest = 0, curV = -INF, done = true;
      // 根走法排序: 上一层最佳优先
      root.sort(function (a, b) { return (b === best ? 1e9 : (scores[b] || 0)) - (a === best ? 1e9 : (scores[a] || 0)); });
      for (i = 0; i < root.length; i++) {
        var m = root[i], cap = pos.b[m >> 7]; pos.make(m);
        var gives = pos.inCheck(1 - side); pushKey(pos, gives);
        var rs = repScore(pos, 1, gives), v;
        if (rs !== null) v = -rs;
        else if (i === 0) v = -search(pos, depth - 1, -INF, -alpha, 1, true);
        else { v = -search(pos, depth - 1, -alpha - 1, -alpha, 1, true); if (v > alpha && !S.stop) v = -search(pos, depth - 1, -INF, -alpha, 1, true); }
        popKey(); pos.unmake();
        if (S.stop) { done = false; break; }
        scores[m] = v;
        if (v > curV) { curV = v; curBest = m; }
        if (v > alpha) alpha = v;
      }
      if (!done) { if (curBest && curV > bestV - 300 && i > 0) { /* 未完成的层若已有更优着法,谨慎采用 */ if (curV >= bestV) { best = curBest; bestV = curV; } } break; }
      best = curBest; bestV = curV; lastDepth = depth;
      if (Math.abs(bestV) > MATE - 100) break;
      if (Date.now() - t0 > limit * 0.6) break;
    }
    S.lastInfo = { depth: lastDepth, nodes: S.nodes, score: bestV, ms: Date.now() - t0 };
    // 引擎层规则兜底: 若该着会被引擎判负(长将/长捉),换次优着
    var X2 = typeof require === 'function' ? require('./xiangqi.js') : GH.Xiangqi;
    if (X2.wouldLoseByRule) {
      var ordered = root.slice().sort(function (a, b) { return (b === best ? 1e9 : (scores[b] || -1e8)) - (a === best ? 1e9 : (scores[a] || -1e8)); });
      for (i = 0; i < ordered.length && i < 12; i++) { if (!X2.wouldLoseByRule(state, state.turn, toMove(ordered[i]))) { best = ordered[i]; break; } }
    }
    return toMove(best);
  }
  var API = { hardMove: hardMove, Pos: Pos, info: function () { return S.lastInfo; }, resetTT: function () { tk.fill(0); tk2.fill(0); td.fill(-1); } };
  if (typeof module !== 'undefined' && module.exports) module.exports = API; else (self.GH = self.GH || {}).AIXiangqi = API;
})();
