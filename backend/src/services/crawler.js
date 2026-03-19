const axios = require('axios');
const { chromium } = require('playwright');
const { JSDOM } = require('jsdom');
const { Readability } = require('@mozilla/readability');

const { extractCardsFromDom } = require('./extractors/cards');

/**
 * 模拟浏览器的 User-Agent，能提高抓取成功率。
 */
const DEFAULT_UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36';

/**
 * 爬取入口
 * - static：axios 拉取 HTML（轻量、速度快）
 * - dynamic：Playwright 渲染后获取 DOM（适合 SPA/JS 渲染站点）
 *
 * 然后：
 * - 用 Readability 抽主内容摘要（对文章类页面更有效）
 * - 用启发式规则抽取“卡片列表”（标题/描述/图片/链接）
 */
async function crawlUrl({ url, mode, maxCards }) {
  const startedAt = Date.now();
  let html = '';
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
      // 等待少量时间让首屏内容完成渲染（避免抓到空壳）
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

  // 主内容摘要（失败也没关系）
  let readable = null;
  try {
    readable = new Readability(doc.cloneNode(true)).parse();
  } catch (_) {
    readable = null;
  }

  // 卡片抽取
  const cards = extractCardsFromDom(doc, finalUrl, { maxCards });

  return {
    mode,
    extractedAt: new Date().toISOString(),
    elapsedMs: Date.now() - startedAt,
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

