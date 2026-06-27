export default {
  async fetch(request, env) {

    if (request.method === 'OPTIONS') return cors(new Response(null, { status: 204 }), env);
    const url = new URL(request.url);
    const canonical = canonicalRedirect(request, env, url);
    if (canonical) return canonical;

    if (url.pathname === '/login') {
      const res = request.method === 'POST'
        ? await handleLogin(request, env)
        : loginPage(request, env);
      return cors(res, env);
    }
    if (url.pathname === '/logout') return cors(logoutResponse(), env);

    if (authEnabled(env) && !(await isAuthorized(request, env))) {
      return cors(authRequired(request), env);
    }

    try {
      let res;
      if      (url.pathname === '/build'    && request.method === 'POST') res = await handleBuild(request, env);
      else if (url.pathname === '/status'   && request.method === 'GET')  res = await handleStatus(request, env);
      else if (url.pathname === '/logs'     && request.method === 'GET')  res = await handleLogs(request, env);
      else if (url.pathname === '/download' && request.method === 'GET')  res = await handleDownload(request, env);
      else if (url.pathname === '/cancel'   && request.method === 'POST') res = await handleCancel(request, env);
      else if (url.pathname === '/sync/check'  && request.method === 'POST') res = await handleSyncTrigger(request, env, 'check');
      else if (url.pathname === '/sync/start'  && request.method === 'POST') res = await handleSyncTrigger(request, env, 'pr');
      else if (url.pathname === '/sync/status' && request.method === 'GET')  res = await handleSyncStatus(request, env);
      else if (url.pathname === '/sync/logs'   && request.method === 'GET')  res = await handleSyncLogs(request, env);
      else return serveAsset(request, env);
      return cors(res, env);
    } catch (e) {
      return cors(json({ error: e.message }, 500), env);
    }
  }
};

function canonicalRedirect(request, env, url) {
  if (request.method !== 'GET' && request.method !== 'HEAD') return null;
  const targetOrigin = publicBaseUrl(env);
  if (!targetOrigin || !url.hostname.endsWith('.pages.dev')) return null;

  const target = new URL(targetOrigin);
  if (url.origin === target.origin) return null;

  return new Response(null, {
    status: 308,
    headers: {
      Location: new URL(url.pathname + url.search, target.origin).href,
      'Cache-Control': 'no-store',
    },
  });
}

async function serveAsset(request, env) {
  const res = await env.ASSETS.fetch(request);
  const contentType = res.headers.get('Content-Type') || '';
  if (!res.ok || !contentType.includes('text/html')) return res;

  const headers = new Headers(res.headers);
  headers.delete('Content-Length');
  const html = (await res.text()).replaceAll('__PAKR_PUBLIC_BASE_URL__', publicBaseUrl(env));
  return new Response(html, { status: res.status, headers });
}

function publicBaseUrl(env) {
  const raw = (env.PUBLIC_BASE_URL || '').trim();
  if (!raw) return '';
  try {
    const u = new URL(raw);
    if (u.protocol !== 'https:' && u.protocol !== 'http:') return '';
    return u.origin;
  } catch (_) {
    return '';
  }
}

function authEnabled(env) {
  return adminPassword(env).length > 0;
}

function adminPassword(env) {
  return typeof env.ADMIN_PASSWORD === 'string' ? env.ADMIN_PASSWORD.trim() : '';
}

async function handleLogin(request, env) {
  if (!authEnabled(env)) return redirectResponse('/');

  const url = new URL(request.url);
  const contentType = request.headers.get('Content-Type') || '';
  let password = '';
  if (contentType.includes('application/json')) {
    try { password = (await request.json()).password || ''; } catch (_) {}
  } else {
    const form = await request.formData();
    password = form.get('password') || '';
  }

  const next = safeNext(url.searchParams.get('next') || '/');
  const secret = adminPassword(env);
  if (!timingSafeEqual(password, secret)) return loginPage(request, env, '密码不正确，请重新输入。', 401);

  const issuedAt = Date.now().toString();
  const token = `${issuedAt}.${await signAuthValue(issuedAt, secret)}`;
  return new Response(null, {
    status: 303,
    headers: {
      Location: next,
      'Set-Cookie': `pakrpre_auth=${token}; Path=/; Max-Age=604800; HttpOnly; Secure; SameSite=Lax`,
    }
  });
}

