import * as THREE from 'three'
import { cloneModel, type LoadedAssets } from './assets'

/** Assemble harbor props from Kenney / Poly Pizza CC0 models */
export function buildVillage(assets: LoadedAssets): THREE.Group {
  const root = new THREE.Group()
  root.name = 'village'

  const place = (
    key: string,
    x: number,
    y: number,
    z: number,
    scale = 1,
    rotY = 0,
  ) => {
    const src = assets.models[key]
    if (!src) return
    const m = cloneModel(src, scale)
    m.position.set(x, y, z)
    m.rotation.y = rotY
    root.add(m)
  }

  // extended dock pieces toward shore
  place('dock', -3.5, 1.2, 12, 1.2, 0)
  place('dock', 3.5, 1.2, 12, 1.2, 0)
  place('platform', 0, 1.15, 14.5, 1.4, 0)
  place('platform2', -5, 1.1, 16, 1.1, 0.2)
  place('platform2', 5.2, 1.1, 15.5, 1.1, -0.15)

  // fishing stand market stall
  place('fishing_stand', -7.5, 0.05, 17.5, 1.8, 0.4)
  place('fishing_stand', 8.2, 0.05, 18, 1.6, -0.5)

  // boat moored near pier
  place('boat', 6.5, 0.15, 2.5, 1.4, -0.6)
  place('boat', -8, 0.1, 5, 1.2, 0.9)

  // crates & barrels (fish market feel)
  place('crate', -2.2, 1.55, 0.8, 0.9, 0.3)
  place('crate', -1.5, 1.55, 1.1, 0.7, -0.2)
  place('barrel', 2.4, 1.55, 0.6, 0.85, 0.1)
  place('barrel', 2.9, 1.55, 1.2, 0.7, 0.8)
  place('crate', 7.5, 0.1, 16.5, 1, 0.5)
  place('barrel', -6.8, 0.1, 15.8, 1, 0.2)

  // rocks along shoreline
  place('rock2', -9, 0.05, 8, 1.4, 0.3)
  place('rock2', 10, 0.0, 9.5, 1.8, 1.1)
  place('rock2', -11, 0.0, 13, 1.2, 0.7)
  place('rock2', 12, 0.05, 14, 1.5, -0.4)

  // trees inland
  place('tree', -14, 0, 20, 1.3, 0.2)
  place('tree', 13, 0, 21, 1.5, 1.0)
  place('tree', -10, 0, 24, 1.1, 0.6)
  place('tree', 9, 0, 25, 1.2, -0.3)

  return root
}

export function createSplashParticles(): THREE.Points {
  const count = 48
  const positions = new Float32Array(count * 3)
  const velocities: THREE.Vector3[] = []
  for (let i = 0; i < count; i++) {
    positions[i * 3] = 0
    positions[i * 3 + 1] = -10
    positions[i * 3 + 2] = 0
    velocities.push(new THREE.Vector3())
  }
  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3))
  const mat = new THREE.PointsMaterial({
    color: 0xdff6ff,
    size: 0.12,
    transparent: true,
    opacity: 0.85,
    depthWrite: false,
  })
  const points = new THREE.Points(geo, mat)
  points.visible = false
  points.userData.velocities = velocities
  points.userData.life = 0
  points.frustumCulled = false
  return points
}

export function burstSplash(points: THREE.Points, origin: THREE.Vector3): void {
  const pos = points.geometry.attributes.position as THREE.BufferAttribute
  const velocities = points.userData.velocities as THREE.Vector3[]
  for (let i = 0; i < velocities.length; i++) {
    pos.setXYZ(
      i,
      origin.x + (Math.random() - 0.5) * 0.3,
      origin.y + Math.random() * 0.2,
      origin.z + (Math.random() - 0.5) * 0.3,
    )
    velocities[i].set(
      (Math.random() - 0.5) * 2.5,
      1.5 + Math.random() * 3.5,
      (Math.random() - 0.5) * 2.5,
    )
  }
  pos.needsUpdate = true
  points.userData.life = 0.9
  points.visible = true
}

export function updateSplash(points: THREE.Points, dt: number): void {
  if (!points.visible) return
  let life = points.userData.life as number
  life -= dt
  points.userData.life = life
  if (life <= 0) {
    points.visible = false
    return
  }
  const pos = points.geometry.attributes.position as THREE.BufferAttribute
  const velocities = points.userData.velocities as THREE.Vector3[]
  const mat = points.material as THREE.PointsMaterial
  mat.opacity = Math.max(0, life)
  for (let i = 0; i < velocities.length; i++) {
    const v = velocities[i]
    v.y -= 9.0 * dt
    pos.setXYZ(i, pos.getX(i) + v.x * dt, pos.getY(i) + v.y * dt, pos.getZ(i) + v.z * dt)
  }
  pos.needsUpdate = true
}
