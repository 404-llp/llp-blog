# 拾光集 · 个人博客

一个用 [Astro](https://astro.build) 构建的静态博客模板，部署在 Cloudflare Pages 上，
评论区由 [giscus](https://giscus.app/zh-CN)（GitHub Discussions）提供，
阅读计数用 Cloudflare Pages Functions + KV 实现。**零服务器、零数据库运维。**

> 部署上线的完整步骤见 **[DEPLOY.md](./DEPLOY.md)**。

## 功能

- 首页：报头式排版 + 目录式文章列表 + "现在"卡片
- 文章页：自动生成目录（TOC，滚动高亮）、阅读时长、上一篇/下一篇、阅读计数
- 归档页：按年份分组，点标签即可前端筛选（无刷新）
- 评论：giscus，数据存在你自己的 GitHub 仓库里
- 深浅色主题：跟随系统，可手动切换，记忆在 localStorage，评论区同步换肤
- RSS 订阅（`/rss.xml`）、Sitemap（`/sitemap-index.xml`）、自定义 404
- 响应式：桌面左侧固定栏，移动端顶部栏
- 字体本地自托管（不依赖 Google Fonts，国内访问不受影响）
- Markdown 代码高亮（Shiki，深浅双主题）

## 本地开发

需要 Node.js 18 以上（推荐 20 或 22）。

```bash
npm install
npm run dev        # 打开 http://localhost:4321
npm run build      # 构建到 dist/
npm run preview    # 本地预览构建产物
```

## 写文章

```bash
npm run new "文章标题" -- --tag Astro --tag 部署
```

会在 `src/content/blog/` 下生成 `日期-标题.md`，写好把 `draft` 改成 `false` 即可发布。

frontmatter 支持的字段：

| 字段 | 必填 | 说明 |
| --- | --- | --- |
| `title` | 是 | 文章标题 |
| `description` | 是（建议） | 摘要，同时用于 SEO / RSS / 首页列表 |
| `date` | 是 | 发布日期，`YYYY-MM-DD` |
| `updated` | 否 | 更新后会显示"更新于" |
| `tags` | 否 | 数组，用于归档页筛选 |
| `draft` | 否 | `true` 时不构建、不进 RSS 和 sitemap |

文件名会决定网址：`src/content/blog/2026-09-20-hello-world.md` → `/blog/2026-09-20-hello-world`。

## 需要改的配置

只改两个文件：

**`src/config.ts`** — 站名、副标题、首页大标题、作者、导航、社交链接、giscus 四个 ID、备案号。

**`astro.config.mjs`** — 把 `site` 换成你的正式域名（决定 canonical / sitemap / RSS 里的绝对地址）。

## 目录结构

```
├── astro.config.mjs          # Astro 配置（site 必须改成你的域名）
├── wrangler.toml             # Cloudflare Pages / KV 绑定声明
├── functions/
│   └── api/views/[slug].js   # 阅读计数接口（Pages Functions）
├── public/                   # 静态资源，原样复制到站点根目录
│   ├── favicon.svg
│   ├── robots.txt            # 里面的 Sitemap 地址记得改
│   └── _headers              # Cloudflare Pages 缓存与安全响应头
├── scripts/new-post.mjs      # npm run new
└── src/
    ├── config.ts             # 全站配置
    ├── content.config.ts     # 内容集合 schema
    ├── content/blog/*.md     # 文章
    ├── layouts/
    │   ├── BaseLayout.astro  # 页面骨架、导航、主题脚本
    │   └── PostLayout.astro  # 文章页布局
    ├── components/
    │   ├── Comments.astro    # giscus
    │   ├── PostEntry.astro   # 列表项
    │   ├── Toc.astro         # 目录
    │   └── ViewCounter.astro # 阅读数
    ├── pages/                # 路由
    │   ├── index.astro       # 首页
    │   ├── archive.astro     # 归档
    │   ├── about.astro       # 关于
    │   ├── 404.astro
    │   ├── rss.xml.js
    │   └── blog/[...slug].astro
    ├── styles/global.css     # 全站样式（设计令牌在最上面）
    └── utils/format.ts       # 日期 / 阅读时长 / 摘要
```

## 换配色和字体

`src/styles/global.css` 顶部的 `:root` 就是全部设计令牌，改这几个变量即可换肤：

```css
--paper:  #f1f3ef;   /* 页面底色 */
--ink:    #131a15;   /* 主文字 */
--pine:   #1d5743;   /* 强调色（链接、标签、目录高亮） */
--marker: #c9f24e;   /* 荧光标记色（签名元素） */
```

深色模式对应 `:root[data-theme='dark']`。字体在 `--font-display` / `--font-body` / `--font-mono`，
西文标题用的是本地打包的 Instrument Serif，正文用系统无衬线，日期和标签用 IBM Plex Mono。

## 许可

模板代码可自由使用与修改。示例文章内容替换成你自己的即可。
