const cheerio = require('cheerio');

/* ========== 工具函数 ========== */

function toAbsoluteUrl(baseUrl, maybeRelative) {
  if (!maybeRelative) return '';
  try {
    return new URL(maybeRelative, baseUrl).toString();
  } catch (_) {
    return '';
  }
}

/**
 * 噪音链接过滤（广告 / 追踪 / 登录 / 注册等）
 */
function isLikelyNoiseUrl(url) {
  if (!url) return true;
  const u = url.toLowerCase();
  return (
    u.includes('doubleclick') ||
    u.includes('utm_') ||
    u.includes('/login') ||
    u.includes('/signup') ||
    u.includes('/register') ||
    u.includes('/privacy') ||
    u.includes('/terms') ||
    u.includes('/advert') ||
    u.includes('/ads') ||
    u.includes('share=') ||
    u.startsWith('mailto:') ||
    u.startsWith('javascript:') ||
    u.startsWith('#')
  );
}

/**
 * 判断节点 class/id 是否像“非主内容”（导航、侧栏、页脚、广告等）
 */
function isLikelyNoiseContainer(el, $) {
  const $el = $(el);
  const attrs = ($el.attr('class') || '') + ' ' + ($el.attr('id') || '');
  const lower = attrs.toLowerCase();
  const noise = [
    'nav', 'navbar', 'menu', 'header', 'footer', 'sidebar', 'aside',
    'ad', 'ads', 'advertisement', 'banner', 'comment', 'comments',
    'related', 'recommend', 'widget', 'tag-cloud', 'share', 'social',
    'breadcrumb', 'pagination', 'toc', 'toc-', 'sidebar-', 'footer-',
    'cookie', 'newsletter', 'subscribe', 'popup', 'modal'
  ];
  return noise.some((k) => lower.includes(k));
}

/**
 * 对“可能是主内容”的容器打分：内容越多、越像正文，分数越高
 */
function scoreMainContainer(el, $) {
  const $el = $(el);
  if (isLikelyNoiseContainer(el, $)) return -1;
  const links = $el.find('a[href]').length;
  const paragraphs = $el.find('p').length;
  const images = $el.find('img').length;
  const headings = $el.find('h1, h2, h3, h4').length;
  const textLen = $el.text().trim().length;
  // 主内容通常：链接+段落+标题+一定文字量，且不会全是链接
  const linkDensity = links > 0 ? textLen / (links * 50) : 1;
  const score = paragraphs * 3 + headings * 2 + Math.min(images * 2, 20) + Math.min(Math.floor(textLen / 100), 50);
  return linkDensity < 0.3 ? score * 0.5 : score; // 链接过密可能是导航
}

/**
 * 在整页中找出“主内容根”节点（排除导航、侧栏、页脚、广告）
 * 返回 Cheerio 选中的单个根节点，便于后续只在该节点下抽卡片
 */
function getMainContentRoot($) {
  const body = $('body').first();
  if (!body.length) return $.root();

  const semanticSelectors = [
    'main',
    '[role="main"]',
    '#content',
    '#main',
    '#primary',
    '#primary-content',
    '.content',
    '.main-content',
    '.main',
    '.page-content',
    '.post-content',
    '.article-content',
    '.entry-content',
    '.page__content',
    '.site-content',
    '#main-content',
    '.list-content',
    '.product-list',
    '.search-results'
  ];

  let best = null;
  let bestScore = -1;

  for (const sel of semanticSelectors) {
    $(sel).each((_, el) => {
      const score = scoreMainContainer(el, $);
      if (score > bestScore) {
        bestScore = score;
        best = el;
      }
    });
  }

  // 若无语义化主内容，用 body 下直接子元素中得分最高的（常见于老站）
  if (!best || bestScore < 5) {
    body.children().each((_, el) => {
      const score = scoreMainContainer(el, $);
      if (score > bestScore) {
        bestScore = score;
        best = el;
      }
    });
  }

  if (best && bestScore >= 0) return $(best);
  return body;
}

/**
 * 对单个“候选块”打分（用于在列表/卡片中筛选）
 */
function scoreBlock(el, $) {
  const $el = $(el);
  const link = $el.find('a[href]').first().attr('href') || '';
  const text = $el.text().trim().replace(/\s+/g, ' ');
  const hasImg = $el.find('img[src], img[data-src], img[data-lazy-src]').length > 0;
  const hasLink = !!link;
  const len = text.length;
  const hasHeading = $el.find('h1, h2, h3, h4').length > 0;
  const inNoise = isLikelyNoiseContainer(el, $);
  if (inNoise) return 0;
  return (hasLink ? 10 : 0) + (hasImg ? 5 : 0) + (hasHeading ? 3 : 0) + Math.min(40, Math.floor(len / 50));
}

/**
 * 从主内容区抽取卡片
 * - 仅在主内容根节点下查找候选块，避免抓取整页链接和侧栏
 * - 支持新闻列表、博客、产品列表等重复结构
 */
function extractCardsFromDom(document, baseUrl, { maxCards = 30 } = {}) {
  const $ = cheerio.load(document.documentElement.outerHTML);
  const $root = getMainContentRoot($);

  // 主内容区内的候选选择器（按优先级，避免重复收集同一元素）
  const candidateSelectors = [
    'article',
    'main article',
    '[role="article"]',
    'div[class*="card"]',
    'div[class*="item"]',
    'div[class*="post"]',
    'div[class*="entry"]',
    'div[class*="product"]',
    'li[class*="item"]',
    'li[class*="post"]',
    'section article',
    'div[class*="list-item"]',
    'div[class*="news-item"]',
    'div[data-product]',
    'div[data-item]',
    'li'
  ];

  const candidates = [];
  const seenEl = new Set();
  for (const sel of candidateSelectors) {
    $root.find(sel).each((_, el) => {
      if (seenEl.has(el)) return;
      seenEl.add(el);
      candidates.push(el);
    });
  }

  const top = candidates
    .map((el) => ({ el, score: scoreBlock(el, $) }))
    .filter((x) => x.score >= 12)
    .sort((a, b) => b.score - a.score)
    .slice(0, 250);

  const seen = new Set();
  const cards = [];

  for (const { el } of top) {
    if (cards.length >= maxCards) break;
    const $el = $(el);
    const $a = $el.find('a[href]').first();
    const href = toAbsoluteUrl(baseUrl, $a.attr('href'));
    if (!href || isLikelyNoiseUrl(href)) continue;

    const title =
      $el.find('h1, h2, h3, h4').first().text().trim() ||
      $a.text().trim() ||
      $a.attr('aria-label') ||
      $a.attr('title') ||
      $el.find('[class*="title"]').first().text().trim() ||
      '';
    if (!title || title.length < 2) continue;

    const description =
      $el.find('p').first().text().trim() ||
      $el.find('[class*="desc"], [class*="summary"], [class*="excerpt"], [class*="snippet"]').first().text().trim() ||
      '';

    const $img = $el.find('img').first();
    const rawImg = $img.attr('src') || $img.attr('data-src') || $img.attr('data-lazy-src') || '';
    const imageUrl = toAbsoluteUrl(baseUrl, rawImg);

    if (seen.has(href)) continue;
    seen.add(href);

    cards.push({
      title: title.trim().replace(/\s+/g, ' '),
      description: description.length > 220 ? description.slice(0, 220) + '…' : description,
      imageUrl,
      pageUrl: href,
    });
  }

  return cards;
}

module.exports = { extractCardsFromDom, getMainContentRoot, isLikelyNoiseUrl, toAbsoluteUrl };
