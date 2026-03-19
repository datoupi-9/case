## Crawler Backend (Express + Playwright + Cheerio)

### 安装与启动

```bash
cd backend
npm install
npm run dev
```

默认端口：`http://localhost:8787`

### 接口

- `GET /health`
- `POST /api/crawl`

请求体示例：

```json
{
  "url": "https://www.geekpark.net/",
  "mode": "dynamic",
  "maxCards": 30
}
```

