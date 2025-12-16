import './style.css'
import { startEngine } from './engine/engine.js'

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

function requestPlay() {
  canvas.requestPointerLock()
}

overlayEl.addEventListener('click', requestPlay)
overlayEl.addEventListener('keydown', (e) => {
  if (e.code === 'Enter' || e.code === 'Space') requestPlay()
})

startEngine({
  canvas,
  roomSeedTitle: new URLSearchParams(window.location.search).get('title') ?? 'Lobby',
  onFps(fps) {
    fpsEl.textContent = `${fps.toFixed(0)} FPS`
  },
  onPointerLockChange(locked) {
    overlayEl.hidden = locked
    document.body.classList.toggle('locked', locked)
  },
})
