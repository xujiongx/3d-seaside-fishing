import type { FishSpecies, Rarity } from './fishData'
import { RARITY_LABEL } from './fishData'

export interface RodTier {
  id: string
  name: string
  price: number
  luckBonus: number
  tensionBonus: number
  description: string
}

export interface SeaZone {
  id: string
  name: string
  unlockPrice: number
  rarityBias: Partial<Record<Rarity, number>>
  waitScale: number
  description: string
}

export const ROD_TIERS: RodTier[] = [
  {
    id: 'bamboo',
    name: '竹竿',
    price: 0,
    luckBonus: 0,
    tensionBonus: 0,
    description: '入门竹竿，够钓到近海小鱼。',
  },
  {
    id: 'carbon',
    name: '碳纤维竿',
    price: 120,
    luckBonus: 0.12,
    tensionBonus: 0.15,
    description: '轻盈有力，稀有鱼出现率提升。',
  },
  {
    id: 'master',
    name: '海神竿',
    price: 450,
    luckBonus: 0.28,
    tensionBonus: 0.3,
    description: '传说渔夫的竿，远海大物也敢搏。',
  },
]

export const SEA_ZONES: SeaZone[] = [
  {
    id: 'harbor',
    name: '近港浅滩',
    unlockPrice: 0,
    rarityBias: { common: 1.2, uncommon: 1, rare: 0.7, epic: 0.4, legendary: 0.2 },
    waitScale: 1,
    description: '平静的近海，适合练手。',
  },
  {
    id: 'reef',
    name: '珊瑚礁区',
    unlockPrice: 200,
    rarityBias: { common: 0.7, uncommon: 1.3, rare: 1.4, epic: 1.1, legendary: 0.6 },
    waitScale: 1.15,
    description: '礁石密布，少见鱼出没。',
  },
  {
    id: 'deep',
    name: '深蓝外海',
    unlockPrice: 600,
    rarityBias: { common: 0.4, uncommon: 0.8, rare: 1.5, epic: 1.8, legendary: 2.2 },
    waitScale: 1.35,
    description: '风高浪急，传说级渔获藏于此。',
  },
]

export const FISH_PRICE: Record<Rarity, number> = {
  common: 8,
  uncommon: 22,
  rare: 55,
  epic: 140,
  legendary: 420,
}

export function sellPrice(species: FishSpecies, weight: number): number {
  const base = FISH_PRICE[species.rarity]
  return Math.max(1, Math.round(base * (0.7 + weight / Math.max(species.maxWeight, 0.1))))
}

export function rodIndex(id: string): number {
  return Math.max(0, ROD_TIERS.findIndex((r) => r.id === id))
}

export function zoneById(id: string): SeaZone {
  return SEA_ZONES.find((z) => z.id === id) ?? SEA_ZONES[0]
}

export function nextRod(currentId: string): RodTier | null {
  const i = rodIndex(currentId)
  return ROD_TIERS[i + 1] ?? null
}

export function upgradeHint(rodId: string): string {
  const next = nextRod(rodId)
  if (!next) return '鱼竿已满级'
  return `下一档：${next.name}（${next.price} 金币）· ${RARITY_LABEL.rare}率↑`
}
