import { ROD_TIERS, SEA_ZONES, sellPrice } from './economy'
import { FishPreview } from './FishPreview'
import type { CatchResult, FishingState } from './fishing'
import { fishVisual } from './fishModels'
import {
  FISH_SPECIES,
  RARITY_COLOR,
  RARITY_LABEL,
  getSpecies,
  type FishSpecies,
  type Rarity,
} from './fishData'
import type { StatsManager } from './stats'

export class GameUI {
  root: HTMLElement
  private statusEl: HTMLElement
  private hintEl: HTMLElement
  private chargeFill: HTMLElement
  private chargeWrap: HTMLElement
  private tensionFill: HTMLElement
  private tensionWrap: HTMLElement
  private toastEl: HTMLElement
  private catchCard: HTMLElement
  private catalogPanel: HTMLElement
  private statsPanel: HTMLElement
  private shopPanel: HTMLElement
  private coinEl: HTMLElement
  private basketEl: HTMLElement
  private actionBtn: HTMLElement
  private biteFlash: HTMLElement
  private isMobile: boolean
  private catchPreview: FishPreview | null = null
  private catchTimer = 0

  onActionDown: (() => void) | null = null
  onActionUp: (() => void) | null = null
  onToggleCatalog: (() => void) | null = null
  onToggleStats: (() => void) | null = null
  onToggleShop: (() => void) | null = null
  onSellAll: (() => void) | null = null
  onBuyRod: ((rodId: string) => void) | null = null
  onEquipRod: ((rodId: string) => void) | null = null
  onSelectZone: ((zoneId: string) => void) | null = null

  constructor(container: HTMLElement, isMobile: boolean) {
    this.isMobile = isMobile
    this.root = document.createElement('div')
    this.root.id = 'game-ui'
    container.appendChild(this.root)

    this.root.innerHTML = `
      <header class="hud-top">
        <div class="brand-block">
          <div class="brand-name">海边钓鱼</div>
          <div class="brand-meta" id="zone-meta">近港浅滩 · 竹竿</div>
        </div>
        <div class="hud-resources">
          <div class="res"><span class="res-k">金币</span><span id="coin-label">0</span></div>
          <div class="res"><span class="res-k">鱼篓</span><span id="basket-label">0</span></div>
        </div>
        <nav class="hud-nav">
          <button type="button" class="nav-btn" id="btn-shop">渔市</button>
          <button type="button" class="nav-btn" id="btn-catalog">图鉴</button>
          <button type="button" class="nav-btn" id="btn-stats">记录</button>
        </nav>
      </header>

      <div class="hud-mid">
        <div class="status-line" id="status">准备抛竿</div>
        <div class="hint-line" id="hint"></div>
      </div>

      <div class="meter" id="charge-wrap">
        <div class="meter-head"><span>蓄力</span><span class="meter-val" id="charge-val">0%</span></div>
        <div class="meter-track"><div class="meter-fill" id="charge-fill"></div></div>
      </div>

      <div class="meter" id="tension-wrap">
        <div class="meter-head"><span>收线</span><span class="meter-val" id="tension-val">0%</span></div>
        <div class="meter-track"><div class="meter-fill tension" id="tension-fill"></div></div>
      </div>

      <div class="toast" id="toast"></div>
      <div class="bite-flash" id="bite-flash"></div>
      <div class="catch-card hidden" id="catch-card"></div>

      <button type="button" class="cast-btn" id="action-btn">
        <span class="cast-glow" aria-hidden="true"></span>
        <span class="cast-body">
          <span class="action-main">抛竿</span>
          <span class="action-kbd">${isMobile ? '按住松开' : 'Space'}</span>
        </span>
      </button>

      <div class="panel hidden" id="catalog-panel"></div>
      <div class="panel hidden" id="stats-panel"></div>
      <div class="panel hidden" id="shop-panel"></div>

      <footer class="hud-foot">
        ${
          isMobile
            ? '拖动环顾画面 · 右侧抛竿 · 顶部进入渔市'
            : '拖动环顾 · 空格抛竿 · B 渔市 · C 图鉴 · I 记录'
        }
      </footer>
    `

    this.statusEl = this.$('#status')
    this.hintEl = this.$('#hint')
    this.chargeFill = this.$('#charge-fill')
    this.chargeWrap = this.$('#charge-wrap')
    this.tensionFill = this.$('#tension-fill')
    this.tensionWrap = this.$('#tension-wrap')
    this.toastEl = this.$('#toast')
    this.catchCard = this.$('#catch-card')
    this.catalogPanel = this.$('#catalog-panel')
    this.statsPanel = this.$('#stats-panel')
    this.shopPanel = this.$('#shop-panel')
    this.coinEl = this.$('#coin-label')
    this.basketEl = this.$('#basket-label')
    this.actionBtn = this.$('#action-btn')
    this.biteFlash = this.$('#bite-flash')

    this.bind()
    this.setChargeVisible(false)
    this.setTensionVisible(false)
    this.updateHint('idle')
  }

