import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { test } from "node:test";

const read = (relativePath) => readFileSync(relativePath, "utf8");

test("upstream sync is pinned to ZhangShengFan/Pakr and remains PR-only", () => {
  const worker = read("_worker.js");
  const workflow = read(".github/workflows/sync-upstream.yml");

  assert.match(worker, /ZhangShengFan\/Pakr/);
  assert.match(workflow, /default:\s*ZhangShengFan\/Pakr/);
  assert.match(workflow, /ZhangShengFan\/Pakr\) ;;/);
  assert.doesNotMatch(workflow, /Pretic\/PakrPre/);
  assert.match(workflow, /git merge --no-commit --no-ff/);
  assert.match(workflow, /git merge --abort/);
  assert.match(workflow, /sync\/upstream-/);
  assert.match(workflow, /gh pr create/);
});

test("project, Actions, and upstream links no longer point at the deleted repository", () => {
  const indexHtml = read("index.html");

  assert.match(indexHtml, /https:\/\/github\.com\/Pretic\/Pakr"/);
  assert.match(indexHtml, /https:\/\/github\.com\/Pretic\/Pakr\/actions/);
  assert.match(indexHtml, /ZhangShengFan\/Pakr main/);
  assert.doesNotMatch(indexHtml, /github\.com\/Pretic\/PakrPre/);
});

test("the retired direct-overwrite synchronizer is absent", () => {
  assert.equal(existsSync("Scripts/sync_pakrpre_from_github.mjs"), false);
});

test("the legacy verifier delegates to repository invariant checks", () => {
  assert.equal(existsSync("Scripts/verify_local_invariants.mjs"), true);
  assert.match(
    read("Scripts/verify_pakrpre_alignment.mjs"),
    /import ['"]\.\/verify_local_invariants\.mjs['"]/
  );
});
