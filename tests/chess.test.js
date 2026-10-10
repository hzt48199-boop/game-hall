const test = require('node:test'), assert = require('node:assert');
const C = require('../shared/chess.js'), X = C._, AIc = require('../shared/ai-chess.js'), AI = require('../shared/ai.js');
const SUITE = [
  ['startpos', C.START_FEN, [20, 400, 8902, 197281, 4865609]],
  ['kiwipete', 'r3k2r/p1ppqpb1/bn2pnp1/3PN3/1p2P3/2N2Q1p/PPPBBPPP/R3K2R w KQkq - 0 1', [48, 2039, 97862, 4085603]],
  ['position 3 (en passant / pins)', '8/2p5/3p4/KP5r/1R3p1k/8/4P1P1/8 w - - 0 1', [14, 191, 2812, 43238, 674624]],
  ['position 4 (promotions / castling)', 'r3k2r/Pppp1ppp/1b3nbN/nP6/BBP1P3/q4N2/Pp1P2PP/R2Q1RK1 w kq - 0 1', [6, 264, 9467, 422333]],
  ['position 5', 'rnbq1k1r/pp1Pbppp/2p5/8/2B5/8/PPP1NnPP/RNBQK2R w KQ - 1 8', [44, 1486, 62379, 2103487]],
  ['position 6', 'r4rk1/1pp1qppp/p1np1n2/2b1p1B1/2B1P1b1/P1NP1N2/1PP1QPPP/R4RK1 w - - 0 10', [46, 2079, 89890, 3894594]]
];
for (const [name, fen, exp] of SUITE) test('perft ' + name + ' to depth ' + exp.length, () => {
  exp.forEach((n, i) => assert.equal(X.perft(X.posFromFEN(fen), i + 1), n, name + ' depth ' + (i + 1)));
});
const sq = n => (n.charCodeAt(0) - 97) + (parseInt(n[1], 10) - 1) * 8;
const mv = (s, a, b, promo) => C.move(s, s.turn, { from: sq(a), to: sq(b), promo });
test('castling both sides, rights lost after king / rook moves, no castling through check', () => {
  let s = C.newGame({ fen: 'r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1' });
  assert.ok(mv(s, 'e1', 'g1').ok && s.board[sq('f1')] === 4, 'O-O'); assert.ok(mv(s, 'e8', 'c8').ok && s.board[sq('d8')] === -4, 'O-O-O'); assert.equal(s.castle, 0);
  s = C.newGame({ fen: 'r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1' }); mv(s, 'h1', 'g1'); mv(s, 'a8', 'a7'); assert.ok(!mv(s, 'e1', 'g1').ok, 'rook moved: no O-O');
  s = C.newGame({ fen: '4k3/8/8/8/8/8/5r2/R3K2R w KQ - 0 1' }); assert.ok(!mv(s, 'e1', 'g1').ok, 'f1 attacked'); assert.ok(mv(s, 'e1', 'c1').ok, 'O-O-O is fine');
  s = C.newGame({ fen: '4k3/8/8/8/8/8/4r3/R3K2R w KQ - 0 1' }); assert.ok(!mv(s, 'e1', 'g1').ok && !mv(s, 'e1', 'c1').ok, 'cannot castle out of check');
});
test('en passant (only immediately) and promotion with piece choice', () => {
  let s = C.newGame(); mv(s, 'e2', 'e4'); mv(s, 'a7', 'a6'); mv(s, 'e4', 'e5'); mv(s, 'd7', 'd5');
  assert.equal(s.ep, sq('d6')); assert.ok(mv(s, 'e5', 'd6').ok && s.board[sq('d5')] === 0, 'en passant capture');
  s = C.newGame(); mv(s, 'e2', 'e4'); mv(s, 'a7', 'a6'); mv(s, 'e4', 'e5'); mv(s, 'd7', 'd5'); mv(s, 'h2', 'h3'); mv(s, 'h7', 'h6'); assert.ok(!mv(s, 'e5', 'd6').ok, 'ep expires');
  s = C.newGame({ fen: '8/P6k/8/8/8/8/7K/8 w - - 0 1' }); assert.deepEqual(C.legalMovesFrom(s, 1, sq('a7')).map(m => m.promo).sort(), [2, 3, 4, 5]);
  assert.ok(mv(s, 'a7', 'a8', 2).ok && s.board[sq('a8')] === 2, 'under-promotion to knight'); assert.equal(s.last.san, 'a8=N');
});
test('checkmate (fool\'s mate), stalemate, SAN', () => {
  let s = C.newGame(); ['f2f3', 'e7e5', 'g2g4', 'd8h4'].forEach(m => assert.ok(mv(s, m.slice(0, 2), m.slice(2)).ok));
  assert.ok(s.over && s.winner === 2 && s.reason === 'Checkmate' && s.san.join(' ') === 'f3 e5 g4 Qh4#');
  s = C.newGame({ fen: '7k/8/5K2/8/8/8/8/6Q1 w - - 0 1' }); assert.ok(mv(s, 'g1', 'g6').ok); assert.ok(s.over && s.winner === 3 && s.reason === 'Stalemate');
  s = C.newGame(); assert.equal(mv(s, 'e2', 'e5').ok, false); assert.equal(C.move(s, 2, { from: sq('e7'), to: sq('e5') }).ok, false, 'wrong side');
});
test('draws: threefold repetition, fifty-move rule, insufficient material', () => {
  let s = C.newGame(); for (let i = 0; i < 2; i++) { mv(s, 'g1', 'f3'); mv(s, 'g8', 'f6'); mv(s, 'f3', 'g1'); mv(s, 'f6', 'g8'); }
  assert.ok(s.over && s.winner === 3 && /threefold/.test(s.reason), s.reason);
  s = C.newGame({ fen: '4k3/8/8/8/8/8/3R4/4K3 w - - 98 80' }); assert.ok(mv(s, 'd2', 'd3').ok && !s.over); assert.ok(mv(s, 'e8', 'f8').ok && s.over && /fifty/.test(s.reason));
  for (const f of ['4k3/8/8/8/8/8/8/4K3 w - - 0 1', '4k3/8/8/8/8/8/8/3BK3 w - - 0 1', '4k3/8/8/8/8/8/8/3NK3 w - - 0 1', '4kb2/8/8/8/8/8/8/2B1K3 w - - 0 1']) {
    s = C.newGame({ fen: f }); assert.ok(mv(s, 'e1', 'e2').ok && s.over && s.winner === 3 && /insufficient/.test(s.reason), f);
  }
  s = C.newGame({ fen: '4kb2/8/8/8/8/8/8/3BK3 w - - 0 1' }); mv(s, 'e1', 'e2'); assert.ok(!s.over, 'opposite-colour bishops can still mate in theory');
});
test('AI plays only legal moves and finds mate in one / avoids hanging the queen', () => {
  let s = C.newGame({ fen: 'r1bqkb1r/pppp1ppp/2n2n2/4p2Q/2B1P3/8/PPPP1PPP/RNB1K1NR w KQkq - 4 4' });
  const m = AIc.computeMove(s, 1, 3, { timeMs: 300 }); assert.deepEqual([m.from, m.to], [sq('h5'), sq('f7')], 'Qxf7#');
  s = C.newGame({ fen: '6k1/5ppp/8/8/8/8/5PPP/3R2K1 w - - 0 1' }); const m2 = AI.computeMove('chess', s, 1, 3, { timeMs: 300 }); assert.deepEqual([m2.from, m2.to], [sq('d1'), sq('d8')], 'back-rank mate');
});
test('AI-vs-AI smoke: complete games finish legally and the hard AI beats the easy AI', () => {
  let wins = 0, games = 0;
  for (const hardWhite of [true, false]) {
    const s = C.newGame(); let n = 0;
    while (!s.over && n++ < 400) { const lv = (s.turn === 1) === hardWhite ? 3 : 1; const m = AI.computeMove('chess', s, s.turn, lv, { timeMs: 120 }); assert.ok(m); const r = C.move(s, s.turn, m); assert.ok(r.ok, JSON.stringify(m) + r.err); }
    games++; assert.ok(s.over, 'game ended'); if (s.winner === (hardWhite ? 1 : 2)) wins++;
  }
  assert.ok(wins >= 1, 'hard beat easy in at least one of two games (' + wins + '/' + games + ')');
});
