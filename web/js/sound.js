/* 音效与背景音乐。网页端用 HTMLAudio,微信小游戏用 wx.createInnerAudioContext;资源为 audio/*.wav(由 tools/genaudio.js 程序合成)。
   设置(音效/背景音乐开关)持久化到 localStorage / wx storage。 */
(function () {
  var isWx = typeof wx !== 'undefined' && typeof wx.createInnerAudioContext === 'function';
  var S = { sfxOn: true, musicOn: true, base: 'audio/', storage: null, track: null, wait: false, _music: null, _waitA: null, _cache: {}, unlocked: false };
  S.init = function (storage) {
    S.storage = storage;
    S.sfxOn = storage.get('gh_sfx') !== '0';
    S.musicOn = storage.get('gh_music') !== '0';
  };
  function make() {
    if (isWx) return wx.createInnerAudioContext();
    return new Audio();
  }
  /* 网页端: 优先用 WebAudio(iOS Safari 上延迟低、可无缝循环、可多音叠加);首次点击时创建并 resume 以解锁 */
  var AC = (!isWx && typeof self !== 'undefined') ? (self.AudioContext || self.webkitAudioContext) : null;
  S.ac = null; var bufs = {}, loading = {};
  function wload(name, cb) {
    if (bufs[name]) return cb(bufs[name]);
    if (loading[name]) { loading[name].push(cb); return; }
    loading[name] = [cb];
    var done = function (b) { var q = loading[name] || []; delete loading[name]; if (b) bufs[name] = b; q.forEach(function (f) { f(b); }); };
    try {
      var x = new XMLHttpRequest(); x.open('GET', S.base + name + '.wav'); x.responseType = 'arraybuffer';
      x.onload = function () { try { var r = S.ac.decodeAudioData(x.response, function (b) { done(b); }, function () { done(null); }); if (r && r.catch) r.catch(function () { }); } catch (e) { done(null); } };
      x.onerror = function () { done(null); }; x.send();
    } catch (e) { done(null); }
  }
  S.preload = function (names) { if (S.ac) names.forEach(function (n) { wload(n, function () { }); }); };
  function wstart(name, loop, vol) {
    var h = { stopped: false, src: null, gain: null };
    wload(name, function (b) {
      if (!b || h.stopped || !S.ac) return;
      var src = S.ac.createBufferSource(), g = S.ac.createGain(); src.buffer = b; src.loop = !!loop; g.gain.value = vol; src.connect(g); g.connect(S.ac.destination);
      src.start(0); h.src = src; h.gain = g;
    });
    h.stop = function () { h.stopped = true; try { if (h.src) h.src.stop(0); } catch (e) { } };
    return h;
  }
  S.sfx = function (name) {
    if (!S.sfxOn) return;
    if (S.ac) { wstart(name, false, 0.85); return; }
    try {
      if (isWx) {
        var a = wx.createInnerAudioContext(); a.src = S.base + name + '.wav'; a.volume = 0.8;
        a.onEnded(function () { a.destroy(); }); a.onError(function () { a.destroy(); }); a.play();
      } else {
        var base = S._cache[name] || (S._cache[name] = new Audio(S.base + name + '.wav'));
        var c = base.cloneNode(); c.volume = 0.8; var p = c.play(); if (p && p.catch) p.catch(function () { });
      }
    } catch (e) { }
  };
  function playLoop(a, src, vol) {
    a.src = src; a.loop = true; a.volume = vol;
    try { var p = a.play(); if (p && p.catch) p.catch(function () { }); } catch (e) { }
  }
  function stop(a) { try { a.pause(); } catch (e) { } }
  S.setMusic = function (track) { S.track = track; S.refreshMusic(); };
  S.refreshMusic = function () {
    if (S.ac) {
      var wantA = S.musicOn && S.track;
      if (!wantA) { if (S._wm) { S._wm.stop(); S._wm = null; S._musicName = null; } return; }
      if (S._musicName === S.track && S._wm) return;
      if (S._wm) S._wm.stop();
      S._musicName = S.track; S._wm = wstart('music_' + S.track, true, 0.35); return;
    }
    var want = S.musicOn && S.track && (isWx || S.unlocked);
    if (!want) { if (S._music) { stop(S._music); S._musicName = null; } return; }
    if (!S._music) S._music = make();
    if (S._musicName === S.track) { try { var p = S._music.play(); if (p && p.catch) p.catch(function () { }); } catch (e) { } return; }
    S._musicName = S.track; playLoop(S._music, S.base + 'music_' + S.track + '.wav', 0.35);
  };
  S.setWait = function (on) {
    S.wait = on;
    var want = on && S.sfxOn && (isWx || S.unlocked);
    if (S.ac) {
      if (!want) { if (S._ww) { S._ww.stop(); S._ww = null; } return; }
      if (!S._ww) S._ww = wstart('wait', true, 0.6); return;
    }
    if (!want) { if (S._waitA && S._waitPlaying) { stop(S._waitA); S._waitPlaying = false; } return; }
    if (S._waitPlaying) return;
    if (!S._waitA) S._waitA = make();
    S._waitPlaying = true; playLoop(S._waitA, S.base + 'wait.wav', 0.6);
  };
  S.unlock = function () {
    if (AC) { // 每次点击都尝试 resume(iOS 切后台后会被挂起)
      try {
        if (!S.ac) { S.ac = new AC(); var o = S.ac.createBufferSource(); o.buffer = S.ac.createBuffer(1, 1, 22050); o.connect(S.ac.destination); o.start(0); S.preload(['click', 'place', 'start', 'win', 'lose', 'music_' + (S.track || 'calm')]); }
        if (S.ac.state !== 'running' && S.ac.resume) S.ac.resume();
      } catch (e) { S.ac = null; }
    }
    if (S.unlocked) return; S.unlocked = true; S.refreshMusic(); S.setWait(S.wait); };
  S.toggleSfx = function () { S.sfxOn = !S.sfxOn; S.storage.set('gh_sfx', S.sfxOn ? '1' : '0'); S.setWait(S.wait); if (S.sfxOn) S.sfx('click'); };
  S.toggleMusic = function () { S.musicOn = !S.musicOn; S.storage.set('gh_music', S.musicOn ? '1' : '0'); S.refreshMusic(); S.sfx('click'); };
  if (typeof module !== 'undefined' && module.exports) module.exports = S; else (self.GH = self.GH || {}).Sound = S;
})();
