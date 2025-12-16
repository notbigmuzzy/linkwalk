import * as THREE from 'three'

export function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value))
}

export function roundTo(value, step) {
  return Math.round(value / step) * step
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
