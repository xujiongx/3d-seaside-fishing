import * as THREE from 'three'

/** Procedural tileable water normal map */
export function createWaterNormals(size = 512): THREE.CanvasTexture {
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('2d unavailable')

  const height = new Float32Array(size * size)
  const hash = (x: number, y: number) => {
    const n = Math.sin(x * 127.1 + y * 311.7) * 43758.5453
    return n - Math.floor(n)
  }
  const noise = (x: number, y: number) => {
    const ix = Math.floor(x)
    const iy = Math.floor(y)
    const fx = x - ix
    const fy = y - iy
    const ux = fx * fx * (3 - 2 * fx)
    const uy = fy * fy * (3 - 2 * fy)
    return (
      hash(ix, iy) +
      (hash(ix + 1, iy) - hash(ix, iy)) * ux +
      (hash(ix, iy + 1) - hash(ix, iy)) * uy +
      (hash(ix, iy) - hash(ix + 1, iy) - hash(ix, iy + 1) + hash(ix + 1, iy + 1)) * ux * uy
    )
  }
  const fbm = (x: number, y: number) => {
    let v = 0
    let a = 0.5
    let f = 1
    for (let i = 0; i < 5; i++) {
      v += a * noise(x * f, y * f)
      a *= 0.5
      f *= 2.1
    }
    return v
  }

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const u = x / size
      const v = y / size
      height[y * size + x] =
        fbm(u * 6, v * 6) * 0.65 +
        Math.sin(u * Math.PI * 10) * Math.cos(v * Math.PI * 8) * 0.12 +
        fbm(u * 18, v * 18) * 0.25
    }
  }

  const img = ctx.createImageData(size, size)
  const strength = 2.8
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const l = height[y * size + ((x - 1 + size) % size)]
      const r = height[y * size + ((x + 1) % size)]
      const d = height[((y - 1 + size) % size) * size + x]
      const u = height[((y + 1) % size) * size + x]
      let nx = (l - r) * strength
      let ny = (d - u) * strength
      let nz = 1
      const len = Math.hypot(nx, ny, nz)
      nx /= len
      ny /= len
      nz /= len
      const i = (y * size + x) * 4
      img.data[i] = Math.floor(nx * 127.5 + 127.5)
      img.data[i + 1] = Math.floor(ny * 127.5 + 127.5)
      img.data[i + 2] = Math.floor(nz * 127.5 + 127.5)
      img.data[i + 3] = 255
    }
  }
  ctx.putImageData(img, 0, 0)

  const tex = new THREE.CanvasTexture(canvas)
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping
  tex.anisotropy = 8
  return tex
}
