# 快速开始

本页面介绍如何在 3 分钟内完成部署，开始使用 Pakr。

## 前置要求

- **GitHub 账号** — 用于 Actions 构建
- **Cloudflare 账号** — 用于 Pages 托管

## 第一步：Fork 仓库

点击右上角 **Fork**，将 [ZhangShengFan/Pakr](https://github.com/ZhangShengFan/Pakr) Fork 到你自己的账号下。

## 第二步：生成签名 Keystore

进入你 Fork 的仓库 → **Actions** → **gen-keystore** → **Run workflow**

填写密码后运行，完成后在 Actions 日志里复制输出的 **Base64 Keystore 字符串**，备用。

## 第三步：配置 GitHub Secrets

进入仓库 → **Settings** → **Secrets and variables** → **Actions** → **New repository secret**

| Secret 名称 | 说明 |
|-------------|------|
| `KEYSTORE_BASE64` | 上一步输出的 Base64 Keystore 字符串 |
| `KEYSTORE_PASSWORD` | Keystore 密码（gen-keystore 时设置的） |
| `KEY_ALIAS` | Key 别名（默认 `release`） |
| `KEY_PASSWORD` | Key 密码（同 Keystore 密码） |

## 第四步：部署到 Cloudflare Pages

1. 进入 [Cloudflare Dashboard](https://dash.cloudflare.com) → **Workers & Pages** → **Create** → **Pages** → **Connect to Git**
2. 授权并选择你 Fork 的仓库，填写构建配置：

   | 配置项 | 值 |
   |--------|----|
   | Framework preset | None |
   | Build command | （留空） |
   | Build output directory | `/`（根目录） |

3. **Settings** → **Variables and Secrets** 添加：

   | 名称 | 类型 | 值 |
   |------|------|----|
   | `GITHUB_OWNER` | 文本变量 | 你的 GitHub 用户名 |
   | `GITHUB_REPO` | 文本变量 | `Pakr` |
   | `GH_PAT` | 加密 Secret | 仅授权当前仓库、拥有 **Actions: Read and write** 权限的 fine-grained PAT |

4. 保存变量后重新部署一次，等待部署完成。

> `GH_PAT` 是 Pages Function 调用 GitHub API 使用的凭据，应保存在 Cloudflare，而不是仓库的 Actions Secrets。若页面提示 `Bad credentials`，请重新生成 PAT、更新该 Secret 并重新部署。

## 第五步：验证

打开 Pages 分配的域名，填写测试信息，点击「开始打包」，等待 3~5 分钟后下载 APK 安装验证。
