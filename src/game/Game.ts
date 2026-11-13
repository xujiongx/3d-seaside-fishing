import * as THREE from 'three'
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js'
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js'
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js'
import { SMAAPass } from 'three/addons/postprocessing/SMAAPass.js'
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js'
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js'
import { loadGameAssets } from './assets'
import { ROD_TIERS, zoneById } from './economy'
import { FishingSystem } from './fishing'
import { InputManager } from './input'
import { SeasideScene } from './scene'
import { StatsManager } from './stats'
import { GameUI } from './ui'

const ColorGradeShader = {
  uniforms: {
    tDiffuse: { value: null as THREE.Texture | null },
    uLift: { value: new THREE.Vector3(-0.02, -0.01, 0.0) },
    uGain: { value: new THREE.Vector3(0.95, 0.94, 0.92) },
    uSat: { value: 1.15 },
    uVignette: { value: 0.32 },
  },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse;
    uniform vec3 uLift;
    uniform vec3 uGain;
    uniform float uSat;
    uniform float uVignette;
    varying vec2 vUv;
    void main() {
      vec4 color = texture2D(tDiffuse, vUv);
      vec3 c = color.rgb * uGain + uLift;
      float luma = dot(c, vec3(0.2126, 0.7152, 0.0722));
      c = mix(vec3(luma), c, uSat);
      float d = distance(vUv, vec2(0.5));
      c *= 1.0 - smoothstep(0.35, 0.95, d) * uVignette;
      gl_FragColor = vec4(c, color.a);
    }
  `,
}

export class Game {
  private renderer!: THREE.WebGLRenderer
  private composer!: EffectComposer
  private world!: SeasideScene
  private input!: InputManager
  private fishing!: FishingSystem
  private stats!: StatsManager
  private ui!: GameUI
  private timer = new THREE.Timer()
  private actionHeld = false
  private uiActionHeld = false
  private running = false
  private discoveredBefore = new Set<string>()
  private bloomPass!: UnrealBloomPass
  private smaaPass!: SMAAPass

  private constructor() {
    // use Game.create()
  }

  static async create(container: HTMLElement): Promise<Game> {
    const game = new Game()
    container.innerHTML = ''
    container.classList.add('game-root')
    game.timer.connect(document)

    game.renderer = new THREE.WebGLRenderer({
      antialias: false,
      powerPreference: 'high-performance',
      stencil: false,
    })
    game.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    game.renderer.setSize(window.innerWidth, window.innerHeight)
    game.renderer.shadowMap.enabled = true
    game.renderer.shadowMap.type = THREE.PCFShadowMap
    game.renderer.toneMapping = THREE.ACESFilmicToneMapping
    game.renderer.toneMappingExposure = 0.95
    game.renderer.outputColorSpace = THREE.SRGBColorSpace
    container.appendChild(game.renderer.domElement)

    const assets = await loadGameAssets(game.renderer)
    game.world = new SeasideScene(window.innerWidth, window.innerHeight, assets, game.renderer)

    const rt = new THREE.WebGLRenderTarget(window.innerWidth, window.innerHeight, {
      type: THREE.HalfFloatType,
      format: THREE.RGBAFormat,
    })
    game.composer = new EffectComposer(game.renderer, rt)
    game.composer.addPass(new RenderPass(game.world.scene, game.world.camera))

    game.bloomPass = new UnrealBloomPass(
      new THREE.Vector2(window.innerWidth, window.innerHeight),
      0.1,
      0.4,
      0.92,
    )
    game.composer.addPass(game.bloomPass)

    game.composer.addPass(new ShaderPass(ColorGradeShader))
    game.smaaPass = new SMAAPass()
    game.composer.addPass(game.smaaPass)
    game.composer.addPass(new OutputPass())

    game.input = new InputManager(game.renderer.domElement)
    game.stats = new StatsManager()
    game.discoveredBefore = new Set(game.stats.stats.caughtIds)
    game.ui = new GameUI(container, game.input.isMobile)
    game.fishing = new FishingSystem(game.world, game.stats)

    game.wireEvents()
    window.addEventListener('resize', () => game.onResize())
    game.ui.setDiscoveryBadge(
      game.stats.discoveryProgress().found,
      game.stats.discoveryProgress().total,
    )
    // one-time test top-up so rod/zone unlocks can be tried quickly
    const grantKey = 'seaside-fishing-grant-10k-v1'
    if (!localStorage.getItem(grantKey)) {
      game.stats.addCoins(10000)
      localStorage.setItem(grantKey, '1')
      game.ui.showToast('测试充值 +10000 金币', 'good')
    }

    game.ui.refreshEconomy(game.stats)
    game.applyLoadoutVisuals()
    return game
  }

  private applyLoadoutVisuals(): void {
    this.world.setRodTier(this.stats.stats.rodId)
    this.world.setZone(this.stats.stats.activeZoneId)
  }

  private wireEvents(): void {
    this.ui.onActionDown = () => {
      if (this.ui.isPanelOpen()) {
        this.ui.closePanels()
        return
      }
      this.uiActionHeld = true
      this.input.requestAction()
      if (
        this.fishing.state === 'idle' ||
        this.fishing.state === 'caught' ||
        this.fishing.state === 'missed'
      ) {
        this.fishing.startCharge()
      } else if (this.fishing.state === 'bite' || this.fishing.state === 'landing') {
        this.fishing.tryAction()
      }
    }

    this.ui.onActionUp = () => {
      const wasHeld = this.uiActionHeld
      this.uiActionHeld = false
      this.input.releaseAction()
      if (wasHeld && this.fishing.state === 'charging') {
        this.fishing.releaseCast()
      }
    }

    this.ui.onToggleCatalog = () => this.ui.toggleCatalog(this.stats)
    this.ui.onToggleStats = () => this.ui.toggleStats(this.stats)
    this.ui.onToggleShop = () => this.ui.toggleShop(this.stats)
    this.ui.onBuyRod = (rodId) => {
      const rod = ROD_TIERS.find((r) => r.id === rodId)
      if (!rod) return
      if (this.stats.buyRod(rod.id, rod.price)) {
        this.world.setRodTier(rod.id)
        this.ui.showToast(`购买并装备 ${rod.name}`, 'good')
      } else {
        this.ui.showToast('金币不足或需按顺序解锁', 'bad')
      }
      this.ui.refreshEconomy(this.stats)
      this.ui.openShop(this.stats)
    }
    this.ui.onEquipRod = (rodId) => {
      const rod = ROD_TIERS.find((r) => r.id === rodId)
      if (!rod) return
      if (this.stats.equipRod(rod.id)) {
        this.world.setRodTier(rod.id)
        this.ui.showToast(`已切换为 ${rod.name}`, 'info')
      }
      this.ui.refreshEconomy(this.stats)
      this.ui.openShop(this.stats)
    }
    this.ui.onSelectZone = (zoneId) => {
      const zone = zoneById(zoneId)
      if (this.stats.stats.unlockedZones.includes(zoneId)) {
        this.stats.setZone(zoneId)
        this.world.setZone(zoneId)
        this.ui.showToast(`前往：${zone.name}`, 'info')
      } else if (this.stats.unlockZone(zoneId, zone.unlockPrice)) {
        this.stats.setZone(zoneId)
        this.world.setZone(zoneId)
        this.ui.showToast(`解锁并前往：${zone.name}`, 'good')
      } else {
        this.ui.showToast(`需要 ${zone.unlockPrice} 金币解锁`, 'bad')
      }
      this.ui.refreshEconomy(this.stats)
      this.ui.openShop(this.stats)
    }
    this.ui.onSellAll = () => {
      const { count, earned } = this.stats.sellAll()
      if (count === 0) this.ui.showToast('鱼篓是空的', 'info')
      else this.ui.showToast(`卖出 ${count} 条，收入 ${earned} 金币`, 'good')
      this.ui.refreshEconomy(this.stats)
      this.ui.openShop(this.stats)
    }

    this.fishing.events = {
      onStateChange: (state) => {
        this.ui.updateHint(state)
        this.ui.setChargeVisible(state === 'charging')
        const inFight = state === 'fighting' || state === 'landing'
        this.ui.setTensionVisible(inFight)
        this.ui.setStaminaVisible(inFight)
        if (!inFight) this.ui.clearFightBanner()

        const zone = zoneById(this.stats.stats.activeZoneId)
        const statusMap = {
          idle: `${zone.name} · 准备抛竿`,
          charging: '蓄力中',
          casting: '抛竿！',
          waiting: '等待咬钩…',
          bite: '咬钩了！刺鱼',
          fighting: '遛鱼中',
          landing: '起获！刺鱼',
          caught: '成功钓获！',
          missed: '跑鱼了',
        } as const
        this.ui.setStatus(statusMap[state])
      },
      onBite: () => {
        this.ui.flashBite()
        this.world.playSplash()
        this.ui.showToast('咬钩了！马上刺鱼', 'good')
      },
      onCatch: (result) => {
        const isNew = !this.discoveredBefore.has(result.species.id)
        this.discoveredBefore.add(result.species.id)
        this.ui.showCatch(result, isNew)
        this.world.playSplash()
        this.ui.showToast(`钓到了 ${result.species.name}！去渔市卖掉吧`, 'good')
        const p = this.stats.discoveryProgress()
        this.ui.setDiscoveryBadge(p.found, p.total)
        this.ui.refreshEconomy(this.stats)
      },
      onMiss: (reason) => {
        this.ui.showToast(reason, 'bad')
      },
      onTension: (t) => this.ui.setTension(t),
      onFightHud: (hud) => this.ui.updateFightHud(hud),
      onFishJump: () => this.ui.showToast('鱼跳起来了！', 'info'),
    }
  }

  start(): void {
    if (this.running) return
    this.running = true
    this.renderer.setAnimationLoop(() => this.frame())
  }

  private frame(): void {
    this.timer.update()
    const dt = Math.min(this.timer.getDelta(), 0.05)
    const time = this.timer.getElapsed()

    if (this.input.consumeCatalog()) this.ui.toggleCatalog(this.stats)
    if (this.input.consumeStats()) this.ui.toggleStats(this.stats)
    if (this.input.consumeShop()) this.ui.toggleShop(this.stats)

    const look = this.input.consumeLook()
    if (!this.ui.isPanelOpen()) {
      this.world.applyLook(look.x, look.y)
    }

    // keyboard charge / cast / strike (separate from UI button hold)
    const spaceDown = this.input.isKeyDown('Space') || this.input.isKeyDown('KeyF')
    if (spaceDown && !this.actionHeld) {
      if (
        this.fishing.state === 'idle' ||
        this.fishing.state === 'caught' ||
        this.fishing.state === 'missed'
      ) {
        this.fishing.startCharge()
        this.actionHeld = true
      } else if (this.fishing.state === 'bite' || this.fishing.state === 'landing') {
        this.fishing.tryAction()
        this.actionHeld = true
      } else if (this.fishing.state === 'fighting') {
        this.actionHeld = true
      }
    }
    if (!spaceDown && this.actionHeld) {
      if (this.fishing.state === 'charging') {
        this.fishing.releaseCast()
      }
      this.actionHeld = false
    }

    const held =
      this.uiActionHeld ||
      this.actionHeld ||
      spaceDown

    let steer = 0
    if (this.input.isKeyDown('KeyA') || this.input.isKeyDown('ArrowLeft')) steer -= 1
    if (this.input.isKeyDown('KeyD') || this.input.isKeyDown('ArrowRight')) steer += 1

    this.fishing.update(dt, time, held && !this.ui.isPanelOpen(), steer)
    this.ui.setCharge(this.fishing.getCharge())

    this.world.update(dt, time)
    this.composer.render()
  }

  private onResize(): void {
    const w = window.innerWidth
    const h = window.innerHeight
    this.world.resize(w, h)
    this.renderer.setSize(w, h)
    this.composer.setSize(w, h)
    this.bloomPass.resolution.set(w, h)
  }
}
