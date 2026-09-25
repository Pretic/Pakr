import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
const main = readFileSync('app/src/main/java/com/webviewapp/MainActivity.kt', 'utf8');
const store = readFileSync('app/src/main/java/com/webviewapp/ElementRuleStore.kt', 'utf8');
const script = readFileSync('app/src/main/assets/pakr_element_blocker.js', 'utf8');

test('native rules are acknowledged, validated and never truncated', () => {
  assert.doesNotMatch(main, /rulesJson\.take/);
  assert.match(main, /fun saveRules\(host: String, rulesJson: String\): Boolean/);
  assert.match(store, /JSONArray\(json\)/);
  assert.match(store, /rules\.length\(\) > 200/);
  assert.match(store, /edit\.commit\(\)/);
  assert.match(store, /getSharedPreferences\("element_blocker"/);
  assert.match(store, /\$host:backup/);
});

test('early injection is feature gated and resumed pages are refreshed', () => {
  assert.match(main, /isFeatureSupported\(WebViewFeature\.DOCUMENT_START_SCRIPT\)/);
  assert.match(main, /addDocumentStartJavaScript/);
  assert.ok(main.indexOf('installElementBlockerAtDocumentStart()') < main.indexOf('webView.loadUrl(appSettingsStore.loadHomeUrl(APP_URL))'));
  assert.match(main, /override fun onResume\(\)[\s\S]*injectElementBlocker\(webView\)/);
});

test('linked image override is per-site and opt-in with navigation escape hatches', () => {
  assert.match(main, /getBoolean\("\$\{normalizeRuleHost\(host\)\}:image_tap_preview", false\)/);
  assert.match(script, /imageTapPreviewEnabled = false/);
  assert.doesNotMatch(script, /event\.detail === 0/);
  assert.match(script, /data-pakr-image-tap='navigate'/);
  assert.match(script, /label: "查看链接"/);
});

test('home domain changes merge-copy blocking rules without deleting the old host', () => {
  assert.match(main, /fun migrateRulesToUrl\(token: String, sourceHost: String, targetUrl: String\): Int/);
  assert.match(main, /elementRuleStore\.mergeCopy/);
  assert.match(store, /fun mergeCopy\(sourceHost: String, targetHost: String\): Int/);
  assert.match(store, /selectors\.add\(rule\.getString\("selector"\)\)/);
  assert.match(store, /if \(save\(targetHost, merged\.toString\(\)\)\) added else -1/);
  assert.match(script, /migrateHomeRules\(currentUrl, url\)/);
});

test('settings panels follow the visual viewport and MainActivity requests resize for the IME', () => {
  const manifest = readFileSync('app/src/main/AndroidManifest.xml', 'utf8');
  assert.match(manifest, /android:name="\.MainActivity"[\s\S]*android:windowSoftInputMode="adjustResize"/);
  assert.match(main, /SOFT_INPUT_ADJUST_RESIZE/);
  assert.match(main, /ViewCompat\.requestApplyInsets\(swipeRefresh\)/);
  assert.match(script, /window\.visualViewport/);
  assert.match(script, /target\.scrollIntoView\(\{ block: "center", inline: "nearest" \}\)/);
});