  private $(sel: string): HTMLElement {
    const el = this.root.querySelector(sel)
    if (!el) throw new Error(`UI missing: ${sel}`)
    return el as HTMLElement
  }

  private bind(): void {
    const start = (e: Event) => {
      e.preventDefault()
      this.onActionDown?.()
    }
    const end = (e: Event) => {
      e.preventDefault()
      this.onActionUp?.()
    }
    this.actionBtn.addEventListener('pointerdown', start)
    this.actionBtn.addEventListener('pointerup', end)
    this.actionBtn.addEventListener('pointerleave', end)
    this.actionBtn.addEventListener('pointercancel', end)
    this.$('#btn-catalog').addEventListener('click', () => this.onToggleCatalog?.())
    this.$('#btn-stats').addEventListener('click', () => this.onToggleStats?.())
    this.$('#btn-shop').addEventListener('click', () => this.onToggleShop?.())
  }

  refreshEconomy(stats: StatsManager): void {
    this.coinEl.textContent = String(stats.stats.coins)
    this.basketEl.textContent = String(stats.stats.unsold.length)
    const zone = SEA_ZONES.find((z) => z.id === stats.stats.activeZoneId)
    const rod = ROD_TIERS.find((r) => r.id === stats.stats.rodId)
    const meta = this.root.querySelector('#zone-meta')
    if (meta && zone) meta.textContent = `${zone.name} · ${rod?.name ?? '鱼竿'}`
  }

  setStatus(text: string): void {
    this.statusEl.textContent = text
  }

  updateHint(state: FishingState): void {
    const mobile = this.isMobile
    const map: Record<FishingState, string> = {
      idle: mobile ? '按住右侧按钮蓄力' : '按住空格蓄力，松手抛出',
      charging: '继续蓄力，松手抛竿',
      casting: '鱼漂入水',
      waiting: '留意水面动静',
      bite: mobile ? '马上收线' : '立刻按空格收线',
      fighting: mobile ? '按住持续收线' : '按住空格收线',
      caught: '收入鱼篓，可去渔市出售',
      missed: '再试一次',
    }
    this.hintEl.textContent = map[state]

    const labels: Record<FishingState, string> = {
      idle: '抛竿',
      charging: '蓄力',
      casting: '抛投',
      waiting: '等待',
      bite: '收线',
      fighting: '收线',
      caught: '再抛',
      missed: '再抛',
    }
    const main = this.actionBtn.querySelector('.action-main')
    if (main) main.textContent = labels[state]
    this.actionBtn.classList.toggle('urgent', state === 'bite')
    this.actionBtn.classList.toggle('fighting', state === 'fighting')
  }

  setCharge(value: number): void {
    const pct = Math.round(value * 100)
    this.chargeFill.style.width = `${pct}%`
    const val = this.root.querySelector('#charge-val')
    if (val) val.textContent = `${pct}%`
  }

  setChargeVisible(v: boolean): void {
    this.chargeWrap.classList.toggle('visible', v)
  }

