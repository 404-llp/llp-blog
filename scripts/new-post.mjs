#!/usr/bin/env node
/**
 * 新建一篇文章：
 *   npm run new "我的文章标题"
 *   npm run new 我的文章标题 -- --tag Astro --tag 部署
 */
import { mkdir, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';

const args = process.argv.slice(2);
const tags = [];
const titleParts = [];

for (let i = 0; i < args.length; i++) {
  if (args[i] === '--tag') tags.push(args[++i] ?? '');
  else titleParts.push(args[i]);
}

const title = titleParts.join(' ').trim();
if (!title) {
  console.error('用法：npm run new "文章标题" [--tag 标签]');
  process.exit(1);
}

const dir = path.resolve('src/content/blog');
await mkdir(dir, { recursive: true });

const now = new Date();
const fmt = (d) => d.toISOString().slice(0, 10);
let file = path.join(dir, `${fmt(now)}-${title}.md`);
let n = 2;
while (existsSync(file)) {
  file = path.join(dir, `${fmt(now)}-${title}-${n++}.md`);
}

const body = `---
title: ${JSON.stringify(title)}
description: ""
date: ${fmt(now)}
tags: ${JSON.stringify(tags.filter(Boolean))}
draft: true
---

从这里开始写。

## 第一个小标题

正文段落。写完把 frontmatter 里的 \`draft\` 改成 \`false\`（或删掉这一行）就会发布。
`;

await writeFile(file, body, 'utf8');
console.log(`已创建草稿：${path.relative(process.cwd(), file)}`);