function logoutResponse() {
  return new Response(null, {
    status: 303,
    headers: {
      Location: '/login',
      'Set-Cookie': 'pakrpre_auth=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Lax',
    }
  });
}

function authRequired(request) {
  const path = new URL(request.url).pathname;
  const apiPath = ['/build', '/status', '/logs', '/cancel', '/sync/check', '/sync/start', '/sync/status', '/sync/logs'].includes(path);
  if (!apiPath || request.headers.get('Accept')?.includes('text/html')) {
    return loginPage(request, {}, '', 401);
  }
  return json({ error: 'Unauthorized' }, 401);
}

function loginPage(request, env, error = '', status = 200) {
  const url = new URL(request.url);
  const next = safeNext(url.searchParams.get('next') || (url.pathname === '/login' ? '/' : url.pathname + url.search));
  const action = `/login?next=${encodeURIComponent(next)}`;
  const html = `<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>PakrPre 管理登录</title>
<style>
*{box-sizing:border-box}body{margin:0;min-height:100vh;display:grid;place-items:center;font-family:Inter,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;background:#f7f7f8;color:#111}.box{width:min(92vw,380px);background:#fff;border:1px solid #e8e8e8;border-radius:14px;padding:28px;box-shadow:0 18px 50px rgba(0,0,0,.08)}h1{margin:0 0 8px;font-size:22px;line-height:1.25}p{margin:0 0 22px;color:#666;font-size:14px;line-height:1.7}label{display:block;margin-bottom:8px;font-size:13px;font-weight:600;color:#333}input{width:100%;height:44px;border:1px solid #ddd;border-radius:9px;padding:0 12px;font:inherit;outline:none}input:focus{border-color:#111;box-shadow:0 0 0 3px rgba(0,0,0,.06)}button{width:100%;height:44px;margin-top:14px;border:0;border-radius:9px;background:#111;color:#fff;font-weight:700;font:inherit;cursor:pointer}.err{margin:0 0 14px;padding:10px 12px;border-radius:9px;background:#fff1f2;color:#be123c;font-size:13px}
</style>
</head>
<body>
<main class="box">
<h1>PakrPre 管理登录</h1>
<p>请输入管理密码后继续使用打包页面。下载链接和二维码也会受这个密码保护。</p>
${error ? `<div class="err">${escapeHtml(error)}</div>` : ''}
<form method="post" action="${action}">
<label for="password">管理密码</label>
<input id="password" name="password" type="password" autocomplete="current-password" autofocus required>
<button type="submit">进入</button>
</form>
</main>
</body>
</html>`;
  return new Response(html, { status, headers: { 'Content-Type': 'text/html; charset=utf-8' } });
}

function safeNext(next) {
  if (!next || !next.startsWith('/') || next.startsWith('//')) return '/';
  return next;
}

function parseCookies(request) {
  const out = {};
  const cookie = request.headers.get('Cookie') || '';
  for (const part of cookie.split(';')) {
    const i = part.indexOf('=');
    if (i > -1) out[part.slice(0, i).trim()] = decodeURIComponent(part.slice(i + 1).trim());
  }
  return out;
}

async function isAuthorized(request, env) {
  const secret = adminPassword(env);
  if (!secret) return true;
  const token = parseCookies(request).pakrpre_auth || '';
  const [issuedAt, sig] = token.split('.');
  const ts = Number(issuedAt);
  if (!Number.isFinite(ts) || Date.now() - ts > 7 * 24 * 60 * 60 * 1000) return false;
  const expected = await signAuthValue(issuedAt, secret);
  return timingSafeEqual(sig || '', expected);
}

async function signAuthValue(value, secret) {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(value));
  return base64Url(sig);
}

