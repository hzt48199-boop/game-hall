/* 自动生成(tools/build.js): AI Worker 包 */
(function () {
  var GH = {}, self = { GH: GH }, require, module, exports;
/* ---- gomoku ---- */
/* 五子棋规则引擎(自由规则:五连及以上(含长连)即胜,无禁手) */
(function () {
  var N = 15;
  var DIRS = [[1, 0], [0, 1], [1, 1], [1, -1]];
  function newGame() {
    return { game: 'gomoku', n: N, board: new Array(N * N).fill(0), turn: 1, winner: 0, over: false, moves: [], reason: '', winLine: null };
  }
  function inb(x, y) { return x >= 0 && y >= 0 && x < N && y < N; }
  // 以(x,y)为中心找出同色连线,>=5 返回连线坐标数组,否则 null
  function findLine(board, x, y, p) {
    for (var d = 0; d < 4; d++) {
      var dx = DIRS[d][0], dy = DIRS[d][1];
      var cells = [[x, y]];
      for (var s = -1; s <= 1; s += 2) {
        var k = 1;
        while (true) {
          var nx = x + dx * k * s, ny = y + dy * k * s;
          if (!inb(nx, ny) || board[ny * N + nx] !== p) break;
          cells.push([nx, ny]); k++;
        }
      }
      if (cells.length >= 5) return cells;
    }
    return null;
  }
  function move(s, seat, mv) {
    if (s.over) return { ok: false, err: 'The game is over' };
    if (seat !== s.turn) return { ok: false, err: 'Not your turn' };
    if (!mv || !Number.isInteger(mv.x) || !Number.isInteger(mv.y) || !inb(mv.x, mv.y)) return { ok: false, err: 'Invalid position' };
    if (s.board[mv.y * N + mv.x] !== 0) return { ok: false, err: 'That point is already taken' };
    s.board[mv.y * N + mv.x] = seat;
    s.moves.push({ x: mv.x, y: mv.y, p: seat });
    var line = findLine(s.board, mv.x, mv.y, seat);
    if (line) { s.over = true; s.winner = seat; s.winLine = line; s.reason = line.length > 5 ? 'Wins with an overline' : 'Wins with five in a row'; }
    else if (s.moves.length >= N * N) { s.over = true; s.winner = 3; s.reason = 'Board full - draw'; }
    else s.turn = 3 - seat;
    return { ok: true };
  }
  function resign(s, seat) { if (s.over) return; s.over = true; s.winner = 3 - seat; s.reason = 'Opponent resigned / left'; }
  function view(s) { return s; }
  var API = { id: 'gomoku', name: 'Gomoku', N: N, newGame: newGame, move: move, resign: resign, view: view, findLine: findLine, inb: inb };
  if (typeof module !== 'undefined' && module.exports) module.exports = API; else (self.GH = self.GH || {}).Gomoku = API;
})();

/* ---- xiangqi ---- */
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

/* ---- luzhanqi ---- */
/* 军棋(陆战棋)规则引擎。棋盘 12 行 x 5 列。座位1在下半(行6-11),座位2在上半(行0-5)。
   棋子: S司令 J军长 D师长 R旅长 T团长 B营长 C连长 L排长 E工兵 X炸弹 M地雷 F军旗
   布阵 layout: 长度25的数组,按 STATIONS 顺序(己方视角: r'=0 为最前排, r'=5 为大本营排; c' 为屏幕列)。 */
(function () {
  var ROWS = 12, COLS = 5;
  var TYPES = {
    S: { n: 'Marshal', r: 9, c: 1, v: 100 }, J: { n: 'General', r: 8, c: 1, v: 80 }, D: { n: 'Maj. General', r: 7, c: 2, v: 70 },
    R: { n: 'Brigadier', r: 6, c: 2, v: 60 }, T: { n: 'Colonel', r: 5, c: 2, v: 50 }, B: { n: 'Major', r: 4, c: 2, v: 40 },
    C: { n: 'Captain', r: 3, c: 3, v: 30 }, L: { n: 'Lieutenant', r: 2, c: 3, v: 20 }, E: { n: 'Engineer', r: 1, c: 3, v: 25 },
    X: { n: 'Bomb', r: 0, c: 2, v: 45 }, M: { n: 'Mine', r: 0, c: 3, v: 30 }, F: { n: 'Flag', r: 0, c: 1, v: 1000 }
  };
  var CAMPS = {}; [[2, 1], [2, 3], [3, 2], [4, 1], [4, 3], [9, 1], [9, 3], [8, 2], [7, 1], [7, 3]].forEach(function (p) { CAMPS[p[0] * 5 + p[1]] = 1; });
  var HQS = {}; [[0, 1], [0, 3], [11, 1], [11, 3]].forEach(function (p) { HQS[p[0] * 5 + p[1]] = 1; });
  function isCamp(r, c) { return !!CAMPS[r * 5 + c]; }
  function isHQ(r, c) { return !!HQS[r * 5 + c]; }
  var RAIL_ROWS = { 1: 1, 5: 1, 6: 1, 10: 1 };
  function railNode(r, c) { return !!RAIL_ROWS[r] || ((c === 0 || c === 4) && r >= 1 && r <= 10) || (c === 2 && (r === 5 || r === 6)); }
  function railEdge(r1, c1, r2, c2) {
    if (r1 === r2 && Math.abs(c1 - c2) === 1) return !!RAIL_ROWS[r1];
    if (c1 === c2 && Math.abs(r1 - r2) === 1) {
      var m = Math.min(r1, r2);
      if (c1 === 0 || c1 === 4) return m >= 1 && m <= 9;
      if (c1 === 2) return m === 5;
    }
    return false;
  }
  function inb(r, c) { return r >= 0 && r < ROWS && c >= 0 && c < COLS; }
  // 己方视角站点
  var STATIONS = [];
  (function () {
    var campR = { '1,1': 1, '1,3': 1, '2,2': 1, '3,1': 1, '3,3': 1 };
    for (var r = 0; r < 6; r++) for (var c = 0; c < 5; c++) if (!campR[r + ',' + c]) STATIONS.push([r, c]);
  })();
  function absPos(seat, rp, cp) { return seat === 1 ? [6 + rp, cp] : [5 - rp, 4 - cp]; }
  var COUNTS = { S: 1, J: 1, D: 2, R: 2, T: 2, B: 2, C: 3, L: 3, E: 3, X: 2, M: 3, F: 1 };

  function validLayout(layout) {
    if (!Array.isArray(layout) || layout.length !== 25) return false;
    var cnt = {}, i;
    for (i = 0; i < 25; i++) {
      var t = layout[i];
      if (typeof t !== 'string' || !COUNTS[t]) return false;
      cnt[t] = (cnt[t] || 0) + 1;
      var st = STATIONS[i];
      if (t === 'F' && !(st[0] === 5 && (st[1] === 1 || st[1] === 3))) return false;
      if (t === 'M' && st[0] < 4) return false;
      if (t === 'X' && st[0] === 0) return false;
    }
    for (var k in COUNTS) if (cnt[k] !== COUNTS[k]) return false;
    return true;
  }
  function shuffle(a, rng) { for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(rng() * (i + 1)); var t = a[i]; a[i] = a[j]; a[j] = t; } return a; }
  function randomLayout(rng) {
    rng = rng || Math.random;
    var layout = new Array(25).fill(null), i;
    var hq = []; STATIONS.forEach(function (s, idx) { if (s[0] === 5 && (s[1] === 1 || s[1] === 3)) hq.push(idx); });
    layout[hq[Math.floor(rng() * 2)]] = 'F';
    var back = []; STATIONS.forEach(function (s, idx) { if (s[0] >= 4 && layout[idx] === null) back.push(idx); });
    shuffle(back, rng).slice(0, 3).forEach(function (idx) { layout[idx] = 'M'; });
    var nf = []; STATIONS.forEach(function (s, idx) { if (s[0] >= 1 && layout[idx] === null) nf.push(idx); });
    shuffle(nf, rng).slice(0, 2).forEach(function (idx) { layout[idx] = 'X'; });
    var rest = []; for (var k in COUNTS) { if (k === 'F' || k === 'M' || k === 'X') continue; for (i = 0; i < COUNTS[k]; i++) rest.push(k); }
    shuffle(rest, rng);
    for (i = 0; i < 25; i++) if (layout[i] === null) layout[i] = rest.pop();
    return layout;
  }
  function newGame() {
    var b = []; for (var r = 0; r < ROWS; r++) b.push(new Array(COLS).fill(null));
    return { game: 'luzhanqi', phase: 'setup', board: b, layouts: [null, null, null], ready: [false, false], turn: 1, winner: 0, over: false, reason: '', dead: [], last: null, count: 0, info: null, log: [] };
  }
  function setup(s, seat, layout) {
    if (s.phase !== 'setup') return { ok: false, err: 'Not in the setup phase' };
    if (!validLayout(layout)) return { ok: false, err: 'Invalid setup (flag in a headquarters, mines in the back two rows, bombs not in the front row)' };
    s.layouts[seat] = layout.slice(); s.ready[seat - 1] = true;
    if (s.layouts[1] && s.layouts[2]) {
      [1, 2].forEach(function (p) {
        s.layouts[p].forEach(function (t, i) { var a = absPos(p, STATIONS[i][0], STATIONS[i][1]); s.board[a[0]][a[1]] = { t: t, p: p, mv: false }; });
      });
      s.phase = 'playing'; s.layouts = [null, null, null];
    }
    return { ok: true };
  }
  function movesFrom(board, r, c) {
    var pc = board[r][c], out = [], seen = {};
    if (!pc || pc.t === 'M' || pc.t === 'F' || pc.t === '?' && false) return out;
    if (isHQ(r, c)) return out;
    function tryAdd(tr, tc) {
      if (!inb(tr, tc)) return false;
      var d = board[tr][tc];
      if (d && d.p === pc.p) return false;
      if (d && isCamp(tr, tc)) return false;
      var key = tr * 5 + tc;
      if (!seen[key]) { seen[key] = 1; out.push({ fr: r, fc: c, tr: tr, tc: tc }); }
      return true;
    }
    var i, d4 = [[1, 0], [-1, 0], [0, 1], [0, -1]];
    for (i = 0; i < 4; i++) {
      var nr = r + d4[i][0], nc = c + d4[i][1];
      if (!inb(nr, nc)) continue;
      if (d4[i][0] !== 0 && Math.min(r, nr) === 5 && nc % 2 === 1) continue; // 河中只有三座桥(列0,2,4)
      tryAdd(nr, nc);
    }
    for (var dr = -1; dr <= 1; dr += 2) for (var dc = -1; dc <= 1; dc += 2) {
      var qr = r + dr, qc = c + dc;
      if (inb(qr, qc) && (isCamp(r, c) || isCamp(qr, qc))) tryAdd(qr, qc);
    }
    if (railNode(r, c)) {
      if (pc.t === 'E') {
        var vis = {}; vis[r * 5 + c] = 1; var q = [[r, c]];
        while (q.length) {
          var cur = q.shift();
          for (i = 0; i < 4; i++) {
            var rr = cur[0] + d4[i][0], cc = cur[1] + d4[i][1];
            if (!inb(rr, cc) || vis[rr * 5 + cc] || !railEdge(cur[0], cur[1], rr, cc)) continue;
            vis[rr * 5 + cc] = 1;
            var cell = board[rr][cc];
            if (!cell) { tryAdd(rr, cc); q.push([rr, cc]); }
            else if (cell.p !== pc.p) tryAdd(rr, cc);
          }
        }
      } else {
        for (i = 0; i < 4; i++) {
          var xr = r, xc = c;
          while (true) {
            var yr = xr + d4[i][0], yc = xc + d4[i][1];
            if (!inb(yr, yc) || !railEdge(xr, xc, yr, yc)) break;
            var cl = board[yr][yc];
            if (!cl) { tryAdd(yr, yc); xr = yr; xc = yc; continue; }
            if (cl.p !== pc.p) tryAdd(yr, yc);
            break;
          }
        }
      }
    }
    return out;
  }
  function legalMoves(s, seat) {
    var out = [];
    for (var r = 0; r < ROWS; r++) for (var c = 0; c < COLS; c++) { var p = s.board[r][c]; if (p && p.p === seat) out = out.concat(movesFrom(s.board, r, c)); }
    return out;
  }
  function legalMovesFrom(s, seat, r, c) { var p = s.board[r][c]; return p && p.p === seat ? movesFrom(s.board, r, c) : []; }
  // 战斗结果: 'win'(攻方胜) 'lose'(攻方负) 'both'(同归于尽) 'flag'(夺旗)
  function battle(a, d) {
    if (d === 'F') return 'flag';
    if (a === 'X' || d === 'X') return 'both';
    if (d === 'M') return a === 'E' ? 'win' : 'lose';
    var ra = TYPES[a].r, rd = TYPES[d].r;
    return ra > rd ? 'win' : ra === rd ? 'both' : 'lose';
  }
  function move(s, seat, mv) {
    if (s.over) return { ok: false, err: 'The game is over' };
    if (s.phase !== 'playing') return { ok: false, err: 'Still in the setup phase' };
    if (seat !== s.turn) return { ok: false, err: 'Not your turn' };
    if (!mv || ['fr', 'fc', 'tr', 'tc'].some(function (k) { return !Number.isInteger(mv[k]); }) || !inb(mv.fr, mv.fc) || !inb(mv.tr, mv.tc)) return { ok: false, err: 'Invalid move' };
    var att = s.board[mv.fr][mv.fc];
    if (!att || att.p !== seat) return { ok: false, err: 'That is not your piece' };
    var ok = movesFrom(s.board, mv.fr, mv.fc).some(function (m) { return m.tr === mv.tr && m.tc === mv.tc; });
    if (!ok) return { ok: false, err: 'Illegal move' };
    var def = s.board[mv.tr][mv.tc], outcome = 'move';
    s.board[mv.fr][mv.fc] = null;
    if (!def) { s.board[mv.tr][mv.tc] = att; att.mv = true; }
    else {
      outcome = battle(att.t, def.t);
      if (outcome === 'win' || outcome === 'flag') { s.board[mv.tr][mv.tc] = att; att.mv = true; s.dead.push({ p: def.p, t: def.t }); }
      else if (outcome === 'lose') { s.dead.push({ p: att.p, t: att.t }); def.mv = def.mv; }
      else { s.board[mv.tr][mv.tc] = null; s.dead.push({ p: att.p, t: att.t }); s.dead.push({ p: def.p, t: def.t }); }
    }
    s.count++;
    s.last = { fr: mv.fr, fc: mv.fc, tr: mv.tr, tc: mv.tc, p: seat };
    s.info = def ? { outcome: outcome, att: att.t, def: def.t, attP: seat } : null;
    // 公开日志(仅含阵亡方身份,存活者身份不记录),供 AI 做对手棋子推断
    s.log.push({ p: seat, fr: mv.fr, fc: mv.fc, tr: mv.tr, tc: mv.tc, out: def ? outcome : 'move',
      da: def && (outcome === 'lose' || outcome === 'both') ? att.t : null, dd: def && (outcome === 'win' || outcome === 'flag' || outcome === 'both') ? def.t : null });
    var opp = 3 - seat;
    if (outcome === 'flag') { s.over = true; s.winner = seat; s.reason = 'Flag captured'; }
    else if (legalMoves(s, opp).length === 0) { s.over = true; s.winner = seat; s.reason = 'The opponent has no movable piece'; }
    else if (legalMoves(s, seat).length === 0) { s.over = true; s.winner = opp; s.reason = 'You have no movable piece'; }
    else if (s.count >= 600) { s.over = true; s.winner = 3; s.reason = 'Too many moves - draw'; }
    else s.turn = opp;
    return { ok: true, outcome: outcome, info: s.info };
  }
  function resign(s, seat) { if (s.over) return; s.over = true; s.winner = 3 - seat; s.reason = 'Opponent resigned / left'; }
  // 对座位 seat 隐藏对方棋子身份(结束后全部公开)
  function view(s, seat) {
    var v = JSON.parse(JSON.stringify(s));
    v.layouts = [null, null, null];
    if (v.info && !s.over) { // 只公开战斗中"阵亡"一方的身份,存活者对对方保持隐藏
      var i = v.info, attDies = i.outcome === 'lose' || i.outcome === 'both', defDies = i.outcome === 'win' || i.outcome === 'flag' || i.outcome === 'both';
      if (seat !== i.attP && !attDies) i.att = '?';
      if (seat === i.attP && !defDies) i.def = '?';
    }
    if (!s.over) for (var r = 0; r < ROWS; r++) for (var c = 0; c < COLS; c++) { var p = v.board[r][c]; if (p && p.p !== seat) p.t = '?'; }
    return v;
  }
  var API = { id: 'luzhanqi', name: 'Luzhanqi', ROWS: ROWS, COLS: COLS, TYPES: TYPES, COUNTS: COUNTS, STATIONS: STATIONS, newGame: newGame, setup: setup, move: move, resign: resign, view: view,
    legalMoves: legalMoves, legalMovesFrom: legalMovesFrom, movesFrom: movesFrom, battle: battle, validLayout: validLayout, randomLayout: randomLayout, absPos: absPos,
    isCamp: isCamp, isHQ: isHQ, railNode: railNode, railEdge: railEdge };
  if (typeof module !== 'undefined' && module.exports) module.exports = API; else (self.GH = self.GH || {}).Luzhanqi = API;
})();

/* ---- doudizhu ---- */
/* 斗地主规则引擎(3 人,纯虚拟积分)。座位 1..3。
   牌用 0..53 的整数: 0..51 → 点数 3..15(3..10,J=11,Q=12,K=13,A=14,2=15)各 4 花色; 52=小王(16) 53=大王(17)。
   叫分: 每人依次叫一次(0=不叫,1/2/3 须高于当前最高叫分),叫 3 分立即成为地主;三人都不叫则重新发牌。
   牌型: 单张 对子 三张 三带一 三带二 顺子(>=5) 连对(>=3) 飞机(>=2 个连续三张,可带同数量单张或对子) 四带二(两单/两对) 炸弹 火箭。
   计分: 底分 × 叫分 × 2^(炸弹数+火箭数) × (春天/反春 ×2);地主赢两个农民各付、输各得。 */
(function () {
  var NAMES = { 3: '3', 4: '4', 5: '5', 6: '6', 7: '7', 8: '8', 9: '9', 10: '10', 11: 'J', 12: 'Q', 13: 'K', 14: 'A', 15: '2', 16: 'Small Joker', 17: 'Big Joker' };
  function rankOf(id) { return id < 52 ? 3 + (id >> 2) : 16 + (id - 52); }
  function suitOf(id) { return id < 52 ? id & 3 : 4; }
  function sortHand(h) { return h.sort(function (a, b) { return rankOf(b) - rankOf(a) || a - b; }); }
  function counts(cards) { var c = {}; for (var i = 0; i < cards.length; i++) { var r = rankOf(cards[i]); c[r] = (c[r] || 0) + 1; } return c; }
  function ranksSorted(c) { return Object.keys(c).map(Number).sort(function (a, b) { return a - b; }); }
  function consecutive(rs) { for (var i = 1; i < rs.length; i++) if (rs[i] !== rs[i - 1] + 1) return false; return true; }

  /* 判定牌型: 返回 {type, rank, len, n} 或 null。rank=用于比较大小的主点数,len=顺子/连对/飞机的组数 */
  function classify(cards) {
    var n = cards.length; if (!n) return null;
    var c = counts(cards), rs = ranksSorted(c), nr = rs.length, i, k;
    if (n === 1) return { type: 'single', rank: rs[0], len: 1, n: 1 };
    if (n === 2) { if (nr === 1) return { type: 'pair', rank: rs[0], len: 1, n: 2 }; if (c[16] && c[17]) return { type: 'rocket', rank: 99, len: 1, n: 2 }; return null; }
    if (n === 3) return nr === 1 ? { type: 'triple', rank: rs[0], len: 1, n: 3 } : null;
    if (n === 4) {
      if (nr === 1) return { type: 'bomb', rank: rs[0], len: 1, n: 4 };
      for (i = 0; i < nr; i++) if (c[rs[i]] === 3) return { type: 'triple1', rank: rs[i], len: 1, n: 4 };
      return null;
    }
    // 顺子
    if (n >= 5 && nr === n && rs[nr - 1] <= 14 && consecutive(rs)) return { type: 'straight', rank: rs[nr - 1], len: n, n: n };
    // 连对
    if (n >= 6 && n % 2 === 0 && nr === n / 2 && rs[nr - 1] <= 14 && consecutive(rs) && rs.every(function (r) { return c[r] === 2; })) return { type: 'pairstraight', rank: rs[nr - 1], len: nr, n: n };
    if (n === 5) { if (nr === 2 && ((c[rs[0]] === 3 && c[rs[1]] === 2) || (c[rs[0]] === 2 && c[rs[1]] === 3))) return { type: 'triple2', rank: c[rs[0]] === 3 ? rs[0] : rs[1], len: 1, n: 5 }; return null; }
    // 四带二
    for (i = 0; i < nr; i++) if (c[rs[i]] === 4) {
      var rest = []; rs.forEach(function (r) { if (r !== rs[i]) rest.push(r); });
      var restN = n - 4;
      if (n === 6) return { type: 'four2', rank: rs[i], len: 1, n: 6 };       // 带两张单牌(含一对)
      if (n === 8 && rest.every(function (r) { return c[r] % 2 === 0; }) && restN === 4) return { type: 'four22', rank: rs[i], len: 1, n: 8 };
    }
    // 飞机: 以最高的合法起点判定
    var best = null;
    var tr = rs.filter(function (r) { return c[r] >= 3 && r <= 14; });
    for (var wing = 0; wing <= 2; wing++) {
      var per = 3 + (wing === 0 ? 0 : wing === 1 ? 1 : 2);
      if (n % per !== 0) continue; var kk = n / per; if (kk < 2) continue;
      for (var st = 0; st + kk <= tr.length; st++) {
        var run = tr.slice(st, st + kk); if (!consecutive(run)) continue;
        var remain = n - 3 * kk, ok = true;
        if (wing === 2) { // 剩余牌必须全是成对的
          var cc = {}; for (var q in c) cc[q] = c[q]; run.forEach(function (r) { cc[r] -= 3; });
          for (var q2 in cc) if (cc[q2] % 2 !== 0) ok = false;
          if (ok && Object.keys(cc).reduce(function (a, q3) { return a + cc[q3] / 2; }, 0) !== kk) ok = false;
        }
        if (ok && wing === 1) { /* 翼为 kk 张任意牌 */ }
        if (ok) { var cand = { type: wing === 0 ? 'plane' : wing === 1 ? 'plane1' : 'plane2', rank: run[run.length - 1], len: kk, n: n }; if (!best || cand.rank > best.rank) best = cand; }
      }
    }
    return best;
  }
  function isBombish(t) { return t === 'bomb' || t === 'rocket'; }
  /* play 能否压过 last(last 为 classify 结果,null 表示自由出牌) */
  function beats(play, last) {
    if (!play) return false; if (!last) return true;
    if (last.type === 'rocket') return false;
    if (play.type === 'rocket') return true;
    if (play.type === 'bomb') return last.type !== 'bomb' || play.rank > last.rank;
    if (last.type === 'bomb') return false;
    return play.type === last.type && play.n === last.n && play.len === last.len && play.rank > last.rank;
  }

  function shuffleDeck(rng) { var d = []; for (var i = 0; i < 54; i++) d.push(i); for (var j = 53; j > 0; j--) { var k = Math.floor(rng() * (j + 1)), t = d[j]; d[j] = d[k]; d[k] = t; } return d; }
  function deal(s, rng) {
    var d = shuffleDeck(rng);
    s.hands = [null, sortHand(d.slice(0, 17)), sortHand(d.slice(17, 34)), sortHand(d.slice(34, 51))];
    s.bottom = sortHand(d.slice(51, 54));
    s.bid = { bids: [null, null, null, null], high: 0, highSeat: 0, count: 0 };
    s.firstBidder = 1 + Math.floor(rng() * 3); s.turn = s.firstBidder;
    s.event = { t: 'deal', seat: 0 }; s.seq++;
  }
  function newGame(opts) {
    opts = opts || {}; var rng = opts.rng || Math.random;
    var s = { game: 'doudizhu', phase: 'bid', hands: null, bottom: [], bid: null, landlord: 0, turn: 1, firstBidder: 1, last: null, passes: 0, plays: [], mult: 1, bombs: 0, spring: false,
      winner: 0, winners: [], over: false, reason: '', scores: [0, 0, 0, 0], base: opts.base || 1, redeals: 0, seq: 0, event: null, counts: [0, 17, 17, 17], playedCount: [0, 0, 0, 0], _rng: rng };
    deal(s, rng); return s;
  }
  function removeCards(hand, cards) {
    var h = hand.slice();
    for (var i = 0; i < cards.length; i++) { var k = h.indexOf(cards[i]); if (k < 0) return null; h.splice(k, 1); }
    return h;
  }
  function finish(s, winSeat) {
    s.over = true; s.phase = 'over'; var ll = s.landlord, landlordWin = winSeat === ll;
    var farmerPlays = 0, landlordPlays = s.playedCount[ll];
    for (var p = 1; p <= 3; p++) if (p !== ll) farmerPlays += s.playedCount[p];
    var spring = false;
    if (landlordWin && farmerPlays === 0) spring = true;           // 春天
    if (!landlordWin && landlordPlays === 1) spring = true;         // 反春(地主只出过一手)
    s.spring = spring;
    var m = s.mult * (spring ? 2 : 1), per = s.base * s.bid.high * m;
    s.finalMult = s.bid.high * m;
    s.winners = []; for (var q = 1; q <= 3; q++) if ((q === ll) === landlordWin) s.winners.push(q);
    s.winner = winSeat;
    for (q = 1; q <= 3; q++) {
      if (q === ll) s.scores[q] = landlordWin ? 2 * per : -2 * per; else s.scores[q] = landlordWin ? -per : per;
    }
    s.reason = (landlordWin ? 'Landlord wins' : 'Farmers win') + (spring ? (landlordWin ? ' (Spring x2)' : ' (Reverse spring x2)') : '') + ', multiplier ' + s.finalMult;
    s.event = { t: 'win', seat: winSeat }; s.seq++;
  }
  function move(s, seat, mv) {
    if (s.over) return { ok: false, err: 'The hand is over' };
    if (seat !== s.turn) return { ok: false, err: 'Not your turn' };
    if (!mv || typeof mv !== 'object') return { ok: false, err: 'Invalid action' };
    if (s.phase === 'bid') {
      var b = mv.bid; if (!Number.isInteger(b) || b < 0 || b > 3) return { ok: false, err: 'Invalid bid' };
      if (b !== 0 && b <= s.bid.high) return { ok: false, err: 'Bid must be higher than ' + s.bid.high };
      s.bid.bids[seat] = b; s.bid.count++; if (b > 0) { s.bid.high = b; s.bid.highSeat = seat; }
      s.event = { t: 'bid', seat: seat, v: b }; s.seq++;
      if (b === 3 || s.bid.count >= 3) {
        if (s.bid.high === 0) { // 流局重新发牌
          s.redeals++; deal(s, s._rng || Math.random); s.event = { t: 'redeal', seat: 0 }; return { ok: true, kind: 'redeal' };
        }
        s.landlord = s.bid.highSeat; s.hands[s.landlord] = sortHand(s.hands[s.landlord].concat(s.bottom)); s.phase = 'play'; s.turn = s.landlord;
        s.counts = [0, s.hands[1].length, s.hands[2].length, s.hands[3].length]; s.last = null; s.passes = 0;
        s.event = { t: 'landlord', seat: s.landlord }; s.seq++;
        return { ok: true, kind: 'landlord' };
      }
      s.turn = seat % 3 + 1; return { ok: true, kind: 'bid' };
    }
    // 出牌阶段
    if (mv.pass) {
      if (!s.last) return { ok: false, err: 'You lead - you must play' };
      s.passes++; s.plays.push({ seat: seat, pass: true }); s.event = { t: 'pass', seat: seat }; s.seq++;
      if (s.passes >= 2) { s.last = null; s.passes = 0; }
      s.turn = seat % 3 + 1; return { ok: true, kind: 'pass' };
    }
    var cards = mv.cards; if (!Array.isArray(cards) || !cards.length || cards.length > 20 || cards.some(function (x) { return !Number.isInteger(x) || x < 0 || x > 53; })) return { ok: false, err: 'Invalid play' };
    if (new Set(cards).size !== cards.length) return { ok: false, err: 'Invalid play' };
    var rest = removeCards(s.hands[seat], cards); if (!rest) return { ok: false, err: 'You do not have those cards' };
    var cl = classify(cards); if (!cl) return { ok: false, err: 'Not a valid combination' };
    if (s.last && !beats(cl, s.last.cl)) return { ok: false, err: 'That does not beat the last play' };
    var wasLast = !!s.last;
    s.hands[seat] = rest; s.counts[seat] = rest.length; s.playedCount[seat]++;
    s.last = { seat: seat, cards: sortHand(cards.slice()), cl: cl }; s.passes = 0;
    s.plays.push({ seat: seat, cards: s.last.cards, type: cl.type, lead: !wasLast });
    var kind = 'play';
    if (cl.type === 'bomb') { s.bombs++; s.mult *= 2; kind = 'bomb'; } else if (cl.type === 'rocket') { s.bombs++; s.mult *= 2; kind = 'rocket'; }
    s.event = { t: kind, seat: seat, type: cl.type }; s.seq++;
    if (!rest.length) { finish(s, seat); return { ok: true, kind: 'win' }; }
    s.turn = seat % 3 + 1; return { ok: true, kind: kind };
  }
  function resign(s, seat) { if (s.over) return; if (s.phase === 'bid') { s.over = true; s.phase = 'over'; s.reason = 'A player left'; s.winners = []; return; } var ll = s.landlord; finish(s, seat === ll ? (ll % 3 + 1) : ll); s.reason = 'A player left, ' + s.reason; }
  /* 视角: 只显示自己的手牌;其他人只给张数;地主确定后底牌公开 */
  function view(s, seat) {
    var v = {};
    for (var k in s) if (k !== '_rng' && k !== 'hands') v[k] = s[k];
    v.hands = [null, null, null, null];
    for (var p = 1; p <= 3; p++) v.hands[p] = (p === seat || s.over) ? s.hands[p].slice() : null;
    v.counts = [0, s.hands[1].length, s.hands[2].length, s.hands[3].length];
    if (s.phase === 'bid') v.bottom = [];
    return v;
  }
  /* ---- 出牌枚举(AI 与界面提示共用) ---- */
  function groupByRank(hand) { var g = {}; hand.forEach(function (id) { var r = rankOf(id); (g[r] = g[r] || []).push(id); }); return g; }
  function takeLowestKickers(g, excludeRanks, size, n) { // 选 n 个"组"(size=1 单张/2 对子)的最小可用牌
    var out = [], rs = Object.keys(g).map(Number).sort(function (a, b) { return a - b; });
    for (var i = 0; i < rs.length && out.length < n * size; i++) { var r = rs[i]; if (excludeRanks.indexOf(r) >= 0) continue; if (g[r].length >= size) { if (size === 1 || g[r].length >= 2) out = out.concat(g[r].slice(0, size)); } }
    return out.length === n * size ? out : null;
  }
  /* 枚举全部(带限制的)合法出牌。last=null 为领出。kickers 只取最小的若干种以限制数量。 */
  function genMoves(hand, last) {
    var g = groupByRank(hand), rs = Object.keys(g).map(Number).sort(function (a, b) { return a - b; }), out = [], i, j;
    var lastCl = last ? last.cl || last : null;
    function add(cards) { var cl = classify(cards); if (cl && beats(cl, lastCl)) out.push({ cards: cards, cl: cl }); }
    var want = lastCl ? lastCl.type : null;
    function can(t) { return !want || want === t || t === 'bomb' || t === 'rocket'; }
    if (can('single') && (!want || want === 'single')) rs.forEach(function (r) { add([g[r][0]]); });
    if (!want || want === 'pair') rs.forEach(function (r) { if (g[r].length >= 2) add(g[r].slice(0, 2)); });
    if (!want || want === 'triple') rs.forEach(function (r) { if (g[r].length >= 3) add(g[r].slice(0, 3)); });
    if (!want || want === 'triple1') rs.forEach(function (r) { if (g[r].length >= 3) { var seenK = 0; rs.forEach(function (k) { if (k !== r && seenK < 3) { seenK++; add(g[r].slice(0, 3).concat([g[k][0]])); } }); } });
    if (!want || want === 'triple2') rs.forEach(function (r) { if (g[r].length >= 3) { var seenK = 0; rs.forEach(function (k) { if (k !== r && g[k].length >= 2 && seenK < 3) { seenK++; add(g[r].slice(0, 3).concat(g[k].slice(0, 2))); } }); } });
    var runs = function (minLen, need, cap) { // 连续点数(<=14)的区间
      var res = []; for (var a = 0; a < rs.length; a++) { if (rs[a] > 14) break; var b = a, len = 0; while (b < rs.length && rs[b] <= 14 && (b === a || rs[b] === rs[b - 1] + 1) && g[rs[b]].length >= need) { len++; b++; if (len >= minLen) res.push([a, b]); } } return res; };
    if (!want || want === 'straight') runs(5, 1).forEach(function (ab) { var cs = []; for (var x = ab[0]; x < ab[1]; x++) cs.push(g[rs[x]][0]); if (!want || cs.length === lastCl.n) add(cs); });
    if (!want || want === 'pairstraight') runs(3, 2).forEach(function (ab) { var cs = []; for (var x = ab[0]; x < ab[1]; x++) cs = cs.concat(g[rs[x]].slice(0, 2)); if (!want || cs.length === lastCl.n) add(cs); });
    if (!want || want === 'plane' || want === 'plane1' || want === 'plane2') runs(2, 3).forEach(function (ab) {
      var k = ab[1] - ab[0], tri = [], trR = []; for (var x = ab[0]; x < ab[1]; x++) { tri = tri.concat(g[rs[x]].slice(0, 3)); trR.push(rs[x]); }
      if (!want || want === 'plane') add(tri);
      if (!want || want === 'plane1') { var w1 = takeLowestKickers(g, trR, 1, k); if (w1) add(tri.concat(w1)); }
      if (!want || want === 'plane2') { var w2 = takeLowestKickers(g, trR, 2, k); if (w2) add(tri.concat(w2)); }
    });
    if (!want || want === 'four2') rs.forEach(function (r) { if (g[r].length === 4) { var w = takeLowestKickers(g, [r], 1, 2); if (w) add(g[r].concat(w)); } });
    if (!want || want === 'four22') rs.forEach(function (r) { if (g[r].length === 4) { var w = takeLowestKickers(g, [r], 2, 2); if (w) add(g[r].concat(w)); } });
    rs.forEach(function (r) { if (g[r].length === 4) add(g[r].slice()); });
    if (g[16] && g[17]) add([g[16][0], g[17][0]]);
    return out;
  }
  var API = { id: 'doudizhu', name: 'Dou Dizhu', nSeats: 3, NAMES: NAMES, rankOf: rankOf, suitOf: suitOf, sortHand: sortHand, classify: classify, beats: beats, newGame: newGame, move: move, resign: resign, view: view,
    genMoves: genMoves, groupByRank: groupByRank, counts: counts, removeCards: removeCards, shuffleDeck: shuffleDeck };
  if (typeof module !== 'undefined' && module.exports) module.exports = API; else (self.GH = self.GH || {}).Doudizhu = API;
})();

/* ---- mahjong ---- */
/* 麻将规则引擎(4 人,简化国标风格,纯虚拟积分)。座位 1..4。
   牌 34 种(kind): 0-8 万, 9-17 筒, 18-26 条, 27-30 东南西北, 31-33 中发白; 共 136 张,无花牌。
   规则要点(详见 README): 可吃(仅下家)/碰/杠(明杠、暗杠、加杠);自摸或点炮胡;胡牌型=4 组+1 对、七对、十三幺;
   不设起胡番数(任何成牌即可胡,底 1 番);庄家(座位 dealer)先摸第 14 张;牌墙留 14 张,摸完即流局;不设抢杠胡、不设振听、一炮只能一人胡(按顺位)。
   状态机: phase 'discard'(turn 摸牌后须打出一张,或自摸/杠) → 'claim'(依次询问可胡/碰杠/吃的玩家) → 'over'。 */
(function () {
  var KN = ['1 Char', '2 Char', '3 Char', '4 Char', '5 Char', '6 Char', '7 Char', '8 Char', '9 Char', '1 Dot', '2 Dot', '3 Dot', '4 Dot', '5 Dot', '6 Dot', '7 Dot', '8 Dot', '9 Dot', '1 Bam', '2 Bam', '3 Bam', '4 Bam', '5 Bam', '6 Bam', '7 Bam', '8 Bam', '9 Bam', 'East', 'South', 'West', 'North', 'Red Dragon', 'Green Dragon', 'White Dragon'];
  var ORPHANS = [0, 8, 9, 17, 18, 26, 27, 28, 29, 30, 31, 32, 33];
  function isHonor(k) { return k >= 27; }
  function suitOf(k) { return k < 27 ? Math.floor(k / 9) : 3; }
  function isSimple(k) { return k < 27 && k % 9 !== 0 && k % 9 !== 8; }
  function toCounts(tiles) { var c = new Array(34).fill(0); for (var i = 0; i < tiles.length; i++) c[tiles[i]]++; return c; }
  function sortTiles(a) { return a.sort(function (x, y) { return x - y; }); }
  function next(seat) { return seat % 4 + 1; }

  /* ---- 胡牌判定 ---- */
  function setsOK(c, i) {
    while (i < 34 && c[i] === 0) i++;
    if (i >= 34) return true;
    if (c[i] >= 3) { c[i] -= 3; var ok = setsOK(c, i); c[i] += 3; if (ok) return true; }
    if (i < 27 && i % 9 <= 6 && c[i + 1] > 0 && c[i + 2] > 0) { c[i]--; c[i + 1]--; c[i + 2]--; var ok2 = setsOK(c, i); c[i]++; c[i + 1]++; c[i + 2]++; if (ok2) return true; }
    return false;
  }
  function stdWin(c) { for (var p = 0; p < 34; p++) if (c[p] >= 2) { c[p] -= 2; var ok = setsOK(c, 0); c[p] += 2; if (ok) return true; } return false; }
  function sevenPairs(c) { var n = 0; for (var i = 0; i < 34; i++) { if (c[i] === 2) n++; else if (c[i] !== 0) return false; } return n === 7; }
  function orphans13(c) { var pair = false; for (var i = 0; i < ORPHANS.length; i++) { var v = c[ORPHANS[i]]; if (v === 0) return false; if (v === 2) pair = true; else if (v !== 1) return false; } return pair; }
  /* c: 手牌计数(含和的那张); nMelds: 已碰吃杠组数 */
  function canWin(c, nMelds) {
    var total = 0; for (var i = 0; i < 34; i++) total += c[i];
    if (total !== 14 - 3 * nMelds) return false;
    if (nMelds === 0 && (sevenPairs(c) || orphans13(c))) return true;
    return stdWin(c);
  }
  /* 枚举全部标准分解: [{pair, sets:[{k:'seq'|'trip', t}]}] */
  function decompositions(c) {
    var out = [];
    function rec(i, sets, pair) {
      while (i < 34 && c[i] === 0) i++;
      if (i >= 34) { if (pair !== null) out.push({ pair: pair, sets: sets.slice() }); return; }
      if (c[i] >= 3) { c[i] -= 3; sets.push({ k: 'trip', t: i }); rec(i, sets, pair); sets.pop(); c[i] += 3; }
      if (i < 27 && i % 9 <= 6 && c[i + 1] > 0 && c[i + 2] > 0) { c[i]--; c[i + 1]--; c[i + 2]--; sets.push({ k: 'seq', t: i }); rec(i, sets, pair); sets.pop(); c[i]++; c[i + 1]++; c[i + 2]++; }
      if (pair === null && c[i] >= 2) { c[i] -= 2; rec(i, sets, i); c[i] += 2; }
    }
    rec(0, [], null); return out;
  }

  /* ---- 向听数(AI 用) ---- */
  function shantenNormal(c, nMelds) {
    var best = 8 - 2 * nMelds;
    function rec(i, m, t, p) {
      while (i < 34 && c[i] === 0) i++;
      if (i >= 34) { var tt = Math.min(t, 4 - m); var v = 8 - 2 * m - tt - p; if (v < best) best = v; return; }
      if (m + t > 4 + 1 && false) return;
      if (c[i] >= 3) { c[i] -= 3; rec(i, m + 1, t, p); c[i] += 3; }
      if (i < 27 && i % 9 <= 6 && c[i + 1] > 0 && c[i + 2] > 0) { c[i]--; c[i + 1]--; c[i + 2]--; rec(i, m + 1, t, p); c[i]++; c[i + 1]++; c[i + 2]++; }
      if (c[i] >= 2) { c[i] -= 2; if (!p) rec(i, m, t, 1); else rec(i, m, t + 1, p); c[i] += 2; }
      if (i < 27) {
        if (i % 9 <= 7 && c[i + 1] > 0) { c[i]--; c[i + 1]--; rec(i, m, t + 1, p); c[i]++; c[i + 1]++; }
        if (i % 9 <= 6 && c[i + 2] > 0) { c[i]--; c[i + 2]--; rec(i, m, t + 1, p); c[i]++; c[i + 2]++; }
      }
      var keep = c[i]; c[i] = 0; rec(i + 1, m, t, p); c[i] = keep; // 放弃该种牌
    }
    rec(0, nMelds, 0, 0); return best;
  }
  function shanten(c, nMelds) {
    var s = shantenNormal(c, nMelds);
    if (nMelds === 0) {
      var pairs = 0, kinds = 0, i; for (i = 0; i < 34; i++) { if (c[i] >= 2) pairs++; if (c[i] > 0) kinds++; }
      var sp = 6 - pairs + Math.max(0, 7 - kinds); if (sp < s) s = sp;
      var ok = 0, hasPair = 0; for (i = 0; i < ORPHANS.length; i++) { if (c[ORPHANS[i]] > 0) ok++; if (c[ORPHANS[i]] > 1) hasPair = 1; }
      var so = 13 - ok - hasPair; if (so < s) s = so;
    }
    return s;
  }

  /* ---- 算番 ---- */
  function scoreHand(s, seat, c, zimo, lastTile) {
    var melds = s.melds[seat], nM = melds.length, i, items = [];
    var menqing = melds.every(function (m) { return m.type === 'ankong'; });
    var seatWind = 27 + ((seat - s.dealer + 4) % 4), roundWind = 27;
    var all = c.slice(); melds.forEach(function (m) { m.tiles.forEach(function (t) { all[t]++; }); });
    function addItem(n, f) { items.push([n, f]); }
    var best = null;
    function finish(list) { var tot = 0; list.forEach(function (x) { tot += x[1]; }); if (!best || tot > best.fan) best = { fan: tot, items: list }; }
    function common(list) {
      var suits = {}, honors = 0, any = 0; for (var k = 0; k < 34; k++) if (all[k]) { any++; if (k >= 27) honors++; else suits[suitOf(k)] = 1; }
      var ns = Object.keys(suits).length;
      if (ns === 0) list.push(['All Honors', 6]); else if (ns === 1 && honors === 0) list.push(['Full Flush', 4]); else if (ns === 1) list.push(['Half Flush', 2]);
      var simple = true; for (var q = 0; q < 34; q++) if (all[q] && !isSimple(q)) simple = false; if (simple) list.push(['All Simples', 1]);
      if (zimo) list.push(['Self-draw', 1]);
      melds.forEach(function (m) { if (m.type === 'ankong') list.push(['Concealed Kong', 2]); else if (m.type === 'kong' || m.type === 'addkong') list.push(['Exposed Kong', 1]); });
      if (zimo && s.afterKong) list.push(['Win after Kong', 1]);
      if (lastTile) list.push([zimo ? 'Last Tile Draw' : 'Last Discard Win', 1]);
    }
    if (nM === 0 && orphans13(c)) { finish([['Thirteen Orphans', 10]].concat(zimo ? [['Self-draw', 1]] : [])); }
    if (nM === 0 && sevenPairs(c)) { var l7 = [['Seven Pairs', 3]]; common(l7); finish(l7); }
    var ds = decompositions(c.slice());
    ds.forEach(function (d) {
      var list = [['Basic Win', 1]]; common(list);
      if (menqing) list.push(['Concealed Hand', 1]);
      var sets = d.sets.slice(); melds.forEach(function (m) { sets.push(m.type === 'chi' ? { k: 'seq', t: m.tiles[0] } : { k: 'trip', t: m.tiles[0] }); });
      var allTrip = sets.every(function (x) { return x.k === 'trip'; }), allSeq = sets.every(function (x) { return x.k === 'seq'; });
      var pairVal = d.pair >= 31 || d.pair === seatWind || d.pair === roundWind;
      if (allTrip) list.push(['All Pongs', 2]);
      if (allSeq && !pairVal) list.push(['All Chows', 1]);
      var dr = 0; sets.forEach(function (x) { if (x.k === 'trip') { if (x.t >= 31) { dr++; list.push(['Dragon Pong', 1]); } if (x.t === seatWind) list.push(['Seat Wind Pong', 1]); if (x.t === roundWind) list.push(['Round Wind Pong', 1]); } });
      if (dr === 3) list.push(['Big Three Dragons', 5]); else if (dr === 2 && d.pair >= 31) list.push(['Small Three Dragons', 2]);
      for (var su = 0; su < 3; su++) { var has = [0, 3, 6].every(function (o) { return sets.some(function (x) { return x.k === 'seq' && x.t === su * 9 + o; }); }); if (has) { list.push(['Pure Straight', 2]); break; } }
      finish(list);
    });
    return best || { fan: 1, items: [['Basic Win', 1]] };
  }

  /* ---- 状态机 ---- */
  function newGame(opts) {
    opts = opts || {}; var rng = opts.rng || Math.random, dealer = opts.dealer || 1;
    var wall = []; for (var k = 0; k < 34; k++) for (var j = 0; j < 4; j++) wall.push(k);
    for (var i = wall.length - 1; i > 0; i--) { var r = Math.floor(rng() * (i + 1)), t = wall[i]; wall[i] = wall[r]; wall[r] = t; }
    var s = { game: 'mahjong', phase: 'discard', wall: wall, hands: [null, [], [], [], []], melds: [null, [], [], [], []], discards: [null, [], [], [], []], dealer: dealer, turn: dealer, drawn: -1,
      lastDiscard: null, claim: null, afterKong: false, over: false, winner: 0, winners: [], result: null, reason: '', scores: [0, 0, 0, 0, 0], seq: 0, event: null, wallCount: 0, count: 0, base: opts.base || 1 };
    for (var p = 1; p <= 4; p++) s.hands[p] = sortTiles(wall.splice(0, 13));
    var d = wall.shift(); s.hands[dealer].push(d); sortTiles(s.hands[dealer]); s.drawn = d;
    s.wallCount = wall.length; s.event = { t: 'deal', seat: 0 }; s.seq = 1; return s;
  }
  function chiOptions(hand, t) {
    var out = []; if (t >= 27) return out; var c = toCounts(hand), r = t % 9;
    if (r >= 2 && c[t - 2] && c[t - 1]) out.push([t - 2, t - 1]);
    if (r >= 1 && r <= 7 && c[t - 1] && c[t + 1]) out.push([t - 1, t + 1]);
    if (r <= 6 && c[t + 1] && c[t + 2]) out.push([t + 1, t + 2]);
    return out;
  }
  function computeClaims(s, from, t) {
    var q = [], seen = {}, y, i, order = [next(from), next(next(from)), next(next(next(from)))];
    var opts = {};
    order.forEach(function (y) {
      var o = {}, c = toCounts(s.hands[y]);
      c[t]++; if (canWin(c, s.melds[y].length)) o.hu = true; c[t]--;
      if (c[t] >= 2) o.pong = true; if (c[t] >= 3) o.kong = true;
      if (y === next(from)) { var ch = chiOptions(s.hands[y], t); if (ch.length) o.chi = ch; }
      if (Object.keys(o).length) opts[y] = o;
    });
    order.forEach(function (y) { if (opts[y] && opts[y].hu) { q.push({ seat: y, opts: opts[y] }); seen[y] = 1; } });
    order.forEach(function (y) { if (opts[y] && !seen[y] && (opts[y].pong || opts[y].kong)) { q.push({ seat: y, opts: opts[y] }); seen[y] = 1; } });
    order.forEach(function (y) { if (opts[y] && !seen[y]) { q.push({ seat: y, opts: opts[y] }); seen[y] = 1; } });
    return q;
  }
  function ev(s, t, seat, tile) { s.event = { t: t, seat: seat, tile: tile === undefined ? -1 : tile }; s.seq++; }
  function drawFor(s, seat, fromBack) {
    if (s.wall.length <= 14) { return endDraw(s); }
    var t = fromBack ? s.wall.pop() : s.wall.shift();
    s.hands[seat].push(t); sortTiles(s.hands[seat]); s.drawn = t; s.turn = seat; s.phase = 'discard'; s.claim = null; s.wallCount = s.wall.length;
    s.afterKong = !!fromBack; ev(s, 'draw', seat, t); return true;
  }
  function endDraw(s) {
    s.over = true; s.phase = 'over'; s.winner = 0; s.winners = []; s.reason = 'Draw (the wall is exhausted)'; s.result = { type: 'draw' }; s.claim = null; s.wallCount = s.wall.length; ev(s, 'drawgame', 0); return true;
  }
  function settle(s, seat, zimo, from, c) {
    var last = s.wall.length <= 14;
    var sc = scoreHand(s, seat, c, zimo, last), fan = sc.fan * s.base;
    s.over = true; s.phase = 'over'; s.winner = seat; s.winners = [seat]; s.claim = null;
    s.result = { type: zimo ? 'zimo' : 'ron', seat: seat, from: from || 0, fan: fan, items: sc.items };
    var p;
    if (zimo) { for (p = 1; p <= 4; p++) if (p !== seat) { s.scores[p] = -fan; s.scores[seat] += fan; } }
    else { s.scores[from] = -2 * fan; s.scores[seat] = 2 * fan; }
    s.reason = (zimo ? 'Self-draw' : 'Win on discard') + ' ' + fan + ' fan: ' + sc.items.map(function (x) { return x[0] + (x[1] > 1 ? x[1] : ''); }).join('; ');
    ev(s, zimo ? 'zimo' : 'hu', seat); s.wallCount = s.wall.length; return true;
  }
  function removeTiles(hand, tiles) { for (var i = 0; i < tiles.length; i++) { var k = hand.indexOf(tiles[i]); if (k < 0) return false; hand.splice(k, 1); } return true; }

  function options(s, seat) {
    if (s.over) return null;
    if (s.phase === 'discard') {
      if (s.turn !== seat) return null;
      var hand = s.hands[seat], c = toCounts(hand), o = { discard: true, hu: false, ankong: [], addkong: [] };
      o.hu = canWin(c, s.melds[seat].length);
      for (var k = 0; k < 34; k++) if (c[k] === 4) o.ankong.push(k);
      s.melds[seat].forEach(function (m) { if (m.type === 'pong' && c[m.tiles[0]] > 0) o.addkong.push(m.tiles[0]); });
      return o;
    }
    if (s.phase === 'claim') {
      if (s.claim.queue) { var q = s.claim.queue[0]; return q && q.seat === seat ? Object.assign({ pass: true }, q.opts) : null; }
      return s.claim.actor === seat && s.claim.opts ? Object.assign({ pass: true }, s.claim.opts) : null;
    }
    return null;
  }
  function move(s, seat, mv) {
    if (s.over) return { ok: false, err: 'The hand is over' };
    if (!mv || typeof mv.a !== 'string') return { ok: false, err: 'Invalid action' };
    var o = options(s, seat); if (!o) return { ok: false, err: 'Not your turn' };
    s.count++;
    var hand = s.hands[seat], c;
    if (s.phase === 'discard') {
      if (mv.a === 'discard') {
        var t = mv.tile; if (!Number.isInteger(t) || hand.indexOf(t) < 0) return { ok: false, err: 'You do not have that tile' };
        hand.splice(hand.indexOf(t), 1); s.discards[seat].push(t); s.lastDiscard = { seat: seat, tile: t }; s.drawn = -1; s.afterKong = false; ev(s, 'discard', seat, t);
        var q = computeClaims(s, seat, t);
        if (!q.length) { drawFor(s, next(seat)); return { ok: true, kind: s.over ? 'drawgame' : 'discard' }; }
        s.phase = 'claim'; s.claim = { tile: t, from: seat, queue: q }; s.turn = q[0].seat; return { ok: true, kind: 'discard' };
      }
      if (mv.a === 'hu') { if (!o.hu) return { ok: false, err: 'You cannot win now' }; settle(s, seat, true, 0, toCounts(hand)); return { ok: true, kind: 'zimo' }; }
      if (mv.a === 'ankong') { if (o.ankong.indexOf(mv.tile) < 0) return { ok: false, err: 'Cannot make a concealed kong with that' }; removeTiles(hand, [mv.tile, mv.tile, mv.tile, mv.tile]); s.melds[seat].push({ type: 'ankong', tiles: [mv.tile, mv.tile, mv.tile, mv.tile], from: seat }); ev(s, 'kong', seat, mv.tile); drawFor(s, seat, true); return { ok: true, kind: 'kong' }; }
      if (mv.a === 'addkong') { if (o.addkong.indexOf(mv.tile) < 0) return { ok: false, err: 'Cannot add a kong with that' }; removeTiles(hand, [mv.tile]); s.melds[seat].forEach(function (m) { if (m.type === 'pong' && m.tiles[0] === mv.tile) { m.type = 'addkong'; m.tiles.push(mv.tile); } }); ev(s, 'kong', seat, mv.tile); drawFor(s, seat, true); return { ok: true, kind: 'kong' }; }
      return { ok: false, err: 'You must discard now' };
    }
    // claim 阶段
    var cl = s.claim, tile = cl.tile, from = cl.from;
    if (mv.a === 'pass') {
      cl.queue.shift();
      if (!cl.queue.length) { drawFor(s, next(from)); return { ok: true, kind: 'pass' }; }
      s.turn = cl.queue[0].seat; s.seq++; return { ok: true, kind: 'pass' };
    }
    if (mv.a === 'hu') { if (!o.hu) return { ok: false, err: 'You cannot win now' }; c = toCounts(hand); c[tile]++; s.discards[from].pop(); settle(s, seat, false, from, c); return { ok: true, kind: 'hu' }; }
    if (mv.a === 'pong') { if (!o.pong) return { ok: false, err: 'Cannot pong' }; removeTiles(hand, [tile, tile]); s.discards[from].pop(); s.melds[seat].push({ type: 'pong', tiles: [tile, tile, tile], from: from }); return afterClaim(s, seat, 'pong', tile); }
    if (mv.a === 'kong') { if (!o.kong) return { ok: false, err: 'Cannot kong' }; removeTiles(hand, [tile, tile, tile]); s.discards[from].pop(); s.melds[seat].push({ type: 'kong', tiles: [tile, tile, tile, tile], from: from }); s.claim = null; s.lastDiscard = null; ev(s, 'kong', seat, tile); drawFor(s, seat, true); return { ok: true, kind: 'kong' }; }
    if (mv.a === 'chi') {
      var pair = mv.tiles; if (!Array.isArray(pair) || !o.chi || !o.chi.some(function (x) { return pair.length === 2 && x[0] === pair[0] && x[1] === pair[1]; })) return { ok: false, err: 'Cannot chow that way' };
      removeTiles(hand, pair); s.discards[from].pop(); s.melds[seat].push({ type: 'chi', tiles: sortTiles([pair[0], pair[1], tile]), from: from }); return afterClaim(s, seat, 'chi', tile);
    }
    return { ok: false, err: 'Invalid action' };
  }
  function afterClaim(s, seat, kind, tile) { s.phase = 'discard'; s.turn = seat; s.claim = null; s.drawn = -1; s.afterKong = false; s.lastDiscard = null; ev(s, kind, seat, tile); return { ok: true, kind: kind }; }
  function resign(s, seat) { if (s.over) return; s.over = true; s.phase = 'over'; s.winner = 0; s.winners = []; s.reason = 'A player left - hand void'; s.result = { type: 'abort' }; }
  function view(s, seat) {
    var v = {};
    for (var k in s) if (k !== 'wall' && k !== 'hands' && k !== 'claim') v[k] = s[k];
    v.hands = [null, null, null, null, null]; v.handCounts = [0, 0, 0, 0, 0];
    for (var p = 1; p <= 4; p++) { v.handCounts[p] = s.hands[p].length; v.hands[p] = (p === seat || s.over) ? s.hands[p].slice() : null; }
    v.wallCount = s.wall.length;
    if (s.claim) { var q = s.claim.queue ? s.claim.queue[0] : null; v.claim = { tile: s.claim.tile, from: s.claim.from, actor: q ? q.seat : s.claim.actor, opts: q && q.seat === seat ? q.opts : (s.claim.actor === seat ? s.claim.opts : null) }; } else v.claim = null;
    return v;
  }
  var API = { id: 'mahjong', name: 'Mahjong', nSeats: 4, KN: KN, newGame: newGame, move: move, resign: resign, view: view, options: options, canWin: canWin, shanten: shanten, toCounts: toCounts, scoreHand: scoreHand,
    isHonor: isHonor, suitOf: suitOf, isSimple: isSimple, chiOptions: chiOptions, sortTiles: sortTiles, ORPHANS: ORPHANS, decompositions: decompositions, next: next };
  if (typeof module !== 'undefined' && module.exports) module.exports = API; else (self.GH = self.GH || {}).Mahjong = API;
})();

/* ---- zhajinhua ---- */
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

/* ---- chess ---- */
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

/* ---- holdem ---- */
/* Texas Hold'em engine (2-6 players). VIRTUAL CHIPS ONLY - for entertainment only, no cash value, not redeemable.
   Cards 0..51: rank = 2 + (id >> 2) (2..14, A = 14), suit = id & 3 (0 spade, 1 heart, 2 club, 3 diamond).
   One state = one hand. Stacks carry between hands via newGame({stacks}) / nextStacks(). Seats 1..n.
   Blinds sb/bb (default 10/20), buy-in 1000. Actions: {a:'fold'} {a:'check'} {a:'call'} {a:'raise', to:N} (N = total bet this round) {a:'allin'}.
   Side pots are built from each player's total contribution; ties split pots (odd chip to the first winner left of the dealer). */
(function () {
  var CAT = ['High card', 'Pair', 'Two pair', 'Three of a kind', 'Straight', 'Flush', 'Full house', 'Four of a kind', 'Straight flush'];
  var RN = { 11: 'J', 12: 'Q', 13: 'K', 14: 'A' }, RNAME = { 2: 'Twos', 3: 'Threes', 4: 'Fours', 5: 'Fives', 6: 'Sixes', 7: 'Sevens', 8: 'Eights', 9: 'Nines', 10: 'Tens', 11: 'Jacks', 12: 'Queens', 13: 'Kings', 14: 'Aces' };
  var RSING = { 2: 'Two', 3: 'Three', 4: 'Four', 5: 'Five', 6: 'Six', 7: 'Seven', 8: 'Eight', 9: 'Nine', 10: 'Ten', 11: 'Jack', 12: 'Queen', 13: 'King', 14: 'Ace' };
  var SUITC = ['♠', '♥', '♣', '♦'];
  function rankOf(id) { return 2 + (id >> 2); }
  function suitOf(id) { return id & 3; }
  function rankName(r) { return RN[r] || String(r); }
  function cardName(id) { return rankName(rankOf(id)) + SUITC[suitOf(id)]; }
  var P5 = [50625, 3375, 225, 15, 1], CATM = 759375;
  function pack(cat, ranks) { var s = cat * CATM; for (var i = 0; i < 5; i++) s += (ranks[i] || 0) * P5[i]; return s; }
  function straightHigh(has) { for (var hi = 14; hi >= 5; hi--) { var ok = true; for (var k = 0; k < 5; k++) { var r = hi - k; if (r === 1) r = 14; if (!has[r]) { ok = false; break; } } if (ok) return hi; } return 0; }
  /* best 5-card hand from 5..7 cards -> numeric score (higher is better) */
  function evalCards(cs) {
    var rc = [], i, r, s, has = [], suits = [[], [], [], []];
    for (i = 0; i < 15; i++) { rc.push(0); has.push(false); }
    for (i = 0; i < cs.length; i++) { r = 2 + (cs[i] >> 2); s = cs[i] & 3; rc[r]++; has[r] = true; suits[s].push(r); }
    var fl = -1; for (s = 0; s < 4; s++) if (suits[s].length >= 5) fl = s;
    if (fl >= 0) { var fh = []; for (i = 0; i < 15; i++) fh.push(false); suits[fl].forEach(function (x) { fh[x] = true; }); var sh = straightHigh(fh); if (sh) return pack(8, [sh]); }
    var quads = [], trips = [], pairs = [], singles = [];
    for (r = 14; r >= 2; r--) { if (rc[r] === 4) quads.push(r); else if (rc[r] === 3) trips.push(r); else if (rc[r] === 2) pairs.push(r); else if (rc[r] === 1) singles.push(r); }
    function kick(ex, n) { var out = []; for (var q = 14; q >= 2 && out.length < n; q--) if (rc[q] && ex.indexOf(q) < 0) out.push(q); return out; }
    if (quads.length) return pack(7, [quads[0]].concat(kick([quads[0]], 1)));
    if (trips.length && (trips.length > 1 || pairs.length)) { var pr = trips.length > 1 ? Math.max(trips[1], pairs[0] || 0) : pairs[0]; return pack(6, [trips[0], pr]); }
    if (fl >= 0) return pack(5, suits[fl].slice().sort(function (a, b) { return b - a; }).slice(0, 5));
    var st = straightHigh(has); if (st) return pack(4, [st]);
    if (trips.length) return pack(3, [trips[0]].concat(kick([trips[0]], 2)));
    if (pairs.length >= 2) return pack(2, [pairs[0], pairs[1]].concat(kick([pairs[0], pairs[1]], 1)));
    if (pairs.length === 1) return pack(1, [pairs[0]].concat(kick([pairs[0]], 3)));
    return pack(0, kick([], 5));
  }
  function catOf(score) { return Math.floor(score / CATM); }
  function describe(score) { // English description, e.g. "Pair of Kings"
    var c = catOf(score), rem = score - c * CATM, r = []; for (var i = 0; i < 5; i++) { r.push(Math.floor(rem / P5[i])); rem %= P5[i]; }
    switch (c) {
      case 0: return 'High card ' + RSING[r[0]];
      case 1: return 'Pair of ' + RNAME[r[0]];
      case 2: return 'Two pair, ' + RNAME[r[0]] + ' and ' + RNAME[r[1]];
      case 3: return 'Three of a kind, ' + RNAME[r[0]];
      case 4: return RSING[r[0]] + '-high straight';
      case 5: return RSING[r[0]] + '-high flush';
      case 6: return 'Full house, ' + RNAME[r[0]] + ' over ' + RNAME[r[1]];
      case 7: return 'Four of a kind, ' + RNAME[r[0]];
      default: return r[0] === 14 ? 'Royal flush' : RSING[r[0]] + '-high straight flush';
    }
  }
  function shuffleDeck(rng) { var d = []; for (var i = 0; i < 52; i++) d.push(i); for (var j = 51; j > 0; j--) { var k = Math.floor(rng() * (j + 1)), t = d[j]; d[j] = d[k]; d[k] = t; } return d; }

  function nextSeat(s, from, pred) { for (var i = 1; i <= s.n; i++) { var p = ((from - 1 + i) % s.n) + 1; if (pred(p)) return p; } return 0; }
  function canAct(s, p) { return s.status[p] === 'active'; }
  function live(s, p) { return s.status[p] === 'active' || s.status[p] === 'allin'; }
  function postBlind(s, p, amt) { var a = Math.min(amt, s.stacks[p]); s.stacks[p] -= a; s.bets[p] += a; s.contrib[p] += a; s.pot += a; if (s.stacks[p] === 0) s.status[p] = 'allin'; return a; }
  function newGame(o) {
    o = o || {}; var rng = o.rng || Math.random, n = Math.max(2, Math.min(6, Math.floor(o.n || 4))), sb = o.sb || 10, bb = o.bb || 20, buyin = o.buyin || 1000;
    var s = { game: 'holdem', n: n, sb: sb, bb: bb, buyin: buyin, handNo: o.handNo || 1, dealer: ((Math.floor(o.dealer || 1) - 1) % n) + 1, phase: 'preflop', turn: 0, board: [], hands: [null], deck: [], stacks: [0], start: [0], bets: [0], contrib: [0], status: [''], acted: [false], raiseOpen: [false],
      currentBet: 0, minRaise: bb, pot: 0, over: false, showdown: false, winners: [], pots: [], scores: [0], reason: '', log: [], event: null, seq: 0, hnames: [''], sbSeat: 0, bbSeat: 0 };
    var d = shuffleDeck(rng), p, i;
    for (p = 1; p <= n; p++) {
      var st = o.stacks && o.stacks[p] >= 0 ? o.stacks[p] : buyin; if (st < bb && !o.keepBroke) st = buyin;
      s.stacks.push(st); s.start.push(st); s.bets.push(0); s.contrib.push(0); s.status.push(st > 0 ? 'active' : 'out'); s.acted.push(false); s.raiseOpen.push(true); s.scores.push(0); s.hnames.push('');
      s.hands.push([d[(p - 1) * 2], d[(p - 1) * 2 + 1]]);
    }
    s.deck = d.slice(n * 2);
    var inHand = function (q) { return s.status[q] !== 'out'; };
    if (n === 2) { s.sbSeat = s.dealer; s.bbSeat = nextSeat(s, s.dealer, inHand); } else { s.sbSeat = nextSeat(s, s.dealer, inHand); s.bbSeat = nextSeat(s, s.sbSeat, inHand); }
    postBlind(s, s.sbSeat, sb); postBlind(s, s.bbSeat, bb);
    s.currentBet = Math.max(s.bets[s.sbSeat], s.bets[s.bbSeat]);
    s.event = { t: 'deal', seat: 0 }; s.seq++;
    var first = nextSeat(s, s.bbSeat, function (q) { return canAct(s, q); });
    s.turn = first; advance(s, true);
    return s;
  }
  function liveCount(s) { var c = 0; for (var p = 1; p <= s.n; p++) if (live(s, p)) c++; return c; }
  function needsAction(s, p) { return canAct(s, p) && (!s.acted[p] || s.bets[p] < s.currentBet); }
  /* after an action (or at the start of a round): choose the next actor, or close the round */
  function advance(s, fromStart) {
    if (s.over) return;
    if (liveCount(s) === 1) return awardUncontested(s);
    var cur = s.turn || s.dealer, p = fromStart && s.turn && needsAction(s, s.turn) ? s.turn : nextSeat(s, cur, function (q) { return needsAction(s, q); });
    if (p && (function () { var c = 0; for (var q = 1; q <= s.n; q++) if (canAct(s, q)) c++; if (c === 1 && s.bets[p] >= s.currentBet) return false; return true; })()) { s.turn = p; return; }
    nextStreet(s);
  }
  function resetRound(s) { s.currentBet = 0; s.minRaise = s.bb; for (var p = 1; p <= s.n; p++) { s.bets[p] = 0; s.acted[p] = false; s.raiseOpen[p] = true; } }
  function nextStreet(s) {
    resetRound(s);
    if (s.phase === 'river') return showdown(s);
    var ev;
    if (s.phase === 'preflop') { s.board.push(s.deck.shift(), s.deck.shift(), s.deck.shift()); s.phase = 'flop'; ev = 'flop'; }
    else if (s.phase === 'flop') { s.board.push(s.deck.shift()); s.phase = 'turn'; ev = 'turn'; }
    else { s.board.push(s.deck.shift()); s.phase = 'river'; ev = 'river'; }
    s.event = { t: ev, seat: 0 }; s.seq++;
    var actors = 0; for (var q = 1; q <= s.n; q++) if (canAct(s, q)) actors++;
    if (actors <= 1) { s.turn = 0; return nextStreet(s); } // everyone all-in (or one left with nobody to bet against): run it out
    s.turn = nextSeat(s, s.dealer, function (q) { return canAct(s, q); }); advance(s, true);
  }
  function settle(s) { for (var p = 1; p <= s.n; p++) s.scores[p] = s.stacks[p] - s.start[p]; }
  function awardUncontested(s) {
    var w = 0; for (var p = 1; p <= s.n; p++) if (live(s, p)) w = p;
    s.stacks[w] += s.pot; s.pots = [{ amount: s.pot, eligible: [w], winners: [w] }]; s.pot = 0;
    s.over = true; s.phase = 'over'; s.turn = 0; s.winners = [w]; s.showdown = false; s.reason = 'Everyone else folded'; s.final = { t: 'win', seat: w }; settle(s);
  }
  function showdown(s) {
    var scoreOf = [0], p;
    for (p = 1; p <= s.n; p++) scoreOf.push(live(s, p) ? evalCards(s.hands[p].concat(s.board)) : -1);
    var levels = [], seen = {};
    for (p = 1; p <= s.n; p++) if (s.contrib[p] > 0 && !seen[s.contrib[p]]) { seen[s.contrib[p]] = 1; levels.push(s.contrib[p]); }
    levels.sort(function (a, b) { return a - b; });
    var prev = 0, pots = [], all = {};
    levels.forEach(function (lv) {
      var amt = 0, elig = [];
      for (var q = 1; q <= s.n; q++) { amt += Math.max(0, Math.min(s.contrib[q], lv) - prev); if (live(s, q) && s.contrib[q] >= lv) elig.push(q); }
      prev = lv; if (!amt) return;
      if (!elig.length) { var last = pots[pots.length - 1]; if (last) { last.amount += amt; } return; } // dead money goes to the previous pot
      pots.push({ amount: amt, eligible: elig, winners: [] });
    });
    pots.forEach(function (pt) {
      var best = -1; pt.eligible.forEach(function (q) { if (scoreOf[q] > best) best = scoreOf[q]; });
      pt.winners = pt.eligible.filter(function (q) { return scoreOf[q] === best; });
      var share = Math.floor(pt.amount / pt.winners.length), extra = pt.amount - share * pt.winners.length;
      var order = []; for (var i = 1; i <= s.n; i++) { var q = ((s.dealer - 1 + i) % s.n) + 1; if (pt.winners.indexOf(q) >= 0) order.push(q); }
      order.forEach(function (q, k) { s.stacks[q] += share + (k < extra ? 1 : 0); all[q] = 1; });
    });
    for (p = 1; p <= s.n; p++) if (scoreOf[p] >= 0) s.hnames[p] = describe(scoreOf[p]);
    s.pots = pots; s.pot = 0; s.over = true; s.phase = 'over'; s.turn = 0; s.showdown = true; s.winners = Object.keys(all).map(Number).sort();
    s.reason = s.winners.length > 1 ? 'Split pot' : 'Seat ' + s.winners[0] + ' wins with ' + s.hnames[s.winners[0]]; s.final = { t: 'showdown', seat: s.winners[0] }; settle(s);
  }
  function options(s, seat) {
    var o = { turn: false, fold: false, check: false, call: 0, canRaise: false, raiseMin: 0, raiseMax: 0, allin: 0 };
    if (s.over || seat < 1 || seat > s.n || s.turn !== seat || !canAct(s, seat)) return o;
    var st = s.stacks[seat], need = s.currentBet - s.bets[seat];
    o.turn = true; o.fold = true; o.check = need <= 0; o.call = need > 0 ? Math.min(need, st) : 0; o.allin = st + s.bets[seat];
    var others = 0; for (var p = 1; p <= s.n; p++) if (p !== seat && canAct(s, p)) others++;
    if (s.raiseOpen[seat] && st > need && others > 0) { o.canRaise = true; o.raiseMin = Math.min(s.currentBet + s.minRaise, o.allin); o.raiseMax = o.allin; if (s.currentBet === 0) o.raiseMin = Math.min(Math.max(s.bb, 1), o.allin); }
    return o;
  }
  function log(s, e) { s.log.push(e); if (s.log.length > 60) s.log.shift(); }
  function afterAct(s, seat, kind, amt) { log(s, { seat: seat, a: kind, amt: amt || 0, street: s.phase }); s.event = { t: kind, seat: seat, amt: amt || 0 }; s.seq++; advance(s); }
  function put(s, seat, amt) { s.stacks[seat] -= amt; s.bets[seat] += amt; s.contrib[seat] += amt; s.pot += amt; if (s.stacks[seat] === 0) s.status[seat] = 'allin'; }
  function raiseTo(s, seat, to) {
    var add = to - s.bets[seat], inc = to - s.currentBet; put(s, seat, add);
    var full = inc >= s.minRaise;
    if (to > s.currentBet) { if (full) { s.minRaise = inc; for (var p = 1; p <= s.n; p++) if (p !== seat && canAct(s, p)) { s.raiseOpen[p] = true; } } s.currentBet = to; }
    s.acted[seat] = true; s.raiseOpen[seat] = false;
    if (!full) for (var q = 1; q <= s.n; q++) if (q !== seat && s.acted[q]) s.raiseOpen[q] = false; // a short all-in does not reopen the betting
    return add;
  }
  function move(s, seat, mv) {
    if (s.over) return { ok: false, err: 'The hand is over' };
    if (!Number.isInteger(seat) || seat < 1 || seat > s.n || !canAct(s, seat)) return { ok: false, err: 'You are not in this hand' };
    if (seat !== s.turn) return { ok: false, err: 'Not your turn' };
    if (!mv || typeof mv.a !== 'string') return { ok: false, err: 'Invalid action' };
    var o = options(s, seat), amt;
    if (mv.a === 'fold') { s.status[seat] = 'folded'; s.acted[seat] = true; afterAct(s, seat, 'fold'); return { ok: true }; }
    if (mv.a === 'check') { if (!o.check) return { ok: false, err: 'You cannot check - call or fold' }; s.acted[seat] = true; s.raiseOpen[seat] = false; afterAct(s, seat, 'check'); return { ok: true }; }
    if (mv.a === 'call') { if (o.check) return { ok: false, err: 'Nothing to call - check instead' }; amt = o.call; put(s, seat, amt); s.acted[seat] = true; s.raiseOpen[seat] = false; afterAct(s, seat, s.status[seat] === 'allin' ? 'allin' : 'call', amt); return { ok: true }; }
    if (mv.a === 'allin') {
      if (s.stacks[seat] <= 0) return { ok: false, err: 'Invalid action' };
      if (o.allin <= s.currentBet) { amt = s.stacks[seat]; put(s, seat, amt); s.acted[seat] = true; s.raiseOpen[seat] = false; afterAct(s, seat, 'allin', amt); return { ok: true }; }
      if (!o.canRaise) { amt = s.stacks[seat]; put(s, seat, amt); s.acted[seat] = true; s.raiseOpen[seat] = false; afterAct(s, seat, 'allin', amt); return { ok: true }; }
      amt = raiseTo(s, seat, o.allin); afterAct(s, seat, 'allin', amt); return { ok: true };
    }
    if (mv.a === 'raise') {
      if (!o.canRaise) return { ok: false, err: 'You cannot raise now' };
      var to = Math.floor(+mv.to); if (!(to >= o.raiseMin && to <= o.raiseMax)) return { ok: false, err: 'Raise must be between ' + o.raiseMin + ' and ' + o.raiseMax };
      var isAll = to === o.allin, prior = s.currentBet; amt = raiseTo(s, seat, to); afterAct(s, seat, isAll ? 'allin' : (prior > 0 ? 'raise' : 'bet'), amt); return { ok: true };
    }
    return { ok: false, err: 'Unknown action' };
  }
  function resign(s, seat) { if (s.over || seat < 1 || seat > s.n || !canAct(s, seat)) return; if (seat === s.turn) { s.status[seat] = 'folded'; s.acted[seat] = true; afterAct(s, seat, 'fold'); } else { s.status[seat] = 'folded'; s.acted[seat] = true; log(s, { seat: seat, a: 'fold', amt: 0, street: s.phase }); s.event = { t: 'fold', seat: seat }; s.seq++; advance(s, true); } }
  function view(s, seat) {
    var v = {}; for (var k in s) if (k !== 'deck' && k !== 'hands') v[k] = s[k];
    v.hands = [null];
    for (var p = 1; p <= s.n; p++) { var show = p === seat || (s.over && s.showdown && live(s, p)); v.hands.push(show && s.hands[p] ? s.hands[p].slice() : null); }
    v.seat = seat; v.hasCards = []; for (var q = 1; q <= s.n; q++) v.hasCards[q] = s.status[q] !== 'out';
    if (seat >= 1 && seat <= s.n && s.hands[seat] && live(s, seat)) v.myHand = s.board.length ? describe(evalCards(s.hands[seat].concat(s.board))) : '';
    return v;
  }
  /* stacks for the next hand: carry over; busted players re-buy (virtual) */
  function nextStacks(s) { var a = [0]; for (var p = 1; p <= s.n; p++) a.push(s.stacks[p] < s.bb ? s.buyin : s.stacks[p]); return a; }
  var API = { id: 'holdem', name: "Texas Hold'em", nSeats: 6, CAT: CAT, rankOf: rankOf, suitOf: suitOf, rankName: rankName, cardName: cardName, evalCards: evalCards, catOf: catOf, describe: describe,
    newGame: newGame, move: move, resign: resign, view: view, options: options, nextStacks: nextStacks, shuffleDeck: shuffleDeck, liveCount: liveCount };
  if (typeof module !== 'undefined' && module.exports) module.exports = API; else (self.GH = self.GH || {}).Holdem = API;
})();

/* ---- engines ---- */
(function () {
  var R = typeof require === 'function';
  var G = R ? require('./gomoku.js') : GH.Gomoku;
  var X = R ? require('./xiangqi.js') : GH.Xiangqi;
  var L = R ? require('./luzhanqi.js') : GH.Luzhanqi;
  var D = R ? require('./doudizhu.js') : GH.Doudizhu;
  var M = R ? require('./mahjong.js') : GH.Mahjong;
  var Z = R ? require('./zhajinhua.js') : GH.Zhajinhua;
  var CH = R ? require('./chess.js') : GH.Chess;
  var HE = R ? require('./holdem.js') : GH.Holdem;
  // seats: 每局座位数; multi: 3/4 人游戏(支持电脑补位、一人离开由电脑托管)
  var SEATS = { gomoku: 2, xiangqi: 2, luzhanqi: 2, doudizhu: 3, mahjong: 4, zhajinhua: 6, chess: 2, holdem: 6 };
  var API = { gomoku: G, xiangqi: X, luzhanqi: L, doudizhu: D, mahjong: M, zhajinhua: Z, chess: CH, holdem: HE, list: ['holdem', 'chess', 'gomoku', 'xiangqi', 'luzhanqi', 'doudizhu', 'mahjong', 'zhajinhua'], SEATS: SEATS };
  if (typeof module !== 'undefined' && module.exports) module.exports = API; else (self.GH = self.GH || {}).Engines = API;
})();

/* ---- ai-gomoku ---- */
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

/* ---- ai-xiangqi ---- */
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

/* ---- ai-luzhanqi ---- */
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

/* ---- ai-doudizhu ---- */
/* 斗地主 AI。
   level 1 简单: 随机合法出牌;level 2 普通: 手牌拆分(最少出牌手数)启发式;
   level 3 困难: 记牌 + 确定化蒙特卡洛(PIMC): 按公开信息(已出的牌、底牌、各家张数)随机补全对手手牌,
   对每个候选出法用启发式策略模拟若干盘到终局,选胜率最高者;叫分同样用模拟估计地主胜率。 */
(function () {
  var D = (typeof require === 'function') ? require('./doudizhu.js') : GH.Doudizhu;
  var NR = 18; // 点数 3..17
  function rnd(n) { return Math.floor(Math.random() * n); }
  function toCnt(hand) { var c = new Int8Array(NR); for (var i = 0; i < hand.length; i++) c[D.rankOf(hand[i])]++; return c; }

  /* ---- 最少手数(拆牌)---- */
  var MH = new Map();
  function keyOf(c) { var s = ''; for (var r = 3; r < NR; r++) s += c[r]; return s; }
  function minHands(c) {
    var r = 3; while (r < NR && c[r] === 0) r++;
    if (r >= NR) return 0;
    var key = keyOf(c), got = MH.get(key); if (got !== undefined) return got;
    var best = 99, v, k, L, i, ok;
    function sub(rank, n) { c[rank] -= n; } function add(rank, n) { c[rank] += n; }
    if (r === 16 && c[17]) { c[16]--; c[17]--; v = 1 + minHands(c); c[16]++; c[17]++; if (v < best) best = v; }
    if (c[r] === 4) { c[r] -= 4; v = 1 + minHands(c); c[r] += 4; if (v < best) best = v; }
    // 顺子
    if (r <= 10) { for (L = 1; r + L - 1 <= 14 && c[r + L - 1] >= 1; L++) if (L >= 5) { for (i = 0; i < L; i++) c[r + i]--; v = 1 + minHands(c); for (i = 0; i < L; i++) c[r + i]++; if (v < best) best = v; } }
    if (r <= 12) { for (L = 1; r + L - 1 <= 14 && c[r + L - 1] >= 2; L++) if (L >= 3) { for (i = 0; i < L; i++) c[r + i] -= 2; v = 1 + minHands(c); for (i = 0; i < L; i++) c[r + i] += 2; if (v < best) best = v; } }
    if (r <= 13) { for (L = 1; r + L - 1 <= 14 && c[r + L - 1] >= 3; L++) if (L >= 2) { for (i = 0; i < L; i++) c[r + i] -= 3; v = 1 + minHands(c); for (i = 0; i < L; i++) c[r + i] += 3; if (v < best) best = v; } }
    if (c[r] >= 3) {
      c[r] -= 3; v = 1 + minHands(c); if (v < best) best = v; // 三张(无带)
      var tried = 0; for (k = 3; k < NR && tried < 2; k++) if (c[k] >= 1) { tried++; c[k]--; v = 1 + minHands(c); c[k]++; if (v < best) best = v; }
      tried = 0; for (k = 3; k < 16 && tried < 2; k++) if (c[k] >= 2) { tried++; c[k] -= 2; v = 1 + minHands(c); c[k] += 2; if (v < best) best = v; }
      c[r] += 3;
    }
    if (c[r] >= 2 && r <= 15) { c[r] -= 2; v = 1 + minHands(c); c[r] += 2; if (v < best) best = v; }
    c[r]--; v = 1 + minHands(c); c[r]++; if (v < best) best = v;
    if (MH.size > 300000) MH.clear();
    MH.set(key, best); return best;
  }

  /* ---- 计数版走法生成 ---- */
  // 描述: {t,r,len,n,c:[[rank,k],...]}
  function kickers(c, excl, k, size, out) { // 取 k 组(size 1/2)最小的、点数不在 excl 中的牌;优先取恰好等于 size 的孤立牌
    var picks = [], pass, r;
    for (pass = 0; pass < 2 && picks.length < k; pass++) for (r = 3; r < NR && picks.length < k; r++) {
      if (excl.indexOf(r) >= 0 || picks.indexOf(r) >= 0) continue;
      if (size === 2 && r > 15) continue;
      var have = c[r]; if (have < size) continue;
      if (pass === 0 ? have === size : have > size) picks.push(r);
    }
    if (picks.length < k) return false;
    picks.forEach(function (r2) { out.push([r2, size]); }); return true;
  }
  function gen(c, last) {
    var out = [], r, L, i, lt = last ? last.t : null, lr = last ? last.r : 0, ll = last ? last.len : 0;
    function push(t, rank, len, n, cs) { out.push({ t: t, r: rank, len: len, n: n, c: cs }); }
    if (!last || lt === 'single') for (r = 3; r < NR; r++) if (c[r] >= 1 && r > lr) push('single', r, 1, 1, [[r, 1]]);
    if (!last || lt === 'pair') for (r = 3; r <= 15; r++) if (c[r] >= 2 && r > lr) push('pair', r, 1, 2, [[r, 2]]);
    if (!last || lt === 'triple') for (r = 3; r <= 15; r++) if (c[r] >= 3 && r > lr) push('triple', r, 1, 3, [[r, 3]]);
    if (!last || lt === 'triple1') for (r = 3; r <= 15; r++) if (c[r] >= 3 && r > lr) { var k1 = [[r, 3]]; if (kickers(c, [r], 1, 1, k1)) push('triple1', r, 1, 4, k1); }
    if (!last || lt === 'triple2') for (r = 3; r <= 15; r++) if (c[r] >= 3 && r > lr) { var k2 = [[r, 3]]; if (kickers(c, [r], 1, 2, k2)) push('triple2', r, 1, 5, k2); }
    if (!last || lt === 'straight') for (r = 3; r <= 10; r++) for (L = 5; r + L - 1 <= 14; L++) { if (last && L !== ll) continue; if (last && r + L - 1 <= lr) continue; var ok = true; for (i = 0; i < L; i++) if (c[r + i] < 1) { ok = false; break; } if (!ok) break; var cs = []; for (i = 0; i < L; i++) cs.push([r + i, 1]); push('straight', r + L - 1, L, L, cs); }
    if (!last || lt === 'pairstraight') for (r = 3; r <= 12; r++) for (L = 3; r + L - 1 <= 14; L++) { if (last && L !== ll) continue; if (last && r + L - 1 <= lr) continue; var ok2 = true; for (i = 0; i < L; i++) if (c[r + i] < 2) { ok2 = false; break; } if (!ok2) break; var cs2 = []; for (i = 0; i < L; i++) cs2.push([r + i, 2]); push('pairstraight', r + L - 1, L, 2 * L, cs2); }
    if (!last || lt === 'plane' || lt === 'plane1' || lt === 'plane2') for (r = 3; r <= 13; r++) for (L = 2; r + L - 1 <= 14; L++) {
      var ok3 = true; for (i = 0; i < L; i++) if (c[r + i] < 3) { ok3 = false; break; } if (!ok3) break;
      if (last && L !== ll) continue; if (last && r + L - 1 <= lr) continue;
      var tri = [], ex = []; for (i = 0; i < L; i++) { tri.push([r + i, 3]); ex.push(r + i); }
      if (!last || lt === 'plane') push('plane', r + L - 1, L, 3 * L, tri);
      if (!last || lt === 'plane1') { var w1 = tri.slice(); if (kickers(c, ex, L, 1, w1)) push('plane1', r + L - 1, L, 4 * L, w1); }
      if (!last || lt === 'plane2') { var w2 = tri.slice(); if (kickers(c, ex, L, 2, w2)) push('plane2', r + L - 1, L, 5 * L, w2); }
    }
    if (!last || lt === 'four2') for (r = 3; r <= 15; r++) if (c[r] === 4 && r > lr) { var f1 = [[r, 4]]; if (kickers(c, [r], 2, 1, f1)) push('four2', r, 1, 6, f1); }
    if (!last || lt === 'four22') for (r = 3; r <= 15; r++) if (c[r] === 4 && r > lr) { var f2 = [[r, 4]]; if (kickers(c, [r], 2, 2, f2)) push('four22', r, 1, 8, f2); }
    if (lt !== 'rocket') {
      for (r = 3; r <= 15; r++) if (c[r] === 4 && (!last || lt !== 'bomb' || r > lr)) push('bomb', r, 1, 4, [[r, 4]]);
      if (c[16] && c[17]) push('rocket', 99, 1, 2, [[16, 1], [17, 1]]);
    }
    return out;
  }
  function applyD(c, d) { for (var i = 0; i < d.c.length; i++) c[d.c[i][0]] -= d.c[i][1]; }
  function undoD(c, d) { for (var i = 0; i < d.c.length; i++) c[d.c[i][0]] += d.c[i][1]; }
  function total(c) { var n = 0; for (var r = 3; r < NR; r++) n += c[r]; return n; }
  function isBomb(d) { return d.t === 'bomb' || d.t === 'rocket'; }

  /* ---- 启发式策略(用于普通档与模拟) ---- */
  // ctx: {cnts:[_,c1,c2,c3], seat, landlord, last:{t,r,len,n,seat}|null, lastSeat}
  function policy(c, seat, ctx, noise) {
    var last = ctx.last, moves = gen(c, last), n = total(c), i, d;
    if (last && !moves.length) return null;
    var myLL = seat === ctx.landlord;
    var opps = []; for (var p = 1; p <= 3; p++) if (p !== seat && (myLL || p === ctx.landlord)) opps.push(p);
    var minOpp = 99; opps.forEach(function (p) { var cc = total(ctx.cnts[p]); if (cc < minOpp) minOpp = cc; });
    for (i = 0; i < moves.length; i++) if (moves[i].n === n) return moves[i]; // 可一手出完
    if (!last) { // 领出
      var best = null, bs = Infinity;
      for (i = 0; i < moves.length; i++) {
        d = moves[i]; applyD(c, d); var mh = minHands(c); undoD(c, d);
        var s = mh * 10 + d.r * 0.3 - d.n * 0.6 + (isBomb(d) ? 9 : 0) + (d.r >= 15 && d.n <= 2 && !isBomb(d) ? 4 : 0);
        if (minOpp === 1 && d.t === 'single') s += 6 - d.r * 0.3; // 对手只剩一张: 少领单张
        if (noise) s += Math.random() * noise;
        if (s < bs) { bs = s; best = d; }
      }
      return best;
    }
    // 跟牌
    if (!myLL && last.seat !== ctx.landlord && last.seat !== seat) return null; // 队友出的牌,不压
    var base = minHands(c), pick = null, ps = Infinity, bomb = null, danger = minOpp <= 3 || (last.seat !== seat && total(ctx.cnts[last.seat]) <= 2);
    for (i = 0; i < moves.length; i++) {
      d = moves[i];
      if (isBomb(d)) { if (!bomb || d.r < bomb.r) bomb = d; continue; }
      applyD(c, d); var mh2 = minHands(c); undoD(c, d);
      var s2 = mh2 * 10 + d.r * 0.5 + (d.r >= 15 ? 3 : 0);
      if (mh2 > base) s2 += 12; // 拆散牌型
      if (noise) s2 += Math.random() * noise;
      if (s2 < ps) { ps = s2; pick = d; }
    }
    if (pick) {
      var wasteful = ps > base * 10 + 8 && !danger;
      if (!wasteful || (danger && true)) return pick;
      return null;
    }
    if (bomb && (danger || n <= 6 || minOpp <= 4)) return bomb;
    return null;
  }
  function randomPolicy(c, seat, ctx) {
    var moves = gen(c, ctx.last);
    if (!moves.length) return null;
    if (ctx.last && Math.random() < 0.35) return null;
    var nb = moves.filter(function (d) { return !isBomb(d); }); if (nb.length && Math.random() < 0.85) return nb[rnd(nb.length)];
    return moves[rnd(moves.length)];
  }

  /* ---- 模拟 ---- */
  function simulate(cnts, turn, last, landlord, maxSteps, pol, noise) {
    var ctx = { cnts: cnts, landlord: landlord, last: last ? { t: last.t, r: last.r, len: last.len, n: last.n, seat: last.seat } : null }, passes = 0, steps = 0;
    while (steps++ < maxSteps) {
      var d = pol(cnts[turn], turn, ctx, noise);
      if (!d) { passes++; if (!ctx.last) { /* 领出必须出牌,理论上不会发生 */ } if (passes >= 2) { ctx.last = null; passes = 0; } }
      else {
        applyD(cnts[turn], d); passes = 0; ctx.last = { t: d.t, r: d.r, len: d.len, n: d.n, seat: turn };
        if (total(cnts[turn]) === 0) return turn;
      }
      turn = turn % 3 + 1;
    }
    return 0;
  }
  function cloneCnts(c) { return [null, Int8Array.from(c[1]), Int8Array.from(c[2]), Int8Array.from(c[3])]; }

  /* ---- 确定化 ---- */
  function unseenPool(view, seat) {
    var seen = {}, i; view.hands[seat].forEach(function (id) { seen[id] = 1; });
    view.plays.forEach(function (pl) { if (pl.cards) pl.cards.forEach(function (id) { seen[id] = 1; }); });
    var pool = []; for (i = 0; i < 54; i++) if (!seen[i]) pool.push(i); return pool;
  }
  function determinize(view, seat, pool) {
    var others = [1, 2, 3].filter(function (p) { return p !== seat; }), c = [null, new Int8Array(NR), new Int8Array(NR), new Int8Array(NR)];
    c[seat] = toCnt(view.hands[seat]);
    var need = {}; others.forEach(function (p) { need[p] = view.counts[p]; });
    var arr = pool.slice();
    for (var i = arr.length - 1; i > 0; i--) { var j = rnd(i + 1), t = arr[i]; arr[i] = arr[j]; arr[j] = t; }
    // 地主底牌(公开)中尚未打出且不在我手里的牌必属于地主
    if (view.landlord && view.landlord !== seat) {
      var ll = view.landlord, forced = view.bottom.filter(function (id) { return arr.indexOf(id) >= 0; });
      forced.forEach(function (id) { c[ll][D.rankOf(id)]++; need[ll]--; arr.splice(arr.indexOf(id), 1); });
    }
    others.forEach(function (p) { for (var k = 0; k < need[p] && arr.length; k++) c[p][D.rankOf(arr.pop())]++; });
    return c;
  }
  function descToCards(d, hand) {
    var byRank = {}; hand.forEach(function (id) { var r = D.rankOf(id); (byRank[r] = byRank[r] || []).push(id); });
    var cards = []; d.c.forEach(function (pr) { for (var k = 0; k < pr[1]; k++) cards.push(byRank[pr[0]][k]); }); return cards;
  }

  /* ---- 叫分 ---- */
  function handStrength(hand) {
    var c = toCnt(hand), s = 0; if (c[16] && c[17]) s += 8; else { if (c[17]) s += 4; if (c[16]) s += 3; }
    s += c[15] * 2; s += c[14] * 0.8; for (var r = 3; r <= 15; r++) if (c[r] === 4) s += 6;
    s -= minHands(c) * 0.9; return s;
  }
  function bidMove(view, seat, level, opts) {
    var high = view.bid.high, want;
    if (level === 1) want = rnd(4);
    else if (level === 2) { var st = handStrength(view.hands[seat]); want = st >= 3.5 ? 3 : st >= 1.5 ? 2 : st >= -0.5 ? 1 : 0; }
    else {
      var limit = Math.min(opts.timeMs || 300, 250), t0 = Date.now(), wins = 0, n = 0, pool = unseenPool(view, seat), hand = view.hands[seat];
      while (n < 12 || (Date.now() - t0 < limit * 0.5 && n < 120)) {
        var arr = pool.slice(); for (var i = arr.length - 1; i > 0; i--) { var j = rnd(i + 1), t = arr[i]; arr[i] = arr[j]; arr[j] = t; }
        var c = [null, null, null, null]; c[seat] = toCnt(hand);
        var bottom = arr.splice(0, 3); bottom.forEach(function (id) { c[seat][D.rankOf(id)]++; });
        var o = [1, 2, 3].filter(function (p) { return p !== seat; }); c[o[0]] = toCnt(arr.slice(0, 17)); c[o[1]] = toCnt(arr.slice(17, 34));
        var w = simulate(c, seat, null, seat, 120, policy, 3); if (w === seat) wins++; n++;
      }
      var p = wins / n; want = p >= 0.62 ? 3 : p >= 0.54 ? 2 : p >= 0.46 ? 1 : 0;
      // 综合牌力(模拟样本有限时的校正)
      var st2 = handStrength(hand); if (st2 >= 7) want = Math.max(want, 3); if (st2 < -3) want = Math.min(want, 1);
    }
    if (want <= high) return { bid: 0 };
    return { bid: want };
  }

  function playMove(view, seat, level, opts) {
    var hand = view.hands[seat], c = toCnt(hand), last = view.last && view.last.seat !== seat ? view.last : null;
    var lastD = last ? { t: last.cl.type, r: last.cl.rank, len: last.cl.len, n: last.cl.n, seat: last.seat } : null;
    var moves = gen(c, lastD), i;
    if (lastD && !moves.length) return { pass: true };
    var cnts = [null, null, null, null];
    if (level === 1) { var rp = randomPolicy(c, seat, { cnts: [null, c, c, c], last: lastD, landlord: view.landlord }); return rp ? { cards: descToCards(rp, hand) } : (lastD ? { pass: true } : { cards: descToCards(moves[0], hand) }); }
    if (level === 2) {
      var pool2 = unseenPool(view, seat), cc = determinize(view, seat, pool2);
      var d = policy(c, seat, { cnts: cc, landlord: view.landlord, last: lastD }, 0); if (!d) return lastD ? { pass: true } : { cards: descToCards(moves[0], hand) };
      return { cards: descToCards(d, hand) };
    }
    // 困难: PIMC
    var limit = opts.timeMs || 400, t0 = Date.now(), pool = unseenPool(view, seat);
    var n = total(c); for (i = 0; i < moves.length; i++) if (moves[i].n === n) return { cards: descToCards(moves[i], hand) }; // 能走完直接走
    // 候选: 启发式排序后取前若干个 + 不出
    var cand = [], scored = [];
    cnts = determinize(view, seat, pool);
    var ctx0 = { cnts: cnts, landlord: view.landlord, last: lastD };
    var base = minHands(c);
    moves.forEach(function (d) { applyD(c, d); var mh = minHands(c); undoD(c, d); var s = mh * 10 + d.r * 0.4 - d.n * 0.5 + (isBomb(d) ? 12 : 0); scored.push({ d: d, s: s }); });
    scored.sort(function (a, b) { return a.s - b.s; });
    var mx = lastD ? 7 : 9, seenKey = {};
    scored.forEach(function (x) { var k = x.d.t + x.d.r + x.d.n; if (cand.length < mx && !seenKey[k + JSON.stringify(x.d.c)]) { seenKey[k + JSON.stringify(x.d.c)] = 1; cand.push(x.d); } });
    // 保证包含最小炸弹/火箭(若存在)作为备选
    var bombs = moves.filter(isBomb).sort(function (a, b) { return a.r - b.r; }); if (bombs.length && cand.indexOf(bombs[0]) < 0) cand.push(bombs[0]);
    var opts2 = cand.slice(); if (lastD) opts2.push(null);
    if (opts2.length === 1) return opts2[0] ? { cards: descToCards(opts2[0], hand) } : { pass: true };
    var wins = new Array(opts2.length).fill(0), cnt = 0, myTeam = function (w) { return seat === view.landlord ? w === seat : (w !== 0 && w !== view.landlord); };
    do {
      var dcn = determinize(view, seat, pool);
      for (var o = 0; o < opts2.length; o++) {
        var cs = cloneCnts(dcn), d2 = opts2[o], turn = seat, newLast;
        if (d2) {
          applyD(cs[seat], d2); newLast = { t: d2.t, r: d2.r, len: d2.len, n: d2.n, seat: seat };
          if (total(cs[seat]) === 0) { wins[o]++; continue; }
          var w = simulate(cs, seat % 3 + 1, newLast, view.landlord, 160, policy, 2.5); if (myTeam(w)) wins[o]++;
        } else { // 不出
          var passes = 1, w2 = simulateFromPass(cs, seat, lastD, view.landlord); if (myTeam(w2)) wins[o]++;
        }
      }
      cnt++;
    } while (Date.now() - t0 < limit * 0.85 && cnt < 400);
    var bi = 0, bv = -1; for (i = 0; i < opts2.length; i++) { var v = wins[i] + (opts2[i] === null ? -0.01 : 0); if (v > bv) { bv = v; bi = i; } }
    var ch = opts2[bi]; return ch ? { cards: descToCards(ch, hand) } : { pass: true };
  }
  function simulateFromPass(cs, seat, lastD, landlord) { // seat 选择不出
    var next = seat % 3 + 1, passes = 1;
    // 若下家之后再有人 pass 则发牌权回到上一手出牌者(由 simulate 内的 passes 逻辑处理): 这里用 last 保留,并让 passes 起始为 1
    var ctx = { cnts: cs, landlord: landlord, last: { t: lastD.t, r: lastD.r, len: lastD.len, n: lastD.n, seat: lastD.seat } }, turn = next, steps = 0;
    while (steps++ < 160) {
      var d = policy(cs[turn], turn, ctx, 2.5);
      if (!d) { passes++; if (passes >= 2) { ctx.last = null; passes = 0; } }
      else { applyD(cs[turn], d); passes = 0; ctx.last = { t: d.t, r: d.r, len: d.len, n: d.n, seat: turn }; if (total(cs[turn]) === 0) return turn; }
      turn = turn % 3 + 1;
    }
    return 0;
  }
  function computeMove(view, seat, level, opts) {
    opts = opts || {};
    if (view.phase === 'bid') return bidMove(view, seat, level, opts);
    return playMove(view, seat, level, opts);
  }
  var API = { computeMove: computeMove, minHands: minHands, gen: gen, toCnt: toCnt, handStrength: handStrength };
  if (typeof module !== 'undefined' && module.exports) module.exports = API; else (self.GH = self.GH || {}).AIDoudizhu = API;
})();

/* ---- ai-mahjong ---- */
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

/* ---- ai-zhajinhua ---- */
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

/* ---- ai-chess ---- */
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

/* ---- ai-holdem ---- */
/* Texas Hold'em AI (virtual chips). Monte-Carlo equity vs random opponent hands, compared with pot odds.
   Level 1: loose / noisy calling station; 2: solid equity player; 3: adds value-bet sizing, semi-bluffs, and stack-aware shoves.
   computeMove(view, seat, level, opts) -> {a, to?} */
(function () {
  var H = (typeof require === 'function') ? require('./holdem.js') : GH.Holdem;
  function equity(s, seat, trials, deadline) {
    var mine = s.hands[seat]; if (!mine) return 0.3;
    var used = {}, i; mine.forEach(function (c) { used[c] = 1; }); s.board.forEach(function (c) { used[c] = 1; });
    var rest = []; for (i = 0; i < 52; i++) if (!used[i]) rest.push(i);
    var opp = 0; for (var p = 1; p <= s.n; p++) if (p !== seat && (s.status[p] === 'active' || s.status[p] === 'allin')) opp++;
    if (!opp) return 1;
    var need = 5 - s.board.length, win = 0, done = 0, len = rest.length;
    for (var t = 0; t < trials; t++) {
      if ((t & 31) === 31 && deadline && Date.now() > deadline) break;
      var k = need + opp * 2; // partial Fisher-Yates
      for (i = 0; i < k; i++) { var j = i + Math.floor(Math.random() * (len - i)), x = rest[i]; rest[i] = rest[j]; rest[j] = x; }
      var board = s.board.concat(rest.slice(0, need)), my = H.evalCards(mine.concat(board)), best = -1, ties = 1, beaten = true;
      for (var o = 0; o < opp; o++) { var sc = H.evalCards([rest[need + o * 2], rest[need + o * 2 + 1]].concat(board)); if (sc > my) { beaten = false; break; } if (sc === my) ties++; }
      if (beaten) win += 1 / ties; done++;
    }
    return done ? win / done : 0.3;
  }
  function computeMove(s, seat, level, opts) {
    opts = opts || {}; var o = H.options(s, seat); if (!o.turn) return null;
    var trials = level === 1 ? 120 : level === 2 ? 300 : 600, eq = equity(s, seat, trials, Date.now() + (opts.timeMs || 250));
    var pot = s.pot, need = o.call, stack = s.stacks[seat], oppN = 0, p;
    for (p = 1; p <= s.n; p++) if (p !== seat && s.status[p] === 'active') oppN++;
    if (level === 1) eq = Math.max(0, Math.min(1, eq + (Math.random() - 0.5) * 0.3));
    var odds = need > 0 ? need / (pot + need) : 0, r = Math.random();
    function raiseBy(frac) {
      if (!o.canRaise) return need > 0 ? { a: 'call' } : { a: 'check' };
      var to = Math.round(s.currentBet + Math.max(s.minRaise, (pot + need) * frac)); to = Math.max(o.raiseMin, Math.min(o.raiseMax, to));
      if (to >= o.raiseMax || (o.raiseMax - to) < s.bb * 2) return { a: 'allin' };
      return { a: 'raise', to: to };
    }
    var committed = need > 0 && need >= stack * 0.4; // calling is a big part of my stack
    if (need === 0) {
      if (level === 1) return eq > 0.7 && r < 0.4 ? raiseBy(0.5) : { a: 'check' };
      if (eq > 0.8) return r < 0.85 ? raiseBy(0.75 + r * 0.3) : { a: 'check' }; // sometimes slow-play
      if (eq > (level === 3 ? 0.58 : 0.64) - 0.04 * Math.max(0, 2 - oppN)) return raiseBy(level === 3 ? 0.5 : 0.4);
      if (level === 3 && oppN <= 2 && r < 0.1 && s.phase !== 'preflop') return raiseBy(0.6); // occasional bluff / probe
      return { a: 'check' };
    }
    var margin = level === 1 ? -0.04 : level === 2 ? 0.05 : 0.03;
    if (eq > 0.85 || (level === 3 && committed && eq > odds + 0.12 && eq > 0.5)) return eq > 0.88 && o.canRaise ? (r < 0.5 ? { a: 'allin' } : raiseBy(1)) : { a: 'call' };
    if (eq > 0.68 + (oppN > 2 ? 0.05 : 0) && level >= 2 && r < 0.6) return raiseBy(0.7);
    if (eq > odds + margin) return { a: 'call' };
    if (level === 3 && need <= s.bb && r < 0.12 && oppN <= 2) return { a: 'call' }; // cheap float
    return { a: 'fold' };
  }
  var API = { computeMove: computeMove, equity: equity };
  if (typeof module !== 'undefined' && module.exports) module.exports = API; else (self.GH = self.GH || {}).AIHoldem = API;
})();

/* ---- ai ---- */
/* 电脑 AI 总入口。level: 1简单 2普通 3困难;opts.timeMs 为困难档的思考时限。
   五子棋/象棋/军棋/斗地主/麻将的困难档在 ai-*.js;简单/普通档保持第一期的启发式(五子棋、象棋、军棋)。
   computeMove(game, state, seat, level) -> 走法对象(五子棋 {x,y}; 其他 {fr,fc,tr,tc}),无棋可走返回 null。
   军棋 AI 只使用 view(己方视角),不偷看对方棋子。 */
(function () {
  var Gomoku = (typeof require === 'function') ? require('./gomoku.js') : GH.Gomoku;
  var Xiangqi = (typeof require === 'function') ? require('./xiangqi.js') : GH.Xiangqi;
  var Luzhanqi = (typeof require === 'function') ? require('./luzhanqi.js') : GH.Luzhanqi;
  var req = typeof require === 'function';
  var AIG = req ? require('./ai-gomoku.js') : GH.AIGomoku;
  var AIX = req ? require('./ai-xiangqi.js') : GH.AIXiangqi;
  var AIL = req ? require('./ai-luzhanqi.js') : GH.AILuzhanqi;
  var AID = req ? require('./ai-doudizhu.js') : GH.AIDoudizhu;
  var AIM = req ? require('./ai-mahjong.js') : GH.AIMahjong;
  var AIZ = req ? require('./ai-zhajinhua.js') : GH.AIZhajinhua;
  var AICH = req ? require('./ai-chess.js') : GH.AIChess;
  var AIH = req ? require('./ai-holdem.js') : GH.AIHoldem;
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
  function computeMove(game, state, seat, level, opts) {
    level = level || 2; opts = opts || {};
    if (game === 'gomoku') return level >= 3 ? AIG.hardMove(state, seat, opts) : gomokuMove(state, seat, level);
    if (game === 'xiangqi') return level >= 3 ? AIX.hardMove(state, seat, opts) : xiangqiMove(state, seat, level);
    if (game === 'doudizhu') return AID.computeMove(state, seat, level, opts);
    if (game === 'mahjong') return AIM.computeMove(state, seat, level, opts);
    if (game === 'zhajinhua') return AIZ.computeMove(state, seat, level, opts);
    if (game === 'chess') return AICH.computeMove(state, seat, level, opts);
    if (game === 'holdem') return AIH.computeMove(state, seat, level, opts);
    if (game === 'luzhanqi') { var lv = Luzhanqi.view(state, seat); return level >= 3 ? AIL.hardMove(lv, seat, opts) : luzhanqiMove(lv, seat, level); }
    return null;
  }
  var API = { computeMove: computeMove, gomokuMove: gomokuMove, xiangqiMove: xiangqiMove, luzhanqiMove: luzhanqiMove };
  if (typeof module !== 'undefined' && module.exports) module.exports = API; else (self.GH = self.GH || {}).AI = API;
})();

  var G = (typeof globalThis !== 'undefined' ? globalThis : this);
  G.onmessage = function (e) {
    var m = e.data, mv = null, err = null;
    try { mv = GH.AI.computeMove(m.game, m.state, m.seat, m.level, m.opts); } catch (x) { err = String(x && x.stack || x); }
    G.postMessage({ id: m.id, mv: mv, err: err });
  };
})();
