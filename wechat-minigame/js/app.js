/* 游戏大厅主程序(Canvas 2D,无框架)。网页与微信小游戏共用,平台差异通过 platform 对象注入:
   platform = { canvas, ctx, getSize():{w,h}, storage:{get,set}, raf(fn), serverUrl() } */
(function () {
  var req = typeof require === 'function';
  var E = req ? require('./engines.js') : GH.Engines;
  var AI = req ? require('./ai.js') : GH.AI;
  var Ads = req ? require('./ads.js') : GH.Ads;
  var Net = req ? require('./net.js') : GH.Net;
  var Sound = req ? require('./sound.js') : GH.Sound;
  var B = req ? require('./boards.js') : GH.Boards;
  var AIC = req ? require('./aiclient.js') : GH.AIClient;
  var CB = req ? require('./cardboards.js') : GH.CardBoards;
  var I18n = req ? require('./i18n.js') : GH.I18n, T = I18n.t;
  var Luz = E.luzhanqi, Mj = E.mahjong, Ddz = E.doudizhu, Zjh = E.zhajinhua, Hd = E.holdem;
  var TAGLINE = 'Open Charity Box. Open a world of compassion.';
  function tn(k) { return T(Mj.KN[k]); }
  var GAMES = [
    { id: 'holdem', name: "Texas Hold'em", desc: 'Blinds, betting rounds, side pots - virtual chips', color: '#12402a', icon: 'A\u2660K\u2665', cat: 'cards', multi: true, seats: 6, unit: 1, holdem: true, cap: true, isNew: true },
    { id: 'chess', name: 'International Chess', desc: 'Castling, en passant, checkmate', color: '#2a2150', icon: '\u265e\u265a', cat: 'board', isNew: true },
    { id: 'gomoku', name: 'Gomoku', desc: 'Black vs white - first to five in a row wins', color: '#202b30', icon: '\u25cf\u25cb', cat: 'board' },
    { id: 'xiangqi', name: 'Chinese Chess', desc: 'Xiangqi - the generals face off', color: '#4a2219', icon: 'XQ', cat: 'board' },
    { id: 'luzhanqi', name: 'Luzhanqi', desc: 'Army Chess - hidden pieces, capture the flag', color: '#1d3a21', icon: '\u2691', cat: 'board' },
    { id: 'doudizhu', name: 'Dou Dizhu', desc: '3 players - bid to be the landlord, bombs and rockets', color: '#4a2a07', icon: '\u2660\u2665', cat: 'cards', multi: true, seats: 3, unit: 100 },
    { id: 'mahjong', name: 'Mahjong', desc: '4 players - chow, pong, kong, win', color: '#0f3b3b', icon: 'MJ', cat: 'cards', multi: true, seats: 4, unit: 10 },
    { id: 'zhajinhua', name: 'Zha Jin Hua', desc: 'Three-card poker - look, call, raise, compare', color: '#3f1530', icon: '3\u2666', cat: 'cards', multi: true, seats: 6, unit: 1, zjh: true, cap: true }
  ];
  var HARD_MS = { gomoku: 1500, xiangqi: 2000, luzhanqi: 1000, doudizhu: 400, mahjong: 300, zhajinhua: 200, chess: 2000, holdem: 250 };
  var BOT_NAMES = ['', 'Bot Ace', 'Bot Bao', 'Bot Max', 'Bot Rex', 'Bot Lily', 'Bot Sam'];
  var SOUND_OF = { flop: 'flip', turn: 'flip', river: 'flip', check: 'knock', bet: 'chips', allin: 'allin', deal: 'deal', redeal: 'deal', bid: 'bid', landlord: 'start', play: 'cardplay', bomb: 'bomb', rocket: 'rocket', pass: 'pass',
    draw: 'tiledraw', discard: 'tilediscard', pong: 'pong', kong: 'kong', chi: 'chi', hu: 'hu', zimo: 'hu', drawgame: 'end', call: 'chips', raise: 'chips', look: 'look', fold: 'fold', compare: 'compare', showdown: 'compare' };
  var LEVELS = ['Easy', 'Normal', 'Hard'];
  var FONT = B.FONT;
  var MATCH_WAIT_MS = 8000;

  function App(pf) {
    var self = this;
    this.pf = pf; this.ctx = pf.ctx; this.hits = []; this.dirty = true; this.scene = 'lobby'; this.cur = null; this.toast = null;
    this.scroll = 0; this.cat = 'all'; this.initLogo(); this.joinCode = ''; this.diff = { level: 2, seat: 1, n: 5 }; this.g = null; this.matchStart = 0; this.netState = 'closed';
    Sound.init(pf.storage);
    this.beans = parseInt(pf.storage.get('gh_beans'), 10); if (!(this.beans >= 0)) this.beans = 2000;
    this.net = Net.create({ url: pf.serverUrl, storage: pf.storage });
    this.net.onMessage = function (m) { self.onNet(m); };
    this.net.onStatus = function (s) { self.netState = s; self.dirty = true; if (s === 'failed') self.onNetFailed(); self.updateOverlay(); };
    this.adInfo = null; this.adPending = false; this.adTicket = null; this.adBusy = false; this.adBackScene = 'lobby';
    Ads.onChange = function () { self.dirty = true; };
    this.warming = false; this.wasReady = false; this.initOverlay();
    I18n.init(pf.storage); this.applyLang();
    this.setScene('lobby');
    var loop = function () { self.frame(); pf.raf(loop); };
    pf.raf(loop);
    setInterval(function () { self.dirty = true; }, 250);
  }
  var P = App.prototype;

  P.gameInfo = function (id) { return GAMES.filter(function (g) { return g.id === id; })[0]; };
  P.setScene = function (scene) {
    this.scene = scene; this.dirty = true;
    var track = (this.g && scene === 'game') ? ({ gomoku: 'calm', chess: 'calm', holdem: 'lively', doudizhu: 'lively', zhajinhua: 'lively', mahjong: 'lively' }[this.g.game] || 'chinese') : 'calm';
    Sound.setMusic(track);
    if (scene === 'matching' || scene === 'waiting' || (scene === 'join')) this.net.start();
  };
  /* ---- cold-start overlay + reconnect banner (DOM, web only) ---- */
  P.initOverlay = function () {
    if (typeof document === 'undefined' || !document.body) return;
    var self = this, d = document.createElement('div');
    d.style.cssText = 'position:fixed;left:0;top:0;right:0;bottom:0;z-index:99;display:none;align-items:center;justify-content:center;flex-direction:column;background:rgba(5,9,6,.92);color:#fff;font:600 18px sans-serif;text-align:center;padding:20px';
    d.innerHTML = '<div id="gh-ov-t"></div><div id="gh-ov-s" style="font-weight:400;font-size:13px;opacity:.8;margin-top:8px"></div>';
    var b = document.createElement('div');
    b.style.cssText = 'position:fixed;left:0;right:0;top:0;z-index:98;display:none;background:#ef6c00;color:#fff;font:600 14px sans-serif;text-align:center;padding:6px';
    document.body.appendChild(d); document.body.appendChild(b); this.ovEl = d; this.bnEl = b;
    setInterval(function () { self.updateOverlay(); }, 500);
    var url = this.pf.serverUrl && this.pf.serverUrl(); if (typeof fetch !== 'function' || !url) return;
    var http = url.replace(/^ws/, 'http').replace(/(\/ws)?\/?$/, '') + '/healthz', done = false;
    this.warming = false; var tm = setTimeout(function () { if (!done) { self.warming = true; self.updateOverlay(); } }, 1500);
    var fin = function () { done = true; clearTimeout(tm); self.warming = false; self.updateOverlay(); };
    var tries = 0; (function go() { fetch(http, { cache: 'no-store' }).then(function (r) { if (r.ok) fin(); else retry(); }, retry); function retry() { if (++tries > 20) return fin(); setTimeout(go, 2000); } })();
  };
  P.updateOverlay = function () {
    if (!this.ovEl) return;
    var n = this.net, scene = this.scene;
    if (n.ready) this.wasReady = true; if (!n.wanted) this.wasReady = false;
    var connecting = n.wanted && !n.ready && !this.wasReady && (scene === 'matching' || scene === 'waiting' || scene === 'join');
    var show = this.warming || connecting;
    this.ovEl.style.display = show ? 'flex' : 'none';
    if (show) { this.ovEl.firstChild.textContent = T('Server waking up, please wait...'); this.ovEl.lastChild.textContent = T('The free server sleeps when idle; this can take up to a minute.'); }
    var re = n.wanted && !n.ready && this.wasReady && !show;
    this.bnEl.style.display = re ? 'block' : 'none';
    if (re) this.bnEl.textContent = T('Reconnecting...') + (n.attempt > 1 ? ' (' + n.attempt + ')' : '');
  };
  P.inGameOnline = function () { return !!(this.g && this.g.mode === 'online'); };
  P.onNetFailed = function () {
    var wasGame = this.inGameOnline(); this.wasReady = false;
    if (wasGame) { this.g = null; this.setScene('lobby'); this.say('Connection lost. Returned to the lobby.'); }
    else if (this.scene === 'matching' || this.scene === 'waiting' || this.scene === 'join') { this.setScene('lobby'); this.say('Cannot connect to the online server'); }
  };
  P.applyLang = function () { if (typeof document !== 'undefined') { document.title = T('cbox') + ' - ' + T(TAGLINE); document.documentElement.lang = I18n.lang === 'zh' ? 'zh-CN' : 'en'; } };
  P.toggleLang = function () { I18n.setLang(I18n.lang === 'zh' ? 'en' : 'zh'); this.applyLang(); this.dirty = true; };
  P.say = function (text) { text = T(text); this.toast = { text: text, until: Date.now() + 2600 }; this.dirty = true; };
  P.tap = function (x, y) {
    Sound.unlock();
    var lo = (this.scene === 'lobby' && y < 90) ? (this.barFrom || 0) : 0;
    for (var i = this.hits.length - 1; i >= lo; i--) {
      var h = this.hits[i];
      if (x >= h.x && x <= h.x + h.w && y >= h.y && y <= h.y + h.h) { if (h.click !== false) Sound.sfx('click'); h.cb(); this.dirty = true; return; }
    }
    if (this.scene === 'game' && !(this.cur && this.cur.multi)) this.boardTap(x, y);
  };

  /* ---------- 绘图小工具(深色 + 荧光绿风格)---------- */
  var GREEN = '#39e75f', DARK_FILL = '#0c130e', DARK_LINE = '#1c3a27', MUTED = '#8fa397';
  var TINT = { '#ff8f00': 1, '#2e9d4f': 1 }, SOLID = { '#2e7d32': 1 }, DARKC = { '#546e7a': 1, '#455a64': 1, '#37674f': 1, '#757575': 1, '#37474f': 1, '#78909c': 1 };
  function estW(str, size) { var w = 0; for (var i = 0; i < str.length; i++) w += str.charCodeAt(i) > 255 ? size : size * 0.58; return w; }
  P.btn = function (x, y, w, h, label, cb, o) {
    o = o || {}; var c = this.ctx; label = T(label); var col = o.color || '#ff8f00', fill, line = null, fg = o.fg, glow = false, r = o.radius !== undefined ? o.radius : h / 2;
    if (o.disabled) { fill = '#0f1511'; line = '#1a2620'; fg = fg || '#55645a'; }
    else if (SOLID[col]) { fill = GREEN; fg = fg || '#04210d'; glow = true; }
    else if (TINT[col]) { fill = 'rgba(57,231,95,0.14)'; line = GREEN; fg = fg || GREEN; glow = true; }
    else if (DARKC[col]) { fill = DARK_FILL; line = '#2a3d31'; fg = fg || '#c3d2c8'; }
    else { fill = col; line = o.stroke || null; fg = fg || '#fff'; }
    if (o.fill) fill = o.fill; if (o.line) line = o.line;
    B.rrect(c, x, y, w, h, r); c.fillStyle = fill;
    if (glow) { c.shadowColor = 'rgba(57,231,95,0.45)'; c.shadowBlur = 10; } c.fill(); c.shadowBlur = 0; c.shadowColor = 'rgba(0,0,0,0)';
    if (line) { c.strokeStyle = line; c.lineWidth = 1.5; c.stroke(); }
    B.text(c, label, x + w / 2, y + h / 2 + 1, o.size || Math.min(22, h * 0.42), fg, true, 'center', w - 10);
    if (!o.disabled) this.hits.push({ x: x, y: y, w: w, h: h, cb: cb, click: o.click, label: label });
  };
  var WEBSITE_URL = 'https://charitybox.netlify.app/';
  P.initLogo = function () {
    var pf = this.pf, base = pf.logoBase || '', self = this; this.logos = {};
    [96, 256].forEach(function (n) {
      try {
        var im = pf.createImage ? pf.createImage() : (typeof Image !== 'undefined' ? new Image() : null); if (!im) return;
        im.onload = function () { self.dirty = true; }; im.src = base + 'logo' + n + '.png'; self.logos[n] = im;
      } catch (e) { /* no image support */ }
    });
  };
  P.drawLogo = function (cx, cy, r) { // circular golden badge; falls back to a gold disc while loading
    var c = this.ctx, im = this.logos && (r > 26 ? (this.logos[256] || this.logos[96]) : (this.logos[96] || this.logos[256]));
    c.save(); c.shadowColor = 'rgba(57,231,95,0.5)'; c.shadowBlur = 12; c.beginPath(); c.arc(cx, cy, r, 0, Math.PI * 2); c.fillStyle = '#c9a227'; c.fill(); c.restore();
    var ready = im && (im.complete !== false) && (im.width > 0 || im.naturalWidth > 0);
    if (ready) { try { c.save(); c.beginPath(); c.arc(cx, cy, r, 0, Math.PI * 2); c.clip(); c.drawImage(im, cx - r, cy - r, r * 2, r * 2); c.restore(); } catch (e) { try { c.restore(); } catch (e2) { } } }
    c.beginPath(); c.arc(cx, cy, r, 0, Math.PI * 2); c.strokeStyle = 'rgba(57,231,95,0.55)'; c.lineWidth = 1.5; c.stroke();
  };
  P.brandLine = function (y, withName) { // cbox brand + tagline (shown on every game screen)
    var c = this.ctx, W = this.W, str = (withName ? T('cbox') + ' · ' : '') + T(TAGLINE);
    B.text(c, str, W / 2, y, 10, '#7fcf95', false, 'center', W - 156);
  };
  P.header = function (title, back) {
    var c = this.ctx, W = this.W, lobby = this.scene === 'lobby', self = this;
    c.fillStyle = '#060b08'; c.fillRect(0, 0, W, 90); c.fillStyle = '#16301f'; c.fillRect(0, 89, W, 1);
    var pad = lobby ? Math.max(12, (W - Math.min(W - 24, 520)) / 2) : 8;
    if (lobby) {
      this.barFrom = this.hits.length; // taps inside the fixed bar only reach the bar's own buttons
      this.drawLogo(pad + 20, 26, 20); B.text(c, 'cbox', pad + 48, 26, 22, GREEN, true, 'left');
      var lang = I18n.lang === 'zh' ? 'English' : '中文', lw = 62, bw = I18n.lang === 'zh' ? 88 : 126;
      this.btn(W - pad - lw, 10, lw, 32, lang, function () { this.toggleLang(); }.bind(this), { color: '#ff8f00', size: 14, label: lang });
      this.btn(W - pad - lw - 6 - bw, 10, bw, 32, '← Back to website', function () { try { if (typeof window !== 'undefined' && window.location) window.location.href = WEBSITE_URL; } catch (e) { /* non-web platform */ } }, { color: '#546e7a', size: 12 });
    } else {
      this.brandLine(11, true); B.text(c, title, W / 2, 31, 18, '#eafff0', true, 'center', W - 156);
      if (back) this.btn(8, 8, 64, 32, 'Back', back, { color: '#546e7a', size: 15 });
    }
    // sound / music toggles (visible on every screen)
    var tw = lobby ? 92 : Math.min(150, (W - 16) / 2 - 4), y = 52, th = lobby ? 30 : 32, rx = lobby ? W - pad : W - 6;
    if (lobby) B.text(c, T('Happy Beans (virtual): {0}', this.beans), pad + 2, y + th / 2 + 1, 12, '#ffe58a', true, 'left', W - 2 * pad - 2 * tw - 14);
    this.btn(rx - 2 * tw - 6, y, tw, th, (Sound.sfxOn ? 'Sound: On' : 'Sound: Off'), function () { Sound.toggleSfx(); }, { color: Sound.sfxOn ? '#2e9d4f' : '#757575', size: lobby ? 12 : 16, click: false });
    this.btn(rx - tw, y, tw, th, (Sound.musicOn ? 'Music: On' : 'Music: Off'), function () { Sound.toggleMusic(); }, { color: Sound.musicOn ? '#2e9d4f' : '#757575', size: lobby ? 12 : 16, click: false });
  };
  P.frame = function () {
    var sz = this.pf.getSize(); if (sz.w !== this.W || sz.h !== this.H) { this.W = sz.w; this.H = sz.h; this.dirty = true; }
    this.updateWait();
    if (this.scene === 'matching' && Date.now() - this.matchStart > MATCH_WAIT_MS) this.matchTimeout();
    if (this.toast && Date.now() > this.toast.until) { this.toast = null; this.dirty = true; }
    if (!this.dirty) return; this.dirty = false;
    var c = this.ctx; this.hits = [];
    c.fillStyle = this.scene === 'game' ? '#1f4d3a' : '#050806'; c.fillRect(0, 0, this.W, this.H);
    var fn = this['draw_' + this.scene]; if (fn) fn.call(this);
    if (this.toast) { var w = Math.min(this.W - 40, 360), ty = this.scene === 'lobby' ? 98 : this.H - 120; B.rrect(c, (this.W - w) / 2, ty, w, 44, 10); c.fillStyle = 'rgba(0,0,0,0.92)'; c.fill(); if (this.scene === 'lobby') { c.strokeStyle = GREEN; c.lineWidth = 1.5; c.stroke(); } B.text(c, this.toast.text, this.W / 2, ty + 22, 16, '#fff', false, 'center', w - 20); }
  };
  P.updateWait = function () {
    var g = this.g, want = this.scene === 'waiting' || this.scene === 'matching';
    if (this.scene === 'game' && g && g.mode === 'online' && !g.state.over) {
      var opp = g.players && g.players[2 - g.seat];
      want = !!(g.status === 'waiting' || (opp && !opp.online) || (g.setup && g.setup.done && g.state.phase === 'setup'));
    }
    Sound.setWait(want); this.updateUrge();
  };
  /* 催促: 牌类游戏轮到我且超过 10 秒没操作,每 6 秒响一次"嘟嘟嘟" */
  P.updateUrge = function () {
    var g = this.g, now = Date.now();
    if (this.scene !== 'game' || !g || !g.vs || g.vs.over || !g.seat || !(g.game === 'doudizhu' || g.game === 'mahjong' || g.game === 'zhajinhua' || g.game === 'holdem') || g.vs.turn !== g.seat) { this._urgeKey = null; return; }
    var key = g.vs.turn + ':' + (g.vs.seq || 0);
    if (this._urgeKey !== key) { this._urgeKey = key; this._urgeAt = now + 10000; return; }
    if (now >= this._urgeAt) { this._urgeAt = now + 6000; Sound.sfx('urge'); }
  };

  /* ---------- 大厅 / 模式 ---------- */
  var CARD_H = 84, CARD_GAP = 10, BANNER_H = 108, AD_H = 56, AD_H2 = 96, TABS = [['all', 'All'], ['board', 'Board'], ['cards', 'Cards']];
  function tag(c, x, y, str, kind) { // small green badge; returns its width
    var w = estW(str, 10) + 14; B.rrect(c, x, y, w, 17, 8.5);
    c.fillStyle = kind === 'new' ? GREEN : 'rgba(57,231,95,0.10)'; c.fill(); c.strokeStyle = kind === 'new' ? GREEN : '#1f5a31'; c.lineWidth = 1; c.stroke();
    B.text(c, str, x + w / 2, y + 9, 10, kind === 'new' ? '#04210d' : '#6fe58f', true); return w;
  }
  P.lobbyList = function () { var cat = this.cat; return GAMES.filter(function (g) { return cat === 'all' || g.cat === cat; }); };
  function adH(cw) { return cw < 440 ? AD_H2 : AD_H; }
  P.lobbyMax = function () { var n = this.lobbyList().length; return Math.max(0, 90 + 14 + BANNER_H + 16 + 46 + 16 + n * (CARD_H + CARD_GAP) + 46 + adH(Math.min(this.W - 24, 520)) + 12 - this.H); };
  P.scrollBy = function (dy) { if (this.scene !== 'lobby') return; this.scroll = Math.max(0, Math.min(this.lobbyMax(), this.scroll + dy)); this.dirty = true; };
  P.draw_lobby = function () {
    var c = this.ctx, W = this.W, self = this, cw = Math.min(W - 24, 520), x = (W - cw) / 2;
    this.scroll = Math.max(0, Math.min(this.lobbyMax(), this.scroll));
    var y = 90 + 14 - this.scroll;
    // banner card
    B.rrect(c, x, y, cw, BANNER_H, 20); var gr = c.createLinearGradient(x, y, x + cw, y + BANNER_H); gr.addColorStop(0, '#0b1f12'); gr.addColorStop(1, '#14452a'); c.fillStyle = gr; c.fill(); c.strokeStyle = '#1f5a31'; c.lineWidth = 1; c.stroke();
    c.save(); B.rrect(c, x, y, cw, BANNER_H, 20); c.clip();
    c.beginPath(); c.arc(x + cw - 34, y + 30, 70, 0, Math.PI * 2); c.fillStyle = 'rgba(57,231,95,0.10)'; c.fill();
    var bg = c.createLinearGradient(x, 0, x + cw, 0); bg.addColorStop(0, '#39e75f'); bg.addColorStop(1, '#a6ff7a'); c.fillStyle = bg; c.fillRect(x, y + BANNER_H - 7, cw, 7);
    c.restore();
    this.drawLogo(x + cw - 42, y + 36, 24);
    tag(c, x + 16, y + 14, T('Free to play'), 'new');
    B.text(c, T('cbox') + ' · Charity Box', x + 16, y + 48, 12, '#7fcf95', false, 'left', cw - 100);
    B.text(c, T(TAGLINE), x + 16, y + 74, 16, '#fff', true, 'left', cw - 32);
    y += BANNER_H + 12;
    this.drawAdRow(x, y, cw); y += adH(cw) + 12;
    // category tab pill bar
    B.rrect(c, x, y, cw, 46, 23); c.fillStyle = '#0a100c'; c.fill(); c.strokeStyle = '#1c3a27'; c.lineWidth = 1.5; c.stroke();
    var tw = (cw - 8) / TABS.length;
    TABS.forEach(function (t, i) {
      var on = self.cat === t[0], tx = x + 4 + i * tw;
      if (on) { B.rrect(c, tx, y + 4, tw, 38, 19); c.fillStyle = 'rgba(57,231,95,0.15)'; c.shadowColor = 'rgba(57,231,95,0.4)'; c.shadowBlur = 8; c.fill(); c.shadowBlur = 0; c.strokeStyle = GREEN; c.lineWidth = 1.5; c.stroke(); }
      B.text(c, t[1], tx + tw / 2, y + 24, 15, on ? GREEN : MUTED, true);
      self.hits.push({ x: tx, y: y + 4, w: tw, h: 38, label: T(t[1]), cb: function () { self.cat = t[0]; self.scroll = 0; } });
    });
    y += 46 + 16;
    // game cards
    this.lobbyList().forEach(function (g) {
      B.rrect(c, x, y, cw, CARD_H, 18); c.fillStyle = '#0a110c'; c.fill(); c.strokeStyle = g.isNew ? '#2c7a43' : '#1a2e21'; c.lineWidth = 1.5; c.stroke();
      B.rrect(c, x + 12, y + 12, 60, 60, 14); c.fillStyle = g.color; c.fill(); c.strokeStyle = '#2a6b3d'; c.lineWidth = 1; c.stroke();
      B.text(c, g.icon, x + 42, y + 42, g.icon.length > 2 ? 18 : 24, '#e9ffe9', true, 'center', 52);
      var bw = 76, tx = x + 84, nameW = cw - 84 - bw - 22;
      B.text(c, g.name, tx, y + 24, 17, '#fff', true, 'left', nameW);
      var gx = tx, ty = y + 42;
      if (g.isNew) gx += tag(c, gx, ty, T('NEW'), 'new') + 4;
      gx += tag(c, gx, ty, T(g.cat === 'cards' ? 'Cards' : 'Board')) + 4;
      gx += tag(c, gx, ty, T('vs AI')) + 4;
      tag(c, gx, ty, T('Friends'));
      if (cw >= 440) B.text(c, g.desc, tx, y + 71, 11, '#7f9486', false, 'left', nameW);
      self.hits.push({ x: x, y: y, w: cw, h: CARD_H, label: T(g.name), cb: function () { self.cur = g; self.setScene('mode'); } });
      self.btn(x + cw - bw - 12, y + (CARD_H - 34) / 2, bw, 34, 'Play Now', function () { self.cur = g; self.setScene('mode'); }, { color: '#2e7d32', size: 13 });
      y += CARD_H + CARD_GAP;
    });
    B.text(c, 'For entertainment only - virtual chips, no cash value, not redeemable', W / 2, y + 14, 11, '#6f8577', false, 'center', W - 24);
    this.header('cbox', null); // drawn last so scrolled content slides underneath the fixed bar
  };
  /* ---- Watch ad, get chips (virtual, entertainment only) ---- */
  P.adLine = function () {
    var a = this.adInfo; if (!a) return T('Up to {0} per day · {1}s cooldown', 5, 60);
    if (a.remaining <= 0) return T('Daily limit reached · back tomorrow');
    if (a.cdUntil && a.cdUntil > Date.now()) return T('Next ad in {0}s', Math.ceil((a.cdUntil - Date.now()) / 1000));
    return T('{0} left today', a.remaining);
  };
  P.drawAdRow = function (x, y, cw) {
    var c = this.ctx, self = this, a = this.adInfo, amt = (a && a.amount) || 500;
    var off = a && (a.remaining <= 0 || (a.cdUntil && a.cdUntil > Date.now())) || this.adBusy;
    var narrow = cw < 440, h = adH(cw);
    B.rrect(c, x, y, cw, h, 18); c.fillStyle = '#0a110c'; c.fill(); c.strokeStyle = '#1c3a27'; c.lineWidth = 1.5; c.stroke();
    var label = T('Watch ad · +{0} chips', amt);
    if (narrow) {
      B.text(c, T('Happy Beans (virtual): {0}', this.beans), x + 14, y + 20, 13, '#ffe58a', true, 'left', cw - 28);
      B.text(c, this.adLine(), x + 14, y + 39, 11, MUTED, false, 'left', cw - 28);
      this.btn(x + 10, y + h - 44, cw - 20, 36, label, function () { self.adStart(); }, { color: '#2e7d32', size: 13, disabled: off });
      return;
    }
    B.text(c, T('Happy Beans (virtual): {0}', this.beans), x + 14, y + 20, 13, '#ffe58a', true, 'left', cw - 200);
    B.text(c, this.adLine(), x + 14, y + 39, 11, MUTED, false, 'left', cw - 200);
    var bw = Math.min(190, cw - 180), bw2 = Math.max(150, bw);
    this.btn(x + cw - bw2 - 10, y + 10, bw2, 36, label, function () { self.adStart(); }, { color: '#2e7d32', size: 13, disabled: off });
  };
  P.adSendStart = function () { this.net.send({ t: 'adStart' }); };
  P.adStart = function () {
    if (this.adBusy) return; this.adBusy = true; this.adPending = true; this.dirty = true;
    var self = this;
    if (this.net.ready) this.adSendStart(); else { this.net.start(); this.say('Connecting to the server...'); }
    setTimeout(function () { if (self.adPending) { self.adPending = false; self.adBusy = false; self.say('Cannot connect to the online server'); self.dirty = true; } }, 20000);
  };
  var AD_ERR = { cap: 'Daily ad limit reached. Come back tomorrow', cooldown: 'Please wait a moment before the next ad', badticket: 'Ad ticket invalid or expired. Please try again', expired: 'Ad ticket invalid or expired. Please try again', toosoon: 'Please watch the full ad first' };
  P.onAdMsg = function (m) {
    if (m.t === 'adStatus' || m.t === 'adTicket' || m.t === 'adDenied' || m.t === 'adGrant') {
      this.adInfo = { amount: m.amount, cap: m.cap, remaining: m.remaining, cdUntil: m.cooldownMs ? Date.now() + m.cooldownMs : 0 };
    }
    var self = this;
    if (m.t === 'adTicket') {
      this.adPending = false; this.adTicket = m.ticket; this.adBackScene = 'lobby'; this.setScene('ad');
      Ads.show({ minMs: m.minMs }).then(function (ok) {
        if (!ok) { self.adTicket = null; self.adBusy = false; self.setScene('lobby'); self.say('Ad was not completed, no chips granted'); return; }
        if (!self.net.send({ t: 'adClaim', ticket: self.adTicket })) { self.adBusy = false; self.setScene('lobby'); self.say('Cannot connect to the online server'); }
      });
    } else if (m.t === 'adGrant') {
      this.adBusy = false; this.adTicket = null; this.beans = Math.max(0, this.beans + m.granted); this.pf.storage.set('gh_beans', String(this.beans));
      this.setScene('lobby'); this.say(T('+{0} chips added to your Happy Beans', m.granted));
    } else if (m.t === 'adDenied') {
      this.adPending = false; this.adBusy = false; this.adTicket = null; if (this.scene === 'ad') { Ads.state = null; this.setScene('lobby'); }
      this.say(m.code === 'cooldown' && m.cooldownMs ? T('Please wait {0}s before the next ad', Math.ceil(m.cooldownMs / 1000)) : (AD_ERR[m.code] || 'Action failed'));
    }
  };
  P.draw_ad = function () {
    var c = this.ctx, W = this.W, H = this.H, self = this, left = Ads.left(), s = Ads.state, ms = s ? s.ms : 5000, done = !!s && left <= 0, amt = (this.adInfo && this.adInfo.amount) || 500;
    c.fillStyle = '#000'; c.fillRect(0, 0, W, H);
    var pw = Math.min(W - 32, 420), px = (W - pw) / 2, ph = 300, py = Math.max(20, (H - ph) / 2);
    B.rrect(c, px, py, pw, ph, 22); c.fillStyle = '#0a110c'; c.fill(); c.strokeStyle = '#2a6b3d'; c.lineWidth = 2; c.stroke();
    B.rrect(c, px + 14, py + 14, 110, 22, 11); c.fillStyle = '#3b3b1e'; c.fill();
    B.text(c, T('Ad placeholder'), px + 69, py + 26, 12, '#ffe58a', true, 'center', 104);
    B.text(c, T('Ad placeholder'), W / 2, py + 84, 26, '#eafff0', true, 'center', pw - 24);
    B.text(c, T('Test ad slot - no real advertisement is shown.'), W / 2, py + 114, 12, MUTED, false, 'center', pw - 24);
    var bx = px + 24, bwid = pw - 48, frac = Math.min(1, 1 - left / ms);
    B.rrect(c, bx, py + 148, bwid, 10, 5); c.fillStyle = '#16241b'; c.fill();
    if (frac > 0.02) { B.rrect(c, bx, py + 148, bwid * frac, 10, 5); c.fillStyle = GREEN; c.fill(); }
    B.text(c, done ? T('Thanks for watching!') : T('Reward in {0}s', Math.ceil(left / 1000)), W / 2, py + 180, 15, done ? GREEN : '#cfe8d5', true, 'center', pw - 24);
    this.btn(px + 30, py + 202, pw - 60, 44, T('Claim +{0} chips', amt), function () { Ads.finish(true); }, { color: '#2e7d32', size: 17, disabled: !done });
    B.text(c, T('For entertainment only - virtual chips, no cash value, not redeemable'), W / 2, py + 274, 10, '#6f8577', false, 'center', pw - 20);
  };
  P.wrapText = function (str, x, y, size, color, maxW) { // centered word/char wrap
    var c = this.ctx; str = T(str); c.font = size + 'px ' + FONT; var lines = [], cur = '', words = str.split(/(?<=[\s,，。;；])|(?=[\u3000-\u9fff])/);
    words.forEach(function (w) { if (cur && c.measureText(cur + w).width > maxW) { lines.push(cur); cur = w; } else cur += w; });
    if (cur) lines.push(cur);
    for (var i = 0; i < lines.length; i++) B.text(c, lines[i].trim(), x, y + i * (size + 5), size, color, false, 'center');
  };
  P.fitText = function (str, x, y, size, color, bold, maxW) { // shrink the font (down to 11px) before squeezing
    var c = this.ctx; str = T(str); while (size > 11) { c.font = (bold ? 'bold ' : '') + size + 'px ' + FONT; if (c.measureText(str).width <= maxW) break; size--; }
    B.text(c, str, x, y, size, color, bold, 'center', maxW);
  };
  P.draw_mode = function () {
    var c = this.ctx, W = this.W, g = this.cur, self = this; this.header(g.name, function () { self.setScene('lobby'); });
    var bw = Math.min(W - 40, 340), x = (W - bw) / 2, y = 120, bh = 56;
    [['Play vs Computer', '#2e7d32', function () { self.setScene('diff'); }],
    ['Create Friend Room', '#1565c0', function () { self.createRoom(); }],
    ['Join Room', '#6a1b9a', function () { self.joinCode = ''; self.setScene('join'); }],
    ['Quick Match', '#ef6c00', function () { self.quickMatch(); }]].forEach(function (b) { self.btn(x, y, bw, bh, b[0], b[2], { color: b[1], size: 22 }); y += bh + 14; });
    this.wrapText(g.multi ? 'Friend rooms: empty seats are filled by the computer; Quick Match falls back to the computer after 8 s' : 'If no human opponent is found within 8 s, Quick Match starts a game against the computer', W / 2, y + 8, 12, '#9cc3a8', W - 40);
  };
  P.draw_diff = function () {
    var c = this.ctx, W = this.W, self = this, g = this.cur; this.header(T(g.name) + T(' · vs Computer'), function () { self.setScene('mode'); });
    var bw = Math.min(W - 40, 340), x = (W - bw) / 2, y = 130;
    B.text(c, 'Choose difficulty', W / 2, y - 14, 16, '#cfe8d5');
    LEVELS.forEach(function (n, i) {
      var on = self.diff.level === i + 1;
      self.btn(x + i * (bw / 3), y, bw / 3 - 8, 46, n, function () { self.diff.level = i + 1; }, { color: on ? '#ff8f00' : '#546e7a', stroke: on ? '#fff' : null });
    });
    if (g.zjh || g.holdem) {
      y += 90; B.text(c, 'Table size (you + computers)', W / 2, y - 14, 16, '#cfe8d5');
      [2, 3, 4, 5, 6].forEach(function (k, i) { var on = self.diff.n === k; self.btn(x + i * (bw / 5), y, bw / 5 - 6, 40, T('{0} players', k), function () { self.diff.n = k; }, { color: on ? '#ff8f00' : '#546e7a', stroke: on ? '#fff' : null, size: 16 }); });
      this.wrapText(g.holdem ? 'Blinds 10/20, 1000 chips each. For entertainment only, virtual chips, no cash value, not redeemable' : 'Each hand: 1000 beans buy-in, ante 10. For entertainment only, virtual chips, no cash value, not redeemable', W / 2, y + 58, 11, '#ffcc80', W - 28);
      this.btn(x, y + 98, bw, 56, 'Start Game', function () { self.startLocalMulti(g.id, self.diff.level, self.diff.n); }, { color: '#2e7d32', size: 22 }); return;
    }
    if (g.multi) { B.text(c, g.id === 'doudizhu' ? 'You and two computers (bidding decides the landlord)' : 'You and three computers', W / 2, y + 74, 14, '#9cc3a8'); this.btn(x, y + 100, bw, 56, 'Start Game', function () { self.startLocal(g.id, self.diff.level, 1); }, { color: '#2e7d32', size: 22 }); return; }
    y += 90; B.text(c, 'You play', W / 2, y - 14, 16, '#cfe8d5');
    var names = g.id === 'gomoku' ? ['Black (first)', 'White (second)'] : g.id === 'xiangqi' ? ['Red (first)', 'Black (second)'] : g.id === 'chess' ? ['White (first)', 'Black (second)'] : ['Red (first)', 'Blue (second)'];
    names.forEach(function (n, i) {
      var on = self.diff.seat === i + 1;
      self.btn(x + i * (bw / 2), y, bw / 2 - 8, 46, n, function () { self.diff.seat = i + 1; }, { color: on ? '#ff8f00' : '#546e7a', stroke: on ? '#fff' : null });
    });
    this.btn(x, y + 90, bw, 56, 'Start Game', function () { self.startLocal(g.id, self.diff.level, self.diff.seat); }, { color: '#2e7d32', size: 22 });
  };
  P.draw_join = function () {
    var c = this.ctx, W = this.W, self = this; this.header('Join Room', function () { self.setScene('mode'); });
    B.text(c, 'Enter the 6-digit room code from your friend', W / 2, 118, 17, '#cfe8d5');
    var bw = Math.min(W - 40, 300), x = (W - bw) / 2;
    for (var i = 0; i < 6; i++) { var bx = x + i * (bw / 6); B.rrect(c, bx + 3, 134, bw / 6 - 6, 50, 8); c.fillStyle = '#0e2a1f'; c.fill(); B.text(c, this.joinCode[i] || '', bx + bw / 12, 160, 28, '#ffeb99', true); }
    var ky = 205, kh = Math.min(56, (this.H - 280) / 4 - 8), kw = bw / 3 - 8, keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9', 'Clear', '0', 'Del'];
    keys.forEach(function (k, i) {
      var kx = x + (i % 3) * (bw / 3) + 4, yy = ky + Math.floor(i / 3) * (kh + 8);
      self.btn(kx, yy, kw, kh, k, function () {
        if (k === 'Clear') self.joinCode = ''; else if (k === 'Del') self.joinCode = self.joinCode.slice(0, -1);
        else if (self.joinCode.length < 6) self.joinCode += k;
        if (self.joinCode.length === 6) self.joinRoom(self.joinCode);
      }, { color: '#37674f', size: 22 });
    });
    if (this.netState !== 'ready') B.text(c, 'Connecting to server…', W / 2, ky + 4 * (kh + 8) + 12, 14, '#ffcc80');
  };
  P.draw_waiting = function () {
    var c = this.ctx, W = this.W, self = this, g = this.cur; this.header('Friend Room', function () { self.net.send({ t: 'leave' }); self.setScene('mode'); });
    B.text(c, 'Room code', W / 2, 130, 18, '#cfe8d5'); B.text(c, this.roomCode || '------', W / 2, 190, 56, '#ffeb99', true);
    var dots = new Array(1 + Math.floor(Date.now() / 500) % 3 + 1).join('.');
    if (g && g.multi) {
      B.text(c, T('Share the room code with friends. The host presses Start Now; empty seats are filled by the computer') + dots, W / 2, 240, 13, '#fff');
      var pl = this.roomPlayers || [], y = 262;
      var rn = this.roomN || g.seats;
      if (g.cap && this.roomHost === this.roomSeat) { B.text(c, 'Seats', 50, y + 6, 13, '#cfe8d5', false, 'left'); [2, 3, 4, 5, 6].forEach(function (k, j) { self.btn(100 + j * 48, y - 10, 42, 32, String(k), function () { self.net.send({ t: 'setcap', n: k }); }, { color: rn === k ? '#ff8f00' : '#546e7a', size: 15, stroke: rn === k ? '#fff' : null, label: 'seats' + k }); }); y += 36; }
      for (var i = 0; i < rn; i++) { var p = pl[i]; B.rrect(c, 30, y, W - 60, 34, 8); c.fillStyle = 'rgba(0,0,0,0.3)'; c.fill(); B.text(c, T('Seat {0}', i + 1) + '  ' + (p ? T(p.name) + (this.roomSeat === i + 1 ? T(' (you)') : '') + (this.roomHost === i + 1 ? T(' · host') : '') : T('Empty (the computer will join)')), 44, y + 18, 15, p ? '#fff' : '#9cc3a8', false, 'left'); y += 40; }
      if (this.netState !== 'ready') B.text(c, 'Connecting to server… (the online server must be running)', W / 2, y + 8, 14, '#ffcc80');
      if (this.roomHost === this.roomSeat) this.btn(W / 2 - 100, y + 24, 200, 50, 'Start Now', function () { self.net.send({ t: 'start' }); }, { color: '#2e7d32', size: 20 });
      else B.text(c, 'Waiting for the host to start…', W / 2, y + 48, 15, '#cfe8d5');
      this.btn(W / 2 - 80, y + 90, 160, 44, 'Cancel', function () { self.net.send({ t: 'leave' }); self.setScene('mode'); }, { color: '#c62828' });
      return;
    }
    B.text(c, T('Share the room code with a friend and wait for them to join') + dots, W / 2, 262, 16, '#fff');
    if (this.netState !== 'ready') B.text(c, 'Connecting to server… (the online server must be running)', W / 2, 296, 14, '#ffcc80');
    this.btn(W / 2 - 80, 330, 160, 48, 'Cancel', function () { self.net.send({ t: 'leave' }); self.setScene('mode'); }, { color: '#c62828' });
  };
  P.draw_matching = function () {
    var c = this.ctx, W = this.W, self = this; this.header('Quick Match', function () { self.cancelMatch(); self.setScene('mode'); });
    var left = Math.max(0, Math.ceil((MATCH_WAIT_MS - (Date.now() - this.matchStart)) / 1000));
    B.text(c, 'Looking for an opponent…', W / 2, 160, 24, '#fff', true);
    B.text(c, T('No human found in {0} s - starting a game against the computer', left), W / 2, 205, 15, '#ffcc80');
    var a = Date.now() / 300; c.strokeStyle = '#ffeb99'; c.lineWidth = 6; c.beginPath(); c.arc(W / 2, 290, 30, a, a + 4); c.stroke();
    this.btn(W / 2 - 80, 360, 160, 48, 'Cancel', function () { self.cancelMatch(); self.setScene('mode'); }, { color: '#c62828' });
  };

  /* ---------- 联机流程 ---------- */
  P.createRoom = function () { var self = this; this.roomCode = ''; this.pendingGame = this.cur.id; this.net.start(); this.setScene('waiting'); this.sendWhenReady({ t: 'create', game: this.cur.id }); };
  P.joinRoom = function (code) { this.pendingGame = this.cur.id; this.sendWhenReady({ t: 'join', code: code }); };
  P.quickMatch = function () { this.matchStart = Date.now(); this.pendingGame = this.cur.id; this.net.start(); this.setScene('matching'); this.sendWhenReady({ t: 'match', game: this.cur.id }); };
  P.cancelMatch = function () { this.net.send({ t: 'cancelMatch' }); };
  P.matchTimeout = function () {
    if (this.scene !== 'matching') return;
    this.net.send({ t: 'cancelMatch' }); this.say('No human opponent found - starting a game against the computer');
    this.startLocal(this.cur.id, 2, this.cur.multi ? 1 : 1 + Math.floor(Math.random() * 2));
  };
  P.sendWhenReady = function (msg) {
    var self = this, tries = 0;
    (function go() {
      if (self.net.send(msg)) return;
      if (++tries > 40 || !self.net.wanted) { if (self.scene === 'waiting' || self.scene === 'join') self.say('Cannot connect to the online server'); return; }
      setTimeout(go, 250);
    })();
  };
  P.onNet = function (m) {
    this.dirty = true;
    if (m.t === 'err') { if (this.adPending) { this.adPending = false; this.adBusy = false; } this.say(m.msg || 'Action failed'); return; }
    if (m.t === 'welcome') { if (this.adPending) this.adSendStart(); else this.net.send({ t: 'adStatus' }); return; }
    if (m.t && m.t.indexOf('ad') === 0 && m.t !== 'adPending') { this.onAdMsg(m); return; }
    if (m.t !== 'room') return;
    var g = this.g;
    if (g && g.mode === 'online' && g.code === m.code) { this.applyRoom(m); return; }
    if (this.scene === 'waiting' || this.scene === 'join' || this.scene === 'matching') {
      if (m.status === 'waiting' && (m.nSeats > 2 || m.game === 'zhajinhua' || m.game === 'holdem')) { this.roomN = m.nSeats; this.roomCode = m.code; this.roomPlayers = m.players; this.roomSeat = m.seat; this.roomHost = m.host; return; }
      if (this.scene === 'waiting' && m.status === 'waiting') { this.roomCode = m.code; return; }
      if (m.status === 'waiting') return;
      this.startOnline(m);
    }
  };
  P.startOnline = function (m) {
    var g = this.newGameCtl(m.game, 'online', m.seat); g.code = m.code; this.g = g; this.cur = this.gameInfo(m.game);
    if (this.cur.multi) { g.names = {}; g.lastBy = {}; g.seq = -1; }
    this.applyRoom(m, true); this.setScene('game'); Sound.sfx('start');
  };
  P.applyRoom = function (m, first) {
    var g = this.g; g.players = m.players; g.status = m.status;
    if (this.cur && this.cur.multi) { g.host = m.host; g.seat = m.seat; g.state = m.state; g.names = {}; m.players.forEach(function (p, i) { g.names[i + 1] = p ? (T(p.name) + (i + 1 === m.seat ? T(' (you)') : '') + (p.auto ? T(' · auto') : '')) : ''; }); this.afterMulti(g, first); return; }
    var prev = g.state; g.state = m.state; g.seat = m.seat;
    if (m.game === 'luzhanqi' && m.state.phase === 'setup' && !g.setup) g.setup = { layout: Luz.randomLayout(), sel: null, done: false };
    if (g.setup && m.ready) g.setup.done = !!m.ready[m.seat - 1];
    if (m.game === 'luzhanqi' && m.state.phase === 'playing' && g.setup) { g.setup = null; Sound.sfx('start'); }
    if (!first) this.afterChange(prev, g.state);
    if (g.state.over) this.onOver();
    g.sel = null; g.legal = [];
  };

  /* ---------- 游戏控制器 ---------- */
  P.newGameCtl = function (game, mode, seat) { return { game: game, mode: mode, seat: seat, state: null, sel: null, legal: [], level: 2, setup: null, overShown: false, players: null, status: 'playing' }; };
  P.startLocal = function (game, level, seat) {
    if (E.SEATS[game] > 2) return this.startLocalMulti(game, level);
    var eng = E[game], g = this.newGameCtl(game, 'ai', seat); g.level = level; g.aiSeat = 3 - seat; g.state = eng.newGame();
    if (game === 'luzhanqi') { Luz.setup(g.state, g.aiSeat, Luz.randomLayout()); g.setup = { layout: Luz.randomLayout(), sel: null, done: false }; }
    this.g = g; this.cur = this.gameInfo(game); this.net.stop(); this.setScene('game'); Sound.sfx('start');
    this.scheduleAI();
  };
  P.aiOpts = function (game, level) { var sc = this.pf.aiTimeScale || 1; return { timeMs: Math.max(20, Math.round(HARD_MS[game] * sc)) }; };
  P.scheduleAI = function () {
    var g = this.g, self = this; if (!g || g.mode !== 'ai' || g.state.over || g.aiPending) return;
    if (g.state.phase === 'setup' || g.state.turn !== g.aiSeat) return;
    g.aiPending = true; var t0 = Date.now();
    AIC.request(g.game, g.state, g.aiSeat, g.level, this.aiOpts(g.game, g.level), function (mv) {
      var wait = Math.max(0, 450 - (Date.now() - t0));
      setTimeout(function () {
        g.aiPending = false; if (self.g !== g || g.state.over) return;
        if (!mv) { E[g.game].resign(g.state, g.aiSeat); self.onOver(); self.dirty = true; return; }
        var prev = snap(g.state), r = E[g.game].move(g.state, g.aiSeat, mv);
        if (r.ok) { self.afterChange(prev, g.state); if (g.state.over) self.onOver(); }
        self.dirty = true;
      }, wait);
    });
  };
  function snap(s) { return { count: s.count, moves: s.moves ? s.moves.length : 0, dead: s.dead ? s.dead.length : 0, pieces: countPieces(s), phase: s.phase }; }
  function countPieces(s) { if (s.game !== 'xiangqi') return 0; var n = 0; s.board.forEach(function (r) { r.forEach(function (x) { if (x) n++; }); }); return n; }
  P.afterChange = function (prev, now) { // play move / capture sounds from the state change
    if (!prev) return; var p = prev.pieces !== undefined ? prev : snap(prev), n = snap(now);
    if (now.game === 'gomoku') { if (n.moves > p.moves) Sound.sfx('place'); }
    else if (now.game === 'chess') { if (n.count > p.count && now.last) Sound.sfx(now.check && !now.over ? 'chesscheck' : now.over && now.winner !== 3 ? 'chesscheck' : now.last.cap ? 'chesscap' : 'chessmove'); }
    else if (now.game === 'xiangqi') { if (n.count > p.count) Sound.sfx(n.pieces < p.pieces ? 'capture' : 'place'); }
    else if (now.game === 'luzhanqi') { if (n.count > p.count) Sound.sfx(now.info ? 'capture' : 'place'); }
    this.dirty = true;
  };
  P.onOver = function () {
    var g = this.g; if (!g || g.overShown) return; g.overShown = true;
    var w = g.state.winner; Sound.sfx('end');
    setTimeout(function () { Sound.sfx(w === g.seat ? 'win' : w === 3 ? 'end' : 'lose'); }, 500);
  };
  P.boardTap = function (x, y) {
    var g = this.g; if (!g || g.state.over) return; var rect = this.boardRect(), b = B[g.game], cell = b.cellAt(x, y, rect, g);
    if (!cell) return;
    if (g.game === 'luzhanqi' && g.setup && g.state.phase === 'setup') return this.setupTap(cell);
    if (g.state.turn !== g.seat || (g.state.phase && g.state.phase !== 'playing')) { if (g.mode === 'online' || g.aiPending) this.say('Not your turn'); return; }
    if (g.game === 'chess') return this.chessTap(cell.sq);
    if (g.game === 'gomoku') return this.tryMove({ x: cell.x, y: cell.y });
    var piece = g.state.board[cell.r][cell.c], own = piece && (g.game === 'xiangqi' ? E.xiangqi.sideOf(piece) === g.seat : piece.p === g.seat);
    if (own) { g.sel = { r: cell.r, c: cell.c }; g.legal = E[g.game].legalMovesFrom(g.state, g.seat, cell.r, cell.c); if (!g.legal.length) this.say('This piece cannot move right now'); return; }
    if (g.sel) { var mv = g.legal.filter(function (m) { return m.tr === cell.r && m.tc === cell.c; })[0]; if (mv) return this.tryMove({ fr: mv.fr, fc: mv.fc, tr: mv.tr, tc: mv.tc }); g.sel = null; g.legal = []; }
  };
  P.chessTap = function (sq) {
    var g = this.g, s = g.state;
    if (g.promo) { g.promo = null; return; }
    var pc = s.board[sq], own = pc && ((pc > 0 ? 1 : 2) === g.seat);
    if (g.sel !== null && g.sel !== undefined && g.sel >= 0) {
      var mvs = (g.legal || []).filter(function (m) { return m.to === sq; });
      if (mvs.length) { if (mvs.length > 1 || mvs[0].promo) { g.promo = { from: g.sel, to: sq }; return; } return this.tryMove({ from: g.sel, to: sq }); }
    }
    if (own) { g.sel = sq; g.legal = E.chess.legalMovesFrom(s, g.seat, sq); if (!g.legal.length) this.say('This piece cannot move right now'); return; }
    g.sel = null; g.legal = [];
  };
  P.tryMove = function (mv) {
    var g = this.g;
    if (g.mode === 'online') { if (!this.net.send({ t: 'move', move: mv })) this.say('Not connected, please wait'); g.sel = null; g.legal = []; g.promo = null; return; }
    var prev = snap(g.state), r = E[g.game].move(g.state, g.seat, mv);
    if (!r.ok) { this.say(r.err); return; }
    g.sel = null; g.legal = []; g.promo = null; this.afterChange(prev, g.state);
    if (g.state.over) this.onOver(); else this.scheduleAI();
  };
  P.setupTap = function (cell) {
    var s = this.g.setup, i = -1; if (cell.sr < 6 || s.done) return;
    for (var k = 0; k < Luz.STATIONS.length; k++) if (Luz.STATIONS[k][0] === cell.sr - 6 && Luz.STATIONS[k][1] === cell.sc) i = k;
    if (i < 0) return;
    if (s.sel === null || s.sel === undefined) { s.sel = i; return; }
    if (s.sel === i) { s.sel = null; return; }
    var t = s.layout.slice(); var a = t[s.sel]; t[s.sel] = t[i]; t[i] = a;
    if (Luz.validLayout(t)) s.layout = t; else this.say('Invalid swap: the flag must stay in a headquarters, mines in the back two rows, bombs not in the front row');
    s.sel = null;
  };
  P.confirmSetup = function () {
    var g = this.g, s = g.setup; s.done = true;
    if (g.mode === 'online') { this.net.send({ t: 'setup', layout: s.layout }); }
    else { Luz.setup(g.state, g.seat, s.layout); g.setup = null; this.scheduleAI(); Sound.sfx('start'); }
  };
  P.resign = function () {
    var g = this.g; if (!g || g.state.over) return;
    if (g.mode === 'online') this.net.send({ t: 'resign' }); else { E[g.game].resign(g.state, g.seat); this.onOver(); }
  };
  P.leaveGame = function () {
    var g = this.g;
    if (g && g.mode === 'online') { this.net.send({ t: 'leave' }); }
    this.g = null; this.net.stop(); this.setScene('lobby');
  };

  /* ---------- 对局界面 ---------- */
  P.boardRect = function () { var top = 92, bottom = 118; return { x: 6, y: top, w: this.W - 12, h: this.H - top - bottom }; };
  P.draw_game = function () {
    if (this.cur && this.cur.multi) return this.draw_multi();
    var c = this.ctx, W = this.W, H = this.H, g = this.g, self = this, s = g.state, info = this.gameInfo(g.game);
    this.header(T(info.name) + (g.mode === 'ai' ? T(' · vs Computer ({0})', T(LEVELS[g.level - 1])) : T(' · Room {0}', g.code)), function () { if (s.over) self.leaveGame(); else self.confirmLeave(); });
    // 棋盘区
    var dg = g; if (g.game === 'luzhanqi' && g.mode === 'ai') { dg = Object.assign({}, g, { state: Luz.view(g.state, g.seat) }); } // local games also draw only your own view (no leaking of enemy pieces)
    B[g.game].draw(c, this.boardRect(), dg);
    // 底部状态
    var y = H - 112; c.fillStyle = 'rgba(0,0,0,0.3)'; c.fillRect(0, y, W, 112);
    var line = this.statusText(); this.fitText(line, W / 2, y + 20, 17, '#eafff0', true, W - 16);
    var sub = this.subText(); if (sub) this.fitText(sub, W / 2, y + 44, 13, '#cfe8d5', false, W - 16);
    if (g.game === 'luzhanqi' && g.setup && s.phase === 'setup') {
      var bw = Math.min(150, W / 2 - 14);
      if (!g.setup.done) {
        this.btn(W / 2 - bw - 6, y + 58, bw, 42, 'Shuffle Setup', function () { g.setup.layout = Luz.randomLayout(); g.setup.sel = null; }, { color: '#546e7a' });
        this.btn(W / 2 + 6, y + 58, bw, 42, 'Confirm', function () { self.confirmSetup(); }, { color: '#2e7d32' });
      }
    } else if (!s.over) {
      this.btn(W / 2 - 60, y + 62, 120, 38, 'Resign', function () { self.resign(); }, { color: '#c62828', size: 16 });
    }
    if (g.promo && !s.over) {
      var pw = Math.min(W - 30, 330), px = (W - pw) / 2, py = this.boardRect().y + 90;
      B.rrect(c, px, py, pw, 150, 14); c.fillStyle = 'rgba(10,25,18,0.95)'; c.fill(); c.strokeStyle = '#ffeb99'; c.lineWidth = 2; c.stroke();
      B.text(c, 'Promote pawn to:', W / 2, py + 22, 16, '#ffeb99', true);
      [['Queen', 5], ['Rook', 4], ['Bishop', 3], ['Knight', 2]].forEach(function (q, i) { self.btn(px + 12 + (i % 2) * (pw / 2 - 6), py + 40 + Math.floor(i / 2) * 50, pw / 2 - 18, 42, q[0], function () { self.tryMove({ from: g.promo.from, to: g.promo.to, promo: q[1] }); }, { color: '#2e7d32', size: 18 }); });
    }
    if (s.over) this.overlay();
    if (g.mode === 'online' && this.netState !== 'ready') { c.fillStyle = 'rgba(0,0,0,0.6)'; c.fillRect(0, 90, W, 28); B.text(c, 'Connection lost, reconnecting…', W / 2, 104, 15, '#ffcc80'); }
  };
  P.confirmLeave = function () { this.leaveGame(); };
  P.statusText = function () {
    var g = this.g, s = g.state, me = g.seat, names = g.game === 'gomoku' ? ['Black stones', 'White stones'] : g.game === 'xiangqi' ? ['Red', 'Black'] : g.game === 'chess' ? ['White', 'Black'] : ['Red', 'Blue'];
    if (s.over) return s.winner === 3 ? 'Draw' : (s.winner === me ? 'You won!' : 'You lost');
    if (g.game === 'luzhanqi' && s.phase === 'setup') return g.setup && g.setup.done ? 'Setup confirmed, waiting for the opponent…' : 'Setup: tap two pieces to swap them, then confirm';
    var mine = s.turn === me, txt = mine ? T('Your turn ({0})', T(names[me - 1])) : (g.mode === 'ai' ? 'Computer is thinking…' : 'Waiting for the opponent…');
    if ((g.game === 'xiangqi' || g.game === 'chess') && s.check) txt += T(' · Check!');
    return txt;
  };
  P.subText = function () {
    var g = this.g, s = g.state;
    if (g.mode === 'online' && g.players) { var o = g.players[2 - g.seat]; if (o && !o.online) return 'Opponent disconnected, waiting for reconnect (up to 60 s)…'; if (o) return T('Opponent: {0}', T(o.name)); }
    if (g.game === 'luzhanqi' && s.info && s.phase === 'playing') {
      var LT = Luz.TYPES, i = s.info, a = i.att === '?' ? '?' : LT[i.att].n, d = i.def === '?' ? '?' : LT[i.def].n;
      var res = T({ win: 'attacker wins', lose: 'attacker is captured', both: 'both are destroyed', flag: 'flag captured' }[i.outcome]);
      return T('Last battle: {0} {1} attacks {2} -> {3}', i.attP === g.seat ? T('your') : T('enemy'), T(a), T(d), res);
    }
    if (g.game === 'chess' && s.last) return T('Last move: {0}', s.last.san) + ' · ' + T('Move {0}', Math.floor(s.count / 2) + 1);
    if (g.game === 'luzhanqi' && s.dead) return T('Lost pieces: yours {0} · enemy {1}', s.dead.filter(function (d) { return d.p === g.seat; }).length, s.dead.filter(function (d) { return d.p !== g.seat; }).length);
    return '';
  };
  P.overlay = function () {
    var c = this.ctx, W = this.W, H = this.H, g = this.g, self = this, s = g.state;
    var w = Math.min(W - 40, 320), h = 200, x = (W - w) / 2, y = (H - h) / 2 - 20;
    B.rrect(c, x, y, w, h, 16); c.fillStyle = 'rgba(10,25,18,0.93)'; c.fill(); c.strokeStyle = '#ffeb99'; c.lineWidth = 2; c.stroke();
    var win = s.winner === g.seat;
    B.text(c, s.winner === 3 ? 'Draw' : win ? 'Victory!' : 'Defeat', x + w / 2, y + 40, 32, win ? '#ffd54f' : '#b0bec5', true);
    B.text(c, s.reason || '', x + w / 2, y + 78, 15, '#cfe8d5');
    if (g.mode === 'ai') this.btn(x + 16, y + 120, w / 2 - 22, 50, 'Play Again', function () { self.startLocal(g.game, g.level, g.seat); }, { color: '#2e7d32' });
    this.btn(g.mode === 'ai' ? x + w / 2 + 6 : x + 40, y + 120, g.mode === 'ai' ? w / 2 - 22 : w - 80, 50, 'Back to Lobby', function () { self.leaveGame(); }, { color: '#455a64' });
  };


  /* ================= 斗地主 / 麻将(3、4 人,电脑补位)================= */
  P.startLocalMulti = function (game, level, n) {
    var eng = E[game], info = this.gameInfo(game), g = this.newGameCtl(game, 'ai', 1);
    if (game === 'zhajinhua' || game === 'holdem') { n = Math.max(2, Math.min(6, n || this.diff.n || 5)); g.n = n; }
    var prevG = this.g;
    g.level = level; g.state = eng.newGame(); g.names = { 1: 'Me' }; for (var i = 2; i <= (g.n || info.seats); i++) g.names[i] = BOT_NAMES[i - 1];
    g.lastBy = {}; g.seq = -1; g.round = (this.localRound = (this.localRound || 0) + 1);
    if (game === 'mahjong') g.state = eng.newGame({ dealer: ((g.round - 1) % 4) + 1 });
    if (game === 'zhajinhua') g.state = eng.newGame({ n: g.n, dealer: ((g.round - 1) % g.n) + 1 });
    if (game === 'holdem') { var carry = prevG && prevG.game === 'holdem' && prevG.state.over && prevG.n === g.n; g.state = eng.newGame({ n: g.n, dealer: ((g.round - 1) % g.n) + 1, stacks: carry ? Hd.nextStacks(prevG.state) : undefined, handNo: carry ? prevG.state.handNo + 1 : 1 }); }
    this.g = g; this.cur = info; this.net.stop(); this.setScene('game'); this.afterMulti(g, true); this.scheduleMulti();
  };
  P.viewOf = function (g) { return g.mode === 'ai' ? E[g.game].view(g.state, g.seat) : g.state; };
  P.afterMulti = function (g, first) {
    var s = g.state, vs = this.viewOf(g), prevSeq = g.seq;
    if (g.vs && g.vs.over && !vs.over) { g.overShown = false; g.beansDone = false; g.sel = null; g.selTile = null; g.lastBy = {}; g.seq = -1; prevSeq = -1; } // a new hand
    g.vs = vs;
    if (g.game === 'doudizhu') { // latest play of each seat this round
      g.lastBy = {}; var pl = vs.plays || [];
      if (vs.last || (pl.length && !vs.over)) { for (var i = pl.length - 1; i >= 0; i--) { var e = pl[i]; if (!g.lastBy[e.seat]) g.lastBy[e.seat] = e.pass ? { pass: true } : { cards: e.cards, type: e.type }; if (e.lead) break; } }
      if (!vs.last && vs.phase === 'play') g.lastBy = {};
      if (vs.over) { g.lastBy = {}; var q = pl; for (var j = q.length - 1; j >= 0; j--) { var e2 = q[j]; if (!g.lastBy[e2.seat]) g.lastBy[e2.seat] = e2.pass ? { pass: true } : { cards: e2.cards, type: e2.type }; if (e2.lead) break; } }
      if (g.sel) { var mine = vs.hands[g.seat] || []; Object.keys(g.sel).forEach(function (k) { if (mine.indexOf(+k) < 0) delete g.sel[k]; }); }
    }
    if (vs.seq !== prevSeq) { if (!first || prevSeq !== -1) { var ev = vs.event; if (ev && SOUND_OF[ev.t]) { if (ev.t === 'redeal') Sound.sfx('shuffle'); Sound.sfx(SOUND_OF[ev.t]); } } else { Sound.sfx('shuffle'); setTimeout(function () { Sound.sfx('deal'); }, 1100); } g.seq = vs.seq; }
    if (vs.over) g.pick = false;
    if (vs.turn !== g.lastTurn) { g.lastTurn = vs.turn; g.pick = false; g.selTile = null; g.raiseTo = null; if (vs.turn !== g.seat) g.sel = null; }
    if (vs.over) this.onOverMulti(g);
    this.dirty = true;
  };
  P.onOverMulti = function (g) {
    if (g.overShown) return; g.overShown = true; var vs = g.vs;
    var info = this.gameInfo(g.game), delta = (vs.scores[g.seat] || 0) * info.unit;
    if (!g.beansDone && info.holdem) { g.beansDone = true; g.delta = delta; }
    if (!g.beansDone) { g.beansDone = true; g.delta = delta; this.beans = Math.max(0, this.beans + delta); if (this.beans < 200) { this.beans = 1000; g.relief = true; } this.pf.storage.set('gh_beans', String(this.beans)); }
    var won = vs.winners && vs.winners.indexOf(g.seat) >= 0;
    setTimeout(function () { Sound.sfx(won ? 'win' : (vs.winners && vs.winners.length ? 'lose' : 'end')); }, 650);
    if (info.holdem && won) setTimeout(function () { Sound.sfx('potwin'); }, 400);
    if (won) setTimeout(function () { Sound.sfx('laugh'); }, 1300); else if (vs.winners && vs.winners.length) setTimeout(function () { Sound.sfx('sigh'); }, 1500);
  };
  P.sendMulti = function (mv) {
    var g = this.g; if (!g || !g.vs || g.vs.over) return;
    if (g.mode === 'online') { if (!this.net.send({ t: 'move', move: mv })) this.say('Not connected, please wait'); return; }
    if (g.state.turn !== g.seat && !(g.game === 'mahjong' && g.vs.turn === g.seat) && !(g.game === 'zhajinhua' && mv && mv.a === 'look')) return;
    var r = E[g.game].move(g.state, g.seat, mv); if (!r.ok) { this.say(r.err); return; }
    g.sel = null; g.selTile = null; g.pick = false; this.afterMulti(g); this.scheduleMulti();
  };
  P.scheduleMulti = function () {
    var g = this.g, self = this; if (!g || g.mode !== 'ai' || g.state.over || g.aiPending) return;
    var actor = g.state.turn; if (actor === g.seat && !g.auto) return;
    g.aiPending = true; var t0 = Date.now(), view = E[g.game].view(g.state, actor), level = actor === g.seat ? 3 : g.level;
    AIC.request(g.game, view, actor, level, this.aiOpts(g.game, level), function (mv) {
      var wait = Math.max(0, (g.game === 'mahjong' ? 650 : g.game === 'zhajinhua' || g.game === 'holdem' ? 700 : 800) - (Date.now() - t0));
      setTimeout(function () {
        g.aiPending = false; if (self.g !== g || g.state.over) return;
        var eng = E[g.game], r = mv ? eng.move(g.state, actor, mv) : { ok: false };
        if (!r.ok) { var st = g.state, fb = g.game === 'holdem' ? (Hd.options(st, actor).check ? { a: 'check' } : { a: 'fold' }) : g.game === 'zhajinhua' ? (Zjh.options(st, actor).call ? { a: 'call' } : { a: 'fold' }) : g.game === 'doudizhu' ? (st.phase === 'bid' ? { bid: 0 } : st.last ? { pass: true } : { cards: [st.hands[actor][st.hands[actor].length - 1]] }) : (st.phase === 'claim' ? { a: 'pass' } : { a: 'discard', tile: st.hands[actor][st.hands[actor].length - 1] }); eng.move(st, actor, fb); }
        self.afterMulti(g); self.scheduleMulti();
      }, wait);
    });
  };
  P.draw_multi = function () {
    var c = this.ctx, W = this.W, H = this.H, g = this.g, self = this, s = g.vs, info = this.gameInfo(g.game);
    this.header(T(info.name) + (g.mode === 'ai' ? T(' · vs Computer ({0})', T(LEVELS[g.level - 1])) : T(' · Room {0}', g.code)), function () { self.leaveGame(); });
    var rect = this.boardRect();
    CB[g.game].draw(c, rect, g, this);
    var y = H - 112; c.fillStyle = 'rgba(0,0,0,0.3)'; c.fillRect(0, y, W, 112);
    B.text(c, this.multiStatus(), W / 2, y + 20, 16, '#eafff0', true, 'center', W - 12);
    var sub = this.multiSub(); if (sub) B.text(c, sub, W / 2, y + 44, 13, '#cfe8d5', false, 'center', W - 12);
    var mine = g.mode === 'online' ? g.players && g.players[g.seat - 1] : null, autoOn = g.mode === 'ai' ? g.auto : !!(mine && mine.auto);
    if (!s.over) this.btn(W / 2 - 60, y + 62, 120, 38, autoOn ? 'Cancel Auto-play' : 'Auto-play', function () {
      if (g.mode === 'ai') { g.auto = !g.auto; self.scheduleMulti(); } else self.net.send({ t: autoOn ? 'back' : 'resign' });
    }, { color: autoOn ? '#2e7d32' : '#546e7a', size: 16 });
    // 操作按钮
    if (g.game === 'zhajinhua') { if (!s.over && !autoOn) this.zjhButtons(rect); }
    else if (g.game === 'holdem') { if (!s.over && !autoOn) this.holdemButtons(rect); }
    else if (!s.over && s.turn === g.seat && !autoOn) this.multiButtons(rect);
    if (s.over) this.multiOverlay();
    if (g.mode === 'online' && this.netState !== 'ready') { c.fillStyle = 'rgba(0,0,0,0.6)'; c.fillRect(0, 90, W, 28); B.text(c, 'Connection lost, reconnecting…', W / 2, 104, 15, '#ffcc80'); }
  };
  P.multiButtons = function (rect) {
    var g = this.g, s = g.vs, W = this.W, self = this, bw, y, x0, list = [];
    if (g.game === 'doudizhu') {
      y = rect.y + rect.h - 66 - 10 - 62;
      if (s.phase === 'bid') {
        [0, 1, 2, 3].forEach(function (b) { list.push({ t: b === 0 ? 'No Bid' : T('{0} pts', b), dis: b !== 0 && b <= s.bid.high, color: b === 0 ? '#546e7a' : '#ef6c00', cb: function () { self.sendMulti({ bid: b }); } }); });
      } else {
        list.push({ t: 'Pass', dis: !s.last, color: '#546e7a', cb: function () { self.sendMulti({ pass: true }); } });
        list.push({ t: 'Hint', color: '#1565c0', cb: function () { self.hint(); } });
        list.push({ t: 'Play', color: '#2e7d32', cb: function () { self.playSelected(); } });
      }
    } else {
      var o = Mj.options(s, g.seat); if (!o) return;
      y = (g.handBottom || rect.y + 360) + 12;
      if (s.phase === 'claim') {
        var tile = s.claim.tile; if (o.hu) list.push({ t: 'Win', color: '#c62828', cb: function () { self.sendMulti({ a: 'hu' }); } });
        if (o.kong) list.push({ t: 'Kong', color: '#6a1b9a', cb: function () { self.sendMulti({ a: 'kong' }); } });
        if (o.pong) list.push({ t: 'Pong', color: '#1565c0', cb: function () { self.sendMulti({ a: 'pong' }); } });
        (o.chi || []).forEach(function (pr) { list.push({ t: T('Chow {0}', tn(pr[0]) + ' ' + tn(pr[1])), color: '#00838f', cb: function () { self.sendMulti({ a: 'chi', tiles: pr }); } }); });
        list.push({ t: 'Skip', color: '#546e7a', cb: function () { self.sendMulti({ a: 'pass' }); } });
      } else {
        if (o.hu) list.push({ t: 'Win (self-draw)', color: '#c62828', cb: function () { self.sendMulti({ a: 'hu' }); } });
        (o.ankong || []).forEach(function (t) { list.push({ t: T('Concealed Kong {0}', tn(t)), color: '#6a1b9a', cb: function () { self.sendMulti({ a: 'ankong', tile: t }); } }); });
        (o.addkong || []).forEach(function (t) { list.push({ t: T('Add Kong {0}', tn(t)), color: '#6a1b9a', cb: function () { self.sendMulti({ a: 'addkong', tile: t }); } }); });
        list.push({ t: 'Discard', dis: g.selTile === null || g.selTile === undefined, color: '#2e7d32', cb: function () { if (g.selTile !== null && g.selTile !== undefined) self.sendMulti({ a: 'discard', tile: g.selTile }); } });
      }
    }
    var n = list.length, gap = 8; bw = Math.min(96, (W - 16 - gap * (n - 1)) / n); x0 = (W - (n * bw + (n - 1) * gap)) / 2;
    list.forEach(function (b, i) { self.btn(x0 + i * (bw + gap), y, bw, 42, b.t, b.cb, { color: b.color, disabled: b.dis, size: 17, label: b.t }); });
  };
  P.holdemButtons = function (rect) {
    var g = this.g, s = g.vs, W = this.W, self = this, o = Hd.options(s, g.seat), botY = rect.y + rect.h;
    if (!o.turn) return;
    if (g.raiseTo === null || g.raiseTo === undefined || g.raiseTo < o.raiseMin || g.raiseTo > o.raiseMax) g.raiseTo = o.raiseMin;
    var r1 = [], r2 = [], pot = s.pot + o.call;
    function setTo(v) { g.raiseTo = Math.max(o.raiseMin, Math.min(o.raiseMax, Math.round(v))); self.dirty = true; }
    r1.push({ t: 'Fold', color: '#546e7a', cb: function () { self.sendMulti({ a: 'fold' }); } });
    if (o.check) r1.push({ t: 'Check', color: '#2e7d32', cb: function () { self.sendMulti({ a: 'check' }); } });
    else r1.push({ t: T('Call {0}', o.call), color: '#2e7d32', cb: function () { self.sendMulti({ a: 'call' }); } });
    if (o.canRaise) {
      var all = g.raiseTo >= o.raiseMax;
      r1.push({ t: all ? T('All-in {0}', o.allin) : T(s.currentBet > 0 ? 'Raise to {0}' : 'Bet {0}', g.raiseTo), color: '#ef6c00', cb: function () { self.sendMulti(all ? { a: 'allin' } : { a: 'raise', to: g.raiseTo }); } });
      r2.push({ t: '-', color: '#455a64', cb: function () { setTo(g.raiseTo - s.bb); } });
      r2.push({ t: 'Min', color: '#455a64', cb: function () { setTo(o.raiseMin); } });
      r2.push({ t: '1/2 Pot', color: '#455a64', cb: function () { setTo(s.currentBet + pot * 0.5); } });
      r2.push({ t: 'Pot', color: '#455a64', cb: function () { setTo(s.currentBet + pot); } });
      r2.push({ t: 'Max', color: '#455a64', cb: function () { setTo(o.raiseMax); } });
      r2.push({ t: '+', color: '#455a64', cb: function () { setTo(g.raiseTo + s.bb); } });
    }
    [[r1, botY - 80], [r2, botY - 40]].forEach(function (row) {
      var list = row[0], n = list.length; if (!n) return; var gap = 6, bw = Math.min(110, (W - 16 - gap * (n - 1)) / n), x0 = (W - (n * bw + (n - 1) * gap)) / 2;
      list.forEach(function (b, k) { self.btn(x0 + k * (bw + gap), row[1], bw, 36, b.t, b.cb, { color: b.color, size: n > 4 ? 13 : 15 }); });
    });
  };
  P.zjhButtons = function (rect) {
    var g = this.g, s = g.vs, W = this.W, self = this, o = Zjh.options(s, g.seat), botY = rect.y + rect.h, i;
    if (s.status[g.seat] !== 'active') return;
    var r1 = [], r2 = [];
    if (g.pick) { r1.push({ t: 'Cancel Compare', color: '#546e7a', cb: function () { g.pick = false; self.dirty = true; } }); }
    else {
      if (o.look) r1.push({ t: 'Look', color: '#1565c0', cb: function () { self.sendMulti({ a: 'look' }); } });
      if (o.turn) {
        r1.push({ t: 'Fold', color: '#546e7a', cb: function () { self.sendMulti({ a: 'fold' }); } });
        r1.push({ t: T('Call {0}', o.callCost), dis: !o.call, color: '#2e7d32', cb: function () { self.sendMulti({ a: 'call' }); } });
        r1.push({ t: 'Compare', dis: !o.compare.length, color: '#c62828', cb: function () { if (o.compare.length === 1) self.sendMulti({ a: 'compare', target: o.compare[0].target }); else { g.pick = true; self.dirty = true; } } });
        s.levels.forEach(function (u) { if (u > s.unit) { var rr = o.raise.filter(function (x) { return x.unit === u; })[0]; r2.push({ t: T('Raise to {0}', u), dis: !rr, color: '#ef6c00', cb: function () { self.sendMulti({ a: 'raise', unit: u }); } }); } });
      }
    }
    [[r1, botY - 80], [r2, botY - 40]].forEach(function (row) {
      var list = row[0], n = list.length; if (!n) return; var gap = 6, bw = Math.min(100, (W - 16 - gap * (n - 1)) / n), x0 = (W - (n * bw + (n - 1) * gap)) / 2;
      list.forEach(function (b, k) { self.btn(x0 + k * (bw + gap), row[1], bw, 36, b.t, b.cb, { color: b.color, disabled: b.dis, size: 15 }); });
    });
  };
  P.playSelected = function () {
    var g = this.g, ids = CB.doudizhu.selected(g); if (!ids.length) { this.say('Select the cards to play first'); return; }
    var cl = Ddz.classify(ids); if (!cl) { this.say('That is not a valid combination'); return; }
    if (g.vs.last && !Ddz.beats(cl, g.vs.last.cl)) { this.say('That does not beat the last play'); return; }
    this.sendMulti({ cards: ids });
  };
  P.hint = function () {
    var g = this.g, self = this; if (g.hinting) return; g.hinting = true;
    AIC.request('doudizhu', g.vs, g.seat, 2, { timeMs: 100 }, function (mv) {
      g.hinting = false; g.sel = {};
      if (mv && mv.cards) mv.cards.forEach(function (id) { g.sel[id] = true; }); else self.say('No card beats the last play - choose Pass');
      self.dirty = true;
    });
  };
  P.multiStatus = function () {
    var g = this.g, s = g.vs, me = g.seat, nm = function (p) { return (g.names && g.names[p]) || T('Player {0}', p); };
    if (s.over && g.game === 'holdem') { var hw = s.winners.indexOf(me) >= 0; return hw ? T('You won +{0} chips', Math.max(0, s.scores[me])) : s.scores[me] < 0 ? T('You lost {0} chips', -s.scores[me]) : 'Hand over'; }
    if (s.over) { var won = s.winners && s.winners.indexOf(me) >= 0; return !(s.winners && s.winners.length) ? (s.reason || 'Game over') : (won ? 'You won!' : 'You lost'); }
    if (g.game === 'holdem') {
      if (s.status[me] === 'folded') return 'You folded - waiting for the hand to finish…';
      if (s.status[me] === 'allin') return 'You are all-in - waiting for the showdown…';
      return s.turn === me ? 'Your turn: fold / check / call / raise' : nm(s.turn) + ' is thinking…';
    }
    if (g.game === 'zhajinhua') {
      if (g.pick) return 'Tap the player to compare with (green frame)';
      if (s.status[me] !== 'active') return 'You are out - waiting for the hand to finish…';
      return s.turn === me ? 'Your turn: look / call / raise / compare / fold' : T('{0} is thinking…', nm(s.turn));
    }
    if (g.game === 'doudizhu') {
      if (s.phase === 'bid') return s.turn === me ? 'Your turn to bid' : T('{0} is bidding…', nm(s.turn));
      return s.turn === me ? (s.last ? 'Your turn: beat the last play or pass' : 'Your turn to lead (play anything)') : T('{0} is playing…', nm(s.turn));
    }
    if (s.phase === 'claim') return s.turn === me ? T('A "{0}" was discarded - chow, pong, kong or win?', tn(s.claim.tile)) : T('Waiting for {0}…', nm(s.turn));
    return s.turn === me ? 'Your turn (tap a tile to select, tap again or press Discard)' : T('{0} is thinking…', nm(s.turn));
  };
  P.multiSub = function () {
    var g = this.g, s = g.vs;
    if (g.mode === 'online' && g.players) { var off = g.players.filter(function (p, i) { return p && !p.online && !p.bot; }); if (off.length) return 'A player disconnected - waiting up to 60 s (the computer plays meanwhile)'; }
    if (g.game === 'doudizhu' && s.landlord) return T('Landlord: {0} · Multiplier ×{1} · Bombs {2}', T((g.names && g.names[s.landlord]) || s.landlord), s.bid.high * s.mult, s.bombs);
    if (g.game === 'mahjong') return T('Dealer: {0} · Wall: {1} tiles', T((g.names && g.names[s.dealer]) || s.dealer), Math.max(0, s.wallCount - 14));
    return '';
  };
  function wrap(ctx, str, maxW, size) { ctx.font = size + 'px sans-serif'; var out = [], cur = ''; for (var i = 0; i < str.length; i++) { var t = cur + str[i]; if (ctx.measureText && ctx.measureText(t).width > maxW && cur) { out.push(cur); cur = str[i]; } else cur = t; } if (cur) out.push(cur); return out; }
  P.multiOverlay = function () {
    var c = this.ctx, W = this.W, H = this.H, g = this.g, self = this, s = g.vs, info = this.gameInfo(g.game);
    var w = Math.min(W - 24, 350), h = 330 + Math.max(0, (s.n || 0) - 4) * 24, x = (W - w) / 2, y = Math.max(96, (H - h) / 2 - 30);
    B.rrect(c, x, y, w, h, 16); c.fillStyle = 'rgba(10,25,18,0.95)'; c.fill(); c.strokeStyle = '#ffeb99'; c.lineWidth = 2; c.stroke();
    var won = s.winners && s.winners.indexOf(g.seat) >= 0, none = !(s.winners && s.winners.length);
    B.text(c, none ? 'Game over' : won ? 'Victory!' : 'Defeat', x + w / 2, y + 30, 28, none ? '#cfd8dc' : won ? '#ffd54f' : '#b0bec5', true);
    var lines = wrap(c, s.reason || '', w - 28, 13); lines.slice(0, 3).forEach(function (l, i) { B.text(c, l, x + w / 2, y + 62 + i * 18, 13, '#cfe8d5', false); });
    var ty = y + 124; for (var p = 1; p <= (s.n || info.seats); p++) { var d = (s.scores[p] || 0) * info.unit; B.text(c, T((g.names && g.names[p]) || T('Player {0}', p)) + (g.game === 'doudizhu' && s.landlord === p ? ' [' + T('Landlord') + ']' : '') + (g.game === 'zhajinhua' && s.handNames && s.handNames[p] ? ' [' + T(s.handNames[p]) + ']' : '') + (g.game === 'holdem' && s.hnames && s.hnames[p] ? ' [' + T(s.hnames[p]) + ']' : ''), x + 20, ty, 14, '#fff', false, 'left'); B.text(c, (d > 0 ? '+' : '') + d + (info.holdem ? T(' chips') : T(' beans')), x + w - 20, ty, 14, d > 0 ? '#ffd54f' : d < 0 ? '#ef9a9a' : '#cfd8dc', true, 'right'); ty += 24; }
    if (g.game === 'holdem') B.text(c, T('Your chips (virtual): {0}', s.stacks[g.seat]), x + w / 2, ty + 8, 14, '#ffeb99', true);
    else B.text(c, T('Happy Beans (virtual): {0}', this.beans) + (g.relief ? T(' (topped up to 1000)') : ''), x + w / 2, ty + 8, 14, '#ffeb99', true);
    var by = y + h - 64;
    if (g.mode === 'ai') this.btn(x + 16, by, w / 2 - 22, 48, g.game === 'holdem' ? 'Next Hand' : 'Play Again', function () { self.startLocalMulti(g.game, g.level, g.n); }, { color: '#2e7d32' });
    else if (g.host === g.seat) this.btn(x + 16, by, w / 2 - 22, 48, g.game === 'holdem' ? 'Next Hand' : 'Play Again', function () { self.net.send({ t: 'again' }); }, { color: '#2e7d32' });
    else B.text(c, 'Waiting for the host to start another hand', x + w / 4 + 8, by + 24, 13, '#cfe8d5');
    this.btn(x + w / 2 + 6, by, w / 2 - 22, 48, 'Back to Lobby', function () { self.leaveGame(); }, { color: '#455a64' });
  };

  var API = { App: App };
  if (typeof module !== 'undefined' && module.exports) module.exports = API; else (self.GH = self.GH || {}).AppMod = API;
})();
