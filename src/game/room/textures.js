import * as THREE from 'three'

function seededRand(seed) {
  let s = (seed >>> 0) || 1
  return function rand() {
    s ^= s << 13
    s ^= s >>> 17
    s ^= s << 5
    return (s >>> 0) / 0xffffffff
  }
}

export function makeWoodFloorTextures({ size = 1024 } = {}) {
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')

  const bump = document.createElement('canvas')
  bump.width = size
  bump.height = size
  const bctx = bump.getContext('2d')

  const rand = seededRand(0x51f00d)

  if (ctx) {
    // Base warm brown.
    ctx.fillStyle = '#6a4a2e'
    ctx.fillRect(0, 0, size, size)

    const plankW = Math.floor(size * 0.13)
    const gap = Math.max(2, Math.floor(size * 0.004))
    const grainLines = Math.floor(size * 0.65)

    for (let x = 0; x < size; x += plankW) {
      const t = rand()
      const hue = 28 + Math.floor(t * 10)
      const sat = 30 + Math.floor(rand() * 12)
      const light = 22 + Math.floor(rand() * 10)
      ctx.fillStyle = `hsl(${hue} ${sat}% ${light}%)`
      ctx.fillRect(x, 0, plankW - gap, size)

      // Plank seams.
      ctx.fillStyle = 'rgba(0,0,0,0.35)'
      ctx.fillRect(x + plankW - gap, 0, gap, size)

      // Subtle plank highlight.
      const grad = ctx.createLinearGradient(x, 0, x + plankW, 0)
      grad.addColorStop(0.0, 'rgba(255,255,255,0.06)')
      grad.addColorStop(0.5, 'rgba(255,255,255,0.00)')
      grad.addColorStop(1.0, 'rgba(0,0,0,0.05)')
      ctx.fillStyle = grad
      ctx.fillRect(x, 0, plankW - gap, size)

      // Knots.
      const knots = 1 + Math.floor(rand() * 2)
      for (let k = 0; k < knots; k += 1) {
        const cx = x + Math.floor(rand() * (plankW - gap))
        const cy = Math.floor(rand() * size)
        const r = Math.max(8, Math.floor(size * (0.012 + rand() * 0.012)))
        ctx.strokeStyle = 'rgba(0,0,0,0.24)'
        ctx.lineWidth = Math.max(2, Math.floor(r * 0.12))
        ctx.beginPath()
        ctx.ellipse(cx, cy, r, r * (0.65 + rand() * 0.25), rand() * Math.PI, 0, Math.PI * 2)
        ctx.stroke()
      }
    }

    // Grain.
    ctx.globalAlpha = 0.18
    ctx.strokeStyle = '#2b1a10'
    ctx.lineWidth = 1
    for (let i = 0; i < grainLines; i += 1) {
      const y = Math.floor(rand() * size)
      const wobble = (rand() - 0.5) * 10
      ctx.beginPath()
      ctx.moveTo(0, y)
      ctx.bezierCurveTo(size * 0.33, y + wobble, size * 0.66, y - wobble, size, y + wobble * 0.5)
      ctx.stroke()
    }
    ctx.globalAlpha = 1

    // Slight vignette for depth.
    const v = ctx.createRadialGradient(size / 2, size / 2, size * 0.1, size / 2, size / 2, size * 0.75)
    v.addColorStop(0, 'rgba(255,255,255,0.02)')
    v.addColorStop(1, 'rgba(0,0,0,0.10)')
    ctx.fillStyle = v
    ctx.fillRect(0, 0, size, size)
  }

  if (bctx) {
    // Bump: plank seams + noise.
    bctx.fillStyle = 'rgb(128,128,128)'
    bctx.fillRect(0, 0, size, size)

    const plankW = Math.floor(size * 0.13)
    const gap = Math.max(2, Math.floor(size * 0.004))

    bctx.fillStyle = 'rgb(92,92,92)'
    for (let x = 0; x < size; x += plankW) {
      bctx.fillRect(x + plankW - gap, 0, gap, size)
    }

    const img = bctx.getImageData(0, 0, size, size)
    const d = img.data
    for (let i = 0; i < d.length; i += 4) {
      const n = (rand() - 0.5) * 18
      d[i] = Math.max(0, Math.min(255, d[i] + n))
      d[i + 1] = d[i]
      d[i + 2] = d[i]
      d[i + 3] = 255
    }
    bctx.putImageData(img, 0, 0)
  }

  const mapTex = new THREE.CanvasTexture(canvas)
  mapTex.colorSpace = THREE.SRGBColorSpace
  mapTex.wrapS = THREE.RepeatWrapping
  mapTex.wrapT = THREE.RepeatWrapping

  const bumpTex = new THREE.CanvasTexture(bump)
  if (typeof THREE.NoColorSpace !== 'undefined') bumpTex.colorSpace = THREE.NoColorSpace
  bumpTex.wrapS = THREE.RepeatWrapping
  bumpTex.wrapT = THREE.RepeatWrapping

  return { mapTex, bumpTex }
}

