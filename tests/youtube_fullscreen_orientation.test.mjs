import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const MAIN_ACTIVITY_PATH = "app/src/main/java/com/webviewapp/MainActivity.kt";
const MANIFEST_PATH = "app/src/main/AndroidManifest.xml";

test("Android activities follow the user's system rotation setting", () => {
  const manifest = readFileSync(MANIFEST_PATH, "utf8");

  assert.doesNotMatch(manifest, /android:screenOrientation="portrait"/);
  assert.equal(
    (manifest.match(/android:screenOrientation="fullUser"/g) || []).length,
    3
  );
});

test("MainActivity promotes WebView video fullscreen to a landscape native fullscreen view", () => {
  const source = readFileSync(MAIN_ACTIVITY_PATH, "utf8");

  assert.match(source, /override fun onShowCustomView\(\s*view: View,\s*callback: WebChromeClient\.CustomViewCallback\s*\)/);
  assert.match(source, /override fun onHideCustomView\(\)/);
  assert.match(source, /showFullscreenCustomView\(view,\s*callback\)/);
  assert.match(source, /hideFullscreenCustomView\(\)/);
  assert.match(source, /ActivityInfo\.SCREEN_ORIENTATION_SENSOR_LANDSCAPE/);
  assert.match(source, /isYouTubeUrl\(webView\.url\)/);
  assert.match(source, /requestedOrientation = originalRequestedOrientation/);
  assert.match(source, /fullscreenContainer/);
  assert.match(source, /fullscreenView != null/);
  assert.match(source, /hideFullscreenCustomView\(\)\s*return/);
});

test("MainActivity patches YouTube fullscreen buttons when WebView does not emit a custom view", () => {
  const source = readFileSync(MAIN_ACTIVITY_PATH, "utf8");

  assert.match(source, /PakrVideoFullscreen/);
  assert.match(source, /enterFullscreen\(\)/);
  assert.match(source, /exitFullscreen\(\)/);
  assert.match(source, /private var youtubePageFullscreenActive/);
  assert.match(source, /private fun enterYouTubePageFullscreen\(\)/);
  assert.match(source, /private fun exitYouTubePageFullscreen\(\)/);
  assert.match(source, /private fun injectYouTubeFullscreenBridge\(view: WebView\)/);
  assert.match(source, /injectYouTubeFullscreenBridge\(view\)/);
  assert.match(source, /Element\.prototype\.requestFullscreen/);
  assert.match(source, /document\.exitFullscreen/);
  assert.match(source, /ytp-fullscreen-button/);
  assert.match(source, /data-pakr-youtube-fullscreen-player/);
  assert.match(source, /data-pakr-youtube-fullscreen-video/);
  assert.match(source, /PakrVideoFullscreen\.enterFullscreen\(\)/);
  assert.match(source, /PakrVideoFullscreen\.exitFullscreen\(\)/);
  assert.match(source, /youtubePageFullscreenActive[\s\S]*exitYouTubePageFullscreen\(\)[\s\S]*return/);
});
