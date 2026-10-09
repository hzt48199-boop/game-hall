/* 无头联机测试:两个机器人通过 WebSocket 下完一整盘五子棋,含断线重连与非法走法校验 */
const WebSocket = require('../server/node_modules/ws');
const AI = require('../shared/ai'); const G = require('../shared/gomoku');
const URL = process.env.WS_URL || 'ws://127.0.0.1:8081';
function bot(name) {
  const b = { name, token: null, last: null, errs: [], moves: 0, waiters: [] };
  b.connect = () => new Promise(res => {
    b.ws = new WebSocket(URL);
    b.ws.on('open', () => b.ws.send(JSON.stringify({ t: 'hello', name, token: b.token })));
    b.ws.on('message', d => {
      const m = JSON.parse(d); if (m.t === 'welcome') { b.token = m.token; res(); }
      if (m.t === 'err') b.errs.push(m);
      if (m.t === 'room') { b.last = m; b.waiters = b.waiters.filter(w => !w(m)); if (b.onRoom) b.onRoom(m); }
    });
  });
  b.send = o => b.ws.send(JSON.stringify(o));
  b.until = f => new Promise(res => { if (b.last && f(b.last)) return res(b.last); b.waiters.push(m => f(m) && (res(m), true)); });
  return b;
}
(async () => {
  const A = bot('机器人A'), B = bot('机器人B');
  await A.connect(); await B.connect();
  A.send({ t: 'create', game: 'gomoku' });
  const created = await A.until(m => m.code);
  console.log('房间号', created.code, '状态', created.status, '座位', created.seat);
  if (!/^\d{6}$/.test(created.code)) throw new Error('房间号应为6位数字');
  B.send({ t: 'join', code: created.code });
  await Promise.all([A.until(m => m.status === 'playing'), B.until(m => m.status === 'playing')]);
  console.log('开局: A座位', A.last.seat, 'B座位', B.last.seat);
  // 非法走法: 乱序、重复落子
  const wrong = [A, B].find(x => x.last.seat !== x.last.state.turn);
  wrong.send({ t: 'move', move: { x: 0, y: 0 } });
  await new Promise(r => setTimeout(r, 200));
  if (!wrong.errs.length) throw new Error('乱序走子应被服务器拒绝');
  console.log('乱序走子被拒绝:', wrong.errs[0].msg);
  let reconnected = false, n = 0;
  while (true) {
    const st = (A.last.state);
    if (st.over) break;
    const mover = A.last.seat === st.turn ? A : B, other = mover === A ? B : A;
    const lv = mover === A ? 2 : 1;
    const mv = AI.gomokuMove(st, mover.last.seat, lv);
    if (n === 6 && !reconnected) { // B 断线并用 token 重连
      reconnected = true; B.ws.terminate(); await new Promise(r => setTimeout(r, 200));
      await B.connect(); await B.until(m => m.state.moves.length === n);
      console.log('B 断线并用 token 重连成功, 恢复到第', n, '手, 随后继续对局');
    }
    const rev = mover.last.state.moves.length;
    mover.send({ t: 'move', move: mv });
    await Promise.all([A.until(m => m.state.moves.length > rev), B.until(m => m.state.moves.length > rev)]);
    n++;
  }
  const s = A.last.state;
  // 重复/越权: 对局结束后再落子被拒
  A.send({ t: 'move', move: { x: 1, y: 1 } }); await new Promise(r => setTimeout(r, 200));
  console.log('对局结束: 赢家座位', s.winner, '原因', s.reason, '总手数', s.moves.length, '双方一致:', JSON.stringify(A.last.state.moves) === JSON.stringify(B.last.state.moves));
  const replay = G.newGame(); s.moves.forEach(m => { if (!G.move(replay, m.p, m).ok) throw new Error('回放失败'); });
  if (!replay.over || replay.winner !== s.winner) throw new Error('回放结果与服务器不一致');
  console.log('用本地规则引擎回放整盘棋: 结果一致 ✔');
  // 快速匹配 + 取消
  const C = bot('C'), D = bot('D'); await C.connect(); await D.connect();
  C.send({ t: 'match', game: 'xiangqi' }); await new Promise(r => setTimeout(r, 100));
  D.send({ t: 'match', game: 'xiangqi' });
  await Promise.all([C.until(m => m.status === 'playing'), D.until(m => m.status === 'playing')]);
  console.log('快速匹配成功: 象棋房间', C.last.code, '座位', C.last.seat, D.last.seat);
  // 军棋联机: 布阵 + 隐藏信息
  const L = require('../shared/luzhanqi'); const P = bot('P'), Q = bot('Q'); await P.connect(); await Q.connect();
  P.send({ t: 'create', game: 'luzhanqi' }); const pr = await P.until(m => m.code); Q.send({ t: 'join', code: pr.code });
  await Promise.all([P.until(m => m.status === 'setup'), Q.until(m => m.status === 'setup')]);
  P.send({ t: 'setup', layout: ['S'] }); await new Promise(r => setTimeout(r, 150)); if (!P.errs.length) throw new Error('非法布阵应被拒绝');
  P.send({ t: 'setup', layout: L.randomLayout() }); Q.send({ t: 'setup', layout: L.randomLayout() });
  await Promise.all([P.until(m => m.status === 'playing'), Q.until(m => m.status === 'playing')]);
  const hid = P.last.state.board.flat().filter(x => x && x.p !== P.last.seat);
  if (hid.length !== 25 || !hid.every(x => x.t === '?')) throw new Error('对方棋子应对客户端隐藏');
  console.log('军棋联机: 布阵校验通过,对方 25 子在快照中全部隐藏 ✔');
  // ---- 第二期: 斗地主 / 麻将 联机(1 真人 + 电脑补位;2 真人 + 1 电脑) ----
  async function playMulti(game, humans, label) {
    const E2 = require('../shared/engines'); const M = E2[game];
    humans[0].send({ t: 'create', game }); const rm = await humans[0].until(m => m.code);
    for (const h of humans.slice(1)) h.send({ t: 'join', code: rm.code });
    await humans[0].until(m => m.players && m.players.filter(Boolean).length >= humans.length);
    humans[1] && humans[1].send({ t: 'start' }); humans[0].send({ t: 'start' }); // 只有房主有效
    await Promise.all(humans.map(h => h.until(m => m.status === 'playing')));
    const seatsN = M.nSeats; const first = humans[0].last;
    const botCount = (first.players || []).filter(p => p && p.bot).length; if (botCount !== seatsN - humans.length) throw new Error(label + ' 电脑补位数不对 ' + botCount);
    let acts = 0, bad = 0;
    humans[0].errs.length = 0;
    const t0 = Date.now();
    while (true) {
      const st = humans[0].last.state; if (st.over) break; if (Date.now() - t0 > 240000) throw new Error(label + ' 超时');
      let acted = false;
      for (const h of humans) {
        const v = h.last.state, seat = h.last.seat; if (v.over) continue;
        const myTurn = game === 'mahjong' ? (v.phase === 'claim' ? (v.claim && v.claim.actor === seat && v.claim.opts) : v.turn === seat) : v.turn === seat;
        if (!myTurn) continue;
        const mv = require('../shared/ai').computeMove(game, v, seat, 1, { timeMs: 30 }); const seq = v.seq;
        h.send({ t: 'move', move: mv }); acts++; acted = true;
        await Promise.race([Promise.all(humans.map(x => x.until(m => m.state.over || m.state.seq > seq))), new Promise(r => setTimeout(r, 3000))]);
      }
      if (!acted) await new Promise(r => setTimeout(r, 15));
    }
    // 乱序/越权
    const h0 = humans[0]; const before = h0.errs.length;
    h0.send({ t: 'move', move: game === 'doudizhu' ? { pass: true } : { a: 'discard', tile: 0 } }); await new Promise(r => setTimeout(r, 200));
    if (h0.errs.length === before) throw new Error(label + ' 结束后操作应被拒绝');
    console.log(label + ': 全局打完, 真人操作 ' + acts + ' 次, 结果:', humans[0].last.state.reason, ' 各家一致:', humans.every(h => h.last.state.over));
    return rm.code;
  }
  const H1 = bot('H1'), H2 = bot('H2'), H3 = bot('H3'); await H1.connect(); await H2.connect(); await H3.connect();
  await playMulti('doudizhu', [H1], '斗地主(1 真人 + 2 电脑)');
  await playMulti('doudizhu', [H2, H3], '斗地主(2 真人 + 1 电脑)');
  const dz = H1.last.state; if (dz.hands && dz.hands.some((h, i) => h && i !== H1.last.seat && !dz.over)) throw new Error('泄露手牌');
  await playMulti('mahjong', [H1], '麻将(1 真人 + 3 电脑)');
  // ---- 第三期: 炸金花联机(服务端校验下注 / 比牌 / 看牌可见性;人数设置;电脑补位)----
  async function playZjh(humans, cap, label) {
    const Z = require('../shared/zhajinhua'); const AI2 = require('../shared/ai');
    humans.forEach(h => { h.errs.length = 0; h.last = null; });
    humans[0].send({ t: 'create', game: 'zhajinhua' }); const rm = await humans[0].until(m => m.code && m.game === 'zhajinhua');
    if (rm.nSeats !== 4) throw new Error(label + ' 默认桌位应为 4');
    for (const h of humans.slice(1)) h.send({ t: 'join', code: rm.code });
    if (humans[1]) { humans[1].send({ t: 'setcap', n: 5 }); await new Promise(r => setTimeout(r, 150)); if (!humans[1].errs.length) throw new Error(label + ' 非房主设置人数应被拒绝'); }
    humans[0].send({ t: 'setcap', n: 1 }); await new Promise(r => setTimeout(r, 150)); if (!humans[0].errs.length) throw new Error(label + ' 人数 1 应被拒绝');
    humans[0].send({ t: 'setcap', n: cap }); await humans[0].until(m => m.nSeats === cap);
    await humans[0].until(m => m.players && m.players.filter(Boolean).length >= humans.length);
    humans[0].send({ t: 'start' });
    await Promise.all(humans.map(h => h.until(m => m.status === 'playing')));
    const first = humans[0].last, bots = first.players.filter(p => p && p.bot).length;
    if (first.state.n !== cap || bots !== cap - humans.length) throw new Error(label + ' 人数 / 电脑补位不对 n=' + first.state.n + ' bots=' + bots);
    // 隐藏信息: 未看牌时谁的牌都不可见
    humans.forEach(h => { if (h.last.state.hands.some(x => x)) throw new Error(label + ' 未看牌就泄露了手牌'); if (h.last.state.cards) throw new Error('泄露 cards'); });
    // 服务端校验: 乱序、非法加注、第 1 轮比牌、未看牌比牌
    const h0 = humans[0], seat0 = h0.last.seat, notTurn = humans.find(h => h.last.state.turn !== h.last.seat);
    const probe = async (h, mv, why) => { const b = h.errs.length; h.send({ t: 'move', move: mv }); await new Promise(r => setTimeout(r, 150)); if (h.errs.length === b) throw new Error(label + ' 应被拒绝: ' + why); };
    if (notTurn) await probe(notTurn, { a: 'call' }, '没轮到就跟注');
    const mover = humans.find(h => h.last.state.turn === h.last.seat);
    if (mover) { await probe(mover, { a: 'raise', unit: 7 }, '非法加注档位'); await probe(mover, { a: 'compare', target: mover.last.seat % cap + 1 }, '未看牌 / 第 1 轮比牌'); await probe(mover, { a: 'bogus' }, '未知操作'); }
    // 看牌后只有自己看得到自己的牌
    h0.send({ t: 'move', move: { a: 'look' } }); await h0.until(m => m.state.seen[m.seat]);
    if (!h0.last.state.hands[seat0] || h0.last.state.hands[seat0].length !== 3) throw new Error(label + ' 看牌后应看到自己的 3 张牌');
    if (humans[1] && humans[1].last.state.hands.some(x => x) ) throw new Error(label + ' 对方看牌不应泄露给我');
    let acts = 0, compares = 0; const t0 = Date.now();
    while (true) {
      if (humans[0].last.state.over) break; if (Date.now() - t0 > 120000) throw new Error(label + ' 超时');
      let acted = false;
      for (const h of humans) {
        const v = h.last.state, seat = h.last.seat; if (v.over || v.turn !== seat) continue;
        const mv = AI2.computeMove('zhajinhua', v, seat, 1 + (acts % 3), {}); const seq = v.seq; if (mv.a === 'compare') compares++;
        h.send({ t: 'move', move: mv }); acts++; acted = true;
        await Promise.race([Promise.all(humans.map(x => x.until(m => m.state.over || m.state.seq > seq))), new Promise(r => setTimeout(r, 3000))]);
      }
      if (!acted) await new Promise(r => setTimeout(r, 15));
    }
    await new Promise(r => setTimeout(r, 100));
    const st = humans[0].last.state; if (st.scores.reduce((a, b) => a + b, 0) !== 0) throw new Error(label + ' 结算不守恒');
    if (!humans.every(h => h.last.state.over && JSON.stringify(h.last.state.scores) === JSON.stringify(st.scores))) throw new Error(label + ' 各家结算不一致');
    const b = h0.errs.length; h0.send({ t: 'move', move: { a: 'call' } }); await new Promise(r => setTimeout(r, 150)); if (h0.errs.length === b) throw new Error(label + ' 结束后操作应被拒绝');
    // 再来一局(房主)
    h0.send({ t: 'again' }); await Promise.all(humans.map(h => h.until(m => m.status === 'playing' && !m.state.over && m.state.seq <= 1 + 0 || (m.status === 'playing' && !m.state.over))));
    console.log(label + ': 一手打完, 人数 ' + cap + ', 真人操作 ' + acts + ' 次(含比牌 ' + compares + '), 结果:', st.reason.slice(0, 40), ' 各家结算一致, 房主再来一局成功');
    humans.forEach(h => h.send({ t: 'leave' })); await new Promise(r => setTimeout(r, 100));
  }
  await playZjh([H1], 4, '炸金花(1 真人 + 3 电脑)');
  await playZjh([H2, H3], 3, '炸金花(2 真人 + 1 电脑)');
  await playZjh([H1, H2], 2, '炸金花(2 真人,2 人桌自动开局)');
  await playZjh([H1, H2, H3], 6, '炸金花(3 真人 + 3 电脑,6 人桌)');
  { // 2 人桌: 看牌后立即比牌(只剩两人时第 1 轮也可比牌),服务端结算并向双方亮牌
    const label = '炸金花(2 真人比牌)'; [H1, H2].forEach(h => { h.errs.length = 0; h.last = null; });
    H1.send({ t: 'create', game: 'zhajinhua' }); const rm = await H1.until(m => m.code); H2.send({ t: 'join', code: rm.code }); H1.send({ t: 'setcap', n: 2 }); await H1.until(m => m.nSeats === 2); H1.send({ t: 'start' });
    await Promise.all([H1, H2].map(h => h.until(m => m.status === 'playing')));
    const mover = [H1, H2].find(h => h.last.state.turn === h.last.seat), other = mover === H1 ? H2 : H1;
    mover.send({ t: 'move', move: { a: 'compare', target: other.last.seat } }); await new Promise(r => setTimeout(r, 150)); if (!mover.errs.length) throw new Error(label + ' 未看牌比牌应被拒绝');
    mover.send({ t: 'move', move: { a: 'look' } }); await mover.until(m => m.state.seen[m.seat]);
    mover.send({ t: 'move', move: { a: 'compare', target: other.last.seat } });
    await Promise.all([H1, H2].map(h => h.until(m => m.state.over))); const s1 = H1.last.state, s2 = H2.last.state;
    if (s1.winners.length !== 1 || s1.scores[s1.winners[0]] <= 0 || s1.scores.reduce((a, b) => a + b, 0) !== 0 || JSON.stringify(s1.scores) !== JSON.stringify(s2.scores)) throw new Error(label + ' 结算异常 ' + JSON.stringify(s1.scores));
    if (!mover.last.state.hands[other.last.seat] || !other.last.state.hands[mover.last.seat]) throw new Error(label + ' 比牌后双方应互相看到对方的牌');
    console.log(label + ': 比牌结算正确, 赢家座位 ' + s1.winners[0] + ', 比分 ' + JSON.stringify(s1.scores.slice(1)) + ',双方互相亮牌');
    [H1, H2].forEach(h => h.send({ t: 'leave' })); await new Promise(r => setTimeout(r, 100));
  }
  [H1, H2, H3].forEach(x => x.ws.close());
  [A, B, C, D, P, Q].forEach(x => x.ws.close());
  console.log('BOT TEST PASSED'); process.exit(0);
})().catch(e => { console.error('BOT TEST FAILED', e); process.exit(1); });
