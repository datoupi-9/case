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
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [cards, setCards] = useState([])
  const [page, setPage] = useState(null)

  const caseLibraryUrl = import.meta.env.VITE_CASE_LIBRARY_URL || '/index.html'
  const canSubmit = useMemo(() => !!url.trim() && !loading, [url, loading])

  async function onCrawl() {
    setError('')
    setCards([])
    setPage(null)
    setLoading(true)
    try {
      const resp = await fetch('/api/crawl', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: normalizeUrl(url),
          keywords: keywords.trim() ? keywords.trim().split(/[\s,，、]+/).filter(Boolean) : undefined,
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

  return (
    <div className="min-h-full bg-slate-950 text-slate-100">
      <header className="sticky top-0 z-20 border-b border-white/10 bg-slate-950/80 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-xl border border-white/10 bg-white/5" />
            <div>
              <div className="text-sm font-semibold tracking-wide">Crawling</div>
              <div className="text-xs text-slate-400">Paste a URL, extract key info, render as cards</div>
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
              <input
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="Paste a URL, e.g. https://www.geekpark.net/"
                className="w-full rounded-xl border border-white/10 bg-slate-950/40 px-4 py-3 text-sm outline-none placeholder:text-slate-500 focus:border-white/20"
              />
            </div>
            <div>
              <label className="mb-2 block text-xs font-medium text-slate-300">Target Keywords</label>
              <input
                value={keywords}
                onChange={(e) => setKeywords(e.target.value)}
                placeholder="Enter keywords (optional), e.g. AI, product, news (comma or space separated)"
                className="w-full rounded-xl border border-white/10 bg-slate-950/40 px-4 py-3 text-sm outline-none placeholder:text-slate-500 focus:border-white/20"
              />
            </div>
            <div className="flex flex-col gap-3 md:flex-row md:items-end">
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
              {loading ? 'Crawling…' : 'Start crawling'}
            </button>
            </div>
          </div>

          {error ? (
            <div className="mt-4 rounded-xl border border-red-400/20 bg-red-500/10 px-4 py-3 text-sm text-red-200">
              {error}
            </div>
          ) : null}

          {page ? (
            <div className="mt-4 text-xs text-slate-400">
              <div className="truncate">
                <span className="text-slate-300">Page:</span> {page.title || '(untitled)'} ·{' '}
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
            <div className="text-xs text-slate-500">{cards.length ? `${cards.length} items` : '—'}</div>
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
                </div>
              </article>
            ))}
          </div>

          {!loading && !cards.length ? (
            <div className="mt-10 rounded-2xl border border-dashed border-white/10 bg-white/3 px-6 py-10 text-center text-sm text-slate-500">
              Paste a URL and click <span className="text-slate-300">Start crawling</span> to see extracted cards.
            </div>
          ) : null}
        </section>
      </main>
    </div>
  )
}

export default App
