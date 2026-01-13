import * as THREE from 'three'
import { clamp, roundTo, configureGalleryTexture } from '../misc/helper.js'
import { buildLobbyRoom } from './room/lobby.js'
import { addDoor as addDoorToRoom } from './room/doors.js'
import { addSlot as addSlotToRoom } from './room/slots.js'
import { getSharedRoomMaterialTextures, labelFromImageUrl, makePlaqueTexture } from './room/textures.js'

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

	if (mode === 'lobby') {
		const platformHeight = 1.4
		const upperCeilingHeight = height + 1.6
		const platformWidth = 4.0
		const centerWidth = width - 2 * platformWidth

		const y1 = height - 0.25
		const lightC1 = new THREE.PointLight(ceilingLightColor, ceilingLightIntensity, ceilingLightDistance, ceilingLightDecay)
		lightC1.position.set(0, y1, -length * 0.25)
		group.add(lightC1)

		const lightC2 = new THREE.PointLight(ceilingLightColor, ceilingLightIntensity, ceilingLightDistance, ceilingLightDecay)
		lightC2.position.set(0, y1, length * 0.25)
		group.add(lightC2)

		const y2 = upperCeilingHeight - 0.25
		const xEast = centerWidth / 2 + platformWidth / 2

		const lightE1 = new THREE.PointLight(ceilingLightColor, ceilingLightIntensity * 1.1, ceilingLightDistance, ceilingLightDecay)
		lightE1.position.set(xEast, y2, -length * 0.3)
		group.add(lightE1)

		const lightE2 = new THREE.PointLight(ceilingLightColor, ceilingLightIntensity * 1.1, ceilingLightDistance, ceilingLightDecay)
		lightE2.position.set(xEast, y2, 0)
		group.add(lightE2)

		const lightE3 = new THREE.PointLight(ceilingLightColor, ceilingLightIntensity * 1.1, ceilingLightDistance, ceilingLightDecay)
		lightE3.position.set(xEast, y2, length * 0.3)
		group.add(lightE3)

		const xWest = -(centerWidth / 2 + platformWidth / 2)

		const lightW1 = new THREE.PointLight(ceilingLightColor, ceilingLightIntensity * 1.1, ceilingLightDistance, ceilingLightDecay)
		lightW1.position.set(xWest, y2, -length * 0.3)
		group.add(lightW1)

		const lightW2 = new THREE.PointLight(ceilingLightColor, ceilingLightIntensity * 1.1, ceilingLightDistance, ceilingLightDecay)
		lightW2.position.set(xWest, y2, 0)
		group.add(lightW2)

		const lightW3 = new THREE.PointLight(ceilingLightColor, ceilingLightIntensity * 1.1, ceilingLightDistance, ceilingLightDecay)
		lightW3.position.set(xWest, y2, length * 0.3)
		group.add(lightW3)
	} else {

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
	}

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

	if (mode === 'lobby') {
		const platformHeight = 1.4
		const upperCeilingHeight = height + 1.6
		const platformWidth = 4.0  // Fixed width for elevated platforms
		const centerWidth = width - 2 * platformWidth  // Back to using all remaining width

		const floorMat = new THREE.MeshStandardMaterial({
			color: palette.floor,
			map: floorWoodMap,
			bumpMap: floorWoodBump,
			bumpScale: 0.05,
			roughness: 0.42,
			metalness: 0.0,
		})
		disposables.push(floorMat)


		const centralFloorGeo = new THREE.PlaneGeometry(centerWidth, length)
		const centralFloor = new THREE.Mesh(centralFloorGeo, floorMat)
		centralFloor.rotation.x = -Math.PI / 2
		centralFloor.position.y = 0
		centralFloor.name = 'central-floor'
		group.add(centralFloor)
		disposables.push(centralFloorGeo)


		const eastFloorGeo = new THREE.PlaneGeometry(platformWidth, length)
		const eastFloor = new THREE.Mesh(eastFloorGeo, floorMat)
		eastFloor.rotation.x = -Math.PI / 2
		eastFloor.position.set(centerWidth / 2 + platformWidth / 2, platformHeight + 0.001, 0)  // Slight offset to prevent z-fighting
		eastFloor.name = 'east-platform-floor'
		group.add(eastFloor)
		disposables.push(eastFloorGeo)


		const westFloorGeo = new THREE.PlaneGeometry(platformWidth, length)
		const westFloor = new THREE.Mesh(westFloorGeo, floorMat)
		westFloor.rotation.x = -Math.PI / 2
		westFloor.position.set(-(centerWidth / 2 + platformWidth / 2), platformHeight + 0.001, 0)  // Slight offset to prevent z-fighting
		westFloor.name = 'west-platform-floor'
		group.add(westFloor)
		disposables.push(westFloorGeo)


		const platformFaceMat = new THREE.MeshStandardMaterial({
			color: palette.wall,
			map: wallStuccoMap,
			bumpMap: wallStuccoBump,
			bumpScale: 0.09,
			roughness: 0.92,
			metalness: 0.0,
		})
		disposables.push(platformFaceMat)


		const eastFaceGeo = new THREE.BoxGeometry(wallThickness, platformHeight, length)
		const eastFace = new THREE.Mesh(eastFaceGeo, platformFaceMat)
		eastFace.position.set(centerWidth / 2, platformHeight / 2, 0)
		eastFace.name = 'east-platform-face'
		group.add(eastFace)
		disposables.push(eastFaceGeo)


		const westFaceGeo = new THREE.BoxGeometry(wallThickness, platformHeight, length)
		const westFace = new THREE.Mesh(westFaceGeo, platformFaceMat)
		westFace.position.set(-centerWidth / 2, platformHeight / 2, 0)
		westFace.name = 'west-platform-face'
		group.add(westFace)
		disposables.push(westFaceGeo)


		const ceilingMat = new THREE.MeshStandardMaterial({
			color: palette.ceiling,
			map: ceilingStuccoMap,
			bumpMap: ceilingStuccoBump,
			bumpScale: 0.14,
			roughness: 0.94,
			metalness: 0.0,
		})
		disposables.push(ceilingMat)


		const centralCeilingGeo = new THREE.PlaneGeometry(centerWidth, length)
		const centralCeiling = new THREE.Mesh(centralCeilingGeo, ceilingMat)
		centralCeiling.rotation.x = Math.PI / 2
		centralCeiling.position.y = upperCeilingHeight
		centralCeiling.name = 'central-ceiling'
		group.add(centralCeiling)
		disposables.push(centralCeilingGeo)


		const eastCeilingGeo = new THREE.PlaneGeometry(platformWidth, length)
		const eastCeiling = new THREE.Mesh(eastCeilingGeo, ceilingMat)
		eastCeiling.rotation.x = Math.PI / 2
		eastCeiling.position.set(centerWidth / 2 + platformWidth / 2, upperCeilingHeight, 0)
		eastCeiling.name = 'east-platform-ceiling'
		group.add(eastCeiling)
		disposables.push(eastCeilingGeo)

		const westCeilingGeo = new THREE.PlaneGeometry(platformWidth, length)
		const westCeiling = new THREE.Mesh(westCeilingGeo, ceilingMat)
		westCeiling.rotation.x = Math.PI / 2
		westCeiling.position.set(-(centerWidth / 2 + platformWidth / 2), upperCeilingHeight, 0)
		westCeiling.name = 'west-platform-ceiling'
		group.add(westCeiling)
		disposables.push(westCeilingGeo)

		const stepCount = 7
		const stepHeight = platformHeight / stepCount
		const stepDepth = 0.35
		const stepWidth = length * 0.35
		const stepThickness = 0.1
		const totalStairsDepth = stepCount * stepDepth

		const stepMat = new THREE.MeshStandardMaterial({
			color: palette.floor,
			map: floorWoodMap,
			bumpMap: floorWoodBump,
			bumpScale: 0.05,
			roughness: 0.42,
			metalness: 0.0,
		})
		disposables.push(stepMat)

		const eastStairGroup = new THREE.Group()
		eastStairGroup.name = 'east-stairs'
		group.add(eastStairGroup)

		const eastStairStartX = centerWidth / 2

		for (let i = 0; i < stepCount; i++) {
			const stepGeo = new THREE.BoxGeometry(stepDepth, stepThickness, stepWidth)
			const step = new THREE.Mesh(stepGeo, stepMat)
			const xPos = eastStairStartX - totalStairsDepth + (i + 0.5) * stepDepth
			const yPos = (i + 1) * stepHeight - stepThickness / 2 - 0.001  // Slight offset below platform
			step.position.set(xPos, yPos, 0)
			eastStairGroup.add(step)
			if (i === 0) disposables.push(stepGeo)


			if (i < stepCount - 1) {
				const riserGeo = new THREE.BoxGeometry(stepThickness, stepHeight, stepWidth)
				const riser = new THREE.Mesh(riserGeo, platformFaceMat)
				const riserX = eastStairStartX - totalStairsDepth + (i + 1) * stepDepth - stepThickness / 2
				const riserY = (i + 1) * stepHeight + stepHeight / 2
				riser.position.set(riserX, riserY, 0)
				eastStairGroup.add(riser)
				if (i === 0) disposables.push(riserGeo)
			}
		}

		const westStairGroup = new THREE.Group()
		westStairGroup.name = 'west-stairs'
		group.add(westStairGroup)

		const westStairStartX = -centerWidth / 2

		for (let i = 0; i < stepCount; i++) {
			const stepGeo = new THREE.BoxGeometry(stepDepth, stepThickness, stepWidth)
			const step = new THREE.Mesh(stepGeo, stepMat)
			const xPos = westStairStartX + totalStairsDepth - (i + 0.5) * stepDepth
			const yPos = (i + 1) * stepHeight - stepThickness / 2 - 0.001  // Slight offset below platform
			step.position.set(xPos, yPos, 0)
			westStairGroup.add(step)

			if (i < stepCount - 1) {
				const riserGeo = new THREE.BoxGeometry(stepThickness, stepHeight, stepWidth)
				const riser = new THREE.Mesh(riserGeo, platformFaceMat)
				const riserX = westStairStartX + totalStairsDepth - (i + 1) * stepDepth + stepThickness / 2
				const riserY = (i + 1) * stepHeight + stepHeight / 2
				riser.position.set(riserX, riserY, 0)
				westStairGroup.add(riser)
			}
		}

	} else {

		const floorGeo = new THREE.PlaneGeometry(width, length)
		const floorMat = new THREE.MeshStandardMaterial({
			color: 0xffffff,
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
	}

	const wallMat = new THREE.MeshStandardMaterial({
		color: mode === 'lobby' ? palette.wall : 0xffffff,
		map: wallStuccoMap,
		bumpMap: wallStuccoBump,
		bumpScale: 0.09,
		roughness: 0.92,
		metalness: 0.0,
	})

	const halfW = width / 2
	const halfL = length / 2

	if (mode === 'lobby') {

		const platformHeight = 1.4
		const upperCeilingHeight = height + 1.6
		const platformWidth = 4.0
		const centerWidth = width - 2 * platformWidth

		const northCentralGeo = new THREE.BoxGeometry(centerWidth, upperCeilingHeight, wallThickness)
		const northCentral = new THREE.Mesh(northCentralGeo, wallMat)
		northCentral.position.set(0, upperCeilingHeight / 2, -halfL)
		northCentral.name = 'north-wall-central'
		group.add(northCentral)
		disposables.push(northCentralGeo)

		const northEastGeo = new THREE.BoxGeometry(platformWidth, upperCeilingHeight - platformHeight, wallThickness)
		const northEast = new THREE.Mesh(northEastGeo, wallMat)
		northEast.position.set(centerWidth / 2 + platformWidth / 2, platformHeight + (upperCeilingHeight - platformHeight) / 2, -halfL)
		northEast.name = 'north-wall-east'
		group.add(northEast)
		disposables.push(northEastGeo)

		const northWestGeo = new THREE.BoxGeometry(platformWidth, upperCeilingHeight - platformHeight, wallThickness)
		const northWest = new THREE.Mesh(northWestGeo, wallMat)
		northWest.position.set(-(centerWidth / 2 + platformWidth / 2), platformHeight + (upperCeilingHeight - platformHeight) / 2, -halfL)
		northWest.name = 'north-wall-west'
		group.add(northWest)
		disposables.push(northWestGeo)

		const southCentralGeo = new THREE.BoxGeometry(centerWidth, upperCeilingHeight, wallThickness)
		const southCentral = new THREE.Mesh(southCentralGeo, wallMat)
		southCentral.position.set(0, upperCeilingHeight / 2, halfL)
		southCentral.name = 'south-wall-central'
		group.add(southCentral)
		disposables.push(southCentralGeo)

		const southEastGeo = new THREE.BoxGeometry(platformWidth, upperCeilingHeight - platformHeight, wallThickness)
		const southEast = new THREE.Mesh(southEastGeo, wallMat)
		southEast.position.set(centerWidth / 2 + platformWidth / 2, platformHeight + (upperCeilingHeight - platformHeight) / 2, halfL)
		southEast.name = 'south-wall-east'
		group.add(southEast)
		disposables.push(southEastGeo)

		const southWestGeo = new THREE.BoxGeometry(platformWidth, upperCeilingHeight - platformHeight, wallThickness)
		const southWest = new THREE.Mesh(southWestGeo, wallMat)
		southWest.position.set(-(centerWidth / 2 + platformWidth / 2), platformHeight + (upperCeilingHeight - platformHeight) / 2, halfL)
		southWest.name = 'south-wall-west'
		group.add(southWest)
		disposables.push(southWestGeo)

		const eastWallGeo = new THREE.BoxGeometry(wallThickness, upperCeilingHeight, length)
		const eastWall = new THREE.Mesh(eastWallGeo, wallMat)
		eastWall.position.set(halfW, upperCeilingHeight / 2, 0)
		eastWall.name = 'east-wall'
		group.add(eastWall)
		disposables.push(eastWallGeo)

		const westWallGeo = new THREE.BoxGeometry(wallThickness, upperCeilingHeight, length)
		const westWall = new THREE.Mesh(westWallGeo, wallMat)
		westWall.position.set(-halfW, upperCeilingHeight / 2, 0)
		westWall.name = 'west-wall'
		group.add(westWall)
		disposables.push(westWallGeo)
	} else {

		const wallNSGeo = new THREE.BoxGeometry(width, height, wallThickness)
		const wallEWGeo = new THREE.BoxGeometry(wallThickness, height, length)

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

		disposables.push(wallNSGeo, wallEWGeo)
	}

	disposables.push(wallMat)

	const slots = []
	const doors = []
	const doorHitMeshes = []
	const pickableMeshes = []
	const obstacles = []
	const markers = new THREE.Group()
	markers.name = 'display-slots'

	const surfaceOffset = wallThickness / 2 + 0.02

	let walls
	if (mode === 'lobby') {
		const platformHeight = 1.4
		const upperCeilingHeight = height + 1.6
		const platformWidth = 4.0
		const centerWidth = width - 2 * platformWidth

		walls = {
			north: { center: new THREE.Vector3(0, upperCeilingHeight / 2, -halfL), normal: new THREE.Vector3(0, 0, 1), wallWidth: width, wallHeight: upperCeilingHeight },
			south: { center: new THREE.Vector3(0, upperCeilingHeight / 2, halfL), normal: new THREE.Vector3(0, 0, -1), wallWidth: width, wallHeight: upperCeilingHeight },
			east: {
				center: new THREE.Vector3(halfW, platformHeight + (upperCeilingHeight - platformHeight) / 2, 0),
				normal: new THREE.Vector3(-1, 0, 0),
				wallWidth: length,
				wallHeight: upperCeilingHeight - platformHeight
			},
			west: {
				center: new THREE.Vector3(-halfW, platformHeight + (upperCeilingHeight - platformHeight) / 2, 0),
				normal: new THREE.Vector3(1, 0, 0),
				wallWidth: length,
				wallHeight: upperCeilingHeight - platformHeight
			},
		}
	} else {
		walls = {
			north: { center: new THREE.Vector3(0, height / 2, -halfL), normal: new THREE.Vector3(0, 0, 1), wallWidth: width, wallHeight: height },
			south: { center: new THREE.Vector3(0, height / 2, halfL), normal: new THREE.Vector3(0, 0, -1), wallWidth: width, wallHeight: height },
			east: { center: new THREE.Vector3(halfW, height / 2, 0), normal: new THREE.Vector3(-1, 0, 0), wallWidth: length, wallHeight: height },
			west: { center: new THREE.Vector3(-halfW, height / 2, 0), normal: new THREE.Vector3(1, 0, 0), wallWidth: length, wallHeight: height },
		}
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

	const entryDoorW = 1.25
	const entryDoorH = 2.25 * 1.1
	addDoor({ id: 'entry-door', wall: 'south', w: entryDoorW, h: entryDoorH, u: 0, color: 0xff4455, meta: { target: 'back', label: 'Previous exhibit' } })

	{
		const innerSouthZ = halfL - wallThickness / 2
		const doorW = entryDoorW
		const doorH = entryDoorH
		const topY = doorH - 0.36

		const mountZ = innerSouthZ - 0.06
		const mountX = -(doorW / 2 + 0.55)

		const buttonGroup = new THREE.Group()
		buttonGroup.name = 'go-lobby-button'
		buttonGroup.position.set(mountX, 0, mountZ)
		buttonGroup.rotation.y = Math.PI
		group.add(buttonGroup)

		const backPlateW = 0.62
		const backPlateH = 1.05 * 0.5
		const backPlateD = 0.03
		const backPlateGeo = new THREE.BoxGeometry(backPlateW, backPlateH, backPlateD)
		const backPlateMat = new THREE.MeshStandardMaterial({ color: 0x2f6f4e, roughness: 0.9, metalness: 0.0 })
		const backPlate = new THREE.Mesh(backPlateGeo, backPlateMat)
		const backPlateCenterY = topY - backPlateH / 2
		backPlate.position.set(0, backPlateCenterY, 0)
		buttonGroup.add(backPlate)
		disposables.push(backPlateGeo, backPlateMat)

		const capW = 0.28
		const capH = 0.16 * 0.5
		const capD = 0.08
		const capGeo = new THREE.BoxGeometry(capW, capH, capD)
		const capMat = new THREE.MeshStandardMaterial({ color: 0xff4455, roughness: 0.5, metalness: 0.0 })
		const cap = new THREE.Mesh(capGeo, capMat)
		cap.position.set(0, backPlateCenterY + backPlateH * 0.22, backPlateD / 2 + capD / 2 + 0.002)
		buttonGroup.add(cap)
		disposables.push(capGeo, capMat)

		const canvas = document.createElement('canvas')
		canvas.width = 512
		canvas.height = 256
		const ctx2 = canvas.getContext('2d')
		if (ctx2) {
			ctx2.clearRect(0, 0, canvas.width, canvas.height)
			ctx2.fillStyle = 'rgba(0,0,0,0)'
			ctx2.fillRect(0, 0, canvas.width, canvas.height)

			ctx2.textAlign = 'center'
			ctx2.textBaseline = 'middle'
			ctx2.fillStyle = 'rgba(255,255,255,0.92)'

			ctx2.font = '800 80px system-ui, -apple-system, Segoe UI, Roboto, Arial'
			ctx2.fillText('Go back', canvas.width / 2, canvas.height * 0.42)
			ctx2.font = '800 70px system-ui, -apple-system, Segoe UI, Roboto, Arial'
			ctx2.fillText('to lobby', canvas.width / 2, canvas.height * 0.70)
		}

		const labelTex = new THREE.CanvasTexture(canvas)
		labelTex.colorSpace = THREE.SRGBColorSpace
		configureGalleryTexture(labelTex)
		labelTex.needsUpdate = true

		const labelGeo = new THREE.PlaneGeometry(0.56 * 0.5, 0.28 * 0.5)
		const labelMat = new THREE.MeshBasicMaterial({ map: labelTex, transparent: true })
		const label = new THREE.Mesh(labelGeo, labelMat)
		label.position.set(0, backPlateCenterY - backPlateH * 0.14, backPlateD / 2 + 0.006)
		buttonGroup.add(label)
		disposables.push(labelTex, labelGeo, labelMat)

		const hitGeo = new THREE.PlaneGeometry(backPlateW, backPlateH)
		const hitMat = new THREE.MeshBasicMaterial({ transparent: true, opacity: 0.0, depthWrite: false })
		const hit = new THREE.Mesh(hitGeo, hitMat)
		hit.position.set(0, backPlateCenterY, backPlateD / 2 + 0.02)
		hit.userData.action = 'go-lobby'
		buttonGroup.add(hit)
		pickableMeshes.push(hit)
		disposables.push(hitGeo, hitMat)
	}

	{
		const colHeight = height

		const pillarW = roundTo(clamp(5, 3.0, width - 3.0), 0.05)
		const pillarD = roundTo(clamp(0.3, 0.25, 0.5), 0.05)
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
			const trunkH = 0.72

			const frondW = 0.105
			const frondL = 0.74

			const potGeo = new THREE.CylinderGeometry(potR, potR * 1.08, potH, 14, 1)
			const potMat = new THREE.MeshStandardMaterial({ color: 0x12161b, roughness: 0.95, metalness: 0.02 })
			const trunkGeo = new THREE.CylinderGeometry(0.045, 0.06, trunkH, 12, 1)
			const trunkMat = new THREE.MeshStandardMaterial({ color: 0x6b4b2a, roughness: 0.92, metalness: 0.0 })

			const frondGeo = new THREE.PlaneGeometry(frondL, frondW, 7, 1)
			{
				const pos = frondGeo.attributes.position
				for (let i = 0; i < pos.count; i += 1) {
					const x = pos.getX(i)
					const t = (x + frondL / 2) / frondL
					const bend = Math.sin(t * Math.PI) * 0.11
					pos.setZ(i, bend)
				}
				pos.needsUpdate = true
				frondGeo.computeVertexNormals()
			}
			frondGeo.translate(frondL / 2, 0, 0)

			const leafMat = new THREE.MeshStandardMaterial({ color: 0x2a8f4a, roughness: 0.9, metalness: 0.0, side: THREE.DoubleSide })
			disposables.push(potGeo, potMat, trunkGeo, trunkMat, frondGeo, leafMat)

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

				const trunk = new THREE.Mesh(trunkGeo, trunkMat)
				trunk.position.set(0, potH + trunkH / 2 - 0.02, 0)
				plant.add(trunk)

				const fronds = new THREE.Group()
				fronds.position.set(0, potH + trunkH - 0.02, 0)
				plant.add(fronds)

				const frondCount = 9
				for (let i = 0; i < frondCount; i += 1) {
					const f = new THREE.Mesh(frondGeo, leafMat)
					const a = (i / frondCount) * Math.PI * 2
					f.rotation.y = a
					f.rotation.x = -0.55
					f.rotation.z = (Math.random() - 0.5) * 0.18
					f.position.set(0, 0.045, 0)
					fronds.add(f)
				}

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

				const firstSentence = description.split('.')[0] + '.'
				const descLines = wrapText(descCtx, firstSentence, descCanvas.width - padX * 2, 6)
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
		const videoUrl = typeof gallery?.videoUrl === 'string' ? gallery.videoUrl.trim() : ''
		if (videoUrl) {
			const pillarD = roundTo(clamp(0.35, 0.28, 0.5), 0.05)
			const panelW = 1.55
			const panelH = 1.05
			const panelDepth = 0.06

			const panelY = Math.min(height * 0.47, 1.9)
			const panelZNorth = -(pillarD / 2 + 0.08)

			const backGeo = new THREE.BoxGeometry(panelW, panelH, panelDepth)
			const backMat = new THREE.MeshStandardMaterial({ color: 0x000000, roughness: 0.95, metalness: 0.0 })
			disposables.push(backGeo, backMat)

			const back = new THREE.Mesh(backGeo, backMat)
			back.position.set(0, panelY, panelZNorth)
			back.rotation.y = Math.PI
			group.add(back)

			const geo = new THREE.PlaneGeometry(panelW, panelH)
			const mat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, depthWrite: false })
			const mesh = new THREE.Mesh(geo, mat)
			mesh.position.set(0, panelY, panelZNorth - panelDepth / 2 - 0.002)
			mesh.rotation.y = Math.PI
			group.add(mesh)
			disposables.push(geo, mat)


			const innerW = panelW * 0.92
			const innerH = panelH * 0.92
			mesh.scale.set(innerW / panelW, innerH / panelH, 1)


			function makePlayOverlayTexture({ width = 1024, height = 512 } = {}) {
				const canvas = document.createElement('canvas')
				canvas.width = width
				canvas.height = height
				const ctx = canvas.getContext('2d')
				if (ctx) {
					ctx.clearRect(0, 0, canvas.width, canvas.height)


					ctx.fillStyle = 'rgba(0,0,0,0.28)'
					ctx.fillRect(0, 0, canvas.width, canvas.height)

					ctx.strokeStyle = 'rgba(255,255,255,0.18)'
					ctx.lineWidth = Math.max(6, Math.floor(canvas.width * 0.01))
					ctx.strokeRect(24, 24, canvas.width - 48, canvas.height - 48)

					ctx.textAlign = 'center'
					ctx.textBaseline = 'middle'
					ctx.fillStyle = 'rgba(255,255,255,0.95)'
					ctx.font = `900 ${Math.floor(canvas.width * 0.09)}px system-ui, -apple-system, Segoe UI, Roboto, Arial`
					ctx.fillText('> PLAY VIDEO', canvas.width / 2, canvas.height / 2)
				}

				const t = new THREE.CanvasTexture(canvas)
				t.colorSpace = THREE.SRGBColorSpace
				configureGalleryTexture(t)
				t.needsUpdate = true
				return t
			}

			const overlayGeo = new THREE.PlaneGeometry(panelW, panelH)
			const overlayTex = makePlayOverlayTexture({ width: 1024, height: 512 })
			const overlayMat = new THREE.MeshBasicMaterial({ map: overlayTex, transparent: true, depthWrite: false })
			const overlay = new THREE.Mesh(overlayGeo, overlayMat)
			overlay.position.copy(mesh.position)
			overlay.position.z -= 0.001
			overlay.rotation.copy(mesh.rotation)
			overlay.renderOrder = 10000
			group.add(overlay)
			disposables.push(overlayGeo, overlayTex, overlayMat)


			const video = document.createElement('video')
			video.crossOrigin = 'anonymous'
			video.playsInline = true
			video.preload = 'metadata'
			video.loop = true
			video.src = videoUrl
			video.load()

			const tex = new THREE.VideoTexture(video)
			tex.colorSpace = THREE.SRGBColorSpace
			tex.needsUpdate = true
			mat.map = tex
			mat.needsUpdate = true
			disposables.push(tex)

			function updateOverlayVisibility() {
				overlay.visible = Boolean(video.paused || video.ended)
			}
			updateOverlayVisibility()
			video.addEventListener('play', updateOverlayVisibility)
			video.addEventListener('pause', updateOverlayVisibility)
			video.addEventListener('ended', updateOverlayVisibility)

			function fitVideoInFrame() {
				const vw = video.videoWidth || 0
				const vh = video.videoHeight || 0
				if (!(vw > 0 && vh > 0)) return

				const imageAspect = vw / vh
				const frameAspect = innerW / innerH


				let displayW = innerW
				let displayH = innerH
				if (imageAspect > frameAspect) {
					displayH = innerW / imageAspect
				} else {
					displayW = innerH * imageAspect
				}

				mesh.scale.set(displayW / panelW, displayH / panelH, 1)
			}

			video.addEventListener('loadedmetadata', fitVideoInFrame, { once: true })
			video.addEventListener('loadeddata', () => {
				tex.needsUpdate = true
				fitVideoInFrame()
			})

			async function togglePlay() {
				try {
					if (!video.paused && !video.ended) {
						video.pause()
						return
					}

					const p = video.play()
					if (p && typeof p.then === 'function') {
						await p
					}
				} catch {

					try {
						video.muted = true
						const p2 = video.play()
						if (p2 && typeof p2.then === 'function') await p2
					} catch (err2) {
						console.warn('[linkwalk] Video playback failed', err2)
					}
				}
			}

			mesh.userData = {
				...(mesh.userData || {}),
				pickable: false,
				pickableType: 'column-video',
				videoUrl,
				onClick: togglePlay,
			}
			pickableMeshes.push(mesh)

			overlay.userData = {
				...(overlay.userData || {}),
				pickable: false,
				pickableType: 'column-video',
				videoUrl,
				onClick: togglePlay,
			}
			pickableMeshes.push(overlay)

			{
				const caption = labelFromImageUrl(videoUrl) || 'Video'

				const plaqueW = panelW * 0.82
				const plaqueH = 0.22
				const gapFromFrame = 0.06
				const plaqueDepth = 0.04

				const plaqueBackGeo = new THREE.BoxGeometry(plaqueW, plaqueH, plaqueDepth)
				const plaqueBackMat = new THREE.MeshStandardMaterial({ color: 0x0d1015, roughness: 0.95, metalness: 0.0 })
				const plaqueBack = new THREE.Mesh(plaqueBackGeo, plaqueBackMat)
				plaqueBack.position.set(0, panelY - panelH / 2 - plaqueH / 2 - gapFromFrame, panelZNorth)
				plaqueBack.rotation.y = Math.PI
				group.add(plaqueBack)
				disposables.push(plaqueBackGeo, plaqueBackMat)

				const plaqueGeo = new THREE.PlaneGeometry(plaqueW, plaqueH)
				const plaqueMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true })
				const plaque = new THREE.Mesh(plaqueGeo, plaqueMat)
				plaque.position.copy(plaqueBack.position)
				plaque.position.z -= plaqueDepth / 2 + 0.002
				plaque.rotation.copy(plaqueBack.rotation)
				group.add(plaque)
				disposables.push(plaqueGeo, plaqueMat)

				const plaqueTex = makePlaqueTexture({ size: 1024, text: caption, aspect: plaqueW / plaqueH })
				plaqueMat.map = plaqueTex
				plaqueMat.needsUpdate = true
				disposables.push(plaqueTex)
			}

			disposables.push({
				dispose() {
					try {
						video.removeEventListener('play', updateOverlayVisibility)
						video.removeEventListener('pause', updateOverlayVisibility)
						video.removeEventListener('ended', updateOverlayVisibility)
						video.pause()
						video.removeAttribute('src')
						video.load()
					} catch {

					}
				},
			})
		}
	}

	{
		const relatedTitles = Array.isArray(gallery.relatedTitles) ? gallery.relatedTitles.filter(Boolean) : []
		const doorH = 2.25 * 1.1
		const cornerMargin = 1.6
		const cornerUSouth = Math.max(-halfL + 1.0, halfL - cornerMargin)
		const cornerUNorth = Math.min(halfL - 1.0, -halfL + cornerMargin)
		const northCornerUEast = Math.min(halfW - 1.0, halfW - cornerMargin)
		const northCornerUWest = Math.max(-halfW + 1.0, -halfW + cornerMargin)

		const baseDoors = [
			{ id: 'seealso-0', wall: 'east', u: cornerUSouth },
			{ id: 'seealso-1', wall: 'west', u: cornerUSouth },
			{ id: 'seealso-2', wall: 'east', u: cornerUNorth },
			{ id: 'seealso-3', wall: 'west', u: cornerUNorth },
			{ id: 'seealso-4', wall: 'north', u: northCornerUEast },
			{ id: 'seealso-5', wall: 'north', u: northCornerUWest },
		]

		for (let i = 0; i < baseDoors.length; i++) {
			const spec = baseDoors[i]
			const title = relatedTitles[i] ? String(relatedTitles[i]) : ''
			addDoor({
				id: spec.id,
				wall: spec.wall,
				w: 1.1,
				h: doorH,
				u: spec.u,
				meta: title ? { articleTitle: title, label: title } : { label: '...' },
			})
		}

		const remaining = relatedTitles.slice(baseDoors.length)
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
				const midY = Math.round(canvas.height * 0.48)
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


			{
				const controlY = -boardH / 2 + 0.28
				const controlZ = boardDepth / 2 + 0.04

				const controlGroup = new THREE.Group()
				controlGroup.name = 'random-exhibit-control'
				controlGroup.position.set(0, controlY, controlZ)


				const plateW = clamp(boardW * 0.58, 1.9, 2.8) * 0.64
				const plateH = 0.36
				const plateD = 0.05

				const plateGeo = new THREE.BoxGeometry(plateW, plateH, plateD)
				const plateMat = new THREE.MeshStandardMaterial({

					color: 0x2f6f4e,
					roughness: 0.85,
					metalness: 0.0,
				})
				const plate = new THREE.Mesh(plateGeo, plateMat)
				plate.position.set(0, 0, 0)
				controlGroup.add(plate)
				disposables.push(plateGeo, plateMat)


				const capR = 0.22
				const capH = 0.085
				const collarR = 0.18
				const collarH = 0.06
				const labelH = 0.28
				const gapBetween = 0.10
				const plateSidePad = 0.14
				const usableW = Math.max(0.8, plateW - plateSidePad * 2)

				let labelW = clamp(boardW * 0.42, 1.45, 2.2)
				const requiredW = capR * 2 + gapBetween + labelW
				if (requiredW > usableW) {
					labelW = Math.max(0.9, usableW - (capR * 2 + gapBetween))
				}

				const contentW = capR * 2 + gapBetween + labelW
				const leftEdge = -contentW / 2
				const buttonCenterX = leftEdge + capR
				const labelCenterX = leftEdge + capR * 2 + gapBetween + labelW / 2


				const collarGeo = new THREE.CylinderGeometry(collarR, collarR, collarH, 28, 1)
				const collarMat = new THREE.MeshStandardMaterial({ color: 0xb8c2cc, roughness: 0.35, metalness: 0.6 })
				const collar = new THREE.Mesh(collarGeo, collarMat)
				collar.rotation.x = Math.PI / 2
				collar.position.set(buttonCenterX, 0, plateD / 2 + collarH / 2 - 0.01)
				controlGroup.add(collar)
				disposables.push(collarGeo, collarMat)


				const capGeo = new THREE.CylinderGeometry(capR, capR * 0.92, capH, 32, 1)
				const capMat = new THREE.MeshStandardMaterial({ color: 0xff4455, roughness: 0.38, metalness: 0.02 })
				const cap = new THREE.Mesh(capGeo, capMat)
				cap.rotation.x = Math.PI / 2
				cap.position.copy(collar.position)
				cap.position.z += collarH / 2 + capH / 2 - 0.015
				controlGroup.add(cap)
				disposables.push(capGeo, capMat)


				const labelGeo = new THREE.PlaneGeometry(labelW, labelH)
				const labelMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true })
				const label = new THREE.Mesh(labelGeo, labelMat)
				label.position.set(labelCenterX, 0, plateD / 2 + 0.014)
				controlGroup.add(label)
				disposables.push(labelGeo, labelMat)

				{
					const canvasLabel = document.createElement('canvas')
					canvasLabel.width = 1024
					canvasLabel.height = 256
					const ctxLabel = canvasLabel.getContext('2d')
					if (ctxLabel) {
						ctxLabel.clearRect(0, 0, canvasLabel.width, canvasLabel.height)
						const line1 = 'Hit button for'
						const line2 = 'random exhibit'
						ctxLabel.textAlign = 'center'
						ctxLabel.textBaseline = 'middle'

						const cx = canvasLabel.width / 2
						const cy = canvasLabel.height / 2 + 2
						const dy = 46

						ctxLabel.lineWidth = 10
						ctxLabel.strokeStyle = 'rgba(0,0,0,0.45)'
						ctxLabel.fillStyle = 'rgba(255,255,255,0.94)'

						ctxLabel.font = '750 72px system-ui, -apple-system, Segoe UI, Roboto, Arial'
						ctxLabel.strokeText(line1, cx, cy - dy)
						ctxLabel.fillText(line1, cx, cy - dy)

						ctxLabel.font = '900 86px system-ui, -apple-system, Segoe UI, Roboto, Arial'
						ctxLabel.strokeText(line2, cx, cy + dy)
						ctxLabel.fillText(line2, cx, cy + dy)
					}

					const labelTex = new THREE.CanvasTexture(canvasLabel)
					labelTex.colorSpace = THREE.SRGBColorSpace
					configureGalleryTexture(labelTex)
					labelTex.needsUpdate = true
					labelMat.map = labelTex
					labelMat.needsUpdate = true
					disposables.push(labelTex)
				}


				const hitGeo = new THREE.BoxGeometry(plateW, plateH, 0.18)
				const hitMat = new THREE.MeshBasicMaterial({ transparent: true, opacity: 0.0 })

				hitMat.colorWrite = false
				hitMat.depthWrite = false
				hitMat.depthTest = false
				const hit = new THREE.Mesh(hitGeo, hitMat)
				hit.position.set(0, 0, plateD / 2 + 0.08)
				hit.userData = {
					...(hit.userData || {}),
					pickable: false,
					action: 'random-exhibit',
				}
				controlGroup.add(hit)
				pickableMeshes.push(hit)
				disposables.push(hitGeo, hitMat)

				boardGroup.add(controlGroup)
			}


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
			const margin = 1.6
			const usable = Math.max(2.8, length - margin * 2)
			const panelW = clamp(usable, 3.74, 7.7)
			const panelH = clamp(height * 0.8, 1.9, 3.0)
			const y = clamp(stdFrameY, panelH / 2 + 0.25, height - panelH / 2 - 0.25)

			addSlot({ id: 'west-text-0', wall: 'west', kind: 'frame', w: panelW, h: panelH, y, u: 0, color: 0xd9d9de, opacity: 1 })
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

		function makeWallTextTexture({ size = 1024, title, text, aspect, startLine = 0, withTitle = true, twoColumn = false } = {}) {
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
					const titleFontSize = twoColumn ? Math.min(52, Math.floor(maxW * 0.052)) : Math.floor(maxW * 0.072)
					ctx.font = `800 ${titleFontSize}px system-ui, -apple-system, Segoe UI, Roboto, Arial`
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
					const titleSpacing = twoColumn ? Math.min(65, Math.floor(maxW * 0.065)) : Math.floor(maxW * 0.09)
					y += titleSpacing
				}

				const bodyFontSize = twoColumn ? Math.min(18, Math.floor(maxW * 0.018)) : Math.floor(maxW * 0.038)
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
					const lines = wrapText(trimmed, twoColumn ? (maxWidth - pad) / 2 : maxWidth)
					for (const line of lines) allLines.push(line)
					allLines.push('')
				}
				while (allLines.length > 0 && allLines[allLines.length - 1] === '') allLines.pop()

				if (twoColumn) {
					const columnWidth = (maxWidth - pad) / 2
					const linesPerColumn = Math.floor((canvas.height - y - pad * 0.5) / lineHeight)
					const maxLinesToShow = linesPerColumn * 2

					let i = nextLine
					let leftY = y
					let rightY = y
					let currentColumn = 0

					while (i < allLines.length && i < nextLine + maxLinesToShow) {
						const line = allLines[i]

						if (currentColumn === 0) {

							if (line) {
								ctx.fillText(line, pad, leftY)
								leftY += lineHeight
							} else {
								leftY += Math.floor(lineHeight * 0.55)
							}

							if (leftY > canvas.height - pad || (i - nextLine) >= linesPerColumn - 1) {
								currentColumn = 1
							}
						} else {

							if (line) {
								ctx.fillText(line, pad + columnWidth + pad, rightY)
								rightY += lineHeight
							} else {
								rightY += Math.floor(lineHeight * 0.55)
							}

							if (rightY > canvas.height - pad) {
								i += 1
								break
							}
						}

						i += 1
					}
					nextLine = i
				} else {
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
			}

			const tex = new THREE.CanvasTexture(canvas)
			tex.colorSpace = THREE.SRGBColorSpace
			configureGalleryTexture(tex)
			tex.needsUpdate = true
			return { tex, nextLine }
		}

		function placeTextInSlot(slot, { title, text, startLine = 0, withTitle = true, twoColumn = false } = {}) {
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

			const { tex, nextLine } = makeWallTextTexture({ size: 1024, title, text, aspect: baseW / baseH, startLine, withTitle, twoColumn })
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

			placeTextInSlot(panel0, { title: galleryTitle || 'Wikipedia', text: source, startLine: 0, withTitle: false, twoColumn: true })
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
