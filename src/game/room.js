import * as THREE from 'three'
import { clamp, makeOutlineRect, roundTo } from './helper.js'

export function buildRoom({ width, length, height, wallThickness = 0.2, mode = 'gallery', entryway = {} }) {
  const group = new THREE.Group()
  group.name = 'room'

  const disposables = []

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
  const doors = []
  const doorHitMeshes = []
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

  function addDoor({ id, wall, w, h, y = 0, u = 0, color = 0x22ffee, meta = {} }) {
    const wallInfo = walls[wall]
    const wallNormal = wallInfo.normal.clone().normalize()
    const wallUp = new THREE.Vector3(0, 1, 0)
    const wallRight = wall === 'east' || wall === 'west' ? new THREE.Vector3(0, 0, 1) : new THREE.Vector3(1, 0, 0)

    const quat = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), wallNormal)
    const baseCenter = wallInfo.center
      .clone()
      .add(wallRight.clone().multiplyScalar(u))
      .add(wallUp.clone().multiplyScalar(y - height / 2))
      .add(wallNormal.clone().multiplyScalar(wallThickness / 2 + 0.03))

    const doorFrameGroup = new THREE.Group()
    doorFrameGroup.name = `door-frame-${id}`

    const doorMat = new THREE.MeshStandardMaterial({
      color,
      roughness: 0.35,
      metalness: 0.0,
      emissive: 0x112244,
      emissiveIntensity: 0.75,
    })
    disposables.push(doorMat)

    const frameW = 0.08
    const frameDepth = 0.08

    const jambGeo = new THREE.BoxGeometry(frameW, h, frameDepth)
    const headerGeo = new THREE.BoxGeometry(w + frameW * 2, frameW, frameDepth)
    disposables.push(jambGeo, headerGeo)

    const leftJamb = new THREE.Mesh(jambGeo, doorMat)
    leftJamb.position.set(-(w / 2 + frameW / 2), h / 2, 0)
    doorFrameGroup.add(leftJamb)

    const rightJamb = new THREE.Mesh(jambGeo, doorMat)
    rightJamb.position.set(w / 2 + frameW / 2, h / 2, 0)
    doorFrameGroup.add(rightJamb)

    const header = new THREE.Mesh(headerGeo, doorMat)
    header.position.set(0, h - frameW / 2, 0)
    doorFrameGroup.add(header)

    doorFrameGroup.quaternion.copy(quat)
    doorFrameGroup.position.copy(baseCenter)
    group.add(doorFrameGroup)

    const hitGeo = new THREE.PlaneGeometry(w, h)
    const hitMat = new THREE.MeshBasicMaterial({ transparent: true, opacity: 0.0, depthWrite: false })
    const hitMesh = new THREE.Mesh(hitGeo, hitMat)
    hitMesh.name = 'door-hit'
    hitMesh.userData.doorId = id
    hitMesh.quaternion.copy(quat)
    hitMesh.position.copy(baseCenter.clone().add(wallUp.clone().multiplyScalar(h / 2)).add(wallNormal.clone().multiplyScalar(0.02)))
    group.add(hitMesh)
    doorHitMeshes.push(hitMesh)
    disposables.push(hitGeo, hitMat)

    doors.push({
      id,
      wall,
      normal: wallNormal,
      right: wallRight,
      up: wallUp,
      ...meta,
    })

    const { object, disposables: outlineDisposables } = makeOutlineRect({
      width: w,
      height: h,
      center: baseCenter.clone().add(wallUp.clone().multiplyScalar(h / 2)).add(wallNormal.clone().multiplyScalar(0.01)),
      normal: wallNormal,
      color,
    })
    markers.add(object)
    disposables.push(...outlineDisposables)
  }

  if (mode === 'entryway') {
    const categories = Array.isArray(entryway.categories) && entryway.categories.length > 0
      ? entryway.categories
      : ['Category 1', 'Category 2', 'Category 3', 'Category 4', 'Category 5', 'Category 6', 'Category 7', 'Category 8']

    const panelW = roundTo(clamp(width * 0.72, 2.4, 6.2), 0.05)
    const panelH = roundTo(clamp(height * 0.58, 1.2, 2.0), 0.05)
    addSlot({ id: 'entry-panel', wall: 'north', kind: 'panel', w: panelW, h: panelH, y: height * 0.62, color: 0xffffff })

    const doorW = 1.25
    const doorH = 2.25
    const gapU = 0.55
    const totalSpan = 4 * doorW + 3 * gapU
    const span = Math.min(totalSpan, length - 2.0)
    const actualGap = 4 > 1 ? (span - 4 * doorW) / 3 : 0
    const uStart = -span / 2 + doorW / 2

    for (let i = 0; i < 4; i += 1) {
      const u = uStart + i * (doorW + actualGap)
      const eastId = `entry-east-${i}`
      const westId = `entry-west-${i}`

      addDoor({
        id: eastId,
        wall: 'east',
        w: doorW,
        h: doorH,
        u,
        meta: { category: categories[i] ?? `Category ${i + 1}` },
      })

      addDoor({
        id: westId,
        wall: 'west',
        w: doorW,
        h: doorH,
        u,
        meta: { category: categories[i + 4] ?? `Category ${i + 5}` },
      })
    }

    group.add(markers)

    return {
      group,
      disposables,
      slots,
      doors,
      doorHitMeshes,
      bounds: {
        halfW,
        halfL,
        height,
      },
    }
  }

  const heroWall = 'north'
  const heroFrameH = roundTo(clamp(height * 0.46, 1.25, 1.6), 0.05)
  const heroFrameW = roundTo(heroFrameH * 0.707, 0.05)
  addSlot({ id: 'hero-frame', wall: heroWall, kind: 'frame', w: heroFrameW, h: heroFrameH, y: height * 0.62, color: 0xffffff })

  const heroPlaqueW = roundTo(clamp(heroFrameW, 0.6, 1.2), 0.05)
  const heroPlaqueH = 0.22
  addSlot({ id: 'hero-plaque', wall: heroWall, kind: 'plaque', w: heroPlaqueW, h: heroPlaqueH, y: height * 0.25, color: 0xffff88 })

  const stdFrameH = roundTo(clamp(height * 0.36, 1.05, 1.35), 0.05)
  const stdFrameW = roundTo(stdFrameH * 0.707, 0.05)
  const stdFrameY = height * 0.6

  const stdPlaqueH = 0.2
  const stdPlaqueY = height * 0.24
  const stdPlaqueW = roundTo(clamp(stdFrameW, 0.5, 1.05), 0.05)

  {
    const wall = 'south'
    addSlot({ id: `${wall}-frame`, wall, kind: 'frame', w: stdFrameW, h: stdFrameH, y: stdFrameY, color: 0xffffff })
    addSlot({ id: `${wall}-plaque`, wall, kind: 'plaque', w: stdPlaqueW, h: stdPlaqueH, y: stdPlaqueY, color: 0xffff88 })
  }

  function addGridWallSlots(wall) {
    const cols = 4
    const rows = 1
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
  {
    const wall = 'north'
    const wallInfo = walls[wall]
    const wallNormal = wallInfo.normal.clone().normalize()
    const wallRight = new THREE.Vector3(1, 0, 0)
    const wallUp = new THREE.Vector3(0, 1, 0)

    const doorW = 1.4
    const doorH = 2.25
    const frameW = 0.08
    const frameDepth = 0.08

    const sideMargin = 0.9
    const doorCenterX = clamp(halfW - sideMargin - doorW / 2, -halfW + sideMargin + doorW / 2, halfW - sideMargin - doorW / 2)
    const doorBase = new THREE.Vector3(doorCenterX, 0, -halfL).add(wallNormal.clone().multiplyScalar(wallThickness / 2 + 0.03))

    const doorFrameGroup = new THREE.Group()
    doorFrameGroup.name = 'door-frame-north'

    const doorMat = new THREE.MeshStandardMaterial({ color: 0x22ffee, roughness: 0.35, metalness: 0.0, emissive: 0x112244, emissiveIntensity: 0.75 })
    disposables.push(doorMat)

    const jambGeo = new THREE.BoxGeometry(frameW, doorH, frameDepth)
    const headerGeo = new THREE.BoxGeometry(doorW + frameW * 2, frameW, frameDepth)
    disposables.push(jambGeo, headerGeo)

    const leftJamb = new THREE.Mesh(jambGeo, doorMat)
    leftJamb.position.set(-(doorW / 2 + frameW / 2), doorH / 2, 0)
    doorFrameGroup.add(leftJamb)

    const rightJamb = new THREE.Mesh(jambGeo, doorMat)
    rightJamb.position.set(doorW / 2 + frameW / 2, doorH / 2, 0)
    doorFrameGroup.add(rightJamb)

    const header = new THREE.Mesh(headerGeo, doorMat)
    header.position.set(0, doorH - frameW / 2, 0)
    doorFrameGroup.add(header)

    const quat = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), wallNormal)
    doorFrameGroup.quaternion.copy(quat)
    doorFrameGroup.position.copy(doorBase)

    group.add(doorFrameGroup)

    const hitGeo = new THREE.PlaneGeometry(doorW, doorH)
    const hitMat = new THREE.MeshBasicMaterial({ transparent: true, opacity: 0.0, depthWrite: false })
    const hitMesh = new THREE.Mesh(hitGeo, hitMat)
    hitMesh.name = 'door-hit'
    hitMesh.userData.doorId = 'north-door'
    hitMesh.quaternion.copy(quat)
    hitMesh.position.copy(doorBase.clone().add(wallUp.clone().multiplyScalar(doorH / 2)).add(wallNormal.clone().multiplyScalar(0.02)))
    group.add(hitMesh)
    doorHitMeshes.push(hitMesh)
    disposables.push(hitGeo, hitMat)
    const triggerCenter = new THREE.Vector3(doorCenterX, doorH / 2, -halfL + 0.45)
    const triggerHalfExtents = new THREE.Vector3(doorW / 2 + 0.25, doorH / 2, 0.3)
    doors.push({
      id: 'north-door',
      wall,
      triggerCenter,
      triggerHalfExtents,
      normal: wallNormal,
      right: wallRight,
      up: wallUp,
    })
    const { object, disposables: outlineDisposables } = makeOutlineRect({
      width: doorW,
      height: doorH,
      center: doorBase.clone().add(wallUp.clone().multiplyScalar(doorH / 2)).add(wallNormal.clone().multiplyScalar(0.01)),
      normal: wallNormal,
      color: 0x22ffee,
    })
    markers.add(object)
    disposables.push(...outlineDisposables)
  }

  return {
    group,
    disposables,
    slots,
    doors,
    doorHitMeshes,
    bounds: {
      halfW,
      halfL,
      height,
    },
  }
}
