import * as THREE from 'three'

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value))
}

function roundTo(value, step) {
  return Math.round(value / step) * step
}

function makeOutlineRect({ width, height, center, normal, color = 0xffffff }) {
  const geo = new THREE.PlaneGeometry(width, height)
  const edges = new THREE.EdgesGeometry(geo)
  geo.dispose()

  const mat = new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.65 })
  const lines = new THREE.LineSegments(edges, mat)

  // Orient plane so its +Z points along the provided normal
  const quat = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), normal.clone().normalize())
  lines.quaternion.copy(quat)
  lines.position.copy(center)

  return { object: lines, disposables: [edges, mat] }
}

export function buildRoom({ width, length, height, wallThickness = 0.2 }) {
  const group = new THREE.Group()
  group.name = 'room'

  const disposables = []

  // Lights (simple MVP)
  const ambient = new THREE.AmbientLight(0xffffff, 0.95)
  group.add(ambient)

  const keyLight = new THREE.DirectionalLight(0xff66cc, 1.6)
  keyLight.position.set(4, height + 2.5, 3)
  group.add(keyLight)

  const ceilingLightColor = 0xffffff
  const ceilingLightIntensity = 0.9
  const ceilingLightDistance = Math.max(width, length) * 2.2
  const ceilingLightDecay = 1.6

  const y = height - 0.25
  const x = width * 0.35
  const z = length * 0.35

  // Four ceiling corner lights: TL, TR, BL, BR
  const lightTL = new THREE.PointLight(ceilingLightColor, ceilingLightIntensity, ceilingLightDistance, ceilingLightDecay)
  lightTL.position.set(-x, y, -z)
  group.add(lightTL)

  const lightTR = new THREE.PointLight(ceilingLightColor, ceilingLightIntensity, ceilingLightDistance, ceilingLightDecay)
  lightTR.position.set(x, y, -z)
  group.add(lightTR)

  const lightBL = new THREE.PointLight(ceilingLightColor, ceilingLightIntensity, ceilingLightDistance, ceilingLightDecay)
  lightBL.position.set(-x, y, z)
  group.add(lightBL)

  const lightBR = new THREE.PointLight(ceilingLightColor, ceilingLightIntensity, ceilingLightDistance, ceilingLightDecay)
  lightBR.position.set(x, y, z)
  group.add(lightBR)

  // Room shell
  const floorGeo = new THREE.PlaneGeometry(width, length)
  const floorMat = new THREE.MeshStandardMaterial({ color: 0x2a2a2f, roughness: 0.95, metalness: 0.0 })
  const floor = new THREE.Mesh(floorGeo, floorMat)
  floor.rotation.x = -Math.PI / 2
  floor.position.y = 0
  group.add(floor)
  disposables.push(floorGeo, floorMat)

  const ceilingGeo = new THREE.PlaneGeometry(width, length)
  const ceilingMat = new THREE.MeshStandardMaterial({ color: 0x3a3a41, roughness: 1.0, metalness: 0.0 })
  const ceiling = new THREE.Mesh(ceilingGeo, ceilingMat)
  ceiling.rotation.x = Math.PI / 2
  ceiling.position.y = height
  group.add(ceiling)
  disposables.push(ceilingGeo, ceilingMat)

  const wallMat = new THREE.MeshStandardMaterial({ color: 0x4a4a52, roughness: 0.95, metalness: 0.0 })
  const wallNSGeo = new THREE.BoxGeometry(width, height, wallThickness)
  const wallEWGeo = new THREE.BoxGeometry(wallThickness, height, length)

  const halfW = width / 2
  const halfL = length / 2

  const northWall = new THREE.Mesh(wallNSGeo, wallMat)
  northWall.position.set(0, height / 2, -halfL)
  group.add(northWall)

  const southWall = new THREE.Mesh(wallNSGeo, wallMat)
  southWall.position.set(0, height / 2, halfL)
  group.add(southWall)

  const eastWall = new THREE.Mesh(wallEWGeo, wallMat)
  eastWall.position.set(halfW, height / 2, 0)
  group.add(eastWall)

  const westWall = new THREE.Mesh(wallEWGeo, wallMat)
  westWall.position.set(-halfW, height / 2, 0)
  group.add(westWall)

  disposables.push(wallMat, wallNSGeo, wallEWGeo)

  const slots = []
  const markers = new THREE.Group()
  markers.name = 'display-slots'

  const surfaceOffset = wallThickness / 2 + 0.02

  const walls = {
    north: { center: new THREE.Vector3(0, height / 2, -halfL), normal: new THREE.Vector3(0, 0, 1), wallWidth: width, wallHeight: height },
    south: { center: new THREE.Vector3(0, height / 2, halfL), normal: new THREE.Vector3(0, 0, -1), wallWidth: width, wallHeight: height },
    east: { center: new THREE.Vector3(halfW, height / 2, 0), normal: new THREE.Vector3(-1, 0, 0), wallWidth: length, wallHeight: height },
    west: { center: new THREE.Vector3(-halfW, height / 2, 0), normal: new THREE.Vector3(1, 0, 0), wallWidth: length, wallHeight: height },
  }

  function addSlot({ id, wall, kind, w, h, y, u = 0, color }) {
    const wallInfo = walls[wall]

    // Map wall local X axis: for north/south it's world X; for east/west it's world Z.
    const wallRight = wall === 'east' || wall === 'west' ? new THREE.Vector3(0, 0, 1) : new THREE.Vector3(1, 0, 0)
    const wallUp = new THREE.Vector3(0, 1, 0)

    const center = wallInfo.center
      .clone()
      .add(wallUp.clone().multiplyScalar(y - height / 2))
      .add(wallRight.clone().multiplyScalar(u))
      .add(wallInfo.normal.clone().multiplyScalar(surfaceOffset))

    const { object, disposables: outlineDisposables } = makeOutlineRect({
      width: w,
      height: h,
      center,
      normal: wallInfo.normal,
      color,
    })

    markers.add(object)
    disposables.push(...outlineDisposables)

    slots.push({
      id,
      wall,
      kind,
      width: w,
      height: h,
      center,
      normal: wallInfo.normal.clone(),
      right: wallRight,
      up: wallUp,
    })
  }

  // Hero wall: title + main frame
  const heroWall = 'north'
  // A4-ish portrait ratio (W/H ≈ 0.707)
  const heroFrameH = roundTo(clamp(height * 0.46, 1.25, 1.6), 0.05)
  const heroFrameW = roundTo(heroFrameH * 0.707, 0.05)
  addSlot({ id: 'hero-frame', wall: heroWall, kind: 'frame', w: heroFrameW, h: heroFrameH, y: height * 0.62, color: 0xffffff })

  const heroPlaqueW = roundTo(clamp(heroFrameW, 0.6, 1.2), 0.05)
  const heroPlaqueH = 0.22
  addSlot({ id: 'hero-plaque', wall: heroWall, kind: 'plaque', w: heroPlaqueW, h: heroPlaqueH, y: height * 0.25, color: 0xffff88 })

  // Standard (non-hero) exhibit sizing: identical across all walls.
  const stdFrameH = roundTo(clamp(height * 0.36, 1.05, 1.35), 0.05)
  const stdFrameW = roundTo(stdFrameH * 0.707, 0.05)
  const stdFrameY = height * 0.6

  const stdPlaqueH = 0.2
  const stdPlaqueY = height * 0.24
  const stdPlaqueW = roundTo(clamp(stdFrameW, 0.5, 1.05), 0.05)

  // Remaining walls: reserve a medium frame area + a plaque area each.
  // South wall: keep a single “secondary” slot for now.
  {
    const wall = 'south'
    addSlot({ id: `${wall}-frame`, wall, kind: 'frame', w: stdFrameW, h: stdFrameH, y: stdFrameY, color: 0xffffff })
    addSlot({ id: `${wall}-plaque`, wall, kind: 'plaque', w: stdPlaqueW, h: stdPlaqueH, y: stdPlaqueY, color: 0xffff88 })
  }

  // East + West walls: 4 slots each, side-by-side, each with its own plaque.
  function addGridWallSlots(wall) {
    const cols = 4
    const rows = 1
    // Fixed spacing so the frames themselves remain identical.
    const gapU = 0.2
    const totalW = cols * stdFrameW + (cols - 1) * gapU
    const uStart = -totalW / 2 + stdFrameW / 2

    let idx = 0
    for (let r = 0; r < rows; r += 1) {
      for (let c = 0; c < cols; c += 1) {
        const u = uStart + c * (stdFrameW + gapU)
        const y = stdFrameY

        const frameId = `${wall}-frame-${idx}`
        addSlot({ id: frameId, wall, kind: 'frame', w: stdFrameW, h: stdFrameH, y, u, color: 0xffffff })
        addSlot({ id: `${wall}-plaque-${idx}`, wall, kind: 'plaque', w: stdPlaqueW, h: stdPlaqueH, y: stdPlaqueY, u, color: 0xffff88 })

        idx += 1
      }
    }
  }

  addGridWallSlots('east')
  addGridWallSlots('west')

  group.add(markers)

  return {
    group,
    disposables,
    slots,
    bounds: {
      halfW,
      halfL,
      height,
    },
  }
}
