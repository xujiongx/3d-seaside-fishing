/** Species → CC0 GLB with built-in eyes (3DAssets.dev / Khronos) */

export interface FishVisual {
  model: string
  thumb: string
  /** Keep embedded PBR maps (Barramundi) */
  preserveMaps?: boolean
}

const F = '/assets/models/fish'

export const FISH_VISUAL: Record<string, FishVisual> = {
  sardine: { model: `${F}/ocean_flying.glb`, thumb: `${F}/ocean_flying.webp` },
  yellowcroaker: { model: `${F}/lake_carp.glb`, thumb: `${F}/lake_carp.webp` },
  seabass: { model: `${F}/lake_perch.glb`, thumb: `${F}/lake_perch.webp` },
  porgy: { model: `${F}/harbor_bream.glb`, thumb: `${F}/harbor_bream.webp` },
  mackerel: { model: `${F}/ocean_barra.glb`, thumb: `${F}/ocean_barra.webp` },
  grouper: {
    model: `${F}/barramundi.glb`,
    thumb: `${F}/harbor_salmon.webp`,
    preserveMaps: true,
  },
  tuna: { model: `${F}/ocean_tuna.glb`, thumb: `${F}/ocean_tuna.webp` },
  marlin: { model: `${F}/ocean_marlin.glb`, thumb: `${F}/ocean_marlin.webp` },
  moonfish: { model: `${F}/ocean_sunfish.glb`, thumb: `${F}/ocean_sunfish.webp` },
  coraldragon: { model: `${F}/ocean_mahi.glb`, thumb: `${F}/ocean_mahi.webp` },
  poseidonscale: {
    model: `${F}/barramundi.glb`,
    thumb: `${F}/ocean_swordfish.webp`,
    preserveMaps: true,
  },
}

const FALLBACK: FishVisual = {
  model: `${F}/lake_trout.glb`,
  thumb: `${F}/lake_trout.webp`,
}

export function fishVisual(speciesId: string): FishVisual {
  return FISH_VISUAL[speciesId] ?? FALLBACK
}

export function fishModelPath(speciesId: string): string {
  return fishVisual(speciesId).model
}

export function fishThumbPath(speciesId: string): string {
  return fishVisual(speciesId).thumb
}
