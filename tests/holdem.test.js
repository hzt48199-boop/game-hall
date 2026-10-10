const test = require('node:test'), assert = require('node:assert');
const H = require('../shared/holdem.js'), AI = require('../shared/ai.js');
const card = s => (('23456789TJQKA'.indexOf(s[0])) * 4) + 'shcd'.indexOf(s[1]);
const ev = s => H.evalCards(s.split(' ').map(card));
test('hand evaluator: categories and ordering', () => {
  const order = ['As Kd 9h 7c 4d 3s 2h', 'As Ad 9h 7c 4d 3s 2h', 'As Ad 9h 9c 4d 3s 2h', 'As Ad Ah 7c 4d 3s 2h', '5s 4d 3h 2c Ad Kc 9s', 'As Qs 9s 7s 4s 3d 2h', 'As Ad Ah 7c 7d 3s 2h', 'As Ad Ah Ac 4d 3s 2h', '9s 8s 7s 6s 5s Kd 2h', 'As Ks Qs Js Ts 3d 2h'];
  const names = ['High card Ace', 'Pair of Aces', 'Two pair, Aces and Nines', 'Three of a kind, Aces', 'Five-high straight', 'Ace-high flush', 'Full house, Aces over Sevens', 'Four of a kind, Aces', 'Nine-high straight flush', 'Royal flush'];
  order.forEach((h, i) => { assert.equal(H.describe(ev(h)), names[i], h); if (i) assert.ok(ev(h) > ev(order[i - 1]), names[i] + ' > ' + names[i - 1]); });
});
test('hand evaluator: kickers, wheel, two trips, best-of-seven selection', () => {
  assert.ok(ev('As Ad Kh 7c 4d 3s 2h') > ev('Ac Ah Qh 7d 4s 3c 2d'), 'kicker K beats Q');
  assert.ok(ev('As Ad Kh Qc Jd 3s 2h') > ev('Ac Ah Kd Qh 9s 3c 2d'), 'third kicker');
  assert.equal(ev('As Ad Kh Kc 4d 4s 2h'), ev('Ac Ah Kd Ks 4c 4h 3d'), 'a third pair never acts as a kicker');
  assert.ok(ev('As Ad Kh Kc 4d 3s 2h') < ev('Ac Ah Kd Ks 5c 3h 2d'), 'kicker 5 beats 4');
  assert.equal(H.describe(ev('Kh Kd Ks 5c 5d 5s 2h')), 'Full house, Kings over Fives');
  assert.equal(H.describe(ev('6h 6d 6s 5c 5d 5s 2h')), 'Full house, Sixes over Fives', 'two trips: higher trips + lower trips as the pair');
  assert.equal(H.describe(ev('Ah 2h 3h 4h 5h 9d 9c')), 'Five-high straight flush');
  assert.ok(ev('6s 5d 4h 3c 2d Ad Kc') > ev('5s 4d 3h 2c Ad Kc 9s'), 'six-high beats wheel');
  assert.equal(H.describe(ev('Ah Kh Qh Jh 9h Td 2c')), 'Ace-high flush', 'no straight flush when broken');
});
function play(s, pick) { let g = 0; while (!s.over && g++ < 300) { const r = H.move(s, s.turn, pick(s, H.options(s, s.turn))); assert.ok(r.ok, r.err); } assert.ok(s.over, 'hand finished'); return s; }
test('betting: blinds, heads-up order, min-raise, check/call, all-in side pots with correct payouts', () => {
  const rigged = (n, hands, board, stacks, dealer) => { const s = H.newGame({ n, stacks, dealer: dealer || 1, sb: 10, bb: 20 }); hands.forEach((h, i) => { s.hands[i + 1] = h.split(' ').map(card); }); s.deck = board.split(' ').map(card).concat(s.deck.filter(c => !board.split(' ').map(card).includes(c) && !hands.join(' ').split(' ').map(card).includes(c))); return s; };
  // 3 players: seat1 dealer, seat2 SB, seat3 BB, seat1 acts first
  let s = rigged(3, ['As Ah', 'Kd Kh', '7c 2d'], '2h 3d 9s Jc 4h', [0, 100, 300, 500]);
  assert.equal(s.turn, 1); assert.equal(s.bets[2], 10); assert.equal(s.bets[3], 20); assert.equal(s.pot, 30);
  assert.equal(H.move(s, 2, { a: 'call' }).ok, false, 'out of turn');
  assert.ok(H.move(s, 1, { a: 'allin' }).ok); assert.ok(H.move(s, 2, { a: 'allin' }).ok); assert.ok(H.move(s, 3, { a: 'call' }).ok);
  assert.ok(s.over, 'all-in: board runs out'); assert.equal(s.board.length, 5);
  // seat1 AA (100) wins main pot 300 (3x100), seat2 KK (300) wins side pot (2x200=400) vs seat3 -> seat3 had 500, called 300
  assert.equal(s.pots.length, 2); assert.deepEqual(s.pots.map(p => p.amount), [300, 400]); assert.deepEqual(s.pots[0].winners, [1]); assert.deepEqual(s.pots[1].winners, [2]);
  assert.equal(s.stacks[1], 300); assert.equal(s.stacks[2], 400); assert.equal(s.stacks[3], 200); assert.equal(s.scores.reduce((a, b) => a + b, 0), 0);
  // heads-up: dealer is SB and acts first preflop; BB acts first after the flop
  s = H.newGame({ n: 2, dealer: 1 }); assert.equal(s.sbSeat, 1); assert.equal(s.turn, 1); assert.ok(H.move(s, 1, { a: 'call' }).ok); assert.equal(s.turn, 2); assert.ok(H.move(s, 2, { a: 'check' }).ok); assert.equal(s.phase, 'flop'); assert.equal(s.turn, 2);
  // min-raise rules
  s = H.newGame({ n: 3, dealer: 1 }); let o = H.options(s, 1); assert.equal(o.raiseMin, 40); assert.equal(H.move(s, 1, { a: 'raise', to: 30 }).ok, false, 'below min raise'); assert.ok(H.move(s, 1, { a: 'raise', to: 60 }).ok);
  o = H.options(s, 2); assert.equal(o.call, 50); assert.equal(o.raiseMin, 100, 'must raise by at least the previous raise (40)'); assert.ok(H.move(s, 2, { a: 'fold' }).ok);
  // everyone folds -> uncontested pot, no showdown reveal
  assert.ok(H.move(s, 3, { a: 'fold' }).ok); assert.ok(s.over && !s.showdown && s.winners[0] === 1); assert.equal(H.view(s, 3).hands[1], null);
  // split pot on identical hands (board plays)
  s = rigged(2, ['2c 3d', '2h 3s'], 'As Ks Qs Js Ts', [0, 1000, 1000], 1); play(s, (st, op) => op.check ? { a: 'check' } : { a: 'call' });
  assert.deepEqual(s.winners, [1, 2]); assert.equal(s.stacks[1], 1000); assert.equal(s.stacks[2], 1000);
  // three-way all-in with different stacks and a fold: odd chip + order
  s = rigged(4, ['As Ad', 'Ks Kd', 'Qs Qd', '3c 2h'], '7h 8d 9c 2s 4c', [0, 200, 600, 1000, 1000], 4); play(s, (st, op) => st.turn === 4 ? { a: 'fold' } : { a: 'allin' });
  assert.equal(s.scores.reduce((a, b) => a + b, 0), 0); assert.ok(s.pots.length >= 2);
});
test('random self-play: chips are conserved, hands always terminate, view hides hole cards', () => {
  for (let g = 0; g < 1500; g++) {
    const s = H.newGame({ n: 2 + g % 5 }), total = s.start.reduce((a, b) => a + b, 0);
    play(s, (st, op) => { const r = Math.random(); for (let p = 1; p <= st.n; p++) if (p !== st.turn) assert.equal(H.view(st, st.turn).hands[p], null); if (r < 0.15) return { a: 'fold' }; if (op.check || r < 0.5) return op.check ? { a: 'check' } : { a: 'call' }; if (op.canRaise && r < 0.85) return { a: 'raise', to: op.raiseMin + Math.floor(Math.random() * (op.raiseMax - op.raiseMin + 1)) }; return r < 0.92 ? { a: 'allin' } : (op.check ? { a: 'check' } : { a: 'call' }); });
    assert.equal(s.stacks.reduce((a, b) => a + b, 0), total, 'chips conserved'); assert.equal(s.scores.reduce((a, b) => a + b, 0), 0);
  }
});
test('AI-vs-AI smoke: 6-seat table, 150 hands, only legal moves, stacks carried over', () => {
  let stacks, hands = 0;
  for (let h = 0; h < 150; h++) {
    const s = H.newGame({ n: 6, stacks, dealer: h % 6 + 1, handNo: h + 1 }); let g = 0;
    while (!s.over && g++ < 300) { const seat = s.turn, mvv = AI.computeMove('holdem', H.view(s, seat), seat, 1 + seat % 3, { timeMs: 30 }); assert.ok(mvv, 'AI returns an action'); const r = H.move(s, seat, mvv); assert.ok(r.ok, JSON.stringify(mvv) + r.err); }
    assert.ok(s.over); stacks = H.nextStacks(s); hands++;
  }
  assert.equal(hands, 150);
});
