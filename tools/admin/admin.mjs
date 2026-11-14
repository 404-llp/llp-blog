/**
 * 博客控制台前端逻辑：列表、表单、编辑器、实时预览、构建与发布。
 * 由 server.mjs 通过 /admin.mjs 提供，只在 127.0.0.1 下运行。
 */
const TOKEN = window.__TOKEN__;
const today = () => new Date().toISOString().slice(0, 10);

const $ = (sel) => document.querySelector(sel);
const state = {
  posts: [],
  filter: '',
  current: null, // { file, meta, body }
  dirty: false,
  theme: localStorage.getItem('admin-theme') || 'light',
  previewDoc: null,
};

/* ---------- 与服务端通信 ---------- */
async function api(path, { method = 'GET', body } = {}) {
  const res = await fetch(path, {
    method,
    headers: {
      'content-type': 'application/json',
      'x-admin-token': TOKEN,
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `${res.status} ${res.statusText}`);
  return data;
}

/* ---------- 极简 Markdown 渲染（仅用于预览） ---------- */
const ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ESC[c]);

function inline(text) {
  return esc(text)
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/!\[([^\]]*)\]\(([^)\s]+)\)/g, '<img alt="$1" src="$2">')
    .replace(
      /\[([^\]]+)\]\(([^)\s]+)\)/g,
      '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>'
    )
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/(^|[^\w*])\*([^*\n]+)\*/g, '$1<em>$2</em>');
}

const splitRow = (line) =>
  line
    .trim()
    .replace(/^\|/, '')
    .replace(/\|$/, '')
    .split('|')
    .map((c) => c.trim());

const BLOCK_NEXT = /^(#{1,6}\s|>|```|\||\s*[-*+]\s|\s*\d+[.)]\s|-{3,}\s*$)/;

export function renderMarkdown(src) {
  const lines = String(src ?? '').replace(/\r\n/g, '\n').split('\n');
  const out = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    const fence = line.match(/^```\s*([\w+-]*)\s*$/);
    if (fence) {
      const buf = [];
      i += 1;
      while (i < lines.length && !/^```/.test(lines[i])) buf.push(lines[i++]);
      i += 1;
      out.push(`<pre><code class="language-${fence[1] || 'text'}">${esc(buf.join('\n'))}</code></pre>`);
      continue;
    }

    if (!line.trim()) {
      i += 1;
      continue;
    }

    const head = line.match(/^(#{1,6})\s+(.*)$/);
    if (head) {
      const level = head[1].length;
      out.push(`<h${level}>${inline(head[2])}</h${level}>`);
      i += 1;
      continue;
    }

    if (/^(-{3,}|\*{3,})\s*$/.test(line)) {
      out.push('<hr>');
      i += 1;
      continue;
    }

    if (/^\|.*\|/.test(line) && /^\|[\s:|-]+\|/.test(lines[i + 1] || '')) {
      const headCells = splitRow(line);
      i += 2;
      const rows = [];
      while (i < lines.length && /^\|.*\|/.test(lines[i])) rows.push(splitRow(lines[i++]));
      out.push(
        `<table><thead><tr>${headCells.map((c) => `<th>${inline(c)}</th>`).join('')}</tr></thead>` +
          `<tbody>${rows
            .map((r) => `<tr>${r.map((c) => `<td>${inline(c)}</td>`).join('')}</tr>`)
            .join('')}</tbody></table>`
      );
      continue;
    }

    if (/^>\s?/.test(line)) {
      const buf = [];
      while (i < lines.length && /^>\s?/.test(lines[i])) buf.push(lines[i++].replace(/^>\s?/, ''));
      out.push(`<blockquote><p>${inline(buf.join(' '))}</p></blockquote>`);
      continue;
    }

    if (/^\s*[-*+]\s+/.test(line)) {
      const buf = [];
      while (i < lines.length && /^\s*[-*+]\s+/.test(lines[i]))
        buf.push(lines[i++].replace(/^\s*[-*+]\s+/, ''));
      out.push(`<ul>${buf.map((x) => `<li>${inline(x)}</li>`).join('')}</ul>`);
      continue;
    }

    if (/^\s*\d+[.)]\s+/.test(line)) {
      const buf = [];
      while (i < lines.length && /^\s*\d+[.)]\s+/.test(lines[i]))
        buf.push(lines[i++].replace(/^\s*\d+[.)]\s+/, ''));
      out.push(`<ol>${buf.map((x) => `<li>${inline(x)}</li>`).join('')}</ol>`);
      continue;
    }

    const para = [line];
    i += 1;
    while (i < lines.length && lines[i].trim() && !BLOCK_NEXT.test(lines[i])) para.push(lines[i++]);
    out.push(`<p>${inline(para.join(' '))}</p>`);
  }

  return out.join('\n');
}