  setTension(value: number): void {
    const pct = Math.round(Math.min(1, value) * 100)
    this.tensionFill.style.width = `${pct}%`
    const val = this.root.querySelector('#tension-val')
    if (val) val.textContent = `${pct}%`
  }

  setTensionVisible(v: boolean): void {
    this.tensionWrap.classList.toggle('visible', v)
  }

  flashBite(): void {
    this.biteFlash.classList.remove('show')
    void this.biteFlash.offsetWidth
    this.biteFlash.classList.add('show')
    this.setStatus('咬钩了')
  }

  showToast(message: string, kind: 'info' | 'good' | 'bad' = 'info'): void {
    this.toastEl.textContent = message
    this.toastEl.className = `toast show ${kind}`
    window.setTimeout(() => this.toastEl.classList.remove('show'), 2200)
  }

  showCatch(result: CatchResult, isNew: boolean): void {
    const { species, weight } = result
    window.clearTimeout(this.catchTimer)
    this.disposeCatchPreview()

    this.catchCard.innerHTML = `
      <div class="catch-top">
        <span class="catch-rarity" style="color:${RARITY_COLOR[species.rarity]}">${RARITY_LABEL[species.rarity]}</span>
        ${isNew ? '<span class="catch-new">图鉴新收录</span>' : ''}
      </div>
      <div class="catch-viewport">
        <canvas class="fish-canvas" width="480" height="280"></canvas>
      </div>
      <div class="catch-name">${species.name}</div>
      <div class="catch-en">${species.nameEn}</div>
      <div class="catch-weight">${weight.toFixed(2)} <small>kg</small></div>
      <p class="catch-desc">${species.description}</p>
    `
    this.catchCard.classList.remove('hidden')
    this.catchCard.classList.add('show')

    const canvas = this.catchCard.querySelector('canvas')
    if (canvas instanceof HTMLCanvasElement) {
      const visual = fishVisual(species.id)
      this.catchPreview = new FishPreview(canvas)
      void this.catchPreview.show(
        visual.model,
        species.color,
        species.accent,
        visual.preserveMaps ?? false,
      )
    }

    this.catchTimer = window.setTimeout(() => {
      this.catchCard.classList.remove('show')
      this.catchCard.classList.add('hidden')
      this.disposeCatchPreview()
    }, 3800)
  }

  private disposeCatchPreview(): void {
    this.catchPreview?.dispose()
    this.catchPreview = null
  }

  toggleCatalog(stats: StatsManager): void {
    const open = this.catalogPanel.classList.contains('hidden')
    this.closePanels()
    if (!open) return
    this.renderCatalog(stats)
    this.catalogPanel.classList.remove('hidden')
  }

  toggleStats(stats: StatsManager): void {
    const open = this.statsPanel.classList.contains('hidden')
    this.closePanels()
    if (!open) return
    this.renderStats(stats)
    this.statsPanel.classList.remove('hidden')
  }

  toggleShop(stats: StatsManager): void {
    const open = this.shopPanel.classList.contains('hidden')
    this.closePanels()
    if (!open) return
    this.openShop(stats)
  }

  openShop(stats: StatsManager): void {
    this.closePanels()
    this.renderShop(stats)
    this.shopPanel.classList.remove('hidden')
  }

  closePanels(): void {
    this.catalogPanel.classList.add('hidden')
    this.statsPanel.classList.add('hidden')
    this.shopPanel.classList.add('hidden')
  }

  isPanelOpen(): boolean {
    return (
      !this.catalogPanel.classList.contains('hidden') ||
      !this.statsPanel.classList.contains('hidden') ||
      !this.shopPanel.classList.contains('hidden')
    )
  }