function base64Url(buf) {
  let s = '';
  for (const b of new Uint8Array(buf)) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function timingSafeEqual(a, b) {
  a = String(a || '');
  b = String(b || '');
  const len = Math.max(a.length, b.length);
  let diff = a.length ^ b.length;
  for (let i = 0; i < len; i++) diff |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0);
  return diff === 0;
}

function redirectResponse(location) {
  return new Response(null, { status: 303, headers: { Location: location } });
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}

async function handleBuild(request, env) {
  const { app_url, app_name, package_name, version_name, icon_mode, ua_mode, icon_url, icon_color, no_screenshot, window_mode, show_disclaimer } = await request.json();
  const buildId = crypto.randomUUID().replace(/-/g, '').slice(0, 12);
  if (!app_url || !app_name || !package_name || !version_name)
    return json({ error: 'Missing required fields' }, 400);
  const pkgRe = /^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*){1,}$/;
  if (!pkgRe.test(package_name))
    return json({ error: 'Invalid package name' }, 400);
  // 校验包名各段不能是 Java 关键字
  const JAVA_KEYWORDS = new Set(["abstract","assert","boolean","break","byte","case","catch","char","class","const","continue","default","do","double","else","enum","extends","final","finally","float","for","goto","if","implements","import","instanceof","int","interface","long","native","new","package","private","protected","public","return","short","static","strictfp","super","switch","synchronized","this","throw","throws","transient","try","void","volatile","while"]);
  const invalidSeg = package_name.split('.').find(seg => JAVA_KEYWORDS.has(seg));
  if (invalidSeg)
    return json({ error: `Package segment '${invalidSeg}' is a Java keyword and cannot be used in a package name` }, 400);
  // version_name 支持任意字符（1.0、2.0-beta、v3.1.0-rc1 等），仅限制长度
  if (!version_name || version_name.length > 32)
    return json({ error: 'version_name must be 1-32 characters' }, 400);
  const resolvedIconMode = icon_mode === 'url' ? 'url' : 'generated';
  const resolvedIconUrl = resolvedIconMode === 'url' && /^https?:\/\//i.test(icon_url || '') ? icon_url : '';
  const resolvedIconColor = /^#?[0-9a-f]{6}$/i.test(icon_color || '') ? icon_color : '#BF3EFF';
  const allowedUaModes = new Set(['auto', 'android', 'iphone', 'harmonyos', 'android_pad', 'ipad']);
  const resolvedUaMode = allowedUaModes.has(ua_mode) ? ua_mode : 'auto';

  const r = await gh(env,
    `/repos/${env.GITHUB_OWNER}/${env.GITHUB_REPO}/actions/workflows/build.yml/dispatches`,
    { method: 'POST', body: JSON.stringify({
        ref: 'main',
        inputs: {
          app_url,
          app_name,
          package_name,
          version_name,
          icon_mode: resolvedIconMode,
          ua_mode: resolvedUaMode,
          icon_url: resolvedIconUrl,
          icon_color: resolvedIconColor,
          no_screenshot: no_screenshot||'false',
          window_mode: window_mode||'false',
          show_disclaimer: show_disclaimer||'false',
          build_id: buildId
        }
    })}
  );
  if (r.status !== 204) return json({ error: 'Trigger failed', detail: await r.text() }, 500);

  // 立即返回，避免在 Worker 请求链路中等待 run_id 导致前端卡住
  return json({ status: 'queued', build_id: buildId, dispatched_at: new Date().toISOString() });
}

