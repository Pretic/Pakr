import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import vm from "node:vm";

const read = (path) => readFileSync(path, "utf8");
const index = read("index.html");
const worker = read("_worker.js");
const main = read("app/src/main/java/com/webviewapp/MainActivity.kt");
const settingsStore = read("app/src/main/java/com/webviewapp/AppSettingsStore.kt");
const blocker = read("app/src/main/assets/pakr_element_blocker.js");

test("all inline frontend scripts parse", () => {
  const scripts = [...index.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/gi)].map((match) => match[1]);
  assert.ok(scripts.length > 0);
  scripts.forEach((script, scriptIndex) => {
    assert.doesNotThrow(() => new vm.Script(script, { filename: `index-inline-${scriptIndex}.js` }));
  });
});

test("package names remain editable after automatic generation", () => {
  assert.match(index, /id="pkgRegenerateBtn"/);
  assert.match(index, /pkgInput\.dataset\.manual/);
  assert.match(index, /当前为手动包名，网址和名称变化时不会覆盖/);
  assert.match(index, /regenerateBtn\.addEventListener\('click', \(\) => fillPkg\(true\)\)/);
  assert.doesNotMatch(index, /id="f_pkg"[^>]*(?:readonly|disabled)/i);
});

test("GitHub dispatch failures expose actionable diagnostics and accept modern success responses", () => {
  assert.match(worker, /if \(!r\.ok\) return githubErrorResponse\(r, '触发构建'\)/);
  assert.match(worker, /dispatch\?\.workflow_run_id/);
  assert.match(worker, /github_auth_invalid/);
  assert.match(worker, /GitHub 令牌无效或已过期/);
  assert.match(worker, /const token = env\.GH_PAT \|\| env\.GITHUB_TOKEN/);
  assert.match(worker, /'X-GitHub-Api-Version': '2026-03-10'/);
  assert.match(index, /GitHub 返回：/);
});

test("worker maps a live GitHub 401 and accepts the dispatch response with a run id", async () => {
  const moduleUrl = `data:text/javascript;base64,${Buffer.from(worker).toString("base64")}`;
  const workerModule = await import(moduleUrl);
  const originalFetch = globalThis.fetch;
  const requestBody = {
    app_url: "https://example.com",
    app_name: "Diagnostic",
    package_name: "com.pretic.diagnostic",
    version_name: "1.0.0",
  };
  const makeRequest = () => new Request("https://pakr.test/build", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(requestBody),
  });
  const env = { GITHUB_OWNER: "Pretic", GITHUB_REPO: "Pakr", GH_PAT: "test-token" };

  try {
    let capturedAuthorization = "";
    globalThis.fetch = async (_url, options) => {
      capturedAuthorization = options.headers.Authorization;
      return new Response(null, { status: 204 });
    };
    const preferred = await workerModule.default.fetch(makeRequest(), {
      ...env,
      GITHUB_TOKEN: "stale-legacy-token",
    });
    assert.equal(preferred.status, 200);
    assert.equal(capturedAuthorization, "Bearer test-token");

    globalThis.fetch = async () => new Response(JSON.stringify({ message: "Bad credentials" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
    const failed = await workerModule.default.fetch(makeRequest(), env);
    assert.equal(failed.status, 502);
    assert.deepEqual(await failed.json(), {
      error: "GitHub 令牌无效或已过期，请在 Cloudflare Pages 更新 GH_PAT 或 GITHUB_TOKEN",
      code: "github_auth_invalid",
      github_status: 401,
      detail: "Bad credentials",
    });

    globalThis.fetch = async () => new Response(JSON.stringify({
      workflow_run_id: 123456,
      html_url: "https://github.com/Pretic/Pakr/actions/runs/123456",
    }), { status: 200, headers: { "Content-Type": "application/json" } });
    const accepted = await workerModule.default.fetch(makeRequest(), env);
    assert.equal(accepted.status, 200);
    const acceptedBody = await accepted.json();
    assert.equal(acceptedBody.status, "queued");
    assert.equal(acceptedBody.run_id, 123456);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("right-click settings consolidate rules, favorites, and the mutable home URL", () => {
  assert.match(blocker, /label: "收藏网页"/);
  assert.match(blocker, /label: "设置"/);
  assert.match(blocker, /function showSettingsPanel\(\)/);
  assert.match(blocker, /makeSettingsItem\("已屏蔽列表"/);
  assert.match(blocker, /function showFavoritesPanel\(\)/);
  assert.match(blocker, /function showFavoriteEditor\(index\)/);
  assert.match(blocker, /function showHomeUrlPanel\(\)/);
});

test("favorites and home URL use validated native storage that survives same-package upgrades", () => {
  assert.match(main, /private val appSettingsStore by lazy \{ AppSettingsStore\(this\) \}/);
  assert.match(main, /webView\.loadUrl\(appSettingsStore\.loadHomeUrl\(APP_URL\)\)/);
  assert.match(main, /fun getFavorites\(token: String\): String/);
  assert.match(main, /fun saveHomeUrl\(token: String, url: String\): Boolean/);
  assert.match(main, /__PAKR_NATIVE_TOKEN__/);
  assert.match(settingsStore, /getSharedPreferences\("pakr_app_settings"/);
  assert.match(settingsStore, /favorites\.length\(\) > MAX_FAVORITES/);
  assert.match(settingsStore, /scheme == "http" \|\| scheme == "https"/);
});

test("blocked rules can be exported through the Android document picker", () => {
  assert.match(blocker, /保存 JSON 文件/);
  assert.match(blocker, /bridge\.exportJson\(nativeToken, fileName, payload\)/);
  assert.match(main, /Intent\.ACTION_CREATE_DOCUMENT/);
  assert.match(main, /type = "application\/json"/);
  assert.match(main, /JSON 文件已保存/);
});
