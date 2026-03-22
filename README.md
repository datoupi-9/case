# 案例库（Case Library）网页项目

## 项目简介
这是一个案例库展示网页，用于展示和浏览各种设计案例。页面包含案例详情、搜索筛选、案例卡片展示等功能。

## 页面结构说明

### 1. 顶部案例详情区域
- **位置**：页面顶部
- **内容**：展示单个案例的详细信息
- **包含元素**：
  - 案例图片
  - 案例标题（如：CyberBrick 4WD Car）
  - 案例描述文字
  - 操作按钮（点赞、收藏、关闭、评论、上传、外链等）
  - 点赞数量显示

### 2. 你喜欢的案例区域
- **位置**：案例详情下方
- **标题**：The case you liked
- **内容**：以网格形式展示多个案例卡片
- **每个案例卡片包含**：
  - 案例图片
  - 用户头像（圆形）
  - 点赞数和评论数
  - 案例标题
  - 点赞图标

### 3. 搜索和筛选区域
- **位置**：页面中间部分
- **包含功能**：
  - **搜索框**：支持搜索感兴趣的内容
  - **筛选按钮**：打开筛选选项
  - **筛选选项**：
    - Type（类型）
    - Application scenarios（应用场景）
    - Technology type（技术类型）
    - Industry sectors（行业领域）
    - Target audience（目标受众）
    - Model type（模型类型）
  - **Popular标签**：显示热门标签
  - **特色分类**（Featured Categories）：
    - Hot Trends（热门趋势）
    - Special Collection（特别收藏）
    - Practical tutorial（实用教程）
    - Competition entries（竞赛作品）
    - cultural elements（文化元素）
    - Materials and Media（材料和媒体）
  - **标签**（Tags）：
    - open source（开源）
    - figure（人物）
    - animal（动物）
    - plant（植物）
    - festival（节日）
    - Commercial use（商业用途）

### 4. 案例卡片网格
- **位置**：筛选区域下方
- **布局**：响应式网格布局，展示多个案例卡片
- **每个卡片包含**：
  - 案例图片
  - 用户头像和统计信息
  - 案例标题

### 5. 底部导航栏
- **位置**：页面底部
- **包含标签**：
  - Case Library（案例库）- 当前选中
  - Collect（收藏）
  - Follow（关注）
  - Like（喜欢）
- **用户头像**：显示在导航栏左侧

### 6. 联系信息区域
- **位置**：页面最底部
- **内容**：
  - 联系邮箱：Bobwu@profabx.com
  - 地址：浙江省宁波市高新区清逸路215号智造港D区3号楼5层

## 样式说明

### 颜色方案
- **背景色**：
  - 主背景：#FFFFFF（白色）
  - 次要背景：#FAFBFC（浅灰）
  - 深色背景：#6E6868（深灰）
- **文字颜色**：
  - 主文字：#000000（黑色）
  - 次要文字：#434343（深灰）
  - 占位符文字：#C0C0C0（浅灰）
- **强调色**：
  - 按钮背景：#3E6AE2（蓝色）
  - 标签背景：#F3F3F3（浅灰）

### 字体
- **字体族**：HarmonyOS Sans SC
- **标题字体**：粗体（700），32px
- **正文字体**：常规（400），13-16px
- **小字体**：10px

### 布局特点
- **页面宽度**：1280px（桌面端）
- **圆角**：5px、10px、20px、25px（根据元素不同）
- **阴影效果**：卡片使用轻微阴影增强层次感
- **响应式设计**：使用Flexbox和Grid布局，适配不同屏幕尺寸

## 技术实现

### HTML结构
- 使用语义化HTML5标签
- 清晰的文档结构
- 良好的可访问性

### CSS样式
- 使用Flexbox和Grid布局
- 响应式设计
- 详细的注释说明
- 符合W3C标准

## 文件结构
```
figma/
├── README.md          # 项目说明文档
├── index.html         # 主HTML文件（案例库）
├── backend/           # 爬虫后端（Express + Playwright + Cheerio）
├── frontend/          # 爬虫前端（Vite + React + Tailwind）
├── basic-case.css     # 案例库基础样式
└── ...                # 其他页面与样式
```

## 新增：爬虫页面（Crawling）

- **入口**：`index.html` 右下角 `Crawling` 按钮（打开 `http://localhost:8787/`）
- **功能**：输入一个目标网址 → 后端抓取（静态/动态）→ 抽取卡片 JSON → 前端以卡片网格展示（标题/描述/缩略图）

### 启动方式

先构建前端（用于后端托管）：

```bash
cd frontend
npm install
npm run build
```

再启动后端：

```bash
cd backend
npm install
npm run dev
```

打开：`http://localhost:8787/`

## 部署到 GitHub Pages（避免 Jekyll / Liquid 报错）

若使用 **GitHub Pages** 且构建日志出现 `Liquid syntax error`、指向 `node_modules/.../README.md`，原因是 Pages 默认用 **Jekyll** 处理仓库，会解析依赖里的 Markdown。

**处理方式（二选一或同时使用）：**

1. **仓库根目录已包含 `.nojekyll` 文件**  
   告诉 GitHub Pages **不要运行 Jekyll**，按静态文件直接发布。

2. **仓库根目录已包含 `_config.yml`**  
   在仍启用 Jekyll 时 **排除** `backend/node_modules`、`frontend/node_modules`，避免处理依赖包文档。

部署前建议：**不要将 `node_modules` 提交到 Git**（仅用 CI 里 `npm install`），并确认发布目录不包含会触发 Liquid 的路径。

**关于 `faraday-retry` 提示**：这是 Ruby/Jekyll 生态的依赖提示，一般不影响本站点；若你的 CI 使用自定义 Jekyll 插件，可在 `Gemfile` 中加入 `gem "faraday-retry"`。

## 使用说明
1. 直接在浏览器中打开 `index.html` 文件即可查看页面
2. 所有样式都在 `styles.css` 文件中
3. 可以根据需要修改内容和样式

## 优化建议
1. 图片资源优化：建议使用WebP格式，添加懒加载
2. 性能优化：压缩CSS文件，减少HTTP请求
3. 交互增强：可以添加JavaScript实现搜索和筛选功能
4. 响应式优化：针对移动端进行进一步优化

