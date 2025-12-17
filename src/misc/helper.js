import * as THREE from 'three'

export function hashStringToUint32(str) {
  let h = 2166136261
  for (let i = 0; i < str.length; i += 1) {
    h ^= str.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

export function mulberry32(seed) {
  let a = seed >>> 0
  return function rand() {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value))
}

export function roundTo(value, step) {
  return Math.round(value / step) * step
}

export function randRange(rand, min, max) {
  return min + (max - min) * rand()
}

export function makeOutlineRect({ width, height, center, normal, color = 0xffffff }) {
  const geo = new THREE.PlaneGeometry(width, height)
  const edges = new THREE.EdgesGeometry(geo)
  geo.dispose()

  const mat = new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.65 })
  const lines = new THREE.LineSegments(edges, mat)
  const quat = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), normal.clone().normalize())
  lines.quaternion.copy(quat)
  lines.position.copy(center)

  return { object: lines, disposables: [edges, mat] }
}

export function configureGalleryTexture(tex) {
  if (!tex) return tex
  tex.generateMipmaps = false
  tex.minFilter = THREE.LinearFilter
  tex.magFilter = THREE.LinearFilter
  tex.needsUpdate = true
  return tex
}