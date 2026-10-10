/* 麻将规则引擎(4 人,简化国标风格,纯虚拟积分)。座位 1..4。
   牌 34 种(kind): 0-8 万, 9-17 筒, 18-26 条, 27-30 东南西北, 31-33 中发白; 共 136 张,无花牌。
   规则要点(详见 README): 可吃(仅下家)/碰/杠(明杠、暗杠、加杠);自摸或点炮胡;胡牌型=4 组+1 对、七对、十三幺;
   不设起胡番数(任何成牌即可胡,底 1 番);庄家(座位 dealer)先摸第 14 张;牌墙留 14 张,摸完即流局;不设抢杠胡、不设振听、一炮只能一人胡(按顺位)。
   状态机: phase 'discard'(turn 摸牌后须打出一张,或自摸/杠) → 'claim'(依次询问可胡/碰杠/吃的玩家) → 'over'。 */
(function () {
  var KN = ['1 Char', '2 Char', '3 Char', '4 Char', '5 Char', '6 Char', '7 Char', '8 Char', '9 Char', '1 Dot', '2 Dot', '3 Dot', '4 Dot', '5 Dot', '6 Dot', '7 Dot', '8 Dot', '9 Dot', '1 Bam', '2 Bam', '3 Bam', '4 Bam', '5 Bam', '6 Bam', '7 Bam', '8 Bam', '9 Bam', 'East', 'South', 'West', 'North', 'Red Dragon', 'Green Dragon', 'White Dragon'];
  var ORPHANS = [0, 8, 9, 17, 18, 26, 27, 28, 29, 30, 31, 32, 33];
  function isHonor(k) { return k >= 27; }
  function suitOf(k) { return k < 27 ? Math.floor(k / 9) : 3; }
  function isSimple(k) { return k < 27 && k % 9 !== 0 && k % 9 !== 8; }
  function toCounts(tiles) { var c = new Array(34).fill(0); for (var i = 0; i < tiles.length; i++) c[tiles[i]]++; return c; }
  function sortTiles(a) { return a.sort(function (x, y) { return x - y; }); }
  function next(seat) { return seat % 4 + 1; }

  /* ---- 胡牌判定 ---- */
  function setsOK(c, i) {
    while (i < 34 && c[i] === 0) i++;
    if (i >= 34) return true;
    if (c[i] >= 3) { c[i] -= 3; var ok = setsOK(c, i); c[i] += 3; if (ok) return true; }
    if (i < 27 && i % 9 <= 6 && c[i + 1] > 0 && c[i + 2] > 0) { c[i]--; c[i + 1]--; c[i + 2]--; var ok2 = setsOK(c, i); c[i]++; c[i + 1]++; c[i + 2]++; if (ok2) return true; }
    return false;
  }
  function stdWin(c) { for (var p = 0; p < 34; p++) if (c[p] >= 2) { c[p] -= 2; var ok = setsOK(c, 0); c[p] += 2; if (ok) return true; } return false; }
  function sevenPairs(c) { var n = 0; for (var i = 0; i < 34; i++) { if (c[i] === 2) n++; else if (c[i] !== 0) return false; } return n === 7; }
  function orphans13(c) { var pair = false; for (var i = 0; i < ORPHANS.length; i++) { var v = c[ORPHANS[i]]; if (v === 0) return false; if (v === 2) pair = true; else if (v !== 1) return false; } return pair; }
  /* c: 手牌计数(含和的那张); nMelds: 已碰吃杠组数 */
  function canWin(c, nMelds) {
    var total = 0; for (var i = 0; i < 34; i++) total += c[i];
    if (total !== 14 - 3 * nMelds) return false;
    if (nMelds === 0 && (sevenPairs(c) || orphans13(c))) return true;
    return stdWin(c);
  }
  /* 枚举全部标准分解: [{pair, sets:[{k:'seq'|'trip', t}]}] */
  function decompositions(c) {
    var out = [];
    function rec(i, sets, pair) {
      while (i < 34 && c[i] === 0) i++;
      if (i >= 34) { if (pair !== null) out.push({ pair: pair, sets: sets.slice() }); return; }
      if (c[i] >= 3) { c[i] -= 3; sets.push({ k: 'trip', t: i }); rec(i, sets, pair); sets.pop(); c[i] += 3; }
      if (i < 27 && i % 9 <= 6 && c[i + 1] > 0 && c[i + 2] > 0) { c[i]--; c[i + 1]--; c[i + 2]--; sets.push({ k: 'seq', t: i }); rec(i, sets, pair); sets.pop(); c[i]++; c[i + 1]++; c[i + 2]++; }
      if (pair === null && c[i] >= 2) { c[i] -= 2; rec(i, sets, i); c[i] += 2; }
    }
    rec(0, [], null); return out;
  }

  /* ---- 向听数(AI 用) ---- */
  function shantenNormal(c, nMelds) {
    var best = 8 - 2 * nMelds;
    function rec(i, m, t, p) {
      while (i < 34 && c[i] === 0) i++;
      if (i >= 34) { var tt = Math.min(t, 4 - m); var v = 8 - 2 * m - tt - p; if (v < best) best = v; return; }
      if (m + t > 4 + 1 && false) return;
      if (c[i] >= 3) { c[i] -= 3; rec(i, m + 1, t, p); c[i] += 3; }
      if (i < 27 && i % 9 <= 6 && c[i + 1] > 0 && c[i + 2] > 0) { c[i]--; c[i + 1]--; c[i + 2]--; rec(i, m + 1, t, p); c[i]++; c[i + 1]++; c[i + 2]++; }
      if (c[i] >= 2) { c[i] -= 2; if (!p) rec(i, m, t, 1); else rec(i, m, t + 1, p); c[i] += 2; }
      if (i < 27) {
        if (i % 9 <= 7 && c[i + 1] > 0) { c[i]--; c[i + 1]--; rec(i, m, t + 1, p); c[i]++; c[i + 1]++; }
        if (i % 9 <= 6 && c[i + 2] > 0) { c[i]--; c[i + 2]--; rec(i, m, t + 1, p); c[i]++; c[i + 2]++; }
      }
      var keep = c[i]; c[i] = 0; rec(i + 1, m, t, p); c[i] = keep; // 放弃该种牌
    }
    rec(0, nMelds, 0, 0); return best;
  }
  function shanten(c, nMelds) {
    var s = shantenNormal(c, nMelds);
    if (nMelds === 0) {
      var pairs = 0, kinds = 0, i; for (i = 0; i < 34; i++) { if (c[i] >= 2) pairs++; if (c[i] > 0) kinds++; }
      var sp = 6 - pairs + Math.max(0, 7 - kinds); if (sp < s) s = sp;
      var ok = 0, hasPair = 0; for (i = 0; i < ORPHANS.length; i++) { if (c[ORPHANS[i]] > 0) ok++; if (c[ORPHANS[i]] > 1) hasPair = 1; }
      var so = 13 - ok - hasPair; if (so < s) s = so;
    }
    return s;
  }

  /* ---- 算番 ---- */
  function scoreHand(s, seat, c, zimo, lastTile) {
    var melds = s.melds[seat], nM = melds.length, i, items = [];
    var menqing = melds.every(function (m) { return m.type === 'ankong'; });
    var seatWind = 27 + ((seat - s.dealer + 4) % 4), roundWind = 27;
    var all = c.slice(); melds.forEach(function (m) { m.tiles.forEach(function (t) { all[t]++; }); });
    function addItem(n, f) { items.push([n, f]); }
    var best = null;
    function finish(list) { var tot = 0; list.forEach(function (x) { tot += x[1]; }); if (!best || tot > best.fan) best = { fan: tot, items: list }; }
    function common(list) {
      var suits = {}, honors = 0, any = 0; for (var k = 0; k < 34; k++) if (all[k]) { any++; if (k >= 27) honors++; else suits[suitOf(k)] = 1; }
      var ns = Object.keys(suits).length;
      if (ns === 0) list.push(['All Honors', 6]); else if (ns === 1 && honors === 0) list.push(['Full Flush', 4]); else if (ns === 1) list.push(['Half Flush', 2]);
      var simple = true; for (var q = 0; q < 34; q++) if (all[q] && !isSimple(q)) simple = false; if (simple) list.push(['All Simples', 1]);
      if (zimo) list.push(['Self-draw', 1]);
      melds.forEach(function (m) { if (m.type === 'ankong') list.push(['Concealed Kong', 2]); else if (m.type === 'kong' || m.type === 'addkong') list.push(['Exposed Kong', 1]); });
      if (zimo && s.afterKong) list.push(['Win after Kong', 1]);
      if (lastTile) list.push([zimo ? 'Last Tile Draw' : 'Last Discard Win', 1]);
    }
    if (nM === 0 && orphans13(c)) { finish([['Thirteen Orphans', 10]].concat(zimo ? [['Self-draw', 1]] : [])); }
    if (nM === 0 && sevenPairs(c)) { var l7 = [['Seven Pairs', 3]]; common(l7); finish(l7); }
    var ds = decompositions(c.slice());
    ds.forEach(function (d) {
      var list = [['Basic Win', 1]]; common(list);
      if (menqing) list.push(['Concealed Hand', 1]);
      var sets = d.sets.slice(); melds.forEach(function (m) { sets.push(m.type === 'chi' ? { k: 'seq', t: m.tiles[0] } : { k: 'trip', t: m.tiles[0] }); });
      var allTrip = sets.every(function (x) { return x.k === 'trip'; }), allSeq = sets.every(function (x) { return x.k === 'seq'; });
      var pairVal = d.pair >= 31 || d.pair === seatWind || d.pair === roundWind;
      if (allTrip) list.push(['All Pongs', 2]);
      if (allSeq && !pairVal) list.push(['All Chows', 1]);
      var dr = 0; sets.forEach(function (x) { if (x.k === 'trip') { if (x.t >= 31) { dr++; list.push(['Dragon Pong', 1]); } if (x.t === seatWind) list.push(['Seat Wind Pong', 1]); if (x.t === roundWind) list.push(['Round Wind Pong', 1]); } });
      if (dr === 3) list.push(['Big Three Dragons', 5]); else if (dr === 2 && d.pair >= 31) list.push(['Small Three Dragons', 2]);
      for (var su = 0; su < 3; su++) { var has = [0, 3, 6].every(function (o) { return sets.some(function (x) { return x.k === 'seq' && x.t === su * 9 + o; }); }); if (has) { list.push(['Pure Straight', 2]); break; } }
      finish(list);
    });
    return best || { fan: 1, items: [['Basic Win', 1]] };
  }

  /* ---- 状态机 ---- */
  function newGame(opts) {
    opts = opts || {}; var rng = opts.rng || Math.random, dealer = opts.dealer || 1;
    var wall = []; for (var k = 0; k < 34; k++) for (var j = 0; j < 4; j++) wall.push(k);
    for (var i = wall.length - 1; i > 0; i--) { var r = Math.floor(rng() * (i + 1)), t = wall[i]; wall[i] = wall[r]; wall[r] = t; }
    var s = { game: 'mahjong', phase: 'discard', wall: wall, hands: [null, [], [], [], []], melds: [null, [], [], [], []], discards: [null, [], [], [], []], dealer: dealer, turn: dealer, drawn: -1,
      lastDiscard: null, claim: null, afterKong: false, over: false, winner: 0, winners: [], result: null, reason: '', scores: [0, 0, 0, 0, 0], seq: 0, event: null, wallCount: 0, count: 0, base: opts.base || 1 };
    for (var p = 1; p <= 4; p++) s.hands[p] = sortTiles(wall.splice(0, 13));
    var d = wall.shift(); s.hands[dealer].push(d); sortTiles(s.hands[dealer]); s.drawn = d;
    s.wallCount = wall.length; s.event = { t: 'deal', seat: 0 }; s.seq = 1; return s;
  }
  function chiOptions(hand, t) {
    var out = []; if (t >= 27) return out; var c = toCounts(hand), r = t % 9;
    if (r >= 2 && c[t - 2] && c[t - 1]) out.push([t - 2, t - 1]);
    if (r >= 1 && r <= 7 && c[t - 1] && c[t + 1]) out.push([t - 1, t + 1]);
    if (r <= 6 && c[t + 1] && c[t + 2]) out.push([t + 1, t + 2]);
    return out;
  }
  function computeClaims(s, from, t) {
    var q = [], seen = {}, y, i, order = [next(from), next(next(from)), next(next(next(from)))];
    var opts = {};
    order.forEach(function (y) {
      var o = {}, c = toCounts(s.hands[y]);
      c[t]++; if (canWin(c, s.melds[y].length)) o.hu = true; c[t]--;
      if (c[t] >= 2) o.pong = true; if (c[t] >= 3) o.kong = true;
      if (y === next(from)) { var ch = chiOptions(s.hands[y], t); if (ch.length) o.chi = ch; }
      if (Object.keys(o).length) opts[y] = o;
    });
    order.forEach(function (y) { if (opts[y] && opts[y].hu) { q.push({ seat: y, opts: opts[y] }); seen[y] = 1; } });
    order.forEach(function (y) { if (opts[y] && !seen[y] && (opts[y].pong || opts[y].kong)) { q.push({ seat: y, opts: opts[y] }); seen[y] = 1; } });
    order.forEach(function (y) { if (opts[y] && !seen[y]) { q.push({ seat: y, opts: opts[y] }); seen[y] = 1; } });
    return q;
  }
  function ev(s, t, seat, tile) { s.event = { t: t, seat: seat, tile: tile === undefined ? -1 : tile }; s.seq++; }
  function drawFor(s, seat, fromBack) {
    if (s.wall.length <= 14) { return endDraw(s); }
    var t = fromBack ? s.wall.pop() : s.wall.shift();
    s.hands[seat].push(t); sortTiles(s.hands[seat]); s.drawn = t; s.turn = seat; s.phase = 'discard'; s.claim = null; s.wallCount = s.wall.length;
    s.afterKong = !!fromBack; ev(s, 'draw', seat, t); return true;
  }
  function endDraw(s) {
    s.over = true; s.phase = 'over'; s.winner = 0; s.winners = []; s.reason = 'Draw (the wall is exhausted)'; s.result = { type: 'draw' }; s.claim = null; s.wallCount = s.wall.length; ev(s, 'drawgame', 0); return true;
  }
  function settle(s, seat, zimo, from, c) {
    var last = s.wall.length <= 14;
    var sc = scoreHand(s, seat, c, zimo, last), fan = sc.fan * s.base;
    s.over = true; s.phase = 'over'; s.winner = seat; s.winners = [seat]; s.claim = null;
    s.result = { type: zimo ? 'zimo' : 'ron', seat: seat, from: from || 0, fan: fan, items: sc.items };
    var p;
    if (zimo) { for (p = 1; p <= 4; p++) if (p !== seat) { s.scores[p] = -fan; s.scores[seat] += fan; } }
    else { s.scores[from] = -2 * fan; s.scores[seat] = 2 * fan; }
    s.reason = (zimo ? 'Self-draw' : 'Win on discard') + ' ' + fan + ' fan: ' + sc.items.map(function (x) { return x[0] + (x[1] > 1 ? x[1] : ''); }).join('; ');
    ev(s, zimo ? 'zimo' : 'hu', seat); s.wallCount = s.wall.length; return true;
  }
  function removeTiles(hand, tiles) { for (var i = 0; i < tiles.length; i++) { var k = hand.indexOf(tiles[i]); if (k < 0) return false; hand.splice(k, 1); } return true; }

  function options(s, seat) {
    if (s.over) return null;
    if (s.phase === 'discard') {
      if (s.turn !== seat) return null;
      var hand = s.hands[seat], c = toCounts(hand), o = { discard: true, hu: false, ankong: [], addkong: [] };
      o.hu = canWin(c, s.melds[seat].length);
      for (var k = 0; k < 34; k++) if (c[k] === 4) o.ankong.push(k);
      s.melds[seat].forEach(function (m) { if (m.type === 'pong' && c[m.tiles[0]] > 0) o.addkong.push(m.tiles[0]); });
      return o;
    }
    if (s.phase === 'claim') {
      if (s.claim.queue) { var q = s.claim.queue[0]; return q && q.seat === seat ? Object.assign({ pass: true }, q.opts) : null; }
      return s.claim.actor === seat && s.claim.opts ? Object.assign({ pass: true }, s.claim.opts) : null;
    }
    return null;
  }
  function move(s, seat, mv) {
    if (s.over) return { ok: false, err: 'The hand is over' };
    if (!mv || typeof mv.a !== 'string') return { ok: false, err: 'Invalid action' };
    var o = options(s, seat); if (!o) return { ok: false, err: 'Not your turn' };
    s.count++;
    var hand = s.hands[seat], c;
    if (s.phase === 'discard') {
      if (mv.a === 'discard') {
        var t = mv.tile; if (!Number.isInteger(t) || hand.indexOf(t) < 0) return { ok: false, err: 'You do not have that tile' };
        hand.splice(hand.indexOf(t), 1); s.discards[seat].push(t); s.lastDiscard = { seat: seat, tile: t }; s.drawn = -1; s.afterKong = false; ev(s, 'discard', seat, t);
        var q = computeClaims(s, seat, t);
        if (!q.length) { drawFor(s, next(seat)); return { ok: true, kind: s.over ? 'drawgame' : 'discard' }; }
        s.phase = 'claim'; s.claim = { tile: t, from: seat, queue: q }; s.turn = q[0].seat; return { ok: true, kind: 'discard' };
      }
      if (mv.a === 'hu') { if (!o.hu) return { ok: false, err: 'You cannot win now' }; settle(s, seat, true, 0, toCounts(hand)); return { ok: true, kind: 'zimo' }; }
      if (mv.a === 'ankong') { if (o.ankong.indexOf(mv.tile) < 0) return { ok: false, err: 'Cannot make a concealed kong with that' }; removeTiles(hand, [mv.tile, mv.tile, mv.tile, mv.tile]); s.melds[seat].push({ type: 'ankong', tiles: [mv.tile, mv.tile, mv.tile, mv.tile], from: seat }); ev(s, 'kong', seat, mv.tile); drawFor(s, seat, true); return { ok: true, kind: 'kong' }; }
      if (mv.a === 'addkong') { if (o.addkong.indexOf(mv.tile) < 0) return { ok: false, err: 'Cannot add a kong with that' }; removeTiles(hand, [mv.tile]); s.melds[seat].forEach(function (m) { if (m.type === 'pong' && m.tiles[0] === mv.tile) { m.type = 'addkong'; m.tiles.push(mv.tile); } }); ev(s, 'kong', seat, mv.tile); drawFor(s, seat, true); return { ok: true, kind: 'kong' }; }
      return { ok: false, err: 'You must discard now' };
    }
    // claim 阶段
    var cl = s.claim, tile = cl.tile, from = cl.from;
    if (mv.a === 'pass') {
      cl.queue.shift();
      if (!cl.queue.length) { drawFor(s, next(from)); return { ok: true, kind: 'pass' }; }
      s.turn = cl.queue[0].seat; s.seq++; return { ok: true, kind: 'pass' };
    }
    if (mv.a === 'hu') { if (!o.hu) return { ok: false, err: 'You cannot win now' }; c = toCounts(hand); c[tile]++; s.discards[from].pop(); settle(s, seat, false, from, c); return { ok: true, kind: 'hu' }; }
    if (mv.a === 'pong') { if (!o.pong) return { ok: false, err: 'Cannot pong' }; removeTiles(hand, [tile, tile]); s.discards[from].pop(); s.melds[seat].push({ type: 'pong', tiles: [tile, tile, tile], from: from }); return afterClaim(s, seat, 'pong', tile); }
    if (mv.a === 'kong') { if (!o.kong) return { ok: false, err: 'Cannot kong' }; removeTiles(hand, [tile, tile, tile]); s.discards[from].pop(); s.melds[seat].push({ type: 'kong', tiles: [tile, tile, tile, tile], from: from }); s.claim = null; s.lastDiscard = null; ev(s, 'kong', seat, tile); drawFor(s, seat, true); return { ok: true, kind: 'kong' }; }
    if (mv.a === 'chi') {
      var pair = mv.tiles; if (!Array.isArray(pair) || !o.chi || !o.chi.some(function (x) { return pair.length === 2 && x[0] === pair[0] && x[1] === pair[1]; })) return { ok: false, err: 'Cannot chow that way' };
      removeTiles(hand, pair); s.discards[from].pop(); s.melds[seat].push({ type: 'chi', tiles: sortTiles([pair[0], pair[1], tile]), from: from }); return afterClaim(s, seat, 'chi', tile);
    }
    return { ok: false, err: 'Invalid action' };
  }
  function afterClaim(s, seat, kind, tile) { s.phase = 'discard'; s.turn = seat; s.claim = null; s.drawn = -1; s.afterKong = false; s.lastDiscard = null; ev(s, kind, seat, tile); return { ok: true, kind: kind }; }
  function resign(s, seat) { if (s.over) return; s.over = true; s.phase = 'over'; s.winner = 0; s.winners = []; s.reason = 'A player left - hand void'; s.result = { type: 'abort' }; }
  function view(s, seat) {
    var v = {};
    for (var k in s) if (k !== 'wall' && k !== 'hands' && k !== 'claim') v[k] = s[k];
    v.hands = [null, null, null, null, null]; v.handCounts = [0, 0, 0, 0, 0];
    for (var p = 1; p <= 4; p++) { v.handCounts[p] = s.hands[p].length; v.hands[p] = (p === seat || s.over) ? s.hands[p].slice() : null; }
    v.wallCount = s.wall.length;
    if (s.claim) { var q = s.claim.queue ? s.claim.queue[0] : null; v.claim = { tile: s.claim.tile, from: s.claim.from, actor: q ? q.seat : s.claim.actor, opts: q && q.seat === seat ? q.opts : (s.claim.actor === seat ? s.claim.opts : null) }; } else v.claim = null;
    return v;
  }
  var API = { id: 'mahjong', name: 'Mahjong', nSeats: 4, KN: KN, newGame: newGame, move: move, resign: resign, view: view, options: options, canWin: canWin, shanten: shanten, toCounts: toCounts, scoreHand: scoreHand,
    isHonor: isHonor, suitOf: suitOf, isSimple: isSimple, chiOptions: chiOptions, sortTiles: sortTiles, ORPHANS: ORPHANS, decompositions: decompositions, next: next };
  if (typeof module !== 'undefined' && module.exports) module.exports = API; else (self.GH = self.GH || {}).Mahjong = API;
})();
