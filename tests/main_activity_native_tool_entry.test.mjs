import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const MAIN_ACTIVITY_PATH = "app/src/main/java/com/webviewapp/MainActivity.kt";

test("MainActivity wires a native two-finger long-press tool entry to the injected JS menu", () => {
  const source = readFileSync(MAIN_ACTIVITY_PATH, "utf8");

  assert.match(source, /private fun installNativeToolEntry\(\)/);
  assert.match(source, /webView\.setOnTouchListener/);
  assert.match(source, /MotionEvent\.ACTION_POINTER_DOWN/);
  assert.match(source, /nativeToolLongPressDelayMs/);
  assert.match(source, /nativeToolMoveTolerancePx/);
  assert.match(source, /PakrElementBlockerUI\.openMenuAt/);
});
