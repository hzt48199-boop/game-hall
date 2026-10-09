(function () {
  var canvas = document.getElementById('c'), ctx = canvas.getContext('2d'), size = { w: 0, h: 0 };
  function resize() {
    var dpr = window.devicePixelRatio || 1; size.w = window.innerWidth; size.h = window.innerHeight;
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
  canvas.addEventListener('pointerdown', function (e) { var r = canvas.getBoundingClientRect(); app.tap(e.clientX - r.left, e.clientY - r.top); e.preventDefault(); });
  // iOS Safari: 阻止滚动/缩放/橡皮筋; 音频需在 touchend/click 手势内解锁
  ['touchmove', 'gesturestart', 'gesturechange', 'gestureend'].forEach(function (n) { document.addEventListener(n, function (e) { e.preventDefault(); }, { passive: false }); });
  document.addEventListener('contextmenu', function (e) { e.preventDefault(); });
  function unlockAudio() {
    try { if (GH.Sound) { var a = new Audio(); a.src = GH.Sound.base + 'click.wav'; a.volume = 0; var p = a.play(); if (p && p.catch) p.catch(function () { }); GH.Sound.unlock(); } } catch (e) { }
  }
  ['touchend', 'click'].forEach(function (n) { document.addEventListener(n, unlockAudio, { passive: true }); });
  window.__app = app;
})();
