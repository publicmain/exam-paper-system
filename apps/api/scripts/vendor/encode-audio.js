/**
 * Piper 生成的 WAV → MP3（2026-09-10）。
 *
 *     npm i --no-save lamejs@1.2.1   # 装完别提交，只在这台机器用
 *     node apps/api/scripts/vendor/encode-audio.js --in .local/piper/out --out .local/piper/mp3
 *
 * 为什么要转：4181 个 WAV 共 140 MB（22050 Hz 单声道 16 bit），塞进 Postgres
 * 不合适。MP3 48 kbps 单声道一个词约 5 KB，全库 25 MB 上下。
 *
 * 为什么用 lamejs 不用 ffmpeg：这台机器没有 ffmpeg，lamejs 是纯 JS 的 LAME，
 * 4181 个一秒的音频几十秒就编完，不用装东西。
 *
 * lamejs 1.2.1 在 Node 里直接跑会 `MPEGMode is not defined` —— 它的几个内部
 * 模块互相靠全局变量找对方（浏览器打包时才有）。下面先把那三个挂到 global 上，
 * 这是它 issue 里给的标准解法。
 *
 * 输出目录里带一份 manifest.json（headword → 文件名），upload-audio.ts 照着它上传。
 */
const fs = require('fs');
const path = require('path');

const arg = (name, dflt) => {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : dflt;
};
const IN = path.resolve(arg('in', '.local/piper/out'));
const OUT = path.resolve(arg('out', '.local/piper/mp3'));
const KBPS = Number(arg('kbps', '48'));

let lamejs;
try {
  global.MPEGMode = require('lamejs/src/js/MPEGMode');
  global.Lame = require('lamejs/src/js/Lame');
  global.BitStream = require('lamejs/src/js/BitStream');
  lamejs = require('lamejs');
} catch (e) {
  console.error('缺 lamejs：npm i --no-save lamejs@1.2.1 ——', e.message);
  process.exit(1);
}

/** 只认 PCM 16 bit 的 WAV；Piper 出的就是这种。 */
function parseWav(buf) {
  if (buf.toString('ascii', 0, 4) !== 'RIFF' || buf.toString('ascii', 8, 12) !== 'WAVE') {
    throw new Error('不是 WAV');
  }
  let off = 12;
  let fmt = null;
  let data = null;
  while (off + 8 <= buf.length) {
    const id = buf.toString('ascii', off, off + 4);
    const size = buf.readUInt32LE(off + 4);
    const start = off + 8;
    if (id === 'fmt ') {
      fmt = {
        format: buf.readUInt16LE(start),
        channels: buf.readUInt16LE(start + 2),
        sampleRate: buf.readUInt32LE(start + 4),
        bits: buf.readUInt16LE(start + 14),
      };
    } else if (id === 'data') {
      data = buf.subarray(start, start + size);
    }
    off = start + size + (size % 2);
  }
  if (!fmt || !data) throw new Error('WAV 缺 fmt 或 data');
  if (fmt.format !== 1 || fmt.bits !== 16) throw new Error(`只支持 PCM16，拿到 format=${fmt.format} bits=${fmt.bits}`);
  return { ...fmt, data };
}

function toMono16(data, channels) {
  // Buffer 可能不是 2 字节对齐，拷一份再套 Int16Array
  const aligned = Buffer.from(data);
  const all = new Int16Array(aligned.buffer, aligned.byteOffset, aligned.length / 2);
  if (channels === 1) return all;
  const mono = new Int16Array(all.length / channels);
  for (let i = 0; i < mono.length; i += 1) {
    let sum = 0;
    for (let c = 0; c < channels; c += 1) sum += all[i * channels + c];
    mono[i] = sum / channels;
  }
  return mono;
}

function encodeMp3(samples, sampleRate) {
  const enc = new lamejs.Mp3Encoder(1, sampleRate, KBPS);
  const block = 1152;
  const parts = [];
  for (let i = 0; i < samples.length; i += block) {
    const chunk = samples.subarray(i, i + block);
    const out = enc.encodeBuffer(chunk);
    if (out.length) parts.push(Buffer.from(out));
  }
  const tail = enc.flush();
  if (tail.length) parts.push(Buffer.from(tail));
  return Buffer.concat(parts);
}

(function main() {
  const manifestPath = path.join(IN, 'manifest.json');
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  fs.mkdirSync(OUT, { recursive: true });
  const outManifest = {};
  let done = 0;
  let bytes = 0;
  const t0 = Date.now();
  for (const [headword, wavName] of Object.entries(manifest)) {
    const wav = parseWav(fs.readFileSync(path.join(IN, wavName)));
    const mp3 = encodeMp3(toMono16(wav.data, wav.channels), wav.sampleRate);
    const name = wavName.replace(/\.wav$/i, '.mp3');
    fs.writeFileSync(path.join(OUT, name), mp3);
    outManifest[headword] = name;
    bytes += mp3.length;
    done += 1;
    if (done % 500 === 0) console.log(`  ${done}/${Object.keys(manifest).length}`);
  }
  fs.writeFileSync(path.join(OUT, 'manifest.json'), JSON.stringify(outManifest, null, 0));
  console.log(
    `完成：${done} 个词，${(bytes / 1024 / 1024).toFixed(1)} MB（平均 ${(bytes / done / 1024).toFixed(1)} KB/词），${((Date.now() - t0) / 1000).toFixed(0)} 秒`,
  );
})();
