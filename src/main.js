import './style.css'
import { startYourEngines } from './engine/engine.js'

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

function requestPlay() {
  canvas.requestPointerLock()
}

overlayEl.addEventListener('click', requestPlay)
overlayEl.addEventListener('keydown', (e) => {
  if (e.code === 'Enter' || e.code === 'Space') requestPlay()
})

const params = new URLSearchParams(window.location.search)
const initialTitle = params.get('title')
let engineApi = null

engineApi = startYourEngines({
  canvas,
  roomSeedTitle: initialTitle ?? 'Lobby',
  roomMode: initialTitle ? 'gallery' : 'entryway',
  entrywayCategories: ['History', 'Science', 'Art', 'Technology', 'Nature', 'Space', 'Cities', 'People'],
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
      const nextParams = new URLSearchParams(window.location.search)
      nextParams.set('title', door.category)
      window.history.replaceState(null, '', `${window.location.pathname}?${nextParams.toString()}`)

      if (engineApi && typeof engineApi.setRoom === 'function') {
        engineApi.setRoom({ roomMode: 'gallery', roomSeedTitle: door.category })
      }
      return
    }

    if (door && typeof door.id === 'string') {
      console.info(`[linkwalk] Door clicked: ${door.id}`)
    }
  },
})
