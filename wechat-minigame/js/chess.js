/* International Chess rules engine (full rules). White = seat 1, Black = seat 2.
   Squares 0..63: sq = rank*8 + file, a1 = 0, h1 = 7, a8 = 56. Pieces: 1 P, 2 N, 3 B, 4 R, 5 Q, 6 K (white positive, black negative).
   Castling bits: 1 = white O-O, 2 = white O-O-O, 4 = black O-O, 8 = black O-O-O.
   Rules: castling, en passant, promotion, check / checkmate / stalemate, draws by threefold repetition, fifty-move rule (automatic at 100 half-moves),
   insufficient material (K v K, K+minor v K, K+B v K+B with same-colour bishops).
   Game state is plain JSON (serialisable). move(s, seat, {from, to, promo}) with promo in 2..5 (N, B, R, Q; default Q). */
(function () {
  var PAWN = 1, KNIGHT = 2, BISHOP = 3, ROOK = 4, QUEEN = 5, KING = 6;
  var FILES = 'abcdefgh', LETTER = ['', '', 'N', 'B', 'R', 'Q', 'K'];
  function sqName(s) { return FILES[s & 7] + ((s >> 3) + 1); }
  var DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]];
  var RAYS = [], KNIGHT_T = [], KING_T = [];
  (function () {
    var KN = [[1, 2], [2, 1], [-1, 2], [-2, 1], [1, -2], [2, -1], [-1, -2], [-2, -1]];
    for (var sq = 0; sq < 64; sq++) {
      var r = sq >> 3, f = sq & 7, rays = [], i, k;
      for (i = 0; i < 8; i++) { var ray = [], rr = r + DIRS[i][0], ff = f + DIRS[i][1]; while (rr >= 0 && rr < 8 && ff >= 0 && ff < 8) { ray.push(rr * 8 + ff); rr += DIRS[i][0]; ff += DIRS[i][1]; } rays.push(ray); }
      RAYS.push(rays);
      var kn = [], kg = [];
      for (k = 0; k < 8; k++) { var a = r + KN[k][0], c = f + KN[k][1]; if (a >= 0 && a < 8 && c >= 0 && c < 8) kn.push(a * 8 + c); }
      for (k = 0; k < 8; k++) { var a2 = r + DIRS[k][0], c2 = f + DIRS[k][1]; if (a2 >= 0 && a2 < 8 && c2 >= 0 && c2 < 8) kg.push(a2 * 8 + c2); }
      KNIGHT_T.push(kn); KING_T.push(kg);
    }
  })();
  /* Zobrist keys (deterministic PRNG) */
  var Z1 = [], Z2 = [], ZS1, ZS2, ZC1 = [], ZC2 = [], ZE1 = [], ZE2 = [];
  (function () {
    var s = 0x9e3779b9; function rnd() { s ^= s << 13; s ^= s >>> 17; s ^= s << 5; return s | 0; }
    var i; for (i = 0; i < 12 * 64; i++) { Z1.push(rnd()); Z2.push(rnd()); }
    ZS1 = rnd(); ZS2 = rnd(); for (i = 0; i < 16; i++) { ZC1.push(rnd()); ZC2.push(rnd()); } for (i = 0; i < 8; i++) { ZE1.push(rnd()); ZE2.push(rnd()); }
  })();
  function pidx(p) { return p > 0 ? p - 1 : 5 - p; }

  function Pos() { this.b = new Array(64).fill(0); this.side = 1; this.castle = 0; this.ep = -1; this.half = 0; this.full = 1; this.k = [4, 60]; this.h1 = 0; this.h2 = 0; this.st = []; this.keys = []; }
  function hashPos(pos) {
    var h1 = 0, h2 = 0;
    for (var s = 0; s < 64; s++) { var p = pos.b[s]; if (p) { var i = pidx(p) * 64 + s; h1 ^= Z1[i]; h2 ^= Z2[i]; } }
    if (pos.side === -1) { h1 ^= ZS1; h2 ^= ZS2; }
    h1 ^= ZC1[pos.castle]; h2 ^= ZC2[pos.castle];
    pos.h1 = h1; pos.h2 = h2;
  }
  function epRelevant(pos) {
    var ep = pos.ep; if (ep < 0) return false; var f = ep & 7, b = pos.b;
    if (pos.side === 1) return (f > 0 && b[ep - 9] === 1) || (f < 7 && b[ep - 7] === 1);
    return (f > 0 && b[ep + 7] === -1) || (f < 7 && b[ep + 9] === -1);
  }
  function posKey(pos) {
    var h1 = pos.h1, h2 = pos.h2;
    if (epRelevant(pos)) { h1 ^= ZE1[pos.ep & 7]; h2 ^= ZE2[pos.ep & 7]; }
    return (h1 >>> 0) * 2097152 + ((h2 >>> 0) & 0x1fffff);
  }
  function attacked(pos, sq, by) { // is square attacked by side `by` (1 white, -1 black)
    var b = pos.b, r = sq >> 3, f = sq & 7, i, t, ray, j, p;
    var pr = r - by; if (pr >= 0 && pr < 8) { if (f > 0 && b[pr * 8 + f - 1] === by * PAWN) return true; if (f < 7 && b[pr * 8 + f + 1] === by * PAWN) return true; }
    var kn = KNIGHT_T[sq]; for (i = 0; i < kn.length; i++) if (b[kn[i]] === by * KNIGHT) return true;
    var kg = KING_T[sq]; for (i = 0; i < kg.length; i++) if (b[kg[i]] === by * KING) return true;
    var rays = RAYS[sq];
    for (i = 0; i < 8; i++) {
      ray = rays[i];
      for (j = 0; j < ray.length; j++) { t = ray[j]; p = b[t]; if (p) { if (p === by * QUEEN || p === by * (i < 4 ? ROOK : BISHOP)) return true; break; } }
    }
    return false;
  }
  function inCheck(pos) { return attacked(pos, pos.k[pos.side === 1 ? 0 : 1], -pos.side); }
  var FL_EP = 1, FL_CASTLE = 2, FL_DBL = 4;
  function mk(from, to, promo, flag) { return from | (to << 6) | ((promo || 0) << 12) | ((flag || 0) << 15); }
  function gen(pos, caps) { // pseudo-legal; caps: captures + queen promotions only
    var b = pos.b, side = pos.side, out = [], sq, p, i, j, t, ray, rays, q;
    for (sq = 0; sq < 64; sq++) {
      p = b[sq]; if (!p || (p > 0) !== (side === 1)) continue;
      var a = p * side, r = sq >> 3, f = sq & 7;
      if (a === PAWN) {
        var fwd = sq + side * 8, lastR = side === 1 ? 6 : 1, startR = side === 1 ? 1 : 6;
        if (r === lastR) { // promotion
          if (!b[fwd]) { if (caps) out.push(mk(sq, fwd, QUEEN)); else { out.push(mk(sq, fwd, QUEEN), mk(sq, fwd, ROOK), mk(sq, fwd, BISHOP), mk(sq, fwd, KNIGHT)); } }
          for (j = -1; j <= 1; j += 2) { if (f + j < 0 || f + j > 7) continue; t = fwd + j; if (b[t] && (b[t] > 0) !== (side === 1)) { if (caps) out.push(mk(sq, t, QUEEN)); else out.push(mk(sq, t, QUEEN), mk(sq, t, ROOK), mk(sq, t, BISHOP), mk(sq, t, KNIGHT)); } }
        } else {
          if (!caps && !b[fwd]) { out.push(mk(sq, fwd)); if (r === startR && !b[fwd + side * 8]) out.push(mk(sq, fwd + side * 8, 0, FL_DBL)); }
          for (j = -1; j <= 1; j += 2) {
            if (f + j < 0 || f + j > 7) continue; t = fwd + j;
            if (b[t] && (b[t] > 0) !== (side === 1)) out.push(mk(sq, t));
            else if (t === pos.ep) out.push(mk(sq, t, 0, FL_EP));
          }
        }
      } else if (a === KNIGHT || a === KING) {
        var tb = a === KNIGHT ? KNIGHT_T[sq] : KING_T[sq];
        for (i = 0; i < tb.length; i++) { t = tb[i]; q = b[t]; if (!q) { if (!caps) out.push(mk(sq, t)); } else if ((q > 0) !== (side === 1)) out.push(mk(sq, t)); }
        if (a === KING && !caps) {
          if (side === 1 && sq === 4) {
            if ((pos.castle & 1) && !b[5] && !b[6] && b[7] === ROOK && !attacked(pos, 4, -1) && !attacked(pos, 5, -1)) out.push(mk(4, 6, 0, FL_CASTLE));
            if ((pos.castle & 2) && !b[3] && !b[2] && !b[1] && b[0] === ROOK && !attacked(pos, 4, -1) && !attacked(pos, 3, -1)) out.push(mk(4, 2, 0, FL_CASTLE));
          } else if (side === -1 && sq === 60) {
            if ((pos.castle & 4) && !b[61] && !b[62] && b[63] === -ROOK && !attacked(pos, 60, 1) && !attacked(pos, 61, 1)) out.push(mk(60, 62, 0, FL_CASTLE));
            if ((pos.castle & 8) && !b[59] && !b[58] && !b[57] && b[56] === -ROOK && !attacked(pos, 60, 1) && !attacked(pos, 59, 1)) out.push(mk(60, 58, 0, FL_CASTLE));
          }
        }
      } else {
        rays = RAYS[sq]; var from = a === BISHOP ? 4 : 0, to = a === ROOK ? 4 : 8;
        for (i = from; i < to; i++) {
          ray = rays[i];
          for (j = 0; j < ray.length; j++) { t = ray[j]; q = b[t]; if (!q) { if (!caps) out.push(mk(sq, t)); } else { if ((q > 0) !== (side === 1)) out.push(mk(sq, t)); break; } }
        }
      }
    }
    return out;
  }
  function make(pos, m) {
    var b = pos.b, from = m & 63, to = (m >> 6) & 63, promo = (m >> 12) & 7, flag = m >> 15, p = b[from], side = pos.side, cap = b[to];
    pos.st.push(cap, pos.castle, pos.ep, pos.half, pos.h1, pos.h2);
    var h1 = pos.h1, h2 = pos.h2, i;
    i = pidx(p) * 64 + from; h1 ^= Z1[i]; h2 ^= Z2[i];
    if (cap) { i = pidx(cap) * 64 + to; h1 ^= Z1[i]; h2 ^= Z2[i]; }
    b[from] = 0;
    var np = promo ? promo * side : p; b[to] = np; i = pidx(np) * 64 + to; h1 ^= Z1[i]; h2 ^= Z2[i];
    pos.half = (p * side === PAWN || cap) ? 0 : pos.half + 1;
    var ne = -1;
    if (flag === FL_EP) { var cs = to - side * 8; i = pidx(b[cs]) * 64 + cs; h1 ^= Z1[i]; h2 ^= Z2[i]; b[cs] = 0; pos.half = 0; }
    else if (flag === FL_DBL) ne = from + side * 8;
    else if (flag === FL_CASTLE) {
      var rf, rt; if (to > from) { rf = from + 3; rt = from + 1; } else { rf = from - 4; rt = from - 1; }
      var rk = b[rf]; b[rf] = 0; b[rt] = rk;
      i = pidx(rk) * 64 + rf; h1 ^= Z1[i]; h2 ^= Z2[i]; i = pidx(rk) * 64 + rt; h1 ^= Z1[i]; h2 ^= Z2[i];
    }
    if (p * side === KING) pos.k[side === 1 ? 0 : 1] = to;
    var c = pos.castle;
    if (c) {
      if (from === 4 || to === 4) c &= ~3; if (from === 60 || to === 60) c &= ~12;
      if (from === 0 || to === 0) c &= ~2; if (from === 7 || to === 7) c &= ~1;
      if (from === 56 || to === 56) c &= ~8; if (from === 63 || to === 63) c &= ~4;
    }
    h1 ^= ZC1[pos.castle] ^ ZC1[c]; h2 ^= ZC2[pos.castle] ^ ZC2[c];
    pos.castle = c; pos.ep = ne; h1 ^= ZS1; h2 ^= ZS2;
    pos.h1 = h1; pos.h2 = h2; pos.side = -side; if (side === -1) pos.full++;
    pos.keys.push(posKey(pos));
  }
  function unmake(pos, m) {
    var b = pos.b, from = m & 63, to = (m >> 6) & 63, promo = (m >> 12) & 7, flag = m >> 15, st = pos.st;
    pos.keys.pop();
    pos.h2 = st.pop(); pos.h1 = st.pop(); pos.half = st.pop(); pos.ep = st.pop(); pos.castle = st.pop(); var cap = st.pop();
    pos.side = -pos.side; var side = pos.side; if (side === -1) pos.full--;
    var p = promo ? side * PAWN : b[to];
    b[from] = p; b[to] = cap;
    if (flag === FL_EP) { b[to] = 0; b[to - side * 8] = -side * PAWN; }
    else if (flag === FL_CASTLE) { var rf, rt; if (to > from) { rf = from + 3; rt = from + 1; } else { rf = from - 4; rt = from - 1; } b[rf] = b[rt]; b[rt] = 0; }
    if (p * side === KING) pos.k[side === 1 ? 0 : 1] = from;
  }
  function legalMoves(pos) {
    var ms = gen(pos, false), out = [], side = pos.side, ki = side === 1 ? 0 : 1;
    for (var i = 0; i < ms.length; i++) { make(pos, ms[i]); if (!attacked(pos, pos.k[ki], pos.side)) out.push(ms[i]); unmake(pos, ms[i]); }
    return out;
  }
  function perft(pos, d) {
    if (d === 0) return 1;
    var ms = gen(pos, false), n = 0, ki = pos.side === 1 ? 0 : 1;
    for (var i = 0; i < ms.length; i++) {
      make(pos, ms[i]);
      if (!attacked(pos, pos.k[ki], pos.side)) n += d === 1 ? 1 : perft(pos, d - 1);
      unmake(pos, ms[i]);
    }
    return n;
  }
  /* ---------- FEN ---------- */
  var START_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
  function posFromFEN(fen) {
    var pos = new Pos(), parts = fen.trim().split(/\s+/), rows = parts[0].split('/'), CH = { p: 1, n: 2, b: 3, r: 4, q: 5, k: 6 };
    for (var r = 0; r < 8; r++) {
      var f = 0, row = rows[7 - r];
      for (var i = 0; i < row.length; i++) {
        var ch = row[i];
        if (ch >= '1' && ch <= '8') f += +ch; else { var lo = ch.toLowerCase(), v = CH[lo]; pos.b[r * 8 + f] = ch === lo ? -v : v; if (v === KING) pos.k[ch === lo ? 1 : 0] = r * 8 + f; f++; }
      }
    }
    pos.side = (parts[1] || 'w') === 'b' ? -1 : 1;
    var cs = parts[2] || '-'; pos.castle = (cs.indexOf('K') >= 0 ? 1 : 0) | (cs.indexOf('Q') >= 0 ? 2 : 0) | (cs.indexOf('k') >= 0 ? 4 : 0) | (cs.indexOf('q') >= 0 ? 8 : 0);
    pos.ep = parts[3] && parts[3] !== '-' ? (parts[3].charCodeAt(0) - 97) + (parseInt(parts[3][1], 10) - 1) * 8 : -1;
    pos.half = parseInt(parts[4], 10) || 0; pos.full = parseInt(parts[5], 10) || 1;
    hashPos(pos); pos.keys = [posKey(pos)];
    return pos;
  }
  function toFEN(s) {
    var rows = [], CH = ['', 'p', 'n', 'b', 'r', 'q', 'k'];
    for (var r = 7; r >= 0; r--) { var row = '', e = 0; for (var f = 0; f < 8; f++) { var p = s.board[r * 8 + f]; if (!p) e++; else { if (e) { row += e; e = 0; } var c = CH[Math.abs(p)]; row += p > 0 ? c.toUpperCase() : c; } } if (e) row += e; rows.push(row); }
    var cs = (s.castle & 1 ? 'K' : '') + (s.castle & 2 ? 'Q' : '') + (s.castle & 4 ? 'k' : '') + (s.castle & 8 ? 'q' : '');
    return rows.join('/') + ' ' + (s.turn === 1 ? 'w' : 'b') + ' ' + (cs || '-') + ' ' + (s.ep >= 0 ? sqName(s.ep) : '-') + ' ' + s.half + ' ' + s.full;
  }
  /* position object for a game state (used by the AI and by move validation) */
  function posFromState(s) {
    var pos = new Pos(); pos.b = s.board.slice(); pos.side = s.turn === 1 ? 1 : -1; pos.castle = s.castle; pos.ep = s.ep; pos.half = s.half; pos.full = s.full;
    for (var i = 0; i < 64; i++) { if (pos.b[i] === KING) pos.k[0] = i; else if (pos.b[i] === -KING) pos.k[1] = i; }
    hashPos(pos); pos.keys = (s.hist || []).slice(); if (!pos.keys.length) pos.keys.push(posKey(pos));
    return pos;
  }
  function insufficient(b) {
    var minors = [], bishopsSq = [];
    for (var s = 0; s < 64; s++) { var a = Math.abs(b[s]); if (!a || a === KING) continue; if (a === PAWN || a === ROOK || a === QUEEN) return false; minors.push(a); if (a === BISHOP) bishopsSq.push(((s >> 3) + (s & 7)) & 1); }
    if (minors.length <= 1) return true;
    if (minors.length === bishopsSq.length) { for (var i = 1; i < bishopsSq.length; i++) if (bishopsSq[i] !== bishopsSq[0]) return false; return true; } // only same-colour bishops
    return false;
  }
  function stateFromPos(pos) {
    return { game: 'chess', board: pos.b.slice(), turn: pos.side === 1 ? 1 : 2, castle: pos.castle, ep: pos.ep, half: pos.half, full: pos.full, hist: [posKey(pos)], over: false, winner: 0, reason: '', check: false, last: null, san: [], count: 0, seq: 0 };
  }
  function newGame(o) {
    o = o || {}; var s = stateFromPos(posFromFEN(o.fen || START_FEN));
    var pos = posFromState(s); s.check = inCheck(pos);
    var ms = legalMoves(pos); if (!ms.length) { s.over = true; s.winner = s.check ? (s.turn === 1 ? 2 : 1) : 3; s.reason = s.check ? 'Checkmate' : 'Stalemate'; }
    return s;
  }
  function moveToObj(m) { return { from: m & 63, to: (m >> 6) & 63, promo: (m >> 12) & 7 }; }
  function sanOf(pos, m, legal, suffix) {
    var from = m & 63, to = (m >> 6) & 63, promo = (m >> 12) & 7, flag = m >> 15, p = Math.abs(pos.b[from]), cap = pos.b[to] !== 0 || flag === FL_EP, str;
    if (flag === FL_CASTLE) str = to > from ? 'O-O' : 'O-O-O';
    else if (p === PAWN) str = (cap ? FILES[from & 7] + 'x' : '') + sqName(to) + (promo ? '=' + LETTER[promo] : '');
    else {
      var same = legal.filter(function (o) { return o !== m && (o & 63) !== from && ((o >> 6) & 63) === to && Math.abs(pos.b[o & 63]) === p; }), dis = '';
      if (same.length) { var sf = same.some(function (o) { return (o & 7) === (from & 7); }), sr = same.some(function (o) { return ((o & 63) >> 3) === (from >> 3); }); dis = !sf ? FILES[from & 7] : !sr ? String((from >> 3) + 1) : sqName(from); }
      str = LETTER[p] + dis + (cap ? 'x' : '') + sqName(to);
    }
    return str + suffix;
  }
  function findMove(legal, mv) {
    var promo = mv.promo || 0;
    for (var i = 0; i < legal.length; i++) { var m = legal[i]; if ((m & 63) === mv.from && ((m >> 6) & 63) === mv.to) { var pr = (m >> 12) & 7; if (pr) { if (pr === (promo || QUEEN)) return m; } else return m; } }
    return -1;
  }
  function move(s, seat, mv) {
    if (s.over) return { ok: false, err: 'The game is over' };
    if (seat !== s.turn) return { ok: false, err: 'Not your turn' };
    if (!mv || !Number.isInteger(mv.from) || !Number.isInteger(mv.to) || mv.from < 0 || mv.from > 63 || mv.to < 0 || mv.to > 63) return { ok: false, err: 'Invalid move' };
    if (mv.promo && !(mv.promo >= 2 && mv.promo <= 5)) return { ok: false, err: 'Invalid move' };
    var pos = posFromState(s), legal = legalMoves(pos), m = findMove(legal, mv);
    if (m < 0) return { ok: false, err: 'Illegal move' };
    var from = m & 63, to = (m >> 6) & 63, flag = m >> 15, movedPiece = Math.abs(pos.b[from]), capPiece = flag === FL_EP ? PAWN : Math.abs(pos.b[to]);
    make(pos, m);
    var chk = inCheck(pos), replies = legalMoves(pos), suffix = chk ? (replies.length ? '+' : '#') : '';
    var san0 = sanOf(posFromState(s), m, legal, suffix); // SAN is computed on the pre-move position
    s.board = pos.b.slice(); s.turn = pos.side === 1 ? 1 : 2; s.castle = pos.castle; s.ep = pos.ep; s.half = pos.half; s.full = pos.full; s.check = chk;
    s.last = { from: from, to: to, piece: movedPiece, cap: capPiece, promo: (m >> 12) & 7, castle: flag === FL_CASTLE, ep: flag === FL_EP, san: san0 };
    s.san.push(san0); s.count++; s.seq = (s.seq || 0) + 1;
    if (s.half === 0) s.hist = [posKey(pos)]; else s.hist.push(posKey(pos));
    var key = posKey(pos), rep = 0; for (var i = 0; i < s.hist.length; i++) if (s.hist[i] === key) rep++;
    if (!replies.length) { s.over = true; if (chk) { s.winner = seat; s.reason = 'Checkmate'; } else { s.winner = 3; s.reason = 'Stalemate'; } }
    else if (insufficient(s.board)) { s.over = true; s.winner = 3; s.reason = 'Draw by insufficient material'; }
    else if (rep >= 3) { s.over = true; s.winner = 3; s.reason = 'Draw by threefold repetition'; }
    else if (s.half >= 100) { s.over = true; s.winner = 3; s.reason = 'Draw by the fifty-move rule'; }
    return { ok: true, san: san0, check: chk, over: s.over };
  }
  function resign(s, seat) { if (s.over) return; s.over = true; s.winner = 3 - seat; s.reason = 'Opponent resigned / left'; }
  function view(s) { return s; }
  function legalMovesFrom(s, seat, from) {
    if (s.over || seat !== s.turn) return [];
    var pos = posFromState(s), out = [];
    legalMoves(pos).forEach(function (m) { if ((m & 63) === from) out.push(moveToObj(m)); });
    return out;
  }
  function allLegal(s) { return legalMoves(posFromState(s)).map(moveToObj); }
  var API = { id: 'chess', name: 'International Chess', newGame: newGame, move: move, resign: resign, view: view, legalMovesFrom: legalMovesFrom, allLegal: allLegal,
    sqName: sqName, toFEN: toFEN, START_FEN: START_FEN, LETTER: LETTER,
    _: { Pos: Pos, posFromFEN: posFromFEN, posFromState: posFromState, gen: gen, make: make, unmake: unmake, legalMoves: legalMoves, perft: perft, attacked: attacked, inCheck: inCheck, posKey: posKey, hashPos: hashPos, insufficient: insufficient, moveToObj: moveToObj, mk: mk, stateFromPos: stateFromPos,
      RAYS: RAYS, KNIGHT_T: KNIGHT_T, KING_T: KING_T, pidx: pidx } };
  if (typeof module !== 'undefined' && module.exports) module.exports = API; else (self.GH = self.GH || {}).Chess = API;
})();
