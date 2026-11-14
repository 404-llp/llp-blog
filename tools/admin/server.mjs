/**
 * 博客本地管理后台 —— 零依赖，只用 Node 内置模块。
 *   npm run admin   →  http://127.0.0.1:4322
 *
 * 能力：文章列表 / 新建 / 编辑保存 / 删除、实时预览样式、
 *       本地构建校验、一键 git 提交并推送（触发 Cloudflare Pages 自动部署）。
 *
 * 安全：只监听 127.0.0.1；每次启动生成一次性 token，写操作必须带 token；
 *       文件名做白名单校验，不接受任何路径穿越。
 */
import { createServer } from 'node:http';
import { readFile, writeFile, readdir, unlink, stat } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..', '..');
const BLOG_DIR = path.join(ROOT, 'src', 'content', 'blog');
const UI_FILE = path.join(HERE, 'index.html');
const CSS_FILE = path.join(ROOT, 'src', 'styles', 'global.css');

const PORT = Number(process.env.ADMIN_PORT || 4322);
const HOST = '127.0.0.1';
const TOKEN = randomBytes(16).toString('hex');

/* 文件名白名单：字母数字、下划线、连字符、中文、点，且必须是 .md */
const SAFE_NAME = /^[\w\u4e00-\u9fa5.-]+\.md$/u;

/** 校验并返回文章的绝对路径，非法输入直接抛错 */
function postPath(file) {
  const name = String(file ?? '').trim();
  if (!SAFE_NAME.test(name)) throw httpError(400, `文件名不合法：${name}`);
  return path.join(BLOG_DIR, name);
}

function httpError(status, message) {
  const err = new Error(message);
  err.status = status;
  return err;
}

/* ---------- 文章读写 ---------- */
const FM_RE = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/;
const META_KEYS = new Set(['title', 'description', 'date', 'updated', 'tags', 'draft']);

