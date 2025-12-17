import * as THREE from 'three'
import { makeOutlineRect } from '../../misc/helper.js'

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

  let labelControl = null

  if (labelText) {
    const plaqueW = Math.min(w * 0.82, 1.35)
    const plaqueH = 0.24
    const plaqueCenterY = Math.min(h - 0.25, 1.4)
    const plaqueGeo = new THREE.PlaneGeometry(plaqueW, plaqueH)
    const plaqueMat = new THREE.MeshStandardMaterial({ color, roughness: 0.9, metalness: 0.0 })
    const plaque = new THREE.Mesh(plaqueGeo, plaqueMat)
    plaque.position.set(0, plaqueCenterY, -0.015)
    doorFrameGroup.add(plaque)
    disposables.push(plaqueGeo, plaqueMat)

    const canvas = document.createElement('canvas')
    canvas.width = 512
    canvas.height = 128
    const ctx2 = canvas.getContext('2d')
    let drawLabelText = null
    if (ctx2) {
      const plaqueBg = `#${new THREE.Color(color).getHexString()}`

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
        ctx2.fillStyle = plaqueBg
        ctx2.fillRect(0, 0, canvas.width, canvas.height)

        const padX = 18
        const maxLines = 3
        let fontPx = 56
        ctx2.font = `700 ${fontPx}px system-ui, -apple-system, Segoe UI, Roboto, Arial`
        ctx2.fillStyle = '#000000'
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
