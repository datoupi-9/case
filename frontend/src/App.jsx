import { useMemo, useState } from 'react'

function normalizeUrl(raw) {
  const v = raw.trim()
  if (!v) return ''
  if (v.startsWith('http://') || v.startsWith('https://')) return v
  return `https://${v}`
}

function App() {
  const [url, setUrl] = useState('')
  const [keywords, setKeywords] = useState('')
  const [mode, setMode] = useState('dynamic') // static | dynamic
  const [loading, setLoading] = useState(false) // URL 爬取 loading
  const [keywordLoading, setKeywordLoading] = useState(false) // 关键词批量爬取 loading
  const [error, setError] = useState('')
  const [keywordError, setKeywordError] = useState('')
  const [cards, setCards] = useState([])
  const [page, setPage] = useState(null)
  const [keywordResult, setKeywordResult] = useState(null)

  const caseLibraryUrl = import.meta.env.VITE_CASE_LIBRARY_URL || '/index.html'
  const canSubmit = useMemo(() => !!url.trim() && !loading, [url, loading])
  const canKeywordSubmit = useMemo(() => !!keywords.trim() && !keywordLoading, [keywords, keywordLoading])

  async function onCrawl() {
    setError('')
    setKeywordError('')
    setKeywordResult(null)
    setCards([])
    setPage(null)
    setLoading(true)
    try {
      const resp = await fetch('/api/crawl', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: normalizeUrl(url),
          mode,
          maxCards: 30,
        }),
      })
      const data = await resp.json()
      if (!resp.ok || !data.ok) throw new Error(data?.error || 'Crawl failed')
      setPage(data.page)
      setCards(Array.isArray(data.cards) ? data.cards : [])
    } catch (e) {
      setError(e?.message || 'Crawl failed')
    } finally {
      setLoading(false)
    }
  }

  const KEYWORD_SITES_TOTAL = 39

  async function onKeywordCrawl() {
    setKeywordError('')
    setError('')
    setPage(null)
    setCards([])
    setKeywordResult(null)
    setKeywordLoading(true)
    try {
      const resp = await fetch('/api/crawl-keywords', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          keywords: keywords.trim().split(/[\s,，、]+/).filter(Boolean),
          mode: 'static',
          maxCardsPerSite: 4,
        }),
      })
      const data = await resp.json()
      if (!resp.ok || !data.ok) throw new Error(data?.error || 'Keyword crawl failed')
      setKeywordResult(data)
      setCards(Array.isArray(data.cards) ? data.cards : [])
    } catch (e) {
      setKeywordError(e?.message || 'Keyword crawl failed')
    } finally {
      setKeywordLoading(false)
    }
  }

  async function onRetryFailedSites() {
    if (!keywordResult || !keywordResult.siteResults) return
    const failedUrls = keywordResult.siteResults
      .filter((s) => s.status === 'failed')
      .map((s) => s.siteUrl)
    if (failedUrls.length === 0) return
    setKeywordError('')
    setKeywordLoading(true)
    try {
      const resp = await fetch('/api/crawl-keywords-retry', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          siteUrls: failedUrls,
          keywords: keywordResult.keywords || keywords.trim().split(/[\s,，、]+/).filter(Boolean),
          mode: 'static',
          maxCardsPerSite: 4,
        }),
      })
      const data = await resp.json()
      if (!resp.ok || !data.ok) throw new Error(data?.error || 'Retry failed')
      const retriedSet = new Set(failedUrls)
      const mergedResults = keywordResult.siteResults.map((s) => {
        if (!retriedSet.has(s.siteUrl)) return s
        const r = data.siteResults?.find((x) => x.siteUrl === s.siteUrl)
        return r || s
      })
      const keptCards = (keywordResult.cards || []).filter((c) => !c.sourceSite || !retriedSet.has(c.sourceSite))
      const newCards = Array.isArray(data.cards) ? data.cards : []
      const mergedCards = [...keptCards, ...newCards]
      setKeywordResult({
        ...keywordResult,
        siteResults: mergedResults,
        sitesSucceeded: mergedResults.filter((x) => x.status === 'success').length,
        sitesFailed: mergedResults.filter((x) => x.status === 'failed').length,
        elapsedMs: keywordResult.elapsedMs + (data.elapsedMs || 0),
        cards: mergedCards,
      })
      setCards(mergedCards)
    } catch (e) {
      setKeywordError(e?.message || 'Retry failed')
    } finally {
      setKeywordLoading(false)
    }
  }

  return (
    <div className="min-h-full bg-slate-950 text-slate-100">
      <header className="sticky top-0 z-20 border-b border-white/10 bg-slate-950/80 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-xl border border-white/10 bg-white/5" />
            <div>
              <div className="text-sm font-semibold tracking-wide">Crawling</div>
              <div className="text-xs text-slate-400">Paste a URL or input keywords to extract cards</div>
            </div>
          </div>
          <a
            href={caseLibraryUrl}
            className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-slate-200 transition hover:border-white/20 hover:bg-white/10"
            aria-label="Back to Case Library"
            title="Back to Case Library"
          >
            <svg width="16" height="16" viewBox="0 0 20 20" fill="none" aria-hidden="true">
              <path
                d="M12.5 15L7.5 10L12.5 5"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            <span>Back</span>
          </a>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-8">
        <section className="rounded-2xl border border-white/10 bg-white/5 p-5">
          <div className="flex flex-col gap-4">
            <div>
              <label className="mb-2 block text-xs font-medium text-slate-300">Target URL</label>
              <div className="flex flex-col gap-3 md:flex-row md:items-end">
                <div className="flex-1">
                  <input
                    value={url}
                    onChange={(e) => setUrl(e.target.value)}
                    placeholder="Paste a URL, e.g. https://www.geekpark.net/"
                    className="w-full rounded-xl border border-white/10 bg-slate-950/40 px-4 py-3 text-sm outline-none placeholder:text-slate-500 focus:border-white/20"
                  />
                </div>
                <div className="w-full md:w-48">
                  <label className="mb-2 block text-xs font-medium text-slate-300">Mode</label>
                  <select
                    value={mode}
                    onChange={(e) => setMode(e.target.value)}
                    className="w-full rounded-xl border border-white/10 bg-slate-950/40 px-3 py-3 text-sm outline-none focus:border-white/20"
                  >
                    <option value="dynamic">Dynamic (Playwright)</option>
                    <option value="static">Static (Axios)</option>
                  </select>
                </div>
                <button
                  onClick={onCrawl}
                  disabled={!canSubmit}
                  className="inline-flex w-full items-center justify-center rounded-xl bg-emerald-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-60 md:w-auto"
                >
                  {loading ? 'Crawling URL...' : 'Start URL crawl'}
                </button>
              </div>
            </div>

            <div>
              <label className="mb-2 block text-xs font-medium text-slate-300">Target Keywords</label>
              <div className="flex flex-col gap-3 md:flex-row md:items-end">
                <div className="flex-1">
                  <input
                    value={keywords}
                    onChange={(e) => setKeywords(e.target.value)}
                    placeholder="Enter keywords, e.g. robot logistics delivery (comma or space separated)"
                    className="w-full rounded-xl border border-white/10 bg-slate-950/40 px-4 py-3 text-sm outline-none placeholder:text-slate-500 focus:border-white/20"
                  />
                </div>
                <button
                  onClick={onKeywordCrawl}
                  disabled={!canKeywordSubmit}
                  className="inline-flex w-full items-center justify-center rounded-xl bg-sky-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-sky-500 disabled:cursor-not-allowed disabled:opacity-60 md:w-auto"
                >
                  {keywordLoading ? 'Crawling Keywords...' : 'Start keyword crawl'}
                </button>
              </div>
            </div>
          </div>

          {error ? (
            <div className="mt-4 rounded-xl border border-red-400/20 bg-red-500/10 px-4 py-3 text-sm text-red-200">
              {error}
            </div>
          ) : null}

          {keywordError ? (
            <div className="mt-4 rounded-xl border border-red-400/20 bg-red-500/10 px-4 py-3 text-sm text-red-200">
              {keywordError}
            </div>
          ) : null}

          {keywordLoading ? (
            <div className="mt-4 rounded-xl border border-sky-400/20 bg-sky-500/10 px-4 py-4">
              <div className="mb-2 flex items-center justify-between text-sm text-sky-100">
                <span>Scanning preset sites ({KEYWORD_SITES_TOTAL} total)…</span>
              </div>
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-sky-900/50">
                <div
                  className="h-full w-1/3 rounded-full bg-sky-400"
                  style={{ animation: 'shimmer 1.8s ease-in-out infinite' }}
                  role="progressbar"
                  aria-valuetext="Loading"
                />
              </div>
            </div>
          ) : null}

          {keywordResult ? (
            <div className="mt-4 rounded-xl border border-white/10 bg-slate-900/40 p-4">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-300">
                <span>
                  {keywordResult.sitesSucceeded}/{keywordResult.sitesTotal} sites · {keywordResult.cards?.length || 0} cards
                  {keywordResult.elapsedMs != null ? ` · ${(keywordResult.elapsedMs / 1000).toFixed(1)}s` : ''}
                </span>
                {keywordResult.sitesFailed > 0 ? (
                  <button
                    type="button"
                    onClick={onRetryFailedSites}
                    disabled={keywordLoading}
                    className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-1.5 text-amber-200 transition hover:bg-amber-500/20 disabled:opacity-50"
                  >
                    Retry failed ({keywordResult.sitesFailed})
                  </button>
                ) : null}
              </div>
              <div className="max-h-52 space-y-2 overflow-auto pr-1 text-xs">
                {Array.isArray(keywordResult.siteResults) &&
                  keywordResult.siteResults.map((site) => (
                    <div
                      key={site.siteUrl}
                      className="flex flex-col gap-1 rounded-lg border border-white/10 bg-white/5 px-3 py-2 sm:flex-row sm:items-center sm:justify-between"
                    >
                      <div className="min-w-0 flex-1">
                        <a
                          href={site.finalUrl || site.siteUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="block truncate text-slate-300 hover:text-white"
                          title={site.siteUrl}
                        >
                          {site.siteUrl}
                        </a>
                        {site.status === 'failed' && site.error ? (
                          <p className="mt-0.5 truncate text-red-300/90" title={site.error}>
                            {site.error}
                          </p>
                        ) : null}
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                        <span
                          className={
                            site.status === 'success'
                              ? 'rounded-md bg-emerald-500/20 px-2 py-0.5 text-emerald-200'
                              : 'rounded-md bg-red-500/20 px-2 py-0.5 text-red-200'
                          }
                        >
                          {site.status}
                        </span>
                        <span className="text-slate-400">{site.matchedCards} cards</span>
                        {site.elapsedMs != null ? (
                          <span className="text-slate-500">{(site.elapsedMs / 1000).toFixed(1)}s</span>
                        ) : null}
                      </div>
                    </div>
                  ))}
              </div>
              {keywordResult.cards?.length === 0 && keywordResult.sitesSucceeded > 0 ? (
                <p className="mt-3 text-xs text-slate-500">No cards matched your keywords on these sites. Try different keywords or retry failed sites.</p>
              ) : null}
            </div>
          ) : null}

          {page ? (
            <div className="mt-4 text-xs text-slate-400">
              <div className="truncate">
                <span className="text-slate-300">Page:</span> {page.title || '(untitled)'} -{' '}
                <a className="text-sky-300 hover:text-sky-200" href={page.finalUrl} target="_blank" rel="noreferrer">
                  {page.finalUrl}
                </a>
              </div>
              {page.summary ? <div className="mt-1 line-clamp-2">{page.summary}</div> : null}
            </div>
          ) : null}
        </section>

        <section className="mt-6">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-200">Cards</h2>
            <div className="text-xs text-slate-500">{cards.length ? `${cards.length} items` : '-'}</div>
          </div>

          <div className="columns-1 gap-4 sm:columns-2 lg:columns-3">
            {cards.map((c, idx) => (
              <article
                key={`${c.pageUrl || idx}`}
                className="mb-4 break-inside-avoid overflow-hidden rounded-2xl border border-white/10 bg-white/5 transition hover:border-white/20"
              >
                <div className="h-40 w-full bg-slate-900">
                  {c.imageUrl ? (
                    <img src={c.imageUrl} alt="" className="h-full w-full object-cover" loading="lazy" />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-xs text-slate-500">No image</div>
                  )}
                </div>
                <div className="p-4">
                  <a
                    href={c.pageUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="line-clamp-2 text-sm font-semibold text-slate-100 hover:text-white"
                    title={c.title}
                  >
                    {c.title}
                  </a>
                  <p className="mt-2 line-clamp-3 text-xs leading-relaxed text-slate-400">
                    {c.description || 'No description extracted.'}
                  </p>
                  {c.sourceSite ? (
                    <p className="mt-1.5 truncate text-[10px] text-slate-500">
                      from {c.sourceSite.replace(/^https?:\/\//, '').replace(/\/$/, '').split('/')[0]}
                    </p>
                  ) : null}
                </div>
              </article>
            ))}
          </div>

          {!loading && !keywordLoading && !cards.length ? (
            <div className="mt-10 rounded-2xl border border-dashed border-white/10 bg-white/3 px-6 py-10 text-center text-sm text-slate-500">
              Paste a URL and click <span className="text-slate-300">Start URL crawl</span>, or input keywords and click{' '}
              <span className="text-slate-300">Start keyword crawl</span>.
            </div>
          ) : null}
        </section>
      </main>
    </div>
  )
}

export default App
