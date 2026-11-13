export type InputAction = 'cast' | 'reel' | 'look' | 'catalog' | 'stats'

export interface LookDelta {
  x: number
  y: number
}

export class InputManager {
  private keys = new Set<string>()
  private pressed = new Set<string>()
  lookDelta: LookDelta = { x: 0, y: 0 }
  private pointerActive = false
  private lastPointer = { x: 0, y: 0 }
  private castRequested = false
  private reelRequested = false
  private catalogRequested = false
  private statsRequested = false
  private shopRequested = false
  isMobile = false
  private touchLookId: number | null = null
  private actionHeld = false
  private canvas: HTMLCanvasElement

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas
    this.isMobile = this.detectMobile()
    this.bind()
  }

  private detectMobile(): boolean {
    return (
      /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent) ||
      (navigator.maxTouchPoints > 0 && window.matchMedia('(pointer: coarse)').matches)
    )
  }

  private bind(): void {
    window.addEventListener('keydown', (e) => {
      if (['Space', 'KeyF', 'KeyC', 'KeyB', 'Escape'].includes(e.code)) {
        e.preventDefault()
      }
      if (!this.keys.has(e.code)) this.pressed.add(e.code)
      this.keys.add(e.code)

      if (e.code === 'Space' || e.code === 'KeyF') this.castRequested = true
      if (e.code === 'KeyC') this.catalogRequested = true
      if (e.code === 'KeyB') this.shopRequested = true
      if (e.code === 'KeyI' || e.code === 'Tab') {
        e.preventDefault()
        this.statsRequested = true
      }
    })

    window.addEventListener('keyup', (e) => {
      this.keys.delete(e.code)
    })

    this.canvas.addEventListener('contextmenu', (e) => e.preventDefault())

    this.canvas.addEventListener('pointerdown', (e) => {
      if (e.button !== 0) return
      this.pointerActive = true
      this.lastPointer = { x: e.clientX, y: e.clientY }
      this.canvas.setPointerCapture(e.pointerId)

      if (this.isMobile) {
        this.touchLookId = e.pointerId
      }
    })

    this.canvas.addEventListener('pointermove', (e) => {
      if (!this.pointerActive) return
      if (this.isMobile && this.touchLookId !== e.pointerId) return

      const dx = e.clientX - this.lastPointer.x
      const dy = e.clientY - this.lastPointer.y
      this.lastPointer = { x: e.clientX, y: e.clientY }
      this.lookDelta.x += dx
      this.lookDelta.y += dy
    })

    const endPointer = (e: PointerEvent) => {
      if (this.touchLookId === e.pointerId) this.touchLookId = null
      this.pointerActive = false
      try {
        this.canvas.releasePointerCapture(e.pointerId)
      } catch {
        // ignore
      }
    }

    this.canvas.addEventListener('pointerup', endPointer)
    this.canvas.addEventListener('pointercancel', endPointer)

    // Desktop click on canvas = cast/reel when not dragging much
    let downPos = { x: 0, y: 0 }
    let moved = false
    this.canvas.addEventListener('pointerdown', (e) => {
      downPos = { x: e.clientX, y: e.clientY }
      moved = false
    })
    this.canvas.addEventListener('pointermove', (e) => {
      if (Math.hypot(e.clientX - downPos.x, e.clientY - downPos.y) > 12) moved = true
    })
    this.canvas.addEventListener('pointerup', (e) => {
      if (!this.isMobile && !moved && e.button === 0) {
        this.castRequested = true
        this.reelRequested = true
      }
    })
  }

  /** Called by UI action buttons */
  requestAction(): void {
    this.castRequested = true
    this.reelRequested = true
    this.actionHeld = true
  }

  releaseAction(): void {
    this.actionHeld = false
  }

  requestCatalog(): void {
    this.catalogRequested = true
  }

  requestStats(): void {
    this.statsRequested = true
  }

  consumeCast(): boolean {
    const v = this.castRequested || this.actionHeld
    this.castRequested = false
    return v
  }

  consumeReel(): boolean {
    const v = this.reelRequested || this.actionHeld || this.keys.has('Space') || this.keys.has('KeyF')
    this.reelRequested = false
    return v
  }

  consumeCatalog(): boolean {
    const v = this.catalogRequested
    this.catalogRequested = false
    return v
  }

  consumeStats(): boolean {
    const v = this.statsRequested
    this.statsRequested = false
    return v
  }

  consumeShop(): boolean {
    const v = this.shopRequested
    this.shopRequested = false
    return v
  }

  consumeLook(): LookDelta {
    const d = { ...this.lookDelta }
    this.lookDelta.x = 0
    this.lookDelta.y = 0
    return d
  }

  isKeyDown(code: string): boolean {
    return this.keys.has(code)
  }
}