  private renderShop(stats: StatsManager): void {
    const s = stats.stats
    const rod = ROD_TIERS.find((r) => r.id === s.rodId) ?? ROD_TIERS[0]
    const unsoldValue = s.unsold.reduce((sum, f) => {
      const sp = getSpecies(f.speciesId)
      return sum + (sp ? sellPrice(sp, f.weight) : 0)
    }, 0)

    const highestOwned = stats.highestOwnedRodIndex()
    let rodsHtml = ''
    for (let i = 0; i < ROD_TIERS.length; i++) {
      const r = ROD_TIERS[i]
      const isCurrent = r.id === s.rodId
      const owned = stats.ownsRod(r.id)
      const canBuy = i === highestOwned + 1
      rodsHtml += `
        <div class="shop-row">
          <div>
            <div class="shop-name">${r.name}${isCurrent ? ' · 当前' : ''}</div>
            <div class="shop-desc">${r.description}</div>
          </div>
          ${
            isCurrent
              ? `<span class="shop-tag">已装备</span>`
              : owned
                ? `<button type="button" class="shop-btn" data-equip-rod="${r.id}">装备</button>`
                : canBuy
                  ? `<button type="button" class="shop-btn" data-buy-rod="${r.id}">购买 ${r.price}</button>`
                  : `<span class="shop-tag">锁定</span>`
          }
        </div>`
    }

    let zonesHtml = ''
    for (const z of SEA_ZONES) {
      const unlocked = s.unlockedZones.includes(z.id)
      const active = s.activeZoneId === z.id
      zonesHtml += `
        <div class="shop-row">
          <div>
            <div class="shop-name">${z.name}${active ? ' · 当前' : ''}</div>
            <div class="shop-desc">${z.description}</div>
          </div>
          ${
            active
              ? `<span class="shop-tag">钓鱼中</span>`
              : `<button type="button" class="shop-btn" data-zone="${z.id}">${
                  unlocked ? '前往' : `${z.unlockPrice}`
                }</button>`
          }
        </div>`
    }

    this.shopPanel.innerHTML = `
      <div class="panel-header">
        <div>
          <h2>渔市</h2>
          <p class="panel-sub">卖鱼、换竿、更换海域</p>
        </div>
        <button type="button" class="panel-close" data-close aria-label="关闭">×</button>
      </div>
      <section class="shop-block">
        <div class="shop-title">鱼篓估价 ${unsoldValue}</div>
        <button type="button" class="shop-btn primary" id="btn-sell-all">出售全部（${s.unsold.length}）</button>
      </section>
      <section class="shop-block">
        <div class="shop-title">鱼竿 · ${rod.name}</div>
        ${rodsHtml}
      </section>
      <section class="shop-block">
        <div class="shop-title">海域</div>
        ${zonesHtml}
      </section>
    `
    this.wirePanel(this.shopPanel)
    this.shopPanel.querySelector('#btn-sell-all')?.addEventListener('click', () => this.onSellAll?.())
    this.shopPanel.querySelectorAll('[data-buy-rod]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const id = (btn as HTMLElement).dataset.buyRod
        if (id) this.onBuyRod?.(id)
      })
    })
    this.shopPanel.querySelectorAll('[data-equip-rod]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const id = (btn as HTMLElement).dataset.equipRod
        if (id) this.onEquipRod?.(id)
      })
    })
    this.shopPanel.querySelectorAll('[data-zone]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const id = (btn as HTMLElement).dataset.zone
        if (id) this.onSelectZone?.(id)
      })
    })
  }

  private renderCatalog(stats: StatsManager): void {
    const progress = stats.discoveryProgress()
    const groups: Rarity[] = ['legendary', 'epic', 'rare', 'uncommon', 'common']
    let html = `
      <div class="panel-header">
        <div>
          <h2>图鉴</h2>
          <p class="panel-sub">已收录 ${progress.found} / ${progress.total}</p>
        </div>
        <button type="button" class="panel-close" data-close aria-label="关闭">×</button>
      </div>
      <div class="catalog-grid">
    `

    for (const rarity of groups) {
      for (const fish of FISH_SPECIES.filter((f) => f.rarity === rarity)) {
        html += this.catalogCard(fish, stats.isDiscovered(fish.id))
      }
    }
    html += '</div>'
    this.catalogPanel.innerHTML = html
    this.wirePanel(this.catalogPanel)
  }

  private catalogCard(fish: FishSpecies, found: boolean): string {
    if (!found) {
      return `
        <article class="cat-card locked">
          <div class="cat-view unknown"></div>
          <div class="cat-name">未发现</div>
          <div class="cat-rarity" style="color:${RARITY_COLOR[fish.rarity]}">${RARITY_LABEL[fish.rarity]}</div>
        </article>
      `
    }
    const thumb = fishVisual(fish.id).thumb
    return `
      <article class="cat-card">
        <div class="cat-view">
          <img class="cat-thumb" src="${thumb}" alt="${fish.name}" loading="lazy" />
        </div>
        <div class="cat-name">${fish.name}</div>
        <div class="cat-rarity" style="color:${RARITY_COLOR[fish.rarity]}">${RARITY_LABEL[fish.rarity]}</div>
        <div class="cat-desc">${fish.description}</div>
      </article>
    `
  }

  private renderStats(stats: StatsManager): void {
    const s = stats.stats
    const biggest = stats.getBiggestSpecies()
    const biggestW = s.biggestCatch?.weight
    this.statsPanel.innerHTML = `
      <div class="panel-header">
        <div>
          <h2>记录</h2>
          <p class="panel-sub">累计收入 ${s.totalEarned} 金币</p>
        </div>
        <button type="button" class="panel-close" data-close aria-label="关闭">×</button>
      </div>
      <div class="stats-grid">
        <div class="stat"><div class="stat-n">${s.totalCatches}</div><div class="stat-l">捕获</div></div>
        <div class="stat"><div class="stat-n">${s.totalWeight.toFixed(1)}</div><div class="stat-l">重量 kg</div></div>
        <div class="stat"><div class="stat-n">${s.casts}</div><div class="stat-l">抛竿</div></div>
        <div class="stat"><div class="stat-n">${s.misses}</div><div class="stat-l">跑鱼</div></div>
      </div>
      <div class="biggest">
        <div class="biggest-label">最大渔获</div>
        <div class="biggest-value">${
          biggest && biggestW != null ? `${biggest.name} · ${biggestW.toFixed(2)} kg` : '暂无'
        }</div>
      </div>
      <div class="rarity-bars">
        ${this.rarityBar('普通', s.rarityCounts.common, RARITY_COLOR.common)}
        ${this.rarityBar('少见', s.rarityCounts.uncommon, RARITY_COLOR.uncommon)}
        ${this.rarityBar('稀有', s.rarityCounts.rare, RARITY_COLOR.rare)}
        ${this.rarityBar('史诗', s.rarityCounts.epic, RARITY_COLOR.epic)}
        ${this.rarityBar('传说', s.rarityCounts.legendary, RARITY_COLOR.legendary)}
      </div>
      <div class="history">
        <div class="history-title">最近</div>
        ${
          s.history.length === 0
            ? '<div class="history-empty">还没有渔获</div>'
            : s.history
                .slice(0, 8)
                .map((h) => {
                  const sp = FISH_SPECIES.find((f) => f.id === h.speciesId)
                  if (!sp) return ''
                  return `<div class="history-row"><span>${sp.name}</span><span>${h.weight.toFixed(2)} kg</span></div>`
                })
                .join('')
        }
      </div>
    `
    this.wirePanel(this.statsPanel)
  }

  private wirePanel(panel: HTMLElement): void {
    panel.querySelector('[data-close]')?.addEventListener('click', () => this.closePanels())
  }

  private rarityBar(label: string, count: number, color: string): string {
    const width = Math.min(100, count * 8)
    return `
      <div class="rbar">
        <span>${label}</span>
        <div class="rbar-track"><div class="rbar-fill" style="width:${width}%;background:${color}"></div></div>
        <span>${count}</span>
      </div>
    `
  }

  setDiscoveryBadge(found: number, total: number): void {
    this.$('#btn-catalog').title = `图鉴 ${found}/${total}`
  }
}
