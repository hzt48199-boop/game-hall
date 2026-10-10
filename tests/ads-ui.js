/* UI flow for "Watch ad, get chips" against a local server (mock canvas, WebSocket from ws). Run: node tests/ads-ui.js */
global.WebSocket = require('../server/node_modules/ws');
global.Audio = class { cloneNode() { return this; } play() { return Promise.resolve(); } pause() { } };
const server = require('../server/server.js'); const wss = server.start(0); 
const texts = []; const ctx = new Proxy({}, { get: (t, k) => (k === 'fillText' ? s => { texts.push(String(s)); } : k in t ? t[k] : () => ({ addColorStop() { } })), set: (t, k, v) => { t[k] = v; return true; } });
const store = {}; const storage = { get: k => (k in store ? store[k] : null), set: (k, v) => { store[k] = v; } };
const { App } = require('../web/js/app.js');
const sleep = ms => new Promise(r => setTimeout(r, ms)); const ok = (c, m) => { if (!c) { console.log('FAIL ' + m); process.exit(1); } console.log('  ✔', m); };
setTimeout(async () => {
  const port = wss.options.server.address().port;
  const app = new App({ canvas: {}, ctx, getSize: () => ({ w: 390, h: 780 }), storage, raf: () => { }, serverUrl: () => 'ws://127.0.0.1:' + port });
  const frame = () => { app.dirty = true; texts.length = 0; app.frame(); };
  const click = l => { frame(); const h = app.hits.filter(x => x.label === l)[0]; if (!h) throw new Error('no button ' + l + ' have ' + app.hits.map(x => x.label)); app.tap(h.x + h.w / 2, h.y + h.h / 2); frame(); };
  frame(); ok(app.hits.some(h => h.label === 'Watch ad · +500 chips'), 'lobby shows the Watch ad button');
  const b0 = app.beans; click('Watch ad · +500 chips'); await sleep(600); frame(); ok(app.scene === 'ad', 'ad overlay opened');
  ok(texts.includes('Ad placeholder') && app.hits.every(h => h.label !== 'Claim +500 chips'), 'placeholder labelled; claim disabled during countdown');
  await sleep(5200); frame(); click('Claim +500 chips'); await sleep(600); frame();
  ok(app.scene === 'lobby' && app.beans === b0 + 500 && store.gh_beans === String(b0 + 500), 'chips granted +500 and persisted');
  ok(texts.some(t => /4 left today|Next ad in/.test(t)), 'remaining/cooldown shown: ' + texts.filter(t => /left today|Next ad/.test(t)).join('|'));
  ok(!app.hits.some(h => h.label === 'Watch ad · +500 chips'), 'button disabled during cooldown');
  app.net.stop(); wss.close(); process.exit(0);
}, 300);
