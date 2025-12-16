import * as THREE from 'three'

function hashStringToUint32(str) {
  // FNV-1a 32-bit
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

  const scene = new THREE.Scene()
  scene.background = new THREE.Color(0x05030a)

  const camera = new THREE.PerspectiveCamera(70, 1, 0.1, 200)
  const eyeHeight = 1.4
  camera.position.set(0, eyeHeight, 3)
  camera.rotation.order = 'YXZ'

  const ambient = new THREE.AmbientLight(0xffffff, 0.6)
  scene.add(ambient)

  const keyLight = new THREE.DirectionalLight(0xff66cc, 1.0)
  keyLight.position.set(3, 4, 2)
  scene.add(keyLight)

  const disposables = []

  // --- Milestone 2 (part 1): procedurally seeded room dimensions
  const seed = hashStringToUint32(String(roomSeedTitle))
  const rand = mulberry32(seed)

  const roomWidth = roundTo(randRange(rand, 10, 18), 0.25)
  const roomLength = roundTo(randRange(rand, 10, 18), 0.25)
  const roomHeight = roundTo(randRange(rand, 2.8, 4.6), 0.1)

  const wallThickness = 0.2
  const halfW = roomWidth / 2
  const halfL = roomLength / 2

  const floorGeo = new THREE.PlaneGeometry(roomWidth, roomLength)
  const floorMat = new THREE.MeshStandardMaterial({ color: 0x141019, roughness: 0.9 })
  const floor = new THREE.Mesh(floorGeo, floorMat)
  floor.rotation.x = -Math.PI / 2
  floor.position.y = 0
  scene.add(floor)
  disposables.push(floorGeo, floorMat)

  const ceilingGeo = new THREE.PlaneGeometry(roomWidth, roomLength)
  const ceilingMat = new THREE.MeshStandardMaterial({ color: 0x0d0a10, roughness: 1.0 })
  const ceiling = new THREE.Mesh(ceilingGeo, ceilingMat)
  ceiling.rotation.x = Math.PI / 2
  ceiling.position.y = roomHeight
  scene.add(ceiling)
  disposables.push(ceilingGeo, ceilingMat)

  const wallMat = new THREE.MeshStandardMaterial({ color: 0x1c1221, roughness: 0.85, metalness: 0.05 })
  const wallNSGeo = new THREE.BoxGeometry(roomWidth, roomHeight, wallThickness)
  const wallEWGeo = new THREE.BoxGeometry(wallThickness, roomHeight, roomLength)

  const northWall = new THREE.Mesh(wallNSGeo, wallMat)
  northWall.position.set(0, roomHeight / 2, -halfL)
  scene.add(northWall)

  const southWall = new THREE.Mesh(wallNSGeo, wallMat)
  southWall.position.set(0, roomHeight / 2, halfL)
  scene.add(southWall)

  const eastWall = new THREE.Mesh(wallEWGeo, wallMat)
  eastWall.position.set(halfW, roomHeight / 2, 0)
  scene.add(eastWall)

  const westWall = new THREE.Mesh(wallEWGeo, wallMat)
  westWall.position.set(-halfW, roomHeight / 2, 0)
  scene.add(westWall)

  disposables.push(wallMat, wallNSGeo, wallEWGeo)

  const cubeGeo = new THREE.BoxGeometry(1, 1, 1)
  const cubeMat = new THREE.MeshStandardMaterial({ color: 0x66ccff, roughness: 0.25, metalness: 0.1 })
  const cube = new THREE.Mesh(cubeGeo, cubeMat)
  cube.position.set(0, 0.5, 0)
  scene.add(cube)
  disposables.push(cubeGeo, cubeMat)

  // --- Input + controls (Milestone 1)
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

    // Vertical physics
    velocity.y += gravity * dt
    if (jumpRequested && grounded) {
      velocity.y = jumpSpeed
      grounded = false
    }
    jumpRequested = false

    camera.position.y += velocity.y * dt

    // Floor collision
    if (camera.position.y <= eyeHeight) {
      camera.position.y = eyeHeight
      velocity.y = 0
      grounded = true
    }

    // Room bounds collision (MVP): clamp x/z inside walls
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

    cube.rotation.y += dt * 0.6
    cube.rotation.x += dt * 0.2

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
