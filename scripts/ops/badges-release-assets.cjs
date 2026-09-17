/* Verify exact approved V5 static assets at the existing production student origin. */
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const root = path.resolve(__dirname, '../..');
const base = 'https://student-web-production-5a21.up.railway.app';
const assetRoot = path.join(root, 'apps/student-web/public/medals/v5');
const ids = ['reading', 'vocabulary', 'mastery'].flatMap(s => [1,2,3,4].map(t => `${s}-${t}`)).concat(['hidden-triad','hidden-worlds','hidden-starlight','crown']);
const digest = b => crypto.createHash('sha256').update(b).digest('hex');
async function main() {
  const report = { origin: base, checkedAt: new Date().toISOString(), files: [], errors: [] };
  const files = ['viewer.html', 'renderer.js', ...ids.flatMap(id => [`models/${id}.glb`, `thumbs/${id}.png`, `images/${id}.png`])];
  for (let i = 0; i < files.length; i += 4) {
    await Promise.all(files.slice(i, i + 4).map(async file => {
      const expected = fs.readFileSync(path.join(assetRoot, file));
      const response = await fetch(`${base}/medals/v5/${file}`, { signal: AbortSignal.timeout(45000) });
      if (!response.ok) throw new Error(`${file}: HTTP ${response.status}`);
      const actual = Buffer.from(await response.arrayBuffer());
      if (digest(actual) !== digest(expected)) throw new Error(`${file}: content hash mismatch`);
      if (file.endsWith('.glb') && (actual.toString('ascii', 0, 4) !== 'glTF' || actual.readUInt32LE(4) !== 2)) throw new Error(`${file}: not GLB v2`);
      report.files.push({ file, bytes: actual.length, sha256: digest(actual), cache: response.headers.get('cache-control') });
    }));
  }
  const missing = await fetch(`${base}/medals/v5/models/release-check-does-not-exist.glb`);
  if (missing.status !== 404) throw new Error('Missing model must be 404, not SPA fallback');
  const html = await (await fetch(base + '/login')).text();
  const scripts = [...html.matchAll(/<script[^>]*src="([^"]+)"/g)].map(m => m[1]);
  let mainText = '';
  for (const script of scripts) mainText += await (await fetch(new URL(script, base))).text();
  if (!mainText.includes('exam-paper-system-production.up.railway.app')) throw new Error('Published bundle lacks verified production API origin');
  if (mainText.includes('http://127.0.0.1:4118') || mainText.includes('http://localhost:4118')) throw new Error('Sandbox URL present in published main bundle');
  report.mainScripts = scripts;
  report.missingModel404 = true;
  fs.mkdirSync(path.join(root, '.local/badges-release'), { recursive: true });
  fs.writeFileSync(path.join(root, '.local/badges-release/live-assets.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify({ filesVerified: report.files.length, modelsVerified: ids.length, missingModel404: true, productionApiOrigin: true, mainScripts: scripts }));
}
main().catch(e => { console.error(e.message); process.exitCode = 1; });
