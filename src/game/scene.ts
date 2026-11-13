import * as THREE from 'three'
import type { LoadedAssets } from './assets'
import {
  skyFragmentShader,
  skyVertexShader,
  waterFragmentShader,
  waterVertexShader,
} from './shaders'
import {
  burstSplash,
  buildVillage,
  createSplashParticles,
  setVillageZone,
  updateSplash,
} from './village'

type RodId = 'bamboo' | 'carbon' | 'master'
type ZoneId = 'harbor' | 'reef' | 'deep'

const ZONE_LOOK: Record<
  ZoneId,
  {
    fog: number
    fogNear: number
    fogFar: number
    deep: number
    shallow: number
    foam: number
    wave: number
    zenith: number
    mid: number
    horizon: number
    warmHorizon: number
    hemiSky: number
    hemiGround: number
    sunIntensity: number
    fillIntensity: number
    cam: THREE.Vector3Tuple
  }
> = {
  harbor: {
    fog: 0x7aa0b8,
    fogNear: 50,
    fogFar: 220,
    deep: 0x021c2e,
    shallow: 0x0d6582,
    foam: 0xeaf5fa,
    wave: 0.7,
    zenith: 0x1a479e,
    mid: 0x5799e0,
    horizon: 0xb3d1eb,
    warmHorizon: 0xf2b87a,
    hemiSky: 0x87b8e0,
    hemiGround: 0xc2a078,
    sunIntensity: 2.05,
    fillIntensity: 0.45,
    cam: [0, 2.48, 3.6],
  },
  reef: {
    fog: 0x6eb8c4,
    fogNear: 40,
    fogFar: 180,
    deep: 0x03485a,
    shallow: 0x1aa0a8,
    foam: 0xf0fffc,
    wave: 0.55,
    zenith: 0x0e6a8a,
    mid: 0x3db8c8,
    horizon: 0xb8ebe0,
    warmHorizon: 0xffc9a0,
    hemiSky: 0x7ed0d8,
    hemiGround: 0xc99578,
    sunIntensity: 2.25,
    fillIntensity: 0.55,
    cam: [0, 2.55, 3.35],
  },
  deep: {
    fog: 0x2a4058,
    fogNear: 28,
    fogFar: 140,
    deep: 0x010d18,
    shallow: 0x0a3a55,
    foam: 0xc5d8e6,
    wave: 1.15,
    zenith: 0x061428,
    mid: 0x1a3a62,
    horizon: 0x4a6a88,
    warmHorizon: 0x8a6a58,
    hemiSky: 0x4a6a88,
    hemiGround: 0x3a3428,
    sunIntensity: 1.55,
    fillIntensity: 0.28,
    cam: [0, 2.7, 3.9],
  },
}

export class SeasideScene {
  scene: THREE.Scene
  camera: THREE.PerspectiveCamera
  sun!: THREE.DirectionalLight
  private fillLight!: THREE.DirectionalLight
  private hemi!: THREE.HemisphereLight
  private rimLight!: THREE.DirectionalLight
  private skyUniforms: {
    uSunDirection: { value: THREE.Vector3 }
    uTime: { value: number }
    uZenith: { value: THREE.Color }
    uMid: { value: THREE.Color }
    uHorizon: { value: THREE.Color }
    uWarmHorizon: { value: THREE.Color }
  }
  water: THREE.Mesh
  private waterUniforms: {
    uTime: { value: number }
    uWaveHeight: { value: number }
    uDeepColor: { value: THREE.Color }
    uShallowColor: { value: THREE.Color }
    uFoamColor: { value: THREE.Color }
    uSunDirection: { value: THREE.Vector3 }
    uShoreZ: { value: number }
  }
  private sunGlow: THREE.Group
  private birds: THREE.Group
  private bobber: THREE.Mesh
  private fishingLine: THREE.Line
  private rod: THREE.Group
  private pier: THREE.Group
  private village: THREE.Group
  private fightFish: THREE.Group
  private rodTipLocal = new THREE.Vector3(0.08, -0.02, -2.35)
  private zoneSunBoost = 2.05
  yaw = 0
  pitch = -0.14
  private basePosition = new THREE.Vector3(0, 2.48, 3.6)
  sunDirection = new THREE.Vector3(0.38, 0.48, -0.4).normalize()

  private assets: LoadedAssets
  private splash!: THREE.Points

