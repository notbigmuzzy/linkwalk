const WIKI_REST_BASE = 'https://en.wikipedia.org/api/rest_v1'
const WIKI_SUMMARY_ENDPOINT = `${WIKI_REST_BASE}/page/summary/`

const WIKI_ACTION_API = 'https://en.wikipedia.org/w/api.php'

const DEFAULT_TIMEOUT_MS = 8000

function makeWikiError(message, extras = {}) {
  const err = new Error(message)
  Object.assign(err, extras)
  return err
}

function attachAbortSignal(sourceSignal, targetController) {
  if (!sourceSignal) return () => {}

  if (sourceSignal.aborted) {
    targetController.abort(sourceSignal.reason)
    return () => {}
  }

  const onAbort = () => targetController.abort(sourceSignal.reason)
  sourceSignal.addEventListener('abort', onAbort, { once: true })
  return () => sourceSignal.removeEventListener('abort', onAbort)
}

function toWikiTitle(title) {
  return String(title ?? '')
    .trim()
    .replace(/\s+/g, ' ')
}

async function fetchJsonWithTimeout(url, { signal } = {}) {
  const controller = new AbortController()
  const detach = attachAbortSignal(signal, controller)
  const timeoutId = window.setTimeout(() => controller.abort(new Error('timeout')), DEFAULT_TIMEOUT_MS)

  let res
  try {
    res = await fetch(url, {
      method: 'GET',
      headers: {
        accept: 'application/json',
        'Api-User-Agent': 'linkwalk (local dev)',
      },
      signal: controller.signal,
    })
  } catch (e) {
    if (controller.signal.aborted) {
      throw makeWikiError('Wikipedia request aborted', {
        code: 'aborted',
        url,
        cause: e,
      })
    }
    throw makeWikiError('Wikipedia request failed', {
      code: 'network',
      url,
      cause: e,
    })
  } finally {
    window.clearTimeout(timeoutId)
    detach()
  }

  if (!res.ok) {
    const contentType = res.headers.get('content-type') ?? ''
    let body = null
    try {
      body = contentType.includes('application/json') ? await res.json() : await res.text()
    } catch {
      body = null
    }

    const maybeMessage = typeof body === 'object' && body && typeof body.detail === 'string' ? body.detail : null

    throw makeWikiError(`Wikipedia fetch failed (${res.status})${maybeMessage ? `: ${maybeMessage}` : ''}`, {
      code: res.status === 404 ? 'not_found' : 'http',
      status: res.status,
      url,
      body,
    })
  }

  return res.json()
}

function buildActionApiUrl(params) {
  const search = new URLSearchParams({
    format: 'json',
    formatversion: '2',
    origin: '*',
    ...params,
  })
  return `${WIKI_ACTION_API}?${search.toString()}`
}

export async function fetchWikipediaSummary(title, { signal } = {}) {
  const normalizedTitle = toWikiTitle(title)
  if (!normalizedTitle) {
    throw makeWikiError('Missing Wikipedia title', { code: 'bad_title' })
  }

  const url = `${WIKI_SUMMARY_ENDPOINT}${encodeURIComponent(normalizedTitle)}`

  try {
    return await fetchJsonWithTimeout(url, { signal })
  } catch (err) {
    if (err && typeof err === 'object' && err.code && !err.title) {
      err.title = normalizedTitle
    }
    throw err
  }
}

async function fetchActionQuery(params, { signal } = {}) {
  const url = buildActionApiUrl({ action: 'query', ...params })
  const json = await fetchJsonWithTimeout(url, { signal })
  if (json?.error?.info) {
    throw makeWikiError(String(json.error.info), { code: 'api_error', url, error: json.error })
  }
  return json
}

export function normalizeWikipediaSummary(raw) {
  const title = typeof raw?.title === 'string' ? raw.title : ''
  const extract = typeof raw?.extract === 'string' ? raw.extract : ''

  const thumbnailUrl =
    typeof raw?.thumbnail?.source === 'string'
      ? raw.thumbnail.source
      : typeof raw?.originalimage?.source === 'string'
        ? raw.originalimage.source
        : null

  const pageUrl = typeof raw?.content_urls?.desktop?.page === 'string' ? raw.content_urls.desktop.page : null
  const type = typeof raw?.type === 'string' ? raw.type : null
  const isDisambiguation = type === 'disambiguation'

  return {
    title,
    extract,
    thumbnailUrl,
    pageUrl,
    isDisambiguation,
    rawType: type,
  }
}