/* ---------- 提示与日志 ---------- */
let toastTimer;
function toast(msg, isError = false) {
  const el = $('#toast');
  el.textContent = msg;
  el.className = `show${isError ? ' err' : ''}`;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => (el.className = ''), 3200);
}

function openLog(title, text) {
  $('#logTitle').textContent = title;
  $('#logBody').textContent = text || '(无输出)';
  $('#log').classList.add('open');
}

/* ---------- 状态栏 ---------- */
async function refreshState() {
  try {
    const s = await api('/api/state');
    const parts = [
      `<span>已发布 <b>${s.published}</b></span>`,
      `<span>草稿 <b>${s.drafts}</b></span>`,
    ];
    if (s.git?.repo) {
      parts.push(`<span>分支 <b>${s.git.branch}</b></span>`);
      parts.push(
        `<span>${s.git.changes ? `待提交 <b>${s.git.changes}</b>` : '工作区干净'}${
          s.git.ahead ? ` · 领先远端 <b>${s.git.ahead}</b>` : ''
        }</span>`
      );
    } else {
      parts.push('<span style="color:var(--danger)">未关联 git 仓库</span>');
    }
    if (!s.git?.remote) parts.push('<span>未配置远端</span>');
    $('#state').innerHTML = parts.join('');
  } catch (err) {
    $('#state').textContent = `状态读取失败：${err.message}`;
  }
}

/* ---------- 文章列表 ---------- */
function renderList() {
  const kw = state.filter.trim().toLowerCase();
  const items = state.posts.filter(
    (p) =>
      !kw ||
      p.title.toLowerCase().includes(kw) ||
      p.file.toLowerCase().includes(kw) ||
      p.tags.join(' ').toLowerCase().includes(kw)
  );
  $('#count').textContent = `${items.length}/${state.posts.length}`;
  $('#listEmpty').hidden = items.length !== 0;
  $('#list').innerHTML = items
    .map(
      (p) => `<li><button class="item" type="button" data-file="${esc(p.file)}"
        aria-current="${state.current?.file === p.file}">
        <span class="t">${esc(p.title)}</span>
        <span class="m"><span>${esc(p.date || '无日期')}</span>
        <span class="pill ${p.draft ? 'draft' : ''}">${p.draft ? '草稿' : '已发布'}</span>
        <span>${p.words} 字</span></span></button></li>`
    )
    .join('');
}

async function loadPosts(keepCurrent = false) {
  const { posts } = await api('/api/posts');
  state.posts = posts;
  renderList();
  if (!posts.length) return selectPost(null);
  const stillThere = keepCurrent && posts.some((p) => p.file === state.current?.file);
  if (!stillThere) await selectPost(posts[0].file);
}

/* ---------- 编辑器 ---------- */
function setDirty(v) {
  state.dirty = v;
  $('#btnSave').textContent = v ? '保存 *' : '保存';
}

async function selectPost(file) {
  if (!file) {
    state.current = null;
    $('#form').hidden = true;
    $('#btnDelete').hidden = true;
    $('#editor').value = '';
    $('#currentFile').textContent = '未选择文章';
    $('#words').textContent = '';
    renderPreview();
    return;
  }
  if (state.dirty && !confirm('当前文章还没保存，放弃改动？')) return;
  const data = await api(`/api/post?file=${encodeURIComponent(file)}`);
  state.current = data;
  $('#form').hidden = false;
  $('#btnDelete').hidden = false;
  $('#currentFile').textContent = data.file;
  $('#fTitle').value = data.meta.title || '';
  $('#fDesc').value = data.meta.description || '';
  $('#fTags').value = (data.meta.tags || []).join(', ');
  $('#fDate').value = data.meta.date || '';
  $('#fDraft').checked = !!data.meta.draft;
  $('#editor').value = data.body.replace(/^\n+/, '');
  setDirty(false);
  renderPreview();
  renderList();
}

