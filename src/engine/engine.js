import * as THREE from 'three'

export function startEngine({ canvas, onFps }) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true })
  renderer.setPixelRatio(Math.min(window.devicePixelRatio ?? 1, 2))

  const scene = new THREE.Scene()
  scene.background = new THREE.Color(0x05030a)

  const camera = new THREE.PerspectiveCamera(70, 1, 0.1, 200)
  camera.position.set(0, 1.4, 3)

  const ambient = new THREE.AmbientLight(0xffffff, 0.6)
  scene.add(ambient)

  const keyLight = new THREE.DirectionalLight(0xff66cc, 1.0)
  keyLight.position.set(3, 4, 2)
  scene.add(keyLight)

  const floorGeo = new THREE.PlaneGeometry(20, 20)
  const floorMat = new THREE.MeshStandardMaterial({ color: 0x141019, roughness: 0.9 })
  const floor = new THREE.Mesh(floorGeo, floorMat)
  floor.rotation.x = -Math.PI / 2
  floor.position.y = 0
  scene.add(floor)

  const cubeGeo = new THREE.BoxGeometry(1, 1, 1)
  const cubeMat = new THREE.MeshStandardMaterial({ color: 0x66ccff, roughness: 0.25, metalness: 0.1 })
  const cube = new THREE.Mesh(cubeGeo, cubeMat)
  cube.position.set(0, 0.5, 0)
  scene.add(cube)

  function resize() {
    const width = canvas.clientWidth
    const height = canvas.clientHeight

    if (width <= 0 || height <= 0) return

    renderer.setSize(width, height, false)
    camera.aspect = width / height
    camera.updateProjectionMatrix()
  }

  const clock = new THREE.Clock()
  let rafId = 0
  let fpsFrames = 0
  let fpsTime = 0
  let lastFpsReport = 0

  function frame() {
    const dt = clock.getDelta()

    if (typeof onFps === 'function') {
      fpsFrames += 1
      fpsTime += dt
      const now = clock.elapsedTime

      if (fpsTime >= 0.25 && now - lastFpsReport >= 0.25) {
        const fps = fpsFrames / fpsTime
        onFps(fps)
        fpsFrames = 0
        fpsTime = 0
        lastFpsReport = now
      }
    }

    cube.rotation.y += dt * 0.6
    cube.rotation.x += dt * 0.2

    resize()
    renderer.render(scene, camera)
    rafId = window.requestAnimationFrame(frame)
  }

  window.addEventListener('resize', resize)
  resize()
  rafId = window.requestAnimationFrame(frame)

  return {
    stop() {
      window.cancelAnimationFrame(rafId)
      window.removeEventListener('resize', resize)

      cubeGeo.dispose()
      cubeMat.dispose()
      floorGeo.dispose()
      floorMat.dispose()
      renderer.dispose()
    },
  }
}
