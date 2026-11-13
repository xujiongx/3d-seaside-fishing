import type { CaughtFish, FishSpecies, Rarity } from './fishData'
import { FISH_SPECIES, getSpecies } from './fishData'
import { ROD_TIERS, SEA_ZONES, sellPrice } from './economy'

const STORAGE_KEY = 'seaside-fishing-stats-v2'

export interface GameStats {
  totalCatches: number
  totalWeight: number
  biggestCatch: CaughtFish | null
  caughtIds: string[]
  rarityCounts: Record<Rarity, number>
  history: CaughtFish[]
  casts: number
  misses: number
  coins: number
  totalEarned: number
  rodId: string
  unlockedZones: string[]
  activeZoneId: string
  unsold: CaughtFish[]
}

function emptyStats(): GameStats {
  return {
    totalCatches: 0,
    totalWeight: 0,
    biggestCatch: null,
    caughtIds: [],
    rarityCounts: {
      common: 0,
      uncommon: 0,
      rare: 0,
      epic: 0,
      legendary: 0,
    },
    history: [],
    casts: 0,
    misses: 0,
    coins: 40,
    totalEarned: 0,
    rodId: ROD_TIERS[0].id,
    unlockedZones: [SEA_ZONES[0].id],
    activeZoneId: SEA_ZONES[0].id,
    unsold: [],
  }
}

export class StatsManager {
  stats: GameStats

  constructor() {
    this.stats = this.load()
  }

  private load(): GameStats {
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      if (!raw) return emptyStats()
      const parsed = JSON.parse(raw) as GameStats
      return { ...emptyStats(), ...parsed }
    } catch {
      return emptyStats()
    }
  }

  private save(): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.stats))
    } catch {
      // ignore
    }
  }

  recordCast(): void {
    this.stats.casts += 1
    this.save()
  }

  recordMiss(): void {
    this.stats.misses += 1
    this.save()
  }

  recordCatch(species: FishSpecies, weight: number): CaughtFish {
    const entry: CaughtFish = {
      speciesId: species.id,
      weight,
      caughtAt: Date.now(),
    }

    this.stats.totalCatches += 1
    this.stats.totalWeight = Math.round((this.stats.totalWeight + weight) * 100) / 100
    this.stats.rarityCounts[species.rarity] += 1

    if (!this.stats.caughtIds.includes(species.id)) {
      this.stats.caughtIds.push(species.id)
    }

    if (!this.stats.biggestCatch || weight > this.stats.biggestCatch.weight) {
      this.stats.biggestCatch = entry
    }

    this.stats.history.unshift(entry)
    if (this.stats.history.length > 50) this.stats.history.length = 50

    this.stats.unsold.unshift(entry)
    if (this.stats.unsold.length > 30) this.stats.unsold.length = 30

    this.save()
    return entry
  }

  sellAll(): { count: number; earned: number } {
    let earned = 0
    for (const fish of this.stats.unsold) {
      const sp = getSpecies(fish.speciesId)
      if (sp) earned += sellPrice(sp, fish.weight)
    }
    const count = this.stats.unsold.length
    this.stats.unsold = []
    this.stats.coins += earned
    this.stats.totalEarned += earned
    this.save()
    return { count, earned }
  }

  buyRod(rodId: string, price: number): boolean {
    const next = rodIndexSafe(this.stats.rodId) + 1
    const target = rodIndexSafe(rodId)
    if (target !== next) return false
    if (this.stats.coins < price) return false
    this.stats.coins -= price
    this.stats.rodId = rodId
    this.save()
    return true
  }

  unlockZone(zoneId: string, price: number): boolean {
    if (this.stats.unlockedZones.includes(zoneId)) return true
    if (this.stats.coins < price) return false
    this.stats.coins -= price
    this.stats.unlockedZones.push(zoneId)
    this.save()
    return true
  }

  setZone(zoneId: string): boolean {
    if (!this.stats.unlockedZones.includes(zoneId)) return false
    this.stats.activeZoneId = zoneId
    this.save()
    return true
  }

  isDiscovered(id: string): boolean {
    return this.stats.caughtIds.includes(id)
  }

  discoveryProgress(): { found: number; total: number } {
    return { found: this.stats.caughtIds.length, total: FISH_SPECIES.length }
  }

  getBiggestSpecies(): FishSpecies | null {
    if (!this.stats.biggestCatch) return null
    return getSpecies(this.stats.biggestCatch.speciesId) ?? null
  }

  reset(): void {
    this.stats = emptyStats()
    this.save()
  }
}

function rodIndexSafe(id: string): number {
  const i = ROD_TIERS.findIndex((r) => r.id === id)
  return i < 0 ? 0 : i
}
