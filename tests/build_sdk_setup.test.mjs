import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

test('release and verification workflows avoid the retired Android tools package', () => {
  for (const file of ['build.yml', 'verify.yml']) {
    const workflow = readFileSync(new URL(`../.github/workflows/${file}`, import.meta.url), 'utf8');
    assert.match(workflow, /uses: android-actions\/setup-android@v3\s+with:\s+packages: 'platform-tools platforms;android-34 build-tools;34\.0\.0'/);
  }
});
