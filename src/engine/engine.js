import * as THREE from 'three'
import { buildRoom } from '../game/room.js'

function hashStringToUint32(str) {
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

export function startYourEngines({
  canvas,
  onFps,
  onPointerLockChange,
  onHeading,
  onDoorTrigger,
  roomSeedTitle = 'Lobby',
  roomMode = 'gallery',
  entrywayCategories,
  roomSpawn,
  galleryRelatedTitles,
  galleryTitle,
  galleryDescription,
  galleryMainThumbnailUrl,
  galleryPhotos,
}) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true })
  renderer.setPixelRatio(Math.min(window.devicePixelRatio ?? 1, 2))

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
  scene.add(camera)

  const flashlightTarget = new THREE.Object3D()
  flashlightTarget.position.set(0, 0, -1)
  camera.add(flashlightTarget)

  const flashlight = new THREE.SpotLight(0xffffff, 3.0, 7, Math.PI / 80, 0.2, 1.6)
  flashlight.position.set(0, 0, 0)
  flashlight.target = flashlightTarget
  camera.add(flashlight)
  flashlight.visible = false
  let flashlightTimeoutId = 0

  const staticDisposables = []

  let currentRoom = null
  let halfW = 6
  let halfL = 6
  let doorById = new Map()
  let doorHitMeshes = []
  let roomObstacles = []

  let yaw = 0
  let pitch = 0

  const velocity = new THREE.Vector3(0, 0, 0)
  const gravity = -18
  const jumpSpeed = 6.2
  const moveSpeed = 4.2
  const sprintMultiplier = 1.75
  let grounded = false

  function disposeMany(items) {
    for (const d of items) {
      if (d && typeof d.dispose === 'function') d.dispose()
    }
  }

  function yawForFacingWall(wall) {
    if (wall === 'south') return 0
    if (wall === 'north') return Math.PI
    if (wall === 'west') return Math.PI / 2
    if (wall === 'east') return -Math.PI / 2
    return 0
  }

  function applySpawn(spawn) {
    if (!spawn) return

    if (spawn.type === 'center') {
      camera.position.set(0, eyeHeight, 0)
      yaw = typeof spawn.yaw === 'number' ? spawn.yaw : 0
      pitch = typeof spawn.pitch === 'number' ? spawn.pitch : 0
      camera.rotation.y = yaw
      camera.rotation.x = pitch
      velocity.set(0, 0, 0)
      grounded = true
      return
    }

    if (spawn.type === 'fromWall') {
      const wall = spawn.wall
      const margin = 1.25

      let x = 0
      let z = 0
      if (wall === 'west') x = -halfW + margin
      else if (wall === 'east') x = halfW - margin
      else if (wall === 'north') z = -halfL + margin
      else if (wall === 'south') z = halfL - margin

      camera.position.set(x, eyeHeight, z)
      yaw = yawForFacingWall(wall)
      pitch = 0
      camera.rotation.y = yaw
      camera.rotation.x = pitch
      velocity.set(0, 0, 0)
      grounded = true
    }
  }

  function loadRoom({
    mode,
    seedTitle,
    categories,
    galleryEntryWall,
    galleryRelatedTitles: relatedTitles,
    galleryTitle: nextGalleryTitle,
    galleryDescription: nextGalleryDescription,
    galleryMainThumbnailUrl: nextGalleryMainThumbnailUrl,
    galleryPhotos: nextGalleryPhotos,
    spawn,
  }) {
    const wallThickness = 0.2

    let roomWidth = 14
    let roomLength = 18
    let roomHeight = 4

    if (mode !== 'entryway') {
      const seed = hashStringToUint32(String(seedTitle))
      const rand = mulberry32(seed)

      roomWidth = roundTo(randRange(rand, 10, 18), 0.25)
      roomLength = roundTo(randRange(rand, 10, 18), 0.25) + 2
      roomHeight = roundTo(randRange(rand, 4, 4), 0.1)
    }

    const nextRoom = buildRoom({
      width: roomWidth,
      length: roomLength,
      height: roomHeight,
      wallThickness,
      mode,
      entryway: {
        categories,
      },
      gallery: {
        entryWall: galleryEntryWall,
        relatedTitles,
        title: nextGalleryTitle,
        description: nextGalleryDescription,
        mainThumbnailUrl: nextGalleryMainThumbnailUrl,
        photos: nextGalleryPhotos,
      },
    })

    if (currentRoom) {
      scene.remove(currentRoom.group)
      disposeMany(currentRoom.disposables)
    }

    currentRoom = nextRoom
    scene.add(currentRoom.group)

    halfW = currentRoom.bounds?.halfW ?? halfW
    halfL = currentRoom.bounds?.halfL ?? halfL

    const doors = Array.isArray(currentRoom.doors) ? currentRoom.doors : []
    doorById = new Map(doors.map((d) => [d.id, d]))
    doorHitMeshes = Array.isArray(currentRoom.doorHitMeshes) ? currentRoom.doorHitMeshes : []
    roomObstacles = Array.isArray(currentRoom.obstacles) ? currentRoom.obstacles : []

    applySpawn(spawn)
  }

  loadRoom({
    mode: roomMode,
    seedTitle: roomSeedTitle,
    categories: entrywayCategories,
    galleryRelatedTitles,
    galleryTitle,
    galleryDescription,
    galleryMainThumbnailUrl,
    galleryPhotos,
    spawn: roomSpawn,
  })
  const raycaster = new THREE.Raycaster()
  const rayNdc = new THREE.Vector2(0, 0)

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

  const mouseSensitivity = 0.0022

  function headingFromYaw(yawRad) {
    let deg = ((-yawRad * 180) / Math.PI) % 360
    if (deg < 0) deg += 360
    const dirs = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW']
    const idx = Math.round(deg / 45) % 8
    return { cardinal: dirs[idx] }
  }

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

  function findDoorId(obj) {
    let cur = obj
    while (cur) {
      if (cur.userData && typeof cur.userData.doorId === 'string') return cur.userData.doorId
      cur = cur.parent
    }
    return null
  }

  function onMouseDown(e) {
    if (e.button !== 0) return
    if (!isPointerLocked()) return

    flashlight.visible = true
    if (flashlightTimeoutId) window.clearTimeout(flashlightTimeoutId)
    flashlightTimeoutId = window.setTimeout(() => {
      flashlight.visible = false
      flashlightTimeoutId = 0
    }, 120)

    if (doorHitMeshes.length === 0) return

    raycaster.setFromCamera(rayNdc, camera)
    const hits = raycaster.intersectObjects(doorHitMeshes, true)
    if (hits.length === 0) return

    const interactMaxDistance = 2.25
    const hitPoint = hits[0]?.point
    if (hitPoint && typeof hitPoint.distanceTo === 'function') {
      const d = hitPoint.distanceTo(camera.position)
      if (d > interactMaxDistance) return
    }

    const doorId = findDoorId(hits[0].object)
    if (!doorId) return

    const door = doorById.get(doorId) ?? { id: doorId }
    if (typeof onDoorTrigger === 'function') {
      onDoorTrigger(door)
    } else {
      console.info(`[linkwalk] Door clicked: ${doorId}`)
    }
  }

  window.addEventListener('mousedown', onMouseDown)

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

    {
      const playerRadius = 0.35
      const px = camera.position.x
      const pz = camera.position.z
      let x = px
      let z = pz

      for (const o of roomObstacles) {
        if (!o || o.type !== 'cylinder') continue
        const ox = typeof o.x === 'number' ? o.x : 0
        const oz = typeof o.z === 'number' ? o.z : 0
        const r = typeof o.radius === 'number' ? o.radius : 0
        const minDist = playerRadius + r + 0.05

        const dx = x - ox
        const dz = z - oz
        const dist = Math.hypot(dx, dz)
        if (dist > 0 && dist < minDist) {
          const push = minDist - dist
          x += (dx / dist) * push
          z += (dz / dist) * push
        } else if (dist === 0 && minDist > 0) {
          x += minDist
        }
      }

      camera.position.x = x
      camera.position.z = z
    }

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
  let lastHeadingReport = 0

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

    if (typeof onHeading === 'function' && document.pointerLockElement === canvas) {
      const now = clock.elapsedTime
      if (now - lastHeadingReport >= 0.1) {
        onHeading(headingFromYaw(yaw))
        lastHeadingReport = now
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
    setRoom({
      roomMode: nextMode,
      roomSeedTitle: nextSeedTitle,
      entrywayCategories: nextCategories,
      galleryEntryWall,
      galleryRelatedTitles: nextRelatedTitles,
      galleryTitle: nextGalleryTitle,
      galleryDescription: nextGalleryDescription,
      galleryMainThumbnailUrl: nextGalleryMainThumbnailUrl,
      galleryPhotos: nextGalleryPhotos,
      spawn,
    } = {}) {
      const hasGalleryTitle = Object.prototype.hasOwnProperty.call(arguments.length ? arguments[0] ?? {} : {}, 'galleryTitle')
      const hasGalleryDescription = Object.prototype.hasOwnProperty.call(arguments.length ? arguments[0] ?? {} : {}, 'galleryDescription')
      const hasGalleryMainThumbnailUrl = Object.prototype.hasOwnProperty.call(
        arguments.length ? arguments[0] ?? {} : {},
        'galleryMainThumbnailUrl'
      )
      const hasGalleryPhotos = Object.prototype.hasOwnProperty.call(arguments.length ? arguments[0] ?? {} : {}, 'galleryPhotos')

      loadRoom({
        mode: typeof nextMode === 'string' ? nextMode : roomMode,
        seedTitle: typeof nextSeedTitle === 'string' ? nextSeedTitle : roomSeedTitle,
        categories: Array.isArray(nextCategories) ? nextCategories : entrywayCategories,
        galleryEntryWall,
        galleryRelatedTitles: Array.isArray(nextRelatedTitles) ? nextRelatedTitles : galleryRelatedTitles,
        galleryTitle: hasGalleryTitle ? (typeof nextGalleryTitle === 'string' ? nextGalleryTitle : null) : galleryTitle,
        galleryDescription: hasGalleryDescription ? (typeof nextGalleryDescription === 'string' ? nextGalleryDescription : null) : galleryDescription,
        galleryMainThumbnailUrl: hasGalleryMainThumbnailUrl
          ? typeof nextGalleryMainThumbnailUrl === 'string'
            ? nextGalleryMainThumbnailUrl
            : null
          : galleryMainThumbnailUrl,
        galleryPhotos: hasGalleryPhotos ? (Array.isArray(nextGalleryPhotos) ? nextGalleryPhotos : null) : galleryPhotos,
        spawn,
      })
    },
    stop() {
      window.cancelAnimationFrame(rafId)
      window.removeEventListener('resize', resize)

      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keyup', onKeyUp)
      window.removeEventListener('mousemove', onMouseMove)
      window.removeEventListener('mousedown', onMouseDown)
      document.removeEventListener('pointerlockchange', handlePointerLockChange)

      if (flashlightTimeoutId) window.clearTimeout(flashlightTimeoutId)

      if (currentRoom) {
        scene.remove(currentRoom.group)
        disposeMany(currentRoom.disposables)
        currentRoom = null
      }

      disposeMany(staticDisposables)
      renderer.dispose()
    },
  }
}
