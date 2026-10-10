/* 程序化合成全部音效与背景音乐(原创,无任何第三方采样/版权素材),输出 16-bit 单声道 WAV。
   用法: node tools/genaudio.js  → 写入 web/audio 与 wechat-minigame/audio */
const fs = require('fs'), path = require('path');
const OUT = [path.join(__dirname, '../web/audio'), path.join(__dirname, '../wechat-minigame/audio')];
OUT.forEach(d => fs.mkdirSync(d, { recursive: true }));
let seed = 12345; const rand = () => (seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296 * 2 - 1;

function wav(name, samples, sr) {
  const n = samples.length, buf = Buffer.alloc(44 + n * 2);
  buf.write('RIFF', 0); buf.writeUInt32LE(36 + n * 2, 4); buf.write('WAVEfmt ', 8); buf.writeUInt32LE(16, 16);
  buf.writeUInt16LE(1, 20); buf.writeUInt16LE(1, 22); buf.writeUInt32LE(sr, 24); buf.writeUInt32LE(sr * 2, 28);
  buf.writeUInt16LE(2, 32); buf.writeUInt16LE(16, 34); buf.write('data', 36); buf.writeUInt32LE(n * 2, 40);
  for (let i = 0; i < n; i++) buf.writeInt16LE(Math.max(-32767, Math.min(32767, Math.round(samples[i] * 32767))), 44 + i * 2);
  OUT.forEach(d => fs.writeFileSync(path.join(d, name), buf));
  console.log(name, (buf.length / 1024).toFixed(0) + 'KB', (n / sr).toFixed(1) + 's');
}
function normalize(a, peak) { let m = 0; for (const v of a) m = Math.max(m, Math.abs(v)); const k = m ? peak / m : 1; for (let i = 0; i < a.length; i++) a[i] *= k; return a; }

/* ---- 音色 ---- */
function tone(buf, sr, t0, dur, freq, vol, o) { // 加法合成: 谐波 + 指数衰减
  o = o || {};
  const harm = o.harm || [1, 0.4, 0.15], atk = o.atk || 0.004, dec = o.dec || 4, glide = o.glide || 0;
  const s0 = Math.floor(t0 * sr), n = Math.floor(dur * sr); let ph = 0;
  for (let i = 0; i < n && s0 + i < buf.length; i++) {
    const t = i / sr, f = freq * (1 + glide * (1 - Math.exp(-t * 20)));
    ph += 2 * Math.PI * f / sr;
    let v = 0; for (let h = 0; h < harm.length; h++) v += harm[h] * Math.sin(ph * (h + 1));
    const env = Math.min(1, t / atk) * Math.exp(-t * dec) * (i > n - 200 ? (n - i) / 200 : 1);
    buf[s0 + i] += v * env * vol;
  }
}
function pluck(buf, sr, t0, dur, freq, vol, bright) { // Karplus-Strong 拨弦(古筝/琵琶质感)
  const N = Math.max(2, Math.round(sr / freq)), line = new Float32Array(N);
  for (let i = 0; i < N; i++) line[i] = rand();
  const s0 = Math.floor(t0 * sr), n = Math.floor(dur * sr), damp = 0.5 + (bright || 0.0) * 0.0 + 0.4985; let p = 0, prev = 0;
  for (let i = 0; i < n && s0 + i < buf.length; i++) {
    const cur = line[p], nxt = line[(p + 1) % N];
    const nv = (cur + nxt) * 0.5 * (damp > 0.999 ? 0.999 : damp);
    line[p] = nv; p = (p + 1) % N;
    const fade = i > n - 400 ? (n - i) / 400 : 1;
    buf[s0 + i] += cur * vol * fade; prev = cur;
  }
}
function noiseBurst(buf, sr, t0, dur, vol, dec, lp) {
  const s0 = Math.floor(t0 * sr), n = Math.floor(dur * sr); let y = 0;
  for (let i = 0; i < n && s0 + i < buf.length; i++) { y += (rand() - y) * (lp || 0.3); buf[s0 + i] += y * vol * Math.exp(-i / sr * dec); }
}
function reverb(a, sr, delay, fb, mix) {
  const d = Math.floor(delay * sr), out = Float32Array.from(a);
  for (let i = d; i < a.length; i++) out[i] += out[i - d] * fb;
  const r = new Float32Array(a.length); for (let i = 0; i < a.length; i++) r[i] = a[i] * (1 - mix) + out[i] * mix; return r;
}
function foldLoop(a, loopLen) { // 把超出循环长度的尾音折回开头,实现无缝循环
  const o = new Float32Array(loopLen); for (let i = 0; i < a.length; i++) o[i % loopLen] += a[i]; return o;
}

/* ---- 音效 ---- */
const SR = 22050;
function sfx(name, dur, fn) { const b = new Float32Array(Math.floor(dur * SR)); fn(b); wav(name, normalize(b, 0.85), SR); }
sfx('click.wav', 0.07, b => { tone(b, SR, 0, 0.07, 1200, 0.6, { harm: [1, 0.2], dec: 70, atk: 0.001 }); noiseBurst(b, SR, 0, 0.01, 0.2, 300, 0.6); });
sfx('place.wav', 0.25, b => { // 落子: 清脆木质"嗒"
  noiseBurst(b, SR, 0, 0.03, 0.9, 120, 0.5);
  tone(b, SR, 0, 0.25, 520, 0.8, { harm: [1, 0.5, 0.25, 0.12], dec: 22, atk: 0.0008, glide: -0.35 });
  tone(b, SR, 0, 0.18, 1560, 0.25, { harm: [1], dec: 40, atk: 0.0008 });
});
sfx('capture.wav', 0.5, b => { // 吃子/对战: 更重的撞击 + 噪声
  noiseBurst(b, SR, 0, 0.12, 1.0, 35, 0.35);
  tone(b, SR, 0, 0.45, 150, 1.0, { harm: [1, 0.6, 0.3], dec: 9, atk: 0.001, glide: -0.45 });
  tone(b, SR, 0.0, 0.2, 700, 0.35, { harm: [1, 0.5], dec: 28, atk: 0.001 });
  tone(b, SR, 0.08, 0.3, 330, 0.3, { dec: 14 });
});
sfx('wait.wav', 2.0, b => { // 等待循环: 轻柔"嘀—嗒"节拍,可无缝循环
  [0, 1.0].forEach(t => { tone(b, SR, t, 0.12, 880, 0.5, { harm: [1, 0.25], dec: 28, atk: 0.002 }); tone(b, SR, t + 0.5, 0.12, 660, 0.35, { harm: [1, 0.2], dec: 28, atk: 0.002 }); });
});
sfx('start.wav', 1.1, b => { // 开局: 上行三音(D 五声音阶)
  [[293.66, 0], [440, 0.16], [587.33, 0.32]].forEach(([f, t]) => tone(b, SR, t, 0.7, f, 0.6, { harm: [1, 0.5, 0.2, 0.08], dec: 3.5, atk: 0.004 }));
  tone(b, SR, 0.32, 0.8, 880, 0.2, { dec: 4 });
});
sfx('end.wav', 1.0, b => { [[440, 0], [330, 0.22]].forEach(([f, t]) => tone(b, SR, t, 0.7, f, 0.6, { harm: [1, 0.4, 0.15], dec: 4.5 })); });
sfx('win.wav', 2.2, b => { // 胜利: 明亮上行琶音 + 收尾和弦
  const notes = [293.66, 370, 440, 587.33, 740, 880];
  notes.forEach((f, i) => tone(b, SR, i * 0.12, 0.9, f, 0.5, { harm: [1, 0.5, 0.25, 0.1], dec: 3, atk: 0.003 }));
  [587.33, 740, 880, 1174.66].forEach(f => tone(b, SR, 0.8, 1.3, f, 0.35, { harm: [1, 0.4, 0.15], dec: 2.2 }));
});
sfx('lose.wav', 2.0, b => { // 失败: 下行小调叹息
  [[392, 0], [349.23, 0.28], [311.13, 0.56], [233.08, 0.9]].forEach(([f, t], i) => tone(b, SR, t, 1.0, f, 0.55, { harm: [1, 0.35, 0.1], dec: i === 3 ? 2 : 4, atk: 0.01 }));
});


/* ---- 第二期新增音效(斗地主 / 麻将),16kHz ---- */
const SR2 = 16000;
function sfx2(name, dur, fn) { const b = new Float32Array(Math.floor(dur * SR2)); fn(b); wav(name, normalize(b, 0.85), SR2); }
sfx2('deal.wav', 0.8, b => { for (let i = 0; i < 9; i++) { noiseBurst(b, SR2, i * 0.07, 0.04, 0.8, 90, 0.55); tone(b, SR2, i * 0.07, 0.05, 900 + i * 40, 0.15, { harm: [1], dec: 60, atk: 0.001 }); } }); // 发牌: 一串快速"嗖嗖"
sfx2('cardplay.wav', 0.22, b => { noiseBurst(b, SR2, 0, 0.05, 0.9, 80, 0.7); tone(b, SR2, 0, 0.2, 240, 0.6, { harm: [1, 0.4], dec: 22, atk: 0.001, glide: -0.3 }); });
sfx2('bomb.wav', 1.2, b => { noiseBurst(b, SR2, 0, 0.9, 1.0, 5, 0.12); tone(b, SR2, 0, 1.0, 90, 1.0, { harm: [1, 0.6, 0.3], dec: 3.5, atk: 0.002, glide: -0.5 }); noiseBurst(b, SR2, 0, 0.12, 1.0, 40, 0.6); });
sfx2('rocket.wav', 1.6, b => { // 火箭: 上升啸叫 + 尾端爆炸
  let ph = 0; const n = Math.floor(1.0 * SR2); for (let i = 0; i < n; i++) { const t = i / n, f = 250 + 1800 * t * t; ph += 2 * Math.PI * f / SR2; b[i] += Math.sin(ph) * 0.35 * Math.min(1, t * 8) + rand() * 0.15 * t; }
  noiseBurst(b, SR2, 1.0, 0.6, 1.0, 6, 0.2); tone(b, SR2, 1.0, 0.6, 80, 0.9, { harm: [1, 0.5], dec: 5, atk: 0.002 });
});
sfx2('pass.wav', 0.35, b => { [[392, 0], [294, 0.12]].forEach(([f, t]) => tone(b, SR2, t, 0.2, f, 0.5, { harm: [1, 0.3], dec: 9, atk: 0.004 })); });
sfx2('bid.wav', 0.4, b => { tone(b, SR2, 0, 0.4, 880, 0.5, { harm: [1, 0.3, 0.1], dec: 7, atk: 0.002 }); tone(b, SR2, 0, 0.4, 1320, 0.2, { dec: 9 }); });
sfx2('tiledraw.wav', 0.12, b => { noiseBurst(b, SR2, 0, 0.02, 0.5, 200, 0.6); tone(b, SR2, 0, 0.1, 1100, 0.3, { harm: [1], dec: 50, atk: 0.001 }); });
sfx2('tilediscard.wav', 0.3, b => { noiseBurst(b, SR2, 0, 0.04, 1.0, 100, 0.45); tone(b, SR2, 0, 0.28, 330, 0.9, { harm: [1, 0.6, 0.3], dec: 18, atk: 0.0008, glide: -0.25 }); tone(b, SR2, 0.01, 0.1, 1700, 0.2, { dec: 45 }); });
sfx2('pong.wav', 0.55, b => { [0, 0.11].forEach(t => { noiseBurst(b, SR2, t, 0.04, 0.9, 100, 0.5); tone(b, SR2, t, 0.2, 360, 0.8, { harm: [1, 0.5], dec: 16, atk: 0.001 }); }); tone(b, SR2, 0.22, 0.3, 660, 0.4, { harm: [1, 0.3], dec: 8 }); });
sfx2('kong.wav', 0.9, b => { [0, 0.1, 0.2].forEach(t => { noiseBurst(b, SR2, t, 0.04, 0.9, 100, 0.5); tone(b, SR2, t, 0.18, 330, 0.7, { dec: 18 }); }); tone(b, SR2, 0.32, 0.55, 110, 0.9, { harm: [1, 0.7, 0.5, 0.3], dec: 3.5, atk: 0.004 }); });
sfx2('chi.wav', 0.4, b => { [[523, 0], [659, 0.1]].forEach(([f, t]) => { noiseBurst(b, SR2, t, 0.03, 0.5, 120, 0.5); tone(b, SR2, t, 0.25, f, 0.55, { harm: [1, 0.4], dec: 8, atk: 0.002 }); }); });
sfx2('hu.wav', 2.0, b => { // 胡牌: 鞭炮 + 欢快上行琶音
  for (let i = 0; i < 14; i++) noiseBurst(b, SR2, i * 0.045, 0.03, 0.9, 120, 0.7);
  [392, 494, 587, 784, 988, 1175].forEach((f, i) => tone(b, SR2, 0.5 + i * 0.1, 0.9, f, 0.5, { harm: [1, 0.5, 0.2], dec: 3, atk: 0.003 }));
  [784, 988, 1175].forEach(f => tone(b, SR2, 1.1, 0.8, f, 0.35, { harm: [1, 0.4], dec: 2.5 }));
});

/* ---- 背景音乐 ---- */
const MSR = 12000; // 背景音乐采样率(12kHz,压缩体积以满足小游戏主包 4MB 限制)
function freqOf(base, ratios, idx) { const L = ratios.length, oct = Math.floor(idx / L), k = ((idx % L) + L) % L; return base * Math.pow(2, oct) * ratios[k]; }
function render(bpm, bars, build) {
  const beat = 60 / bpm, loop = Math.round(bars * 4 * beat * MSR), buf = new Float32Array(loop + MSR * 4);
  build(buf, beat); return foldLoop(buf, loop);
}
// 象棋/军棋: D 宫调式五声(D E F# A B),古筝拨弦 + 低音琶音,节奏舒缓
function chineseTrack() {
  const R = [1, 9 / 8, 5 / 4, 3 / 2, 5 / 3], base = 293.66 / 2; // D3 为 idx0
  const mel = [
    [[5, 1.5], [6, .5], [7, 1], [5, 1]], [[4, 1], [3, 1], [2, 2]], [[3, 1.5], [4, .5], [5, 1], [3, 1]], [[2, 1], [1, 1], [0, 2]],
    [[2, 1], [3, 1], [4, 1], [5, 1]], [[7, 2], [6, 1], [5, 1]], [[6, 1.5], [5, .5], [4, 1], [3, 1]], [[4, 1], [2, 1], [3, 2]],
    [[5, 1.5], [6, .5], [7, 1], [9, 1]], [[8, 1], [7, 1], [5, 2]], [[4, 1], [3, 1], [2, 1], [1, 1]], [[0, 4]]
  ];
  const roots = [0, -2, 0, -2, 1, 0, -2, 0, 0, -2, 1, 0]; // 每小节低音根音(五声音阶内)
  const buf = render(84, 12, (b, beat) => {
    mel.forEach((bar, bi) => {
      let t = bi * 4 * beat;
      bar.forEach(([deg, len]) => {
        const f = freqOf(base, R, deg + 5);
        pluck(b, MSR, t, len * beat * 1.6, f, 0.55);
        if (len >= 2) { pluck(b, MSR, t + beat * 0.5, len * beat, f * 1.0, 0.18); }
        t += len * beat;
      });
      const r = roots[bi];
      [0, 2, 3, 5, 3, 2, 0, 2].forEach((o, k) => pluck(b, MSR, bi * 4 * beat + k * beat * 0.5, beat * 1.8, freqOf(base, R, r + o), 0.22));
      // 轻木鱼点缀
      noiseBurst(b, MSR, bi * 4 * beat, 0.03, 0.05, 150, 0.5); noiseBurst(b, MSR, bi * 4 * beat + 2 * beat, 0.03, 0.04, 150, 0.5);
    });
  });
  return normalize(reverb(buf, MSR, 0.13, 0.35, 0.45), 0.6);
}
// 五子棋: C 大调五声(C D E G A),柔和电钢琴式音色,轻松舒缓
function calmTrack() {
  const R = [1, 9 / 8, 5 / 4, 3 / 2, 5 / 3], base = 261.63;
  const chords = [[0, 2, 3], [-1, 1, 2], [-2, 0, 1], [-1, 0, 3]].map(c => c); // 近似 C / Am / F-ish / G-ish 的五声和声
  const mel = [
    [[2, 1], [3, 1], [4, 2]], [[3, 1.5], [2, .5], [1, 2]], [[2, 1], [1, 1], [0, 2]], [[1, 2], [2, 2]],
    [[3, 1], [4, 1], [5, 2]], [[4, 1.5], [3, .5], [2, 2]], [[3, 1], [2, 1], [1, 1], [0, 1]], [[0, 4]]
  ];
  const buf = render(76, 12, (b, beat) => {
    for (let bar = 0; bar < 12; bar++) {
      const ch = chords[[0, 1, 2, 3][bar % 4]], t0 = bar * 4 * beat;
      ch.forEach((d, k) => { for (let rep = 0; rep < 2; rep++) tone(b, MSR, t0 + (k + rep * 3) * beat * 0.5, beat * 2.2, freqOf(base / 2, R, d + 0), 0.16, { harm: [1, 0.3], dec: 2.2, atk: 0.01 }); });
      tone(b, MSR, t0, beat * 3.5, freqOf(base / 4, R, ch[0]), 0.2, { harm: [1, 0.2], dec: 1, atk: 0.03 });
      const m = mel[bar % 8];
      let t = t0; m.forEach(([deg, len]) => { tone(b, MSR, t, len * beat * 1.4, freqOf(base, R, deg + (bar >= 8 ? 1 : 0)), 0.4, { harm: [1, 0.35, 0.1], dec: 2.8, atk: 0.006 }); t += len * beat; });
    }
  });
  return normalize(reverb(buf, MSR, 0.16, 0.3, 0.4), 0.55);
}

// 斗地主: C 大调五声,明快切分节奏(pluck 旋律 + 弹跳低音 + 轻打击),112bpm,8 小节
function livelyTrack() {
  const R = [1, 9 / 8, 5 / 4, 3 / 2, 5 / 3], base = 261.63;
  const mel = [
    [[4, 0.5], [5, 0.5], [4, 1], [3, 1], [2, 1]], [[3, 1], [2, 0.5], [3, 0.5], [4, 2]], [[5, 0.5], [6, 0.5], [5, 1], [4, 1], [3, 1]], [[4, 1], [3, 1], [2, 2]],
    [[2, 0.5], [3, 0.5], [4, 1], [6, 1], [5, 1]], [[4, 1], [5, 1], [6, 2]], [[7, 0.5], [6, 0.5], [5, 1], [4, 1], [3, 1]], [[2, 1], [3, 1], [0, 2]]
  ];
  const roots = [0, -2, -3, -1, 0, -2, -1, 0];
  const buf = render(112, 8, (b, beat) => {
    mel.forEach((bar, bi) => {
      let t = bi * 4 * beat;
      bar.forEach(([deg, len]) => { pluck(b, MSR, t, len * beat * 1.4, freqOf(base, R, deg), 0.5); t += len * beat; });
      const r = roots[bi];
      [0, 1.5, 2, 3.5].forEach((o, k) => tone(b, MSR, bi * 4 * beat + o * beat, beat * 0.9, freqOf(base / 2, R, r + (k % 2 ? 2 : 0)), 0.22, { harm: [1, 0.4], dec: 4, atk: 0.005 }));
      for (let q = 0; q < 4; q++) { noiseBurst(b, MSR, bi * 4 * beat + q * beat, 0.03, q % 2 ? 0.08 : 0.12, 120, 0.5); noiseBurst(b, MSR, bi * 4 * beat + (q + 0.5) * beat, 0.015, 0.04, 200, 0.6); }
    });
  });
  return normalize(reverb(buf, MSR, 0.12, 0.28, 0.35), 0.55);
}
wav('music_chinese.wav', chineseTrack(), MSR);
wav('music_lively.wav', livelyTrack(), MSR);
wav('music_calm.wav', calmTrack(), MSR);

/* ---- 第三期新增音效(炸金花,16kHz;放在文件末尾,不改变既有音频的随机序列) ---- */
sfx2('chips.wav', 0.45, b => { for (let i = 0; i < 4; i++) { const t = i * 0.06; noiseBurst(b, SR2, t, 0.02, 0.6, 250, 0.7); tone(b, SR2, t, 0.14, 2200 + i * 260, 0.35, { harm: [1, 0.5, 0.3], dec: 28, atk: 0.0008 }); tone(b, SR2, t, 0.1, 3300 + i * 120, 0.15, { harm: [1], dec: 40, atk: 0.0008 }); } }); // 下注: 一串清脆碰撞
sfx2('fold.wav', 0.5, b => { noiseBurst(b, SR2, 0, 0.18, 0.5, 14, 0.15); tone(b, SR2, 0, 0.35, 300, 0.4, { harm: [1, 0.3], dec: 10, atk: 0.004, glide: -0.4 }); tone(b, SR2, 0.12, 0.3, 200, 0.35, { harm: [1], dec: 12, atk: 0.004, glide: -0.3 }); }); // 弃牌: 牌被扣下的沉闷滑动
sfx2('compare.wav', 0.9, b => { [0, 0.16].forEach((t, i) => { noiseBurst(b, SR2, t, 0.04, 0.9, 90, 0.5); tone(b, SR2, t, 0.3, i ? 520 : 390, 0.7, { harm: [1, 0.5, 0.25], dec: 9, atk: 0.001 }); }); tone(b, SR2, 0.34, 0.5, 780, 0.45, { harm: [1, 0.4], dec: 5, atk: 0.003 }); tone(b, SR2, 0.34, 0.5, 1170, 0.2, { dec: 6 }); }); // 比牌: 两下碰牌 + 亮音
sfx2('look.wav', 0.3, b => { noiseBurst(b, SR2, 0, 0.06, 0.45, 60, 0.35); noiseBurst(b, SR2, 0.09, 0.05, 0.6, 90, 0.6); tone(b, SR2, 0.09, 0.15, 700, 0.25, { harm: [1], dec: 30, atk: 0.001, glide: 0.3 }); }); // 看牌: 掀牌的"沙—啪"

/* ---- 第四期新增: 洗牌 / 催促 / 笑声"哈哈" / 叹气"唉"(共振峰合成,16kHz;追加在末尾,不改变既有音频随机序列) ---- */
function formantVoice(b, sr, t0, dur, f0Fn, formFn, vol, breath) { // 声门脉冲串 → 并联二阶带通共振峰
  const s0 = Math.floor(t0 * sr), n = Math.floor(dur * sr);
  const st = [0, 0, 0].map(() => [0, 0]); let ph = 0;
  for (let i = 0; i < n && s0 + i < b.length; i++) {
    const t = i / n, f0 = f0Fn(t); ph += f0 / sr; if (ph >= 1) ph -= 1;
    const glot = (ph < 0.4 ? Math.sin(Math.PI * ph / 0.4) : 0) - 0.3 + (breath || 0) * rand() * 0.5; // 近似声门波 + 气声
    const F = formFn(t); let y = 0;
    for (let k = 0; k < 3; k++) {
      const fc = F[k][0], bw = F[k][1], r = Math.exp(-Math.PI * bw / sr), c = 2 * r * Math.cos(2 * Math.PI * fc / sr);
      const o = glot * (1 - r) + c * st[k][0] - r * r * st[k][1]; st[k][1] = st[k][0]; st[k][0] = o; y += o * F[k][2];
    }
    const env = Math.min(1, i / (0.02 * sr)) * Math.min(1, (n - i) / (0.06 * sr));
    b[s0 + i] += y * env * vol;
  }
}
sfx2('shuffle.wav', 1.3, b => { // 洗牌: 两叠牌哗啦交错 + 收拢"啪"
  for (let i = 0; i < 46; i++) { const t = i * 0.020 + rand() * 0.006, v = 0.35 + 0.4 * Math.sin(Math.PI * i / 46); noiseBurst(b, SR2, t, 0.02, v, 160, 0.55 + 0.3 * rand()); }
  noiseBurst(b, SR2, 1.05, 0.05, 0.9, 80, 0.5); tone(b, SR2, 1.05, 0.2, 200, 0.5, { harm: [1, 0.4], dec: 25, atk: 0.001, glide: -0.3 });
});
sfx2('urge.wav', 0.9, b => { [0, 0.3, 0.6].forEach(t => { tone(b, SR2, t, 0.14, 1250, 0.55, { harm: [1, 0.35], dec: 22, atk: 0.002 }); tone(b, SR2, t, 0.1, 1900, 0.18, { dec: 30 }); }); }); // 催促: 三声急促"嘟嘟嘟"
sfx2('laugh.wav', 1.5, b => { // 哈哈哈: 4 声递减、音高下落的"啊"
  const A = [[800, 90, 1], [1250, 110, 0.6], [2600, 160, 0.25]];
  [0, 0.3, 0.58, 0.84].forEach((t, i) => formantVoice(b, SR2, t, 0.2, u => (300 - i * 12) * (1 - 0.12 * u) , () => A, 0.7 - i * 0.1, 1.2));
  [0, 0.3, 0.58, 0.84].forEach((t, i) => noiseBurst(b, SR2, t, 0.05, 0.12 - i * 0.02, 60, 0.7));
});
sfx2('sigh.wav', 1.4, b => { // 唉: 由"啊"滑向"咿"的下落叹息 + 气声
  formantVoice(b, SR2, 0, 1.2, u => 250 - 80 * u, u => [[800 - 480 * u, 100, 1], [1200 + 900 * u, 120, 0.6], [2600 + 100 * u, 170, 0.25]], 0.75, 2.2);
});

/* ---- Phase 4 additions: International Chess + Texas Hold'em (appended at the end so earlier sounds stay identical) ---- */
sfx2('chessmove.wav', 0.28, b => { noiseBurst(b, SR2, 0, 0.03, 0.8, 120, 0.5); tone(b, SR2, 0, 0.26, 190, 0.9, { harm: [1, 0.6, 0.25], dec: 20, atk: 0.0008, glide: -0.2 }); }); // piece set down on a wooden board
sfx2('chesscap.wav', 0.5, b => { noiseBurst(b, SR2, 0, 0.05, 1.0, 70, 0.4); tone(b, SR2, 0, 0.3, 150, 1.0, { harm: [1, 0.7, 0.4], dec: 14, atk: 0.0008, glide: -0.3 }); noiseBurst(b, SR2, 0.09, 0.04, 0.7, 90, 0.5); tone(b, SR2, 0.09, 0.3, 230, 0.6, { harm: [1, 0.5], dec: 16, atk: 0.001 }); }); // capture: two stacked knocks
sfx2('chesscheck.wav', 0.7, b => { [0, 0.16].forEach((t, i) => { tone(b, SR2, t, 0.3, i ? 988 : 740, 0.6, { harm: [1, 0.4, 0.15], dec: 9, atk: 0.002 }); }); noiseBurst(b, SR2, 0, 0.03, 0.5, 120, 0.5); tone(b, SR2, 0.32, 0.35, 1175, 0.35, { harm: [1, 0.3], dec: 8, atk: 0.002 }); }); // check / checkmate alert
sfx2('knock.wav', 0.36, b => { [0, 0.14].forEach(t => { noiseBurst(b, SR2, t, 0.025, 0.7, 150, 0.5); tone(b, SR2, t, 0.16, 210, 0.8, { harm: [1, 0.5], dec: 22, atk: 0.0006, glide: -0.15 }); }); }); // check: two knuckle raps on the table
sfx2('allin.wav', 1.0, b => { for (let i = 0; i < 9; i++) { const t = i * 0.055; noiseBurst(b, SR2, t, 0.02, 0.55, 250, 0.7); tone(b, SR2, t, 0.14, 1800 + i * 210, 0.3, { harm: [1, 0.5, 0.3], dec: 26, atk: 0.0008 }); } tone(b, SR2, 0.55, 0.45, 392, 0.5, { harm: [1, 0.4, 0.2], dec: 5, atk: 0.003 }); tone(b, SR2, 0.55, 0.45, 587, 0.35, { harm: [1, 0.3], dec: 5, atk: 0.003 }); }); // all-in: big chip cascade + swell
sfx2('flip.wav', 0.3, b => { noiseBurst(b, SR2, 0, 0.07, 0.6, 45, 0.25); noiseBurst(b, SR2, 0.08, 0.04, 0.8, 110, 0.6); tone(b, SR2, 0.08, 0.14, 520, 0.2, { harm: [1], dec: 30, atk: 0.001, glide: -0.3 }); }); // community card turned over
sfx2('potwin.wav', 1.2, b => { for (let i = 0; i < 6; i++) { const t = i * 0.07; noiseBurst(b, SR2, t, 0.02, 0.5, 250, 0.7); tone(b, SR2, t, 0.12, 2400 - i * 120, 0.3, { harm: [1, 0.5], dec: 30, atk: 0.0008 }); } [523, 659, 784].forEach((f, i) => tone(b, SR2, 0.45 + i * 0.1, 0.55, f, 0.5, { harm: [1, 0.4, 0.15], dec: 4.5, atk: 0.003 })); }); // winning the pot: chips sweep + chime
