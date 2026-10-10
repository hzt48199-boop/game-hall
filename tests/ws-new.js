/* Headless WebSocket room tests for International Chess and Texas Hold'em (needs a running server: PORT=8081 node server/server.js) */
const WebSocket = require('../server/node_modules/ws');
const AI = require('../shared/ai'); const C = require('../shared/chess'); const H = require('../shared/holdem');
const URL = process.env.WS_URL || 'ws://127.0.0.1:8081';
const sleep = ms => new Promise(r => setTimeout(r, ms));
function bot(name) {
  const b = { name, token: null, last: null, errs: [], waiters: [] };
  b.connect = () => new Promise(res => { b.ws = new WebSocket(URL); b.ws.on('open', () => b.ws.send(JSON.stringify({ t: 'hello', name, token: b.token })));
    b.ws.on('message', d => { const m = JSON.parse(d); if (m.t === 'welcome') { b.token = m.token; res(); } if (m.t === 'err') b.errs.push(m); if (m.t === 'room') { b.last = m; b.waiters = b.waiters.filter(w => !w(m)); } }); });
  b.send = o => b.ws.send(JSON.stringify(o));
  b.until = (f, ms = 15000) => new Promise((res, rej) => { if (b.last && f(b.last)) return res(b.last); const to = setTimeout(() => rej(new Error('timeout waiting (' + name + ')')), ms); b.waiters.push(m => f(m) && (clearTimeout(to), res(m), true)); });
  return b;
}
const ok = (c, m) => { if (!c) throw new Error('FAIL ' + m); console.log('  ✔', m); };
const sq = n => (n.charCodeAt(0) - 97) + (parseInt(n[1], 10) - 1) * 8;
(async () => {
  // ---- chess: friend room, illegal moves rejected, reconnect, fool's mate, replay with the local engine ----
  const A = bot('ChessA'), B = bot('ChessB'); await A.connect(); await B.connect();
  A.send({ t: 'create', game: 'chess' }); const rm = await A.until(m => m.code && m.game === 'chess'); ok(/^\d{6}$/.test(rm.code), 'chess room code ' + rm.code);
  B.send({ t: 'join', code: rm.code }); await Promise.all([A.until(m => m.status === 'playing'), B.until(m => m.status === 'playing')]);
  const white = A.last.seat === 1 ? A : B, black = white === A ? B : A;
  black.send({ t: 'move', move: { from: sq('e7'), to: sq('e5') } }); await sleep(200); ok(black.errs.length > 0, 'out-of-turn chess move rejected: ' + (black.errs[0] && black.errs[0].msg));
  white.send({ t: 'move', move: { from: sq('e2'), to: sq('e5') } }); await sleep(200); ok(white.errs.length > 0, 'illegal chess move rejected: ' + (white.errs[0] && white.errs[0].msg));
  const play = async (p, a, b) => { const n = p.last.state.count; p.send({ t: 'move', move: { from: sq(a), to: sq(b) } }); await Promise.all([A, B].map(x => x.until(m => m.state.count === n + 1))); };
  await play(white, 'f2', 'f3'); await play(black, 'e7', 'e5');
  black.ws.terminate(); await sleep(250); await black.connect(); const back = await black.until(m => m.state && m.state.count === 2); ok(back.seat === 2, 'black reconnected with the token, position restored');
  await play(white, 'g2', 'g4'); await play(black, 'd8', 'h4');
  const fin = await A.until(m => m.state.over); ok(fin.state.winner === 2 && fin.state.reason === 'Checkmate', "fool's mate: " + fin.state.reason);
  const local = C.newGame(); ['f2f3', 'e7e5', 'g2g4', 'd8h4'].forEach(m => C.move(local, local.turn, { from: sq(m.slice(0, 2)), to: sq(m.slice(2)) })); ok(JSON.stringify(local.board) === JSON.stringify(fin.state.board), 'server board equals local engine replay');
  // resign
  const R1 = bot('R1'), R2 = bot('R2'); await R1.connect(); await R2.connect(); R1.send({ t: 'create', game: 'chess' }); const r2 = await R1.until(m => m.code); R2.send({ t: 'join', code: r2.code }); await R2.until(m => m.status === 'playing'); R1.send({ t: 'resign' }); const rs = await R2.until(m => m.state.over); ok(rs.state.winner === R2.last.seat, 'resign gives the opponent the win');
  // quick match pairs two humans
  const Q1 = bot('Q1'), Q2 = bot('Q2'); await Q1.connect(); await Q2.connect(); Q1.send({ t: 'match', game: 'chess' }); await sleep(100); Q2.send({ t: 'match', game: 'chess' }); const qm = await Q1.until(m => m.status === 'playing'); ok(qm.game === 'chess', 'chess quick match paired two players');
  // ---- hold'em: 1 human + bots, hole cards hidden, next hand carries stacks ----
  const P = bot('Poker1'); await P.connect(); P.send({ t: 'create', game: 'holdem' }); const hr = await P.until(m => m.code && m.game === 'holdem');
  P.send({ t: 'setcap', n: 4 }); const capd = await P.until(m => m.nSeats === 4); ok(capd.nSeats === 4, 'host set the table to 4 seats');
  P.send({ t: 'start' }); await P.until(m => m.status === 'playing');
  const playHand = async (p, label) => { let acts = 0, last = null; while (true) { const m = p.last, s = m.state; if (s.over) return s; if (s.turn === m.seat && s.seq !== last) { const o = H.options(s, m.seat); const mv = AI.computeMove('holdem', s, m.seat, 2, { timeMs: 30 }); last = s.seq; p.send({ t: 'move', move: mv }); acts++; } await sleep(40); } };
  let s1 = await playHand(P, 'hand 1'); ok(s1.over && s1.scores.reduce((a, b) => a + b, 0) === 0, 'hand 1 finished, zero-sum scores ' + JSON.stringify(s1.scores));
  ok(s1.hands.every((h, i) => i === 0 || i === P.last.seat || !h || s1.showdown), 'other players\' hole cards are not in my snapshot unless shown down');
  ok(s1.hands[P.last.seat] && s1.hands[P.last.seat].length === 2, 'I can see my own hole cards'); ok(!('deck' in s1), 'deck never sent');
  const stacksAfter = s1.stacks.slice(); P.send({ t: 'again' }); const h2 = await P.until(m => m.state.handNo === 2 && !m.state.over); ok(h2.state.handNo === 2 && h2.state.start.every((v, i) => i === 0 || v === (stacksAfter[i] < 20 ? 1000 : stacksAfter[i])), 'next hand carries stacks over');
  // two humans, one disconnects -> computer takes over, hand still ends
  const U1 = bot('PokerU1'), U2 = bot('PokerU2'); await U1.connect(); await U2.connect(); U1.send({ t: 'create', game: 'holdem' }); const ur = await U1.until(m => m.code); U1.send({ t: 'setcap', n: 3 }); await U1.until(m => m.nSeats === 3); U2.send({ t: 'join', code: ur.code }); await U2.until(m => m.code === ur.code); U1.send({ t: 'start' });
  await Promise.all([U1.until(m => m.status === 'playing'), U2.until(m => m.status === 'playing')]); U2.ws.terminate();
  const s2 = await playHand(U1, 'hand with a leaver'); ok(s2.over, 'hand completed after a player disconnected (computer / auto-play took over)');
  // heads-up friend room: 2 humans no bots
  const V1 = bot('V1'), V2 = bot('V2'); await V1.connect(); await V2.connect(); V1.send({ t: 'create', game: 'holdem' }); const vr = await V1.until(m => m.code); V1.send({ t: 'setcap', n: 2 }); await V1.until(m => m.nSeats === 2); V2.send({ t: 'join', code: vr.code });
  await Promise.all([V1.until(m => m.status === 'playing'), V2.until(m => m.status === 'playing')]);
  let hu = 0; while (!V1.last.state.over && hu++ < 200) { for (const p of [V1, V2]) { const s = p.last.state; if (!s.over && s.turn === p.last.seat) { const o = H.options(s, p.last.seat); const seq = s.seq; p.send({ t: 'move', move: o.check ? { a: 'check' } : { a: 'call' } }); await Promise.all([V1, V2].map(x => x.until(m => m.state.seq !== seq || m.state.over))); } } await sleep(20); }
  ok(V1.last.state.over && V2.last.state.over && JSON.stringify(V1.last.state.scores) === JSON.stringify(V2.last.state.scores), 'heads-up hand between two humans: both clients agree');
  const bad = V1.last.seat === V1.last.state.turn ? V2 : V1; bad.send({ t: 'move', move: { a: 'fold' } }); await sleep(150);
  console.log('WS NEW PASSED'); process.exit(0);
})().catch(e => { console.log('WS NEW FAILED', e.stack || e); process.exit(1); });