function collectMeta() {
  return {
    title: $('#fTitle').value.trim(),
    description: $('#fDesc').value.trim(),
    date: $('#fDate').value || new Date().toISOString().slice(0, 10),
    tags: $('#fTags')
      .value.split(/[,，]/)
      .map((t) => t.trim())
      .filter(Boolean),
    draft: $('#fDraft').checked,
  };
}

async function save(silent = false) {
  if (!state.current) return toast('先选一篇文章', true);
  const meta = collectMeta();
  if (!meta.title) return toast('标题不能为空', true);
  try {
    const { words } = await api('/api/save', {
      method: 'POST',
      body: { file: state.current.file, meta, body: $('#editor').value },
    });
    state.current.meta = meta;
    $('#words').textContent = `${words} 字`;
    setDirty(false);
    await Promise.all([loadPosts(true), refreshState()]);
    renderPreview();
    if (!silent) toast('已保存到本地文件');
  } catch (err) {
    toast(`保存失败：${err.message}`, true);
  }
}

/* ---------- 预览 ---------- */
const previewShell = () => `<!doctype html><html data-theme="${state.theme}"><head><meta charset="utf-8">
<link rel="stylesheet" href="/preview.css">
<style>
  html{background:var(--paper)}
  body{margin:0;padding:1.6rem 1.4rem;background:var(--paper)}
  h1.pt{font-family:var(--font-display);font-size:1.95rem;line-height:1.18;margin:0 0 .8rem}
  .pmeta{font-family:var(--font-mono);font-size:10.5px;letter-spacing:.1em;text-transform:uppercase;
    color:var(--muted);border-top:1px solid var(--rule);border-bottom:1px solid var(--rule);
    padding:.6rem 0;margin:0 0 1.5rem}
</style></head><body>
<h1 class="pt" id="pt">预览</h1><p class="pmeta" id="pm"></p><div class="prose" id="p"></div>
</body></html>`;

let debounce;
function renderPreview() {
  const doc = state.previewDoc;
  if (!doc?.getElementById?.('p')) return;
  const meta = $('#form').hidden ? null : collectMeta();
  doc.documentElement.dataset.theme = state.theme;
  doc.getElementById('pt').textContent = meta?.title || '新建文章';
  doc.getElementById('pm').textContent = meta
    ? `${meta.date} · ${meta.draft ? '草稿' : '已发布'}${meta.tags.length ? ` · ${meta.tags.map((t) => '#' + t).join(' ')}` : ''}`
    : '';
  doc.getElementById('p').innerHTML = renderMarkdown($('#editor').value);
}
const schedulePreview = () => {
  clearTimeout(debounce);
  debounce = setTimeout(renderPreview, 280);
};

/* ---------- 构建与发布 ---------- */
async function busy(btn, label, fn) {
  const old = btn.textContent;
  btn.disabled = true;
  btn.textContent = label;
  try {
    await fn();
  } finally {
    btn.disabled = false;
    btn.textContent = old;
  }
}

const buildCheck = () =>
  busy($('#btnBuild'), '构建中…', async () => {
    toast('正在本地构建，大约 10 秒…');
    try {
      const r = await api('/api/build', { method: 'POST', body: {} });
      openLog(r.ok ? '构建通过 ✅' : '构建失败 ❌', r.output);
      toast(r.ok ? '构建通过，可以发布' : '构建失败，看下方日志', !r.ok);
    } catch (err) {
      openLog('构建没跑起来 ❌', err.message);
      toast('构建失败，看下方日志', true);
    }
  });

const publish = () =>
  busy($('#btnPublish'), '发布中…', async () => {
    if (state.dirty) await save(true);
    const title = $('#fTitle').value.trim() || state.current?.file || today();
    const message = prompt('提交信息（会显示在 GitHub 上）：', `post: ${title}`);
    if (message === null) return;
    try {
      const r = await api('/api/publish', { method: 'POST', body: { message } });
      openLog(r.ok ? '已推送 ✅ Cloudflare Pages 正在重新部署' : '未推送 ❌', r.output);
      toast(r.ok ? '已推送，约 1 分钟后线上更新' : '没有推送成功，看下方日志', !r.ok);
    } catch (err) {
      openLog('发布失败 ❌', err.message);
      toast('发布失败，看下方日志', true);
    }
    await refreshState();
  });