export function makeLightWoodTextures({ size = 1024 } = {}) {
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')

  const bump = document.createElement('canvas')
  bump.width = size
  bump.height = size
  const bctx = bump.getContext('2d')

  const rand = seededRand(0x11a7be)

  if (ctx) {
    // Light warm wood base.
    ctx.fillStyle = '#c9aa7f'
    ctx.fillRect(0, 0, size, size)

    const plankW = Math.floor(size * 0.18)
    const gap = Math.max(2, Math.floor(size * 0.0035))
    const grainLines = Math.floor(size * 0.55)

    for (let x = 0; x < size; x += plankW) {
      const t = rand()
      const hue = 34 + Math.floor(t * 10)
      const sat = 22 + Math.floor(rand() * 10)
      const light = 56 + Math.floor(rand() * 10)
      ctx.fillStyle = `hsl(${hue} ${sat}% ${light}%)`
      ctx.fillRect(x, 0, plankW - gap, size)

      // Plank seams (subtle).
      ctx.fillStyle = 'rgba(0,0,0,0.18)'
      ctx.fillRect(x + plankW - gap, 0, gap, size)

      // Soft highlight.
      const grad = ctx.createLinearGradient(x, 0, x + plankW, 0)
      grad.addColorStop(0.0, 'rgba(255,255,255,0.09)')
      grad.addColorStop(0.5, 'rgba(255,255,255,0.02)')
      grad.addColorStop(1.0, 'rgba(0,0,0,0.04)')
      ctx.fillStyle = grad
      ctx.fillRect(x, 0, plankW - gap, size)

      // A couple of faint knots.
      const knots = Math.floor(rand() * 2)
      for (let k = 0; k < knots; k += 1) {
        const cx = x + Math.floor(rand() * (plankW - gap))
        const cy = Math.floor(rand() * size)
        const r = Math.max(6, Math.floor(size * (0.01 + rand() * 0.01)))
        ctx.strokeStyle = 'rgba(0,0,0,0.12)'
        ctx.lineWidth = Math.max(2, Math.floor(r * 0.12))
        ctx.beginPath()
        ctx.ellipse(cx, cy, r, r * (0.65 + rand() * 0.25), rand() * Math.PI, 0, Math.PI * 2)
        ctx.stroke()
      }
    }

    // Grain (low contrast).
    ctx.globalAlpha = 0.12
    ctx.strokeStyle = 'rgba(70,45,28,0.55)'
    ctx.lineWidth = 1
    for (let i = 0; i < grainLines; i += 1) {
      const y = Math.floor(rand() * size)
      const wobble = (rand() - 0.5) * 8
      ctx.beginPath()
      ctx.moveTo(0, y)
      ctx.bezierCurveTo(size * 0.33, y + wobble, size * 0.66, y - wobble, size, y + wobble * 0.5)
      ctx.stroke()
    }
    ctx.globalAlpha = 1

    // Very gentle vignette.
    const v = ctx.createRadialGradient(size / 2, size / 2, size * 0.12, size / 2, size / 2, size * 0.78)
    v.addColorStop(0, 'rgba(255,255,255,0.03)')
    v.addColorStop(1, 'rgba(0,0,0,0.08)')
    ctx.fillStyle = v
    ctx.fillRect(0, 0, size, size)
  }

  if (bctx) {
    bctx.fillStyle = 'rgb(128,128,128)'
    bctx.fillRect(0, 0, size, size)

    const plankW = Math.floor(size * 0.18)
    const gap = Math.max(2, Math.floor(size * 0.0035))

    bctx.fillStyle = 'rgb(108,108,108)'
    for (let x = 0; x < size; x += plankW) {
      bctx.fillRect(x + plankW - gap, 0, gap, size)
    }

    const img = bctx.getImageData(0, 0, size, size)
    const d = img.data
    for (let i = 0; i < d.length; i += 4) {
      const n = (rand() - 0.5) * 14
      d[i] = Math.max(0, Math.min(255, d[i] + n))
      d[i + 1] = d[i]
      d[i + 2] = d[i]
      d[i + 3] = 255
    }
    bctx.putImageData(img, 0, 0)
  }

  const mapTex = new THREE.CanvasTexture(canvas)
  mapTex.colorSpace = THREE.SRGBColorSpace
  mapTex.wrapS = THREE.RepeatWrapping
  mapTex.wrapT = THREE.RepeatWrapping

  const bumpTex = new THREE.CanvasTexture(bump)
  if (typeof THREE.NoColorSpace !== 'undefined') bumpTex.colorSpace = THREE.NoColorSpace
  bumpTex.wrapS = THREE.RepeatWrapping
  bumpTex.wrapT = THREE.RepeatWrapping

  return { mapTex, bumpTex }
}

