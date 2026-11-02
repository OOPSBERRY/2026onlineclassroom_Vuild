import * as THREE from 'three';
import { CANVAS_FONT, makeCanvas, toTexture } from './textures.js';
import { kstNow, WEEKDAYS } from './schedule.js';

const W = 2048;
const H = 470;

// 칠판은 날짜와 주번을 보여 주는 소품이다. 누구도 글을 쓸 수 없다.
export class Board {
  constructor() {
    [this.canvas, this.ctx] = makeCanvas(W, H);
    this.texture = toTexture(this.canvas);
    this.material = new THREE.MeshStandardMaterial({
      map: this.texture,
      roughness: 0.92,
      emissive: 0xffffff,
      emissiveMap: this.texture,
      emissiveIntensity: 0.38,
    });
    this.drawBase('');
  }

  drawBase(dutyName) {
    const ctx = this.ctx;
    ctx.fillStyle = '#2f5a48';
    ctx.fillRect(0, 0, W, H);
    // 지우개 자국
    for (let i = 0; i < 46; i++) {
      const x = Math.random() * W;
      const y = Math.random() * H;
      const g = ctx.createRadialGradient(x, y, 0, x, y, 70 + Math.random() * 130);
      g.addColorStop(0, `rgba(235,245,235,${0.015 + Math.random() * 0.035})`);
      g.addColorStop(1, 'rgba(235,245,235,0)');
      ctx.fillStyle = g;
      ctx.fillRect(x - 200, y - 200, 400, 400);
    }
    const t = kstNow();
    ctx.fillStyle = 'rgba(245,243,234,.88)';
    ctx.textAlign = 'right';
    ctx.textBaseline = 'alphabetic';
    ctx.font = `700 54px ${CANVAS_FONT}`;
    ctx.fillText(`${t.month}월 ${t.date}일 ${WEEKDAYS[t.day]}요일`, W - 44, 70);
    if (dutyName) {
      ctx.font = `700 44px ${CANVAS_FONT}`;
      ctx.fillText(`주번  ${dutyName}`, W - 44, H - 34);
    }
    ctx.textAlign = 'left';
    ctx.font = `700 44px ${CANVAS_FONT}`;
    ctx.fillStyle = 'rgba(247,221,114,.82)';
    ctx.fillText('오늘의 할 일  친구에게 인사하기', 44, 66);
    this.texture.needsUpdate = true;
  }
}
