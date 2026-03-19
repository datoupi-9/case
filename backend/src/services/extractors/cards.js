const cheerio = require('cheerio');

function toAbsoluteUrl(baseUrl, maybeRelative) {
  if (!maybeRelative) return '';
  try {
    return new URL(maybeRelative, baseUrl).toString();
  } catch (_) {
    return '';
  }
}

/**
 * 简单噪音过滤（广告/追踪/注册登录等常见链接）
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
    u.startsWith('javascript:')
  );
}

/**
 * 启发式“卡片列表”抽取：
 * - 尝试从页面中找到可能重复出现的信息块（article / li / div.card / div.item …）
 * - 抽取每个块中的：title/description/imageUrl/pageUrl
 * - 去重 + 过滤明显噪音
 *
 * 这不是站点定制规则，而是通用规则：
 * - 对科技博客首页、新闻列表、产品列表类页面通常效果不错
 * - 对极度复杂或强反爬站点，可能需要后续“站点适配”增强
 */
function extractCardsFromDom(document, baseUrl, { maxCards = 30 } = {}) {
  const $ = cheerio.load(document.documentElement.outerHTML);

  const candidateSelectors = [
    'article',
    'li',
    'div[class*="card"]',
    'div[class*="item"]',
    'div[class*="post"]',
    'div[class*="entry"]',
    'section article',
    'main article',
  ];

  const candidates = [];
  for (const sel of candidateSelectors) {
    $(sel).each((_, el) => candidates.push(el));
  }

  function scoreBlock(el) {
    const $el = $(el);
    const link = $el.find('a[href]').first().attr('href') || '';
    const text = $el.text().trim().replace(/\s+/g, ' ');
    const hasImg = $el.find('img[src], img[data-src]').length > 0;
    const hasLink = !!link;
    const len = text.length;
    return (hasLink ? 10 : 0) + (hasImg ? 5 : 0) + Math.min(40, Math.floor(len / 50));
  }

  const top = candidates
    .map((el) => ({ el, score: scoreBlock(el) }))
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
      $el.find('h1,h2,h3').first().text().trim() ||
      $a.text().trim() ||
      $a.attr('aria-label') ||
      $a.attr('title') ||
      '';
    if (!title || title.length < 3) continue;

    const description =
      $el.find('p').first().text().trim() ||
      $el.find('[class*="desc"],[class*="summary"],[class*="excerpt"]').first().text().trim() ||
      '';

    const $img = $el.find('img').first();
    const rawImg = $img.attr('src') || $img.attr('data-src') || '';
    const imageUrl = toAbsoluteUrl(baseUrl, rawImg);

    if (seen.has(href)) continue;
    seen.add(href);

    cards.push({
      title,
      description: description.length > 220 ? description.slice(0, 220) + '…' : description,
      imageUrl,
      pageUrl: href,
    });
  }

  return cards;
}

module.exports = { extractCardsFromDom };

