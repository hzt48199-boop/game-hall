/* AI 调用封装: 网页用 Web Worker(js/ai-worker.js),微信小游戏用 wx.createWorker('workers/ai.js'),都不可用时退回主线程(带时限的同步搜索,
   思考期间界面会短暂停顿,最长约为各游戏的思考时限)。 */
(function () {
  var req = typeof require === 'function';
  var AI = req ? require('./ai.js') : GH.AI;
  var A = { kind: 'sync', worker: null, id: 0, pending: {}, ready: false };
  function failAll() { var p = A.pending; A.pending = {}; A.worker = null; A.kind = 'sync'; for (var k in p) runSync(p[k]); }
  function runSync(job) {
    setTimeout(function () { var mv = null; try { mv = AI.computeMove(job.game, job.state, job.seat, job.level, job.opts); } catch (e) { mv = null; job.err = e; } job.cb(mv, job.err); }, 0);
  }
  A.init = function () {
    if (A.ready) return; A.ready = true;
    try {
      if (typeof wx !== 'undefined' && typeof wx.createWorker === 'function') {
        var w = wx.createWorker('workers/ai.js'); A.worker = w; A.kind = 'wx-worker';
        w.onMessage(function (m) { var j = A.pending[m.id]; if (j) { delete A.pending[m.id]; j.cb(m.mv, m.err); } });
        if (w.onError) w.onError(failAll);
      } else if (typeof Worker !== 'undefined' && typeof document !== 'undefined') {
        var w2 = new Worker('js/ai-worker.js'); A.worker = w2; A.kind = 'web-worker';
        w2.onmessage = function (e) { var m = e.data, j = A.pending[m.id]; if (j) { delete A.pending[m.id]; j.cb(m.mv, m.err); } };
        w2.onerror = failAll;
      }
    } catch (e) { A.worker = null; A.kind = 'sync'; }
  };
  /* cb(move|null, err) */
  A.request = function (game, state, seat, level, opts, cb) {
    A.init(); var id = ++A.id, job = { id: id, game: game, state: state, seat: seat, level: level, opts: opts || {}, cb: cb };
    if (!A.worker) return runSync(job);
    A.pending[id] = job;
    try { A.worker.postMessage({ id: id, game: game, state: state, seat: seat, level: level, opts: job.opts }); } catch (e) { delete A.pending[id]; runSync(job); }
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = A; else (self.GH = self.GH || {}).AIClient = A;
})();
