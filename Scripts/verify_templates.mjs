import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (relativePath) => readFileSync(path.join(root, relativePath), 'utf8');

const indexHtml = read('index.html');
const worker = read('_worker.js');
const workflow = read('.github/workflows/build.yml');
const syncWorkflow = read('.github/workflows/sync-upstream.yml');
const buildLocal = read('Scripts/build_local.ps1');
const mainActivity = read('app/src/main/java/com/webviewapp/MainActivity.kt');
const splashActivity = read('app/src/main/java/com/webviewapp/SplashActivity.kt');
const disclaimerActivity = read('app/src/main/java/com/webviewapp/DisclaimerActivity.kt');

assert.match(indexHtml, /id="f_window_mode"/, 'build form should expose a window mode toggle');
assert.match(indexHtml, /id="syncBtn"/, 'frontend should expose an upstream sync nav button');
assert.match(indexHtml, /id="syncPanel"/, 'frontend should expose an upstream sync panel');
assert.match(indexHtml, /startSync\('check'\)/, 'frontend should trigger check mode');
assert.match(indexHtml, /startSync\('pr'\)/, 'frontend should trigger PR mode');
assert.doesNotMatch(indexHtml, /id="sync_upstream_repo"|name="sync_upstream_repo"/, 'frontend should not expose arbitrary upstream repo input');
assert.match(
  indexHtml,
  /window_mode:\s*document\.getElementById\('f_window_mode'\)\.checked\s*\?\s*'true'\s*:\s*'false'/,
  'build request should include window_mode from the toggle'
);

assert.match(worker, /window_mode/, 'worker should accept window_mode');
assert.match(worker, /\/sync\/check/, 'worker should route sync check');
assert.match(worker, /\/sync\/start/, 'worker should route sync PR creation');
assert.match(worker, /requireSyncAdmin/, 'sync endpoints should require dedicated admin guard');
assert.match(worker, /Upstream sync requires ADMIN_PASSWORD/, 'sync should be disabled without ADMIN_PASSWORD');
assert.match(worker, /sync-upstream\.yml/, 'worker should dispatch sync workflow');
assert.match(worker, /repo !== 'Pretic\/PakrPre'/, 'worker should allowlist upstream repo');
assert.match(
  worker,
  /inputs:\s*\{[\s\S]*window_mode:\s*window_mode\|\|'false'/,
  'worker should dispatch window_mode to GitHub Actions'
);
assert.match(workflow, /window_mode:/, 'workflow should declare window_mode input');
assert.match(
  workflow,
  /s\|\{\{WINDOW_MODE\}\}\|\$\{WINDOW_MODE:-false\}\|g/,
  'workflow should inject WINDOW_MODE into Android sources'
);
assert.match(buildLocal, /\[switch\]\$WindowMode/, 'local build should expose a WindowMode switch');
assert.match(buildLocal, /Replace-InFile \$mainActivity "\{\{WINDOW_MODE\}\}" \$windowModeValue/, 'local build should inject MainActivity WINDOW_MODE');
assert.match(buildLocal, /Replace-InFile \$splashActivity "\{\{WINDOW_MODE\}\}" \$windowModeValue/, 'local build should inject SplashActivity WINDOW_MODE');
assert.match(buildLocal, /Replace-InFile \$disclaimerActivity "\{\{WINDOW_MODE\}\}" \$windowModeValue/, 'local build should inject DisclaimerActivity WINDOW_MODE');

assert.match(syncWorkflow, /name:\s*Sync Upstream/, 'sync workflow should exist');
assert.match(syncWorkflow, /workflow_dispatch:/, 'sync workflow should be manually dispatchable');
assert.match(syncWorkflow, /mode:/, 'sync workflow should accept a mode input');
assert.match(syncWorkflow, /Pretic\/PakrPre/, 'sync workflow should pin allowed upstream repo');
assert.match(syncWorkflow, /contents:\s*write/, 'sync workflow should push a PR branch');
assert.match(syncWorkflow, /pull-requests:\s*write/, 'sync workflow should create a PR');
assert.match(syncWorkflow, /git merge --no-commit --no-ff/, 'sync workflow should dry-run merge before PR');
assert.match(syncWorkflow, /git merge --abort/, 'sync workflow should abort dry-run or conflict merges');
assert.match(syncWorkflow, /gh pr create/, 'sync workflow should create PRs via GitHub CLI');
assert.match(syncWorkflow, /Cloudflare Pages should deploy only after this PR is merged/, 'sync workflow should document deployment boundary');

assert.match(mainActivity, /private const val WINDOW_MODE = "\{\{WINDOW_MODE\}\}"/);
assert.match(mainActivity, /if \(WINDOW_MODE\.equals\("true", ignoreCase = true\)\)/);
assert.match(splashActivity, /private const val WINDOW_MODE = "\{\{WINDOW_MODE\}\}"/);
assert.match(splashActivity, /if \(WINDOW_MODE\.equals\("true", ignoreCase = true\)\)/);
assert.match(disclaimerActivity, /private const val WINDOW_MODE = "\{\{WINDOW_MODE\}\}"/);
assert.match(disclaimerActivity, /if \(WINDOW_MODE\.equals\("true", ignoreCase = true\)\)/);

assert.match(mainActivity, /PakrClipboard/, 'Android should expose a clipboard bridge');
assert.match(mainActivity, /ClipboardManager/, 'clipboard bridge should use Android ClipboardManager');
assert.match(mainActivity, /injectWebViewEnhancements/, 'web enhancements should be centralized for repeat injection');
assert.match(
  mainActivity,
  /override fun onPageCommitVisible[\s\S]*injectWebViewEnhancements\(view\)/,
  'enhancements should run when a new document is committed'
);
assert.match(
  mainActivity,
  /override fun onPageFinished[\s\S]*injectWebViewEnhancements\(view\)/,
  'enhancements should run again after page finish for SPA/history changes'
);
assert.match(mainActivity, /navigator\.clipboard/, 'injected script should patch navigator.clipboard.writeText');
assert.match(mainActivity, /clipboard-write/, 'injected script should report clipboard-write permission as granted');
assert.match(mainActivity, /body\{[^}]*place-items:center[^}]*\}/s, 'image preview body should center content');
assert.match(mainActivity, /img\{[^}]*max-width:100vw[^}]*max-height:100vh[^}]*object-fit:contain[^}]*\}/s, 'image preview image should fit within the viewport');

console.log('Template checks passed');
