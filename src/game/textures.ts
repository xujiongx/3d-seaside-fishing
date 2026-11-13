import * as THREE from 'three'

function makeCanvas(size: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('2d context unavailable')
  return [canvas, ctx]
}

function hash(x: number, y: number): number {
  const n = Math.sin(x * 127.1 + y * 311.7) * 43758.5453
  return n - Math.floor(n)
}

function noise(x: number, y: number): number {
  const ix = Math.floor(x)
  const iy = Math.floor(y)
  const fx = x - ix
  const fy = y - iy
  const ux = fx * fx * (3 - 2 * fx)
  const uy = fy * fy * (3 - 2 * fy)
  const a = hash(ix, iy)
  const b = hash(ix + 1, iy)
  const c = hash(ix, iy + 1)
  const d = hash(ix + 1, iy + 1)
  return a + (b - a) * ux + (c - a) * uy + (a - b - c + d) * ux * uy
}

function fbm(x: number, y: number, octaves = 5): number {
  let v = 0
  let a = 0.5
  let f = 1
  for (let i = 0; i < octaves; i++) {
    v += a * noise(x * f, y * f)
    a *= 0.5
    f *= 2
  }
  return v
}

export function createWoodTexture(size = 512): THREE.CanvasTexture {
  const [canvas, ctx] = makeCanvas(size)
  const img = ctx.createImageData(size, size)
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const u = x / size
      const v = y / size
      const grain = fbm(u * 3, v * 28, 4)
      const ring = Math.sin((v + grain * 0.08) * Math.PI * 18) * 0.5 + 0.5
      const knot = Math.exp(-((u - 0.35) ** 2 + (v - 0.55) ** 2) * 80) * 0.35
      const base = 0.28 + grain * 0.34 + ring * 0.18 - knot
      const r = Math.floor((70 + base * 120) * (1 - knot * 0.35))
      const g = Math.floor((42 + base * 70) * (1 - knot * 0.25))
      const b = Math.floor(18 + base * 36)
      const i = (y * size + x) * 4
      img.data[i] = r
      img.data[i + 1] = g
      img.data[i + 2] = b
      img.data[i + 3] = 255
    }
  }
  ctx.putImageData(img, 0, 0)
  const tex = new THREE.CanvasTexture(canvas)
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping
  tex.colorSpace = THREE.SRGBColorSpace
  tex.anisotropy = 8
  return tex
}

export function createWoodRoughness(size = 256): THREE.CanvasTexture {
  const [canvas, ctx] = makeCanvas(size)
  const img = ctx.createImageData(size, size)
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const n = fbm(x / size * 6, y / size * 20, 3)
      const v = Math.floor(140 + n * 90)
      const i = (y * size + x) * 4
      img.data[i] = img.data[i + 1] = img.data[i + 2] = v
      img.data[i + 3] = 255
    }
  }
  ctx.putImageData(img, 0, 0)
  const tex = new THREE.CanvasTexture(canvas)
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping
  return tex
}

export function createSandTexture(size = 512): THREE.CanvasTexture {
  const [canvas, ctx] = makeCanvas(size)
  const img = ctx.createImageData(size, size)
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const n = fbm(x / size * 18, y / size * 18, 5)
      const speck = hash(x * 0.7, y * 0.9)
      const tone = 0.72 + n * 0.18 + (speck > 0.92 ? 0.08 : 0) - (speck < 0.08 ? 0.06 : 0)
      const r = Math.floor(210 * tone)
      const g = Math.floor(178 * tone)
      const b = Math.floor(132 * tone)
      const i = (y * size + x) * 4
      img.data[i] = r
      img.data[i + 1] = g
      img.data[i + 2] = b
      img.data[i + 3] = 255
    }
  }
  ctx.putImageData(img, 0, 0)
  const tex = new THREE.CanvasTexture(canvas)
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping
  tex.colorSpace = THREE.SRGBColorSpace
  tex.repeat.set(8, 5)
  tex.anisotropy = 8
  return tex
}

export function createSandNormal(size = 256): THREE.CanvasTexture {
  const [canvas, ctx] = makeCanvas(size)
  const height = new Float32Array(size * size)
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      height[y * size + x] = fbm(x / size * 22, y / size * 22, 4)
    }
  }
  const img = ctx.createImageData(size, size)
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const l = height[y * size + ((x - 1 + size) % size)]
      const r = height[y * size + ((x + 1) % size)]
      const d = height[((y - 1 + size) % size) * size + x]
      const u = height[((y + 1) % size) * size + x]
      const nx = (l - r) * 4
      const ny = (d - u) * 4
      const nz = 1
      const len = Math.hypot(nx, ny, nz)
      const i = (y * size + x) * 4
      img.data[i] = Math.floor((nx / len) * 0.5 + 0.5) * 255
      img.data[i + 1] = Math.floor((ny / len) * 0.5 + 0.5) * 255
      img.data[i + 2] = Math.floor((nz / len) * 0.5 + 0.5) * 255
      img.data[i + 3] = 255
    }
  }
  ctx.putImageData(img, 0, 0)
  const tex = new THREE.CanvasTexture(canvas)
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping
  tex.repeat.set(8, 5)
  return tex
}

export function createRockTexture(size = 256): THREE.CanvasTexture {
  const [canvas, ctx] = makeCanvas(size)
  const img = ctx.createImageData(size, size)
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const n = fbm(x / size * 10, y / size * 10, 5)
      const crack = Math.pow(Math.abs(Math.sin(n * 40)), 8)
      const tone = 0.35 + n * 0.35 - crack * 0.15
      const r = Math.floor(95 * tone + 20)
      const g = Math.floor(98 * tone + 22)
      const b = Math.floor(102 * tone + 24)
      const i = (y * size + x) * 4
      img.data[i] = r
      img.data[i + 1] = g
      img.data[i + 2] = b
      img.data[i + 3] = 255
    }
  }
  ctx.putImageData(img, 0, 0)
  const tex = new THREE.CanvasTexture(canvas)
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping
  tex.colorSpace = THREE.SRGBColorSpace
  tex.anisotropy = 4
  return tex
}

export function createFoamTexture(size = 256): THREE.CanvasTexture {
  const [canvas, ctx] = makeCanvas(size)
  const img = ctx.createImageData(size, size)
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const n = fbm(x / size * 8, y / size * 8, 4)
      const v = Math.floor(180 + n * 75)
      const i = (y * size + x) * 4
      img.data[i] = img.data[i + 1] = img.data[i + 2] = v
      img.data[i + 3] = Math.floor(n * 200)
    }
  }
  ctx.putImageData(img, 0, 0)
  const tex = new THREE.CanvasTexture(canvas)
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping
  return tex
}
