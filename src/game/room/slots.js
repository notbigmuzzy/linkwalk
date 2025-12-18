import * as THREE from 'three'
import { makeOutlineRect } from '../../misc/helper.js'

export function addSlot(ctx, { id, wall, kind, w, h, y, u = 0, color, opacity }) {
  const { walls, height, surfaceOffset, slots, markers, disposables } = ctx

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
    opacity,
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
    outlineObject: object,
  })
}
