'use strict';
/* 游戏大厅联机服务器: ws WebSocket,房间管理、服务端走子校验、断线重连。
   环境变量: PORT(默认8081) GRACE_MS(断线保留时间,默认60000) */
const { WebSocketServer } = require('ws');
const crypto = require('crypto');
const E = require('../shared/engines');
const AI = require('../shared/ai');
const Ads = require('./ads').create(); // rewarded-ad tickets for virtual chips (see server/ads.js)

const PORT = +process.env.PORT || 8081;
const GRACE_MS = +process.env.GRACE_MS || 60000;
const ROOM_TTL_MS = 10 * 60 * 1000;

const sessions = new Map(); // token -> session
const rooms = new Map();    // code -> room
const queues = { gomoku: [], xiangqi: [], luzhanqi: [] };
const BOT_NAMES = ['Bot Ace', 'Bot Bao', 'Bot Max', 'Bot Rex', 'Bot Lily', 'Bot Sam'];
const isMulti = g => (E.SEATS[g] || 2) > 2;
const CAP_GAMES = ['zhajinhua', 'holdem'];
const nSeats = room => CAP_GAMES.includes(room.game) ? (room.cap || 4) : (E.SEATS[room.game] || 2); // table size set by the host (2-6)
const TURN_MS = +process.env.TURN_MS || 45000;      // 真人超时由电脑代打(托管)
const QM_START_MS = +process.env.QM_START_MS || 3000; // quick match: delay after two humans meet before the computer fills the rest
const BOT_DELAY = +process.env.BOT_DELAY || 700;     // 电脑出手前的停顿(毫秒)

function send(ws, obj) { if (ws && ws.readyState === 1) ws.send(JSON.stringify(obj)); }
function err(sess, msg, code) { send(sess.ws, { t: 'err', code: code || 'bad', msg }); }
function newCode() { let c; do { c = String(crypto.randomInt(100000, 1000000)); } while (rooms.has(c)); return c; }
function cleanName(n) { return String(n || '').replace(/[\u0000-\u001f<>]/g, '').slice(0, 12) || 'Player' + crypto.randomInt(1000, 9999); }

