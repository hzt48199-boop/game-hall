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
