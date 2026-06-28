import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const MAIN_ACTIVITY_PATH = "app/src/main/java/com/webviewapp/MainActivity.kt";

test("MainActivity wires native right-click and edge-hold entries to the injected JS menu", () => {
  const source = readFileSync(MAIN_ACTIVITY_PATH, "utf8");

  assert.match(source, /private fun installNativeToolEntry\(\)/);
  assert.match(source, /webView\.setOnGenericMotionListener/);
  assert.match(source, /webView\.setOnTouchListener/);
  assert.match(source, /MotionEvent\.BUTTON_SECONDARY/);
  assert.match(source, /isNativeToolEdgeGestureStart/);
  assert.match(source, /nativeToolEdgeWidthPx/);
  assert.match(source, /nativeToolLongPressDelayMs/);
  assert.match(source, /nativeToolMoveTolerancePx/);
  assert.match(source, /PakrElementBlockerUI\.openMenuAt/);
  assert.doesNotMatch(source, /MotionEvent\.ACTION_POINTER_DOWN/);
  assert.doesNotMatch(source, /pointerCount == 2/);
});
