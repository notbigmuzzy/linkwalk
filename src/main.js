import './style.css'
import { startYourEngines } from './engine/engine.js'
import { fetchGalleryRoomData } from './wiki/wiki.js'

const app = document.querySelector('#app')
if (!app) {
  throw new Error('Missing #app element')
}

app.innerHTML = `
  <div id="overlay" role="button" tabindex="0" aria-label="Click to start">
    <div id="overlay-inner">
      <div id="overlay-title">Click to play</div>
      <div id="overlay-sub">WASD move · Mouse look · SPACE jump · Shift sprint · Esc unlock</div>
    </div>
  </div>
  <div id="hud">
    <div id="fps" aria-label="Frames per second"></div>
    <div id="crosshair" aria-hidden="true"></div>
    <div id="compass" aria-label="Compass heading"></div>
  </div>
  <canvas id="scene" aria-label="3D scene"></canvas>
`

const canvas = document.querySelector('#scene')
if (!(canvas instanceof HTMLCanvasElement)) {
  throw new Error('Missing canvas#scene')
}

const fpsEl = document.querySelector('#fps')
if (!(fpsEl instanceof HTMLElement)) {
  throw new Error('Missing #fps element')
}

const overlayEl = document.querySelector('#overlay')
if (!(overlayEl instanceof HTMLElement)) {
  throw new Error('Missing #overlay element')
}

const compassEl = document.querySelector('#compass')
if (!(compassEl instanceof HTMLElement)) {
  throw new Error('Missing #compass element')
}

const crosshairEl = document.querySelector('#crosshair')
if (!(crosshairEl instanceof HTMLElement)) {
  throw new Error('Missing #crosshair element')
}

function requestPlay() {
  canvas.requestPointerLock()
}

overlayEl.addEventListener('click', requestPlay)
overlayEl.addEventListener('keydown', (e) => {
  if (e.code === 'Enter' || e.code === 'Space') requestPlay()
})

const params = new URLSearchParams(window.location.search)
const initialTitle = params.get('exhibit')
let engineApi = null

let wikiAbortController = null
let activeNavId = 0

function setLoading(loading) {
  crosshairEl.classList.toggle('loading', Boolean(loading))
  if (engineApi && typeof engineApi.setInteractionLocked === 'function') {
    engineApi.setInteractionLocked(Boolean(loading))
  }
}

let historyIndex = 0

function setUrlAndState(title, { push = false } = {}) {
  const nextParams = new URLSearchParams(window.location.search)
  if (title) nextParams.set('exhibit', title)
  else nextParams.delete('exhibit')

  const q = nextParams.toString()
  const url = q ? `${window.location.pathname}?${q}` : window.location.pathname
  const nextState = { linkwalk: true, idx: historyIndex, title: title || null }

  if (push) {
    historyIndex += 1
    nextState.idx = historyIndex
    window.history.pushState(nextState, '', url)
  } else {
    window.history.replaceState(nextState, '', url)
  }
}

function loadAndEnterGallery(title, { pushHistory = false, spawn, updateUrlState = true } = {}) {
  if (!title) return

  if (wikiAbortController) wikiAbortController.abort()
  wikiAbortController = new AbortController()
  const navId = (activeNavId += 1)

  setLoading(true)

  fetchGalleryRoomData(title, { signal: wikiAbortController.signal })
    .then((data) => {
      if (navId !== activeNavId) return

      const relatedTitles = Array.isArray(data?.seeAlso)
        ? data.seeAlso
            .map((p) => (p && typeof p.title === 'string' ? p.title : ''))
            .map((t) => t.trim())
            .filter(Boolean)
        : []

      if (updateUrlState) {
        setUrlAndState(title, { push: Boolean(pushHistory) })
      }

      if (engineApi && typeof engineApi.setRoom === 'function') {
        engineApi.setRoom({
          roomMode: 'gallery',
          roomSeedTitle: title,
          galleryEntryWall: 'south',
          galleryRelatedTitles: relatedTitles,
          galleryTitle: typeof data?.room?.title === 'string' ? data.room.title : title,
          galleryDescription: typeof data?.room?.extract === 'string' ? data.room.extract : '',
          galleryMainThumbnailUrl: typeof data?.mainThumbnailUrl === 'string' ? data.mainThumbnailUrl : null,
          galleryPhotos: Array.isArray(data?.photos) ? data.photos : [],
          galleryLongExtract: typeof data?.longExtract === 'string' ? data.longExtract : '',
          spawn,
        })
      }
    })
    .catch((err) => {
      if (err && err.code === 'aborted') return
      console.warn('[linkwalk] Wiki fetch failed', err)
    })
    .finally(() => {
      if (navId !== activeNavId) return
      setLoading(false)
    })
}

function enterlobby({ push = false } = {}) {
  setUrlAndState(null, { push })
  if (engineApi && typeof engineApi.setRoom === 'function') {
    engineApi.setRoom({ roomMode: 'lobby', spawn: { type: 'fromWall', wall: 'south' } })
  }
}

function goBackInApp() {
  setLoading(true)
  if (historyIndex > 0) {
    window.history.back()
    return
  }
  enterlobby({ push: false })
  setLoading(false)
}

engineApi = startYourEngines({
  canvas,
  roomSeedTitle: initialTitle ?? 'Lobby',
  roomMode: initialTitle ? 'gallery' : 'lobby',
  roomSpawn: initialTitle ? undefined : { type: 'fromWall', wall: 'south' },
  lobbyCategories: ['Culture', 'Geography', 'Animals', 'History', 'Nature', 'People', 'Philosophy', 'Religion', 'Society', 'Technology'],
  onFps(fps) {
    fpsEl.textContent = `${fps.toFixed(0)} FPS`
  },
  onHeading({ cardinal }) {
    compassEl.textContent = `${cardinal}`
  },
  onPointerLockChange(locked) {
    overlayEl.hidden = locked
    document.body.classList.toggle('locked', locked)
  },
  onDoorTrigger(door) {
    if (door && typeof door.category === 'string' && door.category.length > 0) {
      loadAndEnterGallery(door.category, {
        pushHistory: true,
        spawn: { type: 'fromWall', wall: 'south' },
      })
      return
    }

    if (door && typeof door.articleTitle === 'string' && door.articleTitle.trim().length > 0) {
      const title = door.articleTitle.trim()
      loadAndEnterGallery(title, {
        pushHistory: true,
        spawn: { type: 'fromWall', wall: 'south' },
      })
      return
    }

    if (door && door.target === 'back') {
      goBackInApp()
      return
    }

    if (door && door.target === 'lobby') {
      enterlobby({ push: true })
      return
    }

    if (door && typeof door.id === 'string') {
      console.info(`[linkwalk] Door clicked: ${door.id}`)
    }
  },
})

setUrlAndState(initialTitle ? initialTitle : null, { push: false })

window.addEventListener('popstate', (e) => {
  const st = e?.state
  if (st && st.linkwalk && typeof st.idx === 'number') {
    historyIndex = st.idx
  }

  const p = new URLSearchParams(window.location.search)
  const title = p.get('exhibit')

  if (title) {
    loadAndEnterGallery(title, {
      pushHistory: false,
      updateUrlState: false,
      spawn: { type: 'fromWall', wall: 'south' },
    })
    return
  }

  enterlobby({ push: false })
})

if (initialTitle) {
  loadAndEnterGallery(initialTitle, { pushHistory: false, updateUrlState: false })
}
