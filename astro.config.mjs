import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';

// 部署前把 site 改成你自己的域名（Cloudflare Pages 分配的 xxx.pages.dev 也行）
export default defineConfig({
  site: 'https://llp-blog.cc.cd',
  integrations: [sitemap()],
  trailingSlash: 'never',
  build: {
    inlineStylesheets: 'auto',
  },
  markdown: {
    shikiConfig: {
      themes: { light: 'github-light', dark: 'github-dark' },
    },
  },
});
