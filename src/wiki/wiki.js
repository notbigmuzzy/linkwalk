const DEFAULT_WIKI_LANG = 'en'
const DEFAULT_TIMEOUT_MS = 8000
const GALLERY_PERSIST_KEY_PREFIX = 'linkwalk:galleryCache:v2'
const GALLERY_PERSIST_MAX = 80
const GALLERY_PERSIST_TTL_MS = 24 * 60 * 60 * 1000
let wikiLang = DEFAULT_WIKI_LANG

function normalizeWikiLang(lang) {
	const raw = typeof lang === 'string' ? lang.trim().toLowerCase() : ''
	if (!raw) return DEFAULT_WIKI_LANG
	if (!/^[a-z0-9-]{1,20}$/.test(raw)) return DEFAULT_WIKI_LANG
	return raw
}

export function setWikipediaLanguage(lang) {
	wikiLang = normalizeWikiLang(lang)
	return wikiLang
}

export function getWikipediaLanguage() {
	return wikiLang
}

function wikiHost() {
	return `https://${wikiLang}.wikipedia.org`
}

function wikiRestBase() {
	return `${wikiHost()}/api/rest_v1`
}

function wikiSummaryEndpoint() {
	return `${wikiRestBase()}/page/summary/`
}

function wikiActionApi() {
	return `${wikiHost()}/w/api.php`
}

function wikiCachePartitionKey() {
	return wikiLang
}

function galleryPersistKey() {
	return `${GALLERY_PERSIST_KEY_PREFIX}:${wikiCachePartitionKey()}`
}

function safeNow() {
	return typeof Date.now === 'function' ? Date.now() : new Date().getTime()
}

function loadGalleryPersistCache(storageKey) {
	try {
		if (typeof window === 'undefined' || !window.localStorage) return new Map()
		const key = typeof storageKey === 'string' && storageKey ? storageKey : GALLERY_PERSIST_KEY_PREFIX
		const raw = window.localStorage.getItem(key)
		if (!raw) return new Map()
		const parsed = JSON.parse(raw)
		const entries = Array.isArray(parsed?.entries) ? parsed.entries : []
		const now = safeNow()

		const map = new Map()
		for (const e of entries) {
			const key = typeof e?.k === 'string' ? e.k : ''
			const ts = typeof e?.t === 'number' ? e.t : 0
			const val = e?.v
			if (!key || !val) continue
			if (!(ts > 0) || now - ts > GALLERY_PERSIST_TTL_MS) continue
			map.set(key, { t: ts, v: val })
		}
		return map
	} catch {
		return new Map()
	}
}

function saveGalleryPersistCache(storageKey, map) {
	try {
		if (typeof window === 'undefined' || !window.localStorage) return
		const key = typeof storageKey === 'string' && storageKey ? storageKey : GALLERY_PERSIST_KEY_PREFIX
		const items = []
		for (const [k, entry] of map.entries()) {
			if (!k || !entry?.v) continue
			items.push({ k, t: entry.t, v: entry.v })
		}
		items.sort((a, b) => (b.t || 0) - (a.t || 0))
		if (items.length > GALLERY_PERSIST_MAX) items.length = GALLERY_PERSIST_MAX
		window.localStorage.setItem(key, JSON.stringify({ v: 1, entries: items }))
	} catch {

	}
}

function makeWikiError(message, extras = {}) {
	const err = new Error(message)
	Object.assign(err, extras)
	return err
}

