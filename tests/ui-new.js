/* Mock-canvas UI test (English default): lobby order, cbox brand + tagline everywhere, language toggle persistence, Chess and Hold'em played by taps, sounds */
const played = [];
global.Audio = class { constructor(src) { this.src = src; } cloneNode() { return new global.Audio(this.src); } play() { played.push(this.src.replace(/.*\//, '')); return Promise.resolve(); } pause() { } };
const texts = [];
const ctx = new Proxy({}, { get: (t, k) => (k === 'fillText' ? (s) => { texts.push(String(s)); } : k in t ? t[k] : (...a) => ({ addColorStop() { } })), set: (t, k, v) => { t[k] = v; return true; } });
const store = {}; const storage = { get: k => (k in store ? store[k] : null), set: (k, v) => { store[k] = v; } };
const { App } = require('../web/js/app.js'); const E = require('../web/js/engines.js'); const B = require('../web/js/boards.js'); const C = E.chess, H = E.holdem;
const mk = () => new App({ aiTimeScale: 0.1, canvas: {}, ctx, getSize: () => ({ w: 390, h: 780 }), storage, raf: () => { }, serverUrl: () => 'ws://127.0.0.1:1' });
let app = mk(); const sleep = ms => new Promise(r => setTimeout(r, ms));
function frame() { app.dirty = true; texts.length = 0; app.frame(); }
function click(label) { frame(); const h = app.hits.filter(x => x.label === label)[0]; if (!h) throw new Error('button not found: ' + label + ' scene=' + app.scene + ' have=' + app.hits.map(x => x.label).join('|')); app.tap(h.x + h.w / 2, h.y + h.h / 2); frame(); }
const ok = (c, m) => { if (!c) throw new Error('FAIL ' + m); console.log('  ✔', m); };
const TAG = 'Open Charity Box. Open a world of compassion.';
const hasText = s => texts.some(x => x.includes(s));
const cjk = /[\u4e00-\u9fff]/;
(async () => {
  frame(); ok(app.scene === 'lobby', 'lobby renders');
  ok(hasText('cbox') && hasText(TAG), 'lobby shows the cbox brand + tagline');
  ok(!texts.some(x => cjk.test(x) && x !== '中文'), 'lobby has no Chinese text by default (only the 中文 button): ' + texts.filter(x => cjk.test(x)).join('|'));
  ok(app.hits.some(h => h.label === '中文'), 'visible 中文 translate button');
  const order = app.hits.filter(h => h.w > 300).map(h => h.label); ok(order[0] === "Texas Hold'em" && order[1] === 'International Chess', 'new games ranked first: ' + order.join(', '));
  ok(order.length === 8 && ['Gomoku', 'Chinese Chess', 'Luzhanqi', 'Dou Dizhu', 'Mahjong', 'Zha Jin Hua'].every(n => order.includes(n)), 'all existing games still listed');
  ok(app.hits.some(h => h.label === 'Sound: On') && app.hits.some(h => h.label === 'Music: On'), 'sound / music toggles visible in the lobby');
  click('中文'); ok(store.gh_lang === 'zh', 'language choice stored'); ok(app.hits.some(h => h.label === 'English') && app.hits.some(h => h.label === '德州扑克'), 'lobby switches to Chinese'); ok(hasText('cbox 慈善盒子'), 'Chinese brand shown');
  app = mk(); frame(); ok(app.hits.some(h => h.label === '德州扑克'), 'Chinese is remembered after reload');
  click('English'); ok(store.gh_lang === 'en' && app.hits.some(h => h.label === "Texas Hold'em"), 'back to English');
  // ---- International Chess vs hard computer ----
  click('International Chess'); ok(app.scene === 'mode', 'mode page'); ok(hasText('cbox') && hasText(TAG), 'brand on mode page');
  click('Play vs Computer'); click('Hard'); click('Start Game'); ok(app.scene === 'game' && app.g.game === 'chess', 'chess game started');
  ok(hasText(TAG) && hasText('cbox'), 'brand + tagline on the chess screen'); ok(app.hits.some(h => h.label === 'Sound: On') && app.hits.some(h => h.label === 'Music: On'), 'chess has sound / music toggles'); ok(!texts.some(x => cjk.test(x)), 'chess screen is fully English');
  const sqXY = (s) => { const rect = app.boardRect(), gm = B.chess.geom(rect), seat = app.g.seat === 2 ? 2 : 1, p = B.chess.scr(seat, s); return [gm.x0 + (p[1] + .5) * gm.cell, gm.y0 + (p[0] + .5) * gm.cell]; };
  const sq = n => (n.charCodeAt(0) - 97) + (parseInt(n[1], 10) - 1) * 8;
  app.tap(...sqXY(sq('e2'))); ok(app.g.legal.length === 2, 'selecting e2 pawn shows 2 legal targets'); frame();
  app.tap(...sqXY(sq('e4'))); ok(app.g.state.count === 1, 'move e4 played'); await sleep(2600); frame(); ok(app.g.state.count === 2, 'computer replied (' + app.g.state.last.san + ')');
  ok(played.includes('chessmove.wav'), 'chess move sound played'); app.tap(...sqXY(sq('e7'))); ok(app.g.sel !== sq('e7'), 'cannot select opponent piece');
  click('Resign'); ok(app.g.state.over && app.g.state.winner === 2, 'resign ends the game'); await sleep(700); frame(); ok(app.hits.some(h => h.label === 'Play Again') && app.hits.some(h => h.label === 'Back to Lobby'), 'game-over overlay'); click('Back to Lobby');
  // promotion picker via a crafted position
  click('International Chess'); click('Play vs Computer'); click('Easy'); click('Start Game');
  app.g.state = C.newGame({ fen: '7k/P7/8/8/8/8/8/K7 w - - 0 1' }); frame(); app.tap(...sqXY(sq('a7'))); app.tap(...sqXY(sq('a8'))); frame(); ok(app.g.promo && app.hits.some(h => h.label === 'Queen' || h.label === 'Knight'), 'promotion picker appears'); click('Knight'); ok(app.g.state.board[sq('a8')] === 2, 'promoted to knight (K+N vs K is an insufficient-material draw)'); ok(app.g.state.over && app.g.state.winner === 3, 'draw detected'); click('Back to Lobby');
  // ---- Texas Hold'em vs computers ----
  click("Texas Hold'em"); click('Play vs Computer'); click('Hard'); click('4 players'); ok(hasText('For entertainment only, virtual chips, no cash value, not redeemable'), 'disclaimer on setup page'); click('Start Game');
  ok(app.scene === 'game' && app.g.game === 'holdem', "Hold'em started"); ok(hasText(TAG) && hasText('cbox'), 'brand + tagline on the Hold\'em screen'); ok(hasText('For entertainment only, virtual chips, no cash value, not redeemable'), 'virtual chips disclaimer on the table');
  ok(app.hits.some(h => h.label === 'Sound: On') && app.hits.some(h => h.label === 'Music: On'), "Hold'em has sound / music toggles");
  let acts = 0, hands = 0, sawRaise = false;
  for (let step = 0; step < 900 && hands < 2; step++) {
    await sleep(25); frame(); const v = app.g.vs; if (!v) continue;
    if (v.over) { frame(); ok(!texts.some(x => cjk.test(x)), 'overlay English'); if (hands === 0) ok(app.hits.some(h => h.label === 'Next Hand'), 'next hand button'); hands++; if (hands < 2) { click('Next Hand'); ok(app.g.vs.handNo === 2, 'second hand dealt, stacks carried'); } continue; }
    if (v.turn !== app.g.seat) continue;
    const o = H.options(v, app.g.seat);
    if (o.canRaise && acts === 1 && !sawRaise) { const h = app.hits.filter(x => /^Raise to|^Bet/.test(x.label))[0]; ok(!!h, 'raise button offered'); app.tap(h.x + h.w / 2, h.y + h.h / 2); sawRaise = true; acts++; continue; }
    click(o.check ? 'Check' : (acts % 3 === 2 ? 'Fold' : 'Call ' + o.call)); acts++;
  }
  ok(hands >= 2, "two Hold'em hands completed by taps (" + acts + ' actions)'); ok(!texts.some(x => cjk.test(x)), "Hold'em table fully English");
  ok(['chips.wav', 'flip.wav', 'knock.wav', 'fold.wav'].some(n => played.includes(n)), "Hold'em sounds played: " + [...new Set(played)].join(','));
  console.log('UI NEW PASSED'); process.exit(0);
})().catch(e => { console.log('UI NEW FAILED', e.stack || e); process.exit(1); });
