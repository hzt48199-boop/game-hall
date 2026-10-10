/* 薄封装的 WebSocket:有 wx.connectSocket 时使用小游戏接口,否则用浏览器 WebSocket。自动重连并用 token 恢复会话。 */
(function () {
  function create(opts) { // opts: {url, storage, name}
    var N = { connected: false, ready: false, wanted: false, token: opts.storage.get('gh_token') || null, name: opts.storage.get('gh_name') || '', onMessage: null, onStatus: null };
    var gen = 0, sock = null, sendRaw = null, closeRaw = null, retry = 0, timer = null, hb = null;
    var hasWx = typeof wx !== 'undefined' && typeof wx.connectSocket === 'function';
    function status(s) { if (N.onStatus) N.onStatus(s); }
    function open() {
      if (sock) return;
      var my = ++gen, url = typeof opts.url === 'function' ? opts.url() : opts.url;
      function onOpen() { if (my !== gen) return; N.connected = true; retry = 0; N.attempt = 0; sendRaw(JSON.stringify({ t: 'hello', token: N.token, name: N.name })); hb = setInterval(function () { if (N.connected) sendRaw(JSON.stringify({ t: 'ping' })); }, 20000); status('open'); }
      function onMsg(data) {
        if (my !== gen) return; var m; try { m = JSON.parse(data); } catch (e) { return; }
        if (m.t === 'welcome') { N.token = m.token; N.name = m.name; opts.storage.set('gh_token', m.token); opts.storage.set('gh_name', m.name); N.ready = true; status('ready'); }
        if (N.onMessage) N.onMessage(m);
      }
      function onClose() {
        if (my !== gen) return; sock = null; N.connected = false; N.ready = false; clearInterval(hb); status('closed');
        if (N.wanted) { retry++; N.attempt = retry; if (retry > (opts.maxRetry || 8)) { N.wanted = false; status('failed'); return; } status('retrying'); var d = Math.min(15000, 800 * Math.pow(2, retry - 1)); timer = setTimeout(open, d + Math.floor(Math.random() * 300)); }
      }
      try {
        if (hasWx) {
          var task = wx.connectSocket({ url: url }); sock = task;
          task.onOpen(onOpen); task.onMessage(function (r) { onMsg(r.data); }); task.onClose(onClose); task.onError(onClose);
          sendRaw = function (s) { task.send({ data: s }); }; closeRaw = function () { try { task.close({}); } catch (e) { } };
        } else {
          var ws = new WebSocket(url); sock = ws;
          ws.onopen = onOpen; ws.onmessage = function (e) { onMsg(e.data); }; ws.onclose = onClose; ws.onerror = function () { };
          sendRaw = function (s) { ws.send(s); }; closeRaw = function () { try { ws.close(); } catch (e) { } };
        }
      } catch (e) { sock = null; status('closed'); if (N.wanted) timer = setTimeout(open, 3000); }
    }
    N.start = function () { N.wanted = true; retry = 0; N.attempt = 0; clearTimeout(timer); open(); };
    N.stop = function () { N.wanted = false; clearTimeout(timer); clearInterval(hb); if (sock) { gen++; closeRaw(); sock = null; } N.connected = false; N.ready = false; N.attempt = 0; };
    N.send = function (obj) { if (!N.ready) return false; try { sendRaw(JSON.stringify(obj)); return true; } catch (e) { return false; } };
    return N;
  }
  var API = { create: create };
  if (typeof module !== 'undefined' && module.exports) module.exports = API; else (self.GH = self.GH || {}).Net = API;
})();
