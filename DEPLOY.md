# 部署指南：从零到公网可访问

跟着做完第 0～4 步，你的博客就有了一个可以发给别人的链接。第 5、6 步是评论和阅读计数，可以之后再补。

---

## 0. 开始前需要准备什么

| 东西 | 说明 | 是否必需 |
| --- | --- | --- |
| Node.js 18+ | 本地构建用，推荐 20 或 22，[nodejs.org](https://nodejs.org) | 必需 |
| GitHub 账号 | 存代码 + 承载评论 | 必需 |
| Cloudflare 账号 | 托管静态站点，免费额度对个人博客用不完 | 必需 |
| 你的域名 | 免费域名同样适用；没有也能先上线，Pages 会送一个 `xxx.pages.dev` | 可选 |
| 一个能改 DNS/NS 的注册商后台 | 把域名交给 Cloudflare 解析 | 绑域名时必需 |

整体链路：

```
本地写 Markdown → push 到 GitHub → Cloudflare Pages 自动构建
                                   → xxx.pages.dev（几十秒后可用）
                                   → 你的域名（改完 NS 生效后可用）
```

---

## 1. 先在本地跑起来，并改成你自己的

解压项目后，在**项目根目录**（能看到 `package.json` 的那一层）打开终端：

```bash
npm install
npm run dev
```

浏览器打开 <http://localhost:4321>，能看到首页就说明环境没问题。按 `Ctrl + C` 停止。

> **国内下载慢或报错**：先把 npm 源切到国内镜像，再装依赖。
> ```bash
> npm config set registry https://registry.npmmirror.com
> npm install
> ```
> 项目**不带** `package-lock.json`，这样每台机器都会用自己配置的源去解析依赖，
> 不会出现"锁文件里的下载地址和当前源不一致"的冲突。`npm install` 会在你本地生成一份 lock 文件，
> 提交上去即可（Cloudflare Pages 会自动用 `npm ci` 复现同一份依赖）。


### 1.1 改站点信息

编辑 `src/config.ts`：

```ts
export const SITE = {
  title: '拾光集',              // 换成你的站名
  tagline: '写代码，也写代码之外的事。',
  hero: '慢慢写，\n慢慢读。',    // 首页两行大标题，\n 是换行
  author: '404',                // 换成你的名字
  since: 2026,                  // 建站年份
  icp: '',                      // 国内备案才填，海外托管留空
};

export const NAV = [ /* 导航项，可增删 */ ];
export const SOCIAL = [ /* GitHub / RSS / 邮箱等链接 */ ];
```

`GISCUS` 那一段暂时留空，第 5 步再填。

### 1.2 改域名（有域名就现在改掉）

`astro.config.mjs`：

```js
export default defineConfig({
  site: 'https://你的域名.com',   // ← 改这里
});
```

`public/robots.txt` 里的 `Sitemap:` 那一行也一起改。

> 还没确定域名的话，先填 Pages 给的地址，例如 `https://my-blog.pages.dev`，之后再改回来重新部署即可。

### 1.3 删掉示例文章，写你自己的

`src/content/blog/` 下的 4 篇 `.md` 都是示例，直接删掉，然后：

```bash
npm run new "我的第一篇文章" -- --tag 随笔
```

生成的是**草稿**（`draft: true`），写完把这一行删掉或改成 `false`：

```bash
npm run build     # 确认能构建成功，没有报错
```

---

## 2. 把代码传到 GitHub

### 方式 A：命令行（推荐）

先在 GitHub 网页上点 **New repository** 建一个空仓库（**不要**勾选 Add README / .gitignore），拿到仓库地址，然后在项目根目录：

```bash
git init
git add .
git commit -m "init blog"
git branch -M main
git remote add origin https://github.com/你的用户名/你的仓库名.git
git push -u origin main
```

如果提示要登录，用 GitHub 的 Personal Access Token 当密码，或者装 [GitHub CLI](https://cli.github.com) 后执行 `gh auth login`。

### 方式 B：网页直接上传

仓库页面 → **Add file → Upload files** → 把项目文件夹里的内容**除 `node_modules` 外**全部拖进去 → Commit。
（`node_modules` 很大而且不需要上传，Pages 会自己 `npm install`。）

---

## 3. 连接 Cloudflare Pages，拿到第一个公网链接

1. 登录 <https://dash.cloudflare.com>
2. 左侧 **Workers & Pages** → **Create** → 选 **Pages** 标签 → **Connect to Git**
3. 首次会让你授权 GitHub，选中刚才的仓库
4. 构建配置按下表填：

   | 配置项 | 填写内容 |
   | --- | --- |
   | Project name | 随便起，会变成域名前缀，例如 `my-blog` |
   | Production branch | `main` |
   | Framework preset | **Astro**（选它会自动带出下面两项） |
   | Build command | `npm run build` |
   | Build output directory | `dist` |

5. **Save and Deploy**，等 1～2 分钟

部署完成后会显示一个 `https://my-blog.pages.dev` 地址，点开就是你的博客。
每次 `git push`，Pages 都会自动重新构建发布，不用手动操作。

> 如果这一步构建失败，90% 是本地没 `npm run build` 验证过。先在本地把它跑通，把报错贴给我或搜一下，再回来看第 9 节的排查表。

---

## 4. 绑定你自己的免费域名

分两段：**先把域名的解析权交给 Cloudflare，再在 Pages 上绑定。**

### 4.1 在 Cloudflare 添加域名

1. Cloudflare 控制台首页 → **Add a domain**（或左侧 **Websites → Add a site**）
2. 输入你的域名（不带 `https://`），例如 `myblog.us.kg`
3. 计划选 **Free**（页面最下方，容易被忽略）
4. Cloudflare 扫描现有解析记录 → 一路 Continue → 它会给你两个 NS 地址：

   ```
   xxx.ns.cloudflare.net
   yyy.ns.cloudflare.net
   ```

5. **先别关这个页面**，下一步要用。

### 4.2 到注册商把 NS 改掉

登录你的域名注册商后台，找到域名的 **Nameservers / DNS 服务器 / NS 记录** 设置，
删除原有的，改成上面那两个 Cloudflare 地址。各家叫法不同：

| 注册商 | 入口大致位置 |
| --- | --- |
| us.kg | 控制台 → 域名 → Manage → Nameservers |
| Namecheap | Domain List → Manage → **Nameservers** 选 `Custom DNS` |
| 阿里云/腾讯云买的域名 | 域名管理 → DNS 修改 → 修改 DNS 服务器 |
| Spaceship / Porkbun | Domain → Nameservers → Custom |

改完回到 Cloudflare 页面点 **I updated my nameservers**。

### 4.3 等生效

- 通常十分钟到几小时，最长可能 24～48 小时，`us.kg` 这类一般较快
- 状态从 *Pending Nameserver Update* 变成 *Active* 就是好了
- 自己查：终端执行 `dig NS myblog.us.kg +short`，看到两个 `ns.cloudflare.net` 就说明生效了
- Cloudflare 也会发邮件通知你

> **重要**：NS 改了之后，域名解析全部由 Cloudflare 接管。如果这个域名原来还挂着别的网站或邮箱，需要先在 Cloudflare 的 **DNS → Records** 里把原记录补上，否则会断。

### 4.4 在 Pages 上绑定域名

1. 回到 **Workers & Pages → 你的 Pages 项目**
2. **Custom domains** → **Set up a custom domain**
3. 输入 `myblog.us.kg`（或者你的 `blog.你的域名.com` 这种子域）
4. Cloudflare 会自动创建 DNS 记录并开启橙云代理，点确认
5. 稍等几分钟，SSL 证书自动签发，`https://myblog.us.kg` 就能访问了

建议再绑一个 `www.` 版本，并在 **Custom domains** 里给其中一个加 **Redirect**，避免出现两份重复内容。

### 4.5 域名不能用时的两个替代方案

- **注册商不让改 NS**（有些免费二级域名有此限制）：在能改 DNS 的地方加一条
  `CNAME` 记录，主机记录填 `blog`，值填 `my-blog.pages.dev`，然后按 4.4 绑定 `blog.xxx`。
- **暂时不绑域名**：直接用 `my-blog.pages.dev`，一样是 https，一样能分享。

---

## 5. 开启评论区（giscus + GitHub Discussions）

评论数据存在一个 GitHub 仓库的 Discussions 里，你不用维护任何数据库。

### 5.1 建一个专门放评论的仓库

1. GitHub → **New repository**
2. 名字随意，例如 `blog-comments`；**Public（必须是公开仓库）**
3. 不用勾选任何初始化选项，直接 Create

> 建议单独建，别和博客代码仓库混用：评论回复的邮件通知不会和代码 issue 混在一起，以后换建站工具评论也能继续用。

### 5.2 打开 Discussions 功能

仓库页面 → **Settings** → **General** → 往下找到 **Features** → 勾选 **Discussions**。

### 5.3 安装 giscus App

1. 打开 <https://github.com/apps/giscus> → **Install**
2. 选择 **Only select repositories** → 选中 `blog-comments` → Install

### 5.4 生成四个 ID

打开 <https://giscus.app/zh-CN>：

- **仓库**填 `你的用户名/blog-comments`，右边出现 ✅ 说明前面 5.1～5.3 都对了
- **讨论区分类**选 `Announcements`（推荐：只有你能开新帖，访客乱开主题的风险小）
- 页面下方"启用 giscus"会生成一段 `<script>`，从里面抄四个值

### 5.5 填回配置

编辑 `src/config.ts`：

```ts
export const GISCUS = {
  repo: 'your-name/blog-comments',      // 仓库全名
  repoId: 'R_kgDOxxxxxxxxxx',           // 复制 data-repo-id
  category: 'Announcements',            // 和上一步选的一致
  categoryId: 'DIC_kwDOxxxxxxxxxx',     // 复制 data-category-id
  lang: 'zh-CN',
  theme: 'preferred_color_scheme',
};
```

```bash
npm run build && git add . && git commit -m "feat: enable giscus" && git push
```

部署完成后刷新文章页，底部就是评论框了。发言需要 GitHub 账号，回复会发邮件通知。

> 本项目用了 `data-mapping="specific"` + 文章 slug 来匹配讨论帖，所以以后你改文章路径，评论也不会丢。

---

## 6. 可选：打开阅读计数（Pages Functions + KV）

不做这一步博客一切正常，只是文章侧栏不显示阅读数。

1. Cloudflare 控制台左侧 **Workers & Pages → KV**（或在 Storage & databases 里找 KV）→ **Create namespace**，名字如 `blog-views`
2. 进入你的 **Pages 项目 → Settings → Functions → KV namespace bindings**
3. **Add binding**：Variable name 填 `VIEWS`，KV namespace 选刚建的 `blog-views`
4. 回到 **Deployments**，对最新的部署点 **Retry deployment**（或再 push 一次）——绑定必须重新部署才生效

接口说明：

| 方法 | 路径 | 行为 |
| --- | --- | --- |
| `POST` | `/api/views/文章slug` | 计数 +1，返回 `{ slug, views }` |
| `GET` | `/api/views/文章slug` | 只读取，不加一 |

前端在文章加载后 POST 一次拿到数字显示。没绑 KV 时接口返回 503，前端会**自动隐藏**计数区域，页面不会报错。

> 注意：一次页面加载算一次阅读，刷新会重复计数（这是最简做法）。想更严格可以在 `functions/api/views/[slug].js` 里加 cookie 或按 IP 去重。

---

## 7. 日常更新

### 方式 A：用图形控制台（推荐，不用敲命令）

```bash
npm run admin      # 打开 http://127.0.0.1:4322
```

点「新建文章」→ 左边列表选中文 → 中间写 Markdown，右边实时预览 →
「构建检查」确认没问题 → 「发布上线」，剩下的 `git add / commit / push` 它自动做。

发布后底部日志会打印 git 输出；如果提示要配 `git config user.name/user.email`，
照抄那两行执行一次即可（只需一次）。

### 方式 B：命令行

```bash
# 新建一篇草稿
npm run new "文章标题" -- --tag 技术

# 本地看效果
npm run dev

# 确认构建通过后发布
npm run build
git add .
git commit -m "post: 文章标题"
git push
```

push 完大约一分钟后线上就更新了。回滚也简单：Pages 项目 → **Deployments** → 找到旧部署 → **Rollback to this deployment**。

---

## 8. 备选部署方式

### 8.1 用 wrangler 命令行直传（不想连 GitHub 时）

```bash
npm install --D wrangler
npm run build
npx wrangler pages project create my-blog --production-branch main
npx wrangler pages deploy dist
```

`wrangler.toml` 已经在项目里，取消注释 `[[kv_namespaces]]` 并填上 id，就能在命令行部署时也带上 KV 绑定。

### 8.2 换成 GitHub Pages

如果你更想用 GitHub Pages（纯静态，没有 Functions，阅读计数会失效但页面正常）：

1. 仓库加一个 `.github/workflows/deploy.yml`，用 `actions/deploy-pages` 跑 `npm run build`
2. 仓库 **Settings → Pages → Source** 选 **GitHub Actions**
3. `astro.config.mjs` 里加 `base: '/仓库名'`（用 `用户名.github.io` 仓库则不用）
4. 域名在 GitHub Pages 的 Custom domain 里填，并按提示到 DNS 加 CNAME

Cloudflare 仍可以只做 DNS + CDN：在 Cloudflare 里给域名加 CNAME 指向 `用户名.github.io`，橙云开着即可。

---

## 9. 常见问题排查

| 现象 | 原因 / 解决 |
| --- | --- |
| `npm install` 报 `EALLOWREMOTE`，提示 `Refusing to fetch "xxx@https://registry.npmmirror.com/..."` | `package-lock.json` 里的下载源和你本机的 npm 源不一致，新版 npm 会拒绝拉取非本源的 tarball。删掉项目里的 `package-lock.json` 再 `npm install`（本项目已不附带该文件）；国内可先 `npm config set registry https://registry.npmmirror.com` 让两者一致 |
| Pages 构建失败 `command not found: npm` | 构建配置里没选 Astro 预设，手动把 Build command 填成 `npm run build`，Output 填 `dist` |
| 构建失败 `Cannot find module ...` | `package.json` 或 `package-lock.json` 没提交，仓库缺文件 |
| 构建成功但页面 404 | Output directory 填错（应为 `dist`，不是 `build` 或 `public`） |
| Cloudflare 一直 *Pending Nameserver Update* | NS 未生效，等；用 `dig NS 域名 +short` 确认；确认没有同时留着旧 NS |
| 域名能开但显示证书错误 | 刚绑定还在签发，等 5～30 分钟；确认橙云代理是开启状态 |
| 文章页没有评论框，只有一句提示 | `src/config.ts` 里 giscus 四个字段没填全，或没重新部署 |
| 评论框报 "Error: 未找到仓库" | 仓库不是 Public，或 giscus App 没装到这个仓库 |
| 评论能看不能发 | Discussions 功能没开；或分类名和 `category` 填的不一致 |
| 阅读数一直不显示 | KV 没绑定、变量名不是 `VIEWS`、或绑定后没重新部署 |
| 中文标题乱码 | md 文件不是 UTF-8 编码，用 VS Code 右下角切到 UTF-8 重新保存 |
| RSS 里链接打不开 | `astro.config.mjs` 的 `site` 还是示例域名，改完重新部署 |
| 本地正常，线上样式没了 | 检查是不是把 `dist/` 提交进仓库了；`dist`、`node_modules`、`.astro` 都应被 git 忽略 |

---

## 10. 上线前检查清单

- [ ] `src/config.ts` 站名、作者、社交链接都换成了自己的
- [ ] `astro.config.mjs` 的 `site` 是正式域名
- [ ] `public/robots.txt` 的 Sitemap 地址是正式域名
- [ ] 示例文章已删除，第一篇文章 `draft` 不为 `true`
- [ ] `npm run build` 本地能通过
- [ ] Pages 部署成功，`pages.dev` 地址可访问
- [ ] 自定义域名可访问，且 `https://` 正常（无证书警告）
- [ ] 手机上打开首页和文章页，排版正常
- [ ] 深浅色切换正常，评论框跟随换肤
- [ ] `/rss.xml` 和 `/sitemap-index.xml` 能打开
- [ ] 随便点一篇文章，评论能发出去（用另一个 GitHub 账号试最好）
- [ ] 去 Google Search Console / Bing Webmaster 提交 sitemap（可选，为了收录）

