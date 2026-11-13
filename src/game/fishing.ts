import * as THREE from 'three'
import type { FishSpecies } from './fishData'
import { rollFish, rollWeight } from './fishData'
import { ROD_TIERS, zoneById } from './economy'
import type { SeasideScene } from './scene'
import type { StatsManager } from './stats'

export type FishingState =
  | 'idle'
  | 'charging'
  | 'casting'
  | 'waiting'
  | 'bite'
  | 'fighting'
  | 'caught'
  | 'missed'

export interface CatchResult {
  species: FishSpecies
  weight: number
}

export interface FishingEvents {
  onStateChange?: (state: FishingState) => void
  onBite?: () => void
  onCatch?: (result: CatchResult) => void
  onMiss?: (reason: string) => void
  onTension?: (tension: number) => void
}

export class FishingSystem {
  state: FishingState = 'idle'
  private stateTime = 0
  private charge = 0
  private bobberTarget = new THREE.Vector3()
  private bobberPos = new THREE.Vector3()
  private castProgress = 0
  private waitUntil = 0
  private biteWindow = 1
  private pendingFish: FishSpecies | null = null
  private tension = 0
  private fightTime = 0
  private fightDuration = 0
  private bobPhase = 0
  private bitePulse = 0
  lastCatch: CatchResult | null = null
  events: FishingEvents = {}
  private world: SeasideScene
  private stats: StatsManager

  constructor(world: SeasideScene, stats: StatsManager) {
    this.world = world
    this.stats = stats
  }

  getCharge(): number {
    return this.charge
  }

  getTension(): number {
    return this.tension
  }

  getBobberPosition(): THREE.Vector3 {
    return this.bobberPos.clone()
  }

  private setState(next: FishingState): void {
    this.state = next
    this.stateTime = 0
    this.events.onStateChange?.(next)
  }

  startCharge(): void {
    if (this.state !== 'idle' && this.state !== 'caught' && this.state !== 'missed') return
    this.charge = 0
    this.setState('charging')
  }

  releaseCast(): void {
    if (this.state !== 'charging') return
    this.stats.recordCast()
    const power = 0.35 + this.charge * 0.65
    const dist = 8 + power * 22
    const yaw = this.world.yaw
    const dir = new THREE.Vector3(-Math.sin(yaw), 0, -Math.cos(yaw))
    this.bobberTarget.set(
      this.world.camera.position.x + dir.x * dist + (Math.random() - 0.5) * 2,
      0,
      this.world.camera.position.z + dir.z * dist + (Math.random() - 0.5) * 1.5,
    )
    this.bobberPos.copy(this.world.getRodTipWorld())
    this.castProgress = 0
    this.world.setBobber(true, this.bobberPos)
    this.setState('casting')
  }

  tryAction(): void {
    switch (this.state) {
      case 'idle':
      case 'caught':
      case 'missed':
        this.startCharge()
        break
      case 'charging':
        this.releaseCast()
        break
      case 'bite':
        this.beginFight()
        break
      case 'fighting':
        this.reel()
        break
      case 'waiting':
        // early reel = miss
        this.fail('收线太早，鱼跑了')
        break
      default:
        break
    }
  }

  holdAction(holding: boolean, dt: number): void {
    if (this.state === 'charging' && holding) {
      this.charge = Math.min(1, this.charge + dt * 0.85)
    }
    if (this.state === 'fighting' && holding) {
      this.reel(dt)
    }
  }

  private beginFight(): void {
    if (!this.pendingFish) return
    this.fightTime = 0
    this.tension = 0.35
    this.fightDuration = 1.8 + this.pendingFish.fightStrength * 2.5
    this.bitePulse = 0
    this.setState('fighting')
  }

  private reel(dt = 0.016): void {
    if (this.state !== 'fighting' || !this.pendingFish) return
    const rod = ROD_TIERS.find((r) => r.id === this.stats.stats.rodId) ?? ROD_TIERS[0]
    this.tension += dt * (0.7 + this.pendingFish.fightStrength * 0.4 + rod.tensionBonus * 0.45)
    this.events.onTension?.(this.tension)
    if (this.tension >= 1) {
      this.succeed()
    }
  }

  private succeed(): void {
    if (!this.pendingFish) return
    const weight = rollWeight(this.pendingFish)
    const result = { species: this.pendingFish, weight }
    this.lastCatch = result
    this.stats.recordCatch(this.pendingFish, weight)
    this.pendingFish = null
    this.world.setBobber(false)
    this.world.setRodCastPose(0)
    this.setState('caught')
    this.events.onCatch?.(result)
  }

