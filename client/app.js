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
  var Luz = E.luzhanqi, Mj = E.mahjong, Ddz = E.doudizhu, Zjh = E.zhajinhua;
  var GAMES = [
    { id: 'gomoku', name: '五子棋', desc: '黑白对弈,先连五子者胜', color: '#37474f', icon: '●○' },
    { id: 'xiangqi', name: '中国象棋', desc: '楚河汉界,将帅对决', color: '#8d3b2a', icon: '帅将' },
    { id: 'luzhanqi', name: '军棋', desc: '暗棋对战,夺取军旗', color: '#2e5d34', icon: '旗' },
    { id: 'doudizhu', name: '斗地主', desc: '三人对战,叫地主、炸弹火箭', color: '#7b3f00', icon: '♠♥', multi: true, seats: 3, unit: 100 },
    { id: 'mahjong', name: '麻将', desc: '四人对战,吃碰杠胡', color: '#1a5c5c', icon: '麻', multi: true, seats: 4, unit: 10 },
    { id: 'zhajinhua', name: '炸金花', desc: '三张牌比大小,看牌 跟注 加注 比牌', color: '#6a1b4d', icon: '金花', multi: true, seats: 6, unit: 1, zjh: true }
  ];
  var HARD_MS = { gomoku: 1500, xiangqi: 2000, luzhanqi: 1000, doudizhu: 400, mahjong: 300, zhajinhua: 200 };
  var BOT_NAMES = ['', '电脑·阿福', '电脑·小宝', '电脑·老王', '电脑·大壮', '电脑·小花', '电脑·阿呆'];
  var SOUND_OF = { deal: 'deal', redeal: 'deal', bid: 'bid', landlord: 'start', play: 'cardplay', bomb: 'bomb', rocket: 'rocket', pass: 'pass',
    draw: 'tiledraw', discard: 'tilediscard', pong: 'pong', kong: 'kong', chi: 'chi', hu: 'hu', zimo: 'hu', drawgame: 'end', call: 'chips', raise: 'chips', look: 'look', fold: 'fold', compare: 'compare', showdown: 'compare' };
  var LEVELS = ['简单', '普通', '困难'];
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
    this.setScene('lobby');
    var loop = function () { self.frame(); pf.raf(loop); };
    pf.raf(loop);
    setInterval(function () { self.dirty = true; }, 250);
  }
  var P = App.prototype;

  P.gameInfo = function (id) { return GAMES.filter(function (g) { return g.id === id; })[0]; };
  P.setScene = function (scene) {
    this.scene = scene; this.dirty = true;
    var track = (this.g && scene === 'game') ? ({ gomoku: 'calm', doudizhu: 'lively', zhajinhua: 'lively', mahjong: 'lively' }[this.g.game] || 'chinese') : 'calm';
    Sound.setMusic(track);
    if (scene === 'matching' || scene === 'waiting' || (scene === 'join')) this.net.start();
  };
  P.say = function (text) { this.toast = { text: text, until: Date.now() + 2600 }; this.dirty = true; };
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
    o = o || {}; var c = this.ctx;
    B.rrect(c, x, y, w, h, Math.min(14, h / 3)); c.fillStyle = o.disabled ? '#78909c' : (o.color || '#ff8f00'); c.fill();
    if (o.stroke) { c.strokeStyle = o.stroke; c.lineWidth = 2; c.stroke(); }
    B.text(c, label, x + w / 2, y + h / 2 + 1, o.size || Math.min(22, h * 0.42), o.fg || '#fff', true);
    if (!o.disabled) this.hits.push({ x: x, y: y, w: w, h: h, cb: cb, click: o.click, label: label });
  };
  P.header = function (title, back) {
    var c = this.ctx, W = this.W;
    c.fillStyle = '#16372a'; c.fillRect(0, 0, W, 48);
    B.text(c, title, W / 2, 25, 20, '#ffeb99', true);
    if (back) this.btn(8, 8, 64, 32, '返回', back, { color: '#455a64', size: 15 });
    var st = this.netState === 'ready' ? '' : '';
    // 音效/音乐开关(所有界面可见)
    var tw = Math.min(150, (W - 16) / 2 - 4), y = 52;
    c.fillStyle = 'rgba(0,0,0,0.25)'; c.fillRect(0, 48, W, 40);
    this.btn(W - 2 * tw - 12, y, tw, 32, '音效:' + (Sound.sfxOn ? '开' : '关'), function () { Sound.toggleSfx(); }, { color: Sound.sfxOn ? '#2e9d4f' : '#757575', size: 16, click: false, stroke: '#fff' });
    this.btn(W - tw - 6, y, tw, 32, '背景音乐:' + (Sound.musicOn ? '开' : '关'), function () { Sound.toggleMusic(); }, { color: Sound.musicOn ? '#2e9d4f' : '#757575', size: 16, click: false, stroke: '#fff' });
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
    if (this.scene !== 'game' || !g || !g.vs || g.vs.over || !g.seat || !(g.game === 'doudizhu' || g.game === 'mahjong' || g.game === 'zhajinhua') || g.vs.turn !== g.seat) { this._urgeKey = null; return; }
    var key = g.vs.turn + ':' + (g.vs.seq || 0);
    if (this._urgeKey !== key) { this._urgeKey = key; this._urgeAt = now + 10000; return; }
    if (now >= this._urgeAt) { this._urgeAt = now + 6000; Sound.sfx('urge'); }
  };

  /* ---------- 大厅 / 模式 ---------- */
  P.draw_lobby = function () {
    var c = this.ctx, W = this.W; this.header('游戏大厅', null);
    B.text(c, '休闲棋牌 · 仅供娱乐,虚拟积分,不可兑换', W / 2, 104, 14, '#cfe8d5');
    B.text(c, '欢乐豆(虚拟积分):' + this.beans, W / 2, 124, 14, '#ffeb99', true);
    var cw = Math.min(W - 32, 420), x = (W - cw) / 2, y = 142, n = GAMES.length, h = Math.max(54, Math.min(100, (this.H - 160) / n - 10));
    var self = this;
    GAMES.forEach(function (g) {
      B.rrect(c, x, y, cw, h, 14); c.fillStyle = g.color; c.fill(); c.strokeStyle = 'rgba(255,255,255,0.35)'; c.lineWidth = 2; c.stroke();
      B.text(c, g.icon, x + 50, y + h / 2, h > 70 ? 30 : 24, '#ffeb99', true);
      B.text(c, g.name, x + 100, y + h / 2 - (h > 70 ? 14 : 10), h > 70 ? 24 : 20, '#fff', true, 'left');
      B.text(c, g.desc, x + 100, y + h / 2 + (h > 70 ? 16 : 14), 13, '#d7e7dc', false, 'left');
      self.hits.push({ x: x, y: y, w: cw, h: h, label: g.name, cb: function () { self.cur = g; self.setScene('mode'); } });
      y += h + 10;
    });
  };
  P.draw_mode = function () {
    var c = this.ctx, W = this.W, g = this.cur, self = this; this.header(g.name, function () { self.setScene('lobby'); });
    var bw = Math.min(W - 40, 340), x = (W - bw) / 2, y = 120, bh = 56;
    [['人机对战', '#2e7d32', function () { self.setScene('diff'); }],
    ['创建好友房', '#1565c0', function () { self.createRoom(); }],
    ['加入房间', '#6a1b9a', function () { self.joinCode = ''; self.setScene('join'); }],
    ['快速匹配', '#ef6c00', function () { self.quickMatch(); }]].forEach(function (b) { self.btn(x, y, bw, bh, b[0], b[2], { color: b[1], size: 22 }); y += bh + 14; });
    B.text(c, g.multi ? '好友房:空位由电脑补上;快速匹配 8 秒无人则自动人机对战' : '快速匹配 8 秒内无真人对手,将自动开始人机对战', W / 2, y + 8, 12, '#9cc3a8');
  };
  P.draw_diff = function () {
    var c = this.ctx, W = this.W, self = this, g = this.cur; this.header(g.name + ' · 人机对战', function () { self.setScene('mode'); });
    var bw = Math.min(W - 40, 340), x = (W - bw) / 2, y = 130;
    B.text(c, '选择难度', W / 2, y - 14, 16, '#cfe8d5');
    LEVELS.forEach(function (n, i) {
      var on = self.diff.level === i + 1;
      self.btn(x + i * (bw / 3), y, bw / 3 - 8, 46, n, function () { self.diff.level = i + 1; }, { color: on ? '#ff8f00' : '#546e7a', stroke: on ? '#fff' : null });
    });
    if (g.zjh) {
      y += 90; B.text(c, '牌桌人数(你 + 电脑)', W / 2, y - 14, 16, '#cfe8d5');
      [2, 3, 4, 5, 6].forEach(function (k, i) { var on = self.diff.n === k; self.btn(x + i * (bw / 5), y, bw / 5 - 6, 40, k + ' 人', function () { self.diff.n = k; }, { color: on ? '#ff8f00' : '#546e7a', stroke: on ? '#fff' : null, size: 16 }); });
      B.text(c, '每局带入 1000 欢乐豆,底注 10;仅供娱乐,虚拟积分,不可兑换', W / 2, y + 62, 12, '#ffcc80');
      this.btn(x, y + 86, bw, 56, '开始对战', function () { self.startLocalMulti(g.id, self.diff.level, self.diff.n); }, { color: '#2e7d32', size: 22 }); return;
    }
    if (g.multi) { B.text(c, g.id === 'doudizhu' ? '你与两位电脑对战(叫分决定地主)' : '你与三位电脑对战', W / 2, y + 74, 14, '#9cc3a8'); this.btn(x, y + 100, bw, 56, '开始对战', function () { self.startLocal(g.id, self.diff.level, 1); }, { color: '#2e7d32', size: 22 }); return; }
    y += 90; B.text(c, '我执', W / 2, y - 14, 16, '#cfe8d5');
    var names = g.id === 'gomoku' ? ['黑棋(先手)', '白棋(后手)'] : g.id === 'xiangqi' ? ['红方(先手)', '黑方(后手)'] : ['红方(先手)', '蓝方(后手)'];
    names.forEach(function (n, i) {
      var on = self.diff.seat === i + 1;
      self.btn(x + i * (bw / 2), y, bw / 2 - 8, 46, n, function () { self.diff.seat = i + 1; }, { color: on ? '#ff8f00' : '#546e7a', stroke: on ? '#fff' : null });
    });
    this.btn(x, y + 90, bw, 56, '开始对战', function () { self.startLocal(g.id, self.diff.level, self.diff.seat); }, { color: '#2e7d32', size: 22 });
  };
  P.draw_join = function () {
    var c = this.ctx, W = this.W, self = this; this.header('加入房间', function () { self.setScene('mode'); });
    B.text(c, '输入好友分享的 6 位房间号', W / 2, 118, 17, '#cfe8d5');
    var bw = Math.min(W - 40, 300), x = (W - bw) / 2;
    for (var i = 0; i < 6; i++) { var bx = x + i * (bw / 6); B.rrect(c, bx + 3, 134, bw / 6 - 6, 50, 8); c.fillStyle = '#0e2a1f'; c.fill(); B.text(c, this.joinCode[i] || '', bx + bw / 12, 160, 28, '#ffeb99', true); }
    var ky = 205, kh = Math.min(56, (this.H - 280) / 4 - 8), kw = bw / 3 - 8, keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '清空', '0', '退格'];
    keys.forEach(function (k, i) {
      var kx = x + (i % 3) * (bw / 3) + 4, yy = ky + Math.floor(i / 3) * (kh + 8);
      self.btn(kx, yy, kw, kh, k, function () {
        if (k === '清空') self.joinCode = ''; else if (k === '退格') self.joinCode = self.joinCode.slice(0, -1);
        else if (self.joinCode.length < 6) self.joinCode += k;
        if (self.joinCode.length === 6) self.joinRoom(self.joinCode);
      }, { color: '#37674f', size: 22 });
    });
    if (this.netState !== 'ready') B.text(c, '正在连接服务器…', W / 2, ky + 4 * (kh + 8) + 12, 14, '#ffcc80');
  };
  P.draw_waiting = function () {
    var c = this.ctx, W = this.W, self = this, g = this.cur; this.header('好友房', function () { self.net.send({ t: 'leave' }); self.setScene('mode'); });
    B.text(c, '房间号', W / 2, 130, 18, '#cfe8d5'); B.text(c, this.roomCode || '------', W / 2, 190, 56, '#ffeb99', true);
    var dots = new Array(1 + Math.floor(Date.now() / 500) % 3 + 1).join('.');
    if (g && g.multi) {
      B.text(c, '把房间号发给好友;房主点「开始游戏」,空位由电脑补上' + dots, W / 2, 240, 13, '#fff');
      var pl = this.roomPlayers || [], y = 262;
      var rn = this.roomN || g.seats;
      if (g.zjh && this.roomHost === this.roomSeat) { B.text(c, '桌位人数', 50, y + 6, 13, '#cfe8d5', false, 'left'); [2, 3, 4, 5, 6].forEach(function (k, j) { self.btn(100 + j * 48, y - 10, 42, 32, String(k), function () { self.net.send({ t: 'setcap', n: k }); }, { color: rn === k ? '#ff8f00' : '#546e7a', size: 15, stroke: rn === k ? '#fff' : null, label: '桌位' + k }); }); y += 36; }
      for (var i = 0; i < rn; i++) { var p = pl[i]; B.rrect(c, 30, y, W - 60, 34, 8); c.fillStyle = 'rgba(0,0,0,0.3)'; c.fill(); B.text(c, (i + 1) + '号位  ' + (p ? p.name + (this.roomSeat === i + 1 ? '(你)' : '') + (this.roomHost === i + 1 ? ' · 房主' : '') : '空位(将由电脑补上)'), 44, y + 18, 15, p ? '#fff' : '#9cc3a8', false, 'left'); y += 40; }
      if (this.netState !== 'ready') B.text(c, '正在连接服务器…(需要联机服务器在线)', W / 2, y + 8, 14, '#ffcc80');
      if (this.roomHost === this.roomSeat) this.btn(W / 2 - 100, y + 24, 200, 50, '开始游戏', function () { self.net.send({ t: 'start' }); }, { color: '#2e7d32', size: 20 });
      else B.text(c, '等待房主开始…', W / 2, y + 48, 15, '#cfe8d5');
      this.btn(W / 2 - 80, y + 90, 160, 44, '取消', function () { self.net.send({ t: 'leave' }); self.setScene('mode'); }, { color: '#c62828' });
      return;
    }
    B.text(c, '把房间号发给好友,等待对方加入' + dots, W / 2, 262, 16, '#fff');
    if (this.netState !== 'ready') B.text(c, '正在连接服务器…(需要联机服务器在线)', W / 2, 296, 14, '#ffcc80');
    this.btn(W / 2 - 80, 330, 160, 48, '取消', function () { self.net.send({ t: 'leave' }); self.setScene('mode'); }, { color: '#c62828' });
  };
  P.draw_matching = function () {
    var c = this.ctx, W = this.W, self = this; this.header('快速匹配', function () { self.cancelMatch(); self.setScene('mode'); });
    var left = Math.max(0, Math.ceil((MATCH_WAIT_MS - (Date.now() - this.matchStart)) / 1000));
    B.text(c, '正在寻找对手…', W / 2, 160, 24, '#fff', true);
    B.text(c, left + ' 秒后未找到真人,将自动开始人机对战', W / 2, 205, 15, '#ffcc80');
    var a = Date.now() / 300; c.strokeStyle = '#ffeb99'; c.lineWidth = 6; c.beginPath(); c.arc(W / 2, 290, 30, a, a + 4); c.stroke();
    this.btn(W / 2 - 80, 360, 160, 48, '取消', function () { self.cancelMatch(); self.setScene('mode'); }, { color: '#c62828' });
  };

  /* ---------- 联机流程 ---------- */
  P.createRoom = function () { var self = this; this.roomCode = ''; this.pendingGame = this.cur.id; this.net.start(); this.setScene('waiting'); this.sendWhenReady({ t: 'create', game: this.cur.id }); };
  P.joinRoom = function (code) { this.pendingGame = this.cur.id; this.sendWhenReady({ t: 'join', code: code }); };
  P.quickMatch = function () { this.matchStart = Date.now(); this.pendingGame = this.cur.id; this.net.start(); this.setScene('matching'); this.sendWhenReady({ t: 'match', game: this.cur.id }); };
  P.cancelMatch = function () { this.net.send({ t: 'cancelMatch' }); };
  P.matchTimeout = function () {
    if (this.scene !== 'matching') return;
    this.net.send({ t: 'cancelMatch' }); this.say('未找到真人对手,已为你安排人机对战');
    this.startLocal(this.cur.id, 2, this.cur.multi ? 1 : 1 + Math.floor(Math.random() * 2));
  };
  P.sendWhenReady = function (msg) {
    var self = this, tries = 0;
    (function go() {
      if (self.net.send(msg)) return;
      if (++tries > 40 || !self.net.wanted) { if (self.scene === 'waiting' || self.scene === 'join') self.say('无法连接联机服务器'); return; }
      setTimeout(go, 250);
    })();
  };
  P.onNet = function (m) {
    this.dirty = true;
    if (m.t === 'err') { this.say(m.msg || '操作失败'); return; }
    if (m.t !== 'room') return;
    var g = this.g;
    if (g && g.mode === 'online' && g.code === m.code) { this.applyRoom(m); return; }
    if (this.scene === 'waiting' || this.scene === 'join' || this.scene === 'matching') {
      if (m.status === 'waiting' && (m.nSeats > 2 || m.game === 'zhajinhua')) { this.roomN = m.nSeats; this.roomCode = m.code; this.roomPlayers = m.players; this.roomSeat = m.seat; this.roomHost = m.host; return; }
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
    if (this.cur && this.cur.multi) { g.host = m.host; g.seat = m.seat; g.state = m.state; g.names = {}; m.players.forEach(function (p, i) { g.names[i + 1] = p ? (p.name + (i + 1 === m.seat ? '(你)' : '') + (p.auto ? '·托管' : '')) : ''; }); this.afterMulti(g, first); return; }
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
  P.afterChange = function (prev, now) { // 根据状态变化播放落子/吃子音效
    if (!prev) return; var p = prev.pieces !== undefined ? prev : snap(prev), n = snap(now);
    if (now.game === 'gomoku') { if (n.moves > p.moves) Sound.sfx('place'); }
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
    if (g.state.turn !== g.seat || (g.state.phase && g.state.phase !== 'playing')) { if (g.mode === 'online' || g.aiPending) this.say('还没轮到你'); return; }
    if (g.game === 'gomoku') return this.tryMove({ x: cell.x, y: cell.y });
    var piece = g.state.board[cell.r][cell.c], own = piece && (g.game === 'xiangqi' ? E.xiangqi.sideOf(piece) === g.seat : piece.p === g.seat);
    if (own) { g.sel = { r: cell.r, c: cell.c }; g.legal = E[g.game].legalMovesFrom(g.state, g.seat, cell.r, cell.c); if (!g.legal.length) this.say('这个棋子现在不能移动'); return; }
    if (g.sel) { var mv = g.legal.filter(function (m) { return m.tr === cell.r && m.tc === cell.c; })[0]; if (mv) return this.tryMove({ fr: mv.fr, fc: mv.fc, tr: mv.tr, tc: mv.tc }); g.sel = null; g.legal = []; }
  };
  P.tryMove = function (mv) {
    var g = this.g;
    if (g.mode === 'online') { if (!this.net.send({ t: 'move', move: mv })) this.say('网络未连接,请稍候'); g.sel = null; g.legal = []; return; }
    var prev = snap(g.state), r = E[g.game].move(g.state, g.seat, mv);
    if (!r.ok) { this.say(r.err); return; }
    g.sel = null; g.legal = []; this.afterChange(prev, g.state);
    if (g.state.over) this.onOver(); else this.scheduleAI();
  };
  P.setupTap = function (cell) {
    var s = this.g.setup, i = -1; if (cell.sr < 6 || s.done) return;
    for (var k = 0; k < Luz.STATIONS.length; k++) if (Luz.STATIONS[k][0] === cell.sr - 6 && Luz.STATIONS[k][1] === cell.sc) i = k;
    if (i < 0) return;
    if (s.sel === null || s.sel === undefined) { s.sel = i; return; }
    if (s.sel === i) { s.sel = null; return; }
    var t = s.layout.slice(); var a = t[s.sel]; t[s.sel] = t[i]; t[i] = a;
    if (Luz.validLayout(t)) s.layout = t; else this.say('不能这样换:军旗须在大本营,地雷在后两排,炸弹不在第一排');
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
    this.header(info.name + (g.mode === 'ai' ? ' · 人机(' + LEVELS[g.level - 1] + ')' : ' · 房间 ' + g.code), function () { if (s.over) self.leaveGame(); else self.confirmLeave(); });
    // 棋盘区
    var dg = g; if (g.game === 'luzhanqi' && g.mode === 'ai') { dg = Object.assign({}, g, { state: Luz.view(g.state, g.seat) }); } // 本地对局也只绘制己方视角,不泄露对方棋子
    B[g.game].draw(c, this.boardRect(), dg);
    // 底部状态
    var y = H - 112; c.fillStyle = 'rgba(0,0,0,0.3)'; c.fillRect(0, y, W, 112);
    var line = this.statusText(); B.text(c, line, W / 2, y + 20, 17, '#ffeb99', true);
    var sub = this.subText(); if (sub) B.text(c, sub, W / 2, y + 44, 13, '#cfe8d5');
    if (g.game === 'luzhanqi' && g.setup && s.phase === 'setup') {
      var bw = Math.min(150, W / 2 - 14);
      if (!g.setup.done) {
        this.btn(W / 2 - bw - 6, y + 58, bw, 42, '随机布阵', function () { g.setup.layout = Luz.randomLayout(); g.setup.sel = null; }, { color: '#546e7a' });
        this.btn(W / 2 + 6, y + 58, bw, 42, '确认开始', function () { self.confirmSetup(); }, { color: '#2e7d32' });
      }
    } else if (!s.over) {
      this.btn(W / 2 - 60, y + 62, 120, 38, '认输', function () { self.resign(); }, { color: '#c62828', size: 16 });
    }
    if (s.over) this.overlay();
    if (g.mode === 'online' && this.netState !== 'ready') { c.fillStyle = 'rgba(0,0,0,0.6)'; c.fillRect(0, 90, W, 28); B.text(c, '网络断开,正在重连…', W / 2, 104, 15, '#ffcc80'); }
  };
  P.confirmLeave = function () { this.leaveGame(); };
  P.statusText = function () {
    var g = this.g, s = g.state, me = g.seat, names = g.game === 'gomoku' ? ['黑棋', '白棋'] : g.game === 'xiangqi' ? ['红方', '黑方'] : ['红方', '蓝方'];
    if (s.over) return s.winner === 3 ? '和棋' : (s.winner === me ? '你赢了!' : '你输了');
    if (g.game === 'luzhanqi' && s.phase === 'setup') return g.setup && g.setup.done ? '已布阵,等待对方布阵…' : '布阵:点两个棋子交换位置,然后确认';
    var mine = s.turn === me, txt = mine ? '轮到你走棋(' + names[me - 1] + ')' : (g.mode === 'ai' ? '电脑思考中…' : '等待对方走棋…');
    if (g.game === 'xiangqi' && s.check) txt += ' · 将军!';
    return txt;
  };
  P.subText = function () {
    var g = this.g, s = g.state;
    if (g.mode === 'online' && g.players) { var o = g.players[2 - g.seat]; if (o && !o.online) return '对方已断线,等待重连(最长 60 秒)…'; if (o) return '对手:' + o.name; }
    if (g.game === 'luzhanqi' && s.info && s.phase === 'playing') {
      var T = Luz.TYPES, i = s.info, a = i.att === '?' ? '?' : T[i.att].n, d = i.def === '?' ? '?' : T[i.def].n;
      var res = { win: '攻方获胜', lose: '攻方被吃', both: '同归于尽', flag: '夺旗' }[i.outcome];
      return '上一回合战斗:' + (i.attP === g.seat ? '我方' : '对方') + a + ' 攻 ' + d + ' → ' + res;
    }
    if (g.game === 'luzhanqi' && s.dead) return '已阵亡:我方 ' + s.dead.filter(function (d) { return d.p === g.seat; }).length + ' · 对方 ' + s.dead.filter(function (d) { return d.p !== g.seat; }).length;
    return '';
  };
  P.overlay = function () {
    var c = this.ctx, W = this.W, H = this.H, g = this.g, self = this, s = g.state;
    var w = Math.min(W - 40, 320), h = 200, x = (W - w) / 2, y = (H - h) / 2 - 20;
    B.rrect(c, x, y, w, h, 16); c.fillStyle = 'rgba(10,25,18,0.93)'; c.fill(); c.strokeStyle = '#ffeb99'; c.lineWidth = 2; c.stroke();
    var win = s.winner === g.seat;
    B.text(c, s.winner === 3 ? '和棋' : win ? '胜利!' : '失败', x + w / 2, y + 40, 32, win ? '#ffd54f' : '#b0bec5', true);
    B.text(c, s.reason || '', x + w / 2, y + 78, 15, '#cfe8d5');
    if (g.mode === 'ai') this.btn(x + 16, y + 120, w / 2 - 22, 50, '再来一局', function () { self.startLocal(g.game, g.level, g.seat); }, { color: '#2e7d32' });
    this.btn(g.mode === 'ai' ? x + w / 2 + 6 : x + 40, y + 120, g.mode === 'ai' ? w / 2 - 22 : w - 80, 50, '返回大厅', function () { self.leaveGame(); }, { color: '#455a64' });
  };


  /* ================= 斗地主 / 麻将(3、4 人,电脑补位)================= */
  P.startLocalMulti = function (game, level, n) {
    var eng = E[game], info = this.gameInfo(game), g = this.newGameCtl(game, 'ai', 1);
    if (game === 'zhajinhua') { n = Math.max(2, Math.min(6, n || this.diff.n || 5)); g.n = n; }
    g.level = level; g.state = eng.newGame(); g.names = { 1: '我' }; for (var i = 2; i <= (g.n || info.seats); i++) g.names[i] = BOT_NAMES[i - 1];
    g.lastBy = {}; g.seq = -1; g.round = (this.localRound = (this.localRound || 0) + 1);
    if (game === 'mahjong') g.state = eng.newGame({ dealer: ((g.round - 1) % 4) + 1 });
    if (game === 'zhajinhua') g.state = eng.newGame({ n: g.n, dealer: ((g.round - 1) % g.n) + 1 });
    this.g = g; this.cur = info; this.net.stop(); this.setScene('game'); this.afterMulti(g, true); this.scheduleMulti();
  };
  P.viewOf = function (g) { return g.mode === 'ai' ? E[g.game].view(g.state, g.seat) : g.state; };
  P.afterMulti = function (g, first) {
    var s = g.state, vs = this.viewOf(g), prevSeq = g.seq;
    if (g.vs && g.vs.over && !vs.over) { g.overShown = false; g.beansDone = false; g.sel = null; g.selTile = null; g.lastBy = {}; g.seq = -1; prevSeq = -1; } // 新的一局
    g.vs = vs;
    if (g.game === 'doudizhu') { // 本轮各家最近一手
      g.lastBy = {}; var pl = vs.plays || [];
      if (vs.last || (pl.length && !vs.over)) { for (var i = pl.length - 1; i >= 0; i--) { var e = pl[i]; if (!g.lastBy[e.seat]) g.lastBy[e.seat] = e.pass ? { pass: true } : { cards: e.cards, type: e.type }; if (e.lead) break; } }
      if (!vs.last && vs.phase === 'play') g.lastBy = {};
      if (vs.over) { g.lastBy = {}; var q = pl; for (var j = q.length - 1; j >= 0; j--) { var e2 = q[j]; if (!g.lastBy[e2.seat]) g.lastBy[e2.seat] = e2.pass ? { pass: true } : { cards: e2.cards, type: e2.type }; if (e2.lead) break; } }
      if (g.sel) { var mine = vs.hands[g.seat] || []; Object.keys(g.sel).forEach(function (k) { if (mine.indexOf(+k) < 0) delete g.sel[k]; }); }
    }
    if (vs.seq !== prevSeq) { if (!first || prevSeq !== -1) { var ev = vs.event; if (ev && SOUND_OF[ev.t]) { if (ev.t === 'redeal') Sound.sfx('shuffle'); Sound.sfx(SOUND_OF[ev.t]); } } else { Sound.sfx('shuffle'); setTimeout(function () { Sound.sfx('deal'); }, 1100); } g.seq = vs.seq; }
    if (vs.over) g.pick = false;
    if (vs.turn !== g.lastTurn) { g.lastTurn = vs.turn; g.pick = false; g.selTile = null; if (vs.turn !== g.seat) g.sel = null; }
    if (vs.over) this.onOverMulti(g);
    this.dirty = true;
  };
  P.onOverMulti = function (g) {
    if (g.overShown) return; g.overShown = true; var vs = g.vs;
    var info = this.gameInfo(g.game), delta = (vs.scores[g.seat] || 0) * info.unit;
    if (!g.beansDone) { g.beansDone = true; g.delta = delta; this.beans = Math.max(0, this.beans + delta); if (this.beans < 200) { this.beans = 1000; g.relief = true; } this.pf.storage.set('gh_beans', String(this.beans)); }
    var won = vs.winners && vs.winners.indexOf(g.seat) >= 0;
    setTimeout(function () { Sound.sfx(won ? 'win' : (vs.winners && vs.winners.length ? 'lose' : 'end')); }, 650);
    if (won) setTimeout(function () { Sound.sfx('laugh'); }, 1300); else if (vs.winners && vs.winners.length) setTimeout(function () { Sound.sfx('sigh'); }, 1500);
  };
  P.sendMulti = function (mv) {
    var g = this.g; if (!g || !g.vs || g.vs.over) return;
    if (g.mode === 'online') { if (!this.net.send({ t: 'move', move: mv })) this.say('网络未连接,请稍候'); return; }
    if (g.state.turn !== g.seat && !(g.game === 'mahjong' && g.vs.turn === g.seat) && !(g.game === 'zhajinhua' && mv && mv.a === 'look')) return;
    var r = E[g.game].move(g.state, g.seat, mv); if (!r.ok) { this.say(r.err); return; }
    g.sel = null; g.selTile = null; g.pick = false; this.afterMulti(g); this.scheduleMulti();
  };
  P.scheduleMulti = function () {
    var g = this.g, self = this; if (!g || g.mode !== 'ai' || g.state.over || g.aiPending) return;
    var actor = g.state.turn; if (actor === g.seat && !g.auto) return;
    g.aiPending = true; var t0 = Date.now(), view = E[g.game].view(g.state, actor), level = actor === g.seat ? 3 : g.level;
    AIC.request(g.game, view, actor, level, this.aiOpts(g.game, level), function (mv) {
      var wait = Math.max(0, (g.game === 'mahjong' ? 650 : g.game === 'zhajinhua' ? 700 : 800) - (Date.now() - t0));
      setTimeout(function () {
        g.aiPending = false; if (self.g !== g || g.state.over) return;
        var eng = E[g.game], r = mv ? eng.move(g.state, actor, mv) : { ok: false };
        if (!r.ok) { var st = g.state, fb = g.game === 'zhajinhua' ? (Zjh.options(st, actor).call ? { a: 'call' } : { a: 'fold' }) : g.game === 'doudizhu' ? (st.phase === 'bid' ? { bid: 0 } : st.last ? { pass: true } : { cards: [st.hands[actor][st.hands[actor].length - 1]] }) : (st.phase === 'claim' ? { a: 'pass' } : { a: 'discard', tile: st.hands[actor][st.hands[actor].length - 1] }); eng.move(st, actor, fb); }
        self.afterMulti(g); self.scheduleMulti();
      }, wait);
    });
  };
  P.draw_multi = function () {
    var c = this.ctx, W = this.W, H = this.H, g = this.g, self = this, s = g.vs, info = this.gameInfo(g.game);
    this.header(info.name + (g.mode === 'ai' ? ' · 人机(' + LEVELS[g.level - 1] + ')' : ' · 房间 ' + g.code), function () { self.leaveGame(); });
    var rect = this.boardRect();
    CB[g.game].draw(c, rect, g, this);
    var y = H - 112; c.fillStyle = 'rgba(0,0,0,0.3)'; c.fillRect(0, y, W, 112);
    B.text(c, this.multiStatus(), W / 2, y + 20, 16, '#ffeb99', true);
    var sub = this.multiSub(); if (sub) B.text(c, sub, W / 2, y + 44, 13, '#cfe8d5');
    var mine = g.mode === 'online' ? g.players && g.players[g.seat - 1] : null, autoOn = g.mode === 'ai' ? g.auto : !!(mine && mine.auto);
    if (!s.over) this.btn(W / 2 - 60, y + 62, 120, 38, autoOn ? '取消托管' : '托管', function () {
      if (g.mode === 'ai') { g.auto = !g.auto; self.scheduleMulti(); } else self.net.send({ t: autoOn ? 'back' : 'resign' });
    }, { color: autoOn ? '#2e7d32' : '#546e7a', size: 16 });
    // 操作按钮
    if (g.game === 'zhajinhua') { if (!s.over && !autoOn) this.zjhButtons(rect); }
    else if (!s.over && s.turn === g.seat && !autoOn) this.multiButtons(rect);
    if (s.over) this.multiOverlay();
    if (g.mode === 'online' && this.netState !== 'ready') { c.fillStyle = 'rgba(0,0,0,0.6)'; c.fillRect(0, 90, W, 28); B.text(c, '网络断开,正在重连…', W / 2, 104, 15, '#ffcc80'); }
  };
  P.multiButtons = function (rect) {
    var g = this.g, s = g.vs, W = this.W, self = this, bw, y, x0, list = [];
    if (g.game === 'doudizhu') {
      y = rect.y + rect.h - 66 - 10 - 62;
      if (s.phase === 'bid') {
        [0, 1, 2, 3].forEach(function (b) { list.push({ t: b === 0 ? '不叫' : b + ' 分', dis: b !== 0 && b <= s.bid.high, color: b === 0 ? '#546e7a' : '#ef6c00', cb: function () { self.sendMulti({ bid: b }); } }); });
      } else {
        list.push({ t: '不出', dis: !s.last, color: '#546e7a', cb: function () { self.sendMulti({ pass: true }); } });
        list.push({ t: '提示', color: '#1565c0', cb: function () { self.hint(); } });
        list.push({ t: '出牌', color: '#2e7d32', cb: function () { self.playSelected(); } });
      }
    } else {
      var o = Mj.options(s, g.seat); if (!o) return;
      y = (g.handBottom || rect.y + 360) + 12;
      if (s.phase === 'claim') {
        var tile = s.claim.tile; if (o.hu) list.push({ t: '胡', color: '#c62828', cb: function () { self.sendMulti({ a: 'hu' }); } });
        if (o.kong) list.push({ t: '杠', color: '#6a1b9a', cb: function () { self.sendMulti({ a: 'kong' }); } });
        if (o.pong) list.push({ t: '碰', color: '#1565c0', cb: function () { self.sendMulti({ a: 'pong' }); } });
        (o.chi || []).forEach(function (pr) { list.push({ t: '吃 ' + Mj.KN[pr[0]] + Mj.KN[pr[1]], color: '#00838f', cb: function () { self.sendMulti({ a: 'chi', tiles: pr }); } }); });
        list.push({ t: '过', color: '#546e7a', cb: function () { self.sendMulti({ a: 'pass' }); } });
      } else {
        if (o.hu) list.push({ t: '自摸胡', color: '#c62828', cb: function () { self.sendMulti({ a: 'hu' }); } });
        (o.ankong || []).forEach(function (t) { list.push({ t: '暗杠 ' + Mj.KN[t], color: '#6a1b9a', cb: function () { self.sendMulti({ a: 'ankong', tile: t }); } }); });
        (o.addkong || []).forEach(function (t) { list.push({ t: '加杠 ' + Mj.KN[t], color: '#6a1b9a', cb: function () { self.sendMulti({ a: 'addkong', tile: t }); } }); });
        list.push({ t: '打出', dis: g.selTile === null || g.selTile === undefined, color: '#2e7d32', cb: function () { if (g.selTile !== null && g.selTile !== undefined) self.sendMulti({ a: 'discard', tile: g.selTile }); } });
      }
    }
    var n = list.length, gap = 8; bw = Math.min(96, (W - 16 - gap * (n - 1)) / n); x0 = (W - (n * bw + (n - 1) * gap)) / 2;
    list.forEach(function (b, i) { self.btn(x0 + i * (bw + gap), y, bw, 42, b.t, b.cb, { color: b.color, disabled: b.dis, size: 17, label: b.t }); });
  };
  P.zjhButtons = function (rect) {
    var g = this.g, s = g.vs, W = this.W, self = this, o = Zjh.options(s, g.seat), botY = rect.y + rect.h, i;
    if (s.status[g.seat] !== 'active') return;
    var r1 = [], r2 = [];
    if (g.pick) { r1.push({ t: '取消比牌', color: '#546e7a', cb: function () { g.pick = false; self.dirty = true; } }); }
    else {
      if (o.look) r1.push({ t: '看牌', color: '#1565c0', cb: function () { self.sendMulti({ a: 'look' }); } });
      if (o.turn) {
        r1.push({ t: '弃牌', color: '#546e7a', cb: function () { self.sendMulti({ a: 'fold' }); } });
        r1.push({ t: '跟注 ' + o.callCost, dis: !o.call, color: '#2e7d32', cb: function () { self.sendMulti({ a: 'call' }); } });
        r1.push({ t: '比牌', dis: !o.compare.length, color: '#c62828', cb: function () { if (o.compare.length === 1) self.sendMulti({ a: 'compare', target: o.compare[0].target }); else { g.pick = true; self.dirty = true; } } });
        s.levels.forEach(function (u) { if (u > s.unit) { var rr = o.raise.filter(function (x) { return x.unit === u; })[0]; r2.push({ t: '加注到 ' + u, dis: !rr, color: '#ef6c00', cb: function () { self.sendMulti({ a: 'raise', unit: u }); } }); } });
      }
    }
    [[r1, botY - 80], [r2, botY - 40]].forEach(function (row) {
      var list = row[0], n = list.length; if (!n) return; var gap = 6, bw = Math.min(100, (W - 16 - gap * (n - 1)) / n), x0 = (W - (n * bw + (n - 1) * gap)) / 2;
      list.forEach(function (b, k) { self.btn(x0 + k * (bw + gap), row[1], bw, 36, b.t, b.cb, { color: b.color, disabled: b.dis, size: 15 }); });
    });
  };
  P.playSelected = function () {
    var g = this.g, ids = CB.doudizhu.selected(g); if (!ids.length) { this.say('请先选择要出的牌'); return; }
    var cl = Ddz.classify(ids); if (!cl) { this.say('这不是合法牌型'); return; }
    if (g.vs.last && !Ddz.beats(cl, g.vs.last.cl)) { this.say('压不过上一手'); return; }
    this.sendMulti({ cards: ids });
  };
  P.hint = function () {
    var g = this.g, self = this; if (g.hinting) return; g.hinting = true;
    AIC.request('doudizhu', g.vs, g.seat, 2, { timeMs: 100 }, function (mv) {
      g.hinting = false; g.sel = {};
      if (mv && mv.cards) mv.cards.forEach(function (id) { g.sel[id] = true; }); else self.say('没有能压过的牌,请选择「不出」');
      self.dirty = true;
    });
  };
  P.multiStatus = function () {
    var g = this.g, s = g.vs, me = g.seat, nm = function (p) { return (g.names && g.names[p]) || ('玩家' + p); };
    if (s.over) { var won = s.winners && s.winners.indexOf(me) >= 0; return !(s.winners && s.winners.length) ? (s.reason || '本局结束') : (won ? '你赢了!' : '你输了'); }
    if (g.game === 'zhajinhua') {
      if (g.pick) return '点击要比牌的玩家(绿框)';
      if (s.status[me] !== 'active') return '你已出局,等待本局结束…';
      return s.turn === me ? '轮到你:看牌 / 跟注 / 加注 / 比牌 / 弃牌' : nm(s.turn) + ' 思考中…';
    }
    if (g.game === 'doudizhu') {
      if (s.phase === 'bid') return s.turn === me ? '轮到你叫分' : nm(s.turn) + ' 叫分中…';
      return s.turn === me ? (s.last ? '轮到你:压牌或不出' : '轮到你出牌(自由出牌)') : nm(s.turn) + ' 出牌中…';
    }
    if (s.phase === 'claim') return s.turn === me ? '有人打出「' + Mj.KN[s.claim.tile] + '」:你要吃碰杠胡吗?' : '等待 ' + nm(s.turn) + ' 选择…';
    return s.turn === me ? '轮到你出牌(点一下选牌,再点一下或按「打出」)' : nm(s.turn) + ' 思考中…';
  };
  P.multiSub = function () {
    var g = this.g, s = g.vs;
    if (g.mode === 'online' && g.players) { var off = g.players.filter(function (p, i) { return p && !p.online && !p.bot; }); if (off.length) return '有玩家断线,等待重连(最长 60 秒,期间由电脑代打)'; }
    if (g.game === 'zhajinhua') return '仅供娱乐,虚拟积分,不可兑换';
    if (g.game === 'doudizhu' && s.landlord) return '地主:' + ((g.names && g.names[s.landlord]) || s.landlord) + ' · 倍数 ×' + (s.bid.high * s.mult) + ' · 炸弹 ' + s.bombs;
    if (g.game === 'mahjong') return '庄家:' + ((g.names && g.names[s.dealer]) || s.dealer) + ' · 牌墙剩 ' + Math.max(0, s.wallCount - 14);
    return '';
  };
  function wrap(ctx, str, maxW, size) { ctx.font = size + 'px sans-serif'; var out = [], cur = ''; for (var i = 0; i < str.length; i++) { var t = cur + str[i]; if (ctx.measureText && ctx.measureText(t).width > maxW && cur) { out.push(cur); cur = str[i]; } else cur = t; } if (cur) out.push(cur); return out; }
  P.multiOverlay = function () {
    var c = this.ctx, W = this.W, H = this.H, g = this.g, self = this, s = g.vs, info = this.gameInfo(g.game);
    var w = Math.min(W - 24, 350), h = 330 + Math.max(0, (s.n || 0) - 4) * 24, x = (W - w) / 2, y = Math.max(96, (H - h) / 2 - 30);
    B.rrect(c, x, y, w, h, 16); c.fillStyle = 'rgba(10,25,18,0.95)'; c.fill(); c.strokeStyle = '#ffeb99'; c.lineWidth = 2; c.stroke();
    var won = s.winners && s.winners.indexOf(g.seat) >= 0, none = !(s.winners && s.winners.length);
    B.text(c, none ? '本局结束' : won ? '胜利!' : '失败', x + w / 2, y + 30, 28, none ? '#cfd8dc' : won ? '#ffd54f' : '#b0bec5', true);
    var lines = wrap(c, s.reason || '', w - 28, 13); lines.slice(0, 3).forEach(function (l, i) { B.text(c, l, x + w / 2, y + 62 + i * 18, 13, '#cfe8d5', false); });
    var ty = y + 124; for (var p = 1; p <= (s.n || info.seats); p++) { var d = (s.scores[p] || 0) * info.unit; B.text(c, ((g.names && g.names[p]) || '玩家' + p) + (g.game === 'doudizhu' && s.landlord === p ? ' [地主]' : '') + (g.game === 'zhajinhua' && s.handNames && s.handNames[p] ? ' [' + s.handNames[p] + ']' : ''), x + 20, ty, 14, '#fff', false, 'left'); B.text(c, (d > 0 ? '+' : '') + d + ' 豆', x + w - 20, ty, 14, d > 0 ? '#ffd54f' : d < 0 ? '#ef9a9a' : '#cfd8dc', true, 'right'); ty += 24; }
    B.text(c, '欢乐豆(虚拟):' + this.beans + (g.relief ? '(已补助至 1000)' : ''), x + w / 2, ty + 8, 14, '#ffeb99', true);
    var by = y + h - 64;
    if (g.mode === 'ai') this.btn(x + 16, by, w / 2 - 22, 48, '再来一局', function () { self.startLocalMulti(g.game, g.level, g.n); }, { color: '#2e7d32' });
    else if (g.host === g.seat) this.btn(x + 16, by, w / 2 - 22, 48, '再来一局', function () { self.net.send({ t: 'again' }); }, { color: '#2e7d32' });
    else B.text(c, '等房主再开一局', x + w / 4 + 8, by + 24, 13, '#cfe8d5');
    this.btn(x + w / 2 + 6, by, w / 2 - 22, 48, '返回大厅', function () { self.leaveGame(); }, { color: '#455a64' });
  };

  var API = { App: App };
  if (typeof module !== 'undefined' && module.exports) module.exports = API; else (self.GH = self.GH || {}).AppMod = API;
})();