export function normalizeWikipediaRelated(raw) {
  const pages = Array.isArray(raw?.query?.pages) ? raw.query.pages : []
  return pages
    .map((p) => {
      const title = typeof p?.title === 'string' ? p.title : ''
      const extract = typeof p?.extract === 'string' ? p.extract : ''
      const thumbnailUrl = typeof p?.thumbnail?.source === 'string' ? p.thumbnail.source : null
      const pageUrl = typeof p?.fullurl === 'string' ? p.fullurl : null
      return { title, extract, thumbnailUrl, pageUrl }
    })
    .filter((p) => p.title)
}

function normalizeActionImageInfo(raw, { maxImages = 4 } = {}) {
  const pages = Array.isArray(raw?.query?.pages) ? raw.query.pages : []
  const out = []
  const seen = new Set()

  for (const p of pages) {
    const info = Array.isArray(p?.imageinfo) ? p.imageinfo[0] : null
    const url = typeof info?.url === 'string' ? info.url : null
    if (!url) continue
    if (seen.has(url)) continue
    if (url.toLowerCase().endsWith('.svg')) continue
    seen.add(url)
    out.push(url)
    if (out.length >= maxImages) break
  }

  return out
}

export async function fetchWikipediaSeeAlso(title, { signal } = {}) {
  const normalizedTitle = toWikiTitle(title)
  if (!normalizedTitle) {
    throw makeWikiError('Missing Wikipedia title', { code: 'bad_title' })
  }

  return fetchActionQuery(
    {
      generator: 'links',
      titles: normalizedTitle,
      gplnamespace: '0',
      gpllimit: '10',
      prop: 'extracts|pageimages|info',
      exintro: '1',
      explaintext: '1',
      exsentences: '2',
      piprop: 'thumbnail',
      pithumbsize: '320',
      inprop: 'url',
    },
    { signal }
  )
}

function isLowSignalRelatedTitle(t) {
  const title = String(t || '').trim()
  if (!title) return true

  const lowered = title.toLowerCase()
  if (lowered.startsWith('list of ')) return true
  if (lowered.startsWith('outline of ')) return true
  if (lowered.startsWith('index of ')) return true
  if (lowered.startsWith('timeline of ')) return true
  if (/^\d{3,4}$/.test(title)) return true

  return false
}

function dedupeByTitle(pages) {
  const out = []
  const seen = new Set()

  for (const p of pages) {
    const title = typeof p?.title === 'string' ? p.title.trim() : ''
    if (!title) continue
    if (seen.has(title)) continue
    seen.add(title)
    out.push(p)
  }

  return out
}

function randInt(maxExclusive) {
  const max = Math.floor(maxExclusive)
  if (!(max > 0)) return 0

  const cryptoObj = typeof window !== 'undefined' ? window.crypto : null
  if (cryptoObj && typeof cryptoObj.getRandomValues === 'function') {
    const buf = new Uint32Array(1)
    cryptoObj.getRandomValues(buf)
    return buf[0] % max
  }

  return Math.floor(Math.random() * max)
}

function shuffleInPlace(arr) {
  for (let i = arr.length - 1; i > 0; i -= 1) {
    const j = randInt(i + 1)
    const tmp = arr[i]
    arr[i] = arr[j]
    arr[j] = tmp
  }
  return arr
}

