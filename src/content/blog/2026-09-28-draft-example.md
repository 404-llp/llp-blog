---
title: 这是一篇草稿示例
description: draft 为 true 时不会出现在线上站点，也不会进入 RSS 和 sitemap。
date: 2026-09-28
tags: [随笔]
draft: true
---

## 草稿怎么用

`frontmatter` 里写上 `draft: true`，构建时就会被过滤掉：

```yaml
---
title: 还没写完的想法
date: 2026-09-28
draft: true
---
```

想发布时把它删掉或改成 `false`，push 一次就上线了。

好处是**未完成的想法也可以进仓库**——本地 `npm run dev` 时它们照样能看到，方便随时接着写；线上访客则完全看不到。

想新建一篇，直接：

```bash
npm run new "文章标题" -- --tag 随笔
```

它会在 `src/content/blog/` 下生成一个带日期前缀的文件，并自动填好 frontmatter。