export function makeStuccoWallTextures({ size = 1024 } = {}) {
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')

  const bump = document.createElement('canvas')
  bump.width = size
  bump.height = size
  const bctx = bump.getContext('2d')

  const rand = seededRand(0x57acc0)

  if (ctx) {
    // Warm plaster base (Spanish-style: warm off-white / sand).
    ctx.fillStyle = '#d3c1a5'
    ctx.fillRect(0, 0, size, size)

    // Mottling.
    const blobs = 520
    for (let i = 0; i < blobs; i += 1) {
      const x = rand() * size
      const y = rand() * size
      const r = (0.02 + rand() * 0.10) * size
      const a = 0.03 + rand() * 0.06
      const hue = 30 + rand() * 14
      const sat = 24 + rand() * 10
      const light = 74 + (rand() - 0.5) * 10
      ctx.fillStyle = `hsla(${hue} ${sat}% ${light}% / ${a})`
      ctx.beginPath()
      ctx.arc(x, y, r, 0, Math.PI * 2)
      ctx.fill()
    }

    // Trowel strokes.
    ctx.globalAlpha = 0.09
    ctx.strokeStyle = '#bfa889'
    ctx.lineWidth = Math.max(2, Math.floor(size * 0.006))
    const strokes = 90
    for (let i = 0; i < strokes; i += 1) {
      const x = rand() * size
      const y = rand() * size
      const rx = (0.10 + rand() * 0.25) * size
      const ry = (0.04 + rand() * 0.12) * size
      const rot = rand() * Math.PI
      ctx.beginPath()
      ctx.ellipse(x, y, rx, ry, rot, 0, Math.PI * 2)
      ctx.stroke()
    }
    ctx.globalAlpha = 1
  }

  if (bctx) {
    bctx.fillStyle = 'rgb(128,128,128)'
    bctx.fillRect(0, 0, size, size)
    const img = bctx.getImageData(0, 0, size, size)
    const d = img.data
    for (let i = 0; i < d.length; i += 4) {
      // Grainy bump field.
      const n = (rand() - 0.5) * 42
      const v = Math.max(0, Math.min(255, 128 + n))
      d[i] = v
      d[i + 1] = v
      d[i + 2] = v
      d[i + 3] = 255
    }
    bctx.putImageData(img, 0, 0)
  }

  const mapTex = new THREE.CanvasTexture(canvas)
  mapTex.colorSpace = THREE.SRGBColorSpace
  mapTex.wrapS = THREE.RepeatWrapping
  mapTex.wrapT = THREE.RepeatWrapping

  const bumpTex = new THREE.CanvasTexture(bump)
  if (typeof THREE.NoColorSpace !== 'undefined') bumpTex.colorSpace = THREE.NoColorSpace
  bumpTex.wrapS = THREE.RepeatWrapping
  bumpTex.wrapT = THREE.RepeatWrapping

  return { mapTex, bumpTex }
}

