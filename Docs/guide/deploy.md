# 部署说明

## 注意事项

- GitHub Actions 免费账号每月有 **2000 分钟**额度，单次构建约消耗 **3~5 分钟**
- 正式使用建议配置并备份 Keystore Secrets；未配置时使用与“仓库 + 包名”绑定的确定性开发签名
- 打包历史记录保存在浏览器本地，清除缓存后会丢失

## GitHub 令牌

Cloudflare Pages 的 Production 环境必须配置加密变量 `GH_PAT`（或 `GITHUB_TOKEN`）、`GITHUB_OWNER` 和 `GITHUB_REPO`。推荐使用仅授权目标仓库的 Fine-grained PAT，并授予 **Actions: Read and write**。修改令牌后重新部署生产环境；若页面提示 `Bad credentials`，说明令牌无效或已过期，并非 Gradle 构建失败。

## 自定义域名

在 Cloudflare Pages 项目设置中 → **Custom domains** → 添加你的域名即可，SSL 自动配置。

## 更新部署

主仓库有新提交时，只需在 Cloudflare Pages 控制台手动触发重新部署，或开启 **Auto Deployment** 让每次 push 自动更新。

## Upstream Sync

- The app can trigger `.github/workflows/sync-upstream.yml` from the admin UI.
- Sync is PR-based: it checks `ZhangShengFan/Pakr/main`, creates a `sync/upstream-*` branch, and opens a pull request.
- It does not push directly to `main` and does not deploy Cloudflare Pages by itself.
- Cloudflare Pages deploys only after the sync PR is reviewed and merged into `main`.
- Keep `ADMIN_PASSWORD` configured before enabling this feature; sync endpoints are disabled without it.

## 项目结构

```

Pakr/
├── .github/workflows/
│   ├── build.yml              # 主构建流程
│   └── gen-keystore.yml       # 生成签名 Keystore
├── Scripts/
│   └── process_icon.py        # 图标处理脚本
├── index.html                 # 前端页面
├── _worker.js                 # API 接口（与前端合并部署）
└── app/                       # Android 项目源码
    └── src/main/java/com/webviewapp/
        ├── MainActivity.kt
        ├── SplashActivity.kt
        ├── TopProgressBar.kt
        └── IOSSpinnerView.kt
```
