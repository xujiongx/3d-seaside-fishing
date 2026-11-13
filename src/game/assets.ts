import * as THREE from 'three'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
import { HDRLoader } from 'three/addons/loaders/HDRLoader.js'

export interface LoadedAssets {
  sandDiff: THREE.Texture
  sandNor: THREE.Texture
  sandRough: THREE.Texture
  woodDiff: THREE.Texture
  woodNor: THREE.Texture
  woodRough: THREE.Texture
  waterNormals: THREE.Texture
  envMap: THREE.Texture
  models: Record<string, THREE.Group>
}

const MODEL_FILES = [
  'fishing_stand',
  'boat',
  'dock',
  'rock2',
  'crate',
  'barrel',
  'platform',
  'platform2',
  'tree',
] as const

function prepColor(tex: THREE.Texture, repeatX = 1, repeatY = 1): THREE.Texture {
  tex.colorSpace = THREE.SRGBColorSpace
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping
  tex.repeat.set(repeatX, repeatY)
  tex.anisotropy = 8
  return tex
}

function prepLinear(tex: THREE.Texture, repeatX = 1, repeatY = 1): THREE.Texture {
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping
  tex.repeat.set(repeatX, repeatY)
  tex.anisotropy = 8
  return tex
}

export async function loadGameAssets(renderer: THREE.WebGLRenderer): Promise<LoadedAssets> {
  const texLoader = new THREE.TextureLoader()
  const gltfLoader = new GLTFLoader()
  const rgbe = new HDRLoader()

  const [
    sandDiff,
    sandNor,
    sandRough,
    woodDiff,
    woodNor,
    woodRough,
    waterNormals,
    hdr,
    ...gltfResults
  ] = await Promise.all([
    texLoader.loadAsync('/assets/textures/sand_diff.jpg'),
    texLoader.loadAsync('/assets/textures/sand_nor.jpg'),
    texLoader.loadAsync('/assets/textures/sand_rough.jpg'),
    texLoader.loadAsync('/assets/textures/wood_diff.jpg'),
    texLoader.loadAsync('/assets/textures/wood_nor.jpg'),
    texLoader.loadAsync('/assets/textures/wood_rough.jpg'),
    texLoader.loadAsync('/assets/textures/waternormals.jpg'),
    rgbe.loadAsync('/assets/textures/env.hdr'),
    ...MODEL_FILES.map((name) => gltfLoader.loadAsync(`/assets/models/${name}.glb`)),
  ])

  const pmrem = new THREE.PMREMGenerator(renderer)
  const envMap = pmrem.fromEquirectangular(hdr).texture
  hdr.dispose()
  pmrem.dispose()

  const models: Record<string, THREE.Group> = {}
  MODEL_FILES.forEach((name, i) => {
    const root = gltfResults[i].scene
    root.traverse((obj) => {
      const mesh = obj as THREE.Mesh
      if (mesh.isMesh) {
        mesh.castShadow = true
        mesh.receiveShadow = true
      }
    })
    models[name] = root
  })

  return {
    sandDiff: prepColor(sandDiff, 10, 6),
    sandNor: prepLinear(sandNor, 10, 6),
    sandRough: prepLinear(sandRough, 10, 6),
    woodDiff: prepColor(woodDiff, 2, 2),
    woodNor: prepLinear(woodNor, 2, 2),
    woodRough: prepLinear(woodRough, 2, 2),
    waterNormals: prepLinear(waterNormals, 4, 4),
    envMap,
    models,
  }
}

export function cloneModel(source: THREE.Group, scale = 1): THREE.Group {
  const c = source.clone(true)
  c.scale.setScalar(scale)
  c.traverse((obj) => {
    const mesh = obj as THREE.Mesh
    if (mesh.isMesh) {
      mesh.castShadow = true
      mesh.receiveShadow = true
    }
  })
  return c
}
