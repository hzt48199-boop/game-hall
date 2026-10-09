/* AI 强度基准: node tests/ai-bench.js <gomoku|xiangqi|luzhanqi|doudizhu|mahjong|all> [局数=20] [--vs=legacy3|legacy2|...] [--ms=毫秒]
   新 AI(困难档,出厂时限)对第一期旧 AI / 普通档,双方轮流执先后手。多进程并行。结果按真实对局统计,不做任何挑选。 */
const { Worker, isMainThread, parentPort, workerData } = require('worker_threads');
const path = require('path');
const E = require('../shared/engines');
const AI = require('../shared/ai');
const LEG = require('./legacy-ai');

function newAIMove(game, state, seat, ms) { return AI.computeMove(game, state, seat, 3, { timeMs: ms }); }

/* ---------- 单局 ---------- */
function playGomoku(newSeat, vs, ms) {
  const G = E.gomoku, s = G.newGame(); let maxT = 0;
  while (!s.over) {
    const seat = s.turn; let mv, t = Date.now();
    if (seat === newSeat) { mv = newAIMove('gomoku', s, seat, ms); maxT = Math.max(maxT, Date.now() - t); } else mv = LEG.gomokuMove(s, seat, vs);
    const r = G.move(s, seat, mv); if (!r.ok) throw new Error('非法走法 ' + JSON.stringify(mv) + ' ' + r.err);
  }
  return { res: s.winner === newSeat ? 'W' : s.winner === 3 ? 'D' : 'L', plies: s.moves.length, maxT, reason: s.reason };
}
function playXiangqi(newSeat, vs, ms) {
  const X = E.xiangqi, s = X.newGame(); let maxT = 0, plies = 0;
  while (!s.over && plies < 300) {
    const seat = s.turn; let mv, t = Date.now();
    if (seat === newSeat) { mv = newAIMove('xiangqi', s, seat, ms); maxT = Math.max(maxT, Date.now() - t); } else mv = LEG.xiangqiMove(s, seat, vs);
    if (!mv) { X.resign(s, seat); break; }
    const r = X.move(s, seat, mv); if (!r.ok) throw new Error('非法走法 ' + JSON.stringify(mv) + ' ' + r.err);
    plies++;
  }
  if (!s.over) return { res: 'D', plies, maxT, reason: '300 步未分胜负(记和)' };
  return { res: s.winner === newSeat ? 'W' : s.winner === 3 ? 'D' : 'L', plies, maxT, reason: s.reason };
}
function playLuzhanqi(newSeat, vs, ms) {
  const L = E.luzhanqi, s = L.newGame(); L.setup(s, 1, L.randomLayout()); L.setup(s, 2, L.randomLayout()); let maxT = 0, plies = 0;
  while (!s.over && plies < 500) {
    const seat = s.turn; let mv, t = Date.now();
    if (seat === newSeat) { mv = AI.computeMove('luzhanqi', s, seat, 3, { timeMs: ms }); maxT = Math.max(maxT, Date.now() - t); } else mv = LEG.luzhanqiMove(L.view(s, seat), seat, vs);
    if (!mv) { L.resign(s, seat); break; }
    const r = L.move(s, seat, mv); if (!r.ok) throw new Error('非法走法 ' + JSON.stringify(mv) + ' ' + r.err);
    plies++;
  }
  if (!s.over) return { res: 'D', plies, maxT, reason: '步数上限(记和)' };
  return { res: s.winner === newSeat ? 'W' : s.winner === 3 ? 'D' : 'L', plies, maxT, reason: s.reason };
}
/* 斗地主: 新 AI 占 1 或 2 个座位 vs 其余座位的对照 AI(level: 1 简单随机合法牌 / 2 普通)。按"队伍"计胜负。 */
function playDoudizhu(idx, vs, ms) {
  const D = E.doudizhu; let seed = 7919 * (idx + 1); const rng = () => (seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296;
  const s = D.newGame({ rng });
  // 偶数局: 新 AI 做地主(座位由叫分决定,这里让新 AI 固定占座位 1);奇数局: 新 AI 占座位 2、3(合作农民)的对局模拟
  const newSeats = (idx % 3 === 0) ? [1] : (idx % 3 === 1) ? [2] : [3];
  let maxT = 0, steps = 0;
  while (!s.over && steps < 600) {
    const seat = s.turn, v = D.view(s, seat), isNew = newSeats.indexOf(seat) >= 0; let mv, t = Date.now();
    if (isNew) { mv = AI.computeMove('doudizhu', v, seat, 3, { timeMs: ms }); maxT = Math.max(maxT, Date.now() - t); } else mv = AI.computeMove('doudizhu', v, seat, vs, { timeMs: 50 });
    const r = D.move(s, seat, mv); if (!r.ok) throw new Error('非法 ' + JSON.stringify(mv) + ' ' + r.err);
    steps++;
  }
  // 新 AI 与地主同队=和地主一方;统一统计"新 AI 个人是否获胜"
  return { res: s.winners.indexOf(newSeats[0]) >= 0 ? 'W' : 'L', plies: s.plays.length, maxT, reason: s.reason };
}
function playMahjong(idx, vs, ms) {
  const M = E.mahjong; let seed = 104729 * (idx + 1); const rng = () => (seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296;
  const s = M.newGame({ rng, dealer: 1 + (idx % 4) }); const newSeat = 1 + (idx % 4); let maxT = 0, steps = 0;
  while (!s.over && steps < 2000) {
    const o = M.options(s, s.turn); const seat = s.turn, v = M.view(s, seat); let mv, t = Date.now();
    if (seat === newSeat) { mv = AI.computeMove('mahjong', v, seat, 3, { timeMs: ms }); maxT = Math.max(maxT, Date.now() - t); } else mv = AI.computeMove('mahjong', v, seat, vs, { timeMs: 30 });
    const r = M.move(s, seat, mv); if (!r.ok) throw new Error('非法 ' + JSON.stringify(mv) + ' ' + r.err);
    steps++;
  }
  return { res: s.winner === newSeat ? 'W' : s.winner === 0 ? 'D' : 'L', plies: steps, maxT, score: s.scores[newSeat], reason: s.reason };
}
const RUN = { gomoku: playGomoku, xiangqi: playXiangqi, luzhanqi: playLuzhanqi, doudizhu: playDoudizhu, mahjong: playMahjong };

if (!isMainThread) {
  const { game, i, vs, ms } = workerData;
  const side = 1 + (i % 2);
  try { const r = (game === 'doudizhu' || game === 'mahjong') ? RUN[game](i, vs, ms) : RUN[game](side, vs, ms); parentPort.postMessage(Object.assign({ game, i, side, vs }, r)); }
  catch (e) { parentPort.postMessage({ game, i, error: e.stack }); }
} else {
  const arg = process.argv.slice(2), games = arg[0] && arg[0] !== 'all' ? [arg[0]] : ['gomoku', 'xiangqi', 'luzhanqi', 'doudizhu', 'mahjong'];
  const n = +(arg.find(a => /^\d+$/.test(a)) || 20);
  const opt = k => (arg.find(a => a.startsWith('--' + k + '=')) || '').split('=')[1];
  const defMs = { gomoku: 1500, xiangqi: 2000, luzhanqi: 1000, doudizhu: 400, mahjong: 300 };
  const POOL = +(opt('par') || Math.max(1, require('os').cpus().length - 1));
  (async () => {
    for (const game of games) {
      const vsList = opt('vs') ? [opt('vs')] : (game === 'gomoku' || game === 'xiangqi' || game === 'luzhanqi') ? ['3', '2'] : ['1', '2'];
      const ms = +(opt('ms') || defMs[game]);
      for (const vs of vsList) {
        const jobs = []; for (let i = 0; i < n; i++) jobs.push(i);
        const results = []; let running = 0, next = 0;
        await new Promise(done => {
          const launch = () => {
            while (running < POOL && next < jobs.length) {
              const i = jobs[next++]; running++;
              const w = new Worker(__filename, { workerData: { game, i, vs: +vs, ms } });
              w.on('message', m => { results.push(m); }); w.on('error', e => results.push({ error: String(e) }));
              w.on('exit', () => { running--; if (next >= jobs.length && running === 0) done(); else launch(); });
            }
          }; launch();
        });
        const err = results.filter(r => r.error); if (err.length) console.log('错误:', err[0].error);
        const ok = results.filter(r => !r.error), W = ok.filter(r => r.res === 'W').length, D = ok.filter(r => r.res === 'D').length, L = ok.filter(r => r.res === 'L').length;
        const bySide = s => { const a = ok.filter(r => r.side === s); return a.length ? a.filter(r => r.res === 'W').length + '/' + a.length : '-'; };
        const maxT = Math.max(...ok.map(r => r.maxT || 0));
        const label = { gomoku: { 3: '第一期旧困难(深度2)', 2: '旧普通档' }, xiangqi: { 3: '第一期旧困难(深度3)', 2: '旧普通档' }, luzhanqi: { 3: '旧困难', 2: '旧普通' }, doudizhu: { 1: '简单(随机合法出牌)', 2: '普通(规则启发式)' }, mahjong: { 1: '简单', 2: '普通' } }[game][vs];
        const extra = game === 'mahjong' ? ' 平均得分 ' + (ok.reduce((a, r) => a + (r.score || 0), 0) / (ok.length || 1)).toFixed(2) : '';
        console.log(`[${game}] 新困难AI(${ms}ms/步) vs ${label}: ${n} 局 → 胜 ${W} 负 ${L} 和 ${D}  胜率 ${(100 * W / (ok.length || 1)).toFixed(0)}%  (先手方胜 ${bySide(1)} 后手方胜 ${bySide(2)}) 单步最长 ${maxT}ms${extra}`);
        if (process.env.VERBOSE) ok.forEach(r => console.log('  ', JSON.stringify(r)));
      }
    }
  })();
}
