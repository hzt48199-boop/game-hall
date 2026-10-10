const test = require('node:test'), assert = require('node:assert');
const Z = require('../shared/zhajinhua'), AI = require('../shared/ai'), AIZ = require('../shared/ai-zhajinhua'), E = require('../shared/engines');
const C = (r, q) => (r - 2) * 4 + q; // 点数 2..14, 花色 0..3
const H = (...a) => a.map(([r, q]) => C(r, q));
const ev = (cards, o) => Z.evalHand(H(...cards), o);
const seeded = seed => () => (seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296;
function game(n, cards, o) { const s = Z.newGame(Object.assign({ n, rng: seeded(7) }, o || {})); cards.forEach((h, i) => { s.cards[i + 1] = h ? H(...h) : s.cards[i + 1]; }); return s; }

test('牌型识别: 豹子/同花顺/金花/顺子/对子/单张', () => {
  assert.equal(ev([[9, 0], [9, 1], [9, 2]]).cat, 6);
  assert.equal(ev([[9, 0], [10, 0], [11, 0]]).cat, 5);
  assert.equal(ev([[2, 1], [9, 1], [13, 1]]).cat, 4);
  assert.equal(ev([[9, 0], [10, 1], [11, 2]]).cat, 3);
  assert.equal(ev([[9, 0], [9, 1], [3, 2]]).cat, 2);
  assert.equal(ev([[9, 0], [8, 1], [3, 2]]).cat, 1);
  assert.equal(ev([[9, 0], [8, 1], [3, 2]]).name, 'High card');
});
test('牌型大小顺序: 豹子 > 同花顺 > 金花 > 顺子 > 对子 > 单张(含最小豹子 > 最大同花顺)', () => {
  const hands = [[[2, 0], [2, 1], [2, 2]], [[12, 0], [13, 0], [14, 0]], [[14, 1], [13, 1], [9, 1]], [[12, 0], [13, 1], [14, 2]], [[14, 0], [14, 1], [13, 2]], [[14, 0], [13, 1], [11, 2]]];
  for (let i = 0; i + 1 < hands.length; i++) assert.ok(Z.compareHands(H(...hands[i]), H(...hands[i + 1])) > 0, '第 ' + i + ' 档应大于下一档');
});
test('A-2-3: 默认是最小的顺子(小于 2-3-4,大于对子);Q-K-A 最大;选项 off 时 A-2-3 不算顺子', () => {
  const a23 = H([14, 0], [2, 1], [3, 2]), s234 = H([2, 0], [3, 1], [4, 2]), qka = H([12, 0], [13, 1], [14, 2]), pair = H([14, 0], [14, 1], [13, 2]);
  assert.equal(Z.evalHand(a23).cat, 3);
  assert.ok(Z.compareHands(s234, a23) > 0); assert.ok(Z.compareHands(qka, s234) > 0); assert.ok(Z.compareHands(a23, pair) > 0);
  assert.equal(Z.evalHand(a23, { a23: 'off' }).cat, 1);
  assert.equal(Z.evalHand(H([14, 0], [2, 0], [3, 0])).cat, 5); // A-2-3 同花顺
  assert.equal(Z.evalHand(H([13, 0], [14, 1], [2, 2])).cat, 1); // K-A-2 不能循环
});
test('同类型比较: 对子比对子再比单张;金花/单张按最大张依次比;花色不分大小(平局)', () => {
  assert.ok(Z.compareHands(H([9, 0], [9, 1], [5, 2]), H([9, 2], [9, 3], [4, 0])) > 0);
  assert.ok(Z.compareHands(H([10, 0], [10, 1], [2, 2]), H([9, 0], [9, 1], [14, 2])) > 0);
  assert.ok(Z.compareHands(H([13, 0], [9, 0], [3, 0]), H([13, 1], [9, 1], [2, 1])) > 0);
  assert.ok(Z.compareHands(H([14, 0], [8, 1], [3, 2]), H([14, 1], [8, 2], [4, 3])) < 0);
  assert.equal(Z.compareHands(H([14, 0], [8, 1], [3, 2]), H([14, 1], [8, 2], [3, 3])), 0);
});
test('235 吃豹子: 默认关闭;开启后仅不同花 235 吃豹子,其余仍是最小单张', () => {
  const t235 = H([2, 0], [3, 1], [5, 2]), leo = H([14, 0], [14, 1], [14, 2]), pair = H([2, 0], [2, 1], [3, 2]), f235 = H([2, 0], [3, 0], [5, 0]);
  assert.ok(Z.compareHands(leo, t235) > 0); assert.ok(Z.compareHands(leo, t235, { special235: false }) > 0);
  assert.ok(Z.compareHands(t235, leo, { special235: true }) > 0);
  assert.ok(Z.compareHands(pair, t235, { special235: true }) > 0);
  assert.ok(Z.compareHands(leo, f235, { special235: true }) > 0, '同花 235 是金花,不吃豹子');
  assert.equal(Z.newGame({ n: 3 }).opts.special235, false);
});
test('开局: 每人 3 张不重复,先交底注,庄家下家先行动,视图不泄露他人牌', () => {
  const s = Z.newGame({ n: 5, dealer: 2, rng: seeded(3) }); const all = [];
  for (let p = 1; p <= 5; p++) { assert.equal(s.cards[p].length, 3); all.push(...s.cards[p]); assert.equal(s.stacks[p], 990); }
  assert.equal(new Set(all).size, 15); assert.equal(s.pot, 50); assert.equal(s.turn, 3);
  const v = Z.view(s, 1); assert.equal(v.cards, undefined); assert.equal(v.hands[1], null, '未看牌自己也看不到'); assert.ok(v.hands.every(h => h === null));
  assert.equal(JSON.stringify(v).includes(JSON.stringify(s.cards[3])), false);
  Z.move(s, 1, { a: 'look' }); const v2 = Z.view(s, 1); assert.deepEqual(v2.hands[1], s.cards[1]); assert.equal(Z.view(s, 2).hands[1], null);
});
test('下注: 暗注跟注付单注、明注付 2 倍;加注抬高单注;轮次与封顶', () => {
  const s = game(3, [[[9, 0], [8, 1], [3, 2]], null, null], { dealer: 3 }); // 座位 1 先行动
  assert.equal(s.turn, 1);
  assert.equal(Z.move(s, 2, { a: 'call' }).ok, false, '没轮到不能下注');
  assert.ok(Z.move(s, 1, { a: 'call' }).ok); assert.equal(s.stacks[1], 980); assert.equal(s.pot, 40);
  assert.ok(Z.move(s, 2, { a: 'look' }).ok); assert.ok(Z.move(s, 2, { a: 'call' }).ok); assert.equal(s.stacks[2], 970, '明注付 2×10');
  assert.ok(Z.move(s, 3, { a: 'raise', unit: 50 }).ok); assert.equal(s.unit, 50); assert.equal(s.stacks[3], 940);
  assert.equal(s.round, 2); assert.equal(s.turn, 1);
  assert.equal(Z.move(s, 1, { a: 'raise', unit: 20 }).ok, false, '不能降档/不能不加');
  assert.equal(Z.move(s, 1, { a: 'raise', unit: 37 }).ok, false, '非法档位');
  assert.ok(Z.move(s, 1, { a: 'call' }).ok); assert.equal(s.stacks[1], 930, '暗注按新单注 50');
  assert.ok(Z.move(s, 2, { a: 'call' }).ok); assert.equal(s.stacks[2], 870, '明注 2×50');
  assert.equal(Z.options(s, 3).raise.length, 1); // 只剩 100 档
});
test('看牌可随时进行且不占用回合;重复看牌被拒', () => {
  const s = game(3, [null, null, null]); const t = s.turn, other = t % 3 + 1;
  assert.ok(Z.move(s, other, { a: 'look' }).ok); assert.equal(s.turn, t); assert.equal(Z.move(s, other, { a: 'look' }).ok, false);
});
test('弃牌: 只剩一人则其赢得底池,零和结算', () => {
  const s = game(3, [null, null, null], { dealer: 3 });
  Z.move(s, 1, { a: 'call' }); Z.move(s, 2, { a: 'fold' }); assert.ok(!s.over); Z.move(s, 3, { a: 'fold' });
  assert.ok(s.over); assert.deepEqual(s.winners, [1]); assert.equal(s.scores[1], 20); assert.equal(s.scores[2], -10); assert.equal(s.scores[3], -10);
  assert.equal(s.scores.reduce((a, b) => a + b, 0), 0); assert.equal(s.showdown, false);
  assert.equal(Z.move(s, 1, { a: 'call' }).ok, false);
});
test('比牌: 需先看牌,第 2 轮起才能比(只剩两人除外);付 2×跟注;输家出局;平局发起者输;双方互相知道对方牌', () => {
  const s = game(3, [[[14, 0], [14, 1], [5, 2]], [[13, 0], [13, 1], [5, 2]], [[9, 0], [8, 1], [3, 2]]], { dealer: 3 });
  Z.move(s, 1, { a: 'look' }); assert.equal(Z.move(s, 1, { a: 'compare', target: 2 }).ok, false, '第 1 轮不能比牌');
  Z.move(s, 1, { a: 'call' }); Z.move(s, 2, { a: 'call' }); Z.move(s, 3, { a: 'call' }); assert.equal(s.round, 2);
  Z.move(s, 1, { a: 'look' }).ok; assert.equal(Z.move(s, 1, { a: 'compare', target: 9 }).ok, false);
  const before = s.stacks[1], r = Z.move(s, 1, { a: 'compare', target: 2 }); assert.ok(r.ok); assert.equal(r.loser, 2);
  assert.equal(before - s.stacks[1], 40, '明注比牌 2×(2×10)'); assert.equal(s.status[2], 'lost');
  assert.deepEqual(Z.view(s, 1).hands[2], s.cards[2], '赢家看得到输家的牌'); assert.deepEqual(Z.view(s, 2).hands[1], s.cards[1]); assert.equal(Z.view(s, 3).hands[2], null);
  // 暗牌者不能比牌
  const s2 = game(3, [null, null, null], { dealer: 3 }); Z.move(s2, 1, { a: 'call' }); Z.move(s2, 2, { a: 'call' }); Z.move(s2, 3, { a: 'call' });
  assert.equal(Z.move(s2, 1, { a: 'compare', target: 2 }).ok, false, '未看牌不能比牌');
  // 平局发起者输
  const s3 = game(2, [[[14, 0], [8, 1], [3, 2]], [[14, 1], [8, 2], [3, 3]]], { dealer: 2 });
  Z.move(s3, 1, { a: 'look' }); const r3 = Z.move(s3, 1, { a: 'compare', target: 2 }); assert.ok(r3.ok); assert.equal(r3.loser, 1); assert.ok(s3.over); assert.deepEqual(s3.winners, [2]);
});
test('比牌落败 / 弃牌者的牌在结算时不亮;开牌结算时未弃牌者亮牌', () => {
  const s = game(3, [[[14, 0], [14, 1], [5, 2]], [[13, 0], [13, 1], [5, 2]], [[9, 0], [8, 1], [3, 2]]], { dealer: 3, maxRounds: 1 });
  Z.move(s, 1, { a: 'call' }); Z.move(s, 2, { a: 'fold' }); Z.move(s, 3, { a: 'call' });
  assert.ok(s.over && s.showdown, '封顶开牌'); assert.deepEqual(s.winners, [1]);
  const v = Z.view(s, 3); assert.deepEqual(v.hands[1], s.cards[1]); assert.equal(v.hands[2], null); assert.equal(v.handNames[1], 'Pair');
});
test('封顶: 超过最大轮数自动开牌,平手平分底池', () => {
  const s = game(3, [[[14, 0], [8, 1], [3, 2]], [[14, 1], [8, 2], [3, 3]], [[2, 0], [4, 1], [7, 2]]], { dealer: 3, maxRounds: 2 });
  for (let i = 0; i < 6; i++) { assert.ok(!s.over || i === 5); if (!s.over) Z.move(s, s.turn, { a: 'call' }); }
  assert.ok(s.over && s.showdown); assert.deepEqual(s.winners.sort(), [1, 2]); assert.equal(s.scores.reduce((a, b) => a + b, 0), 0); assert.equal(s.scores[1], s.scores[2]);
  assert.ok(/Round limit/.test(s.reason));
});
test('豆不足以跟注时直接开牌;加注 / 比牌只提供买得起的选项', () => {
  const s = game(2, [[[14, 0], [14, 1], [5, 2]], [[13, 0], [13, 1], [5, 2]]], { dealer: 2, stack: 55 });
  assert.equal(s.stacks[1], 45); const o = Z.options(s, 1); assert.deepEqual(o.raise.map(x => x.unit), [20], '50 / 100 档买不起');
  assert.equal(Z.move(s, 1, { a: 'raise', unit: 50 }).ok, false);
  Z.move(s, 1, { a: 'raise', unit: 20 }); Z.move(s, 2, { a: 'call' }); assert.equal(s.round, 2); assert.ok(!s.over);
  Z.move(s, 1, { a: 'call' }); Z.move(s, 2, { a: 'call' }); // 各剩 5 豆
  assert.ok(s.over && s.showdown && /cannot afford/.test(s.reason)); assert.deepEqual(s.winners, [1]); assert.equal(s.scores[1] + s.scores[2], 0);
  assert.ok(s.stacks.every(x => x >= 0));
});
test('服务端式校验: 越界座位 / 乱格式 / 出局者 / 结束后操作都被拒绝', () => {
  const s = game(3, [null, null, null]);
  [[0, { a: 'call' }], [9, { a: 'call' }], [1.5, { a: 'call' }], [1, null], [1, { a: 5 }], [1, { a: 'fly' }], [s.turn, { a: 'raise' }], [s.turn, { a: 'compare', target: 'x' }]].forEach(([seat, mv]) => assert.equal(Z.move(s, seat, mv).ok, false, JSON.stringify([seat, mv])));
  const t = s.turn; Z.move(s, t, { a: 'fold' }); assert.equal(Z.move(s, t, { a: 'look' }).ok, false, '弃牌者不能再操作');
});
test('随机自对弈(2~6 人,三档 AI + 三种风格)全程合法并终止,筹码守恒', () => {
  for (let n = 2; n <= 6; n++) for (let h = 0; h < 60; h++) {
    const s = Z.newGame({ n, dealer: (h % n) + 1, special235: h % 5 === 0, rng: seeded(n * 1000 + h) }); let g = 0;
    while (!s.over && g++ < 500) { const seat = s.turn, mv = AI.computeMove('zhajinhua', Z.view(s, seat), seat, 1 + ((seat + h) % 3), { style: AIZ.STYLES[(seat + h) % 3] }); const r = Z.move(s, seat, mv); assert.ok(r.ok, n + '人 ' + JSON.stringify(mv) + ' ' + r.err); }
    assert.ok(s.over, '应终止'); assert.equal(s.scores.reduce((a, b) => a + b, 0), 0); assert.ok(s.stacks.every(x => x >= 0)); assert.equal(s.stacks.reduce((a, b) => a + b, 0), n * 1000);
  }
});
test('AI 手牌强度: 豹子 > 对子 > 单张,百分位随牌型单调;AI 不读取别人的牌', () => {
  const st = c => AIZ.strength(Z.evalHand(H(...c)).score);
  assert.ok(st([[2, 0], [2, 1], [2, 2]]) > 0.99); assert.ok(st([[9, 0], [9, 1], [3, 2]]) > st([[14, 0], [12, 1], [10, 2]]));
  assert.ok(st([[7, 0], [5, 1], [3, 2]]) < 0.2);
  const s = Z.newGame({ n: 3, rng: seeded(11) }); const v = Z.view(s, s.turn); const mv = AI.computeMove('zhajinhua', v, s.turn, 3, {});
  assert.ok(mv && typeof mv.a === 'string'); assert.equal(AI.computeMove('zhajinhua', v, s.turn % 3 + 1, 3, {}), null, '非自己回合返回 null');
});
test('AI 风格差异: 保守弃牌多于激进,激进加注多于保守(同一批弱/中等牌局统计)', () => {
  const stat = style => { let folds = 0, raises = 0, N = 600; for (let i = 0; i < N; i++) { const s = Z.newGame({ n: 4, rng: seeded(i + 1) }); s.seen[s.turn] = true; s.round = 3; const v = Z.view(s, s.turn); const mv = AIZ.computeMove(v, s.turn, 3, { style }); if (mv.a === 'fold') folds++; if (mv.a === 'raise') raises++; } return { folds, raises }; };
  const t = stat('tight'), a = stat('aggressive'); assert.ok(t.folds > a.folds, JSON.stringify([t, a])); assert.ok(a.raises > t.raises, JSON.stringify([t, a]));
});
test('困难 AI 对普通 AI 长期不亏(4 人桌,每手轮换座位,6000 手)', () => {
  let sum = 0, N = 6000;
  for (let h = 0; h < N; h++) {
    const s = Z.newGame({ n: 4, dealer: (h % 4) + 1, rng: seeded(h + 99) }); let g = 0; const hard = p => (p + h) % 2 === 0;
    while (!s.over && g++ < 500) { const seat = s.turn; Z.move(s, seat, AI.computeMove('zhajinhua', Z.view(s, seat), seat, hard(seat) ? 3 : 2, { style: AIZ.STYLES[(seat + h) % 3] })); }
    for (let p = 1; p <= 4; p++) if (hard(p)) sum += s.scores[p] / 2;
  }
  assert.ok(sum / N > -3, '困难档每手平均 ' + (sum / N).toFixed(2));
});
test('引擎注册: SEATS / list 含炸金花', () => { assert.equal(E.SEATS.zhajinhua, 6); assert.ok(E.list.includes('zhajinhua')); assert.equal(E.zhajinhua, Z); });