export function makeCeilingStuccoTextures({ size = 1024 } = {}) {
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')

  const bump = document.createElement('canvas')
  bump.width = size
  bump.height = size
  const bctx = bump.getContext('2d')

  const rand = seededRand(0xc3111ce)

  if (ctx) {
    // Neutral plaster base for ceilings (keeps palette color clean).
    ctx.fillStyle = '#e7e8ea'
    ctx.fillRect(0, 0, size, size)

    // Gentle mottling with very low saturation so it reads as texture, not color.
    const blobs = 420
    for (let i = 0; i < blobs; i += 1) {
      const x = rand() * size
      const y = rand() * size
      const r = (0.02 + rand() * 0.10) * size
      const a = 0.02 + rand() * 0.05
      const hue = 210 + rand() * 20
      const sat = 3 + rand() * 4
      const light = 90 + (rand() - 0.5) * 10
      ctx.fillStyle = `hsla(${hue} ${sat}% ${light}% / ${a})`
      ctx.beginPath()
      ctx.arc(x, y, r, 0, Math.PI * 2)
      ctx.fill()
    }

    // Trowel strokes (slightly stronger than walls so it reads on bright surfaces).
    ctx.globalAlpha = 0.12
    ctx.strokeStyle = 'rgba(190, 192, 196, 0.9)'
    ctx.lineWidth = Math.max(2, Math.floor(size * 0.006))
    const strokes = 110
    for (let i = 0; i < strokes; i += 1) {
      const x = rand() * size
      const y = rand() * size
      const rx = (0.10 + rand() * 0.26) * size
      const ry = (0.04 + rand() * 0.13) * size
      const rot = rand() * Math.PI
      ctx.beginPath()
      ctx.ellipse(x, y, rx, ry, rot, 0, Math.PI * 2)
      ctx.stroke()
    }
    ctx.globalAlpha = 1
  }

  if (bctx) {
    bctx.fillStyle = 'rgb(128,128,128)'
    bctx.fillRect(0, 0, size, size)
    const img = bctx.getImageData(0, 0, size, size)
    const d = img.data
    for (let i = 0; i < d.length; i += 4) {
      const n = (rand() - 0.5) * 52
      const v = Math.max(0, Math.min(255, 128 + n))
      d[i] = v
      d[i + 1] = v
      d[i + 2] = v
      d[i + 3] = 255
    }
    bctx.putImageData(img, 0, 0)
  }

  const mapTex = new THREE.CanvasTexture(canvas)
  mapTex.colorSpace = THREE.SRGBColorSpace
  mapTex.wrapS = THREE.RepeatWrapping
  mapTex.wrapT = THREE.RepeatWrapping

  const bumpTex = new THREE.CanvasTexture(bump)
  if (typeof THREE.NoColorSpace !== 'undefined') bumpTex.colorSpace = THREE.NoColorSpace
  bumpTex.wrapS = THREE.RepeatWrapping
  bumpTex.wrapT = THREE.RepeatWrapping

  return { mapTex, bumpTex }
}

export function makeMarbleTextures({ size = 1024, seed = 1 } = {}) {
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')

  const bump = document.createElement('canvas')
  bump.width = size
  bump.height = size
  const bctx = bump.getContext('2d')

  const rand = seededRand(seed)

  if (ctx) {
    // Neutral light gray base.
    ctx.fillStyle = '#d8d8dc'
    ctx.fillRect(0, 0, size, size)

    // Soft cloudy variation.
    const clouds = 360
    for (let i = 0; i < clouds; i += 1) {
      const x = rand() * size
      const y = rand() * size
      const r = (0.02 + rand() * 0.12) * size
      const a = 0.02 + rand() * 0.05
      const g = 206 + Math.floor((rand() - 0.5) * 28)
      ctx.fillStyle = `rgba(${g},${g},${g},${a})`
      ctx.beginPath()
      ctx.arc(x, y, r, 0, Math.PI * 2)
      ctx.fill()
    }

    // Veins.
    ctx.globalAlpha = 0.55
    ctx.strokeStyle = 'rgba(110,110,118,0.58)'
    ctx.lineWidth = Math.max(1, Math.floor(size * 0.004))
    const veins = 18
    for (let i = 0; i < veins; i += 1) {
      const y0 = rand() * size
      const wobble = (rand() - 0.5) * size * 0.22
      ctx.beginPath()
      ctx.moveTo(-size * 0.1, y0)
      ctx.bezierCurveTo(size * 0.25, y0 + wobble, size * 0.55, y0 - wobble, size * 1.1, y0 + wobble * 0.35)
      ctx.stroke()

      // A faint companion vein.
      if (rand() < 0.55) {
        ctx.globalAlpha = 0.22
        ctx.beginPath()
        ctx.moveTo(-size * 0.1, y0 + (rand() - 0.5) * size * 0.08)
        ctx.bezierCurveTo(size * 0.25, y0 + wobble * 0.7, size * 0.55, y0 - wobble * 0.7, size * 1.1, y0 + wobble * 0.22)
        ctx.stroke()
        ctx.globalAlpha = 0.55
      }
    }
    ctx.globalAlpha = 1

    // Slight vignette for depth.
    const v = ctx.createRadialGradient(size / 2, size / 2, size * 0.08, size / 2, size / 2, size * 0.8)
    v.addColorStop(0, 'rgba(255,255,255,0.02)')
    v.addColorStop(1, 'rgba(0,0,0,0.11)')
    ctx.fillStyle = v
    ctx.fillRect(0, 0, size, size)
  }

  if (bctx) {
    bctx.fillStyle = 'rgb(128,128,128)'
    bctx.fillRect(0, 0, size, size)
    const img = bctx.getImageData(0, 0, size, size)
    const d = img.data
    for (let i = 0; i < d.length; i += 4) {
      const n = (rand() - 0.5) * 34
      const v = Math.max(0, Math.min(255, 128 + n))
      d[i] = v
      d[i + 1] = v
      d[i + 2] = v
      d[i + 3] = 255
    }
    bctx.putImageData(img, 0, 0)
  }

  const mapTex = new THREE.CanvasTexture(canvas)
  mapTex.colorSpace = THREE.SRGBColorSpace
  mapTex.wrapS = THREE.RepeatWrapping
  mapTex.wrapT = THREE.RepeatWrapping

  const bumpTex = new THREE.CanvasTexture(bump)
  if (typeof THREE.NoColorSpace !== 'undefined') bumpTex.colorSpace = THREE.NoColorSpace
  bumpTex.wrapS = THREE.RepeatWrapping
  bumpTex.wrapT = THREE.RepeatWrapping

  return { mapTex, bumpTex }
}

