"""
用 Piper 给词库批量生成发音音频。

    python -m pip install piper-tts
    cd .local/piper && python -m piper.download_voices en_GB-alba-medium
    python apps/api/scripts/vendor/build-audio.py --words .local/piper/words.txt --out .local/piper/out

## 为什么不用浏览器自带的语音合成

学生端现在调 `speechSynthesis` 指定 en-GB，但音色由设备决定：iPad 一个声音、
安卓另一个，有些机器根本没有英式语音包，退成美音甚至不发声。单词测试因此不敢
出听音题 —— 音频不可控。

Piper 是本地神经语音合成，纯 CPU，一次生成、到处播，音色永远一致。
实测这台机器 20 个词 0.6 秒，全库 4182 个词约 2 分钟。

## 许可

Piper 本身 GPL-3.0。我们只在自己机器上跑它、分发**生成出来的音频**，
不分发 Piper 本身，不构成 GPL 意义上的分发。
en_GB-alba-medium 语音模型来自 Piper 官方发布，随之而来的许可见模型卡。
"""
import argparse
import json
import sys
import wave
from pathlib import Path


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--words", required=True, help="一行一个词的文本文件")
    ap.add_argument("--out", required=True, help="音频输出目录")
    ap.add_argument("--voice", default=".local/piper/en_GB-alba-medium.onnx")
    ap.add_argument("--force", action="store_true", help="已存在也重新生成")
    args = ap.parse_args()

    try:
        from piper import PiperVoice
    except ImportError:
        print("没装 piper-tts：python -m pip install piper-tts", file=sys.stderr)
        return 1

    voice_path = Path(args.voice)
    if not voice_path.exists():
        print(f"找不到语音模型 {voice_path}", file=sys.stderr)
        print("下载：cd .local/piper && python -m piper.download_voices en_GB-alba-medium", file=sys.stderr)
        return 1

    words = [w.strip() for w in Path(args.words).read_text(encoding="utf-8").splitlines() if w.strip()]
    out_dir = Path(args.out)
    out_dir.mkdir(parents=True, exist_ok=True)

    voice = PiperVoice.load(str(voice_path))
    made, skipped, failed = 0, 0, []
    manifest = {}
    for word in words:
        # 文件名只留安全字符，词本身记在 manifest 里
        slug = "".join(ch if ch.isalnum() or ch in "-_" else "_" for ch in word.lower())
        target = out_dir / f"{slug}.wav"
        manifest[word] = target.name
        if target.exists() and not args.force:
            skipped += 1
            continue
        try:
            with wave.open(str(target), "wb") as f:
                voice.synthesize_wav(word, f)
            made += 1
        except Exception as exc:  # noqa: BLE001 - 单个词失败不该中断整批
            failed.append(f"{word}: {exc}")

    (out_dir / "manifest.json").write_text(
        json.dumps(manifest, ensure_ascii=False, indent=2), encoding="utf-8"
    )
    total_mb = sum(p.stat().st_size for p in out_dir.glob("*.wav")) / 1024 / 1024
    print(f"generated={made} skipped={skipped} failed={len(failed)} total={total_mb:.1f}MB")
    for f in failed[:10]:
        print("  !", f)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
