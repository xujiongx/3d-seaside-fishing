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
  | 'landing'
  | 'caught'
  | 'missed'

/** Sub-behavior while fighting / 遛鱼 */
export type FightMood = 'calm' | 'run' | 'jump' | 'tired'

export interface CatchResult {
  species: FishSpecies
  weight: number
}

export interface FightHud {
  tension: number
  stamina: number
  progress: number
  mood: FightMood
  runDir: number
  canStrike: boolean
}

export interface FishingEvents {
  onStateChange?: (state: FishingState) => void
  onBite?: () => void
  onCatch?: (result: CatchResult) => void
  onMiss?: (reason: string) => void
  onTension?: (tension: number) => void
  onFightHud?: (hud: FightHud) => void
  onFishJump?: () => void
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
  private stamina = 1
  private progress = 0
  private fightTime = 0
  private mood: FightMood = 'calm'
  private moodTimer = 0
  private runDir = 0
  private jumpT = 0
  private jumpActive = false
  private fishOffset = new THREE.Vector3()
  private fishVel = new THREE.Vector3()
  private bobPhase = 0
  private landingWindow = 1.4
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
    this.world.hideFightFish()
    this.setState('casting')
  }

  /** Primary action: charge / 刺鱼 / 收线 / 起获 */
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
        this.strikeHook()
        break
      case 'landing':
        this.finishStrike()
        break
      case 'waiting':
        this.fail('收线太早，鱼跑了')
        break
      default:
        break
    }
  }

  holdAction(holding: boolean, dt: number, steer = 0): void {
    if (this.state === 'charging' && holding) {
      this.charge = Math.min(1, this.charge + dt * 0.85)
    }
    if (this.state === 'fighting') {
      this.playFish(holding, dt, steer)
    }
  }

  private strikeHook(): void {
    if (!this.pendingFish) return
    this.fightTime = 0
    this.tension = 0.28
    this.stamina = 1
    this.progress = 0.08
    this.mood = 'calm'
    this.moodTimer = 0.6 + Math.random() * 0.5
    this.runDir = 0
    this.jumpActive = false
    this.jumpT = 0
    this.fishOffset.set(0, -0.35, 0)
    this.fishVel.set(0, 0, 0)
    this.world.showFightFish(this.pendingFish.color, this.pendingFish.accent, this.pendingFish.id)
    this.world.playSplash(this.bobberPos)
    this.setState('fighting')
    this.emitHud()
  }

  private pickMood(): void {
    if (!this.pendingFish) return
    if (this.stamina < 0.28) {
      this.mood = 'tired'
      this.moodTimer = 1.2 + Math.random() * 0.8
      this.runDir = 0
      return
    }
    const roll = Math.random()
    const jumpChance = 0.18 + this.pendingFish.fightStrength * 0.15
    const runChance = 0.35 + this.pendingFish.fightStrength * 0.2
    if (roll < jumpChance) {
      this.mood = 'jump'
      this.moodTimer = 0.85
      this.jumpActive = true
      this.jumpT = 0
      this.events.onFishJump?.()
      this.world.playSplash(this.bobberPos)
    } else if (roll < jumpChance + runChance) {
      this.mood = 'run'
      this.moodTimer = 1.1 + this.pendingFish.fightStrength * 0.9
      this.runDir = Math.random() < 0.5 ? -1 : 1
    } else {
      this.mood = 'calm'
      this.moodTimer = 0.8 + Math.random() * 1.1
      this.runDir = 0
    }
  }

  private playFish(holding: boolean, dt: number, steer: number): void {
    if (!this.pendingFish) return
    const rod = ROD_TIERS.find((r) => r.id === this.stats.stats.rodId) ?? ROD_TIERS[0]
    const strength = this.pendingFish.fightStrength

    this.moodTimer -= dt
    if (this.moodTimer <= 0) this.pickMood()

    // line tension dynamics
    if (this.mood === 'run') {
      const oppose = steer !== 0 && Math.sign(steer) === -Math.sign(this.runDir)
      const badHold = holding ? 1.15 : 0.35
      this.tension += dt * (0.22 + strength * 0.28) * badHold
      if (oppose) {
        this.tension -= dt * 0.18
        this.stamina -= dt * (0.22 + rod.tensionBonus * 0.1)
      } else if (!holding) {
        // 遛鱼：松线泄力
        this.tension = Math.max(0.12, this.tension - dt * 0.32)
        this.stamina -= dt * 0.12
      }
      if (holding && !oppose) this.stamina -= dt * 0.04
    } else if (this.mood === 'jump') {
      this.tension += dt * (0.35 + strength * 0.25) * (holding ? 1.4 : 0.7)
      if (!holding) this.stamina -= dt * 0.18
    } else if (this.mood === 'tired') {
      this.tension = Math.max(0.1, this.tension - dt * 0.2)
      if (holding) {
        this.progress += dt * (0.38 + rod.tensionBonus * 0.25)
        this.stamina -= dt * 0.28
        this.tension += dt * 0.12
      } else {
        this.stamina -= dt * 0.06
      }
    } else {
      // calm
      if (holding) {
        this.progress += dt * (0.22 + rod.tensionBonus * 0.15)
        this.tension += dt * (0.16 + strength * 0.08)
        this.stamina -= dt * 0.14
      } else {
        this.tension = Math.max(0.08, this.tension - dt * 0.22)
        this.stamina -= dt * 0.05
      }
    }

    this.tension = THREE.MathUtils.clamp(this.tension, 0, 1.15)
    this.stamina = THREE.MathUtils.clamp(this.stamina, 0, 1)
    this.progress = THREE.MathUtils.clamp(this.progress, 0, 1)

    if (this.tension >= 1) {
      this.fail('线断了！遛鱼时别死拽')
      return
    }

    // ready to 刺鱼起获
    if (this.progress >= 0.92 && this.stamina <= 0.35) {
      this.setState('landing')
      this.landingWindow = 1.5 + rod.tensionBonus * 0.4
      this.events.onFightHud?.({
        tension: this.tension,
        stamina: this.stamina,
        progress: this.progress,
        mood: 'tired',
        runDir: 0,
        canStrike: true,
      })
      return
    }

    this.emitHud()
  }

  private finishStrike(): void {
    if (this.state !== 'landing' || !this.pendingFish) return
    this.succeed()
  }

  private emitHud(): void {
    this.events.onTension?.(Math.min(1, this.tension))
    this.events.onFightHud?.({
      tension: Math.min(1, this.tension),
      stamina: this.stamina,
      progress: this.progress,
      mood: this.mood,
      runDir: this.runDir,
      canStrike: false,
    })
  }

  private succeed(): void {
    if (!this.pendingFish) return
    const weight = rollWeight(this.pendingFish)
    const result = { species: this.pendingFish, weight }
    this.lastCatch = result
    this.stats.recordCatch(this.pendingFish, weight)
    this.pendingFish = null
    this.world.setBobber(false)
    this.world.hideFightFish()
    this.world.setRodCastPose(0)
    this.setState('caught')
    this.events.onCatch?.(result)
  }

  private fail(reason: string): void {
    this.pendingFish = null
    this.stats.recordMiss()
    this.world.setBobber(false)
    this.world.hideFightFish()
    this.world.setRodCastPose(0)
    this.setState('missed')
    this.events.onMiss?.(reason)
  }

  update(dt: number, time: number, actionHeld: boolean, steer = 0): void {
    this.stateTime += dt
    this.holdAction(actionHeld, dt, steer)

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
        this.world.updateLine(
          this.world.getRodTipWorld(),
          this.bobberPos.clone().add(new THREE.Vector3(0, gentle, 0)),
        )

        if (this.stateTime > this.waitUntil - 0.6 && this.stateTime < this.waitUntil) {
          const nibble = Math.sin(time * 28) * 0.06
          this.world.setBobber(true, this.bobberPos, nibble)
        }

        if (this.stateTime >= this.waitUntil) {
          this.events.onBite?.()
          this.setState('bite')
        }
        break
      }

      case 'bite': {
        const waveY = this.world.sampleWaveHeight(this.bobberPos.x, this.bobberPos.z, time)
        const yank = -0.25 - Math.abs(Math.sin(time * 18)) * 0.2
        this.bobberPos.y = waveY + yank
        this.world.setBobber(true, this.bobberPos)
        this.world.setRodFight(0.8, time)
        this.world.updateLine(this.world.getRodTipWorld(), this.bobberPos)
        if (this.stateTime >= this.biteWindow) {
          this.fail('没刺中，鱼跑了！')
        }
        break
      }

      case 'fighting': {
        if (!this.pendingFish) break
        this.fightTime += dt
        this.updateFightMotion(dt, time, actionHeld)
        if (this.fightTime > 28) this.fail('鱼耗尽你了…线松脱了')
        break
      }

      case 'landing': {
        if (!this.pendingFish) break
        this.updateFightMotion(dt, time, false)
        this.world.setRodFight(0.9, time)
        if (this.stateTime >= this.landingWindow) {
          this.fail('起获太慢，鱼挣脱了')
        }
        break
      }

      case 'caught':
      case 'missed':
        if (this.stateTime > 2.5) this.setState('idle')
        break

      default:
        this.world.setRodCastPose(0)
        break
    }
  }

  private updateFightMotion(dt: number, time: number, reeling: boolean): void {
    if (!this.pendingFish) return
    const tip = this.world.getRodTipWorld()
    const strength = this.pendingFish.fightStrength
    const waveY = this.world.sampleWaveHeight(this.bobberPos.x, this.bobberPos.z, time)

    // pull toward pier gradually with progress
    const pull = 0.08 + this.progress * 0.55
    this.bobberPos.x = THREE.MathUtils.damp(this.bobberPos.x, tip.x, pull, dt)
    this.bobberPos.z = THREE.MathUtils.damp(this.bobberPos.z, tip.z, pull * 0.85, dt)

    if (this.mood === 'run') {
      const side = new THREE.Vector3(1, 0, 0).applyAxisAngle(new THREE.Vector3(0, 1, 0), this.world.yaw)
      this.fishVel.addScaledVector(side, this.runDir * (4.5 + strength * 5) * dt)
      this.tension = Math.min(this.tension, 1.1)
    } else if (this.mood === 'jump' && this.jumpActive) {
      this.jumpT += dt / 0.85
      const arc = Math.sin(Math.min(1, this.jumpT) * Math.PI)
      this.fishOffset.y = arc * (1.1 + strength * 0.6)
      this.fishOffset.x = Math.sin(this.jumpT * 10) * 0.15
      if (this.jumpT >= 1) {
        this.jumpActive = false
        this.fishOffset.y = -0.2
        this.world.playSplash(this.bobberPos)
        this.mood = 'calm'
        this.moodTimer = 0.5
      }
    } else {
      this.fishOffset.y = THREE.MathUtils.damp(this.fishOffset.y, -0.25 - Math.sin(time * 6) * 0.08, 4, dt)
      this.fishVel.multiplyScalar(Math.exp(-3 * dt))
    }

    this.fishOffset.x += this.fishVel.x * dt
    this.fishOffset.z += this.fishVel.z * dt
    this.fishVel.multiplyScalar(Math.exp(-1.8 * dt))
    this.fishOffset.x = THREE.MathUtils.clamp(this.fishOffset.x, -3.5, 3.5)
    this.fishOffset.z = THREE.MathUtils.clamp(this.fishOffset.z, -2.5, 2.5)

    this.bobberPos.y = waveY + (this.jumpActive ? this.fishOffset.y * 0.35 : -0.12)
    const fishPos = this.bobberPos.clone().add(this.fishOffset)
    if (!this.jumpActive) {
      fishPos.y = waveY - 0.15 + Math.sin(time * (7 + strength * 4)) * 0.12
    } else {
      fishPos.y = waveY + this.fishOffset.y
    }

    const thrash = this.mood === 'run' || this.mood === 'jump' ? 1 : this.mood === 'tired' ? 0.25 : 0.55
    const heading =
      Math.atan2(this.fishVel.x + this.runDir * 0.01, this.fishVel.z + 0.001) ||
      Math.atan2(tip.x - fishPos.x, tip.z - fishPos.z)

    this.world.setFightFish(fishPos, heading, thrash, time, this.jumpActive)
    this.world.setBobber(true, this.bobberPos)
    this.world.setRodFight(0.4 + thrash * 0.5 + (reeling ? 0.15 : 0), time)
    this.world.updateLine(tip, fishPos)
  }
}