function attachAbortSignal(sourceSignal, targetController) {
	if (!sourceSignal) return () => { }

	if (sourceSignal.aborted) {
		targetController.abort(sourceSignal.reason)
		return () => { }
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
	const langParams = wikiLang && wikiLang !== DEFAULT_WIKI_LANG ? { uselang: wikiLang } : {}
	const search = new URLSearchParams({
		format: 'json',
		formatversion: '2',
		origin: '*',
		...langParams,
		...params,
	})
	return `${wikiActionApi()}?${search.toString()}`
}

function firstSentences(text, maxSentences = 2) {
	const s = typeof text === 'string' ? text.trim() : ''
	if (!s) return ''

	const n = Math.max(1, Math.min(8, Math.floor(maxSentences)))

	const out = []
	let start = 0
	for (let i = 0; i < n; i += 1) {
		const rest = s.slice(start)
		if (!rest) break
		const m = rest.match(/[.!?](\s+|$)/)
		if (!m || typeof m.index !== 'number') {
			out.push(rest.trim())
			start = s.length
			break
		}
		const end = start + m.index + 1
		out.push(s.slice(start, end).trim())
		start = end
		while (start < s.length && /\s/.test(s[start])) start += 1
	}

	const joined = out.filter(Boolean).join(' ')
	return joined
}

function normalizeActionPageBundle(raw) {
	const pages = Array.isArray(raw?.query?.pages) ? raw.query.pages : []
	const p = pages?.[0] ?? null
	if (!p || typeof p !== 'object') return null

	const title = typeof p?.title === 'string' ? p.title : ''
	const extract = typeof p?.extract === 'string' ? p.extract : ''
	const thumbnailUrl = typeof p?.thumbnail?.source === 'string' ? p.thumbnail.source : null
	const pageUrl = typeof p?.fullurl === 'string' ? p.fullurl : null
	const pageprops = p?.pageprops
	const isDisambiguation = Boolean(pageprops && typeof pageprops === 'object' && Object.prototype.hasOwnProperty.call(pageprops, 'disambiguation'))

	const missing = Boolean(p?.missing)
	return {
		title,
		extract,
		thumbnailUrl,
		pageUrl,
		isDisambiguation,
		missing,
	}
}

async function fetchWikipediaPageBundle(title, { signal, maxChars = 6000, thumbSize = 640 } = {}) {
	const normalizedTitle = toWikiTitle(title)
	if (!normalizedTitle) {
		throw makeWikiError('Missing Wikipedia title', { code: 'bad_title' })
	}

	const chars = typeof maxChars === 'number' && Number.isFinite(maxChars) ? Math.max(800, Math.min(12000, Math.floor(maxChars))) : 6000
	const size = typeof thumbSize === 'number' && Number.isFinite(thumbSize) ? Math.max(64, Math.min(1200, Math.floor(thumbSize))) : 640

	const raw = await fetchActionQuery(
		{
			titles: normalizedTitle,
			redirects: '1',
			prop: 'extracts|pageimages|info|pageprops',
			explaintext: '1',
			exsectionformat: 'plain',
			exlimit: '1',
			exchars: String(chars),
			piprop: 'thumbnail',
			pithumbsize: String(size),
			inprop: 'url',
			ppprop: 'disambiguation',
		},
		{ signal }
	)

	const page = normalizeActionPageBundle(raw)
	if (!page || !page.title) {
		throw makeWikiError('Wikipedia response missing title', { code: 'bad_response', raw })
	}
	if (page.missing) {
		throw makeWikiError(`Wikipedia title "${page.title}" not found`, { code: 'not_found', data: page })
	}

	const longExtract = typeof page.extract === 'string' ? page.extract : ''
	const shortExtract = firstSentences(longExtract, 2)

	return {
		room: {
			title: page.title,
			extract: shortExtract,
			thumbnailUrl: page.thumbnailUrl,
			pageUrl: page.pageUrl,
			isDisambiguation: page.isDisambiguation,
			rawType: page.isDisambiguation ? 'disambiguation' : null,
		},
		longExtract,
	}
}

function normalizeWikipediaRelatedWithPageprops(raw) {
	const pages = Array.isArray(raw?.query?.pages) ? raw.query.pages : []
	return pages
		.map((p) => {
			const title = typeof p?.title === 'string' ? p.title : ''
			const extract = typeof p?.extract === 'string' ? p.extract : ''
			const thumbnailUrl = typeof p?.thumbnail?.source === 'string' ? p.thumbnail.source : null
			const pageUrl = typeof p?.fullurl === 'string' ? p.fullurl : null
			const pageprops = p?.pageprops
			const isDisambiguation = Boolean(pageprops && typeof pageprops === 'object' && Object.prototype.hasOwnProperty.call(pageprops, 'disambiguation'))
			return { title, extract, thumbnailUrl, pageUrl, isDisambiguation }
		})
		.filter((p) => p.title)
}

export async function fetchWikipediaRelatedFast(title, { signal, limit } = {}) {
	const normalizedTitle = toWikiTitle(title)
	if (!normalizedTitle) {
		throw makeWikiError('Missing Wikipedia title', { code: 'bad_title' })
	}

	const hardLimit = typeof limit === 'number' && Number.isFinite(limit) ? Math.max(1, Math.min(50, Math.floor(limit))) : 5

	const raw = await fetchActionQuery(
		{
			generator: 'search',
			gsrsearch: `morelike:${normalizedTitle}`,
			gsrnamespace: '0',
			gsrlimit: '12',
			redirects: '1',
			prop: 'extracts|pageimages|info|pageprops',
			exintro: '1',
			explaintext: '1',
			exsentences: '2',
			piprop: 'thumbnail',
			pithumbsize: '320',
			inprop: 'url',
			ppprop: 'disambiguation',
		},
		{ signal }
	)

	const pages = normalizeWikipediaRelatedWithPageprops(raw)
		.filter((p) => p.title !== normalizedTitle)
		.filter((p) => !p.isDisambiguation)
		.filter((p) => !isLowSignalRelatedTitle(p.title))

	const withExtract = []
	const withoutExtract = []
	for (const p of pages) {
		const extract = typeof p.extract === 'string' ? p.extract.trim() : ''
		if (extract) withExtract.push(p)
		else withoutExtract.push(p)
	}

	shuffleInPlace(withExtract)
	shuffleInPlace(withoutExtract)
	return [...withExtract, ...withoutExtract].slice(0, hardLimit)
}

export async function fetchWikipediaSummary(title, { signal } = {}) {
	const normalizedTitle = toWikiTitle(title)
	if (!normalizedTitle) {
		throw makeWikiError('Missing Wikipedia title', { code: 'bad_title' })
	}

	const url = `${wikiSummaryEndpoint()}${encodeURIComponent(normalizedTitle)}`

	try {
		return await fetchJsonWithTimeout(url, { signal })
	} catch (err) {
		if (err && typeof err === 'object' && err.code && !err.title) {
			err.title = normalizedTitle
		}
		throw err
	}
}

export async function fetchWikipediaRandomTitle({ signal, allow_disambiguation, allowDisambiguation } = {}) {
	const allowDisambig =
		typeof allowDisambiguation === 'boolean' ? allowDisambiguation : typeof allow_disambiguation === 'boolean' ? allow_disambiguation : false

	const maxAttempts = allowDisambig ? 1 : 6
	let lastRaw = null

	for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
		const raw = await fetchActionQuery(
			{
				list: 'random',
				rnnamespace: '0',
				rnlimit: '12',
			},
			{ signal }
		)
		lastRaw = raw

		const items = Array.isArray(raw?.query?.random) ? raw.query.random : []
		let pages = items
			.map((r) => ({ title: typeof r?.title === 'string' ? r.title.trim() : '' }))
			.filter((p) => Boolean(p.title))

		if (!allowDisambig) {
			pages = await filterOutDisambiguationPages(pages, { signal })
		}

		if (pages.length > 0) {
			shuffleInPlace(pages)
			return pages[0].title
		}
	}

	throw makeWikiError('Wikipedia random response missing non-disambiguation title', { code: 'bad_response', raw: lastRaw })
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

function normalizeActionMediaInfo(raw, { maxImages = 6, maxVideos = 2 } = {}) {
	const pages = Array.isArray(raw?.query?.pages) ? raw.query.pages : []
	const images = []
	const videos = []
	const seenUrl = new Set()

	for (const p of pages) {
		const fileTitle = typeof p?.title === 'string' ? p.title : ''
		const info = Array.isArray(p?.imageinfo) ? p.imageinfo[0] : null
		const url = typeof info?.url === 'string' ? info.url : null
		if (!url) continue
		if (seenUrl.has(url)) continue
		seenUrl.add(url)

		const mime = typeof info?.mime === 'string' ? info.mime : ''
		const mediaType = typeof info?.mediatype === 'string' ? info.mediatype : ''
		const loweredUrl = url.toLowerCase()


		if (loweredUrl.endsWith('.svg')) continue

		const isVideo = mediaType.toUpperCase() === 'VIDEO' || mime.toLowerCase().startsWith('video/') || loweredUrl.endsWith('.ogv')
		if (isVideo) {
			if (videos.length < maxVideos) {
				videos.push({ title: fileTitle, url, mime, mediatype: mediaType })
			}
			continue
		}

		const isImage = mime.toLowerCase().startsWith('image/') || /\.(png|jpe?g|gif|webp|avif)$/i.test(loweredUrl)
		if (isImage) {
			images.push(url)
			if (images.length >= maxImages) break
		}
	}

	return { images, videos }
}

async function fetchWikipediaMedia(title, { signal, maxImages = 6, maxVideos = 2 } = {}) {
	const normalizedTitle = toWikiTitle(title)
	if (!normalizedTitle) {
		throw makeWikiError('Missing Wikipedia title', { code: 'bad_title' })
	}

	const raw = await fetchActionQuery(
		{
			titles: normalizedTitle,
			redirects: '1',
			generator: 'images',
			gimlimit: '30',
			prop: 'imageinfo',
			iiprop: 'url|mime|mediatype',
		},
		{ signal }
	)

	return normalizeActionMediaInfo(raw, { maxImages, maxVideos })
}

function pickPlayableVideoUrlFromVideoinfo(info) {
	const baseUrl = typeof info?.url === 'string' ? info.url : ''
	const derivatives = Array.isArray(info?.derivatives) ? info.derivatives : []

	function scoreCandidate({ src, type }) {
		const u = typeof src === 'string' ? src : ''
		const t = typeof type === 'string' ? type.toLowerCase() : ''
		if (!u) return -1
		if (t.includes('video/mp4') || u.toLowerCase().endsWith('.mp4')) return 3
		if (t.includes('video/webm') || u.toLowerCase().endsWith('.webm')) return 2
		if (t.includes('video/')) return 1
		return 0
	}

	let best = null
	let bestScore = -1
	for (const d of derivatives) {
		const src = typeof d?.src === 'string' ? d.src : null
		const type = typeof d?.type === 'string' ? d.type : null
		const s = scoreCandidate({ src, type })
		if (s > bestScore) {
			bestScore = s
			best = src
		}
	}

	if (best) return best


	if (typeof baseUrl === 'string' && /\.(mp4|webm)$/i.test(baseUrl)) return baseUrl
	return typeof baseUrl === 'string' && baseUrl ? baseUrl : null
}

async function fetchWikipediaPlayableVideoUrl(fileTitle, { signal } = {}) {
	const t = typeof fileTitle === 'string' ? fileTitle.trim() : ''
	if (!t) return null

	const raw = await fetchActionQuery(
		{
			titles: t,
			redirects: '1',
			prop: 'videoinfo',
			viprop: 'url|mime|mediatype|derivatives',
		},
		{ signal }
	)

	const pages = Array.isArray(raw?.query?.pages) ? raw.query.pages : []
	const p = pages?.[0] ?? null
	const vi = Array.isArray(p?.videoinfo) ? p.videoinfo[0] : null
	const playable = pickPlayableVideoUrlFromVideoinfo(vi)
	return typeof playable === 'string' && playable.trim() ? playable.trim() : null
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

async function filterOutDisambiguationPages(pages, { signal } = {}) {
	const titles = Array.isArray(pages) ? pages.map((p) => (typeof p?.title === 'string' ? p.title.trim() : '')).filter(Boolean) : []
	if (titles.length === 0) return pages

	const disambigKeys = new Set()
	const redirects = new Map()

	try {
		const chunkSize = 50
		for (let i = 0; i < titles.length; i += chunkSize) {
			const chunk = titles.slice(i, i + chunkSize)
			const raw = await fetchActionQuery(
				{
					prop: 'pageprops',
					ppprop: 'disambiguation',
					redirects: '1',
					titles: chunk.join('|'),
				},
				{ signal }
			)

			const qp = raw?.query
			const rawPages = Array.isArray(qp?.pages) ? qp.pages : []
			for (const p of rawPages) {
				const t = typeof p?.title === 'string' ? p.title.trim() : ''
				if (!t) continue
				const props = p?.pageprops
				if (props && typeof props === 'object' && Object.prototype.hasOwnProperty.call(props, 'disambiguation')) {
					disambigKeys.add(t.toLowerCase())
				}
			}

			const rawRedirects = Array.isArray(qp?.redirects) ? qp.redirects : []
			for (const r of rawRedirects) {
				const from = typeof r?.from === 'string' ? r.from.trim().toLowerCase() : ''
				const to = typeof r?.to === 'string' ? r.to.trim().toLowerCase() : ''
				if (from && to) redirects.set(from, to)
			}
		}
	} catch (err) {
		console.warn('[linkwalk] Failed to filter disambiguation related pages', err)
		return pages
	}

	return Array.isArray(pages)
		? pages.filter((p) => {
			const key = typeof p?.title === 'string' ? p.title.trim().toLowerCase() : ''
			if (!key) return false
			if (disambigKeys.has(key)) return false
			const redirected = redirects.get(key)
			if (redirected && disambigKeys.has(redirected)) return false
			return true
		})
		: pages
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
				gsrlimit: '12',
				...commonProps,
			},
			{ signal }
		),
		fetchActionQuery(
			{
				generator: 'linkshere',
				titles: normalizedTitle,
				glhnamespace: '0',
				glhlimit: '12',
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
	const mergedNoDisambig = await filterOutDisambiguationPages(merged, { signal })

	const withExtract = []
	const withoutExtract = []
	for (const p of mergedNoDisambig) {
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
	const merged2NoDisambig = await filterOutDisambiguationPages(merged2, { signal })
	const withExtract2 = []
	const withoutExtract2 = []
	for (const p of merged2NoDisambig) {
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

	const media = await fetchWikipediaMedia(normalizedTitle, { signal, maxImages, maxVideos: 0 })
	return Array.isArray(media?.images) ? media.images : []
}

export async function fetchWikipediaLongExtract(title, { signal, maxChars = 5000 } = {}) {
	const normalizedTitle = toWikiTitle(title)
	if (!normalizedTitle) {
		throw makeWikiError('Missing Wikipedia title', { code: 'bad_title' })
	}

	const chars = typeof maxChars === 'number' && Number.isFinite(maxChars) ? Math.max(800, Math.min(12000, Math.floor(maxChars))) : 5000

	const raw = await fetchActionQuery(
		{
			titles: normalizedTitle,
			prop: 'extracts',
			explaintext: '1',
			exsectionformat: 'plain',
			exlimit: '1',
			exchars: String(chars),
			redirects: '1',
		},
		{ signal }
	)

	const pages = Array.isArray(raw?.query?.pages) ? raw.query.pages : []
	const extract = typeof pages?.[0]?.extract === 'string' ? pages[0].extract : ''
	return extract
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

export async function fetchGalleryRoomRelated(title, opts = {}) {
	const normalizedTitle = toWikiTitle(title)
	if (!normalizedTitle) {
		throw makeWikiError('Missing Wikipedia title', { code: 'bad_title' })
	}

	const partition = wikiCachePartitionKey()

	if (!fetchGalleryRoomRelated._relatedCache) fetchGalleryRoomRelated._relatedCache = new Map()
	let relatedCache = fetchGalleryRoomRelated._relatedCache.get(partition)
	if (!relatedCache) {
		relatedCache = new Map()
		fetchGalleryRoomRelated._relatedCache.set(partition, relatedCache)
	}

	const cached = relatedCache.get(normalizedTitle)
	if (cached && Array.isArray(cached.items)) {
		return cached.items
	}

	const items = await fetchWikipediaRelatedFast(normalizedTitle, { ...opts, limit: 30 })
	if (Array.isArray(items)) {
		relatedCache.set(normalizedTitle, { t: safeNow(), items })
	}
	return items
}

export async function fetchGalleryRoomData(title, opts = {}) {

	const normalizedTitle = toWikiTitle(title)
	if (!normalizedTitle) {
		throw makeWikiError('Missing Wikipedia title', { code: 'bad_title' })
	}

	const partition = wikiCachePartitionKey()




	if (!fetchGalleryRoomData._cache) fetchGalleryRoomData._cache = new Map()
	let cache = fetchGalleryRoomData._cache.get(partition)
	if (!cache) {
		cache = new Map()
		fetchGalleryRoomData._cache.set(partition, cache)
	}
	const cachedBase = cache.get(normalizedTitle)

	if (!fetchGalleryRoomData._persist) fetchGalleryRoomData._persist = new Map()
	let persist = fetchGalleryRoomData._persist.get(partition)
	if (!persist) {
		persist = loadGalleryPersistCache(galleryPersistKey())
		fetchGalleryRoomData._persist.set(partition, persist)
	}
	const persisted = persist.get(normalizedTitle)
	const baseFromPersist = persisted && persisted.v ? persisted.v : null

	let base = cachedBase || baseFromPersist
	if (!base) {
		const [pageBundle, media] = await Promise.all([
			fetchWikipediaPageBundle(normalizedTitle, { ...opts, maxChars: 6000, thumbSize: 640 }),

			fetchWikipediaMedia(normalizedTitle, { ...opts, maxImages: 6, maxVideos: 2 }),
		])

		const room = pageBundle?.room
		const longExtract = typeof pageBundle?.longExtract === 'string' ? pageBundle.longExtract : ''

		if (!room || !room.title) {
			throw makeWikiError('Wikipedia response missing title', { code: 'bad_response', raw: pageBundle })
		}

		if (room.isDisambiguation) {
			throw makeWikiError(`Wikipedia title "${room.title}" is a disambiguation page`, {
				code: 'disambiguation',
				data: room,
			})
		}

		const photos = Array.isArray(media?.images) ? media.images : []
		const videos = Array.isArray(media?.videos) ? media.videos : []

		const mainThumbnailUrl = room.thumbnailUrl || (Array.isArray(photos) && typeof photos[0] === 'string' ? photos[0] : null)

		function canonicalImageKey(url) {
			if (typeof url !== 'string') return ''
			const raw = url.trim()
			if (!raw) return ''
			try {
				const u = new URL(raw)
				const parts = u.pathname.split('/').filter(Boolean)
				const thumbIdx = parts.indexOf('thumb')
				if (thumbIdx >= 0 && parts.length >= 2) {

					const fileName = parts[parts.length - 2] || parts[parts.length - 1]
					return decodeURIComponent(fileName).toLowerCase()
				}
				const fileName = parts[parts.length - 1] || ''
				return decodeURIComponent(fileName).toLowerCase()
			} catch {
				const parts = raw.split('?')[0].split('/').filter(Boolean)
				return String(parts[parts.length - 1] || '').toLowerCase()
			}
		}

		const mainKey = canonicalImageKey(mainThumbnailUrl)
		const filteredPhotos = Array.isArray(photos)
			? photos
				.filter((u) => typeof u === 'string' && u.trim())
				.filter((u) => {
					const k = canonicalImageKey(u)
					return !mainKey || !k || k !== mainKey
				})
				.slice(0, 5)
			: []

		let videoUrl = null
		const firstVideo = videos?.[0] ?? null
		const candidateUrl = typeof firstVideo?.url === 'string' ? firstVideo.url.trim() : ''
		if (candidateUrl) {

			if (/\.(mp4|webm)$/i.test(candidateUrl)) {
				videoUrl = candidateUrl
			} else {
				const fileTitle = typeof firstVideo?.title === 'string' ? firstVideo.title.trim() : ''
				videoUrl = await fetchWikipediaPlayableVideoUrl(fileTitle, { signal: opts?.signal })
			}
		}

		base = {
			room,
			mainThumbnailUrl,
			photos: filteredPhotos,
			videoUrl,
			longExtract: typeof longExtract === 'string' ? longExtract : '',
		}

		cache.set(normalizedTitle, base)
		if (persist) {
			persist.set(normalizedTitle, { t: safeNow(), v: base })
			saveGalleryPersistCache(galleryPersistKey(), persist)
		}
	} else if (!cachedBase && baseFromPersist) {
		cache.set(normalizedTitle, baseFromPersist)
	}

	const includeRelated = Boolean(opts?.includeRelated)
	if (!includeRelated) {
		return { ...base, seeAlso: [] }
	}

	const seeAlso = await fetchGalleryRoomRelated(normalizedTitle, { signal: opts?.signal })
	return { ...base, seeAlso }
}

fetchGalleryRoomData._cache = null
fetchGalleryRoomData._persist = null
fetchGalleryRoomRelated._relatedCache = null
