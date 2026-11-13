import * as THREE from 'three'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js'

const gltfLoader = new GLTFLoader()
const draco = new DRACOLoader()
draco.setDecoderPath('/draco/')
gltfLoader.setDRACOLoader(draco)

const cache = new Map<string, THREE.Group>()

async function loadModel(path: string): Promise<THREE.Group> {
  const hit = cache.get(path)
  if (hit) return hit.clone(true)
  const gltf = await gltfLoader.loadAsync(path)
  cache.set(path, gltf.scene)
  return gltf.scene.clone(true)
}

function isEyeMaterial(src: THREE.MeshStandardMaterial, meshName: string): boolean {
  const n = `${meshName} ${src.name ?? ''}`.toLowerCase()
  if (/eye|pupil|sclera|iris/.test(n)) return true
  const c = src.color
  if (!c) return false
  const lum = 0.2126 * c.r + 0.7152 * c.g + 0.0722 * c.b
  // Keep near-white sclera / near-black pupils from being recolored
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
          envMapIntensity: 1.1,
        })
      }

      const next = new THREE.MeshPhysicalMaterial({
        color: hasMap && preserveMaps ? 0xffffff : base.clone().offsetHSL(0, 0.04, 0.03),
        map: src.map ?? null,
        normalMap: src.normalMap ?? null,
        roughnessMap: src.roughnessMap ?? null,
        metalnessMap: src.metalnessMap ?? null,
        aoMap: src.aoMap ?? null,
        roughness: hasMap ? Math.min(0.55, src.roughness ?? 0.45) : 0.32,
        metalness: hasMap ? Math.min(0.35, src.metalness ?? 0.2) : 0.18,
        clearcoat: 0.65,
        clearcoatRoughness: 0.22,
        sheen: 0.55,
        sheenColor: hi,
        sheenRoughness: 0.4,
        envMapIntensity: 1.05,
        reflectivity: 0.5,
      })
      if (hasMap && !preserveMaps) {
        next.color = new THREE.Color(0xffffff).lerp(base, 0.28)
      }
      if (src.normalScale) next.normalScale.copy(src.normalScale)
      return next
    })
    mesh.castShadow = true
  })
}

function fitCamera(root: THREE.Object3D, camera: THREE.PerspectiveCamera): void {
  const box = new THREE.Box3().setFromObject(root)
  const size = box.getSize(new THREE.Vector3())
  const center = box.getCenter(new THREE.Vector3())
  root.position.sub(center)
  const maxDim = Math.max(size.x, size.y, size.z, 0.001)
  root.scale.setScalar(1.7 / maxDim)
  // re-center after scale
  const box2 = new THREE.Box3().setFromObject(root)
  const c2 = box2.getCenter(new THREE.Vector3())
  root.position.sub(c2)
  camera.position.set(1.55, 0.45, 2.25)
  camera.lookAt(0, 0.05, 0)
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
      powerPreference: 'high-performance',
    })
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    this.renderer.outputColorSpace = THREE.SRGBColorSpace
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping
    this.renderer.toneMappingExposure = 1.12

    this.camera = new THREE.PerspectiveCamera(32, 1, 0.05, 30)
    this.scene.add(new THREE.AmbientLight(0xc8dce8, 0.45))
    this.scene.add(new THREE.HemisphereLight(0xb8d8f0, 0x2a2218, 0.75))
    const key = new THREE.DirectionalLight(0xfff2dc, 1.85)
    key.position.set(2.2, 3.2, 2.4)
    this.scene.add(key)
    const rim = new THREE.DirectionalLight(0x7eb8ff, 0.55)
    rim.position.set(-2.4, 1.2, -1.8)
    this.scene.add(rim)
    const fill = new THREE.DirectionalLight(0xffe8d0, 0.35)
    fill.position.set(0, -1, 2)
    this.scene.add(fill)
  }

  private resize(): void {
    const w = this.canvas.clientWidth || 240
    const h = this.canvas.clientHeight || 160
    this.renderer.setSize(w, h, false)
    this.camera.aspect = w / h
    this.camera.updateProjectionMatrix()
  }

  async show(
    path: string,
    color: number,
    accent: number,
    preserveMaps = false,
  ): Promise<void> {
    const gen = ++this.generation
    this.clearRoot()
    this.resize()
    try {
      const model = await loadModel(path)
      if (gen !== this.generation) {
        model.traverse((o) => {
          const m = o as THREE.Mesh
          if (m.isMesh) {
            m.geometry?.dispose()
            const mats = Array.isArray(m.material) ? m.material : [m.material]
            mats.forEach((mat) => mat.dispose())
          }
        })
        return
      }
      enhanceFish(model, color, accent, preserveMaps)
      fitCamera(model, this.camera)
      this.root = model
      this.scene.add(model)
      this.start()
    } catch (err) {
      console.warn('Fish preview failed', err)
    }
  }

  private clearRoot(): void {
    if (!this.root) return
    this.scene.remove(this.root)
    this.root.traverse((o) => {
      const m = o as THREE.Mesh
      if (m.isMesh) {
        m.geometry?.dispose()
        const mats = Array.isArray(m.material) ? m.material : [m.material]
        mats.forEach((mat) => mat.dispose())
      }
    })
    this.root = null
  }

  private start(): void {
    if (this.running) return
    this.running = true
    const tick = () => {
      if (!this.running) return
      if (this.root) {
        this.root.rotation.y += 0.01
        this.root.position.y = Math.sin(performance.now() * 0.0018) * 0.04
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