  constructor(width: number, height: number, assets: LoadedAssets, _renderer?: THREE.WebGLRenderer) {
    this.assets = assets
    this.scene = new THREE.Scene()
    this.scene.fog = new THREE.Fog(0x7aa0b8, 50, 220)
    this.scene.environment = assets.envMap

    this.camera = new THREE.PerspectiveCamera(58, width / height, 0.08, 2000)
    this.camera.position.copy(this.basePosition)

    this.waterUniforms = {
      uTime: { value: 0 },
      uWaveHeight: { value: 0.7 },
      uDeepColor: { value: new THREE.Color(0x021c2e) },
      uShallowColor: { value: new THREE.Color(0x0d6582) },
      uFoamColor: { value: new THREE.Color(0xeaf5fa) },
      uSunDirection: { value: this.sunDirection.clone() },
      uShoreZ: { value: 6 },
    }

    this.skyUniforms = {
      uSunDirection: { value: this.sunDirection.clone() },
      uTime: { value: 0 },
      uZenith: { value: new THREE.Color(0x1a479e) },
      uMid: { value: new THREE.Color(0x5799e0) },
      uHorizon: { value: new THREE.Color(0xb3d1eb) },
      uWarmHorizon: { value: new THREE.Color(0xf2b87a) },
    }

    this.setupLights()
    this.createSky()
    this.sunGlow = this.createSunGlow()
    this.water = this.createWater()
    this.birds = this.createBirds()
    this.pier = this.createPier()
    this.rod = new THREE.Group()
    this.setRodTier('bamboo')
    this.bobber = this.createBobber()
    this.fishingLine = this.createLine()
    this.fightFish = this.createFightFish()

    this.createBeach()
    this.createShoreDetail()
    this.splash = createSplashParticles()
    this.village = buildVillage(assets)

    this.scene.add(this.water)
    this.scene.add(this.birds)
    this.scene.add(this.pier)
    this.scene.add(this.village)
    this.scene.add(this.rod)
    this.scene.add(this.bobber)
    this.scene.add(this.fishingLine)
    this.scene.add(this.fightFish)
    this.scene.add(this.splash)

    this.setZone('harbor')
  }

  private setupLights(): void {
    this.sun = new THREE.DirectionalLight(0xfff2dd, 2.1)
    this.sun.position.copy(this.sunDirection.clone().multiplyScalar(80))
    this.sun.castShadow = true
    this.sun.shadow.mapSize.set(4096, 4096)
    this.sun.shadow.bias = -0.0001
    this.sun.shadow.normalBias = 0.03
    this.sun.shadow.radius = 2
    const cam = this.sun.shadow.camera
    cam.near = 1
    cam.far = 140
    cam.left = -22
    cam.right = 22
    cam.top = 22
    cam.bottom = -22
    this.scene.add(this.sun)
    this.scene.add(this.sun.target)
    this.sun.target.position.set(0, 0, 4)

    this.fillLight = new THREE.DirectionalLight(0xa8c8e8, 0.45)
    this.fillLight.position.set(-40, 20, 30)
    this.scene.add(this.fillLight)

    this.rimLight = new THREE.DirectionalLight(0xffc090, 0.5)
    this.rimLight.position.set(25, 6, -40)
    this.scene.add(this.rimLight)

    this.hemi = new THREE.HemisphereLight(0x87b8e0, 0xc2a078, 0.7)
    this.scene.add(this.hemi)

    this.scene.add(new THREE.AmbientLight(0x5a7a94, 0.2))
  }

  private createSky(): THREE.Mesh {
    const sky = new THREE.Mesh(
      new THREE.SphereGeometry(400, 64, 32),
      new THREE.ShaderMaterial({
        vertexShader: skyVertexShader,
        fragmentShader: skyFragmentShader,
        uniforms: this.skyUniforms,
        side: THREE.BackSide,
        depthWrite: false,
      }),
    )
    sky.renderOrder = -20
    this.scene.add(sky)
    return sky
  }

  private createSunGlow(): THREE.Group {
    const group = new THREE.Group()
    const core = new THREE.Mesh(
      new THREE.SphereGeometry(4.5, 24, 24),
      new THREE.MeshBasicMaterial({ color: 0xfff3c8, fog: false, toneMapped: false }),
    )
    const glow = new THREE.Mesh(
      new THREE.SphereGeometry(9, 24, 24),
      new THREE.MeshBasicMaterial({
        color: 0xffc56e,
        transparent: true,
        opacity: 0.16,
        fog: false,
        depthWrite: false,
        toneMapped: false,
      }),
    )
    group.add(core, glow)
    group.position.copy(this.sunDirection.clone().multiplyScalar(280))
    this.scene.add(group)
    return group
  }

