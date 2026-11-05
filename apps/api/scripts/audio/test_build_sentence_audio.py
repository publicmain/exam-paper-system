"""Offline unit tests: fake Piper + encoder, no model inference or external commands.
Run from repository root: python -m unittest discover -s apps/api/scripts/audio -p test_*.py
"""
import hashlib
import importlib.util
import json
from contextlib import contextmanager
from pathlib import Path
import shutil
import sys
import types
import unittest
import uuid
from unittest.mock import patch

spec = importlib.util.spec_from_file_location('sentence_builder', Path(__file__).with_name('build-sentence-audio.py'))
builder = importlib.util.module_from_spec(spec)
spec.loader.exec_module(builder)


class OfflineBuildTest(unittest.TestCase):
    def setUp(self):
        self.root = Path.cwd() / ('sentence-builder-test-' + uuid.uuid4().hex)
        self.root.mkdir()
        self.addCleanup(self.cleanup_root)
        self.voice = 'en_GB-alba-medium'
        self.model = self.root / (self.voice + '.onnx')
        self.model.write_bytes(b'FAKE MODEL, NEVER LOADED')
        self.out = self.root / 'out'
        self.input = self.root / 'input.json'
        self.rows = [dict(hash=hashlib.sha256((text + '|' + self.voice).encode()).hexdigest(), text=text)
                     for text in ['Hello.', 'Goodbye.']]
        self.save()
        self.synthesized = []
        owner = self

        class FakeVoice:
            @staticmethod
            def load(_path):
                return FakeVoice()

            def synthesize_wav(self, text, wav):
                owner.synthesized.append(text)
                wav.setnchannels(1)
                wav.setsampwidth(2)
                wav.setframerate(16000)
                wav.writeframes(b'\0\0' * 1600)

        self.piper = types.SimpleNamespace(PiperVoice=FakeVoice)

    def cleanup_root(self):
        if self.root.resolve().parent != Path.cwd().resolve():
            raise ValueError('Unexpected test directory')
        shutil.rmtree(self.root)

    @contextmanager
    def temporary_audio_dir(self, dir):
        # Python 3.14's mode-700 tempfile ACL is inaccessible in this Windows
        # sandbox. An ordinary directory uses the workspace's inherited ACL.
        path = Path(dir) / uuid.uuid4().hex
        path.mkdir()
        try:
            yield str(path)
        finally:
            if path.resolve().parent != self.out.resolve():
                raise ValueError('Unexpected audio test directory')
            shutil.rmtree(path)

    def save(self):
        self.input.write_text(json.dumps(dict(version=1, voice=self.voice, sentences=self.rows)), encoding='utf-8')

    @staticmethod
    def encode(cmd, **_kwargs):
        if cmd[0] == 'ffmpeg':
            Path(cmd[-1]).write_bytes(b'ID3fake-mp3')
        return types.SimpleNamespace(stdout='{"format":{"duration":"0.12"}}')

    def run_builder(self, encoder=None):
        with patch.object(sys, 'argv', ['build', '--input', str(self.input), '--model', str(self.model), '--out', str(self.out)]), \
                patch.dict(sys.modules, {'piper': self.piper}), \
                patch.object(builder.subprocess, 'run', side_effect=encoder or self.encode), \
                patch.object(builder.tempfile, 'TemporaryDirectory', side_effect=self.temporary_audio_dir):
            builder.main()

    def test_mp3_manifest_and_repeat_run_reuses_bytes(self):
        self.run_builder()
        manifest = json.loads((self.out / 'manifest.json').read_text(encoding='utf-8'))
        self.assertEqual(len(manifest['sentences']), 2)
        self.assertEqual(manifest['sentences'][0]['durationMs'], 120)
        original = (self.out / (self.rows[0]['hash'] + '.mp3')).read_bytes()
        self.run_builder()
        self.assertEqual(self.synthesized, ['Hello.', 'Goodbye.'])
        self.assertEqual((self.out / (self.rows[0]['hash'] + '.mp3')).read_bytes(), original)

    def test_failure_keeps_checkpoint_and_resume_completes(self):
        calls = 0

        def fail_second(cmd, **kwargs):
            nonlocal calls
            if cmd[0] == 'ffmpeg':
                calls += 1
                if calls == 2:
                    raise RuntimeError('encoder failed')
            return self.encode(cmd, **kwargs)

        with self.assertRaisesRegex(RuntimeError, 'encoder failed'):
            self.run_builder(fail_second)
        manifest = json.loads((self.out / 'manifest.json').read_text(encoding='utf-8'))
        self.assertEqual(len(manifest['sentences']), 1)
        self.run_builder()
        self.assertEqual(len(json.loads((self.out / 'manifest.json').read_text())['sentences']), 2)
        self.assertEqual(self.synthesized.count('Hello.'), 1)

    def test_invalid_hash_and_wrong_voice_model_fail_before_piper(self):
        self.rows[0]['hash'] = 'bad'
        self.save()
        with self.assertRaisesRegex(ValueError, 'Hash mismatch'):
            self.run_builder()
        self.model = self.root / 'other.onnx'
        self.model.write_bytes(b'fake')
        with self.assertRaisesRegex(ValueError, 'filename stem'):
            self.run_builder()
        self.assertEqual(self.synthesized, [])

    def test_orphan_file_is_not_overwritten(self):
        self.out.mkdir()
        target = self.out / (self.rows[0]['hash'] + '.mp3')
        target.write_bytes(b'existing-unverified')
        with self.assertRaisesRegex(ValueError, 'Unverified existing'):
            self.run_builder()
        self.assertEqual(target.read_bytes(), b'existing-unverified')


if __name__ == '__main__':
    unittest.main()
