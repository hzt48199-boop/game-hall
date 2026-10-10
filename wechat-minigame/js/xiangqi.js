/* 中国象棋规则引擎。红方=1(下方,大写),黑方=2(上方,小写)。棋盘 10 行 x 9 列。
   K帅/将 A仕/士 B相/象 N马 R车 C炮 P兵/卒 */
(function () {
  var ROWS = 10, COLS = 9;
  function initialBoard() {
    var b = [], r, c;
    for (r = 0; r < ROWS; r++) b.push(new Array(COLS).fill(null));
    var back = 'rnbakabnr';
    for (c = 0; c < COLS; c++) { b[0][c] = back[c]; b[9][c] = back[c].toUpperCase(); }
    b[2][1] = b[2][7] = 'c'; b[7][1] = b[7][7] = 'C';
    [0, 2, 4, 6, 8].forEach(function (c) { b[3][c] = 'p'; b[6][c] = 'P'; });
    return b;
  }
  function sideOf(ch) { return !ch ? 0 : (ch === ch.toUpperCase() ? 1 : 2); }
  function newGame() {
    return { game: 'xiangqi', board: initialBoard(), turn: 1, winner: 0, over: false, reason: '', check: false, noCap: 0, count: 0, last: null, moves: [], hist: [] };
  }
  function pseudoMoves(board, side) {
    var moves = [], r, c;
    function add(fr, fc, tr, tc) {
      if (tr < 0 || tr >= ROWS || tc < 0 || tc >= COLS) return;
      var t = board[tr][tc];
      if (t && sideOf(t) === side) return;
      moves.push({ fr: fr, fc: fc, tr: tr, tc: tc });
    }
    var rowLo = side === 1 ? 7 : 0, rowHi = side === 1 ? 9 : 2;
    var ORTH = [[1, 0], [-1, 0], [0, 1], [0, -1]], DIAG = [[1, 1], [1, -1], [-1, 1], [-1, -1]];
    for (r = 0; r < ROWS; r++) for (c = 0; c < COLS; c++) {
      var ch = board[r][c];
      if (!ch || sideOf(ch) !== side) continue;
      var t = ch.toLowerCase(), i, k;
      if (t === 'k') {
        for (i = 0; i < 4; i++) {
          var kr = r + ORTH[i][0], kc = c + ORTH[i][1];
          if (kc >= 3 && kc <= 5 && kr >= rowLo && kr <= rowHi) add(r, c, kr, kc);
        }
        // 飞将:同列无遮挡直接面对对方将帅
        for (var dr = -1; dr <= 1; dr += 2) {
          var rr = r + dr;
          while (rr >= 0 && rr < ROWS && !board[rr][c]) rr += dr;
          if (rr >= 0 && rr < ROWS && board[rr][c] && board[rr][c].toLowerCase() === 'k' && sideOf(board[rr][c]) !== side) moves.push({ fr: r, fc: c, tr: rr, tc: c });
        }
      } else if (t === 'a') {
        for (i = 0; i < 4; i++) {
          var ar = r + DIAG[i][0], ac = c + DIAG[i][1];
          if (ac >= 3 && ac <= 5 && ar >= rowLo && ar <= rowHi) add(r, c, ar, ac);
        }
      } else if (t === 'b') {
        for (i = 0; i < 4; i++) {
          var br = r + DIAG[i][0] * 2, bc = c + DIAG[i][1] * 2;
          if (br < 0 || br >= ROWS || bc < 0 || bc >= COLS) continue;
          if (side === 1 ? br < 5 : br > 4) continue;
          if (board[r + DIAG[i][0]][c + DIAG[i][1]]) continue; // 塞象眼
          add(r, c, br, bc);
        }
      } else if (t === 'n') {
        for (i = 0; i < 4; i++) {
          var lr = r + ORTH[i][0], lc = c + ORTH[i][1];
          if (lr < 0 || lr >= ROWS || lc < 0 || lc >= COLS || board[lr][lc]) continue; // 蹩马腿
          if (ORTH[i][0] !== 0) { add(r, c, r + 2 * ORTH[i][0], c - 1); add(r, c, r + 2 * ORTH[i][0], c + 1); }
          else { add(r, c, r - 1, c + 2 * ORTH[i][1]); add(r, c, r + 1, c + 2 * ORTH[i][1]); }
        }
      } else if (t === 'r') {
        for (i = 0; i < 4; i++) {
          var xr = r + ORTH[i][0], xc = c + ORTH[i][1];
          while (xr >= 0 && xr < ROWS && xc >= 0 && xc < COLS) {
            if (!board[xr][xc]) add(r, c, xr, xc);
            else { add(r, c, xr, xc); break; }
            xr += ORTH[i][0]; xc += ORTH[i][1];
          }
        }
      } else if (t === 'c') {
        for (i = 0; i < 4; i++) {
          var yr = r + ORTH[i][0], yc = c + ORTH[i][1], screen = false;
          while (yr >= 0 && yr < ROWS && yc >= 0 && yc < COLS) {
            var occ = board[yr][yc];
            if (!screen) { if (!occ) add(r, c, yr, yc); else screen = true; }
            else if (occ) { add(r, c, yr, yc); break; }
            yr += ORTH[i][0]; yc += ORTH[i][1];
          }
        }
      } else if (t === 'p') {
        var f = side === 1 ? -1 : 1;
        add(r, c, r + f, c);
        if (side === 1 ? r <= 4 : r >= 5) { add(r, c, r, c - 1); add(r, c, r, c + 1); }
      }
    }
    return moves;
  }
  function findKing(board, side) {
    var k = side === 1 ? 'K' : 'k';
    for (var r = 0; r < ROWS; r++) for (var c = 0; c < COLS; c++) if (board[r][c] === k) return [r, c];
    return null;
  }
  // side 的将/帅是否被攻击(含飞将)
  function inCheck(board, side) {
    var kp = findKing(board, side);
    if (!kp) return true;
    var ms = pseudoMoves(board, 3 - side);
    for (var i = 0; i < ms.length; i++) if (ms[i].tr === kp[0] && ms[i].tc === kp[1]) return true;
    return false;
  }
  function legalMoves(board, side) {
    var ms = pseudoMoves(board, side), out = [];
    for (var i = 0; i < ms.length; i++) {
      var m = ms[i], cap = board[m.tr][m.tc];
      board[m.tr][m.tc] = board[m.fr][m.fc]; board[m.fr][m.fc] = null;
      var bad = inCheck(board, side);
      board[m.fr][m.fc] = board[m.tr][m.tc]; board[m.tr][m.tc] = cap;
      if (!bad) out.push(m);
    }
    return out;
  }
  function legalMovesFrom(s, seat, r, c) {
    return legalMoves(s.board, seat).filter(function (m) { return m.fr === r && m.fc === c; });
  }

  var PV = { k: 0, a: 2, b: 2, n: 4, r: 9, c: 4.5, p: 1 };
  function posKey(board, turn) { var k = turn + '|'; for (var r = 0; r < ROWS; r++) { for (var c = 0; c < COLS; c++) k += board[r][c] || '.'; } return k; }
  // 刚走完的棋子是否在"捉子": 新位置上能吃到无根子或价值更高的子(不含将军;兵未过河不算被捉)
  function movedChases(board, seat, tr, tc) {
    var ms = pseudoMoves(board, seat), me = board[tr][tc]; if (!me) return false;
    for (var i = 0; i < ms.length; i++) {
      var m = ms[i]; if (m.fr !== tr || m.fc !== tc) continue;
      var t = board[m.tr][m.tc]; if (!t) continue; var tt = t.toLowerCase(); if (tt === 'k') continue;
      if (tt === 'p') { var crossed = sideOf(t) === 1 ? m.tr <= 4 : m.tr >= 5; if (!crossed) continue; }
      // 对方是否保护该子: 假设被吃后,对方能否回吃
      var saved = board[m.tr][m.tc]; board[m.tr][m.tc] = board[tr][tc]; board[tr][tc] = null;
      var back = pseudoMoves(board, 3 - seat).some(function (q) { return q.tr === m.tr && q.tc === m.tc; });
      board[tr][tc] = board[m.tr][m.tc]; board[m.tr][m.tc] = saved;
      if (!back || PV[tt] > PV[me.toLowerCase()] + 0.01) return true;
    }
    return false;
  }
  // 重复局面裁决: 返回 null(不构成)或 {winner, reason}
  function judgeRepeat(s, seat) {
    var h = s.hist, n = h.length - 1, key = h[n].k, idx = [];
    for (var i = 0; i < n; i++) if (h[i].k === key) idx.push(i);
    if (idx.length < 2) return null;            // 同一局面出现第 3 次才裁决
    var j = idx[idx.length - 1], all = { 1: { chk: true, chase: true }, 2: { chk: true, chase: true } }, cnt = { 1: 0, 2: 0 };
    for (i = j + 1; i <= n; i++) { var e = h[i]; cnt[e.p]++; if (!e.chk) all[e.p].chk = false; if (!e.chk && !e.chs) all[e.p].chase = false; }
    var a = 3 - seat; // 对手
    var chkS = all[seat].chk && cnt[seat] > 0, chkO = all[a].chk && cnt[a] > 0;
    if (chkS && !chkO) return { winner: a, reason: 'Perpetual check - the checking side loses' };
    if (chkO && !chkS) return { winner: seat, reason: 'Perpetual check - the checking side loses' };
    if (chkS && chkO) return { winner: 3, reason: 'Both sides perpetually checking - draw' };
    var chsS = all[seat].chase && cnt[seat] > 0, chsO = all[a].chase && cnt[a] > 0;
    if (chsS && !chsO) return { winner: a, reason: 'Perpetual chase - the chasing side loses' };
    if (chsO && !chsS) return { winner: seat, reason: 'Perpetual chase - the chasing side loses' };
    return { winner: 3, reason: 'Position repeated three times - draw' };
  }
  function move(s, seat, mv) {
    if (s.over) return { ok: false, err: 'The game is over' };
    if (seat !== s.turn) return { ok: false, err: 'Not your turn' };
    if (!mv || ['fr', 'fc', 'tr', 'tc'].some(function (k) { return !Number.isInteger(mv[k]); })) return { ok: false, err: 'Invalid move' };
    var legal = legalMoves(s.board, seat), found = null;
    for (var i = 0; i < legal.length; i++) { var m = legal[i]; if (m.fr === mv.fr && m.fc === mv.fc && m.tr === mv.tr && m.tc === mv.tc) { found = m; break; } }
    if (!found) return { ok: false, err: 'Illegal move' };
    var cap = s.board[mv.tr][mv.tc];
    s.board[mv.tr][mv.tc] = s.board[mv.fr][mv.fc]; s.board[mv.fr][mv.fc] = null;
    s.last = { fr: mv.fr, fc: mv.fc, tr: mv.tr, tc: mv.tc, p: seat };
    s.count++; s.noCap = cap ? 0 : s.noCap + 1;
    var opp = 3 - seat;
    var oppMoves = legalMoves(s.board, opp);
    s.check = inCheck(s.board, opp);
    s.moves.push({ fr: mv.fr, fc: mv.fc, tr: mv.tr, tc: mv.tc });
    if (!s.hist.length) { var b0 = initialBoard(); s.hist.push({ k: posKey(b0, 1), p: 0, chk: false, chs: false }); }
    var chased = !s.check && movedChases(s.board, seat, mv.tr, mv.tc);
    s.hist.push({ k: posKey(s.board, opp), p: seat, chk: s.check, chs: chased });
    var rep = oppMoves.length ? judgeRepeat(s, seat) : null;
    if (rep) { s.over = true; s.winner = rep.winner; s.reason = rep.reason; }
    else if (oppMoves.length === 0) { s.over = true; s.winner = seat; s.reason = s.check ? 'Checkmate' : 'Stalemate (no legal move) - loss'; }
    else if (s.noCap >= 120) { s.over = true; s.winner = 3; s.reason = 'Sixty moves without a capture - draw'; }
    else s.turn = opp;
    return { ok: true, capture: cap, check: s.check };
  }
  function resign(s, seat) { if (s.over) return; s.over = true; s.winner = 3 - seat; s.reason = 'Opponent resigned / left'; }
  function view(s) { var v = {}; for (var k in s) if (k !== 'hist') v[k] = s[k]; return v; }
  // 若 seat 走 mv 会被规则判负(长将/长捉),返回 true(用于 AI 避让)
  function wouldLoseByRule(s, seat, mv) {
    var c = { board: s.board.map(function (r) { return r.slice(); }), turn: s.turn, winner: 0, over: false, reason: '', check: false, noCap: s.noCap, count: s.count, last: s.last, moves: s.moves.slice(), hist: s.hist.slice() };
    var r = move(c, seat, mv); return !!(r.ok && c.over && c.winner === 3 - seat && /Perpetual/.test(c.reason));
  }
  var API = { id: 'xiangqi', wouldLoseByRule: wouldLoseByRule, judgeRepeat: judgeRepeat, name: 'Chinese Chess', ROWS: ROWS, COLS: COLS, newGame: newGame, move: move, resign: resign, view: view,
    pseudoMoves: pseudoMoves, legalMoves: legalMoves, legalMovesFrom: legalMovesFrom, inCheck: inCheck, findKing: findKing, sideOf: sideOf, initialBoard: initialBoard };
  if (typeof module !== 'undefined' && module.exports) module.exports = API; else (self.GH = self.GH || {}).Xiangqi = API;
})();