function snapshot(room, seat) {
  const eng = E[room.game];
  const view = eng.view(room.state, seat);
  return {
    t: 'room', code: room.code, game: room.game, seat, status: room.status,
    players: seatList(room).map(i => room.seats[i] ? { name: room.seats[i].name, online: room.seats[i].bot ? true : !!room.seats[i].ws, bot: !!room.seats[i].bot, auto: !!room.seats[i].auto } : null),
    state: view, ready: room.state.ready || null, rev: room.rev, host: room.host || 1, nSeats: nSeats(room)
  };
}
function seatList(room) { const a = []; for (let i = 1; i <= nSeats(room); i++) a.push(i); return a; }
function broadcast(room) {
  room.rev++;
  seatList(room).forEach(i => { const s = room.seats[i]; if (s && !s.bot && s.ws) send(s.ws, snapshot(room, i)); });
  scheduleBot(room);
}
/* 电脑座位 / 托管座位的自动出手(仅 3、4 人游戏) */
function actorOf(room) { const st = room.state; if (!st || st.over || room.status !== 'playing') return 0; return st.turn; }
function scheduleBot(room) {
  if (!isMulti(room.game)) return;
  clearTimeout(room.botTimer); clearTimeout(room.humanTimer);
  const seat = actorOf(room); if (!seat) return;
  const s = room.seats[seat];
  const run = (delay, level) => { room.botTimer = setTimeout(() => botAct(room, seat, level), delay); };
  if (!s || s.bot || s.auto || !s.ws) run(BOT_DELAY + Math.floor(Math.random() * 500), (s && s.bot) ? s.level : 3);
  else room.humanTimer = setTimeout(() => { s.auto = true; broadcast(room); }, TURN_MS); // 真人超时 → 托管
}
function botAct(room, seat, level) {
  if (!rooms.has(room.code) || actorOf(room) !== seat) return;
  const eng = E[room.game];
  let mv; try { mv = AI.computeMove(room.game, eng.view(room.state, seat), seat, level || 3, { timeMs: 250 }); } catch (e) { console.error('AI error', e); }
  let r = mv ? eng.move(room.state, seat, mv) : { ok: false };
  if (!r.ok) { // 兜底: 过牌/最小合法着
    const fb = fallbackMove(room, seat); if (fb) r = eng.move(room.state, seat, fb);
  }
  updateStatus(room); broadcast(room);
}
function fallbackMove(room, seat) {
  const st = room.state;
  if (room.game === 'doudizhu') { if (st.phase === 'bid') return { bid: 0 }; if (st.last) return { pass: true }; return { cards: [st.hands[seat][st.hands[seat].length - 1]] }; }
  if (room.game === 'zhajinhua') { const o = E.zhajinhua.options(st, seat); return o.call ? { a: 'call' } : { a: 'fold' }; }
  if (room.game === 'holdem') { const o = E.holdem.options(st, seat); return o.check ? { a: 'check' } : { a: 'fold' }; }
  if (room.game === 'mahjong') { const o = E.mahjong.options(st, seat); if (!o) return null; if (st.phase === 'claim') return { a: 'pass' }; return { a: 'discard', tile: st.hands[seat][st.hands[seat].length - 1] }; }
  return null;
}
function startRoom(room) {
  room.status = room.game === 'luzhanqi' ? 'setup' : 'playing';
  if (isMulti(room.game)) { // 空位由电脑补上
    for (let i = 1; i <= nSeats(room); i++) if (!room.seats[i]) room.seats[i] = { bot: true, name: BOT_NAMES[i - 1], level: 3, room: room.code, seat: i };
    const nn = nSeats(room);
    room.state = E[room.game].newGame(room.game === 'zhajinhua' ? { n: nn, dealer: ((room.round || 0) % nn) + 1 } : room.game === 'holdem' ? { n: nn, dealer: ((room.round || 0) % nn) + 1, handNo: (room.round || 0) + 1, stacks: room.state && room.state.game === 'holdem' && room.state.over && room.state.n === nn ? E.holdem.nextStacks(room.state) : undefined } : { dealer: room.round ? ((room.round) % 4) + 1 : 1 }); room.round = (room.round || 0) + 1; return;
  }
  room.state = E[room.game].newGame();
  if (room.game === 'luzhanqi') room.state.phase = 'setup';
}
function updateStatus(room) {
  if (room.state && room.state.over) room.status = 'over';
  else if (room.game === 'luzhanqi' && room.state.phase === 'playing') room.status = 'playing';
}
function createRoom(game, sess) {
  const room = { code: newCode(), game, seats: [null, null, null, null, null, null, null], state: E[game].newGame(), cap: 4, status: 'waiting', rev: 0, created: Date.now(), host: 1 };
  room.seats[1] = sess; sess.room = room.code; sess.seat = 1;
  rooms.set(room.code, room);
  return room;
}
function dropFromQueues(sess) { for (const g in queues) queues[g] = queues[g].filter(s => s !== sess); }
function endRoomIfEmpty(room) {
  const alive = seatList(room).some(i => room.seats[i] && !room.seats[i].bot && room.seats[i].room === room.code);
  if (!alive) { clearTimeout(room.botTimer); clearTimeout(room.humanTimer); rooms.delete(room.code); }
}
function leaveRoom(sess, reason) {
  const room = rooms.get(sess.room);
  dropFromQueues(sess);
  if (!room) { sess.room = null; sess.seat = 0; return; }
  const seat = sess.seat;
  if (isMulti(room.game)) { // 多人: 离开的座位由电脑接管;无真人则结束房间
    room.seats[seat] = { bot: true, name: BOT_NAMES[seat - 1], level: 3, room: room.code, seat };
    sess.room = null; sess.seat = 0;
    const humans = seatList(room).filter(i => room.seats[i] && !room.seats[i].bot);
    if (!humans.length) { rooms.delete(room.code); clearTimeout(room.botTimer); clearTimeout(room.humanTimer); return; }
    if (room.host === seat) room.host = humans[0];
    if (room.status === 'waiting') { room.seats[seat] = null; }
    broadcast(room); return;
  }
  if (room.status === 'playing' || room.status === 'setup') {
    E[room.game].resign(room.state, seat);
    room.state.reason = reason || 'Opponent resigned / left';
    room.status = 'over';
  } else if (room.status === 'waiting') { room.status = 'over'; }
  sess.room = null; sess.seat = 0;
  broadcast(room);
  endRoomIfEmpty(room);
}

