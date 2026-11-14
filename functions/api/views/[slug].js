/**
 * 阅读计数接口（Cloudflare Pages Functions）
 *   POST /api/views/:slug  → 去重后计数 +1，返回 { slug, views, counted }
 *   GET  /api/views/:slug  → 只读取当前值，不加一
 *
 * 依赖一个名为 VIEWS 的 KV 绑定：
 *   控制台 → Workers & Pages → KV → 创建命名空间（如 blog-views），
 *   然后到 Pages 项目 → Settings → Functions → KV namespace bindings，
 *   变量名填 VIEWS，选择刚建的命名空间。
 * 没绑定 KV 时接口返回 503，前端会自动隐藏计数器，不影响博客其它功能。
 *
 * 去重策略：按文章 slug 种 HttpOnly Cookie，24 小时内同一篇文章重复 POST 不再 +1。
 */

const json = (data, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store, max-age=0',
    },
  });

const key = (params) => `views:${decodeURIComponent(params.slug ?? '').slice(0, 200)}`;

/** 从 Cookie 头中解析指定名称的值 */
function getCookie(request, name) {
  const cookieHeader = request.headers.get('cookie');
  if (!cookieHeader) return null;
  const match = cookieHeader.match(new RegExp(`(?:^|;\\s*)${name}=([^;]+)`));
  return match ? decodeURIComponent(match[1]) : null;
}

export async function onRequestPost({ params, env, request, waitUntil }) {
  if (!env.VIEWS) return json({ error: 'KV 未绑定（变量名应为 VIEWS）' }, 503);

  const k = key(params);
  const slug = decodeURIComponent(params.slug ?? '');
  // Cookie 名按文章隔离，避免读过 A 文章导致 B 文章不计数；截断防止超长
  const cookieName = `pv_${slug.slice(0, 80)}`;

  // 1. 已有 Cookie：说明 24 小时内读过，直接返回当前值，不计数
  if (getCookie(request, cookieName)) {
    const views = Number((await env.VIEWS.get(k)) ?? 0);
    return json({ slug, views, counted: false });
  }

  // 2. 无 Cookie：计数 +1
  const current = Number((await env.VIEWS.get(k)) ?? 0);
  const views = Number.isFinite(current) ? current + 1 : 1;

  waitUntil(env.VIEWS.put(k, String(views)));

  // 3. 种下标记 Cookie，24 小时内同一篇不再计数
  const response = json({ slug, views, counted: true });
  response.headers.append(
    'Set-Cookie',
    `${cookieName}=1; Path=/; Max-Age=86400; HttpOnly; SameSite=Lax`
  );
  return response;
}

export async function onRequestGet({ params, env }) {
  if (!env.VIEWS) return json({ error: 'KV 未绑定（变量名应为 VIEWS）' }, 503);

  const views = Number((await env.VIEWS.get(key(params))) ?? 0);
  return json({ slug: params.slug, views });
}

export function onRequestOptions() {
  return new Response(null, { status: 204, headers: { allow: 'GET,POST,OPTIONS' } });
}