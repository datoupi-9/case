const axios = require('axios');
const cheerio = require('cheerio');
const { chromium } = require('playwright');
const { JSDOM } = require('jsdom');
const { Readability } = require('@mozilla/readability');

const { extractCardsFromDom } = require('./extractors/cards');

/**
 * 用于模拟浏览器的基础请求头（避免部分站点直接拒绝爬虫请求）。
 */
const DEFAULT_UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36';

/**
 * 爬取入口
 * - static: axios 获取 HTML
 * - dynamic: playwright 渲染后拿 HTML（适合 SPA/JS 渲染站点）
 *
 * 关键点：
 * - 不把整坨 HTML 直接丢给前端
 * - 尝试抽取：页面标题/主内容摘要 + 卡片列表（title/description/imageUrl/pageUrl）
 */
async function crawlUrl({ url, mode, maxCards }) {
  const startedAt = Date.now();
  let html;
  let finalUrl = url;
  let title = '';

  if (mode === 'static') {
    const resp = await axios.get(url, {
      timeout: 25000,
      maxRedirects: 5,
      headers: {
        'User-Agent': DEFAULT_UA,
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9,zh-CN;q=0.8,zh;q=0.7',
        'Cache-Control': 'no-cache',
        Pragma: 'no-cache',
      },
    });
    html = resp.data;
    finalUrl = resp.request?.res?.responseUrl || url;
  } else {
    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({
      userAgent: DEFAULT_UA,
      viewport: { width: 1280, height: 720 },
    });
    const page = await context.newPage();

    try {
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 45000 });
      // 给 JS 一点时间把首屏渲染出来（尽量不拖太久）
      await page.waitForTimeout(1200);
      finalUrl = page.url();
      title = await page.title();
      html = await page.content();
    } finally {
      await page.close().catch(() => {});
      await context.close().catch(() => {});
      await browser.close().catch(() => {});
    }
  }

  const dom = new JSDOM(html, { url: finalUrl });
  const doc = dom.window.document;

  // 1) 主内容抽取（文章页更有效；列表页可能是空/很短，这很正常）
  let readable = null;
  try {
    const reader = new Readability(doc.cloneNode(true));
    readable = reader.parse();
  } catch (_) {
    readable = null;
  }

  // 2) 卡片抽取：尽量识别“列表重复块”（文章列表/产品卡片/新闻条目等）
  const cards = extractCardsFromDom(doc, finalUrl, { maxCards });

  const elapsedMs = Date.now() - startedAt;
  return {
    mode,
    extractedAt: new Date().toISOString(),
    elapsedMs,
    page: {
      inputUrl: url,
      finalUrl,
      title: title || doc.querySelector('title')?.textContent?.trim() || '',
      summary: readable?.excerpt || '',
    },
    cards,
  };
}

module.exports = { crawlUrl };