  private fail(reason: string): void {
    this.pendingFish = null
    this.stats.recordMiss()
    this.world.setBobber(false)
    this.world.setRodCastPose(0)
    this.setState('missed')
    this.events.onMiss?.(reason)
  }

  update(dt: number, time: number, actionHeld: boolean): void {
    this.stateTime += dt
    this.holdAction(actionHeld, dt)

    switch (this.state) {
      case 'charging':
        this.world.setRodCastPose(this.charge * 0.5)
        if (this.stateTime > 2.8) this.releaseCast()
        break

      case 'casting': {
        this.castProgress = Math.min(1, this.castProgress + dt * 1.6)
        const t = this.castProgress
        const tip = this.world.getRodTipWorld()
        const mid = tip.clone().lerp(this.bobberTarget, t)
        mid.y = tip.y + Math.sin(t * Math.PI) * (4 + this.charge * 5)
        this.bobberPos.copy(mid)
        this.world.setBobber(true, this.bobberPos)
        this.world.setRodCastPose(0.5 + t * 0.5)
        this.world.updateLine(tip, this.bobberPos)

        if (t >= 1) {
          const rod = ROD_TIERS.find((r) => r.id === this.stats.stats.rodId) ?? ROD_TIERS[0]
          const zone = zoneById(this.stats.stats.activeZoneId)
          this.pendingFish = rollFish(rod.luckBonus, zone.rarityBias)
          this.waitUntil = (1.5 + Math.random() * 3.5) * zone.waitScale
          this.biteWindow = this.pendingFish.biteWindow * (1 + rod.tensionBonus * 0.25)
          this.bobPhase = 0
          this.setState('waiting')
        }
        break
      }

      case 'waiting': {
        this.bobPhase += dt
        const waveY = this.world.sampleWaveHeight(this.bobberPos.x, this.bobberPos.z, time)
        const gentle = Math.sin(this.bobPhase * 2.2) * 0.04
        this.bobberPos.y = waveY + 0.1
        this.world.setBobber(true, this.bobberPos, gentle)
        this.world.setRodCastPose(1)
        this.world.updateLine(this.world.getRodTipWorld(), this.bobberPos.clone().add(new THREE.Vector3(0, gentle, 0)))

        // nibble foreshadow
        if (this.stateTime > this.waitUntil - 0.6 && this.stateTime < this.waitUntil) {
          const nibble = Math.sin(time * 28) * 0.06
          this.world.setBobber(true, this.bobberPos, nibble)
        }

        if (this.stateTime >= this.waitUntil) {
          this.bitePulse = 1
          this.events.onBite?.()
          this.setState('bite')
        }
        break
      }

      case 'bite': {
        this.bitePulse = Math.max(0, this.bitePulse - dt)
        const waveY = this.world.sampleWaveHeight(this.bobberPos.x, this.bobberPos.z, time)
        const yank = -0.25 - Math.abs(Math.sin(time * 18)) * 0.2
        this.bobberPos.y = waveY + yank
        this.world.setBobber(true, this.bobberPos)
        this.world.setRodFight(0.8, time)
        this.world.updateLine(this.world.getRodTipWorld(), this.bobberPos)

        if (this.stateTime >= this.biteWindow) {
          this.fail('咬钩没抓住，跑了！')
        }
        break
      }

      case 'fighting': {
        if (!this.pendingFish) break
        this.fightTime += dt
        const waveY = this.world.sampleWaveHeight(this.bobberPos.x, this.bobberPos.z, time)
        const pull = Math.sin(time * (8 + this.pendingFish.fightStrength * 6)) * 0.35
        this.bobberPos.y = waveY + pull * 0.3 - 0.15
        // slowly pull closer
        const tip = this.world.getRodTipWorld()
        this.bobberPos.lerp(tip, dt * 0.15 * (0.5 + this.tension))
        this.world.setBobber(true, this.bobberPos)
        this.world.setRodFight(0.5 + this.pendingFish.fightStrength * 0.5, time)
        this.world.updateLine(tip, this.bobberPos)

        // tension decay when not reeling
        if (!actionHeld) {
          this.tension = Math.max(0, this.tension - dt * 0.25)
        }

        // line snaps if ignored too long with high fight
        if (!actionHeld && this.fightTime > this.fightDuration * 0.7) {
          this.tension -= dt * 0.15
        }

        if (this.tension <= 0 && this.fightTime > 1.2) {
          this.fail('拉力不够，鱼挣脱了')
        } else if (this.fightTime > this.fightDuration + 2.5) {
          this.fail('线断了…')
        }
        this.events.onTension?.(this.tension)
        break
      }

      case 'caught':
      case 'missed':
        if (this.stateTime > 2.5) {
          this.setState('idle')
        }
        break

      default:
        this.world.setRodCastPose(0)
        break
    }
  }
}
