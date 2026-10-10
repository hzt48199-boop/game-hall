/* 游戏大厅主程序(Canvas 2D,无框架)。网页与微信小游戏共用,平台差异通过 platform 对象注入:
   platform = { canvas, ctx, getSize():{w,h}, storage:{get,set}, raf(fn), serverUrl() } */
(function () {
  var req = typeof require === 'function';
  var E = req ? require('./engines.js') : GH.Engines;
  var AI = req ? require('./ai.js') : GH.AI;
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
    { id: 'holdem', name: "Texas Hold'em", desc: 'Blinds, betting rounds, side pots - virtual chips', color: '#1b5e3a', icon: 'A\u2660K\u2665', multi: true, seats: 6, unit: 1, holdem: true, cap: true, isNew: true },
    { id: 'chess', name: 'International Chess', desc: 'Castling, en passant, checkmate', color: '#3e2f6b', icon: '\u265e\u265a', isNew: true },
    { id: 'gomoku', name: 'Gomoku', desc: 'Black vs white - first to five in a row wins', color: '#37474f', icon: '\u25cf\u25cb' },
    { id: 'xiangqi', name: 'Chinese Chess', desc: 'Xiangqi - the generals face off', color: '#8d3b2a', icon: 'XQ' },
    { id: 'luzhanqi', name: 'Luzhanqi', desc: 'Army Chess - hidden pieces, capture the flag', color: '#2e5d34', icon: '\u2691' },
    { id: 'doudizhu', name: 'Dou Dizhu', desc: '3 players - bid to be the landlord, bombs and rockets', color: '#7b3f00', icon: '\u2660\u2665', multi: true, seats: 3, unit: 100 },
    { id: 'mahjong', name: 'Mahjong', desc: '4 players - chow, pong, kong, win', color: '#1a5c5c', icon: 'MJ', multi: true, seats: 4, unit: 10 },
    { id: 'zhajinhua', name: 'Zha Jin Hua', desc: 'Three-card poker - look, call, raise, compare', color: '#6a1b4d', icon: '3\u2666', multi: true, seats: 6, unit: 1, zjh: true, cap: true }
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
    this.joinCode = ''; this.diff = { level: 2, seat: 1, n: 5 }; this.g = null; this.matchStart = 0; this.netState = 'closed';
    Sound.init(pf.storage);
    this.beans = parseInt(pf.storage.get('gh_beans'), 10); if (!(this.beans >= 0)) this.beans = 2000;
    this.net = Net.create({ url: pf.serverUrl, storage: pf.storage });
    this.net.onMessage = function (m) { self.onNet(m); };
    this.net.onStatus = function (s) { self.netState = s; self.dirty = true; };
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
  P.applyLang = function () { if (typeof document !== 'undefined') { document.title = T('cbox') + ' - ' + T(TAGLINE); document.documentElement.lang = I18n.lang === 'zh' ? 'zh-CN' : 'en'; } };
  P.toggleLang = function () { I18n.setLang(I18n.lang === 'zh' ? 'en' : 'zh'); this.applyLang(); this.dirty = true; };
  P.say = function (text) { text = T(text); this.toast = { text: text, until: Date.now() + 2600 }; this.dirty = true; };
  P.tap = function (x, y) {
    Sound.unlock();
    for (var i = this.hits.length - 1; i >= 0; i--) {
      var h = this.hits[i];
      if (x >= h.x && x <= h.x + h.w && y >= h.y && y <= h.y + h.h) { if (h.click !== false) Sound.sfx('click'); h.cb(); this.dirty = true; return; }
    }
    if (this.scene === 'game' && !(this.cur && this.cur.multi)) this.boardTap(x, y);
  };

  /* ---------- 绘图小工具 ---------- */
  P.btn = function (x, y, w, h, label, cb, o) {
    o = o || {}; var c = this.ctx; label = T(label);
    B.rrect(c, x, y, w, h, Math.min(14, h / 3)); c.fillStyle = o.disabled ? '#78909c' : (o.color || '#ff8f00'); c.fill();
    if (o.stroke) { c.strokeStyle = o.stroke; c.lineWidth = 2; c.stroke(); }
    B.text(c, label, x + w / 2, y + h / 2 + 1, o.size || Math.min(22, h * 0.42), o.fg || '#fff', true);
    if (!o.disabled) this.hits.push({ x: x, y: y, w: w, h: h, cb: cb, click: o.click, label: label });
  };
  P.brandLine = function (y, withName) { // cbox brand + tagline (shown in the lobby and on every game screen)
    var c = this.ctx, W = this.W, str = (withName ? T('cbox') + ' · ' : '') + T(TAGLINE);
    B.text(c, str, W / 2, y, 10, '#ffd98a', false, 'center', W - 156);
  };
  P.header = function (title, back) {
    var c = this.ctx, W = this.W, lobby = this.scene === 'lobby';
    c.fillStyle = '#16372a'; c.fillRect(0, 0, W, 48);
    if (lobby) { B.text(c, 'cbox', W / 2, 18, 24, '#ffeb99', true); this.brandLine(37, false); }
    else { this.brandLine(11, true); B.text(c, title, W / 2, 31, 18, '#ffeb99', true, 'center', W - 156); }
    if (back) this.btn(8, 8, 64, 32, 'Back', back, { color: '#455a64', size: 15 });
    if (lobby) this.btn(W - 76, 8, 68, 32, I18n.lang === 'zh' ? 'English' : '中文', function () { this.toggleLang(); }.bind(this), { color: '#1565c0', size: 15, stroke: '#fff', label: I18n.lang === 'zh' ? 'English' : '中文' });
    // sound / music toggles (visible on every screen)
    var tw = Math.min(150, (W - 16) / 2 - 4), y = 52;
    c.fillStyle = 'rgba(0,0,0,0.25)'; c.fillRect(0, 48, W, 40);
    this.btn(W - 2 * tw - 12, y, tw, 32, (Sound.sfxOn ? 'Sound: On' : 'Sound: Off'), function () { Sound.toggleSfx(); }, { color: Sound.sfxOn ? '#2e9d4f' : '#757575', size: 16, click: false, stroke: '#fff' });
    this.btn(W - tw - 6, y, tw, 32, (Sound.musicOn ? 'Music: On' : 'Music: Off'), function () { Sound.toggleMusic(); }, { color: Sound.musicOn ? '#2e9d4f' : '#757575', size: 16, click: false, stroke: '#fff' });
  };
  P.frame = function () {
    var sz = this.pf.getSize(); if (sz.w !== this.W || sz.h !== this.H) { this.W = sz.w; this.H = sz.h; this.dirty = true; }
    this.updateWait();
    if (this.scene === 'matching' && Date.now() - this.matchStart > MATCH_WAIT_MS) this.matchTimeout();
    if (this.toast && Date.now() > this.toast.until) { this.toast = null; this.dirty = true; }
    if (!this.dirty) return; this.dirty = false;
    var c = this.ctx; this.hits = [];
    c.fillStyle = '#1f4d3a'; c.fillRect(0, 0, this.W, this.H);
    var fn = this['draw_' + this.scene]; if (fn) fn.call(this);
    if (this.toast) { var w = Math.min(this.W - 40, 360); B.rrect(c, (this.W - w) / 2, this.H - 120, w, 44, 10); c.fillStyle = 'rgba(0,0,0,0.8)'; c.fill(); B.text(c, this.toast.text, this.W / 2, this.H - 98, 16, '#fff', false); }
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
  P.draw_lobby = function () {
    var c = this.ctx, W = this.W; this.header('cbox', null);
    B.text(c, 'For entertainment only - virtual chips, no cash value, not redeemable', W / 2, 102, 11, '#cfe8d5', false, 'center', W - 16);
    B.text(c, T('Happy Beans (virtual points): {0}', this.beans), W / 2, 120, 13, '#ffeb99', true);
    var cw = Math.min(W - 32, 420), x = (W - cw) / 2, y = 134, n = GAMES.length, gap = 8, h = Math.max(44, Math.min(92, (this.H - 144) / n - gap));
    var self = this, big = h > 66;
    GAMES.forEach(function (g) {
      B.rrect(c, x, y, cw, h, 14); c.fillStyle = g.color; c.fill(); c.strokeStyle = g.isNew ? '#ffd54f' : 'rgba(255,255,255,0.35)'; c.lineWidth = g.isNew ? 3 : 2; c.stroke();
      B.text(c, g.icon, x + 42, y + h / 2, big ? 28 : 21, '#ffeb99', true, 'center', 70);
      B.text(c, g.name, x + 86, y + h / 2 - (big ? 13 : 9), big ? 22 : 18, '#fff', true, 'left', cw - 150);
      B.text(c, g.desc, x + 86, y + h / 2 + (big ? 15 : 12), big ? 12 : 11, '#d7e7dc', false, 'left', cw - 96);
      if (g.isNew) { B.rrect(c, x + cw - 56, y + 6, 46, 18, 9); c.fillStyle = '#ffd54f'; c.fill(); B.text(c, 'NEW', x + cw - 33, y + 15, 11, '#5d3a00', true); }
      self.hits.push({ x: x, y: y, w: cw, h: h, label: T(g.name), cb: function () { self.cur = g; self.setScene('mode'); } });
      y += h + gap;
    });
  };
  P.draw_mode = function () {
    var c = this.ctx, W = this.W, g = this.cur, self = this; this.header(g.name, function () { self.setScene('lobby'); });
    var bw = Math.min(W - 40, 340), x = (W - bw) / 2, y = 120, bh = 56;
    [['Play vs Computer', '#2e7d32', function () { self.setScene('diff'); }],
    ['Create Friend Room', '#1565c0', function () { self.createRoom(); }],
    ['Join Room', '#6a1b9a', function () { self.joinCode = ''; self.setScene('join'); }],
    ['Quick Match', '#ef6c00', function () { self.quickMatch(); }]].forEach(function (b) { self.btn(x, y, bw, bh, b[0], b[2], { color: b[1], size: 22 }); y += bh + 14; });
    B.text(c, g.multi ? 'Friend rooms: empty seats are filled by the computer; Quick Match falls back to the computer after 8 s' : 'If no human opponent is found within 8 s, Quick Match starts a game against the computer', W / 2, y + 8, 12, '#9cc3a8');
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
      B.text(c, g.holdem ? 'Blinds 10/20, 1000 chips each. For entertainment only, virtual chips, no cash value, not redeemable' : 'Each hand: 1000 beans buy-in, ante 10. For entertainment only, virtual chips, no cash value, not redeemable', W / 2, y + 62, 11, '#ffcc80', false, 'center', W - 16);
      this.btn(x, y + 86, bw, 56, 'Start Game', function () { self.startLocalMulti(g.id, self.diff.level, self.diff.n); }, { color: '#2e7d32', size: 22 }); return;
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
    if (m.t === 'err') { this.say(m.msg || 'Action failed'); return; }
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
    var line = this.statusText(); B.text(c, line, W / 2, y + 20, 17, '#ffeb99', true, 'center', W - 12);
    var sub = this.subText(); if (sub) B.text(c, sub, W / 2, y + 44, 13, '#cfe8d5', false, 'center', W - 12);
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
    B.text(c, this.multiStatus(), W / 2, y + 20, 16, '#ffeb99', true, 'center', W - 12);
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
    if (g.game === 'zhajinhua') return 'For entertainment only, virtual chips, no cash value, not redeemable';
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
