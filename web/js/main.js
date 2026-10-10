(function () {
  var canvas = document.getElementById('c'), ctx = canvas.getContext('2d'), size = { w: 0, h: 0 };
  function resize() {
    var dpr = window.devicePixelRatio || 1; var bn = document.getElementById('aads-banner'), bh = bn ? Math.ceil(bn.getBoundingClientRect().height) : 0; size.w = window.innerWidth; size.h = Math.max(300, window.innerHeight - bh); /* canvas ends above the A-Ads banner */
    canvas.width = size.w * dpr; canvas.height = size.h * dpr; canvas.style.width = size.w + 'px'; canvas.style.height = size.h + 'px';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  resize(); window.addEventListener('resize', function () { resize(); if (app) app.dirty = true; });
  var storage = { get: function (k) { try { return localStorage.getItem(k); } catch (e) { return null; } }, set: function (k, v) { try { localStorage.setItem(k, v); } catch (e) { } } };
  function serverUrl() {
    var q = /[?&]server=([^&]+)/.exec(location.search); if (q) return decodeURIComponent(q[1]);
    if (GH_CONFIG.serverUrl) return GH_CONFIG.serverUrl;
    if (location.protocol === 'https:') return 'wss://' + location.host + '/ws';
    if (location.protocol === 'http:' && location.port !== '8080' && location.host) return 'ws://' + location.host + '/ws'; // 同源(server.js 同端口托管)
    return 'ws://' + (location.hostname || 'localhost') + ':8081';
  }
  var app = new GH.AppMod.App({ canvas: canvas, ctx: ctx, getSize: function () { return size; }, storage: storage, raf: function (f) { requestAnimationFrame(f); }, serverUrl: serverUrl });
  // lobby: drag / wheel scrolls the list, a short press taps (tap fires on release); other screens tap immediately
  var drag = null;
  canvas.addEventListener('pointerdown', function (e) {
    var r = canvas.getBoundingClientRect(), x = e.clientX - r.left, y = e.clientY - r.top; e.preventDefault();
    if (app.scene === 'lobby') { drag = { x: x, y: y, ly: y, moved: false }; try { canvas.setPointerCapture(e.pointerId); } catch (er) { } } else app.tap(x, y);
  });
  canvas.addEventListener('pointermove', function (e) {
    if (!drag) return; var r = canvas.getBoundingClientRect(), y = e.clientY - r.top;
    if (!drag.moved && Math.abs(y - drag.y) > 8) drag.moved = true;
    if (drag.moved) { app.scrollBy(drag.ly - y); drag.ly = y; }
  });
  function endDrag(e, cancel) { if (!drag) return; var d = drag; drag = null; if (!d.moved && !cancel) app.tap(d.x, d.y); }
  canvas.addEventListener('pointerup', function (e) { endDrag(e, false); });
  canvas.addEventListener('pointercancel', function (e) { endDrag(e, true); });
  canvas.addEventListener('wheel', function (e) { app.scrollBy(e.deltaY); e.preventDefault(); }, { passive: false });
  // iOS Safari: 阻止滚动/缩放/橡皮筋; 音频需在 touchend/click 手势内解锁
  ['touchmove', 'gesturestart', 'gesturechange', 'gestureend'].forEach(function (n) { document.addEventListener(n, function (e) { e.preventDefault(); }, { passive: false }); });
  document.addEventListener('contextmenu', function (e) { e.preventDefault(); });
  function unlockAudio() {
    try { if (GH.Sound) { var a = new Audio(); a.src = GH.Sound.base + 'click.wav'; a.volume = 0; var p = a.play(); if (p && p.catch) p.catch(function () { }); GH.Sound.unlock(); } } catch (e) { }
  }
  ['touchend', 'click'].forEach(function (n) { document.addEventListener(n, unlockAudio, { passive: true }); });
  // 切到后台/锁屏时暂停声音,回来自动恢复(iOS 会挂起 AudioContext)
  document.addEventListener('visibilitychange', function () { var S = GH.Sound; if (!S || !S.ac) return; try { if (document.hidden) S.ac.suspend(); else S.ac.resume(); } catch (e) { } });
  window.__app = app;
})();
