/**
 * 阅读计数接口（Cloudflare Pages Functions）
 *   POST /api/views/:slug  → 计数 +1，返回 { slug, views }
 *   GET  /api/views/:slug  → 只读取当前值，不加一
 *
 * 依赖一个名为 VIEWS 的 KV 绑定：
 *   控制台 → Workers & Pages → KV → 创建命名空间（如 blog-views），
 *   然后到 Pages 项目 → Settings → Functions → KV namespace bindings，
 *   变量名填 VIEWS，选择刚建的命名空间。
 * 没绑定 KV 时接口返回 503，前端会自动隐藏计数器，不影响博客其它功能。
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

export async function onRequestPost({ params, env, waitUntil }) {
  if (!env.VIEWS) return json({ error: 'KV 未绑定（变量名应为 VIEWS）' }, 503);

  const k = key(params);
  const current = Number((await env.VIEWS.get(k)) ?? 0);
  const views = Number.isFinite(current) ? current + 1 : 1;

  waitUntil(env.VIEWS.put(k, String(views)));
  return json({ slug: params.slug, views });
}

export async function onRequestGet({ params, env }) {
  if (!env.VIEWS) return json({ error: 'KV 未绑定（变量名应为 VIEWS）' }, 503);

  const views = Number((await env.VIEWS.get(key(params))) ?? 0);
  return json({ slug: params.slug, views });
}

export function onRequestOptions() {
  return new Response(null, { status: 204, headers: { allow: 'GET,POST,OPTIONS' } });
}
