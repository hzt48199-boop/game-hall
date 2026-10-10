/* 微信小游戏入口: 仅使用 Canvas 2D、wx.connectSocket、wx.createInnerAudioContext、wx storage */
var info = wx.getSystemInfoSync();
var dpr = info.pixelRatio || 1;
var canvas = wx.createCanvas();
canvas.width = info.windowWidth * dpr; canvas.height = info.windowHeight * dpr;
var ctx = canvas.getContext('2d');
ctx.scale(dpr, dpr);
var CFG = require('./js/config.js');
var App = require('./js/app.js').App;
var app = new App({
  canvas: canvas, ctx: ctx,
  getSize: function () { return { w: info.windowWidth, h: info.windowHeight }; },
  storage: { get: function (k) { try { return wx.getStorageSync(k) || null; } catch (e) { return null; } }, set: function (k, v) { try { wx.setStorageSync(k, v); } catch (e) { } } },
  createImage: function () { return wx.createImage(); }, logoBase: 'images/',
  raf: function (f) { requestAnimationFrame(f); },
  serverUrl: function () { return CFG.serverUrl; }
});
wx.onTouchStart(function (e) { var t = e.touches[0]; app.tap(t.clientX, t.clientY); });
wx.onShow && wx.onShow(function () { app.dirty = true; });
