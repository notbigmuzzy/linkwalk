import * as THREE from 'three'
import { buildRoom } from '../game/room.js'

function hashStringToUint32(str) {
  // FNV-1a 32-bit - lets go with a simple, fast hash for now
  let h = 2166136261
  for (let i = 0; i < str.length; i += 1) {
    h ^= str.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

function mulberry32(seed) {
  let a = seed >>> 0
  return function rand() {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function roundTo(value, step) {
  return Math.round(value / step) * step
}

function randRange(rand, min, max) {
  return min + (max - min) * rand()
}

export function startEngine({ canvas, onFps, onPointerLockChange, roomSeedTitle = 'Lobby' }) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true })
  renderer.setPixelRatio(Math.min(window.devicePixelRatio ?? 1, 2))

  // Make lighting/colors read better on a dark scene.
  // Guarded so it doesn't explode across Three.js minor changes.
  if ('outputColorSpace' in renderer) {
    renderer.outputColorSpace = THREE.SRGBColorSpace
  }
  if ('toneMapping' in renderer) {
    renderer.toneMapping = THREE.ACESFilmicToneMapping
    renderer.toneMappingExposure = 1.35
  }

  const scene = new THREE.Scene()
  scene.background = new THREE.Color(0x05030a)

  const camera = new THREE.PerspectiveCamera(70, 1, 0.1, 200)
  const eyeHeight = 1.4
  camera.position.set(0, eyeHeight, 3)
  camera.rotation.order = 'YXZ'

  const disposables = []

  const seed = hashStringToUint32(String(roomSeedTitle))
  const rand = mulberry32(seed)

  const roomWidth = roundTo(randRange(rand, 10, 18), 0.25)
  const roomLength = roundTo(randRange(rand, 10, 18), 0.25)
  const roomHeight = roundTo(randRange(rand, 3, 3), 0.1)

  const wallThickness = 0.2
  const room = buildRoom({
    width: roomWidth,
    length: roomLength,
    height: roomHeight,
    wallThickness,
  })
  scene.add(room.group)
  disposables.push(...room.disposables)

  const { halfW, halfL } = room.bounds

  const keysDown = new Set()
  let jumpRequested = false

  function onKeyDown(e) {
    keysDown.add(e.code)
    if (e.code === 'Space') jumpRequested = true
  }

  function onKeyUp(e) {
    keysDown.delete(e.code)
  }

  window.addEventListener('keydown', onKeyDown)
  window.addEventListener('keyup', onKeyUp)

  let yaw = 0
  let pitch = 0
  const mouseSensitivity = 0.0022

  function isPointerLocked() {
    return document.pointerLockElement === canvas
  }

  function onMouseMove(e) {
    if (!isPointerLocked()) return

    yaw -= e.movementX * mouseSensitivity
    pitch -= e.movementY * mouseSensitivity

    const limit = Math.PI / 2 - 0.01
    pitch = Math.max(-limit, Math.min(limit, pitch))

    camera.rotation.y = yaw
    camera.rotation.x = pitch
  }

  window.addEventListener('mousemove', onMouseMove)

  function handlePointerLockChange() {
    if (typeof onPointerLockChange === 'function') {
      onPointerLockChange(isPointerLocked())
    }
  }

  document.addEventListener('pointerlockchange', handlePointerLockChange)
  handlePointerLockChange()

  const velocity = new THREE.Vector3(0, 0, 0)
  const gravity = -18
  const jumpSpeed = 6.2
  const moveSpeed = 4.2
  const sprintMultiplier = 1.75
  let grounded = false

  function clamp(v, min, max) {
    return Math.max(min, Math.min(max, v))
  }

  function updatePlayer(dt) {
    if (!isPointerLocked()) {
      jumpRequested = false
      return
    }

    const inputX = (keysDown.has('KeyD') ? 1 : 0) - (keysDown.has('KeyA') ? 1 : 0)
    const inputZ = (keysDown.has('KeyW') ? 1 : 0) - (keysDown.has('KeyS') ? 1 : 0)

    let moveX = 0
    let moveZ = 0

    if (inputX !== 0 || inputZ !== 0) {
      const len = Math.hypot(inputX, inputZ)
      const nx = inputX / len
      const nz = inputZ / len

      const isSprinting = keysDown.has('ShiftLeft') || keysDown.has('ShiftRight')
      const speed = moveSpeed * (isSprinting ? sprintMultiplier : 1)

      const sin = Math.sin(yaw)
      const cos = Math.cos(yaw)

      // With Three.js default camera forward = -Z at yaw=0
      // right = (cos, 0, -sin)
      // forward = (-sin, 0, -cos)
      moveX = (cos * nx + -sin * nz) * speed
      moveZ = (-sin * nx + -cos * nz) * speed
    }

    camera.position.x += moveX * dt
    camera.position.z += moveZ * dt

    velocity.y += gravity * dt
    if (jumpRequested && grounded) {
      velocity.y = jumpSpeed
      grounded = false
    }
    jumpRequested = false

    camera.position.y += velocity.y * dt

    if (camera.position.y <= eyeHeight) {
      camera.position.y = eyeHeight
      velocity.y = 0
      grounded = true
    }

    const margin = 0.35
    const maxX = halfW - margin
    const maxZ = halfL - margin
    camera.position.x = clamp(camera.position.x, -maxX, maxX)
    camera.position.z = clamp(camera.position.z, -maxZ, maxZ)
  }

  function resize() {
    const width = canvas.clientWidth
    const height = canvas.clientHeight

    if (width <= 0 || height <= 0) return

    renderer.setSize(width, height, false)
    camera.aspect = width / height
    camera.updateProjectionMatrix()
  }

  const clock = new THREE.Clock()
  let rafId = 0
  let fpsFrames = 0
  let fpsTime = 0
  let lastFpsReport = 0

  function frame() {
    const dt = clock.getDelta()

    if (typeof onFps === 'function') {
      fpsFrames += 1
      fpsTime += dt
      const now = clock.elapsedTime

      if (fpsTime >= 0.25 && now - lastFpsReport >= 0.25) {
        const fps = fpsFrames / fpsTime
        onFps(fps)
        fpsFrames = 0
        fpsTime = 0
        lastFpsReport = now
      }
    }

    updatePlayer(dt)

    resize()
    renderer.render(scene, camera)
    rafId = window.requestAnimationFrame(frame)
  }

  window.addEventListener('resize', resize)
  resize()
  rafId = window.requestAnimationFrame(frame)

  return {
    stop() {
      window.cancelAnimationFrame(rafId)
      window.removeEventListener('resize', resize)

      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keyup', onKeyUp)
      window.removeEventListener('mousemove', onMouseMove)
      document.removeEventListener('pointerlockchange', handlePointerLockChange)

      for (const d of disposables) {
        if (typeof d.dispose === 'function') d.dispose()
      }
      renderer.dispose()
    },
  }
}
