import * as THREE from 'three'
import { clamp, makeOutlineRect, roundTo } from './helper.js'

export function buildRoom({ width, length, height, wallThickness = 0.2, mode = 'gallery', entryway = {}, gallery = {} }) {
  const group = new THREE.Group()
  group.name = 'room'

  const disposables = []

  const palette =
    mode === 'entryway'
      ? {
          floor: 0x1c221f,
          ceiling: 0xa7c9b6,
          wall: 0x5f786c,
          keyLight: 0x78ffb1,
          keyLightIntensity: 1.9,
          ambientIntensity: 0.9,
          ceilingLightColor: 0xf4fff8,
          ceilingLightIntensity: 1.5,
        }
      : {
          floor: 0x2a2a2f,
          ceiling: 0x3a3a41,
          wall: 0x4a4a52,
          keyLight: 0xff66cc,
          keyLightIntensity: 1.6,
          ambientIntensity: 0.95,
          ceilingLightColor: 0xffffff,
          ceilingLightIntensity: 0.9,
        }

  const ambient = new THREE.AmbientLight(0xffffff, palette.ambientIntensity)
  group.add(ambient)

  const keyLight = new THREE.DirectionalLight(palette.keyLight, palette.keyLightIntensity)
  keyLight.position.set(4, height + 2.5, 3)
  group.add(keyLight)

  const ceilingLightColor = palette.ceilingLightColor
  const ceilingLightIntensity = palette.ceilingLightIntensity
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
  const floorMat = new THREE.MeshStandardMaterial({ color: palette.floor, roughness: 0.92, metalness: 0.0 })
  const floor = new THREE.Mesh(floorGeo, floorMat)
  floor.rotation.x = -Math.PI / 2
  floor.position.y = 0
  group.add(floor)
  disposables.push(floorGeo, floorMat)

  const ceilingGeo = new THREE.PlaneGeometry(width, length)
  const ceilingMat = new THREE.MeshStandardMaterial({ color: palette.ceiling, roughness: 0.98, metalness: 0.0 })
  const ceiling = new THREE.Mesh(ceilingGeo, ceilingMat)
  ceiling.rotation.x = Math.PI / 2
  ceiling.position.y = height
  group.add(ceiling)
  disposables.push(ceilingGeo, ceilingMat)

  const wallMat = new THREE.MeshStandardMaterial({ color: palette.wall, roughness: 0.9, metalness: 0.0 })
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

    const fillGeo = new THREE.PlaneGeometry(w, h)
    const fillMat = new THREE.MeshStandardMaterial({ color: 0x171c22, roughness: 0.95, metalness: 0.0 })
    const fill = new THREE.Mesh(fillGeo, fillMat)
    fill.position.set(0, h / 2, -0.02)
    doorFrameGroup.add(fill)
    disposables.push(fillGeo, fillMat)

    const labelText =
      typeof meta.label === 'string' && meta.label.trim().length > 0
        ? meta.label.trim()
        : typeof meta.category === 'string' && meta.category.trim().length > 0
          ? meta.category.trim()
          : ''

    if (labelText) {
      const plaqueW = Math.min(w * 0.82, 1.35)
      const plaqueH = 0.24
      const plaqueCenterY = Math.min(h - 0.25, 1.4)
      const plaqueGeo = new THREE.PlaneGeometry(plaqueW, plaqueH)
      const plaqueMat = new THREE.MeshStandardMaterial({ color: 0x12161b, roughness: 0.9, metalness: 0.0 })
      const plaque = new THREE.Mesh(plaqueGeo, plaqueMat)
      plaque.position.set(0, plaqueCenterY, -0.015)
      doorFrameGroup.add(plaque)
      disposables.push(plaqueGeo, plaqueMat)

      const canvas = document.createElement('canvas')
      canvas.width = 512
      canvas.height = 128
      const ctx = canvas.getContext('2d')
      if (ctx) {
        function wrapLines(text, maxWidth, maxLines) {
          const words = String(text).trim().split(/\s+/g)
          const lines = []
          let cur = ''

          function pushLine(line) {
            if (line.trim()) lines.push(line.trim())
          }

          for (const word of words) {
            const next = cur ? `${cur} ${word}` : word
            if (ctx.measureText(next).width <= maxWidth) {
              cur = next
              continue
            }

            if (cur) pushLine(cur)
            cur = word

            if (ctx.measureText(cur).width > maxWidth) {
              let chunk = ''
              for (const ch of cur) {
                const nextChunk = chunk + ch
                if (ctx.measureText(nextChunk).width <= maxWidth) {
                  chunk = nextChunk
                } else {
                  pushLine(chunk)
                  chunk = ch
                }
              }
              cur = chunk
            }

            if (lines.length >= maxLines) break
          }

          if (lines.length < maxLines && cur) pushLine(cur)

          if (lines.length > maxLines) lines.length = maxLines
          if (lines.length === maxLines) {
            const lastIdx = maxLines - 1
            let last = lines[lastIdx] ?? ''
            const ell = '…'
            while (last && ctx.measureText(last + ell).width > maxWidth) {
              last = last.slice(0, -1)
            }
            lines[lastIdx] = last ? last + ell : ell
          }

          return lines
        }

        ctx.clearRect(0, 0, canvas.width, canvas.height)
        ctx.fillStyle = '#171c22'
        ctx.fillRect(0, 0, canvas.width, canvas.height)

        const padX = 18
        const maxLines = 3
        let fontPx = 56
        ctx.font = `700 ${fontPx}px system-ui, -apple-system, Segoe UI, Roboto, Arial`
        ctx.fillStyle = '#dfffe9'
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'

        const maxWidth = canvas.width - padX * 2
        let lines = wrapLines(labelText, maxWidth, maxLines)

        if (lines.length >= 3) fontPx = 28
        else if (lines.length === 2) fontPx = 38
        else fontPx = 56

        ctx.font = `700 ${fontPx}px system-ui, -apple-system, Segoe UI, Roboto, Arial`
        lines = wrapLines(labelText, maxWidth, maxLines)

        const lineHeight = Math.round(fontPx * 1.1)
        const totalH = lines.length * lineHeight
        const startY = canvas.height / 2 - totalH / 2 + lineHeight / 2

        for (let i = 0; i < lines.length; i += 1) {
          ctx.fillText(lines[i], canvas.width / 2, startY + i * lineHeight)
        }
      }

      const tex = new THREE.CanvasTexture(canvas)
      tex.colorSpace = THREE.SRGBColorSpace
      tex.needsUpdate = true

      const textGeo = new THREE.PlaneGeometry(plaqueW * 0.96, plaqueH * 0.78)
      const textMat = new THREE.MeshBasicMaterial({ map: tex })
      const text = new THREE.Mesh(textGeo, textMat)
      text.position.set(0, plaqueCenterY, -0.012)
      doorFrameGroup.add(text)
      disposables.push(tex, textGeo, textMat)
    }

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
      : ['Category 1', 'Category 2', 'Category 3', 'Category 4', 'Category 5', 'Category 6', 'Category 7', 'Category 8', 'Category 9', 'Category 10']

    const panelW = roundTo(clamp(width * 0.72, 2.4, 6.2), 0.05)
    const panelH = roundTo(clamp(height * 0.58, 1.2, 2.0), 0.05)
    addSlot({ id: 'entry-panel', wall: 'north', kind: 'panel', w: panelW, h: panelH, y: height * 0.62, color: 0xffffff })

    const doorW = 1.25
    const doorH = 2.25

    const perWall = Math.ceil(categories.length / 2)
    const gapU = 0.55
    const totalSpan = perWall * doorW + (perWall - 1) * gapU
    const span = Math.max(perWall * doorW, Math.min(totalSpan, length - 2.0))
    const actualGap = perWall > 1 ? (span - perWall * doorW) / (perWall - 1) : 0
    const uStart = -span / 2 + doorW / 2

    for (let i = 0; i < perWall; i += 1) {
      const u = uStart + i * (doorW + actualGap)

      const eastCategory = categories[i]
      if (eastCategory) {
        addDoor({
          id: `entry-east-${i}`,
          wall: 'east',
          w: doorW,
          h: doorH,
          u,
          meta: { category: eastCategory },
        })
      }

      const westCategory = categories[i + perWall]
      if (westCategory) {
        addDoor({
          id: `entry-west-${i}`,
          wall: 'west',
          w: doorW,
          h: doorH,
          u,
          meta: { category: westCategory },
        })
      }
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

  addDoor({ id: 'entry-door', wall: 'south', w: 1.25, h: 2.25, u: 0, color: 0xff4455, meta: { target: 'back', label: 'Back' } })

  {
    const relatedTitles = Array.isArray(gallery.relatedTitles) ? gallery.relatedTitles.filter(Boolean) : []
    const n = relatedTitles.length
    if (n > 0) {
      const wall = 'north'
      const gapU = 0.22
      const usable = Math.max(1.0, width - 2.0)
      const doorW = clamp((usable - (n - 1) * gapU) / n, 0.45, 1.25)
      const doorH = 2.25
      const totalSpan = n * doorW + (n - 1) * gapU
      const uStart = -totalSpan / 2 + doorW / 2

      for (let i = 0; i < n; i += 1) {
        const u = uStart + i * (doorW + gapU)
        const title = String(relatedTitles[i])
        addDoor({
          id: `seealso-${i}`,
          wall,
          w: doorW,
          h: doorH,
          u,
          meta: { articleTitle: title, label: title },
        })
      }
    }
  }

  const stdFrameH = roundTo(clamp(height * 0.36, 1.05, 1.35), 0.05)
  const stdFrameW = roundTo(stdFrameH * 0.707, 0.05)
  const stdFrameY = height * 0.6

  const stdPlaqueH = 0.2
  const stdPlaqueY = height * 0.24
  const stdPlaqueW = roundTo(clamp(stdFrameW, 0.5, 1.05), 0.05)

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
