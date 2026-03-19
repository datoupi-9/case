const cheerio = require('cheerio');

/**
 * 把相对链接转成绝对链接。
 */
function toAbsoluteUrl(baseUrl, maybeRelative) {
  if (!maybeRelative) return '';
  try {
    return new URL(maybeRelative, baseUrl).toString();
  } catch (_) {
    return '';
  }
}

/**
 * 非严格的“广告/跟踪”过滤。
 * 目标：先挡住最常见的噪音（广告、share、login、tracking）。
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
    u.includes('#') ||
    u.startsWith('mailto:') ||
    u.startsWith('javascript:')
  );
}

/**
 * 从 document 中抽取“卡片列表”。
 *
 * 思路（参考 website understanding 的“区块识别”）：
 * - 先找最常见的重复容器：article / li / div.card / div[class*="item"] 等
 * - 只保留包含链接 + 文本（标题） 的块
 * - 尝试从块内找：标题、描述、图片、链接
 * - 做去重与简单过滤
 *
 * 注意：
 * - 这是一个“通用启发式”抽取器，不可能对所有站点 100% 精准
 * - 但足以支撑你在前端用卡片方式展示“抓到的核心信息块”
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
    $(sel).each((_, el) => {
      candidates.push(el);
    });
  }

  // 统计每个候选块的“信息密度”，用来粗略排序
  function scoreBlock(el) {
    const $el = $(el);
    const link = $el.find('a[href]').first().attr('href') || '';
    const text = $el.text().trim().replace(/\s+/g, ' ');
    const img = $el.find('img[src], img[data-src], source[srcset]').first();
    const hasImg = !!img.length;
    const hasLink = !!link;
    const len = text.length;
    return (hasLink ? 10 : 0) + (hasImg ? 5 : 0) + Math.min(40, Math.floor(len / 50));
  }

  // 取前一批高分块，减少误匹配 + 性能开销
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

    // 标题：优先 h1/h2/h3，其次 a 文本，再其次 aria-label/title
    const title =
      $el.find('h1,h2,h3').first().text().trim() ||
      $a.text().trim() ||
      $a.attr('aria-label') ||
      $a.attr('title') ||
      '';

    if (!title || title.length < 3) continue;

    // 描述：找 p / .desc / .summary 一类
    const description =
      $el.find('p').first().text().trim() ||
      $el.find('[class*="desc"],[class*="summary"],[class*="excerpt"]').first().text().trim() ||
      '';

    // 图片：img/src 或 data-src 或 srcset
    const $img = $el.find('img').first();
    const rawImg = $img.attr('src') || $img.attr('data-src') || '';
    const imageUrl = toAbsoluteUrl(baseUrl, rawImg);

    const key = href;
    if (seen.has(key)) continue;
    seen.add(key);

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

