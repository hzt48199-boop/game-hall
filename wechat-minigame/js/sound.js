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
  S.sfx = function (name) {
    if (!S.sfxOn) return;
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
    var want = S.musicOn && S.track && (isWx || S.unlocked);
    if (!want) { if (S._music) { stop(S._music); S._musicName = null; } return; }
    if (!S._music) S._music = make();
    if (S._musicName === S.track) { try { var p = S._music.play(); if (p && p.catch) p.catch(function () { }); } catch (e) { } return; }
    S._musicName = S.track; playLoop(S._music, S.base + 'music_' + S.track + '.wav', 0.35);
  };
  S.setWait = function (on) {
    S.wait = on;
    var want = on && S.sfxOn && (isWx || S.unlocked);
    if (!want) { if (S._waitA && S._waitPlaying) { stop(S._waitA); S._waitPlaying = false; } return; }
    if (S._waitPlaying) return;
    if (!S._waitA) S._waitA = make();
    S._waitPlaying = true; playLoop(S._waitA, S.base + 'wait.wav', 0.6);
  };
  S.unlock = function () { if (S.unlocked) return; S.unlocked = true; S.refreshMusic(); S.setWait(S.wait); };
  S.toggleSfx = function () { S.sfxOn = !S.sfxOn; S.storage.set('gh_sfx', S.sfxOn ? '1' : '0'); S.setWait(S.wait); if (S.sfxOn) S.sfx('click'); };
  S.toggleMusic = function () { S.musicOn = !S.musicOn; S.storage.set('gh_music', S.musicOn ? '1' : '0'); S.refreshMusic(); S.sfx('click'); };
  if (typeof module !== 'undefined' && module.exports) module.exports = S; else (self.GH = self.GH || {}).Sound = S;
})();
