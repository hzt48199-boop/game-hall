/* 三种棋盘的 Canvas 2D 绘制与点击换算。rect={x,y,w,h} 为可用区域; g 为游戏控制器状态。 */
(function () {
  var req = typeof require === 'function';
  var Luz = req ? require('./luzhanqi.js') : GH.Luzhanqi;
  var Xq = req ? require('./xiangqi.js') : GH.Xiangqi;
  var FONT = '"PingFang SC","Microsoft YaHei","Noto Sans CJK SC",sans-serif';
  function circle(ctx, x, y, r) { ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); }
  function rrect(ctx, x, y, w, h, r) { ctx.beginPath(); ctx.moveTo(x + r, y); ctx.lineTo(x + w - r, y); ctx.arcTo(x + w, y, x + w, y + r, r); ctx.lineTo(x + w, y + h - r); ctx.arcTo(x + w, y + h, x + w - r, y + h, r); ctx.lineTo(x + r, y + h); ctx.arcTo(x, y + h, x, y + h - r, r); ctx.lineTo(x, y + r); ctx.arcTo(x, y, x + r, y, r); ctx.closePath(); }
  function text(ctx, s, x, y, size, color, bold, align) { ctx.fillStyle = color; ctx.font = (bold ? 'bold ' : '') + size + 'px ' + FONT; ctx.textAlign = align || 'center'; ctx.textBaseline = 'middle'; ctx.fillText(s, x, y); }

  /* ---------------- 五子棋 ---------------- */
  var gomoku = {
    geom: function (rect) { var S = Math.min(rect.w, rect.h), cell = S / 15; return { x0: rect.x + (rect.w - S) / 2, y0: rect.y + (rect.h - S) / 2, S: S, cell: cell }; },
    draw: function (ctx, rect, g) {
      var gm = this.geom(rect), s = g.state, c = gm.cell;
      ctx.fillStyle = '#e0b370'; ctx.fillRect(gm.x0, gm.y0, gm.S, gm.S);
      ctx.strokeStyle = '#6b4a1e'; ctx.lineWidth = 1; ctx.beginPath();
      for (var i = 0; i < 15; i++) { var p = (i + 0.5) * c; ctx.moveTo(gm.x0 + 0.5 * c, gm.y0 + p); ctx.lineTo(gm.x0 + 14.5 * c, gm.y0 + p); ctx.moveTo(gm.x0 + p, gm.y0 + 0.5 * c); ctx.lineTo(gm.x0 + p, gm.y0 + 14.5 * c); }
      ctx.stroke();
      ctx.fillStyle = '#6b4a1e';[[3, 3], [11, 3], [3, 11], [11, 11], [7, 7]].forEach(function (q) { circle(ctx, gm.x0 + (q[0] + .5) * c, gm.y0 + (q[1] + .5) * c, c * 0.1); ctx.fill(); });
      for (var y = 0; y < 15; y++) for (var x = 0; x < 15; x++) {
        var v = s.board[y * 15 + x]; if (!v) continue;
        var cx = gm.x0 + (x + .5) * c, cy = gm.y0 + (y + .5) * c;
        circle(ctx, cx + 1, cy + 2, c * 0.43); ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.fill();
        circle(ctx, cx, cy, c * 0.43); ctx.fillStyle = v === 1 ? '#151515' : '#f4f4f0'; ctx.fill();
        ctx.strokeStyle = v === 1 ? '#000' : '#aaa'; ctx.lineWidth = 1; ctx.stroke();
        circle(ctx, cx - c * 0.14, cy - c * 0.14, c * 0.1); ctx.fillStyle = v === 1 ? 'rgba(255,255,255,0.25)' : 'rgba(255,255,255,0.9)'; ctx.fill();
      }
      if (s.winLine) { ctx.strokeStyle = '#e53935'; ctx.lineWidth = 3; s.winLine.forEach(function (q) { circle(ctx, gm.x0 + (q[0] + .5) * c, gm.y0 + (q[1] + .5) * c, c * 0.46); ctx.stroke(); }); }
      var lm = s.moves[s.moves.length - 1];
      if (lm) { ctx.strokeStyle = '#e53935'; ctx.lineWidth = 2; var lx = gm.x0 + (lm.x + .5) * c, ly = gm.y0 + (lm.y + .5) * c; ctx.beginPath(); ctx.moveTo(lx - c * .2, ly); ctx.lineTo(lx + c * .2, ly); ctx.moveTo(lx, ly - c * .2); ctx.lineTo(lx, ly + c * .2); ctx.stroke(); }
    },
    cellAt: function (px, py, rect) { var gm = this.geom(rect), x = Math.floor((px - gm.x0) / gm.cell), y = Math.floor((py - gm.y0) / gm.cell); return x >= 0 && y >= 0 && x < 15 && y < 15 ? { x: x, y: y } : null; }
  };

  /* ---------------- 中国象棋 ---------------- */
  var XQ_NAME = { K: '帅', A: '仕', B: '相', N: '马', R: '车', C: '炮', P: '兵', k: '将', a: '士', b: '象', n: '马', r: '车', c: '炮', p: '卒' };
  function xqScr(seat, r, c) { return seat === 1 ? [r, c] : [9 - r, 8 - c]; }
  var xiangqi = {
    geom: function (rect) {
      var cell = Math.min(rect.w / 9, rect.h / 10), W = cell * 9, H = cell * 10;
      return { x0: rect.x + (rect.w - W) / 2, y0: rect.y + (rect.h - H) / 2, W: W, H: H, cell: cell };
    },
    pos: function (gm, sr, sc) { return [gm.x0 + (sc + .5) * gm.cell, gm.y0 + (sr + .5) * gm.cell]; },
    draw: function (ctx, rect, g) {
      var gm = this.geom(rect), s = g.state, c = gm.cell, self = this, seat = g.seat;
      ctx.fillStyle = '#e8c07a'; ctx.fillRect(gm.x0, gm.y0, gm.W, gm.H);
      ctx.strokeStyle = '#5a3a14'; ctx.lineWidth = 1.3;
      var a, b, i;
      ctx.beginPath();
      for (i = 0; i < 10; i++) { a = self.pos(gm, i, 0); b = self.pos(gm, i, 8); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); }
      for (i = 0; i < 9; i++) {
        a = self.pos(gm, 0, i); b = self.pos(gm, 4, i); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]);
        a = self.pos(gm, 5, i); b = self.pos(gm, 9, i); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]);
      }
      a = self.pos(gm, 0, 0); b = self.pos(gm, 9, 0); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]);
      a = self.pos(gm, 0, 8); b = self.pos(gm, 9, 8); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]);
      [[0, 3, 2, 5], [0, 5, 2, 3], [7, 3, 9, 5], [7, 5, 9, 3]].forEach(function (q) { var p1 = self.pos(gm, q[0], q[1]), p2 = self.pos(gm, q[2], q[3]); ctx.moveTo(p1[0], p1[1]); ctx.lineTo(p2[0], p2[1]); });
      ctx.stroke();
      var mid = self.pos(gm, 4.5, 4);
      text(ctx, '楚 河           汉 界', mid[0], mid[1], c * 0.5, '#5a3a14', true);
      // 最后一步
      if (s.last) {
        [[s.last.fr, s.last.fc], [s.last.tr, s.last.tc]].forEach(function (q) { var sc = xqScr(seat, q[0], q[1]), p = self.pos(gm, sc[0], sc[1]); ctx.fillStyle = 'rgba(255,214,0,0.45)'; ctx.fillRect(p[0] - c / 2 + 2, p[1] - c / 2 + 2, c - 4, c - 4); });
      }
      for (var r = 0; r < 10; r++) for (var cc = 0; cc < 9; cc++) {
        var ch = s.board[r][cc]; if (!ch) continue;
        var sp = xqScr(seat, r, cc), p = self.pos(gm, sp[0], sp[1]), red = ch === ch.toUpperCase();
        circle(ctx, p[0] + 1, p[1] + 2, c * 0.43); ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.fill();
        circle(ctx, p[0], p[1], c * 0.43); ctx.fillStyle = '#f7e6c0'; ctx.fill();
        ctx.strokeStyle = red ? '#b71c1c' : '#212121'; ctx.lineWidth = 2; ctx.stroke();
        circle(ctx, p[0], p[1], c * 0.36); ctx.lineWidth = 1; ctx.stroke();
        text(ctx, XQ_NAME[ch], p[0], p[1] + 1, c * 0.5, red ? '#c62828' : '#111', true);
        if (g.sel && g.sel.r === r && g.sel.c === cc) { circle(ctx, p[0], p[1], c * 0.47); ctx.strokeStyle = '#1e88e5'; ctx.lineWidth = 3; ctx.stroke(); }
      }
      (g.legal || []).forEach(function (m) { var sp = xqScr(seat, m.tr, m.tc), p = self.pos(gm, sp[0], sp[1]); circle(ctx, p[0], p[1], s.board[m.tr][m.tc] ? c * 0.47 : c * 0.12); if (s.board[m.tr][m.tc]) { ctx.strokeStyle = '#e53935'; ctx.lineWidth = 3; ctx.stroke(); } else { ctx.fillStyle = 'rgba(30,136,229,0.8)'; ctx.fill(); } });
      if (s.check && !s.over) { var k = Xq.findKing(s.board, s.turn); if (k) { var ks = xqScr(seat, k[0], k[1]), kp = self.pos(gm, ks[0], ks[1]); circle(ctx, kp[0], kp[1], c * 0.5); ctx.strokeStyle = '#ff1744'; ctx.lineWidth = 3; ctx.stroke(); } }
    },
    cellAt: function (px, py, rect, g) {
      var gm = this.geom(rect), sc = Math.floor((px - gm.x0) / gm.cell), sr = Math.floor((py - gm.y0) / gm.cell);
      if (sc < 0 || sr < 0 || sc >= 9 || sr >= 10) return null;
      var a = xqScr(g.seat, sr, sc); return { r: a[0], c: a[1] };
    }
  };

  /* ---------------- 军棋 ---------------- */
  function lzScr(seat, r, c) { return seat === 1 ? [r, c] : [11 - r, 4 - c]; }
  var lz = {
    geom: function (rect) { var cs = Math.min(rect.w / 5.2, rect.h / 12.2), W = cs * 5, H = cs * 12; return { cs: cs, x0: rect.x + (rect.w - W) / 2, y0: rect.y + (rect.h - H) / 2, W: W, H: H }; },
    pos: function (gm, sr, sc) { return [gm.x0 + (sc + .5) * gm.cs, gm.y0 + (sr + .5) * gm.cs]; },
    drawPiece: function (ctx, gm, sr, sc, t, p, opts) {
      var pos = this.pos(gm, sr, sc), w = gm.cs * 0.84, h = gm.cs * 0.6, color = p === 1 ? '#c62828' : '#1565c0';
      rrect(ctx, pos[0] - w / 2 + 1, pos[1] - h / 2 + 2, w, h, 5); ctx.fillStyle = 'rgba(0,0,0,0.28)'; ctx.fill();
      rrect(ctx, pos[0] - w / 2, pos[1] - h / 2, w, h, 5);
      ctx.fillStyle = t === '?' ? color : '#fbf0d0'; ctx.fill(); ctx.strokeStyle = color; ctx.lineWidth = 2; ctx.stroke();
      if (t === '?') text(ctx, '?', pos[0], pos[1] + 1, gm.cs * 0.4, '#ffe0b2', true);
      else text(ctx, Luz.TYPES[t].n, pos[0], pos[1] + 1, gm.cs * 0.36, color, true);
      if (opts && opts.sel) { rrect(ctx, pos[0] - w / 2 - 3, pos[1] - h / 2 - 3, w + 6, h + 6, 7); ctx.strokeStyle = '#ffd600'; ctx.lineWidth = 3; ctx.stroke(); }
    },
    draw: function (ctx, rect, g) {
      var gm = this.geom(rect), s = g.state, seat = g.seat, self = this, cs = gm.cs, r, c;
      ctx.fillStyle = '#c9d8a8'; ctx.fillRect(gm.x0 - cs * .1, gm.y0 - cs * .1, gm.W + cs * .2, gm.H + cs * .2);
      // 公路(细线)与铁路(粗线)
      var segs = function (fn, lw, col) { ctx.strokeStyle = col; ctx.lineWidth = lw; ctx.beginPath(); for (var r = 0; r < 12; r++) for (var c = 0; c < 5; c++) fn(r, c); ctx.stroke(); };
      var line = function (r1, c1, r2, c2) { var a = lzScr(seat, r1, c1), b = lzScr(seat, r2, c2), p1 = self.pos(gm, a[0], a[1]), p2 = self.pos(gm, b[0], b[1]); ctx.moveTo(p1[0], p1[1]); ctx.lineTo(p2[0], p2[1]); };
      segs(function (r, c) {
        if (c < 4) line(r, c, r, c + 1);
        if (r < 11 && !(r === 5 && c % 2 === 1)) line(r, c, r + 1, c);
        [[1, 1], [1, -1]].forEach(function (d) { var rr = r + d[0], cc = c + d[1]; if (rr < 12 && cc >= 0 && cc < 5 && (Luz.isCamp(r, c) || Luz.isCamp(rr, cc))) line(r, c, rr, cc); });
      }, 1.5, '#55603f');
      segs(function (r, c) { if (c < 4 && Luz.railEdge(r, c, r, c + 1)) line(r, c, r, c + 1); if (r < 11 && Luz.railEdge(r, c, r + 1, c)) line(r, c, r + 1, c); }, 5, '#6d6d6d');
      segs(function (r, c) { if (c < 4 && Luz.railEdge(r, c, r, c + 1)) line(r, c, r, c + 1); if (r < 11 && Luz.railEdge(r, c, r + 1, c)) line(r, c, r + 1, c); }, 2, '#e8e8e8');
      var mid = this.pos(gm, 5.5, 1); text(ctx, '山', mid[0], mid[1], cs * 0.4, '#556b2f', true); mid = this.pos(gm, 5.5, 3); text(ctx, '山', mid[0], mid[1], cs * 0.4, '#556b2f', true);
      // 站点: 行营(圆)、大本营(粗框)
      for (r = 0; r < 12; r++) for (c = 0; c < 5; c++) {
        var sp = lzScr(seat, r, c), p = this.pos(gm, sp[0], sp[1]);
        if (Luz.isCamp(r, c)) { circle(ctx, p[0], p[1], cs * 0.36); ctx.fillStyle = '#dbe8bf'; ctx.fill(); ctx.strokeStyle = '#55603f'; ctx.lineWidth = 2; ctx.stroke(); }
        else if (Luz.isHQ(r, c)) { rrect(ctx, p[0] - cs * .44, p[1] - cs * .34, cs * .88, cs * .68, 6); ctx.fillStyle = '#efe1b0'; ctx.fill(); ctx.strokeStyle = '#7a5c13'; ctx.lineWidth = 3; ctx.stroke(); }
        else { rrect(ctx, p[0] - cs * .42, p[1] - cs * .3, cs * .84, cs * .6, 5); ctx.fillStyle = 'rgba(255,255,255,0.35)'; ctx.fill(); ctx.strokeStyle = '#7d8a5e'; ctx.lineWidth = 1; ctx.stroke(); }
      }
      if (s.phase === 'setup' || g.setup) {
        var lay = g.setup && g.setup.layout;
        if (lay) lay.forEach(function (t, i) { var st = Luz.STATIONS[i]; self.drawPiece(ctx, gm, 6 + st[0], st[1], t, seat, { sel: g.setup.sel === i }); });
        // 对方半场暗示
        for (r = 0; r < 6; r++) for (c = 0; c < 5; c++) { /* 空 */ }
        return;
      }
      if (s.last) [[s.last.fr, s.last.fc], [s.last.tr, s.last.tc]].forEach(function (q) { var a = lzScr(seat, q[0], q[1]), p = self.pos(gm, a[0], a[1]); circle(ctx, p[0], p[1], cs * 0.5); ctx.strokeStyle = 'rgba(255,193,7,0.9)'; ctx.lineWidth = 3; ctx.stroke(); });
      for (r = 0; r < 12; r++) for (c = 0; c < 5; c++) {
        var pc = s.board[r][c]; if (!pc) continue; var a = lzScr(seat, r, c);
        this.drawPiece(ctx, gm, a[0], a[1], pc.t, pc.p, { sel: g.sel && g.sel.r === r && g.sel.c === c });
      }
      (g.legal || []).forEach(function (m) { var a = lzScr(seat, m.tr, m.tc), p = self.pos(gm, a[0], a[1]); circle(ctx, p[0], p[1], s.board[m.tr][m.tc] ? cs * 0.46 : cs * 0.12); if (s.board[m.tr][m.tc]) { ctx.strokeStyle = '#ff1744'; ctx.lineWidth = 3; ctx.stroke(); } else { ctx.fillStyle = 'rgba(30,136,229,0.85)'; ctx.fill(); } });
    },
    cellAt: function (px, py, rect, g) {
      var gm = this.geom(rect), sc = Math.floor((px - gm.x0) / gm.cs), sr = Math.floor((py - gm.y0) / gm.cs);
      if (sc < 0 || sr < 0 || sc >= 5 || sr >= 12) return null;
      var a = lzScr(g.seat, sr, sc); return { r: a[0], c: a[1], sr: sr, sc: sc };
    }
  };
  var API = { gomoku: gomoku, xiangqi: xiangqi, luzhanqi: lz, text: text, rrect: rrect, circle: circle, FONT: FONT };
  if (typeof module !== 'undefined' && module.exports) module.exports = API; else (self.GH = self.GH || {}).Boards = API;
})();
