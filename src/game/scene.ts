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
  updateSplash,
} from './village'

export class SeasideScene {
  scene: THREE.Scene
  camera: THREE.PerspectiveCamera
  sun!: THREE.DirectionalLight
  private fillLight!: THREE.DirectionalLight
  private hemi!: THREE.HemisphereLight
  private skyUniforms: {
    uSunDirection: { value: THREE.Vector3 }
    uTime: { value: number }
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
    }

    this.setupLights()
    this.createSky()
    this.sunGlow = this.createSunGlow()
    this.water = this.createWater()
    this.birds = this.createBirds()
    this.pier = this.createPier()
    this.rod = this.createRod()
    this.bobber = this.createBobber()
    this.fishingLine = this.createLine()

    this.createBeach()
    this.createShoreDetail()
    this.splash = createSplashParticles()

    this.scene.add(this.water)
    this.scene.add(this.birds)
    this.scene.add(this.pier)
    this.scene.add(buildVillage(assets))
    this.scene.add(this.rod)
    this.scene.add(this.bobber)
    this.scene.add(this.fishingLine)
    this.scene.add(this.splash)
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

    const rim = new THREE.DirectionalLight(0xffc090, 0.5)
    rim.position.set(25, 6, -40)
    this.scene.add(rim)

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

  private createRod(): THREE.Group {
    const group = new THREE.Group()
    const carbon = new THREE.MeshPhysicalMaterial({
      color: 0x1a221e,
      roughness: 0.28,
      metalness: 0.55,
      clearcoat: 0.8,
      clearcoatRoughness: 0.15,
      envMapIntensity: 0.9,
    })
    const cork = new THREE.MeshStandardMaterial({ color: 0xc4a574, roughness: 0.88 })
    const chrome = new THREE.MeshStandardMaterial({
      color: 0xb8c0c8,
      metalness: 0.95,
      roughness: 0.18,
      envMapIntensity: 1.3,
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
    group.add(reel)

    group.rotation.set(-0.12, -0.08, 0.08)
    return group
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
    const tip = new THREE.Vector3(0.08, -0.02, -2.35)
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
    this.sun.intensity = 2.0 + Math.sin(time * 0.02) * 0.12
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
