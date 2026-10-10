const test = require('node:test'), assert = require('node:assert'), fs = require('fs'), path = require('path');
const need = ['click', 'place', 'capture', 'wait', 'start', 'end', 'win', 'lose', 'music_chinese', 'music_calm', 'music_lively', 'deal', 'cardplay', 'bomb', 'rocket', 'pass', 'bid', 'tiledraw', 'tilediscard', 'pong', 'kong', 'chi', 'hu', 'chips', 'fold', 'compare', 'look', 'shuffle', 'urge', 'laugh', 'chessmove', 'chesscap', 'chesscheck', 'knock', 'allin', 'flip', 'potwin', 'sigh'];
for (const dir of ['web/audio', 'wechat-minigame/audio']) test('音频资源齐全且是合法 WAV: ' + dir, () => {
  for (const n of need) {
    const b = fs.readFileSync(path.join(__dirname, '..', dir, n + '.wav'));
    assert.equal(b.toString('latin1', 0, 4), 'RIFF'); assert.equal(b.toString('latin1', 8, 12), 'WAVE');
    assert.equal(b.readUInt16LE(34), 16); assert.equal(b.readUInt32LE(40), b.length - 44);
    let peak = 0; for (let i = 44; i < b.length; i += 2) peak = Math.max(peak, Math.abs(b.readInt16LE(i))); assert.ok(peak > 3000, n + ' 不应是静音');
  }
});
test('微信小游戏工程结构', () => {
  const r = p => path.join(__dirname, '..', 'wechat-minigame', p);
  assert.equal(JSON.parse(fs.readFileSync(r('project.config.json'))).appid, 'touristappid');
  assert.equal(JSON.parse(fs.readFileSync(r('project.config.json'))).compileType, 'game');
  JSON.parse(fs.readFileSync(r('game.json'))); assert.ok(fs.existsSync(r('game.js')));
  for (const f of ['app', 'net', 'sound', 'boards', 'cardboards', 'aiclient', 'ai', 'ai-gomoku', 'ai-xiangqi', 'ai-luzhanqi', 'ai-doudizhu', 'ai-mahjong', 'engines', 'gomoku', 'xiangqi', 'luzhanqi', 'doudizhu', 'mahjong', 'zhajinhua', 'ai-zhajinhua', 'chess', 'holdem', 'ai-chess', 'ai-holdem', 'i18n', 'config']) assert.ok(fs.existsSync(r('js/' + f + '.js')), f);
});
test('wechat 与 web 的共享代码与源码一致(已执行 build)', () => {
  for (const d of ['shared', 'client']) for (const f of fs.readdirSync(path.join(__dirname, '..', d))) for (const t of ['web/js', 'wechat-minigame/js'])
    assert.equal(fs.readFileSync(path.join(__dirname, '..', d, f), 'utf8'), fs.readFileSync(path.join(__dirname, '..', t, f), 'utf8'), t + '/' + f);
});

test('AI Worker 包已生成(网页与小游戏)', () => {
  for (const f of ['web/js/ai-worker.js', 'wechat-minigame/workers/ai.js']) { const t = fs.readFileSync(path.join(__dirname, '..', f), 'utf8'); assert.ok(t.includes('ai-doudizhu') && t.includes('ai-mahjong') && t.includes('ai-zhajinhua') && t.includes('computeMove')); new Function(t.replace(/worker\.onMessage/, '(function(){})')); }
  assert.equal(JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'wechat-minigame/game.json'))).workers, 'workers');
});
test('web 页面引用了全部脚本', () => {
  const html = fs.readFileSync(path.join(__dirname, '..', 'web/index.html'), 'utf8');
  for (const f of ['doudizhu', 'mahjong', 'zhajinhua', 'ai-zhajinhua', 'chess', 'holdem', 'ai-chess', 'ai-holdem', 'i18n', 'ai-gomoku', 'ai-xiangqi', 'ai-luzhanqi', 'ai-doudizhu', 'ai-mahjong', 'aiclient', 'cardboards']) assert.ok(html.includes('js/' + f + '.js'), f);
});

test('小游戏包体积 < 4MB,且 UI 源码无真钱 / 充值 / 提现等字样,并带有虚拟积分声明', () => {
  const walk = d => fs.readdirSync(d, { withFileTypes: true }).reduce((a, e) => a + (e.isDirectory() ? walk(path.join(d, e.name)) : fs.statSync(path.join(d, e.name)).size), 0);
  const size = walk(path.join(__dirname, '..', 'wechat-minigame')); assert.ok(size < 4 * 1024 * 1024, '体积 ' + size);
  const ui = fs.readFileSync(path.join(__dirname, '..', 'client/app.js'), 'utf8') + fs.readFileSync(path.join(__dirname, '..', 'client/cardboards.js'), 'utf8');
  assert.ok(ui.includes('For entertainment only, virtual chips, no cash value, not redeemable'));
  for (const w of ['真钱', '人民币', '现金', '提现', '充值', '购买', '赌', '押注', '筹码币']) assert.ok(!ui.includes(w), '界面源码不应出现: ' + w);
});