let sharedRoomMaterialTextures = null

export function getSharedRoomMaterialTextures({ width = 14, length = 18 } = {}) {
  if (!sharedRoomMaterialTextures) {
    const { mapTex: floorWoodMap, bumpTex: floorWoodBump } = makeWoodFloorTextures({ size: 1024 })
    const { mapTex: doorWoodMap, bumpTex: doorWoodBump } = makeWoodFloorTextures({ size: 512 })
    const { mapTex: benchWoodMap, bumpTex: benchWoodBump } = makeLightWoodTextures({ size: 512 })
    const { mapTex: wallStuccoMap, bumpTex: wallStuccoBump } = makeStuccoWallTextures({ size: 1024 })
    const { mapTex: ceilingStuccoMap, bumpTex: ceilingStuccoBump } = makeCeilingStuccoTextures({ size: 1024 })

    const { mapTex: pillarMarbleMap, bumpTex: pillarMarbleBump } = makeMarbleTextures({ size: 512, seed: 0x6d617262 })
    const { mapTex: panelMarbleMap, bumpTex: panelMarbleBump } = makeMarbleTextures({ size: 1024, seed: 0x70616e6c })

    // Defaults that don't depend on room dimensions.
    doorWoodMap.repeat.set(2.2, 4.2)
    doorWoodBump.repeat.copy(doorWoodMap.repeat)

    benchWoodMap.repeat.set(2.6, 1.6)
    benchWoodBump.repeat.copy(benchWoodMap.repeat)

    wallStuccoMap.repeat.set(4, 2)
    wallStuccoBump.repeat.copy(wallStuccoMap.repeat)

    // Modest repeat so veins read without looking tiled.
    pillarMarbleMap.repeat.set(2.0, 3.0)
    pillarMarbleBump.repeat.copy(pillarMarbleMap.repeat)

    // Marble for text/info panel backplates.
    panelMarbleMap.repeat.set(1.4, 1.4)
    panelMarbleBump.repeat.copy(panelMarbleMap.repeat)

    sharedRoomMaterialTextures = {
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
    }
  }

  // Repeats that depend on room dimensions (safe because only one room is active at a time).
  const { floorWoodMap, floorWoodBump, ceilingStuccoMap, ceilingStuccoBump } = sharedRoomMaterialTextures

  // Approx plank size: about 0.22m. Repeat by room size so planks don't stretch.
  floorWoodMap.repeat.set(Math.max(2, Math.round(width / 2.2)), Math.max(2, Math.round(length / 2.2)))
  floorWoodBump.repeat.copy(floorWoodMap.repeat)

  ceilingStuccoMap.repeat.set(Math.max(3, Math.round(width / 2.2)), Math.max(3, Math.round(length / 2.2)))
  ceilingStuccoBump.repeat.copy(ceilingStuccoMap.repeat)

  return sharedRoomMaterialTextures
}

export function disposeSharedRoomMaterialTextures() {
  if (!sharedRoomMaterialTextures) return

  for (const tex of Object.values(sharedRoomMaterialTextures)) {
    if (tex && typeof tex.dispose === 'function') tex.dispose()
  }

  sharedRoomMaterialTextures = null
}