const handlers = {
  create(sess, m) {
    if (!E[m.game]) return err(sess, 'Unknown game');
    if (sess.room) leaveRoom(sess, 'Opponent left');
    const room = createRoom(m.game, sess);
    send(sess.ws, snapshot(room, 1));
  },
  join(sess, m) {
    const code = String(m.code || '');
    const room = rooms.get(code);
    if (!room) return err(sess, 'Room not found', 'no_room');
    if (seatList(room).some(i => room.seats[i] === sess)) return send(sess.ws, snapshot(room, sess.seat));
    if (isMulti(room.game)) {
      if (room.status !== 'waiting') return err(sess, 'The room has already started', 'full');
      const free = seatList(room).filter(i => !room.seats[i]); if (!free.length) return err(sess, 'The room is full', 'full');
      if (sess.room) leaveRoom(sess, 'Opponent left');
      room.seats[free[0]] = sess; sess.room = code; sess.seat = free[0];
      if (seatList(room).every(i => room.seats[i])) startRoom(room);   // 坐满自动开局
      return broadcast(room);
    }
    if (room.status !== 'waiting' || room.seats[2]) return err(sess, 'The room is full or already started', 'full');
    if (sess.room) leaveRoom(sess, 'Opponent left');
    room.seats[2] = sess; sess.room = code; sess.seat = 2;
    startRoom(room); broadcast(room);
  },
  match(sess, m) {
    if (!E[m.game]) return err(sess, 'Unknown game');
    if (sess.room) leaveRoom(sess, 'Opponent left');
    dropFromQueues(sess);
    if (isMulti(m.game)) { // 多人游戏: 加入同游戏的公开等待房,否则新建一间(客户端 8 秒无人则自行转人机)
      let room = null; rooms.forEach(r => { if (!room && r.game === m.game && r.status === 'waiting' && r.pub && seatList(r).some(i => !r.seats[i])) room = r; });
      if (!room) { room = createRoom(m.game, sess); room.pub = true; return send(sess.ws, snapshot(room, 1)); }
      const free = seatList(room).filter(i => !room.seats[i]); room.seats[free[0]] = sess; sess.room = room.code; sess.seat = free[0];
      if (seatList(room).every(i => room.seats[i])) startRoom(room);
      else if (!room.qmTimer && seatList(room).filter(i => room.seats[i] && !room.seats[i].bot).length >= 2) { // two humans met: start soon, the computer fills the empty seats
        room.qmTimer = setTimeout(() => { room.qmTimer = null; if (rooms.get(room.code) === room && room.status === 'waiting' && seatList(room).filter(i => room.seats[i] && !room.seats[i].bot).length >= 2) { startRoom(room); broadcast(room); } }, QM_START_MS);
      }
      return broadcast(room);
    }
    const q = (queues[m.game] || (queues[m.game] = [])).filter(s => s.ws && s !== sess);
    queues[m.game] = q;
    if (q.length) {
      const other = q.shift();
      const room = createRoom(m.game, other);
      if (Math.random() < 0.5) { room.seats[1] = other; room.seats[2] = sess; other.seat = 1; sess.seat = 2; }
      else { room.seats[1] = sess; room.seats[2] = other; sess.seat = 1; other.seat = 2; }
      sess.room = room.code;
      startRoom(room); broadcast(room);
    } else { queues[m.game].push(sess); send(sess.ws, { t: 'matching', game: m.game }); }
  },
  cancelMatch(sess) { dropFromQueues(sess); if (sess.room) { const r = rooms.get(sess.room); if (r && isMulti(r.game) && r.status === 'waiting') leaveRoom(sess); } send(sess.ws, { t: 'matchCancelled' }); },
  start(sess) { // 房主在好友房里提前开局,空位由电脑补上(仅 3、4 人游戏)
    const room = rooms.get(sess.room);
    if (!room || !isMulti(room.game) || room.status !== 'waiting') return err(sess, 'Cannot start right now');
    if (room.host !== sess.seat) return err(sess, 'Only the host can start the game');
    startRoom(room); broadcast(room);
  },
  setcap(sess, m) { // 炸金花: 房主设置桌位数(2~6),不能小于已坐下的最大座位号
    const room = rooms.get(sess.room);
    if (!room || !CAP_GAMES.includes(room.game) || room.status !== 'waiting') return err(sess, 'Cannot change the seats right now');
    if (room.host !== sess.seat) return err(sess, 'Only the host can change this');
    const n = Math.floor(+m.n); if (!(n >= 2 && n <= 6)) return err(sess, 'Seats must be 2-6');
    for (let i = n + 1; i <= 6; i++) if (room.seats[i]) return err(sess, 'Seat ' + i + ' is occupied, cannot shrink the table');
    room.cap = n; room.state = E[room.game].newGame({ n }); broadcast(room);
  },
  back(sess) { // 取消托管
    const room = rooms.get(sess.room); if (!room) return; const s = room.seats[sess.seat]; if (s === sess) { sess.auto = false; broadcast(room); }
  },
  again(sess) { // 一局结束后,房主再开一局(同一批人,电脑补位)
    const room = rooms.get(sess.room);
    if (!room || !isMulti(room.game) || room.status !== 'over') return err(sess, 'Cannot start another game right now');
    if (room.host !== sess.seat) return err(sess, 'Please ask the host to start the next game');
    startRoom(room); broadcast(room);
  },
  move(sess, m) {
    const room = rooms.get(sess.room);
    if (!room || room.status !== 'playing') return err(sess, 'You cannot move right now');
    if (sess.auto) { sess.auto = false; }
    const r = E[room.game].move(room.state, sess.seat, m.move);
    if (!r.ok) { err(sess, r.err, 'illegal'); return send(sess.ws, snapshot(room, sess.seat)); }
    updateStatus(room); broadcast(room);
  },
  setup(sess, m) {
    const room = rooms.get(sess.room);
    if (!room || room.game !== 'luzhanqi' || room.status !== 'setup') return err(sess, 'Not in the setup phase');
    const r = E.luzhanqi.setup(room.state, sess.seat, m.layout);
    if (!r.ok) return err(sess, r.err, 'illegal');
    updateStatus(room); broadcast(room);
  },
  resign(sess) {
    const room = rooms.get(sess.room);
    if (!room || (room.status !== 'playing' && room.status !== 'setup')) return;
    if (isMulti(room.game)) { sess.auto = true; return broadcast(room); } // 多人局: 认输 = 交给电脑托管
    E[room.game].resign(room.state, sess.seat); room.status = 'over'; broadcast(room);
  },
  leave(sess) { leaveRoom(sess); send(sess.ws, { t: 'left' }); },
  adStatus(sess) { send(sess.ws, Object.assign({ t: 'adStatus' }, Ads.status(sess.token))); },
  adStart(sess) { const r = Ads.start(sess.token, sess.ip); send(sess.ws, r.ok ? Object.assign({ t: 'adTicket' }, r) : Object.assign({ t: 'adDenied' }, r)); },
  adClaim(sess, m) { const r = Ads.claim(sess.token, m.ticket, sess.ip); send(sess.ws, r.ok ? Object.assign({ t: 'adGrant' }, r) : Object.assign({ t: 'adDenied' }, r)); },
  ping(sess) { send(sess.ws, { t: 'pong' }); }
};

