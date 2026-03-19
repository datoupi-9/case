const { crawlUrl } = require('./crawler');

const KEYWORD_TARGET_URLS = [
  'https://husarion.com/',
  'https://www.bigtechwire.com/',
  'https://www.quanser.com/',
  'https://www.makextool.com/',
  'https://www.robotis.us/',
  'https://edu.ubtrobot.com/',
  'https://www.pololu.com/',
  'https://www.hiwonder.com/',
  'https://www.pixmoving.city/',
  'https://www.neolix.cn/',
  'https://tech.meituan.com/',
  'https://www.cainiao.com/',
  'https://www.deepblueai.com/',
  'https://www.agilex.ai/',
  'https://developer.nvidia.com/',
  'https://clearpathrobotics.com/',
  'https://www.youibot.com/',
  'https://www.whaledynamic.com/',
  'https://ree.auto/',
  'https://www.lanxincn.com/',
  'https://www.teradyne.com/',
  'https://www.siasun.com/',
  'https://www.kickstarter.com/',
  'https://www.gp-award.com/',
  'https://squishy-robotics.com/',
  'https://rollyy.com/',
  'https://www.cocodelivery.com/',
  'https://www.starship.xyz/',
  'https://ternx.com/',
  'https://www.flyability.com/',
  'https://voliro.com/',
  'https://www.exotec.com/',
  'https://www.hikrobotics.com/en/',
  'https://www.serverobotics.com/',
  'https://www.locusrobotics.com/',
  'https://www.ghostrobotics.io/',
  'https://carbonrobotics.com/',
  'https://en.robotis.com/',
  'https://www.theinformation.com/',
];

/**
 * 批量关键词爬取
 * @param {Object} opts
 * @param {string[]} opts.keywords - 关键词列表
 * @param {string} [opts.mode] - static | dynamic
 * @param {number} [opts.maxCardsPerSite] - 每站最多卡片数
 * @param {number} [opts.concurrency] - 并发数
 * @param {string[]} [opts.siteUrls] - 仅爬取这些 URL（不传则爬取全部预置列表，用于“重试失败”）
 */
async function crawlByKeywords({
  keywords,
  mode = 'static',
  maxCardsPerSite = 5,
  concurrency = 4,
  siteUrls = null,
}) {
  const startedAt = Date.now();
  const cleanKeywords = (Array.isArray(keywords) ? keywords : [])
    .map((k) => String(k).trim())
    .filter(Boolean);

  const urlsToCrawl = siteUrls && siteUrls.length > 0 ? siteUrls : KEYWORD_TARGET_URLS;
  const siteResults = [];
  const allCards = [];
  let nextIndex = 0;

  async function worker() {
    while (true) {
      const idx = nextIndex;
      nextIndex += 1;
      if (idx >= urlsToCrawl.length) break;

      const siteUrl = urlsToCrawl[idx];
      const siteStartedAt = Date.now();
      try {
        const result = await crawlUrl({
          url: siteUrl,
          keywords: cleanKeywords,
          mode,
          maxCards: maxCardsPerSite,
        });

        const cards = Array.isArray(result.cards) ? result.cards : [];
        for (const c of cards) {
          allCards.push({
            ...c,
            sourceSite: siteUrl,
          });
        }

        siteResults.push({
          siteUrl,
          finalUrl: result.page?.finalUrl || siteUrl,
          title: result.page?.title || '',
          status: 'success',
          matchedCards: cards.length,
          elapsedMs: Date.now() - siteStartedAt,
        });
      } catch (err) {
        const msg = err && typeof err.message === 'string' ? err.message : 'crawl failed';
        siteResults.push({
          siteUrl,
          finalUrl: siteUrl,
          title: '',
          status: 'failed',
          matchedCards: 0,
          elapsedMs: Date.now() - siteStartedAt,
          error: msg.length > 80 ? msg.slice(0, 80) + '…' : msg,
        });
      }
    }
  }

  const workers = [];
  const workerCount = Math.max(1, Math.min(concurrency, 8));
  for (let i = 0; i < workerCount; i += 1) workers.push(worker());
  await Promise.all(workers);

  const sitesSucceeded = siteResults.filter((x) => x && x.status === 'success').length;
  const sitesFailed = siteResults.length - sitesSucceeded;

  return {
    extractedAt: new Date().toISOString(),
    elapsedMs: Date.now() - startedAt,
    keywords: cleanKeywords,
    sitesTotal: siteResults.length,
    sitesSucceeded,
    sitesFailed,
    siteResults,
    cards: allCards.slice(0, 120),
  };
}

module.exports = { crawlByKeywords, KEYWORD_TARGET_URLS };
