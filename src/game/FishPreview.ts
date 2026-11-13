import * as THREE from 'three'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js'

const gltfLoader = new GLTFLoader()
const draco = new DRACOLoader()
draco.setDecoderPath('/draco/')
gltfLoader.setDRACOLoader(draco)

const cache = new Map<string, THREE.Group>()

function deepCloneModel(source: THREE.Group): THREE.Group {
  const clone = source.clone(true)
  // Mesh.clone shares geometry — copy so dispose won't poison the cache
  clone.traverse((obj) => {
    const mesh = obj as THREE.Mesh
    if (mesh.isMesh && mesh.geometry) {
      mesh.geometry = mesh.geometry.clone()
    }
  })
  return clone
}

async function loadModel(path: string): Promise<THREE.Group> {
  const hit = cache.get(path)
  if (hit) return deepCloneModel(hit)
  const gltf = await gltfLoader.loadAsync(path)
  cache.set(path, gltf.scene)
  return deepCloneModel(gltf.scene)
}

function isEyeMaterial(src: THREE.MeshStandardMaterial, meshName: string): boolean {
  const n = `${meshName} ${src.name ?? ''}`.toLowerCase()
  if (/eye|pupil|sclera|iris/.test(n)) return true
  const c = src.color
  if (!c) return false
  const lum = 0.2126 * c.r + 0.7152 * c.g + 0.0722 * c.b
  return lum > 0.85 || lum < 0.12
}

function enhanceFish(
  root: THREE.Object3D,
  color: number,
  accent: number,
  preserveMaps: boolean,
): void {
  const base = new THREE.Color(color)
  const hi = new THREE.Color(accent)
  root.traverse((obj) => {
    const mesh = obj as THREE.Mesh
    if (!mesh.isMesh) return
    const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material]
    mesh.material = mats.map((m) => {
      const src = m as THREE.MeshStandardMaterial
      const hasMap = Boolean(src.map)
      const keepEye = !hasMap && isEyeMaterial(src, mesh.name)

      if (keepEye) {
        return new THREE.MeshPhysicalMaterial({
          color: src.color?.clone() ?? new THREE.Color(0xffffff),
          roughness: 0.22,
          metalness: 0.05,
          clearcoat: 1,
          clearcoatRoughness: 0.12,
        })
      }

      const next = new THREE.MeshPhysicalMaterial({
        color: hasMap && preserveMaps ? 0xffffff : base.clone().offsetHSL(0, 0.04, 0.03),
        map: src.map ?? null,
        normalMap: src.normalMap ?? null,
        roughnessMap: src.roughnessMap ?? null,
        metalnessMap: src.metalnessMap ?? null,
        aoMap: src.aoMap ?? null,
        roughness: hasMap ? Math.min(0.55, src.roughness ?? 0.45) : 0.38,
        metalness: hasMap ? Math.min(0.35, src.metalness ?? 0.2) : 0.12,
        clearcoat: 0.45,
        clearcoatRoughness: 0.28,
        sheen: 0.35,
        sheenColor: hi,
        sheenRoughness: 0.45,
      })
      if (hasMap && !preserveMaps) {
        next.color = new THREE.Color(0xffffff).lerp(base, 0.28)
      }
      if (src.normalScale) next.normalScale.copy(src.normalScale)
      // ensure vertex colors from stylized packs still show
      if (src.vertexColors) next.vertexColors = true
      return next
    })
    mesh.castShadow = true
    mesh.frustumCulled = false
  })
}

function fitCamera(root: THREE.Object3D, camera: THREE.PerspectiveCamera): void {
  root.updateMatrixWorld(true)
  const box = new THREE.Box3().setFromObject(root)
  if (box.isEmpty()) {
    camera.position.set(0, 0.4, 2.2)
    camera.lookAt(0, 0, 0)
    return
  }
  const size = box.getSize(new THREE.Vector3())
  const center = box.getCenter(new THREE.Vector3())
  root.position.sub(center)
  const maxDim = Math.max(size.x, size.y, size.z, 0.001)
  root.scale.setScalar(1.55 / maxDim)
  root.updateMatrixWorld(true)

  const box2 = new THREE.Box3().setFromObject(root)
  const c2 = box2.getCenter(new THREE.Vector3())
  root.position.sub(c2)

  // Prefer a 3/4 view so flat side-profile fish still read clearly
  const dist = 2.35
  camera.position.set(dist * 0.55, dist * 0.28, dist * 0.85)
  camera.near = 0.05
  camera.far = 40
  camera.lookAt(0, 0, 0)
  camera.updateProjectionMatrix()
}

