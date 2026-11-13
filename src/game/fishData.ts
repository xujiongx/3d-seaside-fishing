export type Rarity = 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary'

export interface FishSpecies {
  id: string
  name: string
  nameEn: string
  rarity: Rarity
  minWeight: number
  maxWeight: number
  color: number
  accent: number
  description: string
  biteWindow: number
  fightStrength: number
  baseChance: number
}

export const RARITY_LABEL: Record<Rarity, string> = {
  common: '普通',
  uncommon: '少见',
  rare: '稀有',
  epic: '史诗',
  legendary: '传说',
}

export const RARITY_COLOR: Record<Rarity, string> = {
  common: '#8a9eab',
  uncommon: '#3d9b78',
  rare: '#3d7eb8',
  epic: '#8b6bb5',
  legendary: '#c9953a',
}

export const FISH_SPECIES: FishSpecies[] = [
  {
    id: 'sardine',
    name: '沙丁鱼',
    nameEn: 'Sardine',
    rarity: 'common',
    minWeight: 0.1,
    maxWeight: 0.4,
    color: 0x8fa8b8,
    accent: 0xdde8f0,
    description: '成群游弋的小鱼，海边最常见的收获。',
    biteWindow: 1.4,
    fightStrength: 0.3,
    baseChance: 0.28,
  },
  {
    id: 'yellowcroaker',
    name: '小黄鱼',
    nameEn: 'Yellow Croaker',
    rarity: 'common',
    minWeight: 0.2,
    maxWeight: 0.8,
    color: 0xe8b84a,
    accent: 0xffe29a,
    description: '金黄色泽的近海鱼，肉质鲜美。',
    biteWindow: 1.3,
    fightStrength: 0.35,
    baseChance: 0.24,
  },
  {
    id: 'seabass',
    name: '鲈鱼',
    nameEn: 'Sea Bass',
    rarity: 'common',
    minWeight: 0.5,
    maxWeight: 2.0,
    color: 0x6b7c86,
    accent: 0xc5d0d6,
    description: '力气不小的常见海鲈，收线时要稳住。',
    biteWindow: 1.2,
    fightStrength: 0.45,
    baseChance: 0.18,
  },
  {
    id: 'porgy',
    name: '鲷鱼',
    nameEn: 'Porgy',
    rarity: 'uncommon',
    minWeight: 0.6,
    maxWeight: 2.5,
    color: 0xe07a5f,
    accent: 0xffc4b0,
    description: '粉红鳞片在阳光下闪闪发光。',
    biteWindow: 1.1,
    fightStrength: 0.5,
    baseChance: 0.1,
  },
  {
    id: 'mackerel',
    name: '鲭鱼',
    nameEn: 'Mackerel',
    rarity: 'uncommon',
    minWeight: 0.4,
    maxWeight: 1.5,
    color: 0x3d7ea6,
    accent: 0x8fd3f4,
    description: '游速很快的鲭鱼，咬钩干脆利落。',
    biteWindow: 1.0,
    fightStrength: 0.55,
    baseChance: 0.08,
  },
  {
    id: 'grouper',
    name: '石斑鱼',
    nameEn: 'Grouper',
    rarity: 'uncommon',
    minWeight: 1.5,
    maxWeight: 5.0,
    color: 0xa67c52,
    accent: 0xd4b483,
    description: '潜伏礁石间的大家伙，拉力十足。',
    biteWindow: 1.05,
    fightStrength: 0.65,
    baseChance: 0.06,
  },
  {
    id: 'tuna',
    name: '金枪鱼',
    nameEn: 'Tuna',
    rarity: 'rare',
    minWeight: 3.0,
    maxWeight: 12.0,
    color: 0x2c5f7c,
    accent: 0x6eb5d0,
    description: '深海力量的象征，收线时几乎拽不动竿。',
    biteWindow: 0.9,
    fightStrength: 0.8,
    baseChance: 0.03,
  },
  {
    id: 'marlin',
    name: '旗鱼',
    nameEn: 'Marlin',
    rarity: 'rare',
    minWeight: 5.0,
    maxWeight: 18.0,
    color: 0x1a4a6e,
    accent: 0x4ecdc4,
    description: '尖吻破浪而来，是许多钓手的梦想。',
    biteWindow: 0.85,
    fightStrength: 0.85,
    baseChance: 0.02,
  },
  {
    id: 'moonfish',
    name: '月光鱼',
    nameEn: 'Moonfish',
    rarity: 'epic',
    minWeight: 1.0,
    maxWeight: 4.0,
    color: 0xc9b1ff,
    accent: 0xf0e6ff,
    description: '只在特定潮汐出现的神秘发光鱼。',
    biteWindow: 0.75,
    fightStrength: 0.7,
    baseChance: 0.008,
  },
  {
    id: 'coraldragon',
    name: '珊瑚龙',
    nameEn: 'Coral Dragon',
    rarity: 'epic',
    minWeight: 2.0,
    maxWeight: 7.0,
    color: 0xff6b6b,
    accent: 0xffd93d,
    description: '传说栖息于远珊瑚礁的奇异鱼类。',
    biteWindow: 0.7,
    fightStrength: 0.75,
    baseChance: 0.005,
  },
  {
    id: 'poseidonscale',
    name: '海神之鳞',
    nameEn: "Poseidon's Scale",
    rarity: 'legendary',
    minWeight: 8.0,
    maxWeight: 30.0,
    color: 0xffd700,
    accent: 0xffffff,
    description: '海神留下的鳞片化成的鱼，万年难遇一次。',
    biteWindow: 0.6,
    fightStrength: 0.95,
    baseChance: 0.002,
  },
]

export interface CaughtFish {
  speciesId: string
  weight: number
  caughtAt: number
}

export function rollFish(
  luckBonus = 0,
  rarityBias?: Partial<Record<Rarity, number>>,
): FishSpecies {
  const weights = FISH_SPECIES.map((f) => {
    const bias = rarityBias?.[f.rarity] ?? 1
    const rarityBoost =
      f.rarity === 'common'
        ? 1 - luckBonus * 0.5
        : 1 + luckBonus * (f.rarity === 'legendary' ? 2.2 : f.rarity === 'epic' ? 1.6 : 1.1)
    return Math.max(0.0001, f.baseChance * bias * rarityBoost)
  })
  const total = weights.reduce((s, w) => s + w, 0)
  let r = Math.random() * total
  for (let i = 0; i < FISH_SPECIES.length; i++) {
    r -= weights[i]
    if (r <= 0) return FISH_SPECIES[i]
  }
  return FISH_SPECIES[0]
}

export function rollWeight(species: FishSpecies): number {
  const t = Math.random()
  const biased = t * t
  const w = species.minWeight + (species.maxWeight - species.minWeight) * (1 - biased * 0.7)
  return Math.round(w * 100) / 100
}

export function getSpecies(id: string): FishSpecies | undefined {
  return FISH_SPECIES.find((f) => f.id === id)
}