  private createWater(): THREE.Mesh {
    const geo = new THREE.PlaneGeometry(280, 280, 180, 180)
    geo.rotateX(-Math.PI / 2)
    const mat = new THREE.ShaderMaterial({
      vertexShader: waterVertexShader,
      fragmentShader: waterFragmentShader,
      uniforms: this.waterUniforms,
      transparent: true,
      side: THREE.FrontSide,
      depthWrite: false,
      fog: false,
    })
    const mesh = new THREE.Mesh(geo, mat)
    mesh.position.set(0, 0.02, -50)
    mesh.renderOrder = 1
    return mesh
  }

  private createBeach(): void {
    const beachGeo = new THREE.PlaneGeometry(100, 60, 120, 60)
    beachGeo.rotateX(-Math.PI / 2)
    const pos = beachGeo.attributes.position
    const colors = new Float32Array(pos.count * 3)
    const dry = new THREE.Color(0xe2bf92)
    const wet = new THREE.Color(0xa87a52)

    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i)
      const z = pos.getZ(i)
      const dune =
        Math.sin(x * 0.11) * 0.35 +
        Math.cos(z * 0.16) * 0.22 +
        Math.sin(x * 0.4 + z * 0.28) * 0.1
      const slope = Math.max(0, (z + 12) * 0.085)
      const ripples = Math.sin(z * 4.2 + x * 0.25) * 0.015 * Math.max(0, 1 - (z + 5) / 22)
      pos.setY(i, dune + slope * 0.5 + ripples)