/* ---------- 事件绑定 ---------- */
function bind() {
  $('#list').addEventListener('click', (e) => {
    const btn = e.target.closest('button.item');
    if (btn) selectPost(btn.dataset.file).catch((err) => toast(err.message, true));
  });

  $('#search').addEventListener('input', (e) => {
    state.filter = e.target.value;
    renderList();
  });

  $('#editor').addEventListener('input', () => {
    setDirty(true);
    schedulePreview();
    const text = $('#editor').value;
    const words = (text.match(/[\u4e00-\u9fa5]/g) || []).length +
      text.replace(/[\u4e00-\u9fa5]/g, ' ').split(/\s+/).filter(Boolean).length;
    $('#words').textContent = `${words} 字`;
  });

  for (const id of ['fTitle', 'fDesc', 'fTags', 'fDate', 'fDraft']) {
    $(`#${id}`).addEventListener('input', () => {
      setDirty(true);
      schedulePreview();
    });
    $(`#${id}`).addEventListener('change', () => {
      setDirty(true);
      schedulePreview();
    });
  }

  $('#btnSave').addEventListener('click', () => save());
  $('#btnDelete').addEventListener('click', async () => {
    const file = state.current?.file;
    if (!file) return;
    if (!confirm(`删除「${$('#fTitle').value || file}」？文件会直接删掉，不可恢复。`)) return;
    try {
      await api('/api/delete', { method: 'POST', body: { file } });
      state.dirty = false;
      toast(`已删除 ${file}`);
      await Promise.all([loadPosts(), refreshState()]);
    } catch (err) {
      toast(`删除失败：${err.message}`, true);
    }
  });
  $('#btnBuild').addEventListener('click', buildCheck);
  $('#btnPublish').addEventListener('click', publish);
  $('#btnLogClose').addEventListener('click', () => $('#log').classList.remove('open'));

  $('#btnTheme').addEventListener('click', () => {
    state.theme = state.theme === 'dark' ? 'light' : 'dark';
    localStorage.setItem('admin-theme', state.theme);
    document.documentElement.dataset.theme = state.theme;
    renderPreview();
  });

  $('#btnList').addEventListener('click', () => $('#listCol').classList.toggle('show'));

  $('#btnNew').addEventListener('click', () => {
    $('#nTitle').value = '';
    $('#nTags').value = '';
    $('#nDraft').checked = true;
    $('#dlg').showModal();
    setTimeout(() => $('#nTitle').focus(), 50);
  });

  $('#dlgForm').addEventListener('submit', async (e) => {
    if (e.submitter?.value !== 'ok') return;
    e.preventDefault();
    const title = $('#nTitle').value.trim();
    if (!title) return toast('标题不能为空', true);
    try {
      const created = await api('/api/create', {
        method: 'POST',
        body: {
          title,
          date: today(),
          tags: $('#nTags')
            .value.split(/[,，]/)
            .map((t) => t.trim())
            .filter(Boolean),
          draft: $('#nDraft').checked,
        },
      });
      $('#dlg').close();
      await loadPosts();
      await selectPost(created.file);
      await refreshState();
      toast(`已创建 ${created.file}`);
      $('#editor').focus();
    } catch (err) {
      toast(`创建失败：${err.message}`, true);
    }
  });

  document.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
      e.preventDefault();
      save();
    }
  });

  addEventListener('beforeunload', (e) => {
    if (state.dirty) {
      e.preventDefault();
      e.returnValue = '';
    }
  });
}

/* ---------- 启动 ---------- */
async function init() {
  document.documentElement.dataset.theme = state.theme;
  bind();

  // 顶栏在手机端会换行，高度不固定；实测后交给 CSS，抽屉才不会盖住它
  const syncHeaderH = () =>
    document.documentElement.style.setProperty(
      '--header-h',
      `${document.querySelector('header').offsetHeight}px`
    );
  syncHeaderH();
  addEventListener('resize', syncHeaderH);

  const iframe = $('#preview');
  iframe.srcdoc = previewShell();
  const ready = new Promise((resolve) => {
    iframe.addEventListener('load', resolve, { once: true });
    setTimeout(resolve, 1200);
  });

  await Promise.all([loadPosts(), refreshState(), ready]);
  state.previewDoc = iframe.contentDocument;
  renderPreview();
}

init().catch((err) => {
  document.body.insertAdjacentHTML(
    'beforeend',
    `<div class="empty">控制台启动失败：${esc(err.message)}</div>`
  );
});