export class FishPreview {
  private canvas: HTMLCanvasElement
  private renderer: THREE.WebGLRenderer
  private scene = new THREE.Scene()
  private camera: THREE.PerspectiveCamera
  private root: THREE.Group | null = null
  private raf = 0
  private running = false
  private generation = 0

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas
    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      alpha: true,
      powerPreference: 'low-power',
      failIfMajorPerformanceCaveat: false,
    })
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    this.renderer.setClearColor(0x000000, 0)
    this.renderer.outputColorSpace = THREE.SRGBColorSpace
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping
    this.renderer.toneMappingExposure = 1.2

    this.camera = new THREE.PerspectiveCamera(35, 1, 0.05, 40)
    this.scene.add(new THREE.AmbientLight(0xd0e4f0, 0.7))
    this.scene.add(new THREE.HemisphereLight(0xc8e4f8, 0x3a2a18, 0.9))
    const key = new THREE.DirectionalLight(0xfff2dc, 2.1)
    key.position.set(2.2, 3.2, 2.4)
    this.scene.add(key)
    const rim = new THREE.DirectionalLight(0x88c4ff, 0.7)
    rim.position.set(-2.4, 1.2, -1.8)
    this.scene.add(rim)
  }

  private resize(): void {
    const rect = this.canvas.getBoundingClientRect()
    const w = Math.max(1, Math.floor(rect.width || this.canvas.clientWidth || 320))
    const h = Math.max(1, Math.floor(rect.height || this.canvas.clientHeight || 160))
    this.renderer.setSize(w, h, false)
    this.camera.aspect = w / h
    this.camera.updateProjectionMatrix()
  }

  async show(
    path: string,
    color: number,
    accent: number,
    preserveMaps = false,
  ): Promise<boolean> {
    const gen = ++this.generation
    this.clearRoot()

    // wait until catch card is laid out (was display:none)
    await new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => r())))
    if (gen !== this.generation) return false
    this.resize()

    try {
      const model = await loadModel(path)
      if (gen !== this.generation) {
        this.disposeObject(model)
        return false
      }
      enhanceFish(model, color, accent, preserveMaps)
      fitCamera(model, this.camera)
      this.root = model
      this.scene.add(model)
      this.resize()
      this.start()
      // force a couple frames immediately
      this.renderer.render(this.scene, this.camera)
      return true
    } catch (err) {
      console.warn('Fish preview failed', path, err)
      return false
    }
  }

  private disposeObject(root: THREE.Object3D): void {
    root.traverse((o) => {
      const m = o as THREE.Mesh
      if (!m.isMesh) return
      m.geometry?.dispose()
      const mats = Array.isArray(m.material) ? m.material : [m.material]
      mats.forEach((mat) => mat.dispose())
    })
  }

  private clearRoot(): void {
    if (!this.root) return
    this.scene.remove(this.root)
    this.disposeObject(this.root)
    this.root = null
  }

  private start(): void {
    if (this.running) return
    this.running = true
    const tick = () => {
      if (!this.running) return
      if (this.root) {
        this.root.rotation.y += 0.012
        this.root.position.y = Math.sin(performance.now() * 0.0018) * 0.03
      }
      this.renderer.render(this.scene, this.camera)
      this.raf = requestAnimationFrame(tick)
    }
    this.raf = requestAnimationFrame(tick)
  }

  stop(): void {
    this.running = false
    cancelAnimationFrame(this.raf)
  }

  dispose(): void {
    this.generation++
    this.stop()
    this.clearRoot()
    this.renderer.dispose()
  }
}
