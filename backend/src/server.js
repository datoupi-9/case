const express = require('express');
const cors = require('cors');
const { z } = require('zod');

const { crawlUrl } = require('./services/crawler');

const app = express();

app.use(cors());
app.use(express.json({ limit: '2mb' }));

app.get('/health', (_req, res) => {
  res.json({ ok: true });
});

/**
 * POST /api/crawl
 * body: { url: string, mode?: 'static' | 'dynamic' }
 *
 * 返回结构：
 * - page: 页面基础信息
 * - cards: 抽取出的“卡片列表”
 *
 * 说明：
 * - static：axios 拉取 HTML + cheerio 解析
 * - dynamic：playwright 渲染后拿到完整 DOM（适合 SPA/JS 渲染站点）
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
    return res.status(500).json({
      ok: false,
      error: message,
    });
  }
});

const PORT = process.env.PORT ? Number(process.env.PORT) : 8787;
app.listen(PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`Crawler backend listening on http://localhost:${PORT}`);
});

