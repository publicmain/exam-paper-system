"""Offline Piper -> MP3; no database/network/service calls.

First prepare a week directory or exported article JSON with prepare-sentence-audio.ts
(see its usage comment), then run from repository root:
  python apps/api/scripts/audio/build-sentence-audio.py --input tmp/sentence-input.json \
    --model tools/piper/en_GB-alba-medium.onnx --out tmp/sentence-mp3
Requires ALREADY installed piper-tts, voice model + .onnx.json, ffmpeg + ffprobe on PATH.
Default voice: en_GB-alba-medium (the model filename must match the voice identity).
Output: <sha256>.mp3 plus manifest.json {version,voice,sentences:[{hash,text,file,durationMs}]}.
No skip/overwrite: existing valid manifests are reused; conflicts require a NEW voice
identity + matching model filename. Never replace bytes behind an immutable hash URL.

Licensing follows scripts/vendor/build-audio.py: Piper is a local GPL-3.0 tool,
not linked into or distributed with the app. Check the local voice model card and
its attribution/distribution terms before publishing generated audio. This script
does not download Piper, models, source code or third-party recordings.
"""
import argparse
import hashlib
import json
import os
import re
from pathlib import Path
import subprocess
import tempfile
import wave


BLANK = re.compile(r'\[BLANK\]|\(\s*\d+\s*\)\s*_{2,}|_{2,}')


def tts_text(text):
    """填空占位符只读成一个短停顿，绝不读出 blank 或答案（2026-11-05 Claude 定）。哈希仍按显示文本算。"""
    return BLANK.sub(' ... ', text)


def main():
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument('--input', required=True, help='JSON from prepare-sentence-audio.ts')
    ap.add_argument('--model', required=True, help='Local .onnx voice model')
    ap.add_argument('--out', required=True)
    args = ap.parse_args()
    prepared = json.loads(Path(args.input).read_text(encoding='utf-8-sig'))
    voice_id = prepared['voice']
    model = Path(args.model)
    if model.stem != voice_id or not model.is_file():
        raise ValueError('Model must exist and its filename stem must match manifest voice')
    sentences = prepared['sentences']
    if prepared.get('version') != 1 or not sentences:
        raise ValueError('Expected nonempty version 1 prepared input')
    seen = set()
    for row in sentences:
        expected = hashlib.sha256((row['text'] + '|' + voice_id).encode('utf-8')).hexdigest()
        if row['hash'] != expected or expected in seen:
            raise ValueError('Hash mismatch or duplicate input; prepare again with the TS adapter')
        seen.add(expected)
    out = Path(args.out)
    out.mkdir(parents=True, exist_ok=True)
    manifest_path = out / 'manifest.json'
    previous = json.loads(manifest_path.read_text(encoding='utf-8')) if manifest_path.exists() else {}
    if previous and (previous.get('version') != 1 or previous.get('voice') != voice_id):
        raise ValueError('Output manifest has another version or voice; use another directory')
    existing = {s['hash']: s for s in previous.get('sentences', [])}
    from piper import PiperVoice
    voice = PiperVoice.load(str(model))
    manifest = {'version': 1, 'voice': voice_id, 'sentences': []}
    for row in sentences:
        target = out / (row['hash'] + '.mp3')
        old = existing.get(row['hash'])
        if target.exists():
            if (not old or old['text'] != row['text'] or old.get('file') != target.name
                    or not isinstance(old.get('durationMs'), int) or old['durationMs'] <= 0
                    or target.stat().st_size == 0):
                raise ValueError(f'Unverified existing MP3: {target}; use a fresh output directory')
            manifest['sentences'].append(old)
            continue
        with tempfile.TemporaryDirectory(dir=out) as work:
            wav_path = Path(work) / 'sentence.wav'
            mp3_path = Path(work) / 'sentence.mp3'
            with wave.open(str(wav_path), 'wb') as wav:
                voice.synthesize_wav(tts_text(row['text']), wav)
            subprocess.run(['ffmpeg', '-nostdin', '-v', 'error', '-i', str(wav_path),
                            '-codec:a', 'libmp3lame', '-q:a', '4', str(mp3_path)], check=True)
            if mp3_path.stat().st_size == 0:
                raise ValueError('ffmpeg produced empty MP3')
            probe = subprocess.run(['ffprobe', '-v', 'error', '-show_entries', 'format=duration',
                                    '-of', 'json', str(mp3_path)], check=True, capture_output=True, text=True)
            duration = round(float(json.loads(probe.stdout)['format']['duration']) * 1000)
            if duration <= 0 or duration > 2147483647:
                raise ValueError('Invalid MP3 duration')
            os.replace(mp3_path, target)
        manifest['sentences'].append({**row, 'file': target.name, 'durationMs': duration})
        # Atomic checkpoint: interrupted runs can resume without replacing published bytes.
        checkpoint = out / 'manifest.tmp'
        existing[row['hash']] = manifest['sentences'][-1]
        resumable = {**manifest, 'sentences': list(existing.values())}
        checkpoint.write_text(json.dumps(resumable, ensure_ascii=False, indent=2), encoding='utf-8')
        os.replace(checkpoint, manifest_path)
    checkpoint = out / 'manifest.tmp'
    checkpoint.write_text(json.dumps(manifest, ensure_ascii=False, indent=2), encoding='utf-8')
    os.replace(checkpoint, manifest_path)
    print(f"Ready: {len(manifest['sentences'])} sentences -> {manifest_path}")


if __name__ == '__main__':
    main()