async function handleStatus(request, env) {
  const u = new URL(request.url);
  let runId = u.searchParams.get('run_id');
  const buildId = u.searchParams.get('build_id');

  if (!runId && buildId) {
    const dispatchedAt = u.searchParams.get('dispatched_at');
    const runsRes = await gh(env,
      `/repos/${env.GITHUB_OWNER}/${env.GITHUB_REPO}/actions/workflows/build.yml/runs?event=workflow_dispatch&per_page=20`
    );
    const runs = await runsRes.json();
    const matched = (runs.workflow_runs || []).find(r => (r.display_title || '').includes(buildId));
    if (!matched) return json({ status: 'queued', waiting_run_id: true, build_id: buildId, dispatched_at });
    runId = matched.id;
  }

  if (!runId) return json({ error: 'Missing run_id' }, 400);
  const data = await (await gh(env,
    `/repos/${env.GITHUB_OWNER}/${env.GITHUB_REPO}/actions/runs/${runId}`
  )).json();
  const result = { run_id: runId, build_id: buildId || null, status: data.status, conclusion: data.conclusion, job_id: null, step_index: 0, step_total: 0 };

  // 解析 job steps 获取精确进度
  const jobsRes = await gh(env,
    `/repos/${env.GITHUB_OWNER}/${env.GITHUB_REPO}/actions/runs/${runId}/jobs`
  );
  const jobs = await jobsRes.json();
  const job = jobs.jobs?.[0];
  if (job) {
    result.job_id = job.id;
    const steps = job.steps || [];
    const userSteps = steps.filter(s => !['Set up job','Post','Complete job','Cache'].some(k => s.name.includes(k)));
    const stepMap = { 'Inject':15,'Process':30,'Build':70,'Sign':90,'Upload':100 };
    let progress = 5, currentStep = '', stepIndex = 0;
    for (const step of userSteps) {
      if (step.status === 'completed' && step.conclusion === 'success') {
        stepIndex++;
        for (const [name, pct] of Object.entries(stepMap)) {
          if (step.name.includes(name)) progress = Math.max(progress, pct);
        }
      }
      if (step.status === 'in_progress') {
        currentStep = step.name;
        const base = Object.entries(stepMap).find(([n]) => step.name.includes(n));
        if (base) progress = Math.max(progress, base[1] - 10);
      }
    }
    result.progress    = progress;
    result.current_step = currentStep;
    result.step_index  = stepIndex;
    result.step_total  = userSteps.length || 5;
  }

  if (data.status === 'completed' && data.conclusion === 'success') {
    result.progress = 100;
    const arts = await (await gh(env,
      `/repos/${env.GITHUB_OWNER}/${env.GITHUB_REPO}/actions/runs/${runId}/artifacts`
    )).json();
    // 返回全部 artifacts，让前端展示多个 APK 下载选项
    if (arts.artifacts?.length) {
      result.artifacts = arts.artifacts.map(a => ({
        id: a.id,
        name: a.name,
      }));
      // 兼容旧字段
      result.artifact_id   = arts.artifacts[0].id;
      result.artifact_name = arts.artifacts[0].name;
    }
  }

  // 构建失败时找出失败步骤，并拉取该步骤的日志片段
  if (data.status === 'completed' && data.conclusion === 'failure') {
    const steps = jobs.jobs?.[0]?.steps || [];
    const failedStep = steps.find(s => s.conclusion === 'failure');
    if (failedStep) {
      result.failed_step = failedStep.name;
      // 拉取日志，截取最后 30 行作为错误摘要
      try {
        const logRes = await gh(env,
          `/repos/${env.GITHUB_OWNER}/${env.GITHUB_REPO}/actions/jobs/${jobs.jobs[0].id}/logs`
        );
        if (logRes.ok) {
          const logText = await logRes.text();
          const lines = logText.split('\n').filter(l => l.trim());
          // 找失败步骤附近的错误行（含 Error/error/FAILED/exception）
          const clean = lines.map(l =>
            l.replace(/^\d{4}-\d{2}-\d{2}T[\d:.]+Z /, '').replace(/\x1b\[[\d;]*m/g,'').trim()
          );
          const compileFail = clean.some(l => /Execution failed for task ':app:compileReleaseKotlin'|Compilation error|compileReleaseKotlin FAILED/i.test(l));
          if (compileFail) {
            const focused = clean.filter(l =>
              !/^##\[group\]|^##\[endgroup\]/i.test(l) &&
              !/^shell:|^env:|^with:|JAVA_HOME|ANDROID_HOME|GRADLE_USER/i.test(l)
            );
            result.failed_log = focused.slice(-220).join('\n');
          } else {
            const errLines = clean.filter(l =>
              /error|failed|exception|cannot|unable|no such|expecting|unresolved reference/i.test(l) &&
              !/^##\[group\]|^##\[endgroup\]/i.test(l)
            );
            result.failed_log = errLines.slice(-60).join('\n');
          }
        }
      } catch (_) {}
    }
  }

  return json(result);
}

async function handleLogs(request, env) {
  const p = new URL(request.url).searchParams;
  const runId = p.get('run_id'), jobId = p.get('job_id');
  if (!runId) return json({ lines: [] });
  let jid = jobId;
  if (!jid) {
    const jr = await gh(env, `/repos/${env.GITHUB_OWNER}/${env.GITHUB_REPO}/actions/runs/${runId}/jobs`);
    const jd = await jr.json();
    jid = jd.jobs?.[0]?.id;
  }
  if (!jid) return json({ lines: [] });
  try {
    const lr = await gh(env, `/repos/${env.GITHUB_OWNER}/${env.GITHUB_REPO}/actions/jobs/${jid}/logs`);
    if (!lr.ok) return json({ lines: [] });
    const raw = await lr.text();
    const lines = raw.split('\n')
      .map(l => l.replace(/^\d{4}-\d{2}-\d{2}T[\d:.]+Z /, '').replace(/\x1b\[[\d;]*m/g,'').trim())
      .filter(l => l &&
        !/^##\[group|^##\[endgroup/i.test(l) &&
        !/California|MIPS|Evaluation|Recipient|UL or FCC|Pre-Release|GOOGLE_|LIMITATION|LICENSE|jurisdic/i.test(l) &&
        !/^shell:|^env:|^with:|JAVA_HOME|ANDROID_HOME|GRADLE_USER/i.test(l)
      );
    return json({ lines: lines.slice(-350) });
  } catch(_) { return json({ lines: [] }); }
}

async function handleDownload(request, env) {
  const params     = new URL(request.url).searchParams;
  const runId      = params.get('run_id');
  const artifactId = params.get('artifact_id');
  if (!runId) return json({ error: 'Missing run_id' }, 400);

  const artifacts = await listRunArtifacts(env, runId);
  const artifact = artifactId
    ? artifacts.find(a => String(a.id) === String(artifactId))
    : artifacts[0];

  if (!artifact) return json({ error: 'Artifact not found', run_id: runId, artifact_id: artifactId || '' }, 404);
  if (artifact.expired) return json({ error: 'Artifact expired', artifact_id: artifact.id }, 410);

  const resolvedId = artifact.id;
  const artifactName = safeDownloadName(artifact.name || 'apk');

  const dlRedirect = await gh(env,
    `/repos/${env.GITHUB_OWNER}/${env.GITHUB_REPO}/actions/artifacts/${resolvedId}/zip`,
    { redirect: 'manual' }
  );
  const s3Url = dlRedirect.headers.get('location');
  if (!s3Url) return json({ error: 'Download redirect failed', status: dlRedirect.status }, 502);

  const dl = await fetch(s3Url);
  if (!dl.ok) return json({ error: 'Download failed from S3', status: dl.status }, 502);
  const zipBuf = await dl.arrayBuffer();

  try {
    const apk = await extractApkFromZip(zipBuf);
    if (apk && apk.byteLength > 0) {
      const apkName = artifactName.replace(/\.zip$/i, '') + '.apk';
      return new Response(apk, {
        headers: {
          'Content-Type': 'application/vnd.android.package-archive',
          'Content-Disposition': `attachment; filename="${apkName}"`,
          'Content-Length': apk.byteLength.toString(),
          'Cache-Control': 'no-store',
        }
      });
    }
  } catch (_) {}

  return new Response(zipBuf, {
    headers: {
      'Content-Type': 'application/zip',
      'Content-Disposition': `attachment; filename="${artifactName}.zip"`,
      'Cache-Control': 'no-store',
    }
  });
}

async function listRunArtifacts(env, runId) {
  const res = await gh(env, `/repos/${env.GITHUB_OWNER}/${env.GITHUB_REPO}/actions/runs/${runId}/artifacts`);
  const data = await res.json();
  return Array.isArray(data.artifacts) ? data.artifacts : [];
}

function safeDownloadName(name) {
  const cleaned = String(name || 'apk').replace(/[^\w.-]+/g, '_').slice(0, 160);
  return cleaned || 'apk';
}

async function extractApkFromZip(buf) {
  const view  = new DataView(buf);
  const bytes = new Uint8Array(buf);
  const decoder = new TextDecoder();
  const eocd = findZipEocd(view, bytes.length);

  if (eocd) {
    let centralOffset = view.getUint32(eocd + 16, true);
    const centralSize = view.getUint32(eocd + 12, true);
    const centralEnd = Math.min(bytes.length, centralOffset + centralSize);

    while (centralOffset + 46 <= centralEnd && view.getUint32(centralOffset, true) === 0x02014b50) {
      const compression = view.getUint16(centralOffset + 10, true);
      let compSize = view.getUint32(centralOffset + 20, true);
      let uncompSize = view.getUint32(centralOffset + 24, true);
      let localOffset = view.getUint32(centralOffset + 42, true);
      const nameLen = view.getUint16(centralOffset + 28, true);
      const extraLen = view.getUint16(centralOffset + 30, true);
      const commentLen = view.getUint16(centralOffset + 32, true);
      const nameStart = centralOffset + 46;
      const extraStart = nameStart + nameLen;
      const name = decoder.decode(bytes.slice(nameStart, extraStart));

      if (uncompSize === 0xffffffff || compSize === 0xffffffff || localOffset === 0xffffffff) {
        const zip64 = parseZip64Extra(bytes, extraStart, extraLen, { uncompSize, compSize, localOffset });
        uncompSize = zip64.uncompSize;
        compSize = zip64.compSize;
        localOffset = zip64.localOffset;
      }

      if (name.endsWith('.apk')) {
        const dataOffset = zipDataOffset(view, localOffset);
        return readZipEntry(buf, dataOffset, compSize, compression);
      }

      centralOffset = extraStart + extraLen + commentLen;
    }
  }

  let offset = 0;
  while (offset + 30 < bytes.length && view.getUint32(offset, true) === 0x04034b50) {
    const compression = view.getUint16(offset + 8, true);
    const compSize = view.getUint32(offset + 18, true);
    const nameLen = view.getUint16(offset + 26, true);
    const extraLen = view.getUint16(offset + 28, true);
    const name = decoder.decode(bytes.slice(offset + 30, offset + 30 + nameLen));
    const dataOffset = offset + 30 + nameLen + extraLen;
    if (name.endsWith('.apk') && compSize > 0) return readZipEntry(buf, dataOffset, compSize, compression);
    if (compSize <= 0) break;
    offset = dataOffset + compSize;
  }

  return null;
}

function findZipEocd(view, length) {
  const min = Math.max(0, length - 65557);
  for (let offset = length - 22; offset >= min; offset--) {
    if (view.getUint32(offset, true) === 0x06054b50) return offset;
  }
  return null;
}

function parseZip64Extra(bytes, offset, length, values) {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let cursor = offset;
  const end = offset + length;
  const nextU64 = () => {
    const value = Number(view.getBigUint64(cursor, true));
    cursor += 8;
    return value;
  };

  while (cursor + 4 <= end) {
    const headerId = view.getUint16(cursor, true);
    const size = view.getUint16(cursor + 2, true);
    cursor += 4;
    if (headerId === 0x0001) {
      if (values.uncompSize === 0xffffffff && cursor + 8 <= end) values.uncompSize = nextU64();
      if (values.compSize === 0xffffffff) {
        if (cursor + 8 <= end) values.compSize = nextU64();
      }
      if (values.localOffset === 0xffffffff && cursor + 8 <= end) values.localOffset = nextU64();
      return values;
    }
    cursor += size;
  }
  return values;
}

function zipDataOffset(view, localOffset) {
  if (view.getUint32(localOffset, true) !== 0x04034b50) throw new Error('Invalid ZIP local header');
  const nameLen = view.getUint16(localOffset + 26, true);
  const extraLen = view.getUint16(localOffset + 28, true);
  return localOffset + 30 + nameLen + extraLen;
}

async function readZipEntry(buf, dataOffset, compSize, compression) {
  const slice = buf.slice(dataOffset, dataOffset + compSize);
  if (compression === 0) return slice;
  if (compression === 8) {
    const ds = new DecompressionStream('deflate-raw');
    const writer = ds.writable.getWriter();
    await writer.write(new Uint8Array(slice));
    await writer.close();
    return new Response(ds.readable).arrayBuffer();
  }
  return null;
}

async function requireSyncAdmin(request, env) {
  if (!authEnabled(env)) {
    return json({ error: 'Upstream sync requires ADMIN_PASSWORD to be configured.' }, 403);
  }
  if (!(await isAuthorized(request, env))) return authRequired(request);
  return null;
}

function syncUpstreamRepo(env) {
  const repo = String(env.UPSTREAM_REPO || 'Pretic/PakrPre').trim();
  if (repo !== 'Pretic/PakrPre') {
    throw new Error('UPSTREAM_REPO is not allowed. Allowed value: Pretic/PakrPre');
  }
  return repo;
}

function syncUpstreamBranch(env) {
  const branch = String(env.UPSTREAM_BRANCH || 'main').trim();
  if (branch !== 'main') {
    throw new Error('UPSTREAM_BRANCH is not allowed. Allowed value: main');
  }
  return branch;
}

async function handleSyncTrigger(request, env, mode) {
  const denied = await requireSyncAdmin(request, env);
  if (denied) return denied;

  const syncId = crypto.randomUUID().replace(/-/g, '').slice(0, 12);
  const upstreamRepo = syncUpstreamRepo(env);
  const upstreamBranch = syncUpstreamBranch(env);
  const r = await gh(env,
    `/repos/${env.GITHUB_OWNER}/${env.GITHUB_REPO}/actions/workflows/sync-upstream.yml/dispatches`,
    { method: 'POST', body: JSON.stringify({
        ref: 'main',
        inputs: {
          sync_id: syncId,
          mode,
          upstream_repo: upstreamRepo,
          upstream_branch: upstreamBranch,
        }
    })}
  );
  if (r.status !== 204) return json({ error: 'Sync trigger failed', detail: await r.text() }, 500);

  return json({
    status: 'queued',
    mode,
    sync_id: syncId,
    upstream_repo: upstreamRepo,
    upstream_branch: upstreamBranch,
    dispatched_at: new Date().toISOString(),
  });
}

async function handleSyncStatus(request, env) {
  const denied = await requireSyncAdmin(request, env);
  if (denied) return denied;

  const u = new URL(request.url);
  let runId = u.searchParams.get('run_id');
  const syncId = u.searchParams.get('sync_id');
  if (!runId && syncId) {
    const runsRes = await gh(env,
      `/repos/${env.GITHUB_OWNER}/${env.GITHUB_REPO}/actions/workflows/sync-upstream.yml/runs?event=workflow_dispatch&per_page=20`
    );
    const runs = await runsRes.json();
    const matched = (runs.workflow_runs || []).find(r => (r.display_title || '').includes(syncId));
    if (!matched) return json({ status: 'queued', waiting_run_id: true, sync_id: syncId });
    runId = matched.id;
  }

  if (!runId) return json({ error: 'Missing run_id or sync_id' }, 400);
  const run = await (await gh(env,
    `/repos/${env.GITHUB_OWNER}/${env.GITHUB_REPO}/actions/runs/${runId}`
  )).json();

  const result = {
    run_id: runId,
    sync_id: syncId || null,
    status: run.status,
    conclusion: run.conclusion,
    html_url: run.html_url || null,
    progress: run.status === 'completed' ? 100 : 10,
    current_step: '',
    step_index: 0,
    step_total: 0,
    sync_status: '',
    pr_url: '',
    failed_step: '',
  };

  const jobsRes = await gh(env,
    `/repos/${env.GITHUB_OWNER}/${env.GITHUB_REPO}/actions/runs/${runId}/jobs`
  );
  const jobs = await jobsRes.json();
  const job = jobs.jobs?.[0];
  if (job) {
    const steps = job.steps || [];
    const userSteps = steps.filter(s => !['Set up job','Post','Complete job'].some(k => s.name.includes(k)));
    result.step_total = userSteps.length;
    for (const step of userSteps) {
      if (step.status === 'completed' && step.conclusion === 'success') result.step_index++;
      if (step.status === 'in_progress') result.current_step = step.name;
    }
    const pctByStep = result.step_total ? Math.round((result.step_index / result.step_total) * 90) : 10;
    result.progress = run.status === 'completed' ? 100 : Math.max(10, Math.min(95, pctByStep));
    const failed = steps.find(s => s.conclusion === 'failure');
    if (failed) result.failed_step = failed.name;

    if (run.status === 'completed') {
      const logText = await fetchJobLogText(env, job.id);
      Object.assign(result, parseSyncLogInfo(logText));
    }
  }

  return json(result);
}

async function handleSyncLogs(request, env) {
  const denied = await requireSyncAdmin(request, env);
  if (denied) return denied;

  const p = new URL(request.url).searchParams;
  const runId = p.get('run_id'), jobId = p.get('job_id');
  if (!runId) return json({ lines: [] });
  let jid = jobId;
  if (!jid) {
    const jr = await gh(env, `/repos/${env.GITHUB_OWNER}/${env.GITHUB_REPO}/actions/runs/${runId}/jobs`);
    const jd = await jr.json();
    jid = jd.jobs?.[0]?.id;
  }
  if (!jid) return json({ lines: [] });
  const raw = await fetchJobLogText(env, jid);
  return json({ lines: cleanGitHubLogLines(raw).slice(-350) });
}

async function fetchJobLogText(env, jobId) {
  try {
    const lr = await gh(env, `/repos/${env.GITHUB_OWNER}/${env.GITHUB_REPO}/actions/jobs/${jobId}/logs`);
    if (!lr.ok) return '';
    return await lr.text();
  } catch (_) {
    return '';
  }
}

function cleanGitHubLogLines(raw) {
  return String(raw || '').split('\n')
    .map(l => l.replace(/^\d{4}-\d{2}-\d{2}T[\d:.]+Z /, '').replace(/\x1b\[[\d;]*m/g,'').trim())
    .filter(l => l &&
      !/^##\[group|^##\[endgroup/i.test(l) &&
      !/^shell:|^env:|^with:|JAVA_HOME|ANDROID_HOME|GRADLE_USER/i.test(l)
    );
}

function parseSyncLogInfo(raw) {
  const text = String(raw || '');
  const pr = text.match(/SYNC_PR_URL=(https:\/\/\S+)/);
  const syncStatus = text.match(/SYNC_STATUS=([a-z_]+)/);
  return {
    pr_url: pr ? pr[1] : '',
    sync_status: syncStatus ? syncStatus[1] : '',
  };
}

function gh(env, path, opts = {}) {
  const token = env.GITHUB_TOKEN || env.GH_PAT;
  if (!token) throw new Error('Missing GitHub token: set GITHUB_TOKEN or GH_PAT');
  return fetch(`https://api.github.com${path}`, {
    ...opts,
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      'User-Agent': 'APK-Builder-CF-Worker/1.0',
      'Content-Type': 'application/json',
      ...(opts.headers || {}),
    }
  });
}

function json(d, s = 200) { return new Response(JSON.stringify(d), { status: s, headers: { 'Content-Type': 'application/json' } }); }
async function handleCancel(request, env) {
  const runId = new URL(request.url).searchParams.get('run_id');
  if (!runId) return json({ error: 'Missing run_id' }, 400);
  const r = await gh(env,
    `/repos/${env.GITHUB_OWNER}/${env.GITHUB_REPO}/actions/runs/${runId}/cancel`,
    { method: 'POST' }
  );
  // 202 = cancel accepted, 409 = already completed
  if (r.status === 202 || r.status === 409) return json({ ok: true });
  return json({ error: 'Cancel failed', status: r.status }, 500);
}

function cors(res, env) {
  const h = new Headers(res.headers);
  h.set('Access-Control-Allow-Origin',  '*');
  h.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  h.set('Access-Control-Allow-Headers', 'Content-Type');
  return new Response(res.body, { status: res.status, headers: h });
}
