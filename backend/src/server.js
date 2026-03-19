const path = require('path');
const express = require('express');
const cors = require('cors');
const { z } = require('zod');

const { crawlUrl } = require('./services/crawler');

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
    keywords: z.union([z.string(), z.array(z.string())]).optional().transform((v) => {
      if (v == null || v === '') return undefined;
      if (Array.isArray(v)) return v.filter(Boolean).length ? v : undefined;
      const parts = String(v).trim().split(/[\s,，、]+/).filter(Boolean);
      return parts.length ? parts : undefined;
    }),
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
    const { url, keywords, mode, maxCards } = parsed.data;
    const result = await crawlUrl({ url, keywords, mode, maxCards });
    return res.json({ ok: true, ...result });
  } catch (err) {
    const message = err && typeof err.message === 'string' ? err.message : 'Crawl failed';
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

