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
  const obstacles = []
  const markers = new THREE.Group()
  markers.name = 'display-slots'

  const surfaceOffset = wallThickness / 2 + 0.02

  const walls = {
    north: { center: new THREE.Vector3(0, height / 2, -halfL), normal: new THREE.Vector3(0, 0, 1), wallWidth: width, wallHeight: height },
    south: { center: new THREE.Vector3(0, height / 2, halfL), normal: new THREE.Vector3(0, 0, -1), wallWidth: width, wallHeight: height },
    east: { center: new THREE.Vector3(halfW, height / 2, 0), normal: new THREE.Vector3(-1, 0, 0), wallWidth: length, wallHeight: height },
    west: { center: new THREE.Vector3(-halfW, height / 2, 0), normal: new THREE.Vector3(1, 0, 0), wallWidth: length, wallHeight: height },
  }

  function makeNoPhotoTexture({ size = 1024, title = 'NO PHOTO', subtitle = 'No image available' } = {}) {
    const canvas = document.createElement('canvas')
    canvas.width = size
    canvas.height = size
    const ctx = canvas.getContext('2d')
    if (ctx) {
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      ctx.fillStyle = '#0d1015'
      ctx.fillRect(0, 0, canvas.width, canvas.height)

      ctx.strokeStyle = 'rgba(255,255,255,0.18)'
      ctx.lineWidth = Math.max(6, Math.floor(size * 0.01))
      ctx.strokeRect(24, 24, canvas.width - 48, canvas.height - 48)

      ctx.fillStyle = 'rgba(255,255,255,0.9)'
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.font = `800 ${Math.floor(size * 0.11)}px system-ui, -apple-system, Segoe UI, Roboto, Arial`
      ctx.fillText(String(title), canvas.width / 2, canvas.height / 2 - Math.floor(size * 0.01))

      ctx.font = `600 ${Math.floor(size * 0.045)}px system-ui, -apple-system, Segoe UI, Roboto, Arial`
      ctx.fillStyle = 'rgba(156, 144, 30, 0.74)'
      ctx.fillText(String(subtitle), canvas.width / 2, canvas.height / 2 + Math.floor(size * 0.09))
    }

    const tex = new THREE.CanvasTexture(canvas)
    tex.colorSpace = THREE.SRGBColorSpace
    tex.needsUpdate = true
    return tex
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
    const colRadius = 0.65
    const colHeight = height
    const colGeo = new THREE.CylinderGeometry(colRadius, colRadius, colHeight, 18, 1)
    const colMat = new THREE.MeshStandardMaterial({ color: palette.wall, roughness: 0.85, metalness: 0.0 })
    disposables.push(colGeo, colMat)

    function addColumn({ id, x, z }) {
      const col = new THREE.Mesh(colGeo, colMat)
      col.name = id
      col.position.set(x, colHeight / 2, z)
      group.add(col)

      obstacles.push({ type: 'cylinder', x, z, radius: colRadius })
      return col
    }

    const colOffsetX = Math.min(1.55, Math.max(1.05, width * 0.11))
    const leftCol = addColumn({ id: 'column-left', x: -colOffsetX, z: 0 })
    const rightCol = addColumn({ id: 'column-right', x: colOffsetX, z: 0 })

    const title = typeof gallery.title === 'string' ? gallery.title.trim() : ''
    const description = typeof gallery.description === 'string' ? gallery.description.trim() : ''
    const mainThumbnailUrl = typeof gallery.mainThumbnailUrl === 'string' ? gallery.mainThumbnailUrl.trim() : ''

    const imageOnLeft = Math.random() < 0.5
    const imageCol = imageOnLeft ? leftCol : rightCol
    const textCol = imageOnLeft ? rightCol : leftCol

    const panelW = 1.55
    const panelH = 1.55
    const panelY = Math.min(height * 0.47, 1.9)
    const panelZ = colRadius + 0.08

    const panelDepth = 0.06
    const panelBackGeo = new THREE.BoxGeometry(panelW, panelH, panelDepth)
    const panelBackMat = new THREE.MeshStandardMaterial({ color: 0x0d1015, roughness: 0.95, metalness: 0.0 })
    disposables.push(panelBackGeo, panelBackMat)

    const imgBack = new THREE.Mesh(panelBackGeo, panelBackMat)
    imgBack.position.set(imageCol.position.x, panelY, panelZ)
    group.add(imgBack)

    const imgGeo = new THREE.PlaneGeometry(panelW, panelH)
    const imgMat = new THREE.MeshBasicMaterial({ color: 0xffffff })
    const img = new THREE.Mesh(imgGeo, imgMat)
    img.position.set(imageCol.position.x, panelY, panelZ + panelDepth / 2 + 0.002)
    group.add(img)
    disposables.push(imgGeo, imgMat)

    function fitMeshToTextureAspect(mesh, { baseW, baseH, tex }) {
      if (!mesh || !tex) return
      const iw = tex?.image?.width
      const ih = tex?.image?.height
      if (!(typeof iw === 'number' && typeof ih === 'number' && iw > 0 && ih > 0)) return

      const imageAspect = iw / ih
      const frameAspect = baseW / baseH

      let sx = 1
      let sy = 1
      if (imageAspect > frameAspect) {
        sy = frameAspect / imageAspect
      } else {
        sx = imageAspect / frameAspect
      }

      mesh.scale.set(sx, sy, 1)
    }

    function applyNoPhoto() {
      const tex = makeNoPhotoTexture({ size: 1024 })
      imgMat.map = tex
      imgMat.color.setHex(0xffffff)
      imgMat.needsUpdate = true
      fitMeshToTextureAspect(img, { baseW: panelW, baseH: panelH, tex })
      disposables.push(tex)
    }

    if (mainThumbnailUrl) {
      const loader = new THREE.TextureLoader()
      if (typeof loader.setCrossOrigin === 'function') loader.setCrossOrigin('anonymous')
      loader.load(
        mainThumbnailUrl,
        (tex) => {
          tex.colorSpace = THREE.SRGBColorSpace
          tex.needsUpdate = true
          imgMat.map = tex
          imgMat.color.setHex(0xffffff)
          imgMat.needsUpdate = true
          fitMeshToTextureAspect(img, { baseW: panelW, baseH: panelH, tex })
          disposables.push(tex)
        },
        undefined,
        (err) => {
          console.warn('[linkwalk] Failed to load gallery image', mainThumbnailUrl, err)
          applyNoPhoto()
        }
      )
    } else {
      applyNoPhoto()
    }

    const descW = 1.55
    const descH = 1.2
    const descGeo = new THREE.PlaneGeometry(descW, descH)
    const descCanvas = document.createElement('canvas')
    descCanvas.width = 1024
    descCanvas.height = 768
    const descCtx = descCanvas.getContext('2d')

    function wrapText(ctx, text, maxWidth, maxLines) {
      const words = String(text).trim().split(/\s+/g)
      const lines = []
      let cur = ''

      for (const word of words) {
        const next = cur ? `${cur} ${word}` : word
        if (ctx.measureText(next).width <= maxWidth) {
          cur = next
          continue
        }
        if (cur) lines.push(cur)
        cur = word
        if (lines.length >= maxLines) break
      }
      if (lines.length < maxLines && cur) lines.push(cur)

      if (lines.length === maxLines) {
        let last = lines[maxLines - 1] ?? ''
        const ell = '…'
        while (last && ctx.measureText(last + ell).width > maxWidth) last = last.slice(0, -1)
        lines[maxLines - 1] = last ? last + ell : ell
      }
      return lines
    }

    if (descCtx) {
      descCtx.clearRect(0, 0, descCanvas.width, descCanvas.height)
      descCtx.fillStyle = 'rgba(0,0,0,0.68)'
      descCtx.fillRect(0, 0, descCanvas.width, descCanvas.height)

      const padX = 34
      let y = 84

      const safeTitle = title || 'Wikipedia'
      descCtx.font = '700 56px system-ui, -apple-system, Segoe UI, Roboto, Arial'
      descCtx.fillStyle = 'rgba(223,255,233,0.98)'
      descCtx.textAlign = 'left'
      descCtx.textBaseline = 'alphabetic'

      const titleLines = wrapText(descCtx, safeTitle, descCanvas.width - padX * 2, 2)
      for (const line of titleLines) {
        descCtx.fillText(line, padX, y)
        y += 64
      }

      if (description) {
        y += 18
        descCtx.font = '500 38px system-ui, -apple-system, Segoe UI, Roboto, Arial'
        descCtx.fillStyle = 'rgba(255,255,255,0.92)'
        const descLines = wrapText(descCtx, description, descCanvas.width - padX * 2, 6)
        for (const line of descLines) {
          descCtx.fillText(line, padX, y)
          y += 48
        }
      }
    }

    const descTex = new THREE.CanvasTexture(descCanvas)
    descTex.colorSpace = THREE.SRGBColorSpace
    descTex.needsUpdate = true
    const descMat = new THREE.MeshBasicMaterial({ map: descTex, transparent: true })
    const descPanel = new THREE.Mesh(descGeo, descMat)

    const descY = Math.min(height * 0.44, 1.8)
    const descBackGeo = new THREE.BoxGeometry(descW, descH, panelDepth)
    const descBackMat = new THREE.MeshStandardMaterial({ color: 0x0d1015, roughness: 0.95, metalness: 0.0 })
    const descBack = new THREE.Mesh(descBackGeo, descBackMat)
    descBack.position.set(textCol.position.x, descY, panelZ)
    group.add(descBack)
    disposables.push(descBackGeo, descBackMat)

    descPanel.position.set(textCol.position.x, descY, panelZ + panelDepth / 2 + 0.002)
    group.add(descPanel)
    disposables.push(descGeo, descTex, descMat)
  }

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
  const stdFrameY = height * 0.5

  const stdPlaqueH = 0.2
  const stdPlaqueY = height * 0.17
  const stdPlaqueW = roundTo(clamp(stdFrameW, 0.5, 1.05), 0.05)

  function addGridWallSlots(wall, { cols = 4, withPlaques = true, frameScale = 1, gapU = 0.2 } = {}) {
    const rows = 1
    const frameW = stdFrameW * frameScale
    const frameH = stdFrameH * frameScale
    const totalW = cols * frameW + (cols - 1) * gapU
    const uStart = -totalW / 2 + frameW / 2

    let idx = 0
    for (let r = 0; r < rows; r += 1) {
      for (let c = 0; c < cols; c += 1) {
        const u = uStart + c * (frameW + gapU)
        const y = stdFrameY

        const frameId = `${wall}-frame-${idx}`
        addSlot({ id: frameId, wall, kind: 'frame', w: frameW, h: frameH, y, u, color: 0xffffff })
        if (withPlaques) {
          addSlot({ id: `${wall}-plaque-${idx}`, wall, kind: 'plaque', w: stdPlaqueW, h: stdPlaqueH, y: stdPlaqueY, u, color: 0xffff88 })
        }

        idx += 1
      }
    }
  }

  if (mode === 'entryway') {
    addGridWallSlots('east')
    addGridWallSlots('west')
  } else {
    // Gallery: photo / text / photo on each side wall; no extra empty 4th frame.
    addGridWallSlots('east', { cols: 3, withPlaques: false, frameScale: 1.5, gapU: 0.4 })
    addGridWallSlots('west', { cols: 3, withPlaques: false, frameScale: 1.5, gapU: 0.4 })
  }

  if (mode !== 'entryway') {
    const photos = Array.isArray(gallery.photos)
      ? gallery.photos
          .map((u) => (typeof u === 'string' ? u.trim() : ''))
          .filter(Boolean)
      : []

    const relatedTitles = Array.isArray(gallery.relatedTitles)
      ? gallery.relatedTitles
          .map((t) => (typeof t === 'string' ? t.trim() : ''))
          .filter(Boolean)
      : []

    const description = typeof gallery.description === 'string' ? gallery.description.trim() : ''

    function selectThreeFrameSlots(wall) {
      const frames = slots.filter((s) => s.wall === wall && s.kind === 'frame')
      return frames.slice(0, 3)
    }

    function placePhotoInSlot(slot, url, { placeholderTitle = 'NO PHOTO' } = {}) {
      if (!slot) return

      const baseW = slot.width * 0.96
      const baseH = slot.height * 0.96

      const geo = new THREE.PlaneGeometry(1, 1)
      const mat = new THREE.MeshBasicMaterial({ color: 0xffffff })
      const mesh = new THREE.Mesh(geo, mat)
      mesh.scale.set(baseW, baseH, 1)

      const normal = slot.normal.clone().normalize()
      mesh.position.copy(slot.center).add(normal.clone().multiplyScalar(0.012))
      mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), normal)

      group.add(mesh)
      disposables.push(geo, mat)

      function applyTexture(tex) {
        if (!tex) return
        tex.colorSpace = THREE.SRGBColorSpace
        tex.needsUpdate = true
        mat.map = tex
        mat.color.setHex(0xffffff)
        mat.needsUpdate = true

        const iw = tex?.image?.width
        const ih = tex?.image?.height
        if (typeof iw === 'number' && typeof ih === 'number' && iw > 0 && ih > 0) {
          const imageAspect = iw / ih
          const frameAspect = baseW / baseH
          let sx = 1
          let sy = 1
          if (imageAspect > frameAspect) {
            sy = frameAspect / imageAspect
          } else {
            sx = imageAspect / frameAspect
          }
          mesh.scale.set(baseW * sx, baseH * sy, 1)
        }

        disposables.push(tex)
      }

      if (url) {
        const loader = new THREE.TextureLoader()
        if (typeof loader.setCrossOrigin === 'function') loader.setCrossOrigin('anonymous')
        loader.load(
          url,
          (tex) => applyTexture(tex),
          undefined,
          (err) => {
            console.warn('[linkwalk] Failed to load wall photo', url, err)
            applyTexture(makeNoPhotoTexture({ size: 1024, title: placeholderTitle }))
          }
        )
      } else {
        applyTexture(makeNoPhotoTexture({ size: 1024, title: placeholderTitle }))
      }
    }

    function labelFromImageUrl(url) {
      const raw = typeof url === 'string' ? url.trim() : ''
      if (!raw) return ''
      try {
        const file = raw.split('/').pop() ?? ''
        const decoded = decodeURIComponent(file)
        const withoutQuery = decoded.split('?')[0] ?? decoded
        const withoutExt = withoutQuery.replace(/\.(jpg|jpeg|png|webp|gif)$/i, '')
        const cleaned = withoutExt.replace(/^File:/i, '').replace(/_/g, ' ').trim()
        return cleaned
      } catch {
        return ''
      }
    }

    function makePlaqueTexture({ size = 1024, text } = {}) {
      const canvas = document.createElement('canvas')
      canvas.width = size
      canvas.height = Math.floor(size * 0.33)
      const ctx = canvas.getContext('2d')
      if (ctx) {
        ctx.clearRect(0, 0, canvas.width, canvas.height)
        ctx.fillStyle = '#12161b'
        ctx.fillRect(0, 0, canvas.width, canvas.height)

        ctx.strokeStyle = 'rgba(255,255,255,0.18)'
        ctx.lineWidth = Math.max(6, Math.floor(size * 0.008))
        ctx.strokeRect(18, 18, canvas.width - 36, canvas.height - 36)

        const safeText = String(text || '').trim() || 'Untitled'
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        ctx.fillStyle = 'rgba(255,255,255,0.92)'

        const maxWidth = canvas.width * 0.86
        let fontSize = Math.floor(size * 0.06)
        ctx.font = `700 ${fontSize}px system-ui, -apple-system, Segoe UI, Roboto, Arial`
        while (fontSize > 18 && ctx.measureText(safeText).width > maxWidth) {
          fontSize -= 2
          ctx.font = `700 ${fontSize}px system-ui, -apple-system, Segoe UI, Roboto, Arial`
        }

        function ellipsize(t) {
          const ell = '…'
          let out = String(t)
          while (out.length > 0 && ctx.measureText(out + ell).width > maxWidth) out = out.slice(0, -1)
          return out.length ? out + ell : ell
        }

        const rendered = ctx.measureText(safeText).width > maxWidth ? ellipsize(safeText) : safeText
        ctx.fillText(rendered, canvas.width / 2, canvas.height / 2)
      }

      const tex = new THREE.CanvasTexture(canvas)
      tex.colorSpace = THREE.SRGBColorSpace
      tex.needsUpdate = true
      return tex
    }

    function placeCaptionUnderSlot(slot, caption) {
      if (!slot) return

      const plaqueW = slot.width * 0.92
      const plaqueH = Math.min(0.28, slot.height * 0.22)
      const geo = new THREE.PlaneGeometry(plaqueW, plaqueH)
      const mat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true })
      const mesh = new THREE.Mesh(geo, mat)

      const normal = slot.normal.clone().normalize()
      const y = slot.center.y - slot.height / 2 - plaqueH / 2 - 0.08
      mesh.position.set(slot.center.x, y, slot.center.z)
      mesh.position.add(normal.clone().multiplyScalar(0.012))
      mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), normal)

      group.add(mesh)
      disposables.push(geo, mat)

      const tex = makePlaqueTexture({ size: 1024, text: caption })
      mat.map = tex
      mat.color.setHex(0xffffff)
      mat.needsUpdate = true
      disposables.push(tex)
    }

    function placePhotoWithCaption(slot, url) {
      placePhotoInSlot(slot, url, { placeholderTitle: 'NO PHOTO' })
      const label = labelFromImageUrl(url)
      placeCaptionUnderSlot(slot, label || (url ? 'Untitled' : 'No photo'))
    }

    function makeWallTextTexture({ size = 1024, title, text } = {}) {
      const canvas = document.createElement('canvas')
      canvas.width = size
      canvas.height = size
      const ctx = canvas.getContext('2d')

      if (ctx) {
        ctx.clearRect(0, 0, canvas.width, canvas.height)
        ctx.fillStyle = 'rgba(0,0,0,0.68)'
        ctx.fillRect(0, 0, canvas.width, canvas.height)

        ctx.strokeStyle = 'rgba(255,255,255,0.16)'
        ctx.lineWidth = Math.max(6, Math.floor(size * 0.01))
        ctx.strokeRect(24, 24, canvas.width - 48, canvas.height - 48)

        const pad = 64
        let y = pad + 10

        const safeTitle = String(title || 'Wikipedia')
        ctx.fillStyle = 'rgba(223,255,233,0.96)'
        ctx.textAlign = 'left'
        ctx.textBaseline = 'alphabetic'
        ctx.font = `800 ${Math.floor(size * 0.075)}px system-ui, -apple-system, Segoe UI, Roboto, Arial`
        ctx.fillText(safeTitle, pad, y)
        y += Math.floor(size * 0.095)

        ctx.font = `600 ${Math.floor(size * 0.045)}px system-ui, -apple-system, Segoe UI, Roboto, Arial`
        ctx.fillStyle = 'rgba(255,255,255,0.9)'

        function wrapText(text, maxWidth) {
          const words = String(text).trim().split(/\s+/g)
          const out = []
          let cur = ''
          for (const w of words) {
            const next = cur ? `${cur} ${w}` : w
            if (ctx.measureText(next).width <= maxWidth) {
              cur = next
              continue
            }
            if (cur) out.push(cur)
            cur = w
          }
          if (cur) out.push(cur)
          return out
        }

        const maxWidth = canvas.width - pad * 2
        const safeText = String(text || '').trim()
        const wrapped = safeText ? wrapText(safeText, maxWidth) : ['No description available']
        const lineHeight = Math.floor(size * 0.062)

        for (const line of wrapped.slice(0, 10)) {
          ctx.fillText(line, pad, y)
          y += lineHeight
          if (y > canvas.height - pad) break
        }
      }

      const tex = new THREE.CanvasTexture(canvas)
      tex.colorSpace = THREE.SRGBColorSpace
      tex.needsUpdate = true
      return tex
    }

    function placeTextInSlot(slot, { title, text }) {
      if (!slot) return

      const geo = new THREE.PlaneGeometry(slot.width * 0.96, slot.height * 0.96)
      const mat = new THREE.MeshBasicMaterial({ color: 0xffffff })
      const mesh = new THREE.Mesh(geo, mat)

      const normal = slot.normal.clone().normalize()
      mesh.position.copy(slot.center).add(normal.clone().multiplyScalar(0.012))
      mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), normal)

      group.add(mesh)
      disposables.push(geo, mat)

      const tex = makeWallTextTexture({ size: 1024, title, text })
      mat.map = tex
      mat.color.setHex(0xffffff)
      mat.needsUpdate = true
      disposables.push(tex)
    }

    const westSlots = selectThreeFrameSlots('west')
    const eastSlots = selectThreeFrameSlots('east')

    const galleryTitle = typeof gallery.title === 'string' ? gallery.title.trim() : ''

    const maxExcerptLen = 520
    const excerptA = description ? description.slice(0, maxExcerptLen).trimEnd() : ''
    const excerptB = description ? description.slice(maxExcerptLen, maxExcerptLen * 2).trimStart() : ''
    const westText = excerptA ? (description.length > maxExcerptLen ? `${excerptA}…` : excerptA) : ''
    const eastText = excerptB ? (description.length > maxExcerptLen * 2 ? `${excerptB}…` : excerptB) : ''

    // West wall: photo / text / photo
    placePhotoWithCaption(westSlots[0], photos[0] ?? null)
    placePhotoWithCaption(westSlots[2], photos[1] ?? null)
    {
      placeTextInSlot(westSlots[1], { title: galleryTitle || 'Wikipedia', text: westText || description || 'No description available' })
    }

    // East wall: photo / text / photo
    placePhotoWithCaption(eastSlots[0], photos[2] ?? null)
    placePhotoWithCaption(eastSlots[2], photos[3] ?? null)
    {
      const fallback = description || 'No description available'
      const text = eastText || (description.length > maxExcerptLen ? fallback : '')
      placeTextInSlot(eastSlots[1], { title: galleryTitle || 'Wikipedia', text: text || fallback })
    }
  }

  group.add(markers)

  return {
    group,
    disposables,
    slots,
    doors,
    doorHitMeshes,
    obstacles,
    bounds: {
      halfW,
      halfL,
      height,
    },
  }
}