      const wetness = THREE.MathUtils.smoothstep(z, 10, -4)
      const c = dry.clone().lerp(wet, wetness * 0.9)
      colors[i * 3] = c.r
      colors[i * 3 + 1] = c.g
      colors[i * 3 + 2] = c.b
    }
    beachGeo.setAttribute('color', new THREE.BufferAttribute(colors, 3))
    beachGeo.computeVertexNormals()

    const beach = new THREE.Mesh(
      beachGeo,
      new THREE.MeshStandardMaterial({
        map: this.assets.sandDiff,
        normalMap: this.assets.sandNor,
        roughnessMap: this.assets.sandRough,
        normalScale: new THREE.Vector2(1.1, 1.1),
        vertexColors: true,
        roughness: 1,
        metalness: 0,
        envMapIntensity: 0.3,
      }),
    )
    beach.position.set(0, 0.0, 20)
    beach.receiveShadow = true
    this.scene.add(beach)

    const wetPlane = new THREE.Mesh(
      new THREE.PlaneGeometry(100, 14),
      new THREE.MeshPhysicalMaterial({
        color: 0x9a6e48,
        roughness: 0.22,
        metalness: 0.04,
        clearcoat: 0.7,
        clearcoatRoughness: 0.3,
        envMapIntensity: 1.1,
        transparent: true,
        opacity: 0.78,
      }),
    )
    wetPlane.rotation.x = -Math.PI / 2
    wetPlane.position.set(0, 0.06, 6)
    wetPlane.receiveShadow = true
    this.scene.add(wetPlane)
  }

  private createPier(): THREE.Group {
    const group = new THREE.Group()
    const wood = new THREE.MeshStandardMaterial({
      map: this.assets.woodDiff,
      normalMap: this.assets.woodNor,
      roughnessMap: this.assets.woodRough,
      roughness: 0.78,
      metalness: 0.05,
      envMapIntensity: 0.35,
    })
    const darkWood = new THREE.MeshStandardMaterial({
      map: this.assets.woodDiff,
      normalMap: this.assets.woodNor,
      roughnessMap: this.assets.woodRough,
      color: 0x7a5a3a,
      roughness: 0.88,
      metalness: 0.04,
      envMapIntensity: 0.25,
    })
    const wetWood = new THREE.MeshPhysicalMaterial({
      map: this.assets.woodDiff,
      normalMap: this.assets.woodNor,
      color: 0x5c4030,
      roughness: 0.4,
      metalness: 0.06,
      clearcoat: 0.35,
      clearcoatRoughness: 0.45,
      envMapIntensity: 0.55,
    })

    for (let i = 0; i < 8; i++) {
      const beam = new THREE.Mesh(new THREE.BoxGeometry(4.2, 0.18, 0.22), darkWood)
      beam.position.set(0, 1.15, 11.5 - i * 1.55)
      beam.castShadow = true
      beam.receiveShadow = true
      group.add(beam)
    }

    for (let i = 0; i < 22; i++) {
      const plank = new THREE.Mesh(
        new THREE.BoxGeometry(4.35 + (i % 3) * 0.02, 0.09, 0.52),
        i < 4 ? wetWood : wood,
      )
      plank.position.set(((i % 5) - 2) * 0.01, 1.48, 11.6 - i * 0.58)
      plank.castShadow = true
      plank.receiveShadow = true
      group.add(plank)
    }

    const postGeo = new THREE.CylinderGeometry(0.16, 0.2, 2.6, 14)
    const posts = [
      [-1.85, 0.2, -0.2],
      [1.85, 0.2, -0.2],
      [-1.85, 0.2, 3.5],
      [1.85, 0.2, 3.5],
      [-1.85, 0.2, 7.2],
      [1.85, 0.2, 7.2],
      [-1.85, 0.2, 10.8],
      [1.85, 0.2, 10.8],
    ]
    for (const [x, y, z] of posts) {
      const post = new THREE.Mesh(postGeo, darkWood)
      post.position.set(x, y, z)
      post.castShadow = true
      post.receiveShadow = true
      group.add(post)
      const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.18, 0.12, 12), wood)
      cap.position.set(x, 1.55, z)
      cap.castShadow = true
      group.add(cap)
    }

    for (const z of [1.5, 5.5, 9.2]) {
      for (const side of [-1, 1] as const) {
        const brace = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.1, 2.2), darkWood)
        brace.position.set(side * 1.85, 0.7, z)
        brace.rotation.x = side * 0.55
        brace.castShadow = true
        group.add(brace)
      }
    }

    const ropeMat = new THREE.MeshStandardMaterial({
      color: 0xcbb089,
      roughness: 0.9,
      metalness: 0.02,
    })
    for (const side of [-2.15, 2.15]) {
      const rail = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.1, 12.2), wood)
      rail.position.set(side, 2.22, 5.2)
      rail.castShadow = true
      group.add(rail)
      const rope = new THREE.Mesh(new THREE.CylinderGeometry(0.028, 0.028, 12.0, 8), ropeMat)
      rope.rotation.z = Math.PI / 2
      rope.rotation.y = Math.PI / 2
      rope.position.set(side, 1.95, 5.2)
      group.add(rope)
      for (let i = 0; i < 8; i++) {
        const bal = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.78, 0.08), wood)
        bal.position.set(side, 1.8, 11.2 - i * 1.55)
        bal.castShadow = true
        group.add(bal)
      }
    }

    const metal = new THREE.MeshStandardMaterial({
      color: 0x555c66,
      metalness: 0.8,
      roughness: 0.4,
      envMapIntensity: 0.7,
    })
    for (const x of [-1.2, 1.2]) {
      const base = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.05, 0.14), metal)
      base.position.set(x, 1.545, 0.35)
      base.castShadow = true
      group.add(base)
      const horn = new THREE.Mesh(new THREE.CylinderGeometry(0.028, 0.028, 0.2, 10), metal)
      horn.rotation.z = Math.PI / 2
      horn.position.set(x, 1.6, 0.35)
      horn.castShadow = true
      group.add(horn)
    }

    group.position.set(0, 0, 2)
    return group
  }

  setRodTier(rodId: string): void {
    const id = (['bamboo', 'carbon', 'master'].includes(rodId) ? rodId : 'bamboo') as RodId
    while (this.rod.children.length) {
      const child = this.rod.children[0]
      this.rod.remove(child)
      child.traverse((o) => {
        const m = o as THREE.Mesh
        if (m.isMesh) {
          m.geometry?.dispose()
          const mats = Array.isArray(m.material) ? m.material : [m.material]
          mats.forEach((mat) => mat.dispose())
        }
      })
    }
    const built = this.buildRodModel(id)
    this.rod.add(built)
    this.rodTipLocal.copy(built.userData.tipLocal as THREE.Vector3)
    this.rod.rotation.set(-0.12, -0.08, 0.08)
  }

  setZone(zoneId: string): void {
    const id = (['harbor', 'reef', 'deep'].includes(zoneId) ? zoneId : 'harbor') as ZoneId
    const look = ZONE_LOOK[id]
    const fog = this.scene.fog as THREE.Fog
    fog.color.setHex(look.fog)
    fog.near = look.fogNear
    fog.far = look.fogFar
    this.waterUniforms.uDeepColor.value.setHex(look.deep)
    this.waterUniforms.uShallowColor.value.setHex(look.shallow)
    this.waterUniforms.uFoamColor.value.setHex(look.foam)
    this.waterUniforms.uWaveHeight.value = look.wave
    this.skyUniforms.uZenith.value.setHex(look.zenith)
    this.skyUniforms.uMid.value.setHex(look.mid)
    this.skyUniforms.uHorizon.value.setHex(look.horizon)
    this.skyUniforms.uWarmHorizon.value.setHex(look.warmHorizon)
    this.hemi.color.setHex(look.hemiSky)
    this.hemi.groundColor.setHex(look.hemiGround)
    this.zoneSunBoost = look.sunIntensity
    this.fillLight.intensity = look.fillIntensity
    this.rimLight.intensity = id === 'deep' ? 0.25 : id === 'reef' ? 0.65 : 0.5
    this.rimLight.color.setHex(id === 'reef' ? 0xffb090 : id === 'deep' ? 0x8899bb : 0xffc090)
    this.basePosition.set(look.cam[0], look.cam[1], look.cam[2])
    setVillageZone(this.village, id)
  }

  private buildRodModel(id: RodId): THREE.Group {
    const group = new THREE.Group()
    const cork = new THREE.MeshStandardMaterial({ color: 0xc4a574, roughness: 0.88 })
    const chrome = new THREE.MeshStandardMaterial({
      color: 0xb8c0c8,
      metalness: 0.95,
      roughness: 0.18,
      envMapIntensity: 1.3,
    })

    if (id === 'bamboo') {
      const bamboo = new THREE.MeshPhysicalMaterial({
        color: 0xc4a45a,
        roughness: 0.55,
        metalness: 0.05,
        clearcoat: 0.25,
        clearcoatRoughness: 0.4,
      })
      const wrap = new THREE.MeshStandardMaterial({ color: 0x6b3a22, roughness: 0.7 })
      const blank = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.038, 2.15, 12), bamboo)
      blank.rotation.x = Math.PI / 2
      blank.position.set(0.08, -0.06, -1.0)
      group.add(blank)
      for (const z of [-0.35, -0.85, -1.35, -1.75]) {
        const ring = new THREE.Mesh(new THREE.TorusGeometry(0.02, 0.004, 6, 12), wrap)
        ring.position.set(0.08, -0.02, z)
        group.add(ring)
      }
      for (const z of [-0.55, -1.15, -1.65]) {
        const guide = new THREE.Mesh(new THREE.TorusGeometry(0.018, 0.003, 8, 12), chrome)
        guide.position.set(0.08, -0.02, z)
        group.add(guide)
      }
      const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.045, 0.38, 12), cork)
      handle.rotation.x = Math.PI / 2
      handle.position.set(0.08, -0.08, 0.2)
      group.add(handle)
      // simple wooden reel seat
      const seat = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.08, 10), wrap)
      seat.rotation.x = Math.PI / 2
      seat.position.set(0.08, -0.12, -0.05)
      group.add(seat)
      group.userData.tipLocal = new THREE.Vector3(0.08, -0.02, -2.05)
      return group
    }

    if (id === 'carbon') {
      const carbon = new THREE.MeshPhysicalMaterial({
        color: 0x1a221e,
        roughness: 0.28,
        metalness: 0.55,
        clearcoat: 0.8,
        clearcoatRoughness: 0.15,
        envMapIntensity: 0.9,
      })
      const accent = new THREE.MeshStandardMaterial({
        color: 0xb85c38,
        roughness: 0.4,
        metalness: 0.25,
      })
      const blank = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.04, 2.45, 16), carbon)
      blank.rotation.x = Math.PI / 2
      blank.position.set(0.08, -0.06, -1.15)
      group.add(blank)
      for (const z of [-0.45, -0.95, -1.45, -1.95]) {
        const guide = new THREE.Mesh(new THREE.TorusGeometry(0.02, 0.0035, 8, 14), chrome)
        guide.position.set(0.08, -0.02, z)
        group.add(guide)
      }
      const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.05, 0.42, 14), cork)
      handle.rotation.x = Math.PI / 2
      handle.position.set(0.08, -0.08, 0.22)
      group.add(handle)
      const butt = new THREE.Mesh(new THREE.CylinderGeometry(0.048, 0.042, 0.08, 12), accent)
      butt.rotation.x = Math.PI / 2
      butt.position.set(0.08, -0.08, 0.44)
      group.add(butt)
      group.add(this.buildReel(chrome, accent, cork))
      group.userData.tipLocal = new THREE.Vector3(0.08, -0.02, -2.35)
      return group
    }

    // master — longer, dark graphite + gold
    const graphite = new THREE.MeshPhysicalMaterial({
      color: 0x0c1018,
      roughness: 0.18,
      metalness: 0.7,
      clearcoat: 1,
      clearcoatRoughness: 0.08,
      envMapIntensity: 1.2,
    })
    const gold = new THREE.MeshStandardMaterial({
      color: 0xd4b46a,
      metalness: 0.92,
      roughness: 0.22,
      envMapIntensity: 1.4,
    })
    const blank = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.042, 2.85, 18), graphite)
    blank.rotation.x = Math.PI / 2
    blank.position.set(0.08, -0.05, -1.35)
    group.add(blank)
    for (const z of [-0.35, -0.85, -1.35, -1.85, -2.35]) {
      const wrap = new THREE.Mesh(new THREE.TorusGeometry(0.016, 0.004, 8, 14), gold)
      wrap.position.set(0.08, -0.015, z)
      group.add(wrap)
      const guide = new THREE.Mesh(new THREE.TorusGeometry(0.022, 0.003, 8, 16), chrome)
      guide.position.set(0.08, -0.015, z - 0.08)
      group.add(guide)
    }
    const tipRing = new THREE.Mesh(
      new THREE.TorusGeometry(0.014, 0.0035, 8, 16),
      new THREE.MeshStandardMaterial({
        color: 0xffe2a0,
        emissive: 0x665522,
        emissiveIntensity: 0.35,
        metalness: 0.8,
        roughness: 0.25,
      }),
    )
    tipRing.position.set(0.08, -0.01, -2.7)
    group.add(tipRing)
    const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.048, 0.052, 0.48, 14), cork)
    handle.rotation.x = Math.PI / 2
    handle.position.set(0.08, -0.08, 0.28)
    group.add(handle)
    const butt = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.045, 0.1, 12), gold)
    butt.rotation.x = Math.PI / 2
    butt.position.set(0.08, -0.08, 0.54)
    group.add(butt)
    group.add(this.buildReel(chrome, gold, cork))
    group.userData.tipLocal = new THREE.Vector3(0.08, -0.01, -2.75)
    return group
  }

  private buildReel(
    chrome: THREE.Material,
    accent: THREE.Material,
    cork: THREE.Material,
  ): THREE.Group {
    const reel = new THREE.Group()
    const reelBody = new THREE.Mesh(new THREE.CylinderGeometry(0.065, 0.07, 0.05, 20), chrome)
    reelBody.rotation.z = Math.PI / 2
    reel.add(reelBody)
    const spool = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.035, 16), accent)
    spool.rotation.z = Math.PI / 2
    spool.position.x = 0.02
    reel.add(spool)
    const arm = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.012, 0.018), chrome)
    arm.position.set(0.02, 0.055, 0)
    reel.add(arm)
    const knob = new THREE.Mesh(new THREE.SphereGeometry(0.016, 12, 12), cork)
    knob.position.set(0.02, 0.1, 0)
    reel.add(knob)
    reel.position.set(0.08, -0.16, -0.02)
    return reel
  }

  private createFightFish(): THREE.Group {
    const group = new THREE.Group()
    group.visible = false
    group.name = 'fight-fish'

    const bodyMat = new THREE.MeshPhysicalMaterial({
      color: 0x6a8a9a,
      roughness: 0.35,
      metalness: 0.2,
      clearcoat: 0.55,
      clearcoatRoughness: 0.25,
      sheen: 0.4,
      sheenColor: new THREE.Color(0xb8d4e8),
    })
    const finMat = new THREE.MeshPhysicalMaterial({
      color: 0x4a6a7a,
      roughness: 0.45,
      transparent: true,
      opacity: 0.92,
    })

    const body = new THREE.Mesh(new THREE.SphereGeometry(0.22, 16, 12), bodyMat)
    body.scale.set(1.8, 0.7, 0.85)
    body.name = 'body'
    group.add(body)

    const head = new THREE.Mesh(new THREE.SphereGeometry(0.12, 12, 10), bodyMat)
    head.position.set(0.28, 0.02, 0)
    head.scale.set(1.1, 0.85, 0.9)
    group.add(head)

    const eyeL = new THREE.Mesh(
      new THREE.SphereGeometry(0.035, 10, 8),
      new THREE.MeshPhysicalMaterial({ color: 0xf5f8fc, roughness: 0.2, clearcoat: 1 }),
    )
    eyeL.position.set(0.34, 0.05, 0.08)
    const pupilL = new THREE.Mesh(
      new THREE.SphereGeometry(0.018, 8, 8),
      new THREE.MeshBasicMaterial({ color: 0x101418 }),
    )
    pupilL.position.set(0.02, 0, 0.01)
    eyeL.add(pupilL)
    const eyeR = eyeL.clone()
    eyeR.position.z = -0.08
    group.add(eyeL, eyeR)

    const tail = new THREE.Mesh(new THREE.ConeGeometry(0.14, 0.28, 8), finMat)
    tail.rotation.z = Math.PI / 2
    tail.position.set(-0.42, 0, 0)
    tail.name = 'tail'
    group.add(tail)

    const dorsal = new THREE.Mesh(new THREE.ConeGeometry(0.08, 0.22, 6), finMat)
    dorsal.position.set(0.02, 0.16, 0)
    dorsal.name = 'dorsal'
    group.add(dorsal)

    group.userData.bodyMat = bodyMat
    group.userData.finMat = finMat
    group.castShadow = true
    return group
  }

  showFightFish(color: number, accent: number, _speciesId?: string): void {
    const bodyMat = this.fightFish.userData.bodyMat as THREE.MeshPhysicalMaterial
    const finMat = this.fightFish.userData.finMat as THREE.MeshPhysicalMaterial
    bodyMat.color.setHex(color)
    bodyMat.sheenColor.setHex(accent)
    finMat.color.setHex(accent)
    this.fightFish.visible = true
    this.fightFish.scale.setScalar(0.85)
  }

  hideFightFish(): void {
    this.fightFish.visible = false
  }

  setFightFish(
    position: THREE.Vector3,
    heading: number,
    thrash: number,
    time: number,
    airborne: boolean,
  ): void {
    if (!this.fightFish.visible) return
    this.fightFish.position.copy(position)
    this.fightFish.rotation.y = heading + Math.PI / 2
    this.fightFish.rotation.z = Math.sin(time * (14 + thrash * 10)) * 0.25 * thrash
    this.fightFish.rotation.x = airborne
      ? -0.35 + Math.sin(time * 20) * 0.2
      : Math.sin(time * 8) * 0.08 * thrash

    const tail = this.fightFish.getObjectByName('tail')
    if (tail) tail.rotation.y = Math.sin(time * (18 + thrash * 12)) * 0.55 * (0.4 + thrash)
    const dorsal = this.fightFish.getObjectByName('dorsal')
    if (dorsal) dorsal.rotation.z = Math.sin(time * 10) * 0.15
    this.fightFish.scale.setScalar(0.75 + thrash * 0.12)
  }

  private createBobber(): THREE.Mesh {
    const body = new THREE.Mesh(
      new THREE.SphereGeometry(0.11, 20, 20),
      new THREE.MeshPhysicalMaterial({
        color: 0xe23d2e,
        roughness: 0.3,
        clearcoat: 0.85,
        clearcoatRoughness: 0.15,
        envMapIntensity: 0.9,
      }),
    )
    const tip = new THREE.Mesh(
      new THREE.SphereGeometry(0.055, 14, 14),
      new THREE.MeshPhysicalMaterial({ color: 0xf7f7f5, roughness: 0.4, clearcoat: 0.5 }),
    )
    tip.position.y = 0.1
    body.add(tip)
    const stripe = new THREE.Mesh(
      new THREE.TorusGeometry(0.1, 0.012, 8, 20),
      new THREE.MeshStandardMaterial({ color: 0xf5f5f5, roughness: 0.5 }),
    )
    stripe.rotation.x = Math.PI / 2
    body.add(stripe)
    body.castShadow = true
    body.visible = false
    return body
  }

  private createLine(): THREE.Line {
    const geo = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(),
      new THREE.Vector3(),
    ])
    const line = new THREE.Line(
      geo,
      new THREE.LineBasicMaterial({ color: 0xd5e8f2, transparent: true, opacity: 0.55 }),
    )
    line.visible = false
    line.frustumCulled = false
    return line
  }

  private createBirds(): THREE.Group {
    const group = new THREE.Group()
    const mat = new THREE.MeshStandardMaterial({ color: 0x1a1e24, roughness: 0.85 })
    for (let i = 0; i < 8; i++) {
      const bird = new THREE.Group()
      const wingL = new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.65, 3), mat)
      const wingR = wingL.clone()
      wingL.rotation.z = Math.PI / 2.6
      wingR.rotation.z = -Math.PI / 2.6
      wingL.position.x = -0.14
      wingR.position.x = 0.14
      bird.add(wingL, wingR)
      bird.position.set(
        (Math.random() - 0.5) * 80,
        18 + Math.random() * 16,
        -50 - Math.random() * 60,
      )
      bird.scale.setScalar(0.65 + Math.random() * 0.45)
      bird.userData.speed = 2 + Math.random() * 3
      bird.userData.phase = Math.random() * Math.PI * 2
      group.add(bird)
    }
    return group
  }

  private createShoreDetail(): void {
    const pebbleMat = new THREE.MeshStandardMaterial({
      color: 0xd9cfc0,
      roughness: 0.6,
      metalness: 0.05,
    })
    for (let i = 0; i < 40; i++) {
      const p = new THREE.Mesh(
        new THREE.SphereGeometry(0.04 + Math.random() * 0.06, 6, 6),
        pebbleMat,
      )
      p.scale.y = 0.45
      p.position.set((Math.random() - 0.5) * 30, 0.1, 7 + Math.random() * 14)
      p.rotation.set(Math.random(), Math.random(), Math.random())
      p.castShadow = true
      p.receiveShadow = true
      this.scene.add(p)
    }
  }

  resize(width: number, height: number): void {
    this.camera.aspect = width / height
    this.camera.updateProjectionMatrix()
  }

  applyLook(dx: number, dy: number, sensitivity = 0.0022): void {
    this.yaw -= dx * sensitivity
    this.pitch -= dy * sensitivity
    this.pitch = Math.max(-0.55, Math.min(0.35, this.pitch))
    this.yaw = Math.max(-0.9, Math.min(0.9, this.yaw))
  }

  setBobber(visible: boolean, position?: THREE.Vector3, bobAmount = 0): void {
    this.bobber.visible = visible
    this.fishingLine.visible = visible
    if (position) {
      this.bobber.position.copy(position)
      this.bobber.position.y += bobAmount
    }
  }

  updateLine(tipWorld: THREE.Vector3, bobberPos: THREE.Vector3): void {
    const positions = this.fishingLine.geometry.attributes.position as THREE.BufferAttribute
    positions.setXYZ(0, tipWorld.x, tipWorld.y, tipWorld.z)
    positions.setXYZ(1, bobberPos.x, bobberPos.y, bobberPos.z)
    positions.needsUpdate = true
  }

  getRodTipWorld(): THREE.Vector3 {
    const tip = this.rodTipLocal.clone()
    tip.applyMatrix4(this.rod.matrixWorld)
    return tip
  }

  setRodCastPose(progress: number): void {
    this.rod.rotation.x = -0.12 - progress * 0.3
    this.rod.rotation.z = 0.08 + progress * 0.12
  }

  setRodFight(amount: number, time: number): void {
    this.rod.rotation.x = -0.28 + Math.sin(time * 12) * amount * 0.12
    this.rod.rotation.z = 0.12 + Math.cos(time * 9) * amount * 0.08
  }

  playSplash(at?: THREE.Vector3): void {
    burstSplash(this.splash, at ?? this.bobber.position)
  }

  update(dt: number, time: number): void {
    updateSplash(this.splash, dt)
    const sunAngle = 0.52 + Math.sin(time * 0.012) * 0.03
    this.sunDirection.set(0.35, sunAngle, -0.45).normalize()
    this.sun.position.copy(this.sunDirection.clone().multiplyScalar(80))
    this.sun.intensity = this.zoneSunBoost + Math.sin(time * 0.02) * 0.12
    this.hemi.intensity = 0.55 + Math.sin(time * 0.018) * 0.03

    this.skyUniforms.uTime.value = time
    this.skyUniforms.uSunDirection.value.copy(this.sunDirection)
    this.waterUniforms.uTime.value = time
    this.waterUniforms.uSunDirection.value.copy(this.sunDirection)
    this.sunGlow.position.copy(this.sunDirection.clone().multiplyScalar(280))

    for (const bird of this.birds.children) {
      const speed = bird.userData.speed as number
      const phase = bird.userData.phase as number
      bird.position.x += speed * dt * 0.35
      bird.position.y += Math.sin(time * 1.8 + phase) * 0.012
      bird.rotation.z = Math.sin(time * 7 + phase) * 0.3
      if (bird.position.x > 60) bird.position.x = -60
    }

    const lookQuat = new THREE.Quaternion().setFromEuler(
      new THREE.Euler(this.pitch, this.yaw, 0, 'YXZ'),
    )
    this.camera.quaternion.copy(lookQuat)
    const bob = Math.sin(time * 1.15) * 0.012
    this.camera.position.set(
      this.basePosition.x,
      this.basePosition.y + bob,
      this.basePosition.z,
    )

    this.rod.position.copy(this.camera.position)
    this.rod.quaternion.copy(this.camera.quaternion)
    this.rod.translateX(0.3)
    this.rod.translateY(-0.28)
    this.rod.translateZ(-0.42)
  }

  sampleWaveHeight(x: number, z: number, time: number): number {
    const localX = x - this.water.position.x
    const localZ = z - this.water.position.z
    const h = this.waterUniforms.uWaveHeight.value
    const w1 = Math.sin(localX * 0.07 + time * 0.65) * Math.cos(localZ * 0.055 + time * 0.48)
    const w2 = Math.sin(localX * 0.14 + localZ * 0.11 + time * 1.05) * 0.42
    const w3 = Math.sin(localX * 0.028 + time * 0.32) * Math.cos(localZ * 0.036 - time * 0.38) * 0.85
    const w4 = Math.sin((localX + localZ) * 0.22 + time * 1.65) * 0.16
    const w5 = Math.sin(localX * 0.45 - localZ * 0.3 + time * 2.4) * 0.06
    return (w1 + w2 + w3 + w4 + w5) * h + this.water.position.y
  }
}
