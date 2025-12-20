import * as THREE from 'three'
import { makeOutlineRect } from '../../misc/helper.js'

function hashStringToSeed(str) {
  const s = String(str || '')
  let h = 2166136261
  for (let i = 0; i < s.length; i += 1) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

function seededRand(seed) {
  let s = (seed >>> 0) || 1
  return function rand() {
    s ^= s << 13
    s ^= s >>> 17
    s ^= s << 5
    return (s >>> 0) / 0xffffffff
  }
}

function makeMarbleTexture({ size = 512, seed = 1 } = {}) {
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')

  const rand = seededRand(seed)

  if (ctx) {
    ctx.fillStyle = '#d8d8dc'
    ctx.fillRect(0, 0, size, size)

    const clouds = 340
    for (let i = 0; i < clouds; i += 1) {
      const x = rand() * size
      const y = rand() * size
      const r = (0.02 + rand() * 0.12) * size
      const a = 0.025 + rand() * 0.05
      const g = 205 + Math.floor((rand() - 0.5) * 30)
      ctx.fillStyle = `rgba(${g},${g},${g},${a})`
      ctx.beginPath()
      ctx.arc(x, y, r, 0, Math.PI * 2)
      ctx.fill()
    }

    ctx.globalAlpha = 0.6
    ctx.strokeStyle = 'rgba(115,115,122,0.55)'
    ctx.lineWidth = Math.max(1, Math.floor(size * 0.004))
    const veins = 18
    for (let i = 0; i < veins; i += 1) {
      const y0 = rand() * size
      const wobble = (rand() - 0.5) * size * 0.22
      ctx.beginPath()
      ctx.moveTo(-size * 0.1, y0)
      ctx.bezierCurveTo(size * 0.25, y0 + wobble, size * 0.55, y0 - wobble, size * 1.1, y0 + wobble * 0.35)
      ctx.stroke()


      if (rand() < 0.55) {
        ctx.globalAlpha = 0.28
        ctx.beginPath()
        ctx.moveTo(-size * 0.1, y0 + (rand() - 0.5) * size * 0.08)
        ctx.bezierCurveTo(size * 0.25, y0 + wobble * 0.7, size * 0.55, y0 - wobble * 0.7, size * 1.1, y0 + wobble * 0.22)
        ctx.stroke()
        ctx.globalAlpha = 0.6
      }
    }
    ctx.globalAlpha = 1

    const v = ctx.createRadialGradient(size / 2, size / 2, size * 0.08, size / 2, size / 2, size * 0.8)
    v.addColorStop(0, 'rgba(255,255,255,0.02)')
    v.addColorStop(1, 'rgba(0,0,0,0.10)')
    ctx.fillStyle = v
    ctx.fillRect(0, 0, size, size)
  }

  const tex = new THREE.CanvasTexture(canvas)
  tex.colorSpace = THREE.SRGBColorSpace
  tex.wrapS = THREE.ClampToEdgeWrapping
  tex.wrapT = THREE.ClampToEdgeWrapping
  tex.needsUpdate = true
  return tex
}

export function addDoor(ctx, { id, wall, w, h, y = 0, u = 0, color = 0x22ffee, meta = {} }) {
  const { walls, height, wallThickness, group, markers, disposables, doorHitMeshes, doors } = ctx

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

  const style = ctx?.doorStyle || {}
  const frameStyle = style?.frame || null
  const doorStyle = style?.door || null
  const fillStyle = style?.fill || null

  const frameMat = frameStyle
    ? new THREE.MeshStandardMaterial({
        color: frameStyle.color ?? 0x1a0f09,
        roughness: frameStyle.roughness ?? 0.58,
        metalness: frameStyle.metalness ?? 0.0,
      })
    : new THREE.MeshStandardMaterial({
        color,
        roughness: 0.35,
        metalness: 0.0,
      })
  disposables.push(frameMat)

  const doorPanelMat = new THREE.MeshStandardMaterial({
    color: doorStyle?.color ?? 0x2a170d,
    map: doorStyle?.map ?? null,
    bumpMap: doorStyle?.bumpMap ?? null,
    bumpScale: typeof doorStyle?.bumpScale === 'number' ? doorStyle.bumpScale : 0.02,
    roughness: doorStyle?.roughness ?? 0.52,
    metalness: doorStyle?.metalness ?? 0.0,
  })
  disposables.push(doorPanelMat)

  const frameW = 0.08
  const frameDepth = 0.08
  const frameInsetX = 0.012

  const fillGeo = new THREE.PlaneGeometry(w, h)
  const fillMat = new THREE.MeshStandardMaterial({
    color: fillStyle?.color ?? 0x0d1015,
    roughness: fillStyle?.roughness ?? 0.95,
    metalness: fillStyle?.metalness ?? 0.0,
  })
  const fill = new THREE.Mesh(fillGeo, fillMat)
  fill.position.set(0, h / 2, -0.02)
  doorFrameGroup.add(fill)
  disposables.push(fillGeo, fillMat)

  const panelInset = 0.05
  const panelGeo = new THREE.PlaneGeometry(Math.max(0.2, w - panelInset * 2), Math.max(0.2, h - panelInset * 2))
  const panel = new THREE.Mesh(panelGeo, doorPanelMat)
  panel.position.set(0, h / 2, -0.016)
  doorFrameGroup.add(panel)
  disposables.push(panelGeo)

  const labelText =
    typeof meta.label === 'string' && meta.label.trim().length > 0
      ? meta.label.trim()
      : typeof meta.category === 'string' && meta.category.trim().length > 0
        ? meta.category.trim()
        : ''

  let labelControl = null

  if (labelText) {
    const plaqueW = Math.min(w * 0.82, 1.35)
    const plaqueH = 0.24
    const plaqueCenterY = Math.min(h - 0.25, 1.4)
    const plaqueGeo = new THREE.PlaneGeometry(plaqueW, plaqueH)

    const marbleTex = makeMarbleTexture({ size: 512, seed: hashStringToSeed(id) ^ 0x6d617262 })
    const plaqueMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      map: marbleTex,
      roughness: 0.78,
      metalness: 0.0,
    })
    const plaque = new THREE.Mesh(plaqueGeo, plaqueMat)
    plaque.position.set(0, plaqueCenterY, -0.015)
    doorFrameGroup.add(plaque)
    disposables.push(marbleTex, plaqueGeo, plaqueMat)

    const canvas = document.createElement('canvas')
    canvas.width = 512
    canvas.height = 128
    const ctx2 = canvas.getContext('2d')
    let drawLabelText = null
    if (ctx2) {
      drawLabelText = function drawLabelText(nextText) {
        function wrapLines(text, maxWidth, maxLines) {
          const words = String(text).trim().split(/\s+/g)
          const lines = []
          let cur = ''

          function pushLine(line) {
            if (line.trim()) lines.push(line.trim())
          }

          for (const word of words) {
            const next = cur ? `${cur} ${word}` : word
            if (ctx2.measureText(next).width <= maxWidth) {
              cur = next
              continue
            }

            if (cur) pushLine(cur)
            cur = word

            if (ctx2.measureText(cur).width > maxWidth) {
              let chunk = ''
              for (const ch of cur) {
                const nextChunk = chunk + ch
                if (ctx2.measureText(nextChunk).width <= maxWidth) {
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
            while (last && ctx2.measureText(last + ell).width > maxWidth) {
              last = last.slice(0, -1)
            }
            lines[lastIdx] = last ? last + ell : ell
          }

          return lines
        }

        const safeText = String(nextText || '').trim()
        ctx2.clearRect(0, 0, canvas.width, canvas.height)


        const padX = 18
        const maxLines = 3
        let fontPx = 56
        ctx2.font = `700 ${fontPx}px system-ui, -apple-system, Segoe UI, Roboto, Arial`
        ctx2.fillStyle = '#2b2b2f'
        ctx2.textAlign = 'center'
        ctx2.textBaseline = 'middle'

        const maxWidth = canvas.width - padX * 2
        let lines = wrapLines(safeText, maxWidth, maxLines)

        if (lines.length >= 3) fontPx = 28
        else if (lines.length === 2) fontPx = 38
        else fontPx = 56

        ctx2.font = `700 ${fontPx}px system-ui, -apple-system, Segoe UI, Roboto, Arial`
        lines = wrapLines(safeText, maxWidth, maxLines)

        const lineHeight = Math.round(fontPx * 1.1)
        const totalH = lines.length * lineHeight
        const startY = canvas.height / 2 - totalH / 2 + lineHeight / 2

        for (let i = 0; i < lines.length; i += 1) {
          ctx2.fillText(lines[i], canvas.width / 2, startY + i * lineHeight)
        }
      }

      drawLabelText(labelText)
    }

    const tex = new THREE.CanvasTexture(canvas)
    tex.colorSpace = THREE.SRGBColorSpace
    tex.needsUpdate = true

    labelControl = {
      originalText: labelText,
      overrideText: null,
      setOverride(nextText) {
        const t = String(nextText || '').trim()
        this.overrideText = t || null
        if (typeof drawLabelText === 'function') {
          drawLabelText(t || this.originalText)
        }
        tex.needsUpdate = true
      },
      clearOverride() {
        this.setOverride('')
      },
    }

    const textGeo = new THREE.PlaneGeometry(plaqueW * 0.96, plaqueH * 0.78)
    const textMat = new THREE.MeshBasicMaterial({ map: tex, transparent: true })
    const text = new THREE.Mesh(textGeo, textMat)
    text.position.set(0, plaqueCenterY, -0.012)
    doorFrameGroup.add(text)
    disposables.push(tex, textGeo, textMat)
  }

  const jambGeo = new THREE.BoxGeometry(frameW, h, frameDepth)
  const headerGeo = new THREE.BoxGeometry(w + frameW * 2 - frameInsetX * 2, frameW, frameDepth)
  disposables.push(jambGeo, headerGeo)

  const leftJamb = new THREE.Mesh(jambGeo, frameMat)
  leftJamb.position.set(-(w / 2 + frameW / 2 - frameInsetX), h / 2, 0)
  doorFrameGroup.add(leftJamb)

  const rightJamb = new THREE.Mesh(jambGeo, frameMat)
  rightJamb.position.set(w / 2 + frameW / 2 - frameInsetX, h / 2, 0)
  doorFrameGroup.add(rightJamb)

  const header = new THREE.Mesh(headerGeo, frameMat)
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
  if (labelControl) hitMesh.userData.labelControl = labelControl
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
