/* 斗地主 AI。
   level 1 简单: 随机合法出牌;level 2 普通: 手牌拆分(最少出牌手数)启发式;
   level 3 困难: 记牌 + 确定化蒙特卡洛(PIMC): 按公开信息(已出的牌、底牌、各家张数)随机补全对手手牌,
   对每个候选出法用启发式策略模拟若干盘到终局,选胜率最高者;叫分同样用模拟估计地主胜率。 */
(function () {
  var D = (typeof require === 'function') ? require('./doudizhu.js') : GH.Doudizhu;
  var NR = 18; // 点数 3..17
  function rnd(n) { return Math.floor(Math.random() * n); }
  function toCnt(hand) { var c = new Int8Array(NR); for (var i = 0; i < hand.length; i++) c[D.rankOf(hand[i])]++; return c; }

  /* ---- 最少手数(拆牌)---- */
  var MH = new Map();
  function keyOf(c) { var s = ''; for (var r = 3; r < NR; r++) s += c[r]; return s; }
  function minHands(c) {
    var r = 3; while (r < NR && c[r] === 0) r++;
    if (r >= NR) return 0;
    var key = keyOf(c), got = MH.get(key); if (got !== undefined) return got;
    var best = 99, v, k, L, i, ok;
    function sub(rank, n) { c[rank] -= n; } function add(rank, n) { c[rank] += n; }
    if (r === 16 && c[17]) { c[16]--; c[17]--; v = 1 + minHands(c); c[16]++; c[17]++; if (v < best) best = v; }
    if (c[r] === 4) { c[r] -= 4; v = 1 + minHands(c); c[r] += 4; if (v < best) best = v; }
    // 顺子
    if (r <= 10) { for (L = 1; r + L - 1 <= 14 && c[r + L - 1] >= 1; L++) if (L >= 5) { for (i = 0; i < L; i++) c[r + i]--; v = 1 + minHands(c); for (i = 0; i < L; i++) c[r + i]++; if (v < best) best = v; } }
    if (r <= 12) { for (L = 1; r + L - 1 <= 14 && c[r + L - 1] >= 2; L++) if (L >= 3) { for (i = 0; i < L; i++) c[r + i] -= 2; v = 1 + minHands(c); for (i = 0; i < L; i++) c[r + i] += 2; if (v < best) best = v; } }
    if (r <= 13) { for (L = 1; r + L - 1 <= 14 && c[r + L - 1] >= 3; L++) if (L >= 2) { for (i = 0; i < L; i++) c[r + i] -= 3; v = 1 + minHands(c); for (i = 0; i < L; i++) c[r + i] += 3; if (v < best) best = v; } }
    if (c[r] >= 3) {
      c[r] -= 3; v = 1 + minHands(c); if (v < best) best = v; // 三张(无带)
      var tried = 0; for (k = 3; k < NR && tried < 2; k++) if (c[k] >= 1) { tried++; c[k]--; v = 1 + minHands(c); c[k]++; if (v < best) best = v; }
      tried = 0; for (k = 3; k < 16 && tried < 2; k++) if (c[k] >= 2) { tried++; c[k] -= 2; v = 1 + minHands(c); c[k] += 2; if (v < best) best = v; }
      c[r] += 3;
    }
    if (c[r] >= 2 && r <= 15) { c[r] -= 2; v = 1 + minHands(c); c[r] += 2; if (v < best) best = v; }
    c[r]--; v = 1 + minHands(c); c[r]++; if (v < best) best = v;
    if (MH.size > 300000) MH.clear();
    MH.set(key, best); return best;
  }

  /* ---- 计数版走法生成 ---- */
  // 描述: {t,r,len,n,c:[[rank,k],...]}
  function kickers(c, excl, k, size, out) { // 取 k 组(size 1/2)最小的、点数不在 excl 中的牌;优先取恰好等于 size 的孤立牌
    var picks = [], pass, r;
    for (pass = 0; pass < 2 && picks.length < k; pass++) for (r = 3; r < NR && picks.length < k; r++) {
      if (excl.indexOf(r) >= 0 || picks.indexOf(r) >= 0) continue;
      if (size === 2 && r > 15) continue;
      var have = c[r]; if (have < size) continue;
      if (pass === 0 ? have === size : have > size) picks.push(r);
    }
    if (picks.length < k) return false;
    picks.forEach(function (r2) { out.push([r2, size]); }); return true;
  }
  function gen(c, last) {
    var out = [], r, L, i, lt = last ? last.t : null, lr = last ? last.r : 0, ll = last ? last.len : 0;
    function push(t, rank, len, n, cs) { out.push({ t: t, r: rank, len: len, n: n, c: cs }); }
    if (!last || lt === 'single') for (r = 3; r < NR; r++) if (c[r] >= 1 && r > lr) push('single', r, 1, 1, [[r, 1]]);
    if (!last || lt === 'pair') for (r = 3; r <= 15; r++) if (c[r] >= 2 && r > lr) push('pair', r, 1, 2, [[r, 2]]);
    if (!last || lt === 'triple') for (r = 3; r <= 15; r++) if (c[r] >= 3 && r > lr) push('triple', r, 1, 3, [[r, 3]]);
    if (!last || lt === 'triple1') for (r = 3; r <= 15; r++) if (c[r] >= 3 && r > lr) { var k1 = [[r, 3]]; if (kickers(c, [r], 1, 1, k1)) push('triple1', r, 1, 4, k1); }
    if (!last || lt === 'triple2') for (r = 3; r <= 15; r++) if (c[r] >= 3 && r > lr) { var k2 = [[r, 3]]; if (kickers(c, [r], 1, 2, k2)) push('triple2', r, 1, 5, k2); }
    if (!last || lt === 'straight') for (r = 3; r <= 10; r++) for (L = 5; r + L - 1 <= 14; L++) { if (last && L !== ll) continue; if (last && r + L - 1 <= lr) continue; var ok = true; for (i = 0; i < L; i++) if (c[r + i] < 1) { ok = false; break; } if (!ok) break; var cs = []; for (i = 0; i < L; i++) cs.push([r + i, 1]); push('straight', r + L - 1, L, L, cs); }
    if (!last || lt === 'pairstraight') for (r = 3; r <= 12; r++) for (L = 3; r + L - 1 <= 14; L++) { if (last && L !== ll) continue; if (last && r + L - 1 <= lr) continue; var ok2 = true; for (i = 0; i < L; i++) if (c[r + i] < 2) { ok2 = false; break; } if (!ok2) break; var cs2 = []; for (i = 0; i < L; i++) cs2.push([r + i, 2]); push('pairstraight', r + L - 1, L, 2 * L, cs2); }
    if (!last || lt === 'plane' || lt === 'plane1' || lt === 'plane2') for (r = 3; r <= 13; r++) for (L = 2; r + L - 1 <= 14; L++) {
      var ok3 = true; for (i = 0; i < L; i++) if (c[r + i] < 3) { ok3 = false; break; } if (!ok3) break;
      if (last && L !== ll) continue; if (last && r + L - 1 <= lr) continue;
      var tri = [], ex = []; for (i = 0; i < L; i++) { tri.push([r + i, 3]); ex.push(r + i); }
      if (!last || lt === 'plane') push('plane', r + L - 1, L, 3 * L, tri);
      if (!last || lt === 'plane1') { var w1 = tri.slice(); if (kickers(c, ex, L, 1, w1)) push('plane1', r + L - 1, L, 4 * L, w1); }
      if (!last || lt === 'plane2') { var w2 = tri.slice(); if (kickers(c, ex, L, 2, w2)) push('plane2', r + L - 1, L, 5 * L, w2); }
    }
    if (!last || lt === 'four2') for (r = 3; r <= 15; r++) if (c[r] === 4 && r > lr) { var f1 = [[r, 4]]; if (kickers(c, [r], 2, 1, f1)) push('four2', r, 1, 6, f1); }
    if (!last || lt === 'four22') for (r = 3; r <= 15; r++) if (c[r] === 4 && r > lr) { var f2 = [[r, 4]]; if (kickers(c, [r], 2, 2, f2)) push('four22', r, 1, 8, f2); }
    if (lt !== 'rocket') {
      for (r = 3; r <= 15; r++) if (c[r] === 4 && (!last || lt !== 'bomb' || r > lr)) push('bomb', r, 1, 4, [[r, 4]]);
      if (c[16] && c[17]) push('rocket', 99, 1, 2, [[16, 1], [17, 1]]);
    }
    return out;
  }
  function applyD(c, d) { for (var i = 0; i < d.c.length; i++) c[d.c[i][0]] -= d.c[i][1]; }
  function undoD(c, d) { for (var i = 0; i < d.c.length; i++) c[d.c[i][0]] += d.c[i][1]; }
  function total(c) { var n = 0; for (var r = 3; r < NR; r++) n += c[r]; return n; }
  function isBomb(d) { return d.t === 'bomb' || d.t === 'rocket'; }

  /* ---- 启发式策略(用于普通档与模拟) ---- */
  // ctx: {cnts:[_,c1,c2,c3], seat, landlord, last:{t,r,len,n,seat}|null, lastSeat}
  function policy(c, seat, ctx, noise) {
    var last = ctx.last, moves = gen(c, last), n = total(c), i, d;
    if (last && !moves.length) return null;
    var myLL = seat === ctx.landlord;
    var opps = []; for (var p = 1; p <= 3; p++) if (p !== seat && (myLL || p === ctx.landlord)) opps.push(p);
    var minOpp = 99; opps.forEach(function (p) { var cc = total(ctx.cnts[p]); if (cc < minOpp) minOpp = cc; });
    for (i = 0; i < moves.length; i++) if (moves[i].n === n) return moves[i]; // 可一手出完
    if (!last) { // 领出
      var best = null, bs = Infinity;
      for (i = 0; i < moves.length; i++) {
        d = moves[i]; applyD(c, d); var mh = minHands(c); undoD(c, d);
        var s = mh * 10 + d.r * 0.3 - d.n * 0.6 + (isBomb(d) ? 9 : 0) + (d.r >= 15 && d.n <= 2 && !isBomb(d) ? 4 : 0);
        if (minOpp === 1 && d.t === 'single') s += 6 - d.r * 0.3; // 对手只剩一张: 少领单张
        if (noise) s += Math.random() * noise;
        if (s < bs) { bs = s; best = d; }
      }
      return best;
    }
    // 跟牌
    if (!myLL && last.seat !== ctx.landlord && last.seat !== seat) return null; // 队友出的牌,不压
    var base = minHands(c), pick = null, ps = Infinity, bomb = null, danger = minOpp <= 3 || (last.seat !== seat && total(ctx.cnts[last.seat]) <= 2);
    for (i = 0; i < moves.length; i++) {
      d = moves[i];
      if (isBomb(d)) { if (!bomb || d.r < bomb.r) bomb = d; continue; }
      applyD(c, d); var mh2 = minHands(c); undoD(c, d);
      var s2 = mh2 * 10 + d.r * 0.5 + (d.r >= 15 ? 3 : 0);
      if (mh2 > base) s2 += 12; // 拆散牌型
      if (noise) s2 += Math.random() * noise;
      if (s2 < ps) { ps = s2; pick = d; }
    }
    if (pick) {
      var wasteful = ps > base * 10 + 8 && !danger;
      if (!wasteful || (danger && true)) return pick;
      return null;
    }
    if (bomb && (danger || n <= 6 || minOpp <= 4)) return bomb;
    return null;
  }
  function randomPolicy(c, seat, ctx) {
    var moves = gen(c, ctx.last);
    if (!moves.length) return null;
    if (ctx.last && Math.random() < 0.35) return null;
    var nb = moves.filter(function (d) { return !isBomb(d); }); if (nb.length && Math.random() < 0.85) return nb[rnd(nb.length)];
    return moves[rnd(moves.length)];
  }

  /* ---- 模拟 ---- */
  function simulate(cnts, turn, last, landlord, maxSteps, pol, noise) {
    var ctx = { cnts: cnts, landlord: landlord, last: last ? { t: last.t, r: last.r, len: last.len, n: last.n, seat: last.seat } : null }, passes = 0, steps = 0;
    while (steps++ < maxSteps) {
      var d = pol(cnts[turn], turn, ctx, noise);
      if (!d) { passes++; if (!ctx.last) { /* 领出必须出牌,理论上不会发生 */ } if (passes >= 2) { ctx.last = null; passes = 0; } }
      else {
        applyD(cnts[turn], d); passes = 0; ctx.last = { t: d.t, r: d.r, len: d.len, n: d.n, seat: turn };
        if (total(cnts[turn]) === 0) return turn;
      }
      turn = turn % 3 + 1;
    }
    return 0;
  }
  function cloneCnts(c) { return [null, Int8Array.from(c[1]), Int8Array.from(c[2]), Int8Array.from(c[3])]; }

  /* ---- 确定化 ---- */
  function unseenPool(view, seat) {
    var seen = {}, i; view.hands[seat].forEach(function (id) { seen[id] = 1; });
    view.plays.forEach(function (pl) { if (pl.cards) pl.cards.forEach(function (id) { seen[id] = 1; }); });
    var pool = []; for (i = 0; i < 54; i++) if (!seen[i]) pool.push(i); return pool;
  }
  function determinize(view, seat, pool) {
    var others = [1, 2, 3].filter(function (p) { return p !== seat; }), c = [null, new Int8Array(NR), new Int8Array(NR), new Int8Array(NR)];
    c[seat] = toCnt(view.hands[seat]);
    var need = {}; others.forEach(function (p) { need[p] = view.counts[p]; });
    var arr = pool.slice();
    for (var i = arr.length - 1; i > 0; i--) { var j = rnd(i + 1), t = arr[i]; arr[i] = arr[j]; arr[j] = t; }
    // 地主底牌(公开)中尚未打出且不在我手里的牌必属于地主
    if (view.landlord && view.landlord !== seat) {
      var ll = view.landlord, forced = view.bottom.filter(function (id) { return arr.indexOf(id) >= 0; });
      forced.forEach(function (id) { c[ll][D.rankOf(id)]++; need[ll]--; arr.splice(arr.indexOf(id), 1); });
    }
    others.forEach(function (p) { for (var k = 0; k < need[p] && arr.length; k++) c[p][D.rankOf(arr.pop())]++; });
    return c;
  }
  function descToCards(d, hand) {
    var byRank = {}; hand.forEach(function (id) { var r = D.rankOf(id); (byRank[r] = byRank[r] || []).push(id); });
    var cards = []; d.c.forEach(function (pr) { for (var k = 0; k < pr[1]; k++) cards.push(byRank[pr[0]][k]); }); return cards;
  }

  /* ---- 叫分 ---- */
  function handStrength(hand) {
    var c = toCnt(hand), s = 0; if (c[16] && c[17]) s += 8; else { if (c[17]) s += 4; if (c[16]) s += 3; }
    s += c[15] * 2; s += c[14] * 0.8; for (var r = 3; r <= 15; r++) if (c[r] === 4) s += 6;
    s -= minHands(c) * 0.9; return s;
  }
  function bidMove(view, seat, level, opts) {
    var high = view.bid.high, want;
    if (level === 1) want = rnd(4);
    else if (level === 2) { var st = handStrength(view.hands[seat]); want = st >= 3.5 ? 3 : st >= 1.5 ? 2 : st >= -0.5 ? 1 : 0; }
    else {
      var limit = Math.min(opts.timeMs || 300, 250), t0 = Date.now(), wins = 0, n = 0, pool = unseenPool(view, seat), hand = view.hands[seat];
      while (n < 12 || (Date.now() - t0 < limit * 0.5 && n < 120)) {
        var arr = pool.slice(); for (var i = arr.length - 1; i > 0; i--) { var j = rnd(i + 1), t = arr[i]; arr[i] = arr[j]; arr[j] = t; }
        var c = [null, null, null, null]; c[seat] = toCnt(hand);
        var bottom = arr.splice(0, 3); bottom.forEach(function (id) { c[seat][D.rankOf(id)]++; });
        var o = [1, 2, 3].filter(function (p) { return p !== seat; }); c[o[0]] = toCnt(arr.slice(0, 17)); c[o[1]] = toCnt(arr.slice(17, 34));
        var w = simulate(c, seat, null, seat, 120, policy, 3); if (w === seat) wins++; n++;
      }
      var p = wins / n; want = p >= 0.62 ? 3 : p >= 0.54 ? 2 : p >= 0.46 ? 1 : 0;
      // 综合牌力(模拟样本有限时的校正)
      var st2 = handStrength(hand); if (st2 >= 7) want = Math.max(want, 3); if (st2 < -3) want = Math.min(want, 1);
    }
    if (want <= high) return { bid: 0 };
    return { bid: want };
  }

  function playMove(view, seat, level, opts) {
    var hand = view.hands[seat], c = toCnt(hand), last = view.last && view.last.seat !== seat ? view.last : null;
    var lastD = last ? { t: last.cl.type, r: last.cl.rank, len: last.cl.len, n: last.cl.n, seat: last.seat } : null;
    var moves = gen(c, lastD), i;
    if (lastD && !moves.length) return { pass: true };
    var cnts = [null, null, null, null];
    if (level === 1) { var rp = randomPolicy(c, seat, { cnts: [null, c, c, c], last: lastD, landlord: view.landlord }); return rp ? { cards: descToCards(rp, hand) } : (lastD ? { pass: true } : { cards: descToCards(moves[0], hand) }); }
    if (level === 2) {
      var pool2 = unseenPool(view, seat), cc = determinize(view, seat, pool2);
      var d = policy(c, seat, { cnts: cc, landlord: view.landlord, last: lastD }, 0); if (!d) return lastD ? { pass: true } : { cards: descToCards(moves[0], hand) };
      return { cards: descToCards(d, hand) };
    }
    // 困难: PIMC
    var limit = opts.timeMs || 400, t0 = Date.now(), pool = unseenPool(view, seat);
    var n = total(c); for (i = 0; i < moves.length; i++) if (moves[i].n === n) return { cards: descToCards(moves[i], hand) }; // 能走完直接走
    // 候选: 启发式排序后取前若干个 + 不出
    var cand = [], scored = [];
    cnts = determinize(view, seat, pool);
    var ctx0 = { cnts: cnts, landlord: view.landlord, last: lastD };
    var base = minHands(c);
    moves.forEach(function (d) { applyD(c, d); var mh = minHands(c); undoD(c, d); var s = mh * 10 + d.r * 0.4 - d.n * 0.5 + (isBomb(d) ? 12 : 0); scored.push({ d: d, s: s }); });
    scored.sort(function (a, b) { return a.s - b.s; });
    var mx = lastD ? 7 : 9, seenKey = {};
    scored.forEach(function (x) { var k = x.d.t + x.d.r + x.d.n; if (cand.length < mx && !seenKey[k + JSON.stringify(x.d.c)]) { seenKey[k + JSON.stringify(x.d.c)] = 1; cand.push(x.d); } });
    // 保证包含最小炸弹/火箭(若存在)作为备选
    var bombs = moves.filter(isBomb).sort(function (a, b) { return a.r - b.r; }); if (bombs.length && cand.indexOf(bombs[0]) < 0) cand.push(bombs[0]);
    var opts2 = cand.slice(); if (lastD) opts2.push(null);
    if (opts2.length === 1) return opts2[0] ? { cards: descToCards(opts2[0], hand) } : { pass: true };
    var wins = new Array(opts2.length).fill(0), cnt = 0, myTeam = function (w) { return seat === view.landlord ? w === seat : (w !== 0 && w !== view.landlord); };
    do {
      var dcn = determinize(view, seat, pool);
      for (var o = 0; o < opts2.length; o++) {
        var cs = cloneCnts(dcn), d2 = opts2[o], turn = seat, newLast;
        if (d2) {
          applyD(cs[seat], d2); newLast = { t: d2.t, r: d2.r, len: d2.len, n: d2.n, seat: seat };
          if (total(cs[seat]) === 0) { wins[o]++; continue; }
          var w = simulate(cs, seat % 3 + 1, newLast, view.landlord, 160, policy, 2.5); if (myTeam(w)) wins[o]++;
        } else { // 不出
          var passes = 1, w2 = simulateFromPass(cs, seat, lastD, view.landlord); if (myTeam(w2)) wins[o]++;
        }
      }
      cnt++;
    } while (Date.now() - t0 < limit * 0.85 && cnt < 400);
    var bi = 0, bv = -1; for (i = 0; i < opts2.length; i++) { var v = wins[i] + (opts2[i] === null ? -0.01 : 0); if (v > bv) { bv = v; bi = i; } }
    var ch = opts2[bi]; return ch ? { cards: descToCards(ch, hand) } : { pass: true };
  }
  function simulateFromPass(cs, seat, lastD, landlord) { // seat 选择不出
    var next = seat % 3 + 1, passes = 1;
    // 若下家之后再有人 pass 则发牌权回到上一手出牌者(由 simulate 内的 passes 逻辑处理): 这里用 last 保留,并让 passes 起始为 1
    var ctx = { cnts: cs, landlord: landlord, last: { t: lastD.t, r: lastD.r, len: lastD.len, n: lastD.n, seat: lastD.seat } }, turn = next, steps = 0;
    while (steps++ < 160) {
      var d = policy(cs[turn], turn, ctx, 2.5);
      if (!d) { passes++; if (passes >= 2) { ctx.last = null; passes = 0; } }
      else { applyD(cs[turn], d); passes = 0; ctx.last = { t: d.t, r: d.r, len: d.len, n: d.n, seat: turn }; if (total(cs[turn]) === 0) return turn; }
      turn = turn % 3 + 1;
    }
    return 0;
  }
  function computeMove(view, seat, level, opts) {
    opts = opts || {};
    if (view.phase === 'bid') return bidMove(view, seat, level, opts);
    return playMove(view, seat, level, opts);
  }
  var API = { computeMove: computeMove, minHands: minHands, gen: gen, toCnt: toCnt, handStrength: handStrength };
  if (typeof module !== 'undefined' && module.exports) module.exports = API; else (self.GH = self.GH || {}).AIDoudizhu = API;
})();
