import './style.css'
import { startEngine } from './engine/engine.js'

const app = document.querySelector('#app')
if (!app) {
  throw new Error('Missing #app element')
}

app.innerHTML = `
  <div id="hud">
    <div id="fps" aria-label="Frames per second"></div>
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

startEngine({
  canvas,
  onFps(fps) {
    fpsEl.textContent = `${fps.toFixed(0)} FPS`
  },
})
