import * as THREE from 'three'
import { clamp, roundTo } from '../../misc/helper.js'

export function buildLobbyRoom(ctx, lobby) {
  const {
    group,
    markers,
    disposables,
    slots,
    doors,
    doorHitMeshes,
    pickableMeshes,
    obstacles,
    palette,
    textures,
    width,
    length,
    height,
    halfW,
    halfL,
    wallThickness,
    addDoor,
  } = ctx

  const categories =
    Array.isArray(lobby?.categories) && lobby.categories.length > 0
      ? lobby.categories
      : ['Category 1', 'Category 2', 'Category 3', 'Category 4', 'Category 5', 'Category 6', 'Category 7', 'Category 8', 'Category 9', 'Category 10']

  const perWall = Math.ceil(categories.length / 2)
  const eastCategories = categories.slice(0, perWall).map((c) => String(c))
  const westCategories = categories.slice(perWall).map((c) => String(c))

  const boardW = roundTo(clamp(width * 0.72, 2.4, 6.2), 0.05)
  const boardH = roundTo(clamp(height * 0.58, 1.2, 2.0), 0.05)
  const boardY = height * 0.62

  function addLobbyWhiteboard({ leftItems, rightItems }) {
    const innerNorthZ = -halfL + wallThickness / 2
    const bottomY = -boardH / 2
    const legTopY = bottomY + 0.08
    const baseLegH = Math.max(0.35, boardY + legTopY - 0.02)
    const legH = Math.max(0.25, baseLegH * 0.5)
    const boardCenterY = 0.02 - legTopY + legH
    const boardCenter = new THREE.Vector3(0, boardCenterY, innerNorthZ + 1.4)

    const canvas = document.createElement('canvas')
    canvas.width = 2048
    canvas.height = 1024
    const ctx2 = canvas.getContext('2d')
    if (ctx2) {
      ctx2.clearRect(0, 0, canvas.width, canvas.height)
      ctx2.fillStyle = '#ffffff'
      ctx2.fillRect(0, 0, canvas.width, canvas.height)


      ctx2.strokeStyle = 'rgba(0,0,0,0.22)'
      ctx2.lineWidth = 14
      ctx2.strokeRect(18, 18, canvas.width - 36, canvas.height - 36)

      const padX = 90
      const padY = 86
      const midW = Math.floor(canvas.width * 0.34)
      const colW = (canvas.width - padX * 2 - midW) / 2

      const headerFont = '800 76px system-ui, -apple-system, Segoe UI, Roboto, Arial'
      const itemFont = '700 56px system-ui, -apple-system, Segoe UI, Roboto, Arial'
      const itemColor = 'rgba(0,0,0,0.92)'

      function drawWelcome() {
        const lines = ['WELCOME TO', 'VIRTUAL', 'MUSEUM']
        const centerX = canvas.width / 2
        const maxWidth = Math.max(260, midW * 0.92)

        let fontPx = 104
        function setFont(px) {
          ctx2.font = `900 ${px}px system-ui, -apple-system, Segoe UI, Roboto, Arial`
        }

        setFont(fontPx)
        while (fontPx > 54) {
          const widest = Math.max(...lines.map((t) => ctx2.measureText(t).width))
          if (widest <= maxWidth) break
          fontPx -= 4
          setFont(fontPx)
        }

        const lineH = Math.round(fontPx * 1.05)
        const totalH = lines.length * lineH
        const startY = canvas.height / 2 - totalH / 2 + lineH * 0.85

        ctx2.textAlign = 'center'
        ctx2.textBaseline = 'alphabetic'
        ctx2.fillStyle = 'rgba(0,0,0,0.86)'

        for (let i = 0; i < lines.length; i += 1) {
          ctx2.fillText(lines[i], centerX, startY + i * lineH)
        }
      }

      function drawWikipediaWatermark() {
        const cx = canvas.width / 2
        const cy = canvas.height / 2
        const r = Math.min(midW, canvas.height) * 0.38

        ctx2.save()
        ctx2.globalAlpha = 0.5
        ctx2.lineWidth = Math.max(10, Math.floor(canvas.width * 0.006))
        ctx2.strokeStyle = 'rgba(0,0,0,0.35)'
        ctx2.fillStyle = 'rgba(0, 0, 0, 0.37)'

        ctx2.beginPath()
        ctx2.arc(cx, cy, r, 0, Math.PI * 2)
        ctx2.fill()
        ctx2.stroke()

        ctx2.textAlign = 'center'
        ctx2.textBaseline = 'middle'
        const fontPx = Math.max(120, Math.floor(r * 0.95))
        ctx2.font = `900 ${fontPx}px system-ui, -apple-system, Segoe UI, Roboto, Arial`
        ctx2.fillStyle = 'rgba(0,0,0,0.25)'
        ctx2.fillText('W', cx, cy)
        ctx2.restore()
      }

      function drawList(x0, title, items, { align = 'left' } = {}) {
        ctx2.textAlign = align
        ctx2.textBaseline = 'alphabetic'

        const safeItems = Array.isArray(items) ? items.map((s) => String(s || '').trim()).filter(Boolean) : []

        const lineH = 66
        const headerLineH = 118
        const headerGap = 68
        const yMargin = Math.max(70, padY)
        const contentMaxH = Math.max(240, canvas.height - yMargin * 2)

        let maxItemLines = Math.max(1, Math.floor((contentMaxH - headerLineH - headerGap) / lineH))
        let shown = safeItems.slice(0, maxItemLines)
        let hasMore = safeItems.length > shown.length
        if (hasMore && shown.length > 1) {
          shown = safeItems.slice(0, Math.max(1, maxItemLines - 1))
          hasMore = safeItems.length > shown.length
        }

        const moreLineCount = hasMore ? 1 : 0
        const totalH = headerLineH + headerGap + (shown.length + moreLineCount) * lineH
        const yTop = (canvas.height - totalH) / 2


        let y = yTop + headerLineH
        ctx2.font = headerFont
        ctx2.fillStyle = 'rgba(0,0,0,0.92)'
        ctx2.fillText(String(title), x0, y)


        y += headerGap
        ctx2.font = itemFont
        ctx2.fillStyle = itemColor
        for (let i = 0; i < shown.length; i += 1) {
          const label = `• ${shown[i]}`
          ctx2.fillText(label, x0, y + i * lineH)
        }

        if (hasMore) {
          const more = safeItems.length - shown.length
          ctx2.fillStyle = 'rgba(0,0,0,0.62)'
          ctx2.fillText(`… +${more} more`, x0, y + shown.length * lineH)
        }
      }

      drawList(padX, '←←←←', leftItems, { align: 'left' })
      drawList(canvas.width - padX, '→→→→', rightItems, { align: 'right' })

      drawWikipediaWatermark()
      drawWelcome()
    }

    const tex = new THREE.CanvasTexture(canvas)
    tex.colorSpace = THREE.SRGBColorSpace
    tex.needsUpdate = true

    const boardDepth = 0.08
    const boardGroup = new THREE.Group()
    boardGroup.name = 'lobby-whiteboard'
    boardGroup.position.copy(boardCenter)

    const backGeo = new THREE.BoxGeometry(boardW, boardH, boardDepth)
    const backMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.95, metalness: 0.0 })
    const back = new THREE.Mesh(backGeo, backMat)
    back.position.set(0, 0, 0)
    boardGroup.add(back)
    disposables.push(backGeo, backMat)

    const faceGeo = new THREE.PlaneGeometry(boardW * 0.98, boardH * 0.98)
    const faceMat = new THREE.MeshBasicMaterial({ map: tex })
    const face = new THREE.Mesh(faceGeo, faceMat)
    face.position.set(0, 0, boardDepth / 2 + 0.002)
    boardGroup.add(face)
    disposables.push(tex, faceGeo, faceMat)

    const metalMat = new THREE.MeshStandardMaterial({ color: 0x0d1015, roughness: 0.7, metalness: 0.05 })
    disposables.push(metalMat)
    const legGeo = new THREE.CylinderGeometry(0.05, 0.05, legH, 12, 1)
    disposables.push(legGeo)

    const legXs = [-boardW * 0.32, 0, boardW * 0.32]
    for (const lx of legXs) {
      const leg = new THREE.Mesh(legGeo, metalMat)
      leg.position.set(lx, legTopY - legH / 2, -boardDepth * 0.18)
      boardGroup.add(leg)
    }

    boardGroup.rotation.x = -0.06

    group.add(boardGroup)

    obstacles.push({
      type: 'box',
      x: boardCenter.x,
      z: boardCenter.z + 0.05,
      w: boardW * 0.95,
      d: 0.9,
    })
  }

  addLobbyWhiteboard({
    leftItems: westCategories,
    rightItems: eastCategories,
  })

  const doorW = 1.25
  const doorH = 2.25 * 1.1

  const gapU = 1.1
  const endMarginTotal = 4.0
  const totalSpan = perWall * doorW + (perWall - 1) * gapU
  const span = Math.max(perWall * doorW, Math.min(totalSpan, length - endMarginTotal))
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

  {
    const innerSouthZ = halfL - wallThickness / 2
    const benchZ = innerSouthZ - 0.42
    const plantZ = innerSouthZ - 0.38

    const decoSouth = new THREE.Group()
    decoSouth.name = 'deco-south-lobby'
    group.add(decoSouth)

    const benchWoodMap = textures?.benchWoodMap
    const benchWoodBump = textures?.benchWoodBump
    const hasBenchTex = Boolean(benchWoodMap && benchWoodBump)

    const woodMat = new THREE.MeshStandardMaterial(
      hasBenchTex
        ? {
            color: 0xffffff,
            map: benchWoodMap,
            bumpMap: benchWoodBump,
            bumpScale: 0.045,
            roughness: 0.58,
            metalness: 0.0,
          }
        : { color: palette.wall, roughness: 0.78, metalness: 0.0 }
    )
    const metalMat = new THREE.MeshStandardMaterial({ color: 0x0d1015, roughness: 0.7, metalness: 0.05 })
    const potMat = new THREE.MeshStandardMaterial({ color: 0x0d1015, roughness: 0.95, metalness: 0.0 })
    const trunkMat = new THREE.MeshStandardMaterial({ color: 0x6b4b2a, roughness: 0.92, metalness: 0.0 })
    const leafMat = new THREE.MeshStandardMaterial({ color: 0x2f6f4e, roughness: 0.85, metalness: 0.0, side: THREE.DoubleSide })
    disposables.push(woodMat, metalMat, potMat, trunkMat, leafMat)

    const seatW = 2.6
    const seatD = 0.55
    const seatH = 0.12
    const seatY = 0.46

    const backW = seatW
    const backH = 0.55
    const backD = 0.08

    const seatGeo = new THREE.BoxGeometry(seatW, seatH, seatD)
    const backGeo = new THREE.BoxGeometry(backW, backH, backD)
    const legW = 0.08
    const legD = 0.08
    const legH = seatY - seatH / 2
    const legGeo = new THREE.BoxGeometry(legW, legH, legD)
    disposables.push(seatGeo, backGeo, legGeo)

    const legX = seatW / 2 - 0.18
    const legZ = seatD / 2 - 0.18

    function addBenchAt(x) {
      const b = new THREE.Group()
      b.name = 'bench-south-lobby'
      b.position.set(x, 0, benchZ)

      b.rotation.y = Math.PI
      decoSouth.add(b)

      const s = new THREE.Mesh(seatGeo, woodMat)
      s.position.set(0, seatY, 0)
      b.add(s)

      const bk = new THREE.Mesh(backGeo, woodMat)
      bk.position.set(0, seatY + backH / 2 - 0.02, -(seatD / 2 - backD / 2))
      b.add(bk)

      const xs = [-legX, legX]
      const zs = [-legZ, legZ]
      for (const lx of xs) {
        for (const lz of zs) {
          const leg = new THREE.Mesh(legGeo, metalMat)
          leg.position.set(lx, legH / 2, lz)
          b.add(leg)
        }
      }

      obstacles.push({ type: 'box', x, z: benchZ, w: seatW * 0.95, d: seatD * 1.15 })
    }

    const potR = 0.28
    const potH = 0.42
    const potGeo = new THREE.CylinderGeometry(potR, potR * 1.12, potH, 18, 1)
    const soilGeo = new THREE.CylinderGeometry(potR * 0.95, potR * 1.08, 0.06, 18, 1)
    const trunkH = 0.78
    const trunkGeo = new THREE.CylinderGeometry(0.055, 0.075, trunkH, 12, 1)

    const frondW = 0.12
    const frondL = 0.86
    const frondGeo = new THREE.PlaneGeometry(frondL, frondW, 7, 1)
    {
      const pos = frondGeo.attributes.position
      for (let i = 0; i < pos.count; i += 1) {
        const x = pos.getX(i)
        const t = (x + frondL / 2) / frondL
        const bend = Math.sin(t * Math.PI) * 0.13
        pos.setZ(i, bend)
      }
      pos.needsUpdate = true
      frondGeo.computeVertexNormals()
    }
    frondGeo.translate(frondL / 2, 0, 0)

    disposables.push(potGeo, soilGeo, trunkGeo, frondGeo)

    function addPlantAt(x) {
      const plant = new THREE.Group()
      plant.name = 'plant-south-lobby'
      plant.position.set(x, 0, plantZ)
      decoSouth.add(plant)

      const pot = new THREE.Mesh(potGeo, potMat)
      pot.position.set(0, potH / 2, 0)
      plant.add(pot)

      const soil = new THREE.Mesh(soilGeo, potMat)
      soil.position.set(0, potH - 0.02, 0)
      plant.add(soil)

      const trunk = new THREE.Mesh(trunkGeo, trunkMat)
      trunk.position.set(0, potH + trunkH / 2 - 0.02, 0)
      plant.add(trunk)

      const fronds = new THREE.Group()
      fronds.position.set(0, potH + trunkH - 0.02, 0)
      plant.add(fronds)

      const frondCount = 10
      for (let i = 0; i < frondCount; i += 1) {
        const f = new THREE.Mesh(frondGeo, leafMat)
        const a = (i / frondCount) * Math.PI * 2
        f.rotation.y = a
        f.rotation.x = -0.55 - Math.random() * 0.25
        f.rotation.z = (Math.random() - 0.5) * 0.22
        f.position.set(0, 0.05, 0)
        fronds.add(f)
      }

      obstacles.push({ type: 'cylinder', x, z: plantZ, radius: 0.38 })
    }

    const margin = 1.0
    const usable = Math.max(6.0, width - margin * 2)
    const plantSpan = 0.9
    const benchSpan = seatW
    const baseSpan = 3 * plantSpan + 2 * benchSpan
    const gap = Math.max(0.2, (usable - baseSpan) / 4)
    const totalSpan = baseSpan + gap * 4
    let cursor = -totalSpan / 2

    const xPlant1 = cursor + plantSpan / 2
    cursor += plantSpan + gap
    const xBench1 = cursor + benchSpan / 2
    cursor += benchSpan + gap
    const xPlant2 = cursor + plantSpan / 2
    cursor += plantSpan + gap
    const xBench2 = cursor + benchSpan / 2
    cursor += benchSpan + gap
    const xPlant3 = cursor + plantSpan / 2

    addPlantAt(xPlant1)
    addBenchAt(xBench1)
    addPlantAt(xPlant2)
    addBenchAt(xBench2)
    addPlantAt(xPlant3)
  }

  {
    const innerNorthZ = -halfL + wallThickness / 2
    const innerEastX = halfW - wallThickness / 2
    const innerWestX = -halfW + wallThickness / 2

    const insetX = 0.72
    const insetZ = 0.95

    const potMat = new THREE.MeshStandardMaterial({ color: 0x0d1015, roughness: 0.95, metalness: 0.0 })
    const trunkMat = new THREE.MeshStandardMaterial({ color: 0x6b4b2a, roughness: 0.92, metalness: 0.0 })
    const leafMat = new THREE.MeshStandardMaterial({ color: 0x2f6f4e, roughness: 0.85, metalness: 0.0, side: THREE.DoubleSide })
    disposables.push(potMat, trunkMat, leafMat)

    const potR = 0.28
    const potH = 0.42
    const potGeo = new THREE.CylinderGeometry(potR, potR * 1.12, potH, 18, 1)
    const soilGeo = new THREE.CylinderGeometry(potR * 0.95, potR * 1.08, 0.06, 18, 1)
    const trunkH = 0.78
    const trunkGeo = new THREE.CylinderGeometry(0.055, 0.075, trunkH, 12, 1)

    const frondW = 0.12
    const frondL = 0.86
    const frondGeo = new THREE.PlaneGeometry(frondL, frondW, 7, 1)
    {
      const pos = frondGeo.attributes.position
      for (let i = 0; i < pos.count; i += 1) {
        const x = pos.getX(i)
        const t = (x + frondL / 2) / frondL
        const bend = Math.sin(t * Math.PI) * 0.13
        pos.setZ(i, bend)
      }
      pos.needsUpdate = true
      frondGeo.computeVertexNormals()
    }
    frondGeo.translate(frondL / 2, 0, 0)

    disposables.push(potGeo, soilGeo, trunkGeo, frondGeo)

    function addCornerPlant({ x, z, name }) {
      const plant = new THREE.Group()
      plant.name = name
      plant.position.set(x, 0, z)

      plant.rotation.y = Math.PI
      group.add(plant)

      const pot = new THREE.Mesh(potGeo, potMat)
      pot.position.set(0, potH / 2, 0)
      plant.add(pot)

      const soil = new THREE.Mesh(soilGeo, potMat)
      soil.position.set(0, potH - 0.02, 0)
      plant.add(soil)

      const trunk = new THREE.Mesh(trunkGeo, trunkMat)
      trunk.position.set(0, potH + trunkH / 2 - 0.02, 0)
      plant.add(trunk)

      const fronds = new THREE.Group()
      fronds.position.set(0, potH + trunkH - 0.02, 0)
      plant.add(fronds)

      const frondCount = 10
      for (let i = 0; i < frondCount; i += 1) {
        const f = new THREE.Mesh(frondGeo, leafMat)
        const a = (i / frondCount) * Math.PI * 2
        f.rotation.y = a
        f.rotation.x = -0.55 - Math.random() * 0.25
        f.rotation.z = (Math.random() - 0.5) * 0.22
        f.position.set(0, 0.05, 0)
        fronds.add(f)
      }

      obstacles.push({ type: 'cylinder', x, z, radius: 0.38 })
    }

    const z = innerNorthZ + insetZ
    addCornerPlant({ x: innerWestX + insetX, z, name: 'plant-nw-lobby' })
    addCornerPlant({ x: innerEastX - insetX, z, name: 'plant-ne-lobby' })
  }

  group.add(markers)

  return {
    group,
    disposables,
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
