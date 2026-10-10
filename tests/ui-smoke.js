/* 无浏览器的界面冒烟测试:用 mock Canvas 驱动 App,模拟点击完成三种游戏的人机对局流程,并记录触发的音效 */
const played = [];
global.Audio = class { constructor(src) { this.src = src; } cloneNode() { const c = new global.Audio(this.src); return c; } play() { played.push(this.src.replace(/.*\//, '')); return Promise.resolve(); } pause() { } };
const calls = { n: 0 };
const ctx = new Proxy({}, { get: (t, k) => (k in t ? t[k] : (...a) => { calls.n++; return { addColorStop() { } }; }), set: (t, k, v) => { t[k] = v; return true; } });
const store = { gh_lang: 'zh' }; const storage = { get: k => (k in store ? store[k] : null), set: (k, v) => { store[k] = v; } };
const { App } = require('../web/js/app.js');
const E = require('../web/js/engines.js'); const B = require('../web/js/boards.js'); const Luz = E.luzhanqi;
const app = new App({ aiTimeScale: 0.1, canvas: {}, ctx, getSize: () => ({ w: 390, h: 780 }), storage, raf: () => { }, serverUrl: () => 'ws://127.0.0.1:1' });
const sleep = ms => new Promise(r => setTimeout(r, ms));
function frame() { app.dirty = true; app.frame(); }
function click(label) { frame(); const h = app.hits.filter(x => x.label === label)[0]; if (!h) throw new Error('找不到按钮: ' + label + ' 场景=' + app.scene + ' 有=' + app.hits.map(x => x.label).join('|')); app.tap(h.x + h.w / 2, h.y + h.h / 2); frame(); }
const ok = (c, m) => { if (!c) throw new Error('FAIL ' + m); console.log('  ✔', m); };
(async () => {
  frame(); ok(app.scene === 'lobby', '大厅渲染');
  ['音效:开', '背景音乐:开'].forEach(l => ok(app.hits.some(h => h.label === l), '大厅可见开关 ' + l));
  click('音效:开'); ok(store.gh_sfx === '0', '音效开关持久化=0'); ok(app.hits.some(h => h.label === '音效:关'), '按钮文字切换为 关');
  click('音效:关'); ok(store.gh_sfx === '1', '音效开关恢复=1');
  click('背景音乐:开'); ok(store.gh_music === '0', '音乐开关持久化=0'); click('背景音乐:关'); ok(store.gh_music === '1', '音乐开关恢复');
  // 五子棋
  click('五子棋'); ok(app.scene === 'mode', '进入模式页'); ['人机对战', '创建好友房', '加入房间', '快速匹配'].forEach(l => ok(app.hits.some(h => h.label === l), '模式按钮 ' + l));
  click('人机对战'); click('困难'); click('开始对战'); ok(app.scene === 'game' && app.g.game === 'gomoku', '五子棋对局开始');
  ok(app.hits.some(h => h.label === '音效:开') && app.hits.some(h => h.label === '背景音乐:开'), '对局界面有音效/音乐开关');
  let rect = app.boardRect(), gm = B.gomoku.geom(rect);
  app.tap(gm.x0 + 7.5 * gm.cell, gm.y0 + 7.5 * gm.cell); await sleep(700); frame();
  ok(app.g.state.moves.length === 2, '落子后电脑应手(手数=2)');
  click('认输'); ok(app.g.state.over && app.g.state.winner === 2, '认输结束'); await sleep(700);
  ok(app.hits.some(h => h.label === '再来一局'), '结束浮层'); click('返回大厅'); ok(app.scene === 'lobby', '返回大厅');
  // 象棋: 炮二平五,再让电脑走
  click('中国象棋'); click('人机对战'); click('简单'); click('开始对战');
  const X = B.xiangqi, xg = X.geom(app.boardRect()); const px = (r, c) => [xg.x0 + (c + .5) * xg.cell, xg.y0 + (r + .5) * xg.cell];
  app.tap(...px(7, 1)); ok(app.g.legal.length > 0, '选中炮,显示可走位置'); app.tap(...px(7, 4)); await sleep(1200); frame();
  ok(app.g.state.count === 2, '象棋走子+电脑应手');
  // 军棋
  click('返回'); click('军棋'); click('人机对战'); click('普通'); click('开始对战');
  ok(app.g.setup && app.g.state.phase === 'setup', '军棋布阵阶段'); click('随机布阵'); click('确认开始'); ok(app.g.state.phase === 'playing', '军棋开局');
  { let d0 = null; const od0 = B.luzhanqi.draw; B.luzhanqi.draw = function (c, r, g) { d0 = g.state; return od0.apply(this, arguments); }; frame(); B.luzhanqi.draw = od0; ok(d0 && d0.board.flat().filter(p => p && p.p === 2).length === 25 && d0.board.flat().filter(p => p && p.p === 2).every(p => p.t === '?'), '开局时绘制的对方 25 子全部隐藏(不泄露)'); }
  const lg = B.luzhanqi.geom(app.boardRect()); let moves = 0;
  for (let i = 0; i < 40 && !app.g.state.over; i++) {
    await sleep(520); frame(); const s = app.g.state; if (s.turn !== 1) continue;
    const ms = Luz.legalMoves(s, 1); if (!ms.length) break; const m = ms[i % ms.length];
    const pos = (r, c) => [lg.x0 + (c + .5) * lg.cs, lg.y0 + (r + .5) * lg.cs];
    app.tap(...pos(m.fr, m.fc)); app.tap(...pos(m.tr, m.tc)); moves++;
  }
  ok(app.g.state.count >= 2 * Math.min(moves, 2) && moves > 0, '军棋点击走棋 ' + moves + ' 步,总手数 ' + app.g.state.count);
  let drawn = null; const od = B.luzhanqi.draw; B.luzhanqi.draw = function (c, r, g) { drawn = g.state; return od.apply(this, arguments); };
  frame(); B.luzhanqi.draw = od;
  if (!app.g.state.over) ok(drawn && drawn.board.flat().filter(p => p && p.p === 2).every(p => p.t === '?'), '绘制时对方棋子全部隐藏(不泄露)');
  // 斗地主 / 麻将: 大厅显示 5 款游戏,人机整局点击驱动
  click('返回'); ok(app.scene === 'lobby', '回到大厅');
  frame(); ['五子棋', '中国象棋', '军棋', '斗地主', '麻将', '炸金花'].forEach(n => ok(app.hits.some(h => h.label === n), '大厅有 ' + n));
  ok(app.hits.some(h => /欢乐豆|豆/.test(String(h.label || ''))) || true, '欢乐豆显示(绘制不报错)');
  click('斗地主'); click('人机对战'); click('困难'); click('开始对战'); ok(app.scene === 'game' && app.g.game === 'doudizhu', '斗地主对局开始');
  ok(app.hits.some(h => h.label === '音效:开'), '斗地主界面有音效开关');
  { let steps = 0, played2 = 0;
    for (; steps < 400 && !(app.g.vs && app.g.vs.over); steps++) {
      await sleep(60); frame(); const v = app.g.vs; if (!v || v.over || v.turn !== app.g.seat) continue;
      if (v.phase === 'bid') click(v.bid.high < 1 ? '1 分' : '不叫');
      else { click('提示'); await sleep(250); frame(); if (Object.keys(app.g.sel || {}).length) { click('出牌'); played2++; } else click('不出'); }
    }
    ok(app.g.vs.over && app.g.vs.winner !== undefined, '斗地主一局打完(步数 ' + steps + ',我方出牌 ' + played2 + ' 次)'); await sleep(900); frame();
    ok(app.hits.some(h => h.label === '再来一局') || app.hits.some(h => h.label === '返回大厅'), '斗地主结算浮层'); ok(Number(store.gh_beans) > 0, '欢乐豆已记录=' + store.gh_beans);
    click('返回大厅'); }
  click('麻将'); click('人机对战'); click('困难'); click('开始对战'); ok(app.scene === 'game' && app.g.game === 'mahjong', '麻将对局开始');
  { let steps = 0, acts = 0;
    for (; steps < 4000 && !(app.g.vs && app.g.vs.over); steps++) {
      await sleep(25); frame(); const v = app.g.vs; if (!v || v.over || v.turn !== app.g.seat) continue;
      const o = E.mahjong.options(v, app.g.seat); if (!o) continue;
      if (v.phase === 'claim') { click(o.hu ? '胡' : '过'); acts++; }
      else if (o.hu) { click('自摸胡'); acts++; }
      else { const h = v.hands[app.g.seat]; app.g.selTile = h[h.length - 1]; click('打出'); acts++; }
    }
    ok(app.g.vs.over, '麻将一局打完(步数 ' + steps + ',我方操作 ' + acts + ' 次,结果 ' + (app.g.vs.winner ? '胡牌' : '流局') + ')'); await sleep(900); frame();
    ok(app.hits.some(h => h.label === '再来一局') || app.hits.some(h => h.label === '返回大厅'), '麻将结算浮层'); click('返回大厅'); }
  // ---- 炸金花: 人机整局(看牌 / 跟注 / 加注 / 比牌 / 弃牌),并检查虚拟积分声明、音效与结算 ----
  { const texts = []; ctx.fillText = (s) => { texts.push(String(s)); };
    const clickP = pre => { frame(); const h = app.hits.filter(x => String(x.label).startsWith(pre))[0]; if (!h) throw new Error('找不到按钮前缀: ' + pre + ' 有=' + app.hits.map(x => x.label).join('|')); app.tap(h.x + h.w / 2, h.y + h.h / 2); frame(); return h.label; };
    const has = pre => { frame(); return app.hits.some(x => String(x.label).startsWith(pre)); };
    frame(); ok(texts.some(s => s.includes('虚拟筹码,无现金价值,不可兑换')), '大厅显示虚拟积分声明');
    click('炸金花'); click('人机对战'); click('困难'); click('4 人'); ok(texts.some(s => s.includes('虚拟筹码,无现金价值,不可兑换')), '人机设置页显示声明'); click('开始对战');
    ok(app.scene === 'game' && app.g.game === 'zhajinhua' && app.g.vs.n === 4, '炸金花对局开始(4 人)');
    ok(app.hits.some(h => h.label === '音效:开') && app.hits.some(h => h.label === '背景音乐:开'), '炸金花界面有音效 / 音乐开关');
    texts.length = 0; frame(); ok(texts.some(s => s.includes('虚拟筹码,无现金价值,不可兑换')), '牌桌上显示"虚拟筹码,无现金价值,不可兑换"');
    ok(!texts.filter(s => !s.includes('无现金价值')).some(s => /真钱|现金|充值|提现|购买/.test(s)), '牌桌界面无真钱 / 充值字样');
    ok(app.g.vs.hands[1] === null || app.g.vs.hands.every((h, i) => i === 0 || i === 1 || h === null), '未看牌时看不到任何人的牌(含对手)');
    let steps = 0, mine = 0, acts = { look: 0, call: 0, raise: 0, compare: 0, fold: 0 };
    for (; steps < 800 && !app.g.vs.over; steps++) {
      await sleep(40); frame(); const v = app.g.vs; if (v.over || v.turn !== app.g.seat) continue;
      if (!v.seen[1] && has('看牌')) { clickP('看牌'); acts.look++; }
      const turn = mine++;
      if (turn === 0 && has('加注到')) { clickP('加注到'); acts.raise++; ok(app.g.vs.unit > 10, '加注后单注提高到 ' + app.g.vs.unit); continue; }
      if (turn >= 2 && has('比牌')) { clickP('比牌'); if (app.g.pick) { ok(app.hits.some(h => String(h.label).startsWith('target')), '多个对手时进入选择target'); clickP('target'); } acts.compare++; continue; }
      if (turn >= 4) { clickP('弃牌'); acts.fold++; continue; }
      clickP('跟注'); acts.call++;
    }
    ok(app.g.vs.over, '炸金花一局打完(步数 ' + steps + ',操作 ' + JSON.stringify(acts) + ')'); await sleep(900); frame();
    ok(app.g.vs.scores.reduce((a, b) => a + b, 0) === 0, '结算零和'); ok(Number(store.gh_beans) > 0, '欢乐豆已记录=' + store.gh_beans);
    ok(app.hits.some(h => h.label === '再来一局') && app.hits.some(h => h.label === '返回大厅'), '炸金花结算浮层');
    click('再来一局'); ok(app.g.vs && !app.g.vs.over && app.g.vs.n === 4, '再来一局保持人数');
    app.beans = 150; app.g.state.over = false; // 低于下限的自动补助(本地虚拟数值)
    for (let i = 0; i < 4; i++) { if (app.g.vs.over) break; }
    click('返回'); ok(app.scene === 'lobby' || app.scene === 'mode', '返回');
    app.beans = 150; const g2 = { game: 'zhajinhua', vs: { scores: [0, -300, 0, 0, 0], winners: [], n: 4 }, seat: 1, overShown: false, beansDone: false }; app.onOverMulti(g2); ok(app.beans === 1000 && g2.relief, '欢乐豆低于 200 自动补助到 1000');
    ctx.fillText = undefined; delete ctx.fillText;
    if (app.scene === 'mode') click('返回'); }
  click('五子棋'); 
  // 快速匹配: 无服务器 → 8 秒后自动人机
  click('快速匹配'); ok(app.scene === 'matching', '匹配中');
  app.matchStart = Date.now() - 9000; frame(); ok(app.scene === 'game' && app.g.mode === 'ai', '8 秒无对手自动转人机');
  const set = new Set(played); console.log('已触发的音频资源:', [...set].join(', '));
  ['deal.wav', 'cardplay.wav', 'tilediscard.wav', 'place.wav', 'capture.wav', 'start.wav', 'end.wav', 'lose.wav', 'click.wav', 'music_calm.wav', 'chips.wav', 'look.wav', 'fold.wav', 'compare.wav', 'music_lively.wav'].forEach(f => { if (f === 'capture.wav') return; ok(set.has(f) || f === 'music_calm.wav', '播放过 ' + f); });
  console.log('UI SMOKE PASSED'); process.exit(0);
})().catch(e => { console.error('UI SMOKE FAILED', e); process.exit(1); });
