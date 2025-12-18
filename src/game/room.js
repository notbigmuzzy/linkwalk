import * as THREE from 'three'
import { clamp, roundTo, configureGalleryTexture } from '../misc/helper.js'
import { buildLobbyRoom } from './room/lobby.js'
import { addDoor as addDoorToRoom } from './room/doors.js'
import { addSlot as addSlotToRoom } from './room/slots.js'
import {
  getSharedRoomMaterialTextures,
} from './room/textures.js'

export function buildRoom({ width, length, height, wallThickness = 0.2, mode = 'gallery', lobby = {}, gallery = {} }) {
  const group = new THREE.Group()
  group.name = 'room'

  const disposables = []
  const deferredTextureLoads = []
  let palette = {}

  switch (mode) {
	case 'lobby':
		palette = {
	
			floor: 0xfff1c8,
			ceiling: 0xe9fbff,
			wall: 0xcfeaff,
			keyLight: 0xfff0b0,
			keyLightIntensity: 1.55,
			ambientIntensity: 1.05,
			ceilingLightColor: 0xd7f1ff,
			ceilingLightIntensity: 1.35,
		}
		break;
	case 'gallery':
		palette = {
			floor: 0x2a2a2f,
      		ceiling: 0xd9d9de,
			wall: 0x4a4a52,
      		keyLight: 0xfff1d2,
			keyLightIntensity: 1.6,
			ambientIntensity: 0.95,
			ceilingLightColor: 0xffffff,
			ceilingLightIntensity: 0.9,
		}
		break;
	default:
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

  const lightML = new THREE.PointLight(ceilingLightColor, ceilingLightIntensity, ceilingLightDistance, ceilingLightDecay)
  lightML.position.set(-x, y, 0)
  group.add(lightML)

  const lightMR = new THREE.PointLight(ceilingLightColor, ceilingLightIntensity, ceilingLightDistance, ceilingLightDecay)
  lightMR.position.set(x, y, 0)
  group.add(lightMR)

  const {
    floorWoodMap,
    floorWoodBump,
    doorWoodMap,
    doorWoodBump,
    benchWoodMap,
    benchWoodBump,
    wallStuccoMap,
    wallStuccoBump,
    ceilingStuccoMap,
    ceilingStuccoBump,
    pillarMarbleMap,
    pillarMarbleBump,
    panelMarbleMap,
    panelMarbleBump,
  } = getSharedRoomMaterialTextures({ width, length })

  const panelMarbleBackMat = new THREE.MeshStandardMaterial({
    color: 0x4a4a52,
    map: panelMarbleMap,
    bumpMap: panelMarbleBump,
    bumpScale: 0.05,
    roughness: 0.84,
    metalness: 0.0,
  })
  disposables.push(panelMarbleBackMat)

  const floorGeo = new THREE.PlaneGeometry(width, length)
  const floorMat = new THREE.MeshStandardMaterial({
	color: mode === 'lobby' ? palette.floor : 0xffffff,
    map: floorWoodMap,
    bumpMap: floorWoodBump,
    bumpScale: 0.05,
    roughness: 0.42,
    metalness: 0.0,
  })
  const floor = new THREE.Mesh(floorGeo, floorMat)
  floor.rotation.x = -Math.PI / 2
  floor.position.y = 0
  group.add(floor)
  disposables.push(floorGeo, floorMat)

  const ceilingGeo = new THREE.PlaneGeometry(width, length)
  const ceilingMat = new THREE.MeshStandardMaterial({
    color: palette.ceiling,
    map: ceilingStuccoMap,
    bumpMap: ceilingStuccoBump,
    bumpScale: 0.14,
    roughness: 0.94,
    metalness: 0.0,
  })
  const ceiling = new THREE.Mesh(ceilingGeo, ceilingMat)
  ceiling.rotation.x = Math.PI / 2
  ceiling.position.y = height
  group.add(ceiling)
  disposables.push(ceilingGeo, ceilingMat)

  const wallMat = new THREE.MeshStandardMaterial({
	color: mode === 'lobby' ? palette.wall : 0xffffff,
    map: wallStuccoMap,
    bumpMap: wallStuccoBump,
    bumpScale: 0.09,
    roughness: 0.92,
    metalness: 0.0,
  })
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
  const pickableMeshes = []
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

  function makeNoPhotoTexture({ size = 512, title = 'NO PHOTO', subtitle = 'No image available' } = {}) {
    const canvas = document.createElement('canvas')
    canvas.width = size
    canvas.height = size
    const ctx = canvas.getContext('2d')
    if (ctx) {
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      ctx.fillStyle = '#c0c0a9ff'
      ctx.fillRect(0, 0, canvas.width, canvas.height)

      ctx.strokeStyle = 'rgba(0,0,0,0.18)'
      ctx.lineWidth = Math.max(6, Math.floor(size * 0.01))
      ctx.strokeRect(24, 24, canvas.width - 48, canvas.height - 48)

      ctx.fillStyle = 'rgba(0,0,0,0.9)'
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.font = `800 ${Math.floor(size * 0.11)}px system-ui, -apple-system, Segoe UI, Roboto, Arial`
      ctx.fillText(String(title), canvas.width / 2, canvas.height / 2 - Math.floor(size * 0.01))

      ctx.font = `600 ${Math.floor(size * 0.045)}px system-ui, -apple-system, Segoe UI, Roboto, Arial`
      ctx.fillStyle = 'rgba(0,0,0,0.7)'
      ctx.fillText(String(subtitle), canvas.width / 2, canvas.height / 2 + Math.floor(size * 0.09))
    }

    const tex = new THREE.CanvasTexture(canvas)
    tex.colorSpace = THREE.SRGBColorSpace
    configureGalleryTexture(tex)
    return tex
  }

  function makePhotoFrameBackTexture({ size = 1024 } = {}) {
    const canvas = document.createElement('canvas')
    canvas.width = size
    canvas.height = size
    const ctx = canvas.getContext('2d')
    if (ctx) {
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      ctx.fillStyle = '#e0e0d4ff'
      ctx.fillRect(0, 0, canvas.width, canvas.height)

      ctx.strokeStyle = 'rgba(0,0,0,0.18)'
      ctx.lineWidth = Math.max(6, Math.floor(size * 0.01))
      ctx.strokeRect(24, 24, canvas.width - 48, canvas.height - 48)
    }

    const tex = new THREE.CanvasTexture(canvas)
    tex.colorSpace = THREE.SRGBColorSpace
    tex.premultiplyAlpha = true
    configureGalleryTexture(tex)
    return tex
  }

  const roomCtx = {
    group,
    disposables,
    deferredTextureLoads,
    slots,
    doors,
    doorHitMeshes,
    pickableMeshes,
    obstacles,
    markers,
    palette,
    textures: {
      benchWoodMap,
      benchWoodBump,
    },
    width,
    length,
    height,
    halfW,
    halfL,
    wallThickness,
    surfaceOffset,
    walls,
  }

  roomCtx.doorStyle = {
    frame: { color: 0x1a0f09, roughness: 0.58, metalness: 0.0 },
    door: {
      color: 0xc79a6c,
      roughness: 0.44,
      metalness: 0.0,
      map: doorWoodMap,
      bumpMap: doorWoodBump,
      bumpScale: 0.075,
    },
    fill: { color: 0x0d1015, roughness: 0.95, metalness: 0.0 },
  }

  function addSlot(args) {
    return addSlotToRoom(roomCtx, args)
  }

  function addDoor(args) {
    return addDoorToRoom(roomCtx, args)
  }

  roomCtx.addSlot = addSlot
  roomCtx.addDoor = addDoor

  if (mode === 'lobby') {
    const lobbyRoom = buildLobbyRoom(roomCtx, lobby)
    return { ...lobbyRoom, deferredTextureLoads }
  }

  const photoFrameBackTex = makePhotoFrameBackTexture({ size: 1024 })
  disposables.push(photoFrameBackTex)

  addDoor({ id: 'entry-door', wall: 'south', w: 1.25, h: 2.25 * 1.1, u: 0, color: 0xff4455, meta: { target: 'back', label: 'Back' } })

  {
    const colHeight = height

    const pillarW = roundTo(clamp(3.9, 3.0, width - 3.0), 0.05)
    const pillarD = roundTo(clamp(0.35, 0.28, 0.5), 0.05)
    const pillarGeo = new THREE.BoxGeometry(pillarW, colHeight, pillarD)
    const pillarMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      map: pillarMarbleMap,
      bumpMap: pillarMarbleBump,
      bumpScale: 0.06,
      roughness: 0.72,
      metalness: 0.0,
    })
    disposables.push(pillarGeo, pillarMat)

    const pillar = new THREE.Mesh(pillarGeo, pillarMat)
    pillar.name = 'column-center'
    pillar.position.set(0, colHeight / 2, 0)
    group.add(pillar)

    {
      const n = 5
      const z = 0
      const radius = Math.max(0.35, pillarD * 0.48)
      for (let i = 0; i < n; i += 1) {
        const t = n === 1 ? 0.5 : i / (n - 1)
        const x = -pillarW * 0.42 + t * (pillarW * 0.84)
        obstacles.push({ type: 'cylinder', x, z, radius })
      }
    }

    {
      const potH = 0.34
      const potR = 0.22
      const plantH = 0.85

      const potGeo = new THREE.CylinderGeometry(potR, potR * 1.08, potH, 14, 1)
      const potMat = new THREE.MeshStandardMaterial({ color: 0x12161b, roughness: 0.95, metalness: 0.02 })
      const leafGeo = new THREE.ConeGeometry(0.28, plantH, 12, 1)
      const leafMat = new THREE.MeshStandardMaterial({ color: 0x2a8f4a, roughness: 0.9, metalness: 0.0 })
      disposables.push(potGeo, potMat, leafGeo, leafMat)

      const z = -(pillarD / 2 + 0.55)
      const xs = [-pillarW * 0.28, pillarW * 0.28]

      for (const x of xs) {
        const plant = new THREE.Group()
        plant.name = 'gallery-plant'
        plant.position.set(x, 0, z)
        group.add(plant)

        const pot = new THREE.Mesh(potGeo, potMat)
        pot.position.set(0, potH / 2, 0)
        plant.add(pot)

        const leaves = new THREE.Mesh(leafGeo, leafMat)
        leaves.position.set(0, potH + plantH / 2 - 0.02, 0)
        leaves.rotation.x = -0.1
        plant.add(leaves)

        obstacles.push({ type: 'cylinder', x, z, radius: potR + 0.1 })
      }
    }

    const title = typeof gallery.title === 'string' ? gallery.title.trim() : ''
    const description = typeof gallery.description === 'string' ? gallery.description.trim() : ''
    const longExtract = typeof gallery.longExtract === 'string' ? gallery.longExtract.trim() : ''
    const mainThumbnailUrl = typeof gallery.mainThumbnailUrl === 'string' ? gallery.mainThumbnailUrl.trim() : ''

    const panelW = 1.55
    const panelH = 1.55
    const panelY = Math.min(height * 0.47, 1.9)
    const panelZ = pillarD / 2 + 0.08

    const panelGapX = 0.28
    const panelSpan = panelW + panelGapX + 1.55
    const photoX = -panelSpan / 2 + panelW / 2
    const textX = panelSpan / 2 - 1.55 / 2

    const panelDepth = 0.06
    const panelBackGeo = new THREE.BoxGeometry(panelW, panelH, panelDepth)
    const panelBackMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      map: photoFrameBackTex,
      roughness: 0.86,
      metalness: 0.0,
    })
    disposables.push(panelBackGeo, panelBackMat)

    const imgBack = new THREE.Mesh(panelBackGeo, panelBackMat)
    imgBack.position.set(photoX, panelY, panelZ)
    group.add(imgBack)

    const imgGeo = new THREE.PlaneGeometry(panelW, panelH)
    const imgMat = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      depthWrite: false,
      premultipliedAlpha: true,
    })
    const img = new THREE.Mesh(imgGeo, imgMat)
    img.position.set(photoX, panelY, panelZ + panelDepth / 2 + 0.002)
    group.add(img)
    disposables.push(imgGeo, imgMat)

    img.userData.pickable = true
    img.userData.pickableType = 'column-photo'
    img.userData.photoUrl = mainThumbnailUrl || null
    pickableMeshes.push(img)

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
      fitMeshToTextureAspect(imgBack, { baseW: panelW, baseH: panelH, tex })
      disposables.push(tex)
    }

    applyNoPhoto()
    if (mainThumbnailUrl) {
      deferredTextureLoads.push({
        url: mainThumbnailUrl,
        onLoad(tex) {
          tex.colorSpace = THREE.SRGBColorSpace
          tex.premultiplyAlpha = true
          configureGalleryTexture(tex)
          imgMat.map = tex
          imgMat.color.setHex(0xffffff)
          imgMat.needsUpdate = true
          fitMeshToTextureAspect(img, { baseW: panelW, baseH: panelH, tex })
          fitMeshToTextureAspect(imgBack, { baseW: panelW, baseH: panelH, tex })
          disposables.push(tex)
        },
        onError(err) {
          console.warn('[linkwalk] Failed to load gallery image', mainThumbnailUrl, err)
          applyNoPhoto()
        },
      })
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

    function ellipsizeText(ctx, text, maxWidth) {
      const s = String(text || '').trim()
      if (!s) return ''
      if (ctx.measureText(s).width <= maxWidth) return s
      const ell = '…'
      let out = s
      while (out.length > 0 && ctx.measureText(out + ell).width > maxWidth) out = out.slice(0, -1)
      return out.length ? out + ell : ell
    }

    if (descCtx) {
      descCtx.clearRect(0, 0, descCanvas.width, descCanvas.height)
      descCtx.fillStyle = 'rgba(0,0,0,0.28)'
      descCtx.fillRect(0, 0, descCanvas.width, descCanvas.height)


      descCtx.strokeStyle = 'rgba(255,255,255,0.16)'
      descCtx.lineWidth = 10
      descCtx.strokeRect(24, 24, descCanvas.width - 48, descCanvas.height - 48)

      const padX = 64
      let y = 118

      const safeTitle = title || 'Wikipedia'
      descCtx.font = '700 56px system-ui, -apple-system, Segoe UI, Roboto, Arial'
      descCtx.fillStyle = 'rgba(223,255,233,0.98)'
      descCtx.textAlign = 'left'
      descCtx.textBaseline = 'alphabetic'

      const twoCharPad = descCtx.measureText('MM').width
      const titleMaxW = Math.max(10, descCanvas.width - padX * 1.5 - twoCharPad)
      descCtx.fillText(ellipsizeText(descCtx, safeTitle, titleMaxW), padX, y)
      y += 64

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
    const descBack = new THREE.Mesh(descBackGeo, panelMarbleBackMat)
    descBack.position.set(textX, descY, panelZ)
    group.add(descBack)
    disposables.push(descBackGeo)

    descPanel.position.set(textX, descY, panelZ + panelDepth / 2 + 0.002)
    group.add(descPanel)
    disposables.push(descGeo, descTex, descMat)
  }

  {
    const relatedTitles = Array.isArray(gallery.relatedTitles) ? gallery.relatedTitles.filter(Boolean).slice(0, 6) : []
    const n = relatedTitles.length
    if (n > 0) {
      const doorH = 2.25 * 1.1
      const cornerMargin = 1.6
      const cornerUSouth = Math.max(-halfL + 1.0, halfL - cornerMargin)
      const cornerUNorth = Math.min(halfL - 1.0, -halfL + cornerMargin)
      const northCornerUEast = Math.min(halfW - 1.0, halfW - cornerMargin)
      const northCornerUWest = Math.max(-halfW + 1.0, -halfW + cornerMargin)

      if (n >= 1) {
        const title = String(relatedTitles[0])
        addDoor({
          id: 'seealso-0',
          wall: 'east',
          w: 1.1,
          h: doorH,
          u: cornerUSouth,
          meta: { articleTitle: title, label: title },
        })
      }

      if (n >= 2) {
        const title = String(relatedTitles[1])
        addDoor({
          id: 'seealso-1',
          wall: 'west',
          w: 1.1,
          h: doorH,
          u: cornerUSouth,
          meta: { articleTitle: title, label: title },
        })
      }

      if (n >= 3) {
        const title = String(relatedTitles[2])
        addDoor({
          id: 'seealso-2',
          wall: 'east',
          w: 1.1,
          h: doorH,
          u: cornerUNorth,
          meta: { articleTitle: title, label: title },
        })
      }

      if (n >= 4) {
        const title = String(relatedTitles[3])
        addDoor({
          id: 'seealso-3',
          wall: 'west',
          w: 1.1,
          h: doorH,
          u: cornerUNorth,
          meta: { articleTitle: title, label: title },
        })
      }

      if (n >= 5) {
        const title = String(relatedTitles[4])
        addDoor({
          id: 'seealso-4',
          wall: 'north',
          w: 1.1,
          h: doorH,
          u: northCornerUEast,
          meta: { articleTitle: title, label: title },
        })
      }

      if (n >= 6) {
        const title = String(relatedTitles[5])
        addDoor({
          id: 'seealso-5',
          wall: 'north',
          w: 1.1,
          h: doorH,
          u: northCornerUWest,
          meta: { articleTitle: title, label: title },
        })
      }

      const remaining = relatedTitles.slice(6)
      const rn = remaining.length
      if (rn > 0) {
        const wall = 'north'
        const gapU = 0.22
        const usable = Math.max(1.0, width - 2.0)
        const doorW = clamp((usable - (rn - 1) * gapU) / rn, 0.45, 1.25)
        const totalSpan = rn * doorW + (rn - 1) * gapU
        const uStart = -totalSpan / 2 + doorW / 2

        for (let i = 0; i < rn; i += 1) {
          const u = uStart + i * (doorW + gapU)
          const title = String(remaining[i])
          addDoor({
            id: `seealso-${i + 6}`,
            wall,
            w: doorW,
            h: doorH,
            u,
            meta: { articleTitle: title, label: title },
          })
        }
      }
    }
  }

  {
    const trailRaw = Array.isArray(gallery?.trail) ? gallery.trail : []
    const trail = trailRaw
      .map((t) => (typeof t === 'string' ? t.trim() : ''))
      .filter(Boolean)
      .slice(-3)

    const fallbackTitle = typeof gallery?.title === 'string' ? gallery.title.trim() : ''
    const steps = trail.length ? trail : (fallbackTitle ? [fallbackTitle] : [])

    if (steps.length > 0) {


      const textGapU = 0.65
      const textMargin = 1.6
      const textUsable = Math.max(2.8, length - textMargin * 2)
      const textPanelW = clamp((textUsable - textGapU) / 2, 1.7, 3.4)
      const desiredBoardW = 2 * textPanelW


      const shrunkBoardW = desiredBoardW * 0.8



      const northDoorW = 1.1
      const cornerMargin = 1.6
      const doorCenterAbs = Math.max(0, halfW - cornerMargin)
      const doorInnerEdgeAbs = Math.max(0, doorCenterAbs - northDoorW / 2)
      const clearanceGap = 0.55
      const maxBetweenDoors = Math.max(2.4, 2 * (doorInnerEdgeAbs - clearanceGap))

      const boardW = roundTo(clamp(shrunkBoardW, 2.4, maxBetweenDoors), 0.05)
      const boardH = roundTo(clamp(height * 0.46, 1.35, 2.15), 0.05)
      const boardDepth = 0.08

      const innerNorthZ = -halfL + wallThickness / 2


      const photoCount = 4
      const photoMargin = 1.75
      const photoGapU = 0.5
      const photoUsable = Math.max(2.8, length - photoMargin * 2)

      const stdFrameH = roundTo(clamp(height * 0.36, 1.05, 1.35), 0.05)
      const stdFrameW = roundTo(stdFrameH * 0.707, 0.05)
      const photoAspect = stdFrameW / stdFrameH

      let photoW = clamp((photoUsable - (photoCount - 1) * photoGapU) / photoCount, 0.65, 1.35)
      let photoH = photoW / photoAspect
      const maxPhotoH = clamp(height * 0.5, 1.15, 1.85)
      if (photoH > maxPhotoH) {
        photoH = maxPhotoH
        photoW = photoH * photoAspect
      }

      const stdFrameY = height * 0.5
      const photoY = clamp(stdFrameY, photoH / 2 + 0.25, height - photoH / 2 - 0.25)
      const photoTopY = photoY + photoH / 2


      const boardY = clamp(photoTopY - boardH / 2, boardH / 2 + 0.25, height - boardH / 2 - 0.25)
      const boardCenter = new THREE.Vector3(0, boardY, innerNorthZ + boardDepth / 2 + 0.01)

      const canvas = document.createElement('canvas')
      canvas.width = 2048
      canvas.height = 768
      const ctx2 = canvas.getContext('2d')

      if (ctx2) {
        ctx2.clearRect(0, 0, canvas.width, canvas.height)

        ctx2.fillStyle = 'rgba(0,0,0,0.28)'
        ctx2.fillRect(0, 0, canvas.width, canvas.height)


        ctx2.strokeStyle = 'rgba(255,255,255,0.16)'
        ctx2.lineWidth = 14
        ctx2.strokeRect(18, 18, canvas.width - 36, canvas.height - 36)

        const padX = 90
        const padY = 70
        const cols = steps.length
        const colW = (canvas.width - padX * 2) / cols

        function ellipsize(text, maxWidth) {
          const s = String(text || '').trim()
          if (!s) return ''
          if (ctx2.measureText(s).width <= maxWidth) return s
          const ell = '…'
          let out = s
          while (out.length > 0 && ctx2.measureText(out + ell).width > maxWidth) out = out.slice(0, -1)
          return out.length ? out + ell : ell
        }


        ctx2.textAlign = 'center'
        ctx2.textBaseline = 'alphabetic'

        const titleFont = '800 58px system-ui, -apple-system, Segoe UI, Roboto, Arial'
        const hereFont = '900 44px system-ui, -apple-system, Segoe UI, Roboto, Arial'
        const titleY = padY + 84
        const hereY = padY + 34

        for (let i = 0; i < cols; i += 1) {
          const cx = padX + colW * (i + 0.5)
          const isLast = i === cols - 1

          if (isLast) {
            ctx2.font = hereFont
            ctx2.fillStyle = 'rgba(223,255,233,0.96)'
            ctx2.fillText('YOU ARE HERE', cx, hereY)
          }

          ctx2.font = titleFont
          ctx2.fillStyle = 'rgba(255,255,255,0.9)'
          const maxW = colW * 0.92
          ctx2.fillText(ellipsize(steps[i], maxW), cx, titleY)
        }


        const boxSize = 86
        const midY = Math.round(canvas.height * 0.62)
        const arrowY = midY

        ctx2.lineWidth = 10
        ctx2.strokeStyle = 'rgba(255,255,255,0.7)'
        ctx2.fillStyle = 'rgba(255,255,255,0.7)'

        const centers = []
        for (let i = 0; i < cols; i += 1) {
          const cx = padX + colW * (i + 0.5)
          centers.push(cx)
          ctx2.strokeRect(cx - boxSize / 2, arrowY - boxSize / 2, boxSize, boxSize)
        }

        function drawArrow(x1, x2) {
          const y = arrowY
          const start = x1 + boxSize / 2 + 26
          const end = x2 - boxSize / 2 - 26
          if (end <= start) return

          ctx2.beginPath()
          ctx2.moveTo(start, y)
          ctx2.lineTo(end, y)
          ctx2.stroke()

          const head = 16
          ctx2.beginPath()
          ctx2.moveTo(end, y)
          ctx2.lineTo(end - head, y - head * 0.7)
          ctx2.lineTo(end - head, y + head * 0.7)
          ctx2.closePath()
          ctx2.fill()
        }

        for (let i = 0; i < centers.length - 1; i += 1) {
          drawArrow(centers[i], centers[i + 1])
        }
      }

      const tex = new THREE.CanvasTexture(canvas)
      tex.colorSpace = THREE.SRGBColorSpace
      configureGalleryTexture(tex)
      tex.needsUpdate = true

      const boardGroup = new THREE.Group()
      boardGroup.name = 'gallery-trail-whiteboard'
      boardGroup.position.copy(boardCenter)

      const backGeo = new THREE.BoxGeometry(boardW, boardH, boardDepth)
      const back = new THREE.Mesh(backGeo, panelMarbleBackMat)
      back.position.set(0, 0, 0)
      boardGroup.add(back)
      disposables.push(backGeo)

      const faceGeo = new THREE.PlaneGeometry(boardW * 0.98, boardH * 0.98)
      const faceMat = new THREE.MeshBasicMaterial({ map: tex, transparent: true })
      const face = new THREE.Mesh(faceGeo, faceMat)
      face.position.set(0, 0, boardDepth / 2 + 0.002)
      boardGroup.add(face)
      disposables.push(tex, faceGeo, faceMat)


      boardGroup.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), new THREE.Vector3(0, 0, 1))
      group.add(boardGroup)
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
        addSlot({ id: frameId, wall, kind: 'frame', w: frameW, h: frameH, y, u, color: 0xd9d9de, opacity: 1 })
        if (withPlaques) {
          addSlot({ id: `${wall}-plaque-${idx}`, wall, kind: 'plaque', w: stdPlaqueW, h: stdPlaqueH, y: stdPlaqueY, u, color: 0xffff88 })
        }

        idx += 1
      }
    }
  }

  if (mode === 'lobby') {
    addGridWallSlots('east')
    addGridWallSlots('west')
  } else {
    {
      const count = 4
      const margin = 1.75
      const gapU = 0.5
      const usable = Math.max(2.8, length - margin * 2)

      const aspect = stdFrameW / stdFrameH
      let photoW = clamp((usable - (count - 1) * gapU) / count, 0.65, 1.35)
      let photoH = photoW / aspect

      const maxPhotoH = clamp(height * 0.5, 1.15, 1.85)
      if (photoH > maxPhotoH) {
        photoH = maxPhotoH
        photoW = photoH * aspect
      }

      const y = clamp(stdFrameY, photoH / 2 + 0.25, height - photoH / 2 - 0.25)
      const totalW = count * photoW + (count - 1) * gapU
      const uStart = -totalW / 2 + photoW / 2

      for (let i = 0; i < count; i += 1) {
        const u = uStart + i * (photoW + gapU)
        addSlot({ id: `east-photo-${i}`, wall: 'east', kind: 'frame', w: photoW, h: photoH, y, u, color: 0xd9d9de, opacity: 1 })
      }
    }

    {
      const gapU = 0.65
      const margin = 1.6
      const usable = Math.max(2.8, length - margin * 2)
      const panelW = clamp((usable - gapU) / 2, 1.7, 3.4)
      const panelH = clamp(height * 0.55, 1.35, 2.05)
      const y = clamp(stdFrameY, panelH / 2 + 0.25, height - panelH / 2 - 0.25)

      const uNeg = -(panelW / 2 + gapU / 2)
      const uPos = panelW / 2 + gapU / 2

      addSlot({ id: 'west-text-0', wall: 'west', kind: 'frame', w: panelW, h: panelH, y, u: uPos, color: 0xd9d9de, opacity: 1 })
      addSlot({ id: 'west-text-1', wall: 'west', kind: 'frame', w: panelW, h: panelH, y, u: uNeg, color: 0xd9d9de, opacity: 1 })
    }
  }

  if (mode !== 'lobby') {
    {
      const innerNorthZ = -halfL + wallThickness / 2
      const benchZ = innerNorthZ + 0.42
      const plantZ = innerNorthZ + 0.38

      const decoNorth = new THREE.Group()
      decoNorth.name = 'deco-north'
      group.add(decoNorth)

      const decoSouth = new THREE.Group()
      decoSouth.name = 'deco-south'
      group.add(decoSouth)

      const woodMat = new THREE.MeshStandardMaterial({
        color: 0xffffff,
        map: benchWoodMap,
        bumpMap: benchWoodBump,
        bumpScale: 0.045,
        roughness: 0.58,
        metalness: 0.0,
      })
      const metalMat = new THREE.MeshStandardMaterial({ color: 0x0d1015, roughness: 0.7, metalness: 0.05 })
      const potMat = new THREE.MeshStandardMaterial({ color: 0x0d1015, roughness: 0.95, metalness: 0.0 })
      const leafMat = new THREE.MeshStandardMaterial({ color: 0x2f6f4e, roughness: 0.85, metalness: 0.0, side: THREE.DoubleSide })
      disposables.push(woodMat, metalMat, potMat, leafMat)

      const bench = new THREE.Group()
      bench.name = 'bench'
      bench.position.set(0, 0, benchZ)
      decoNorth.add(bench)

      const seatW = 2.6
      const seatD = 0.55
      const seatH = 0.12
      const seatY = 0.46

      const seatGeo = new THREE.BoxGeometry(seatW, seatH, seatD)
      const seat = new THREE.Mesh(seatGeo, woodMat)
      seat.position.set(0, seatY, 0)
      bench.add(seat)
      disposables.push(seatGeo)

      const backW = seatW
      const backH = 0.55
      const backD = 0.08
      const backGeo = new THREE.BoxGeometry(backW, backH, backD)
      const back = new THREE.Mesh(backGeo, woodMat)
      back.position.set(0, seatY + backH / 2 - 0.02, -(seatD / 2 - backD / 2))
      bench.add(back)
      disposables.push(backGeo)

      const legW = 0.08
      const legD = 0.08
      const legH = seatY - seatH / 2
      const legGeo = new THREE.BoxGeometry(legW, legH, legD)
      disposables.push(legGeo)

      function addLeg(x, z) {
        const leg = new THREE.Mesh(legGeo, metalMat)
        leg.position.set(x, legH / 2, z)
        bench.add(leg)
      }

      const legX = seatW / 2 - 0.18
      const legZ = seatD / 2 - 0.18
      addLeg(-legX, -legZ)
      addLeg(legX, -legZ)
      addLeg(-legX, legZ)
      addLeg(legX, legZ)

      obstacles.push({ type: 'cylinder', x: -seatW * 0.28, z: benchZ + 0.02, radius: 0.5 })
      obstacles.push({ type: 'cylinder', x: seatW * 0.28, z: benchZ + 0.02, radius: 0.5 })

      const potRTop = 0.19
      const potRBottom = 0.24
      const potH = 0.34
      const potGeo = new THREE.CylinderGeometry(potRTop, potRBottom, potH, 14, 1)
      const soilGeo = new THREE.CylinderGeometry(potRTop * 0.92, potRTop * 0.92, 0.06, 14, 1)
      const leafGeo = new THREE.PlaneGeometry(0.38, 0.7)
      disposables.push(potGeo, soilGeo, leafGeo)

      function addPlant(x) {
        const plant = new THREE.Group()
        plant.name = 'plant'
        plant.position.set(x, 0, plantZ)
        decoNorth.add(plant)

        const pot = new THREE.Mesh(potGeo, potMat)
        pot.position.set(0, potH / 2, 0)
        plant.add(pot)

        const soil = new THREE.Mesh(soilGeo, potMat)
        soil.position.set(0, potH - 0.02, 0)
        plant.add(soil)

        const leaves = new THREE.Group()
        leaves.position.set(0, potH + 0.05, 0)
        plant.add(leaves)

        const leafCount = 10
        for (let i = 0; i < leafCount; i += 1) {
          const leaf = new THREE.Mesh(leafGeo, leafMat)
          const a = (i / leafCount) * Math.PI * 2
          leaf.rotation.y = a
          leaf.rotation.x = -0.25 - Math.random() * 0.25
          leaf.position.set(0, 0.25 + Math.random() * 0.12, 0)
          leaves.add(leaf)
        }

        obstacles.push({ type: 'cylinder', x, z: plantZ, radius: 0.38 })
      }

      const plantX = seatW / 2 + 0.7
      addPlant(-plantX)
      addPlant(plantX)

      {
        const innerSouthZ = halfL - wallThickness / 2
        const benchZSouth = innerSouthZ - 0.42
        const plantZSouth = innerSouthZ - 0.38

        const doorW = 1.25
        const doorHalf = doorW / 2
        const benchGap = 0.6

        const maxBenchCenterX = halfW - seatW / 2 - 0.35
        const benchCenterX = clamp(doorHalf + seatW / 2 + benchGap, 0.9, maxBenchCenterX)

        const maxPlantX = halfW - 0.6
        const plantXSouth = clamp(benchCenterX + seatW / 2 + 0.7, 1.2, maxPlantX)

        function addBenchSouth(x) {
          const b = new THREE.Group()
          b.name = 'bench-south'
          b.position.set(x, 0, benchZSouth)
          b.rotation.y = Math.PI
          decoSouth.add(b)

          const s = new THREE.Mesh(seatGeo, woodMat)
          s.position.set(0, seatY, 0)
          b.add(s)

          const bk = new THREE.Mesh(backGeo, woodMat)
          bk.position.set(0, seatY + backH / 2 - 0.02, -(seatD / 2 - backD / 2))
          b.add(bk)

          function addLegToBench(lx, lz) {
            const leg = new THREE.Mesh(legGeo, metalMat)
            leg.position.set(lx, legH / 2, lz)
            b.add(leg)
          }
          addLegToBench(-legX, -legZ)
          addLegToBench(legX, -legZ)
          addLegToBench(-legX, legZ)
          addLegToBench(legX, legZ)

          obstacles.push({ type: 'cylinder', x: x - seatW * 0.28, z: benchZSouth + 0.02, radius: 0.5 })
          obstacles.push({ type: 'cylinder', x: x + seatW * 0.28, z: benchZSouth + 0.02, radius: 0.5 })
        }

        function addPlantSouth(x) {
          const plant = new THREE.Group()
          plant.name = 'plant-south'
          plant.position.set(x, 0, plantZSouth)
          decoSouth.add(plant)

          const pot = new THREE.Mesh(potGeo, potMat)
          pot.position.set(0, potH / 2, 0)
          plant.add(pot)

          const soil = new THREE.Mesh(soilGeo, potMat)
          soil.position.set(0, potH - 0.02, 0)
          plant.add(soil)

          const leaves = new THREE.Group()
          leaves.position.set(0, potH + 0.05, 0)
          plant.add(leaves)

          const leafCount = 10
          for (let i = 0; i < leafCount; i += 1) {
            const leaf = new THREE.Mesh(leafGeo, leafMat)
            const a = (i / leafCount) * Math.PI * 2
            leaf.rotation.y = a
            leaf.rotation.x = -0.25 - Math.random() * 0.25
            leaf.position.set(0, 0.25 + Math.random() * 0.12, 0)
            leaves.add(leaf)
          }

          obstacles.push({ type: 'cylinder', x, z: plantZSouth, radius: 0.38 })
        }

        addPlantSouth(-plantXSouth)
        addBenchSouth(-benchCenterX)
        addBenchSouth(benchCenterX)
        addPlantSouth(plantXSouth)
      }
    }

    const wallPanelDepth = 0.06
    const wallBackMat = new THREE.MeshStandardMaterial({ color: 0x0d1015, roughness: 0.95, metalness: 0.0 })
    const wallFrameBackMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      map: photoFrameBackTex,
      roughness: 0.86,
      metalness: 0.0,
    })
    disposables.push(wallBackMat, wallFrameBackMat)

    function isSupportedImageUrl(url) {
      const raw = typeof url === 'string' ? url.trim() : ''
      if (!raw) return false

      const blocked = new Set(['ogv', 'oga', 'ogg', 'webm', 'mp4', 'm4v', 'mp3', 'wav', 'flac', 'pdf', 'djvu', 'tif', 'tiff'])
      const allowed = new Set(['jpg', 'jpeg', 'png', 'gif', 'webp', 'avif', 'svg'])

      try {
        const u = new URL(raw)
        const file = (u.pathname.split('/').pop() ?? '').split('?')[0]
        const m = file.match(/\.([a-z0-9]+)$/i)
        const ext = m?.[1] ? String(m[1]).toLowerCase() : ''
        if (!ext) return true
        if (blocked.has(ext)) return false
        return allowed.has(ext)
      } catch {
        const file = raw.split('/').pop() ?? raw
        const clean = (file.split('?')[0] ?? file).trim()
        const m = clean.match(/\.([a-z0-9]+)$/i)
        const ext = m?.[1] ? String(m[1]).toLowerCase() : ''
        if (!ext) return true
        if (blocked.has(ext)) return false
        return allowed.has(ext)
      }
    }

    const photos = Array.isArray(gallery.photos)
      ? gallery.photos
          .map((u) => (typeof u === 'string' ? u.trim() : ''))
          .filter(Boolean)
      : []

    const imagePhotos = photos.filter(isSupportedImageUrl)

    const relatedTitles = Array.isArray(gallery.relatedTitles)
      ? gallery.relatedTitles
          .map((t) => (typeof t === 'string' ? t.trim() : ''))
          .filter(Boolean)
      : []

    const description = typeof gallery.description === 'string' ? gallery.description.trim() : ''
    const longExtract = typeof gallery.longExtract === 'string' ? gallery.longExtract.trim() : ''

    function slotFrontOffset(slot, extra = 0.002) {
      const normal = slot.normal.clone().normalize()
      return { normal, backOffset: wallPanelDepth / 2 + extra, frontOffset: wallPanelDepth + extra * 2 }
    }

    function ensureOutlineInFront(slot) {
      if (!slot?.outlineObject) return
      const { normal, frontOffset } = slotFrontOffset(slot, 0.003)
      slot.outlineObject.position.copy(slot.center).add(normal.clone().multiplyScalar(frontOffset))
    }

    function addBackplate({ center, normal, w, h, depth = wallPanelDepth, mat = wallBackMat }) {
      const geo = new THREE.BoxGeometry(w, h, depth)
      const mesh = new THREE.Mesh(geo, mat)
      mesh.position.copy(center).add(normal.clone().multiplyScalar(depth / 2 + 0.002))
      mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), normal)
      group.add(mesh)
      disposables.push(geo)
      return mesh
    }

    function slotById(id) {
      return slots.find((s) => s && s.id === id) || null
    }

    function placePhotoInSlot(slot, url, { placeholderTitle = 'NO PHOTO' } = {}) {
      if (!slot) return

      const baseW = slot.width * 0.96
      const baseH = slot.height * 0.96
      const { normal, frontOffset } = slotFrontOffset(slot)
      const backplate = addBackplate({ center: slot.center, normal, w: baseW, h: baseH, mat: wallFrameBackMat })

      ensureOutlineInFront(slot)

      const geo = new THREE.PlaneGeometry(1, 1)
      const mat = new THREE.MeshBasicMaterial({
        color: 0xffffff,
        transparent: true,
        depthWrite: false,
        premultipliedAlpha: true,
      })
      const mesh = new THREE.Mesh(geo, mat)
      mesh.scale.set(baseW, baseH, 1)
      mesh.position.copy(slot.center).add(normal.clone().multiplyScalar(frontOffset + 0.004))
      mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), normal)
      group.add(mesh)
      disposables.push(geo, mat)

      mesh.userData = {
        ...(mesh.userData || {}),
        pickable: true,
        pickableType: 'wall-photo',
        photoUrl: url || null,
      }
      pickableMeshes.push(mesh)

      function applyTexture(tex) {
        if (!tex) return
        tex.colorSpace = THREE.SRGBColorSpace
        tex.premultiplyAlpha = true
        configureGalleryTexture(tex)
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
          backplate.scale.set(sx, sy, 1)
        }

        disposables.push(tex)
      }


      applyTexture(makeNoPhotoTexture({ size: 1024, title: placeholderTitle }))
      if (url) {
        deferredTextureLoads.push({
          url,
          onLoad: (tex) => applyTexture(tex),
          onError: (err) => {
            console.warn('[linkwalk] Failed to load wall photo', url, err)
            applyTexture(makeNoPhotoTexture({ size: 1024, title: placeholderTitle }))
          },
        })
      }
    }

    function labelFromImageUrl(url) {
      const raw = typeof url === 'string' ? url.trim() : ''
      if (!raw) return ''
      try {
        const file = raw.split('/').pop() ?? ''
        const decoded = decodeURIComponent(file)
        const withoutQuery = decoded.split('?')[0] ?? decoded
        const withoutExt = withoutQuery.replace(/\.(jpg|jpeg|png|webp|gif|avif|svg)$/i, '')
        const cleaned = withoutExt.replace(/^File:/i, '').replace(/_/g, ' ').trim()
        return cleaned
      } catch {
        return ''
      }
    }

    function makePlaqueTexture({ size = 1024, text, aspect } = {}) {
      const maxW = typeof size === 'number' && Number.isFinite(size) ? Math.max(256, Math.floor(size)) : 1024
      const a = typeof aspect === 'number' && Number.isFinite(aspect) && aspect > 0 ? aspect : null

      let canvasW = maxW
      let canvasH = Math.floor(maxW * 0.33)
      if (a) {
        canvasH = Math.round(canvasW / a)
        canvasH = Math.max(160, Math.min(512, canvasH))
        canvasW = Math.round(canvasH * a)
        if (canvasW > maxW) {
          canvasW = maxW
          canvasH = Math.round(canvasW / a)
        }
      }

      const canvas = document.createElement('canvas')
      canvas.width = canvasW
      canvas.height = canvasH
      const ctx = canvas.getContext('2d')
      if (ctx) {
        ctx.clearRect(0, 0, canvas.width, canvas.height)
        ctx.fillStyle = '#12161b'
        ctx.fillRect(0, 0, canvas.width, canvas.height)

        ctx.strokeStyle = 'rgba(255,255,255,0.18)'
        ctx.lineWidth = Math.max(6, Math.floor(canvas.width * 0.008))
        const pad = Math.max(14, Math.floor(canvas.width * 0.018))
        ctx.strokeRect(pad, pad, canvas.width - pad * 2, canvas.height - pad * 2)

        const safeText = String(text || '').trim() || 'Untitled'
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        ctx.fillStyle = 'rgba(255,255,255,0.92)'

        const maxWidth = canvas.width * 0.86
        let fontSize = Math.floor(canvas.width * 0.06)
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
      configureGalleryTexture(tex)
      tex.needsUpdate = true
      return tex
    }

    function placeCaptionUnderSlot(slot, caption) {
      if (!slot) return

      const plaqueW = slot.width * 0.92
      const plaqueH = Math.min(0.28, slot.height * 0.22)
      const gapFromPhoto = 0.04
      const { normal, frontOffset } = slotFrontOffset(slot)
      const backCenter = new THREE.Vector3(slot.center.x, slot.center.y - slot.height / 2 - plaqueH / 2 - gapFromPhoto, slot.center.z)
      addBackplate({ center: backCenter, normal, w: plaqueW, h: plaqueH })

      const geo = new THREE.PlaneGeometry(plaqueW, plaqueH)
      const mat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true })
      const mesh = new THREE.Mesh(geo, mat)

      const y = slot.center.y - slot.height / 2 - plaqueH / 2 - gapFromPhoto
      mesh.position.set(slot.center.x, y, slot.center.z)
      mesh.position.add(normal.clone().multiplyScalar(frontOffset + 0.004))
      mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), normal)

      group.add(mesh)
      disposables.push(geo, mat)

      const tex = makePlaqueTexture({ size: 1024, text: caption, aspect: plaqueW / plaqueH })
      mat.map = tex
      mat.color.setHex(0xffffff)
      mat.needsUpdate = true
      disposables.push(tex)
    }

    function placePhotoWithCaption(slot, url) {
      const safeUrl = isSupportedImageUrl(url) ? url : null
      placePhotoInSlot(slot, safeUrl, { placeholderTitle: 'NO PHOTO' })
      const label = labelFromImageUrl(safeUrl)
      placeCaptionUnderSlot(slot, label || (safeUrl ? 'Untitled' : 'No photo'))
    }

    function makeWallTextTexture({ size = 1024, title, text, aspect, startLine = 0, withTitle = true } = {}) {
      const maxW = typeof size === 'number' && Number.isFinite(size) ? Math.max(512, Math.floor(size)) : 1024
      const a = typeof aspect === 'number' && Number.isFinite(aspect) && aspect > 0 ? aspect : null

      let canvasW = maxW
      let canvasH = maxW
      if (a) {
        canvasH = Math.round(canvasW / a)
        canvasH = Math.max(640, Math.min(1600, canvasH))
        canvasW = Math.round(canvasH * a)
        if (canvasW > maxW) {
          canvasW = maxW
          canvasH = Math.round(canvasW / a)
        }
      }

      const canvas = document.createElement('canvas')
      canvas.width = canvasW
      canvas.height = canvasH
      const ctx = canvas.getContext('2d')

      let nextLine = Math.max(0, Math.floor(startLine || 0))

      if (ctx) {
        ctx.clearRect(0, 0, canvas.width, canvas.height)
        ctx.fillStyle = 'rgba(0,0,0,0.28)'
        ctx.fillRect(0, 0, canvas.width, canvas.height)

        ctx.strokeStyle = 'rgba(255,255,255,0.16)'
        ctx.lineWidth = Math.max(6, Math.floor(size * 0.01))
        ctx.strokeRect(24, 24, canvas.width - 48, canvas.height - 48)

        const pad = 52
        let y = pad + 10

        const safeTitle = String(title || 'Wikipedia')
        ctx.textAlign = 'left'
        ctx.textBaseline = 'alphabetic'

        if (withTitle) {
          ctx.fillStyle = 'rgba(223,255,233,0.96)'
          ctx.font = `800 ${Math.floor(maxW * 0.072)}px system-ui, -apple-system, Segoe UI, Roboto, Arial`
          const titleMaxWidth = canvas.width - pad * 1.5
          const ell = '…'
          const twoCharPad = ctx.measureText('MM').width
          const maxTitleW = Math.max(10, titleMaxWidth - twoCharPad)

          let titleOut = safeTitle
          if (ctx.measureText(titleOut).width > maxTitleW) {
            while (titleOut.length > 0 && ctx.measureText(titleOut + ell).width > maxTitleW) titleOut = titleOut.slice(0, -1)
            titleOut = titleOut.length ? titleOut + ell : ell
          }

          ctx.fillText(titleOut, pad, y)
          y += Math.floor(maxW * 0.09)
        }

        const bodyFontSize = Math.floor(maxW * 0.038)
        ctx.font = `600 ${bodyFontSize}px system-ui, -apple-system, Segoe UI, Roboto, Arial`
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
        const lineHeight = Math.floor(bodyFontSize * 1.28)

        const allLines = []
        const paragraphs = safeText ? safeText.split(/\n{2,}/g) : ['No additional info']
        for (const para of paragraphs) {
          const trimmed = String(para || '').trim()
          if (!trimmed) continue
          const lines = wrapText(trimmed, maxWidth)
          for (const line of lines) allLines.push(line)
          allLines.push('')
        }
        while (allLines.length > 0 && allLines[allLines.length - 1] === '') allLines.pop()

        let i = nextLine
        while (i < allLines.length) {
          const line = allLines[i]
          if (line) {
            ctx.fillText(line, pad, y)
            y += lineHeight
          } else {
            y += Math.floor(lineHeight * 0.55)
          }

          if (y > canvas.height - pad) {
            i += 1
            break
          }

          i += 1
        }

        nextLine = i
      }

      const tex = new THREE.CanvasTexture(canvas)
      tex.colorSpace = THREE.SRGBColorSpace
      configureGalleryTexture(tex)
      tex.needsUpdate = true
      return { tex, nextLine }
    }

    function placeTextInSlot(slot, { title, text, startLine = 0, withTitle = true } = {}) {
      if (!slot) return

      const baseW = slot.width * 0.96
      const baseH = slot.height * 0.96

      const { normal, frontOffset } = slotFrontOffset(slot)

      addBackplate({ center: slot.center, normal, w: baseW, h: baseH, mat: panelMarbleBackMat })
      ensureOutlineInFront(slot)

      const geo = new THREE.PlaneGeometry(baseW, baseH)
      const mat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true })
      const mesh = new THREE.Mesh(geo, mat)

      mesh.position.copy(slot.center).add(normal.clone().multiplyScalar(frontOffset + 0.004))
      mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), normal)

      group.add(mesh)
      disposables.push(geo, mat)

      const { tex, nextLine } = makeWallTextTexture({ size: 1024, title, text, aspect: baseW / baseH, startLine, withTitle })
      mat.map = tex
      mat.color.setHex(0xffffff)
      mat.needsUpdate = true
      disposables.push(tex)

      return nextLine
    }

    {
      const eastPhotoSlots = [slotById('east-photo-0'), slotById('east-photo-1'), slotById('east-photo-2'), slotById('east-photo-3')]
      const shuffled = [...imagePhotos]
      for (let i = shuffled.length - 1; i > 0; i -= 1) {
        const j = Math.floor(Math.random() * (i + 1))
        const tmp = shuffled[i]
        shuffled[i] = shuffled[j]
        shuffled[j] = tmp
      }

      for (let i = 0; i < eastPhotoSlots.length; i += 1) {
        placePhotoWithCaption(eastPhotoSlots[i], shuffled[i] ?? null)
      }
    }

    {
      const galleryTitle = typeof gallery.title === 'string' ? gallery.title.trim() : ''
      const source = (longExtract || description || '').trim() || 'No additional info available'

      const panel0 = slotById('west-text-0')
      const panel1 = slotById('west-text-1')

      const nextLine = placeTextInSlot(panel0, { title: galleryTitle || 'Wikipedia', text: source, startLine: 0, withTitle: true })
      placeTextInSlot(panel1, { title: galleryTitle || 'Wikipedia', text: source, startLine: nextLine || 0, withTitle: false })
    }
  }

  group.add(markers)

  return {
    group,
    disposables,
    deferredTextureLoads,
    slots,
    doors,
    doorHitMeshes,
    pickableMeshes,
    obstacles,
    bounds: {
      halfW,
      halfL,
      height,
    },
  }
}
