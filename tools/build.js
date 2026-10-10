/* 把 shared/ 与 client/ 的源码复制到 web/js 与 wechat-minigame/js(config.js 与入口文件除外),
   并生成 AI Worker 包: web/js/ai-worker.js 与 wechat-minigame/workers/ai.js。用法: node tools/build.js */
const fs = require('fs'), path = require('path');
const root = path.join(__dirname, '..');
for (const target of ['web/js', 'wechat-minigame/js']) {
  fs.mkdirSync(path.join(root, target), { recursive: true });
  for (const dir of ['shared', 'client']) for (const f of fs.readdirSync(path.join(root, dir))) if (f.endsWith('.js')) fs.copyFileSync(path.join(root, dir, f), path.join(root, target, f));
}
// ---- AI Worker 包(把规则引擎 + 全部 AI 打成一个脚本,避免依赖 require)----
const order = ['gomoku', 'xiangqi', 'luzhanqi', 'doudizhu', 'mahjong', 'zhajinhua', 'chess', 'holdem', 'engines', 'ai-gomoku', 'ai-xiangqi', 'ai-luzhanqi', 'ai-doudizhu', 'ai-mahjong', 'ai-zhajinhua', 'ai-chess', 'ai-holdem', 'ai'];
const body = order.map(n => '/* ---- ' + n + ' ---- */\n' + fs.readFileSync(path.join(root, 'shared', n + '.js'), 'utf8')).join('\n');
function bundle(glue) {
  return '/* 自动生成(tools/build.js): AI Worker 包 */\n(function () {\n  var GH = {}, self = { GH: GH }, require, module, exports;\n' + body + '\n' + glue + '\n})();\n';
}
const webGlue = `  var G = (typeof globalThis !== 'undefined' ? globalThis : this);
  G.onmessage = function (e) {
    var m = e.data, mv = null, err = null;
    try { mv = GH.AI.computeMove(m.game, m.state, m.seat, m.level, m.opts); } catch (x) { err = String(x && x.stack || x); }
    G.postMessage({ id: m.id, mv: mv, err: err });
  };`;
const wxGlue = `  worker.onMessage(function (m) {
    var mv = null, err = null;
    try { mv = GH.AI.computeMove(m.game, m.state, m.seat, m.level, m.opts); } catch (x) { err = String(x && x.stack || x); }
    worker.postMessage({ id: m.id, mv: mv, err: err });
  });`;
fs.writeFileSync(path.join(root, 'web/js/ai-worker.js'), bundle(webGlue));
fs.mkdirSync(path.join(root, 'wechat-minigame/workers'), { recursive: true });
fs.writeFileSync(path.join(root, 'wechat-minigame/workers/ai.js'), bundle(wxGlue));
// game.json 声明 workers 目录
const gj = path.join(root, 'wechat-minigame/game.json'), j = JSON.parse(fs.readFileSync(gj, 'utf8'));
if (j.workers !== 'workers') { j.workers = 'workers'; fs.writeFileSync(gj, JSON.stringify(j, null, 2) + '\n'); }
console.log('build ok');