export async function fetchWikipediaRelatedBetter(title, { signal, limit } = {}) {
  const normalizedTitle = toWikiTitle(title)
  if (!normalizedTitle) {
    throw makeWikiError('Missing Wikipedia title', { code: 'bad_title' })
  }

  const hardLimit = typeof limit === 'number' && Number.isFinite(limit) ? Math.max(1, Math.min(10, Math.floor(limit))) : 5

  const commonProps = {
    prop: 'extracts|pageimages|info',
    exintro: '1',
    explaintext: '1',
    exsentences: '2',
    piprop: 'thumbnail',
    pithumbsize: '320',
    inprop: 'url',
  }

  const [backlinksRaw, outgoingRaw] = await Promise.all([
    fetchActionQuery(
      {
        generator: 'search',
        gsrsearch: `morelike:${normalizedTitle}`,
        gsrnamespace: '0',
        gsrlimit: '20',
        ...commonProps,
      },
      { signal }
    ),
    fetchActionQuery(
      {
        generator: 'linkshere',
        titles: normalizedTitle,
        glhnamespace: '0',
        glhlimit: '20',
        ...commonProps,
      },
      { signal }
    ),
  ])

  const moreLike = normalizeWikipediaRelated(backlinksRaw)
    .filter((p) => p.title !== normalizedTitle)
    .filter((p) => !isLowSignalRelatedTitle(p.title))

  const backlinks = normalizeWikipediaRelated(outgoingRaw)
    .filter((p) => p.title !== normalizedTitle)
    .filter((p) => !isLowSignalRelatedTitle(p.title))

  const merged = dedupeByTitle([...moreLike, ...backlinks])

  const withExtract = []
  const withoutExtract = []
  for (const p of merged) {
    const extract = typeof p.extract === 'string' ? p.extract.trim() : ''
    if (extract) withExtract.push(p)
    else withoutExtract.push(p)
  }

  shuffleInPlace(withExtract)
  shuffleInPlace(withoutExtract)

  const picked = [...withExtract, ...withoutExtract].slice(0, hardLimit)
  if (picked.length >= hardLimit) return picked

  const fallbackOutgoingRaw = await fetchActionQuery(
    {
      generator: 'links',
      titles: normalizedTitle,
      gplnamespace: '0',
      gpllimit: '40',
      ...commonProps,
    },
    { signal }
  )

  const outgoing = normalizeWikipediaRelated(fallbackOutgoingRaw)
    .filter((p) => p.title !== normalizedTitle)
    .filter((p) => !isLowSignalRelatedTitle(p.title))

  const merged2 = dedupeByTitle([...picked, ...outgoing])
  const withExtract2 = []
  const withoutExtract2 = []
  for (const p of merged2) {
    const extract = typeof p.extract === 'string' ? p.extract.trim() : ''
    if (extract) withExtract2.push(p)
    else withoutExtract2.push(p)
  }
  shuffleInPlace(withExtract2)
  shuffleInPlace(withoutExtract2)
  return [...withExtract2, ...withoutExtract2].slice(0, hardLimit)
}

export async function fetchWikipediaPhotos(title, { signal, maxImages = 4 } = {}) {
  const normalizedTitle = toWikiTitle(title)
  if (!normalizedTitle) {
    throw makeWikiError('Missing Wikipedia title', { code: 'bad_title' })
  }

  const pageWithImages = await fetchActionQuery(
    {
      titles: normalizedTitle,
      prop: 'images',
      imlimit: '20',
    },
    { signal }
  )

  const pages = Array.isArray(pageWithImages?.query?.pages) ? pageWithImages.query.pages : []
  const images = Array.isArray(pages?.[0]?.images) ? pages[0].images : []
  const fileTitles = images
    .map((im) => (typeof im?.title === 'string' ? im.title : ''))
    .filter((t) => t.startsWith('File:'))
    .slice(0, 12)

  if (fileTitles.length === 0) return []

  const imageInfo = await fetchActionQuery(
    {
      titles: fileTitles.join('|'),
      prop: 'imageinfo',
      iiprop: 'url',
    },
    { signal }
  )

  return normalizeActionImageInfo(imageInfo, { maxImages })
}

export async function fetchRoomData(title, opts = {}) {
  const raw = await fetchWikipediaSummary(title, opts)
  const data = normalizeWikipediaSummary(raw)

  if (!data.title) {
    throw makeWikiError('Wikipedia response missing title', { code: 'bad_response', raw })
  }

  if (data.isDisambiguation) {
    throw makeWikiError(`Wikipedia title "${data.title}" is a disambiguation page`, {
      code: 'disambiguation',
      data,
    })
  }

  return data
}

export async function fetchGalleryRoomData(title, opts = {}) {
  const [summaryRaw, photos, relatedBetter] = await Promise.all([
    fetchWikipediaSummary(title, opts),
    fetchWikipediaPhotos(title, { ...opts, maxImages: 4 }),
    fetchWikipediaRelatedBetter(title, { ...opts, limit: 7 }),
  ])

  const room = normalizeWikipediaSummary(summaryRaw)
  if (!room.title) {
    throw makeWikiError('Wikipedia response missing title', { code: 'bad_response', raw: summaryRaw })
  }

  if (room.isDisambiguation) {
    throw makeWikiError(`Wikipedia title "${room.title}" is a disambiguation page`, {
      code: 'disambiguation',
      data: room,
    })
  }

  const seeAlso = relatedBetter

  return {
    room,
    mainThumbnailUrl: room.thumbnailUrl,
    photos,
    seeAlso,
  }
}
