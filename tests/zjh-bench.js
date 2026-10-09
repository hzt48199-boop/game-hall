/* 炸金花 AI 强度基准: node tests/zjh-bench.js [手数=3000]
   4 人桌: 2 个"测试档"AI 对 2 个"对照档"AI,座位逐手轮换;报告测试档每手平均净得欢乐豆(每手每人带入 1000,底注 10)。零和,0 表示势均力敌。 */
const Z = require('../shared/zhajinhua'), AI = require('../shared/ai');
const HANDS = +process.argv[2] || 3000;
function run(testLv, ctlLv, hands) {
  let sumT = 0, nT = 0, sq = 0, ends = 0, foldWins = 0;
  for (let h = 0; h < hands; h++) {
    const s = Z.newGame({ n: 4, dealer: (h % 4) + 1 });
    const lv = p => ((p + h) % 2 === 0 ? testLv : ctlLv), isT = p => (p + h) % 2 === 0;
    let guard = 0;
    while (!s.over && guard++ < 400) {
      const seat = s.turn, v = Z.view(s, seat);
      let mv = AI.computeMove('zhajinhua', v, seat, lv(seat), { style: ['tight', 'aggressive', 'bluff'][(seat + h) % 3] });
      let r = Z.move(s, seat, mv); if (!r.ok) throw new Error('AI 非法着法 ' + JSON.stringify(mv) + ' ' + r.err);
    }
    if (!s.over) throw new Error('未终止');
    let t = 0; for (let p = 1; p <= 4; p++) if (isT(p)) t += s.scores[p]; t /= 2; sumT += t; sq += t * t; nT++; if (!s.showdown) foldWins++;
  }
  const mean = sumT / nT, sd = Math.sqrt(sq / nT - mean * mean), se = sd / Math.sqrt(nT);
  return { mean, se, foldRate: foldWins / hands };
}
const pairs = [[3, 2], [3, 1], [2, 1], [3, 3]];
const NAME = { 1: '简单', 2: '普通', 3: '困难' };
for (const [a, b] of pairs) { const r = run(a, b, HANDS); console.log(`${NAME[a]} 对 ${NAME[b]}: 测试档每手平均 ${r.mean >= 0 ? '+' : ''}${r.mean.toFixed(1)} 豆(±${(1.96 * r.se).toFixed(1)} 95%区间),${HANDS} 手,不开牌结束占 ${(r.foldRate * 100).toFixed(0)}%`); }
