/* 斗地主与麻将的 Canvas 2D 绘制(扑克牌 / 麻将牌)。交互区域通过 app.hits 注册(点牌、按钮)。 */
(function () {
  var req = typeof require === 'function';
  var B = req ? require('./boards.js') : GH.Boards;
  var D = req ? require('./doudizhu.js') : GH.Doudizhu;
  var M = req ? require('./mahjong.js') : GH.Mahjong;
  var Z = req ? require('./zhajinhua.js') : GH.Zhajinhua;
  var HE = req ? require('./holdem.js') : GH.Holdem;
  var I = req ? require('./i18n.js') : GH.I18n, T = I.t;
  function stripYou(n) { return String(n).replace(' (you)', '').replace('(你)', ''); }
  var text = B.text, rrect = B.rrect, circle = B.circle;
  var SUITS = ['♠', '♥', '♣', '♦'], SUIT_RED = [false, true, false, true];

  function drawCard(ctx, x, y, w, h, id, o) {
    o = o || {};
    rrect(ctx, x + 1, y + 2, w, h, 5); ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.fill();
    rrect(ctx, x, y, w, h, 5);
    if (o.back) { ctx.fillStyle = '#2b5fa8'; ctx.fill(); ctx.strokeStyle = '#d7e6ff'; ctx.lineWidth = 1.5; ctx.stroke(); rrect(ctx, x + 3, y + 3, w - 6, h - 6, 3); ctx.strokeStyle = '#8fb3e8'; ctx.lineWidth = 1; ctx.stroke(); return; }
    ctx.fillStyle = o.dim ? '#d9d9d9' : '#fffdf5'; ctx.fill(); ctx.strokeStyle = o.sel ? '#1e88e5' : '#888'; ctx.lineWidth = o.sel ? 3 : 1; ctx.stroke();
    var r = D.rankOf(id), joker = r >= 16, suit = D.suitOf(id), red = joker ? r === 17 : SUIT_RED[suit], col = red ? '#c62828' : '#212121';
    if (joker) { var fs = Math.max(8, w * 0.28); text(ctx, r === 17 ? 'BIG' : 'SMALL', x + w * 0.5, y + h * 0.22, fs * 0.8, col, true); text(ctx, 'JOKER', x + w * 0.5, y + h * 0.42, fs * 0.62, col, true); text(ctx, '★', x + w * 0.5, y + h * 0.72, w * 0.5, col, true); return; }
    text(ctx, D.NAMES[r], x + w * 0.3, y + h * 0.2, Math.max(9, w * 0.4), col, true);
    text(ctx, SUITS[suit], x + w * 0.3, y + h * 0.42, Math.max(8, w * 0.3), col, false);
    text(ctx, SUITS[suit], x + w * 0.62, y + h * 0.7, Math.max(10, w * 0.5), col, false);
  }
  function drawCards(ctx, cards, x, y, cw, ch, step, o) { for (var i = 0; i < cards.length; i++) drawCard(ctx, x + i * step, y, cw, ch, cards[i], o); }

  /* ================= 斗地主 ================= */
  var doudizhu = {
    // g.vs 为"我"的视角状态;g.sel 为选中牌集合(对象 id→true)
    draw: function (ctx, rect, g, app) {
      var s = g.vs, me = g.seat, W = app.W, right = me % 3 + 1, left = (me + 1) % 3 + 1, names = g.names || {};
      var self = this, hand = s.hands[me] || [], n = hand.length;
      // 对手信息框
      [[left, 8, false], [right, W - 8 - 118, true]].forEach(function (q) {
        var p = q[0], x = q[1], y = rect.y + 6, act = s.turn === p && !s.over;
        rrect(ctx, x, y, 118, 66, 10); ctx.fillStyle = act ? 'rgba(255,214,0,0.25)' : 'rgba(0,0,0,0.3)'; ctx.fill(); ctx.strokeStyle = act ? '#ffd600' : 'rgba(255,255,255,0.3)'; ctx.lineWidth = act ? 3 : 1; ctx.stroke();
        text(ctx, T(names[p] || T('Player {0}', p)), x + 59, y + 14, 13, '#fff', true);
        var role = s.landlord ? (p === s.landlord ? 'Landlord' : 'Farmer') : (s.bid && s.bid.bids[p] !== null && s.bid.bids[p] !== undefined ? (s.bid.bids[p] ? T('Bid {0}', s.bid.bids[p]) : 'No Bid') : '');
        text(ctx, role, x + 59, y + 32, 13, s.landlord && p === s.landlord ? '#ffd54f' : '#cfe8d5', true);
        drawCard(ctx, x + 14, y + 40, 18, 22, 0, { back: true }); text(ctx, '× ' + (s.counts[p] === undefined ? 0 : s.counts[p]), x + 62, y + 52, 15, '#fff', true);
        // 最近一手
        var lp = g.lastBy && g.lastBy[p], cx = q[2] ? W - 8 : 8;
        if (lp) {
          var cwid = 22, chei = 30, stp = Math.min(13, (W / 2 - 24) / Math.max(1, lp.cards ? lp.cards.length : 1));
          if (lp.pass) text(ctx, 'Pass', q[2] ? W - 8 - 30 : 8 + 30, y + 92, 16, '#ffcc80', true);
          else { var total = (lp.cards.length - 1) * stp + cwid, sx = q[2] ? W - 8 - total : 8; drawCards(ctx, lp.cards, sx, y + 76, cwid, chei, stp); if (lp.type === 'bomb' || lp.type === 'rocket') text(ctx, lp.type === 'bomb' ? 'Bomb!' : 'Rocket!', q[2] ? W - 40 : 40, y + 120, 14, '#ff8a65', true); }
        }
      });
      // 底牌
      if (s.bottom && s.bottom.length) { text(ctx, 'Kitty', W / 2, rect.y + 14, 12, '#cfe8d5', false); drawCards(ctx, s.bottom, W / 2 - 40, rect.y + 24, 24, 32, 28 * 0.9, {}); }
      // 倍数与底分
      if (s.phase !== 'bid') text(ctx, T('Multiplier ×{0}', s.bid.high * s.mult), W / 2, rect.y + 70, 13, '#ffeb99', true);
      // 手牌
      var cw = 46, ch = 66, hy = rect.y + rect.h - ch - 10, step = n > 1 ? Math.min(cw * 0.62, (W - 16 - cw) / (n - 1)) : 0, sx = (W - ((n - 1) * step + cw)) / 2;
      for (var i = 0; i < n; i++) {
        (function (i) {
          var id = hand[i], sel = g.sel && g.sel[id], x = sx + i * step, y = hy - (sel ? 16 : 0);
          drawCard(ctx, x, y, cw, ch, id, { sel: sel });
          app.hits.push({ x: x, y: hy - 16, w: i === n - 1 ? cw : step, h: ch + 16, click: false, label: 'card' + id, cb: function () { self.toggle(g, id, app); } });
        })(i);
      }
      // 我最近一手
      var mine = g.lastBy && g.lastBy[me];
      if (mine) { if (mine.pass) text(ctx, 'Pass', W / 2, hy - 74, 18, '#ffcc80', true); else { var st2 = Math.min(18, (W - 60) / Math.max(1, mine.cards.length)), tw = (mine.cards.length - 1) * st2 + 26; drawCards(ctx, mine.cards, (W - tw) / 2, hy - 112, 26, 36, st2); } }
      // 我的身份
      var myRole = s.landlord ? T(me === s.landlord ? 'Landlord' : 'Farmer') : '';
      text(ctx, T(names[me] || 'Me') + (myRole ? ' · ' + myRole : ''), 60, hy - 24 - 36 + 20, 13, s.turn === me && !s.over ? '#ffd600' : '#cfe8d5', true);
    },
    toggle: function (g, id, app) { g.sel = g.sel || {}; if (g.sel[id]) delete g.sel[id]; else g.sel[id] = true; app.dirty = true; },
    selected: function (g) { return Object.keys(g.sel || {}).map(Number).filter(function (id) { return g.sel[id]; }); }
  };

  /* ================= 麻将 ================= */
  var NUM = ['一', '二', '三', '四', '五', '六', '七', '八', '九'], SUITCH = ['万', '筒', '条'], NUM_EN = ['1', '2', '3', '4', '5', '6', '7', '8', '9'], SUITCH_EN = ['CHR', 'DOT', 'BAM'], HON_EN = ['E', 'S', 'W', 'N', 'RD', 'GD'], SUITCOL = ['#b71c1c', '#1565c0', '#2e7d32'];
  function drawTile(ctx, x, y, w, h, k, o) {
    o = o || {};
    rrect(ctx, x + 1, y + 2, w, h, 3); ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.fill();
    rrect(ctx, x, y, w, h, 3);
    if (o.back) { ctx.fillStyle = '#1b7a4b'; ctx.fill(); ctx.strokeStyle = '#d6efe0'; ctx.lineWidth = 1; ctx.stroke(); return; }
    ctx.fillStyle = o.hl ? '#fff3b0' : '#f7f3e3'; ctx.fill(); ctx.strokeStyle = o.sel ? '#1e88e5' : '#9a9a8a'; ctx.lineWidth = o.sel ? 2.5 : 1; ctx.stroke();
    var fs = Math.max(8, w * 0.52);
    var en = I.lang !== 'zh';
    if (k < 27) { var su = Math.floor(k / 9); text(ctx, (en ? NUM_EN : NUM)[k % 9], x + w / 2, y + h * 0.33, fs, '#222', true); text(ctx, (en ? SUITCH_EN : SUITCH)[su], x + w / 2, y + h * 0.7, en ? fs * 0.5 : fs * 0.9, SUITCOL[su], true); }
    else if (k === 33) { rrect(ctx, x + w * 0.2, y + h * 0.2, w * 0.6, h * 0.6, 2); ctx.strokeStyle = '#1565c0'; ctx.lineWidth = 2; ctx.stroke(); }
    else text(ctx, en ? HON_EN[k - 27] : T(M.KN[k]), x + w / 2, y + h * 0.5, en ? fs * 0.9 : fs * 1.2, k === 31 ? '#c62828' : k === 32 ? '#2e7d32' : '#222', true);
  }
  function drawMeld(ctx, m, x, y, w, h) { // 返回占用宽度
    var tiles = m.tiles.slice(0, 4), i;
    for (i = 0; i < tiles.length; i++) drawTile(ctx, x + i * (w + 1), y, w, h, tiles[i], { back: m.type === 'ankong' && (i === 0 || i === 3) });
    return tiles.length * (w + 1) + 4;
  }
  var mahjong = {
    wind: function (s, p) { return T(['East', 'South', 'West', 'North'][(p - s.dealer + 4) % 4]); },
    draw: function (ctx, rect, g, app) {
      var s = g.vs, me = g.seat, W = app.W, names = g.names || {}, self = this, order = [(me + 1) % 4 + 1, (me + 2) % 4 + 1, (me + 3) % 4 + 1, me];
      // 实际顺序: 上家(左) 对家 下家(右) 我 → 自上而下排列为 下家、对家、上家、我 以便阅读
      order = [me % 4 + 1, (me + 1) % 4 + 1, (me + 2) % 4 + 1];
      var y = rect.y + 2, bh = 74, tw = 15, th = 21;
      order.forEach(function (p) {
        var act = s.turn === p && !s.over;
        rrect(ctx, 6, y, W - 12, bh, 8); ctx.fillStyle = act ? 'rgba(255,214,0,0.18)' : 'rgba(0,0,0,0.22)'; ctx.fill(); if (act) { ctx.strokeStyle = '#ffd600'; ctx.lineWidth = 2; ctx.stroke(); }
        var rel = T(p === me % 4 + 1 ? 'next' : p === (me + 2) % 4 + 1 ? 'previous' : 'across');
        text(ctx, self.wind(s, p) + ' ' + T(names[p] || T('Player {0}', p)) + ' (' + rel + ')' + (p === s.dealer ? T(' · dealer') : ''), 14, y + 11, 12, act ? '#ffd600' : '#cfe8d5', true, 'left');
        // 手牌数 / 亮牌
        var mx = W - 12;
        if (s.over && s.hands[p]) { var hh = s.hands[p]; hh.forEach(function (t, i) { drawTile(ctx, 14 + i * 13, y + 20, 12, 17, t, {}); }); }
        else text(ctx, T('Hand {0}', s.handCounts[p]), W - 14, y + 11, 12, '#cfe8d5', false, 'right');
        // 副露(右上)
        var melds = s.melds[p], mxw = 0; melds.forEach(function (m) { mxw += m.tiles.length * 12 + 6; });
        var cx = W - 12 - mxw; melds.forEach(function (m) { cx += drawMeld(ctx, m, cx, y + 20, 11, 16) + 0; });
        // 牌河
        var ds = s.discards[p], per = Math.floor((W - 28) / (tw + 1)), startY = y + 40;
        ds.forEach(function (t, i) { var col = i % per, row = Math.floor(i / per); drawTile(ctx, 14 + col * (tw + 1), startY + row * (th - 2) + (s.over ? 14 : 0), tw, th - 3, t, { hl: s.lastDiscard && s.lastDiscard.seat === p && i === ds.length - 1 && !s.over }); });
        y += bh + 4;
      });
      // 我的牌河与副露
      var ds2 = s.discards[me], per2 = Math.floor((W - 28) / (tw + 1)), act2 = s.turn === me && !s.over;
      rrect(ctx, 6, y, W - 12, 64, 8); ctx.fillStyle = act2 ? 'rgba(255,214,0,0.18)' : 'rgba(0,0,0,0.22)'; ctx.fill(); if (act2) { ctx.strokeStyle = '#ffd600'; ctx.lineWidth = 2; ctx.stroke(); }
      text(ctx, self.wind(s, me) + ' ' + T(names[me] || 'Me') + (me === s.dealer ? T(' · dealer') : '') + '  ' + T('Wall {0}', Math.max(0, s.wallCount - 14)), 14, y + 11, 12, act2 ? '#ffd600' : '#cfe8d5', true, 'left');
      ds2.forEach(function (t, i) { drawTile(ctx, 14 + (i % per2) * (tw + 1), y + 20 + Math.floor(i / per2) * (th - 2), tw, th - 3, t, { hl: s.lastDiscard && s.lastDiscard.seat === me && i === ds2.length - 1 && !s.over }); });
      y += 68;
      // 手牌
      var hand = s.hands[me] || [], n = hand.length, melds = s.melds[me], hw = Math.min(27, (W - 12 - 4) / 15), hh2 = hw * 1.42, hy = y + 30;
      var meldW = 0; melds.forEach(function (m) { meldW += m.tiles.length * (hw * 0.62 + 1) + 6; });
      var gap = s.drawn >= 0 && s.turn === me && s.phase === 'discard' ? 8 : 0, total = n * (hw + 1) + gap + meldW, sx = Math.max(4, (W - total) / 2);
      var cx2 = sx; melds.forEach(function (m) { cx2 += drawMeld(ctx, m, cx2, hy + hh2 * 0.3, hw * 0.62, hh2 * 0.7); });
      var drawnIdx = -1; if (gap) { for (var q = n - 1; q >= 0; q--) if (hand[q] === s.drawn) { drawnIdx = q; break; } }
      // 摸到的牌排在最右
      var arr = hand.map(function (t, i) { return { t: t, i: i }; }); if (drawnIdx >= 0) { var dd = arr.splice(drawnIdx, 1)[0]; arr.push(dd); }
      arr.forEach(function (e, j) {
        var x = cx2 + j * (hw + 1) + (gap && j === arr.length - 1 ? gap : 0), sel = g.selTile === e.t, yy = hy - (sel ? 12 : 0);
        drawTile(ctx, x, yy, hw, hh2, e.t, { sel: sel });
        app.hits.push({ x: x, y: hy - 12, w: hw + 1, h: hh2 + 12, click: false, label: 'tile' + e.t, cb: function () { self.tapTile(g, e.t, app); } });
      });
      g.handBottom = hy + hh2;
    },
    tapTile: function (g, t, app) {
      var s = g.vs; if (s.over) return;
      var canAct = s.phase === 'discard' && s.turn === g.seat;
      if (g.selTile === t && canAct) { g.selTile = null; app.sendMulti({ a: 'discard', tile: t }); return; }
      g.selTile = t; app.dirty = true;
    }
  };

  /* ================= 炸金花(纯虚拟积分,仅供娱乐)================= */
  function drawPoker(ctx, x, y, w, h, id, o) {
    o = o || {};
    rrect(ctx, x + 1, y + 2, w, h, 5); ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.fill();
    rrect(ctx, x, y, w, h, 5);
    if (id === null || id === undefined || o.back) { ctx.fillStyle = o.dim ? '#4a5a70' : '#2b5fa8'; ctx.fill(); ctx.strokeStyle = '#d7e6ff'; ctx.lineWidth = 1.2; ctx.stroke(); rrect(ctx, x + 3, y + 3, w - 6, h - 6, 3); ctx.strokeStyle = '#8fb3e8'; ctx.lineWidth = 1; ctx.stroke(); return; }
    ctx.fillStyle = '#fffdf5'; ctx.fill(); ctx.strokeStyle = o.hl ? '#ffd600' : '#888'; ctx.lineWidth = o.hl ? 3 : 1; ctx.stroke();
    var su = Z.suitOf(id), red = su === 1 || su === 3, col = red ? '#c62828' : '#212121';
    text(ctx, Z.rankName(Z.rankOf(id)), x + w * 0.3, y + h * 0.22, Math.max(9, w * 0.42), col, true);
    text(ctx, SUITS[su], x + w * 0.3, y + h * 0.45, Math.max(8, w * 0.3), col, false);
    text(ctx, SUITS[su], x + w * 0.6, y + h * 0.72, Math.max(10, w * 0.5), col, false);
  }
  function lastAct(s, p) {
    for (var i = s.log.length - 1; i >= 0; i--) { var e = s.log[i]; if (e.seat === p && e.a !== 'look') return e; }
    return null;
  }
  function actText(e) {
    if (!e) return ''; if (e.a === 'call') return T('Call {0}', e.amt); if (e.a === 'raise') return T('Raise to {0}', e.unit); if (e.a === 'fold') return T('Fold'); if (e.a === 'compare') return T('Compare {0}', e.amt); return '';
  }
  var zhajinhua = {
    draw: function (ctx, rect, g, app) {
      var s = g.vs, me = g.seat, W = app.W, names = g.names || {}, self = this, n = s.n, i, p;
      text(ctx, 'For entertainment only, virtual chips, no cash value, not redeemable', W / 2, rect.y + 8, 11, '#ffcc80', true, 'center', W - 12);
      var others = []; for (i = 1; i < n; i++) others.push(((me - 1 + i) % n) + 1);
      var cols = Math.min(3, others.length), cw = (W - 16 - (cols - 1) * 6) / cols, ch = 88, y0 = rect.y + 20;
      var o = g.pick ? Z.options(s, me) : null;
      others.forEach(function (q, idx) {
        var col = idx % cols, row = Math.floor(idx / cols), x = 8 + col * (cw + 6), y = y0 + row * (ch + 6);
        var act = s.turn === q && !s.over, out = s.status[q] !== 'active', tgt = !!(o && o.compare.some(function (c) { return c.target === q; }));
        rrect(ctx, x, y, cw, ch, 10); ctx.fillStyle = out ? 'rgba(0,0,0,0.5)' : act ? 'rgba(255,214,0,0.25)' : 'rgba(0,0,0,0.3)'; ctx.fill();
        ctx.strokeStyle = tgt ? '#00e676' : act ? '#ffd600' : 'rgba(255,255,255,0.3)'; ctx.lineWidth = tgt || act ? 3 : 1; ctx.stroke();
        var nm = T(stripYou(names[q] || T('Player {0}', q))); if (nm.length > 9) nm = nm.slice(0, 9);
        text(ctx, nm + (q === s.dealer ? T(' · dealer') : ''), x + cw / 2, y + 12, 12, out ? '#90a4ae' : '#fff', true);
        text(ctx, T('Beans {0}', s.stacks[q]), x + cw / 2, y + 27, 12, '#ffeb99', false);
        var st = T(s.status[q] === 'folded' ? 'Folded' : s.status[q] === 'lost' ? 'Lost compare' : (s.seen[q] ? 'Seen' : 'Unseen')), at = actText(lastAct(s, q));
        text(ctx, st + (at && !out ? ' · ' + at : ''), x + cw / 2, y + 42, 11, out ? '#b0bec5' : (s.seen[q] ? '#a5d6a7' : '#cfe8d5'), false);
        var hs = s.hands[q], w2 = 22, h2 = 30, tot = 3 * w2 + 2 * 4, sx = x + (cw - tot) / 2;
        for (var c = 0; c < 3; c++) drawPoker(ctx, sx + c * (w2 + 4), y + 50, w2, h2, hs ? hs[c] : null, { back: !hs, dim: out });
        if (hs && s.handNames[q]) text(ctx, T(s.handNames[q]), x + cw / 2, y + ch - 6, 10, '#ffd54f', true);
        if (tgt) app.hits.push({ x: x, y: y, w: cw, h: ch, label: 'target' + q, cb: function () { g.pick = false; app.sendMulti({ a: 'compare', target: q }); } });
      });
      var rows = Math.ceil(others.length / cols), cy = y0 + rows * (ch + 6) + 6;
      text(ctx, T('Total pot {0}', s.pot), W / 2, cy + 14, 22, '#ffeb99', true);
      text(ctx, T('Round {0}/{1} · Ante {2} · Current unit {3} (seen players pay {4})', Math.min(s.round, s.maxRounds), s.maxRounds, s.ante, s.unit, 2 * s.unit), W / 2, cy + 36, 12, '#cfe8d5', false);
      // 我的牌与状态
      var hand = s.hands[me], cw2 = 54, chh = 76, gap = 8, tw = 3 * cw2 + 2 * gap, sx2 = (W - tw) / 2, botY = rect.y + rect.h, hy = botY - 98 - 8 - chh, act2 = s.turn === me && !s.over, out2 = s.status[me] !== 'active';
      var myst = T(out2 ? (s.status[me] === 'folded' ? 'Folded' : 'Lost compare') : (s.seen[me] ? 'Seen' : 'Unseen (tap Look to see your cards)'));
      text(ctx, T(stripYou(names[me] || 'Me')) + (me === s.dealer ? T(' · dealer') : '') + ' · ' + T('Beans {0}', s.stacks[me]) + ' · ' + myst, W / 2, hy - 12, 13, act2 ? '#ffd600' : '#cfe8d5', true);
      for (i = 0; i < 3; i++) drawPoker(ctx, sx2 + i * (cw2 + gap), hy, cw2, chh, hand ? hand[i] : null, { back: !hand, dim: out2 });
      if (hand && s.handNames[me]) text(ctx, T(s.handNames[me]), W / 2, hy + chh + 11, 14, '#ffd54f', true);
    }
  };

  /* ================= Texas Hold'em (virtual chips, entertainment only) ================= */
  var HD_ACT = { check: 'Check', call: 'Call', bet: 'Bet', raise: 'Raise', allin: 'All-in', fold: 'Fold' };
  var PHASE = { preflop: 'Pre-flop', flop: 'Flop', turn: 'Turn', river: 'River', over: 'Showdown' };
  function hdLast(s, p) { // last action of seat p on the current street
    for (var i = s.log.length - 1; i >= 0; i--) { var e = s.log[i]; if (e.seat === p) return e.street === s.phase || s.over ? e : (e.a === 'fold' || e.a === 'allin' ? e : null); }
    return null;
  }
  var holdem = {
    draw: function (ctx, rect, g, app) {
      var s = g.vs, me = g.seat, W = app.W, names = g.names || {}, n = s.n, i, others = [];
      for (i = 1; i < n; i++) others.push(((me - 1 + i) % n) + 1);
      text(ctx, 'For entertainment only, virtual chips, no cash value, not redeemable', W / 2, rect.y + 8, 11, '#ffcc80', true, 'center', W - 12);
      var cols = Math.min(3, others.length), cw = (W - 16 - (cols - 1) * 6) / cols, ch = 80, y0 = rect.y + 20, botY = rect.y + rect.h;
      var chh = 76, cw2 = 54, hy = botY - 98 - 8 - chh;
      others.forEach(function (q, idx) {
        var col = idx % cols, row = Math.floor(idx / cols), x = 8 + col * (cw + 6), y = y0 + row * (ch + 5);
        var act = s.turn === q && !s.over, out = s.status[q] === 'folded' || s.status[q] === 'out', win = s.over && s.winners.indexOf(q) >= 0;
        rrect(ctx, x, y, cw, ch, 10); ctx.fillStyle = out ? 'rgba(0,0,0,0.5)' : act ? 'rgba(255,214,0,0.25)' : 'rgba(0,0,0,0.3)'; ctx.fill();
        ctx.strokeStyle = win ? '#ffd54f' : act ? '#ffd600' : 'rgba(255,255,255,0.3)'; ctx.lineWidth = win || act ? 3 : 1; ctx.stroke();
        var nm = T(stripYou(names[q] || T('Player {0}', q))); if (nm.length > 9) nm = nm.slice(0, 9);
        text(ctx, nm, x + cw / 2 - 6, y + 11, 12, out ? '#90a4ae' : '#fff', true);
        if (q === s.dealer) { circle(ctx, x + cw - 11, y + 11, 8); ctx.fillStyle = '#ffd54f'; ctx.fill(); text(ctx, 'D', x + cw - 11, y + 11, 10, '#333', true); }
        else if (q === s.sbSeat || q === s.bbSeat) text(ctx, q === s.sbSeat ? 'SB' : 'BB', x + cw - 14, y + 11, 10, '#90caf9', true);
        text(ctx, T('Chips {0}', s.stacks[q]), x + cw / 2, y + 25, 12, '#ffeb99', false);
        var la = hdLast(s, q), st = s.status[q] === 'folded' ? T('Folded') : s.status[q] === 'allin' ? T('All-in') : (la ? T(HD_ACT[la.a] || '') : '');
        if (s.bets[q] > 0 && !s.over) st = (st ? st + ' · ' : '') + T('Bet {0}', s.bets[q]);
        text(ctx, st, x + cw / 2, y + 39, 11, out ? '#b0bec5' : '#cfe8d5', false, 'center', cw - 6);
        var hs = s.hands[q], w2 = 22, h2 = 30, sx = x + (cw - (2 * w2 + 4)) / 2;
        if (!out || (hs && s.over)) for (var c = 0; c < 2; c++) drawPoker(ctx, sx + c * (w2 + 4), y + 44, w2, h2, hs ? hs[c] : null, { back: !hs, dim: out });
        if (hs && s.hnames[q]) text(ctx, T(s.hnames[q]), x + cw / 2, y + ch - 5, 9, '#ffd54f', true, 'center', cw - 4);
        if (s.over && s.scores[q] !== 0) text(ctx, (s.scores[q] > 0 ? '+' : '') + s.scores[q], x + cw - 24, y + 56, 13, s.scores[q] > 0 ? '#ffd54f' : '#ef9a9a', true);
      });
      var rows = Math.ceil(others.length / cols), cy = y0 + rows * (ch + 5) + 2;
      // community cards + pot
      var avail = hy - cy - 30, bh = Math.max(34, Math.min(58, avail)), bw = bh * 0.72, gap = 5, tw = 5 * bw + 4 * gap, sx0 = (W - tw) / 2, by = cy + 22;
      text(ctx, T('Pot {0}', s.pot) + ' · ' + T(PHASE[s.phase] || '') + ' · ' + T('Hand #{0} · Blinds {1}/{2}', s.handNo, s.sb, s.bb), W / 2, cy + 9, 13, '#ffeb99', true, 'center', W - 10);
      for (i = 0; i < 5; i++) { if (i < s.board.length) drawPoker(ctx, sx0 + i * (bw + gap), by, bw, bh, s.board[i], {}); else { rrect(ctx, sx0 + i * (bw + gap), by, bw, bh, 5); ctx.strokeStyle = 'rgba(255,255,255,0.25)'; ctx.lineWidth = 1; ctx.stroke(); } }
      // my cards
      var hand = s.hands[me], act2 = s.turn === me && !s.over, out2 = s.status[me] === 'folded', sx2 = (W - (2 * cw2 + 8)) / 2, wonMe = s.over && s.winners.indexOf(me) >= 0;
      text(ctx, T(stripYou(names[me] || 'Me')) + (me === s.dealer ? ' (D)' : me === s.sbSeat ? ' (SB)' : me === s.bbSeat ? ' (BB)' : '') + ' · ' + T('Chips {0}', s.stacks[me]) + (s.bets[me] > 0 && !s.over ? ' · ' + T('Bet {0}', s.bets[me]) : '') + (out2 ? ' · ' + T('Folded') : s.status[me] === 'allin' ? ' · ' + T('All-in') : ''), W / 2, hy - 12, 13, act2 ? '#ffd600' : '#cfe8d5', true, 'center', W - 10);
      for (i = 0; i < 2; i++) drawPoker(ctx, sx2 + i * (cw2 + 8), hy, cw2, chh, hand ? hand[i] : null, { back: !hand, dim: out2, hl: wonMe });
      var desc = s.over ? s.hnames[me] : (s.myHand || '');
      if (hand && desc && !out2) text(ctx, T(desc), W / 2, hy + chh + 11, 13, '#ffd54f', true, 'center', W - 10);
    }
  };
  var API = { doudizhu: doudizhu, mahjong: mahjong, zhajinhua: zhajinhua, holdem: holdem, drawPoker: drawPoker, drawCard: drawCard, drawTile: drawTile, drawCards: drawCards };
  if (typeof module !== 'undefined' && module.exports) module.exports = API; else (self.GH = self.GH || {}).CardBoards = API;
})();
