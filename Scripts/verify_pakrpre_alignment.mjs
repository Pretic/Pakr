import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (relativePath) => readFileSync(path.join(root, relativePath), 'utf8');
const exists = (relativePath) => existsSync(path.join(root, relativePath));

const indexHtml = read('index.html');
const worker = read('_worker.js');
const workflow = read('.github/workflows/build.yml');
const syncWorkflow = read('.github/workflows/sync-upstream.yml');
const manifest = read('app/src/main/AndroidManifest.xml');
const mainActivity = read('app/src/main/java/com/webviewapp/MainActivity.kt');
const splashActivity = read('app/src/main/java/com/webviewapp/SplashActivity.kt');
const disclaimerActivity = read('app/src/main/java/com/webviewapp/DisclaimerActivity.kt');
const blocker = read('app/src/main/assets/pakr_element_blocker.js');

assert.match(indexHtml, /<title>PakrPre<\/title>/, 'local frontend should be based on PakrPre');
assert.match(indexHtml, /id="f_ua_mode"/, 'PakrPre UA mode selector should exist');
assert.match(indexHtml, /name="icon_mode"/, 'PakrPre icon mode controls should exist');
assert.match(indexHtml, /id="f_show_disclaimer"/, 'PakrPre disclaimer toggle should exist');
assert.match(indexHtml, /id="f_window_mode"/, 'window mode toggle should exist');
assert.match(indexHtml, /id="syncBtn"/, 'frontend should expose upstream sync button');
assert.match(indexHtml, /id="syncPanel"/, 'frontend should expose upstream sync panel');
assert.match(indexHtml, /startSync\('check'\)/, 'frontend should support sync check mode');
assert.match(indexHtml, /startSync\('pr'\)/, 'frontend should support sync PR mode');
assert.match(indexHtml, /\/sync\/status/, 'frontend should poll sync status');
assert.match(indexHtml, /\/sync\/logs/, 'frontend should fetch sync logs');
assert.match(
  indexHtml,
  /window_mode:\s*document\.getElementById\('f_window_mode'\)\.checked\s*\?\s*'true'\s*:\s*'false'/,
  'frontend should send window_mode'
);

assert.match(worker, /ADMIN_PASSWORD/, 'PakrPre Worker auth should be present');
assert.match(worker, /icon_mode/, 'Worker should keep icon_mode');
assert.match(worker, /ua_mode/, 'Worker should keep ua_mode');
assert.match(worker, /show_disclaimer/, 'Worker should keep show_disclaimer');
assert.match(worker, /window_mode/, 'Worker should accept window_mode');
assert.match(worker, /\/sync\/check/, 'Worker should route sync check');
assert.match(worker, /\/sync\/start/, 'Worker should route sync PR creation');
assert.match(worker, /sync-upstream\.yml/, 'Worker should trigger sync workflow');
assert.match(worker, /Upstream sync requires ADMIN_PASSWORD/, 'sync endpoints should require admin password');
assert.match(worker, /repo !== 'Pretic\/PakrPre'/, 'sync upstream repo should be allowlisted');
assert.match(
  worker,
  /inputs:\s*\{[\s\S]*window_mode:\s*window_mode\|\|'false'/,
  'Worker should dispatch window_mode'
);

assert.match(workflow, /window_mode:/, 'workflow should declare window_mode');
assert.match(workflow, /\{\{WINDOW_MODE\}\}/, 'workflow should inject WINDOW_MODE placeholders');
assert.match(workflow, /icon_mode:/, 'workflow should keep icon_mode');
assert.match(workflow, /ua_mode:/, 'workflow should keep ua_mode');
assert.match(workflow, /show_disclaimer:/, 'workflow should keep show_disclaimer');

assert.match(syncWorkflow, /name:\s*Sync Upstream/, 'sync workflow should exist');
assert.match(syncWorkflow, /workflow_dispatch:/, 'sync workflow should be manually dispatchable');
assert.match(syncWorkflow, /contents:\s*write/, 'sync workflow needs contents write permission for PR branch');
assert.match(syncWorkflow, /pull-requests:\s*write/, 'sync workflow needs PR write permission');
assert.match(syncWorkflow, /Pretic\/PakrPre/, 'sync workflow should allow only PakrPre upstream');
assert.match(syncWorkflow, /git merge --no-commit --no-ff/, 'sync workflow should check mergeability before PR');
assert.match(syncWorkflow, /git merge --abort/, 'sync workflow should abort failed or dry-run merges');
assert.match(syncWorkflow, /sync\/upstream-/, 'sync workflow should push to a sync branch, not main');
assert.match(syncWorkflow, /gh pr create/, 'sync workflow should create a pull request');
assert.match(syncWorkflow, /SYNC_PR_URL=/, 'sync workflow should expose created PR URL in logs');

assert.match(manifest, /FileProvider/, 'PakrPre FileProvider should be present');
assert.ok(exists('app/src/main/assets/pakr_element_blocker.js'), 'element blocker asset should exist');
assert.match(blocker, /previewImage/, 'element blocker should support image preview');
assert.match(blocker, /contextmenu/, 'element blocker should install context menu handling');

assert.match(mainActivity, /PakrElementBlocker/, 'MainActivity should keep PakrPre element blocker bridge');
assert.match(mainActivity, /PakrClipboard/, 'MainActivity should expose native clipboard bridge');
assert.match(mainActivity, /clipboard-write/, 'clipboard permission compatibility should exist');
assert.match(mainActivity, /private const val WINDOW_MODE = "\{\{WINDOW_MODE\}\}"/, 'MainActivity should define WINDOW_MODE template');
assert.match(mainActivity, /if \(WINDOW_MODE\.equals\("true", ignoreCase = true\)\)/, 'MainActivity should switch display mode by WINDOW_MODE');
assert.match(mainActivity, /onPageCommitVisible[\s\S]*injectWebViewEnhancements\(view\)/, 'enhancements should be re-injected on commit');
assert.match(mainActivity, /onPageFinished[\s\S]*injectWebViewEnhancements\(view\)/, 'enhancements should be re-injected on finish');
assert.match(mainActivity, /private fun injectWebViewEnhancements\(view: WebView\)[\s\S]*injectClipboardBridge\(view\)[\s\S]*injectElementBlocker\(view\)/, 'enhancement injector should include clipboard and blocker scripts');
assert.match(mainActivity, /body\{[^}]*place-items:center[^}]*\}/s, 'image preview body should center content');
assert.match(mainActivity, /img\{[^}]*max-width:100vw[^}]*max-height:100vh[^}]*object-fit:contain[^}]*\}/s, 'image preview image should fit and stay centered');

assert.match(splashActivity, /private const val WINDOW_MODE = "\{\{WINDOW_MODE\}\}"/, 'SplashActivity should define WINDOW_MODE template');
assert.match(splashActivity, /if \(WINDOW_MODE\.equals\("true", ignoreCase = true\)\)/, 'SplashActivity should switch display mode by WINDOW_MODE');
assert.match(disclaimerActivity, /private const val WINDOW_MODE = "\{\{WINDOW_MODE\}\}"/, 'DisclaimerActivity should define WINDOW_MODE template');
assert.match(disclaimerActivity, /if \(WINDOW_MODE\.equals\("true", ignoreCase = true\)\)/, 'DisclaimerActivity should switch display mode by WINDOW_MODE');

console.log('PakrPre alignment checks passed');
