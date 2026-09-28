/**
 * 全站配置：只需要改这一个文件。
 */
export const SITE = {
  /** 站名，出现在左侧栏和 <title> */
  title: 'llp blog',
  /** 副标题 / 一句话简介 */
  tagline: '写写写',
  /** 首页大标题（两行，用 \n 分隔） */
  hero: '慢慢写，\n慢慢读。',
  /** 作者名 */
  author: '404',
  /** 版权起始年 */
  since: 2026,
  /** 备案号，没有就留空字符串 */
  icp: '',
  /** 每页展示的文章数（首页“最新”区块） */
  latestCount: 4,
};

/** 左侧栏 / 顶部导航链接 */
export const NAV = [
  { label: '首页', href: '/' },
  { label: '归档', href: '/archive' },
  { label: '关于', href: '/about' },
];

/** 社交链接，留空数组就不显示图标区 */
export const SOCIAL = [
  { label: 'GitHub', href: 'https://github.com/404-llp' },
  { label: 'RSS', href: '/rss.xml' },
  { label: 'Email', href: 'mailto:760104716@qq.com' },
];

/**
 * giscus 评论配置（GitHub Discussions 驱动）。
 * 1. 建一个 public 仓库
 * 2. 仓库 Settings → General → Features 勾选 Discussions
 * 3. 到 https://giscus.app/zh-CN 安装 giscus App 到该仓库
 * 4. 填下面 4 个字段（在 https://giscus.app/zh-CN 输入仓库名可自动生成）
 * 没填 repo 时，页面会显示“评论未开启”的提示而不是报错。
 */
export const GISCUS = {
  repo: '404-llp/blog-comments',            // 例如 'your-name/blog-comments'
  repoId: 'R_kgDOUwKalg',          // 例如 'R_kgDO...'
  category: 'Announcements',
  categoryId: 'DIC_kwDOUwKals4DGlUj',      // 例如 'DIC_kwDO...'
  lang: 'zh-CN',
  theme: 'preferred_color_scheme',
};
