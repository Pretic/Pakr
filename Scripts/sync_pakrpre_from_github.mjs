import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const repo = 'Pretic/PakrPre';
const branch = 'main';
const userAgent = 'Codex-PakrPre-Sync';

function get(url, binary = false, attempt = 1) {
  return new Promise((resolve, reject) => {
    const client = url.startsWith('https://') ? import('node:https') : import('node:http');
    client.then(({ default: mod }) => {
      const req = mod.get(url, {
        headers: {
          'User-Agent': userAgent,
          'Accept': url.includes('/api.github.com/')
            ? 'application/vnd.github+json'
            : '*/*',
        },
        timeout: 45_000,
      }, (res) => {
        if ([301, 302, 303, 307, 308].includes(res.statusCode)) {
          const next = new URL(res.headers.location, url).href;
          res.resume();
          get(next, binary, attempt).then(resolve, reject);
          return;
        }
        if (res.statusCode !== 200) {
          res.resume();
          reject(new Error(`GET ${url} returned HTTP ${res.statusCode}`));
          return;
        }
        const chunks = [];
        if (!binary) res.setEncoding('utf8');
        res.on('data', (chunk) => chunks.push(chunk));
        res.on('end', () => {
          resolve(binary ? Buffer.concat(chunks) : chunks.join(''));
        });
      });
      req.on('timeout', () => req.destroy(new Error('timeout')));
      req.on('error', async (err) => {
        if (attempt < 4) {
          await new Promise((r) => setTimeout(r, attempt * 1_000));
          get(url, binary, attempt + 1).then(resolve, reject);
          return;
        }
        reject(err);
      });
    }, reject);
  });
}

const treeJson = await get(`https://api.github.com/repos/${repo}/git/trees/${branch}?recursive=1`);
const tree = JSON.parse(treeJson).tree.filter((entry) => entry.type === 'blob');

const skipped = [];
for (const entry of tree) {
  if (entry.path === 'README.md' || entry.path.startsWith('Docs/')) {
    skipped.push(entry.path);
    continue;
  }
  const rawUrl = `https://raw.githubusercontent.com/${repo}/${branch}/${entry.path}`;
  const binary = /\.(png|jpe?g|jar)$/i.test(entry.path);
  const content = await get(rawUrl, binary);
  const target = path.join(root, ...entry.path.split('/'));
  if (!target.startsWith(root + path.sep)) {
    throw new Error(`Refusing to write outside workspace: ${entry.path}`);
  }
  await mkdir(path.dirname(target), { recursive: true });
  await writeFile(target, content);
  console.log(`synced ${entry.path}`);
}

console.log(JSON.stringify({
  synced: tree.length - skipped.length,
  skipped,
}, null, 2));