function onHello(ws, m) {
  let sess = m.token && sessions.get(m.token);
  if (sess) {
    if (sess.ws && sess.ws !== ws) { try { sess.ws.close(4000, 'replaced'); } catch (e) { } }
    clearTimeout(sess.timer);
    sess.ws = ws;
    if (m.name) sess.name = cleanName(m.name);
  } else {
    sess = { token: crypto.randomBytes(16).toString('hex'), ws, name: cleanName(m.name), room: null, seat: 0, timer: null };
    sessions.set(sess.token, sess);
  }
  ws.sess = sess; sess.ip = ws.ip;
  send(ws, { t: 'welcome', token: sess.token, name: sess.name });
  const room = rooms.get(sess.room);
  if (room) { sess.auto = false; send(ws, snapshot(room, sess.seat)); broadcast(room); }
}
function onClose(ws) {
  const sess = ws.sess;
  if (!sess || sess.ws !== ws) return;
  sess.ws = null; dropFromQueues(sess);
  const room = rooms.get(sess.room);
  if (room) broadcast(room);
  clearTimeout(sess.timer);
  sess.timer = setTimeout(() => {
    if (sess.ws) return;
    if (sess.room) leaveRoom(sess, 'Opponent disconnected (timeout)');
    sessions.delete(sess.token);
  }, GRACE_MS);
}

