const path = require('path');
const express = require('express');
const cors = require('cors');
const { z } = require('zod');

const { crawlUrl } = require('./services/crawler');
const { crawlByKeywords } = require('./services/keywordCrawl');

const app = express();

app.use(cors());
app.use(express.json({ limit: '2mb' }));

app.get('/health', (_req, res) => res.json({ ok: true }));

/**
 * POST /api/crawl
 * body: { url: string, mode?: 'static' | 'dynamic', maxCards?: number }
 *
 * 返回结构：
 * - page: 页面基础信息（title/finalUrl/summary）
 * - cards: 抽取的卡片数组（title/description/imageUrl/pageUrl）
 *
 * 重要：失败时返回友好错误，不让服务崩溃
 */
app.post('/api/crawl', async (req, res) => {
  const schema = z.object({
    url: z.string().url(),
    mode: z.enum(['static', 'dynamic']).optional().default('dynamic'),
    maxCards: z.number().int().min(1).max(60).optional().default(30),
  });

  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({
      ok: false,
      error: 'Invalid request body',
      details: parsed.error.flatten(),
    });
  }

  try {
    const { url, mode, maxCards } = parsed.data;
    const result = await crawlUrl({ url, mode, maxCards });
    return res.json({ ok: true, ...result });
  } catch (err) {
    const message = err && typeof err.message === 'string' ? err.message : 'Crawl failed';
    return res.status(500).json({ ok: false, error: message });
  }
});

/**
 * POST /api/crawl-keywords
 * body: { keywords: string | string[], mode?: 'static' | 'dynamic', maxCardsPerSite?: number }
 *
 * 在预置站点集合中，按关键词批量爬取并聚合卡片
 */
app.post('/api/crawl-keywords', async (req, res) => {
  const schema = z.object({
    keywords: z.union([z.string(), z.array(z.string())]).transform((v) => {
      if (Array.isArray(v)) return v.map((k) => String(k).trim()).filter(Boolean);
      return String(v).split(/[\s,，、]+/).map((k) => k.trim()).filter(Boolean);
    }).refine((arr) => arr.length > 0, { message: 'keywords is required' }),
    mode: z.enum(['static', 'dynamic']).optional().default('static'),
    maxCardsPerSite: z.number().int().min(1).max(12).optional().default(5),
  });

  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({
      ok: false,
      error: 'Invalid request body',
      details: parsed.error.flatten(),
    });
  }

  try {
    const { keywords, mode, maxCardsPerSite } = parsed.data;
    const result = await crawlByKeywords({
      keywords,
      mode,
      maxCardsPerSite,
    });
    return res.json({ ok: true, ...result });
  } catch (err) {
    const message = err && typeof err.message === 'string' ? err.message : 'Keyword crawl failed';
    return res.status(500).json({ ok: false, error: message });
  }
});

/**
 * POST /api/crawl-keywords-retry
 * body: { siteUrls: string[], keywords: string | string[], mode?, maxCardsPerSite? }
 * 仅对指定站点按关键词重新爬取（用于“重试失败”）
 */
app.post('/api/crawl-keywords-retry', async (req, res) => {
  const schema = z.object({
    siteUrls: z.array(z.string().url()).min(1).max(50),
    keywords: z.union([z.string(), z.array(z.string())]).transform((v) => {
      if (Array.isArray(v)) return v.map((k) => String(k).trim()).filter(Boolean);
      return String(v).split(/[\s,，、]+/).map((k) => k.trim()).filter(Boolean);
    }).refine((arr) => arr.length > 0, { message: 'keywords is required' }),
    mode: z.enum(['static', 'dynamic']).optional().default('static'),
    maxCardsPerSite: z.number().int().min(1).max(12).optional().default(5),
  });

  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({
      ok: false,
      error: 'Invalid request body',
      details: parsed.error.flatten(),
    });
  }

  try {
    const { siteUrls, keywords, mode, maxCardsPerSite } = parsed.data;
    const result = await crawlByKeywords({
      keywords,
      mode,
      maxCardsPerSite,
      siteUrls,
    });
    return res.json({ ok: true, ...result });
  } catch (err) {
    const message = err && typeof err.message === 'string' ? err.message : 'Retry failed';
    return res.status(500).json({ ok: false, error: message });
  }
});

/**
 * 托管前端静态文件（生产/本地一体化访问）
 * - 先 `cd frontend && npm run build`，会生成 frontend/dist
 * - 后端将 dist 作为静态目录提供
 */
const distDir = path.join(__dirname, '../../frontend/dist');
app.use(express.static(distDir));
// Express v5 不支持 '*' 作为 path，这里用正则兜底（并避开 /api 路由）
app.get(/^(?!\/api).*/, (_req, res) => {
  res.sendFile(path.join(distDir, 'index.html'));
});

const PORT = process.env.PORT ? Number(process.env.PORT) : 8787;
app.listen(PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`Crawler server running at http://localhost:${PORT}`);
});

