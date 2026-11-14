/** 统一日期格式：2026-09-12 */
export function fmtDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/**
 * 按中英文混排估算阅读时长。
 * 中文按字算（≈400 字/分钟），英文按词算（≈220 词/分钟）。
 */
export function readingTime(markdown: string): number {
  const text = markdown.replace(/```[\s\S]*?```/g, ' ').replace(/[#>*_`\-|]/g, '');
  const cjk = (text.match(/[\u4e00-\u9fa5\u3000-\u303f]/g) || []).length;
  const words = text
    .replace(/[\u4e00-\u9fa5\u3000-\u303f]/g, ' ')
    .split(/\s+/)
    .filter(Boolean).length;
  return Math.max(1, Math.round(cjk / 400 + words / 220));
}

/** 从 markdown 里取一段纯文本摘要（frontmatter 的 description 优先） */
export function excerpt(markdown: string, len = 90): string {
  const plain = markdown
    .replace(/^---[\s\S]*?---/, '')
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/[#>*_`~\-|]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return plain.length > len ? plain.slice(0, len) + '…' : plain;
}
