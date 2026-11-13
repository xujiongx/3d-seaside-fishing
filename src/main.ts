import './style.css'
import { Game } from './game/Game'

const app = document.querySelector<HTMLDivElement>('#app')
if (!app) {
  throw new Error('Missing #app root')
}

app.innerHTML = `
  <div class="boot-screen">
    <div class="boot-card">
      <div class="boot-title">海边钓鱼</div>
      <div class="boot-sub">加载开源场景素材中…</div>
      <div class="boot-bar"><div class="boot-fill" id="boot-fill"></div></div>
      <div class="boot-credit">Three.js · Poly Haven · Kenney / Poly Pizza (CC0)</div>
    </div>
  </div>
`

void Game.create(app)
  .then((game) => {
    game.start()
  })
  .catch((err) => {
    console.error(err)
    app.innerHTML = `<div class="boot-screen"><div class="boot-card"><div class="boot-title">加载失败</div><p>${String(err)}</p></div></div>`
  })
