import * as THREE from 'three'
import { buildRoom } from '../game/room.js'
import { disposeSharedRoomMaterialTextures } from '../game/room/textures.js'
import { hashStringToUint32, mulberry32, randRange, roundTo, setBodyClickableCursor } from '../misc/helper.js'

export function startYourEngines({
  canvas,
  onFps,
  onPointerLockChange,
  onHeading,
  onDoorTrigger,
  roomSeedTitle = 'Lobby',
  roomMode = 'gallery',
  lobbyCategories,
  roomSpawn,
  galleryRelatedTitles,
  galleryTitle,
  galleryDescription,
  galleryMainThumbnailUrl,
  galleryPhotos,
  galleryLongExtract,
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
  const eyeHeight = 1.6
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
  staticDisposables.push({
    dispose: disposeSharedRoomMaterialTextures,
  })

  let currentRoom = null
  let halfW = 6
  let halfL = 6
  let doorById = new Map()
  let doorHitMeshes = []
  let doorHitById = new Map()
  let roomObstacles = []
  let pickableMeshes = []
  let interactionLocked = false

  let deferredTextureLoadToken = 0

  function loadTextureAsync(url) {
    const loader = new THREE.TextureLoader()
    if (typeof loader.setCrossOrigin === 'function') loader.setCrossOrigin('anonymous')
    return new Promise((resolve, reject) => {
      loader.load(url, resolve, undefined, reject)
    })
  }

  async function runDeferredTextureLoads(room, token) {
    const jobs = Array.isArray(room?.deferredTextureLoads) ? room.deferredTextureLoads : []
    if (jobs.length === 0) return

    // Small delay between images to avoid hitching from decode/upload spikes.
    const staggerMs = 90

    for (const job of jobs) {
      if (token !== deferredTextureLoadToken) return
      if (currentRoom !== room) return

      const url = typeof job?.url === 'string' ? job.url.trim() : ''
      if (!url) continue

      // Yield so the renderer can present a frame between loads.
      await new Promise((r) => window.requestAnimationFrame(r))
      if (token !== deferredTextureLoadToken || currentRoom !== room) return

      try {
        const tex = await loadTextureAsync(url)
        if (token !== deferredTextureLoadToken || currentRoom !== room) {
          if (tex && typeof tex.dispose === 'function') tex.dispose()
          return
        }
        if (job && typeof job.onLoad === 'function') job.onLoad(tex)
        else if (tex && typeof tex.dispose === 'function') tex.dispose()
      } catch (err) {
        if (token !== deferredTextureLoadToken || currentRoom !== room) return
        if (job && typeof job.onError === 'function') job.onError(err)
      }

      if (staggerMs > 0) {
        await new Promise((r) => window.setTimeout(r, staggerMs))
      }
    }
  }

  const holdAnchor = new THREE.Object3D()
  holdAnchor.position.set(0, 0, -0.6)
  camera.add(holdAnchor)

  let held = null

  function forEachMaterial(obj, fn) {
    if (!obj) return
    obj.traverse((child) => {
      const m = child && child.material
      if (!m) return
      if (Array.isArray(m)) {
        for (const mm of m) fn(mm, child)
      } else {
        fn(m, child)
      }
    })
  }

  function releaseHeld() {
    if (!held) return
    const {
      obj,
      originalParent,
      originalPosition,
      originalQuaternion,
      originalScale,
      originalRenderOrder,
      originalMaterialState,
    } = held

    if (obj && obj.parent) {
      obj.parent.remove(obj)
    }

    if (originalParent) {
      originalParent.add(obj)
      obj.position.copy(originalPosition)
      obj.quaternion.copy(originalQuaternion)
      obj.scale.copy(originalScale)
    }

    if (obj) {
      obj.renderOrder = originalRenderOrder
      forEachMaterial(obj, (mat, child) => {
        const state = originalMaterialState.get(mat)
        if (!state) return
        mat.depthTest = state.depthTest
        mat.depthWrite = state.depthWrite
        if ('transparent' in mat) mat.transparent = state.transparent
        if ('opacity' in mat) mat.opacity = state.opacity
        if (child) child.renderOrder = state.renderOrder
        mat.needsUpdate = true
      })
    }

    held = null
  }

  function holdObject(obj) {
    if (!obj) return

    // Toggle: clicking the currently-held object drops it.
    if (held && held.obj === obj) {
      releaseHeld()
      return
    }

    // Holding something else? Drop first.
    if (held) releaseHeld()

    const originalParent = obj.parent
    const originalPosition = obj.position.clone()
    const originalQuaternion = obj.quaternion.clone()
    const originalScale = obj.scale.clone()
    const originalRenderOrder = obj.renderOrder
    const originalMaterialState = new Map()

    if (originalParent) originalParent.remove(obj)
    holdAnchor.add(obj)
    obj.position.set(0, 0, 0)
    obj.quaternion.identity()
    obj.scale.copy(originalScale)

    // Render held item on top of the scene (avoid visual intersection/occlusion).
    obj.renderOrder = 9999
    forEachMaterial(obj, (mat, child) => {
      if (!originalMaterialState.has(mat)) {
        originalMaterialState.set(mat, {
          depthTest: mat.depthTest,
          depthWrite: mat.depthWrite,
          transparent: 'transparent' in mat ? mat.transparent : undefined,
          opacity: 'opacity' in mat ? mat.opacity : undefined,
          renderOrder: child ? child.renderOrder : 0,
        })
      }

      mat.depthTest = false
      mat.depthWrite = false
      if ('transparent' in mat) mat.transparent = true
      if ('opacity' in mat) mat.opacity = Math.min(1, mat.opacity ?? 1)
      if (child) child.renderOrder = 9999
      mat.needsUpdate = true
    })

    // Center and scale so the object is as large as possible while fully visible.
    holdAnchor.updateWorldMatrix(true, true)
    obj.updateWorldMatrix(true, true)

    const box = new THREE.Box3().setFromObject(obj)
    const size = new THREE.Vector3()
    const centerWorld = new THREE.Vector3()
    box.getSize(size)

    // Recenter the object so its bbox center sits at the holdAnchor origin.
    box.getCenter(centerWorld)
    const centerInHold = holdAnchor.worldToLocal(centerWorld.clone())
    obj.position.sub(centerInHold)
    obj.updateWorldMatrix(true, true)

    // Place it centered on camera. Keep enough distance to avoid near-plane clipping.
    const baseDistance = Math.max(0.35, (camera.near ?? 0.1) + 0.15)
    const depthPad = (size.z || 0) * 0.5
    const distance = Math.max(baseDistance, (camera.near ?? 0.1) + 0.1 + depthPad)
    holdAnchor.position.set(0, 0, -distance)

    const vFovRad = THREE.MathUtils.degToRad((camera.fov || 60) * 0.5)
    const viewHeight = 2 * distance * Math.tan(vFovRad)
    const viewWidth = viewHeight * (camera.aspect || 1)

    const safeW = (size.x || 1e-6)
    const safeH = (size.y || 1e-6)

    // Add a pixel margin around the held object.
    const marginPx = 50
    const vw = canvas.clientWidth || 0
    const vh = canvas.clientHeight || 0
    const padX = vw > 0 ? Math.max(0.1, (vw - 2 * marginPx) / vw) : 0.94
    const padY = vh > 0 ? Math.max(0.1, (vh - 2 * marginPx) / vh) : 0.94

    const scaleToFit = Math.min((viewWidth * padX) / safeW, (viewHeight * padY) / safeH)
    if (Number.isFinite(scaleToFit) && scaleToFit > 0) {
      obj.scale.copy(originalScale).multiplyScalar(scaleToFit)
    }

    // Recenter after scaling so it stays perfectly centered.
    obj.updateWorldMatrix(true, true)
    box.setFromObject(obj)
    box.getCenter(centerWorld)
    const centerInHoldAfterScale = holdAnchor.worldToLocal(centerWorld.clone())
    obj.position.sub(centerInHoldAfterScale)

    held = {
      obj,
      originalParent,
      originalPosition,
      originalQuaternion,
      originalScale,
      originalRenderOrder,
      originalMaterialState,
    }
  }

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
      const margin = 1.5

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
    galleryLongExtract: nextGalleryLongExtract,
    galleryTrail: nextGalleryTrail,
    spawn,
  }) {
    const wallThickness = 0.2

    let roomWidth = 14
    let roomLength = 18
    let roomHeight = 4

    if (mode !== 'lobby') {
      const seed = hashStringToUint32(String(seedTitle))
      const rand = mulberry32(seed)

      roomWidth = roundTo(randRange(rand, 10, 18), 0.25)
      roomLength = roundTo(randRange(rand, 10, 18), 0.25) + 2

      // Minimum length so the gallery west-wall text panels and the corner
      // see-also doors have comfortable spacing along the south↔north axis.
      roomLength = Math.max(roomLength, 14)
      roomHeight = roundTo(randRange(rand, 4, 4), 0.1)
    }

    const nextRoom = buildRoom({
      width: roomWidth,
      length: roomLength,
      height: roomHeight,
      wallThickness,
      mode,
      lobby: {
        categories,
      },
      gallery: {
        entryWall: galleryEntryWall,
        relatedTitles,
        title: nextGalleryTitle,
        description: nextGalleryDescription,
        mainThumbnailUrl: nextGalleryMainThumbnailUrl,
        photos: nextGalleryPhotos,
        longExtract: nextGalleryLongExtract,
        trail: Array.isArray(nextGalleryTrail) ? nextGalleryTrail : [],
      },
    })

    if (currentRoom) {
      // Ensure we don't keep a held object across room swaps.
      if (held) releaseHeld()
      scene.remove(currentRoom.group)
      disposeMany(currentRoom.disposables)
    }

    currentRoom = nextRoom
    scene.add(currentRoom.group)

    // Start staggered texture loading for the new room; cancel any prior runs.
    deferredTextureLoadToken += 1
    void runDeferredTextureLoads(currentRoom, deferredTextureLoadToken)

    halfW = currentRoom.bounds?.halfW ?? halfW
    halfL = currentRoom.bounds?.halfL ?? halfL

    const doors = Array.isArray(currentRoom.doors) ? currentRoom.doors : []
    doorById = new Map(doors.map((d) => [d.id, d]))
    doorHitMeshes = Array.isArray(currentRoom.doorHitMeshes) ? currentRoom.doorHitMeshes : []
    doorHitById = new Map(
      doorHitMeshes
        .map((m) => {
          const id = m?.userData?.doorId
          return typeof id === 'string' && id ? [id, m] : null
        })
        .filter(Boolean)
    )
    roomObstacles = Array.isArray(currentRoom.obstacles) ? currentRoom.obstacles : []
    pickableMeshes = Array.isArray(currentRoom.pickableMeshes) ? currentRoom.pickableMeshes : []

    applySpawn(spawn)
  }

  loadRoom({
    mode: roomMode,
    seedTitle: roomSeedTitle,
    categories: lobbyCategories,
    galleryRelatedTitles,
    galleryTitle,
    galleryDescription,
    galleryMainThumbnailUrl,
    galleryPhotos,
    galleryLongExtract,
    spawn: roomSpawn,
  })
  const raycaster = new THREE.Raycaster()
  const rayNdc = new THREE.Vector2(0, 0)

  function computeIsAimingAtClickable() {
    if (!isPointerLocked()) return false
    if (interactionLocked) return false
    if (held) return true

    const candidates = []
    if (doorHitMeshes.length) candidates.push(...doorHitMeshes)
    if (pickableMeshes.length) candidates.push(...pickableMeshes)
    if (candidates.length === 0) return false

    raycaster.setFromCamera(rayNdc, camera)
    const hits = raycaster.intersectObjects(candidates, true)
    if (hits.length === 0) return false

    const hitPoint = hits[0]?.point
    const interactMaxDistance = 2.25
    if (hitPoint && typeof hitPoint.distanceTo === 'function') {
      const d = hitPoint.distanceTo(camera.position)
      if (d > interactMaxDistance) return false
    }
    return true
  }

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
    if (interactionLocked) return

    flashlight.visible = true
    if (flashlightTimeoutId) window.clearTimeout(flashlightTimeoutId)
    flashlightTimeoutId = window.setTimeout(() => {
      flashlight.visible = false
      flashlightTimeoutId = 0
    }, 120)

    raycaster.setFromCamera(rayNdc, camera)
    const candidates = []
    if (doorHitMeshes.length) candidates.push(...doorHitMeshes)
    if (pickableMeshes.length) candidates.push(...pickableMeshes)
    if (candidates.length === 0) return

    const hits = raycaster.intersectObjects(candidates, true)
    if (hits.length === 0) return

    const hitObj = hits[0]?.object
    const hitPoint = hits[0]?.point

    const interactMaxDistance = 2.25
    if (hitPoint && typeof hitPoint.distanceTo === 'function') {
      const d = hitPoint.distanceTo(camera.position)
      if (d > interactMaxDistance) return
    }

    // If it (or a parent) is marked pickable, hold it.
    {
      let cur = hitObj
      while (cur) {
        if (cur.userData && cur.userData.pickable) {
          holdObject(cur)
          return
        }
        cur = cur.parent
      }
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

    // Swap the center "pointer" style when aiming at something clickable.
    setBodyClickableCursor(computeIsAimingAtClickable())

    resize()
    renderer.render(scene, camera)
    rafId = window.requestAnimationFrame(frame)
  }

  window.addEventListener('resize', resize)
  resize()
  rafId = window.requestAnimationFrame(frame)

  return {
    setInteractionLocked(locked) {
      interactionLocked = Boolean(locked)
    },
    setDoorLabelOverride(doorId, text) {
      const id = typeof doorId === 'string' ? doorId : ''
      if (!id) return
      const hit = doorHitById.get(id)
      const ctrl = hit?.userData?.labelControl
      if (!ctrl || typeof ctrl.setOverride !== 'function' || typeof ctrl.clearOverride !== 'function') return

      const t = typeof text === 'string' ? text.trim() : ''
      if (t) ctrl.setOverride(t)
      else ctrl.clearOverride()
    },
    setRoom({
      roomMode: nextMode,
      roomSeedTitle: nextSeedTitle,
      lobbyCategories: nextCategories,
      galleryEntryWall,
      galleryRelatedTitles: nextRelatedTitles,
      galleryTitle: nextGalleryTitle,
      galleryDescription: nextGalleryDescription,
      galleryMainThumbnailUrl: nextGalleryMainThumbnailUrl,
      galleryPhotos: nextGalleryPhotos,
      galleryLongExtract: nextGalleryLongExtract,
      galleryTrail: nextGalleryTrail,
      spawn,
    } = {}) {
      const hasGalleryTitle = Object.prototype.hasOwnProperty.call(arguments.length ? arguments[0] ?? {} : {}, 'galleryTitle')
      const hasGalleryDescription = Object.prototype.hasOwnProperty.call(arguments.length ? arguments[0] ?? {} : {}, 'galleryDescription')
      const hasGalleryMainThumbnailUrl = Object.prototype.hasOwnProperty.call(
        arguments.length ? arguments[0] ?? {} : {},
        'galleryMainThumbnailUrl'
      )
      const hasGalleryPhotos = Object.prototype.hasOwnProperty.call(arguments.length ? arguments[0] ?? {} : {}, 'galleryPhotos')
      const hasGalleryLongExtract = Object.prototype.hasOwnProperty.call(arguments.length ? arguments[0] ?? {} : {}, 'galleryLongExtract')
      const hasGalleryTrail = Object.prototype.hasOwnProperty.call(arguments.length ? arguments[0] ?? {} : {}, 'galleryTrail')

      loadRoom({
        mode: typeof nextMode === 'string' ? nextMode : roomMode,
        seedTitle: typeof nextSeedTitle === 'string' ? nextSeedTitle : roomSeedTitle,
        categories: Array.isArray(nextCategories) ? nextCategories : lobbyCategories,
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
        galleryLongExtract: hasGalleryLongExtract ? (typeof nextGalleryLongExtract === 'string' ? nextGalleryLongExtract : null) : galleryLongExtract,
        galleryTrail: hasGalleryTrail ? (Array.isArray(nextGalleryTrail) ? nextGalleryTrail : null) : null,
        spawn,
      })
    },
    stop() {
      if (held) releaseHeld()

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