const today = () => new Date().toISOString().slice(0, 10);
const stripQuotes = (s) => s.replace(/^["']|["']$/g, '');

/** 只在值需要时才加引号，保持 frontmatter 干净 */
function yamlStr(v) {
  const s = String(v ?? '');
  if (s === '') return '""';
  return /[:#\[\]{}&*!|>'"%@`,]|^\s|\s$/.test(s) ? JSON.stringify(s) : s;
}

function parseTags(raw) {
  return raw
    .replace(/^\[/, '')
    .replace(/\]$/, '')
    .split(',')
    .map((t) => stripQuotes(t.trim()))
    .filter(Boolean);
}

export function parsePost(text) {
  const hit = text.match(FM_RE);
  const meta = { title: '', description: '', date: today(), tags: [], draft: false, updated: '' };
  if (hit) {
    for (const line of hit[1].split(/\r?\n/)) {
      const idx = line.indexOf(':');
      if (idx < 1) continue;
      const key = line.slice(0, idx).trim();
      if (!META_KEYS.has(key)) continue;
      const val = line.slice(idx + 1).trim();
      if (key === 'tags') meta.tags = parseTags(val);
      else if (key === 'draft') meta.draft = /^(true|yes|1)$/i.test(val);
      else meta[key] = stripQuotes(val);
    }
  }
  return { meta, body: hit ? text.slice(hit[0].length) : text };
}

function serialize(meta, body) {
  const lines = [
    '---',
    `title: ${yamlStr(meta.title || '无标题')}`,
    `description: ${yamlStr(meta.description || '')}`,
    `date: ${meta.date || today()}`,
  ];
  if (meta.updated) lines.push(`updated: ${meta.updated}`);
  lines.push(`tags: [${(meta.tags || []).map(yamlStr).join(', ')}]`);
  lines.push(`draft: ${meta.draft ? 'true' : 'false'}`, '---', '');
  return lines.join('\n') + body.replace(/^\s*\n/, '').replace(/\s*$/, '') + '\n';
}

/** 中英文混排的字数估算，和站点上的阅读时长口径一致 */
const countWords = (body) => (body.match(/[\u4e00-\u9fa5]/g) || []).length +
  (body.replace(/[\u4e00-\u9fa5]/g, ' ').split(/\s+/).filter(Boolean).length);

/** 标题 → 文件名（保留中文，去掉不安全字符） */
export function slugify(title) {
  return String(title)
    .trim()
    .replace(/[\\/:*?"<>|]+/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 60);
}

async function listPosts() {
  if (!existsSync(BLOG_DIR)) return [];
  const files = (await readdir(BLOG_DIR)).filter((f) => f.endsWith('.md')).sort().reverse();
  const out = [];
  for (const file of files) {
    const raw = await readFile(path.join(BLOG_DIR, file), 'utf8');
    const { meta, body } = parsePost(raw);
    out.push({
      file,
      title: meta.title || file,
      date: meta.date,
      updated: meta.updated || '',
      tags: meta.tags,
      draft: meta.draft,
      words: countWords(body),
      description: meta.description,
    });
  }
  return out.sort((a, b) => String(b.date).localeCompare(String(a.date)));
}

/* ---------- 命令执行 ---------- */
function run(command, args, { shell = false, timeoutMs } = {}) {
  return new Promise((resolve) => {
    let output = '';
    let timer;
    const child = spawn(command, args, { cwd: ROOT, shell });
    const onData = (chunk) => {
      output += chunk.toString();
      if (output.length > 20000) output = output.slice(-20000);
    };
    if (timeoutMs) {
      timer = setTimeout(() => {
        child.kill('SIGKILL');
        output += `\n[超时 ${timeoutMs / 1000}s，已终止]`;
      }, timeoutMs);
    }
    child.stdout?.on('data', onData);
    child.stderr?.on('data', onData);
    child.on('error', (err) => {
      clearTimeout(timer);
      resolve({ ok: false, code: -1, output: `${output}\n${err.message}`.trim() });
    });
    child.on('close', (code) => {
      clearTimeout(timer);
      resolve({ ok: code === 0, code, output: output.trim() });
    });
  });
}

const isWin = process.platform === 'win32';
/** npm 在 Windows 上是 npm.cmd，必须走 shell */
const npm = (args, opts) => run(isWin ? 'npm.cmd' : 'npm', args, { shell: isWin, ...opts });
/** git 直接调 exe，不用 shell，提交信息里的特殊字符才安全 */
const git = (args, opts) => run('git', args, opts);

async function gitStatus() {
  const inside = await git(['rev-parse', '--is-inside-work-tree']);
  if (!inside.ok) return { repo: false };
  const [branch, remote, dirty, ahead] = await Promise.all([
    git(['branch', '--show-current']),
    git(['remote', 'get-url', 'origin']),
    git(['status', '--porcelain']),
    git(['rev-list', '--count', '@{u}..HEAD']),
  ]);
  return {
    repo: true,
    branch: branch.output.trim() || 'main',
    remote: remote.ok ? remote.output.trim() : '',
    changes: dirty.ok ? dirty.output.split('\n').filter(Boolean).length : 0,
    ahead: ahead.ok ? Number(ahead.output.trim()) || 0 : 0,
  };
}

async function publish(message) {
  const status = await gitStatus();
  if (!status.repo) throw httpError(400, '这里还不是 git 仓库，先执行 git init 并关联 GitHub');

  // 身份没配好时 git commit 必然失败，提前给出能直接照抄的修复命令
  const [nameCfg, mailCfg] = await Promise.all([
    git(['config', 'user.name']),
    git(['config', 'user.email']),
  ]);
  if (!nameCfg.output.trim() || !mailCfg.output.trim()) {
    throw httpError(
      400,
      'Git 还没配置提交身份，commit 会失败。先在终端执行这两条（只需一次）：\n' +
        '  git config --global user.name "你的名字"\n' +
        '  git config --global user.email "你的邮箱"'
    );
  }
  if (!status.remote) {
    throw httpError(
      400,
      '还没配置远端仓库。执行：\n  git remote add origin https://github.com/你的用户名/你的仓库.git'
    );
  }

  const add = await git(['add', '-A']);
  if (!add.ok) throw httpError(500, `git add 失败：\n${add.output}`);

  const staged = await git(['status', '--porcelain']);
  const hasChanges = Boolean(staged.output.trim());

  let out = hasChanges ? '' : '（没有新的改动需要提交）';
  if (hasChanges) {
    const commit = await git(['commit', '-m', message || `post: ${today()}`]);
    // commit 失败必须如实报错，绝不能当成"没有改动"
    if (!commit.ok) throw httpError(500, `git commit 失败：\n${commit.output}`);
    out = commit.output;
  }

  const ahead = await git(['rev-list', '--count', '@{u}..HEAD']);
  if (ahead.ok && Number(ahead.output.trim()) === 0) {
    return { ok: true, committed: hasChanges, output: `${out}\n\n远端已是最新，无需推送。` };
  }

  const push = await git(['push']);
  if (!push.ok) throw httpError(500, `git push 失败：\n${push.output || '(无输出，检查网络或凭据)'}`);
  return {
    ok: true,
    committed: hasChanges,
    output: [out, push.output || '(push 完成)'].join('\n\n'),
  };
}

/* ---------- HTTP ---------- */
const json = (res, data, status = 200) => {
  const body = JSON.stringify(data);
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
    'content-length': Buffer.byteLength(body),
  });
  res.end(body);
};

const readBody = (req) =>
  new Promise((resolve, reject) => {
    let raw = '';
    req.on('data', (c) => {
      raw += c;
      if (raw.length > 2_000_000) reject(httpError(413, '请求体过大'));
    });
    req.on('end', () => {
      try {
        resolve(raw ? JSON.parse(raw) : {});
      } catch {
        reject(httpError(400, '请求体不是合法 JSON'));
      }
    });
    req.on('error', reject);
  });

async function handle(req, res) {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const route = `${req.method} ${url.pathname}`;

  // 只接受本机来源，挡掉其它网页跨站调用
  const host = (req.headers.host || '').replace(/:\d+$/, '');
  if (!['127.0.0.1', 'localhost', '[::1]', '::1'].includes(host)) {
    throw httpError(403, '只允许本机访问');
  }
  if (req.method !== 'GET' && req.headers['x-admin-token'] !== TOKEN) {
    throw httpError(401, 'token 不对，请刷新页面');
  }

  if (route === 'GET /') {
    const html = (await readFile(UI_FILE, 'utf8')).replaceAll('%%TOKEN%%', TOKEN);
    res.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' });
    return res.end(html);
  }

  if (route === 'GET /admin.mjs') {
    const js = await readFile(path.join(HERE, 'admin.mjs'), 'utf8');
    res.writeHead(200, {
      'content-type': 'text/javascript; charset=utf-8',
      'cache-control': 'no-store',
    });
    return res.end(js);
  }

  if (route === 'GET /preview.css') {
    // 去掉 @import（fontsource 的路径在这里解析不了），字体交给浏览器回退
    const css = (await readFile(CSS_FILE, 'utf8')).replace(/^@import[^\n]+\n/gm, '');
    res.writeHead(200, { 'content-type': 'text/css; charset=utf-8', 'cache-control': 'no-store' });
    return res.end(css);
  }

  if (route === 'GET /api/state') {
    const posts = await listPosts();
    return json(res, {
      git: await gitStatus(),
      total: posts.length,
      drafts: posts.filter((p) => p.draft).length,
      published: posts.filter((p) => !p.draft).length,
      root: ROOT,
    });
  }

  if (route === 'GET /api/posts') return json(res, { posts: await listPosts() });

  if (route === 'GET /api/post') {
    const file = url.searchParams.get('file');
    const abs = postPath(file);
    if (!existsSync(abs)) throw httpError(404, `找不到文章：${file}`);
    const { meta, body } = parsePost(await readFile(abs, 'utf8'));
    return json(res, { file, meta, body });
  }

  if (route === 'POST /api/create') {
    const { title = '', date = today(), tags = [], draft = true, description = '' } = await readBody(req);
    const slug = slugify(title);
    if (!slug) throw httpError(400, '标题不能为空');
    let file = `${date}-${slug}.md`;
    let n = 2;
    while (existsSync(path.join(BLOG_DIR, file))) file = `${date}-${slug}-${n++}.md`;

    const text = serialize({ title, description, date, tags, draft }, '');
    await writeFile(path.join(BLOG_DIR, file), text, 'utf8');
    return json(res, { file, meta: { title, description, date, tags, draft, updated: '' }, body: '' });
  }

  if (route === 'POST /api/save') {
    const { file, meta = {}, body = '' } = await readBody(req);
    const abs = postPath(file);
    if (!existsSync(abs)) throw httpError(404, `找不到文章：${file}`);
    if (!String(meta.title || '').trim()) throw httpError(400, '标题不能为空');
    await writeFile(abs, serialize(meta, body), 'utf8');
    return json(res, { ok: true, file, words: countWords(body) });
  }

  if (route === 'POST /api/delete') {
    const { file } = await readBody(req);
    const abs = postPath(file);
    if (!existsSync(abs)) throw httpError(404, `找不到文章：${file}`);
    await unlink(abs);
    return json(res, { ok: true, file });
  }

  if (route === 'POST /api/build') {
    const build = await npm(['run', 'build'], { timeoutMs: 240_000 });
    return json(res, { ok: build.ok, output: build.output.slice(-6000) });
  }

  if (route === 'POST /api/publish') {
    const { message = '' } = await readBody(req);
    const result = await publish(message);
    return json(res, result, result.ok ? 200 : 500);
  }

  throw httpError(404, `没有这个接口：${route}`);
}

createServer((req, res) => {
  handle(req, res).catch((err) => {
    const status = err.status || 500;
    if (status >= 500) console.error(err);
    json(res, { error: err.message || '服务器内部错误' }, status);
  });
}).listen(PORT, HOST, () => {
  console.log('\n  博客管理后台已启动');
  console.log(`  →  http://${HOST}:${PORT}`);
  console.log(`  项目目录：${ROOT}`);
  console.log('  按 Ctrl + C 停止\n');
});


