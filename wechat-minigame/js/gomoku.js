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
    if (s.over) return { ok: false, err: '游戏已结束' };
    if (seat !== s.turn) return { ok: false, err: '还没轮到你' };
    if (!mv || !Number.isInteger(mv.x) || !Number.isInteger(mv.y) || !inb(mv.x, mv.y)) return { ok: false, err: '落子位置无效' };
    if (s.board[mv.y * N + mv.x] !== 0) return { ok: false, err: '这里已经有棋子' };
    s.board[mv.y * N + mv.x] = seat;
    s.moves.push({ x: mv.x, y: mv.y, p: seat });
    var line = findLine(s.board, mv.x, mv.y, seat);
    if (line) { s.over = true; s.winner = seat; s.winLine = line; s.reason = line.length > 5 ? '长连获胜' : '五连获胜'; }
    else if (s.moves.length >= N * N) { s.over = true; s.winner = 3; s.reason = '棋盘已满,和棋'; }
    else s.turn = 3 - seat;
    return { ok: true };
  }
  function resign(s, seat) { if (s.over) return; s.over = true; s.winner = 3 - seat; s.reason = '对方认输/离开'; }
  function view(s) { return s; }
  var API = { id: 'gomoku', name: '五子棋', N: N, newGame: newGame, move: move, resign: resign, view: view, findLine: findLine, inb: inb };
  if (typeof module !== 'undefined' && module.exports) module.exports = API; else (self.GH = self.GH || {}).Gomoku = API;
})();