const http = require('http'), fs = require('fs'), path = require('path');
const WEB_ROOT = path.join(__dirname, '..', 'web');
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'application/javascript; charset=utf-8', '.wav': 'audio/wav', '.json': 'application/json', '.png': 'image/png', '.css': 'text/css' };
function httpHandler(req, res) {
  let p; try { p = decodeURIComponent(req.url.split('?')[0]); } catch (e) { res.writeHead(400); return res.end('bad'); }
  if (p === '/favicon.ico') { res.writeHead(204); return res.end(); }
  if (p === '/healthz') { res.writeHead(200); return res.end('ok'); }
  if (p === '/') p = '/index.html';
  const f = path.join(WEB_ROOT, path.normalize(p));
  if (!f.startsWith(WEB_ROOT + path.sep) || f.endsWith('serve.js')) { res.writeHead(403); return res.end('forbidden'); }
  fs.readFile(f, (e, d) => {
    if (e) { res.writeHead(404); return res.end('not found'); }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(f)] || 'application/octet-stream', 'Cache-Control': 'no-cache' }); res.end(d);
  });
}
function start(port) {
  const httpServer = http.createServer(httpHandler);
  const wss = new WebSocketServer({ server: httpServer, maxPayload: 8192 });
  httpServer.listen(port === undefined ? PORT : port);
  wss.on('connection', (ws, req) => {
    ws.ip = String((req.headers['x-forwarded-for'] || (req.socket && req.socket.remoteAddress) || '')).split(',')[0].trim();
    ws.alive = true; ws.on('pong', () => { ws.alive = true; });
    let count = 0, t0 = Date.now();
    ws.on('message', data => {
      if (Date.now() - t0 > 5000) { t0 = Date.now(); count = 0; }
      if (++count > 60) return; // 简单限流
      let m; try { m = JSON.parse(data.toString()); } catch (e) { return; }
      if (!m || typeof m.t !== 'string') return;
      if (m.t === 'hello') return onHello(ws, m);
      const sess = ws.sess; if (!sess) return send(ws, { t: 'err', code: 'nohello', msg: 'Please say hello first' });
      const h = handlers[m.t]; if (h && Object.prototype.hasOwnProperty.call(handlers, m.t)) h(sess, m);
    });
    ws.on('close', () => onClose(ws));
    ws.on('error', () => { });
  });
  const hb = setInterval(() => { wss.clients.forEach(ws => { if (!ws.alive) return ws.terminate(); ws.alive = false; try { ws.ping(); } catch (e) { } }); }, 15000);
  const gc = setInterval(() => { Ads.prune(); const now = Date.now(); rooms.forEach((r, k) => { if (now - r.created > ROOM_TTL_MS && (r.status === 'waiting' || r.status === 'over')) rooms.delete(k); }); }, 60000);
  wss.on('close', () => { clearInterval(hb); clearInterval(gc); try { httpServer.close(); } catch (e) { } });
  return wss;
}
module.exports = { start, rooms, sessions };
if (require.main === module) { start(); console.log('[game-hall] ws server listening on :' + PORT); }
