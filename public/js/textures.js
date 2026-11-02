import * as THREE from 'three';
import { TIMETABLE } from './schedule.js';

export const CANVAS_FONT = '"Pretendard", "Malgun Gothic", "Apple SD Gothic Neo", sans-serif';

// 칠판과 포스터는 캔버스에 그리므로 글꼴을 먼저 받아 둔다. 느린 인터넷에서는 오래 기다리지 않는다.
export async function loadCanvasFont() {
  const loaded = document.fonts.load(`700 40px ${CANVAS_FONT}`, '우리 교실').catch(() => {});
  await Promise.race([loaded, new Promise((resolve) => setTimeout(resolve, 5000))]);
}

export function makeCanvas(w, h) {
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  return [canvas, canvas.getContext('2d')];
}

export function toTexture(canvas, { repeat } = {}) {
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 8;
  if (repeat) {
    texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(repeat[0], repeat[1]);
  }
  return texture;
}

function seeded(seed) {
  let s = seed;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

function speckle(ctx, w, h, count, alpha, rand = Math.random) {
  for (let i = 0; i < count; i++) {
    const shade = rand() < 0.5 ? 0 : 255;
    ctx.fillStyle = `rgba(${shade},${shade},${shade},${rand() * alpha})`;
    ctx.fillRect(rand() * w, rand() * h, 1 + rand() * 2, 1 + rand() * 2);
  }
}

export function floorTexture() {
  const [canvas, ctx] = makeCanvas(1024, 1024);
  const rand = seeded(7);
  const plankH = 128;
  for (let row = 0; row < 8; row++) {
    let x = -rand() * 300;
    while (x < 1024) {
      const len = 280 + rand() * 300;
      const l = 40 + rand() * 9;
      ctx.fillStyle = `hsl(${29 + rand() * 5}, ${30 + rand() * 7}%, ${l + 6}%)`;
      ctx.fillRect(x, row * plankH, len, plankH);
      for (let g = 0; g < 26; g++) {
        const y = row * plankH + rand() * plankH;
        ctx.strokeStyle = `rgba(50,25,8,${0.04 + rand() * 0.1})`;
        ctx.lineWidth = 1 + rand() * 1.5;
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.bezierCurveTo(x + len * 0.3, y + rand() * 8 - 4, x + len * 0.6, y + rand() * 8 - 4, x + len, y);
        ctx.stroke();
      }
      ctx.fillStyle = 'rgba(30,15,5,.55)';
      ctx.fillRect(x + len - 2, row * plankH, 2, plankH);
      x += len;
    }
    ctx.fillStyle = 'rgba(30,15,5,.55)';
    ctx.fillRect(0, row * plankH, 1024, 2);
  }
  return toTexture(canvas, { repeat: [6, 7] });
}

export function deskTexture() {
  const [canvas, ctx] = makeCanvas(256, 128);
  const rand = seeded(11);
  ctx.fillStyle = '#d9b27c';
  ctx.fillRect(0, 0, 256, 128);
  for (let i = 0; i < 40; i++) {
    const y = rand() * 128;
    ctx.strokeStyle = `rgba(120,75,30,${0.05 + rand() * 0.12})`;
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.bezierCurveTo(80, y + rand() * 6 - 3, 170, y + rand() * 6 - 3, 256, y);
    ctx.stroke();
  }
  return toTexture(canvas);
}

export function ceilingTexture() {
  const [canvas, ctx] = makeCanvas(256, 256);
  const rand = seeded(23);
  ctx.fillStyle = '#efe9da';
  ctx.fillRect(0, 0, 256, 256);
  speckle(ctx, 256, 256, 500, 0.08, rand);
  ctx.strokeStyle = 'rgba(120,110,90,.45)';
  ctx.lineWidth = 2;
  ctx.strokeRect(0, 0, 256, 256);
  return toTexture(canvas, { repeat: [9, 10] });
}

export function flagTexture() {
  const W = 600;
  const H = 400;
  const [canvas, ctx] = makeCanvas(W, H);
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, W, H);
  const D = H / 2;
  const R = D / 2;
  const angle = Math.atan2(2, 3);
  ctx.translate(W / 2, H / 2);

  ctx.save();
  ctx.rotate(angle);
  ctx.fillStyle = '#cd2e3a';
  ctx.beginPath();
  ctx.arc(0, 0, R, Math.PI, 0);
  ctx.fill();
  ctx.fillStyle = '#0047a0';
  ctx.beginPath();
  ctx.arc(0, 0, R, 0, Math.PI);
  ctx.fill();
  ctx.fillStyle = '#cd2e3a';
  ctx.beginPath();
  ctx.arc(-R / 2, 0, R / 2, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#0047a0';
  ctx.beginPath();
  ctx.arc(R / 2, 0, R / 2, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // 건(좌상) 곤(우하) 감(우상) 리(좌하). 안쪽 효가 먼저.
  const trigrams = [
    { x: -1, y: -1, bars: [1, 1, 1] },
    { x: 1, y: 1, bars: [0, 0, 0] },
    { x: 1, y: -1, bars: [0, 1, 0] },
    { x: -1, y: 1, bars: [1, 0, 1] },
  ];
  const barLen = D / 2;
  const barH = D / 12;
  const gap = D / 24;
  const dist = (D * 11) / 12;
  ctx.fillStyle = '#000';
  for (const tri of trigrams) {
    const a = Math.atan2(tri.y * 2, tri.x * 3);
    ctx.save();
    ctx.translate(Math.cos(a) * dist, Math.sin(a) * dist);
    ctx.rotate(a);
    tri.bars.forEach((solid, i) => {
      const x = (i - 1) * (barH + gap) - barH / 2;
      if (solid) {
        ctx.fillRect(x, -barLen / 2, barH, barLen);
      } else {
        const half = (barLen - gap) / 2;
        ctx.fillRect(x, -barLen / 2, barH, half);
        ctx.fillRect(x, gap / 2, barH, half);
      }
    });
    ctx.restore();
  }
  return toTexture(canvas);
}

export function mottoTexture() {
  const [canvas, ctx] = makeCanvas(640, 220);
  ctx.fillStyle = '#fbf6e6';
  ctx.fillRect(0, 0, 640, 220);
  ctx.fillStyle = '#8a3b2a';
  ctx.font = `700 34px ${CANVAS_FONT}`;
  ctx.textAlign = 'center';
  ctx.fillText('급훈', 320, 58);
  ctx.fillStyle = '#2d2a26';
  ctx.font = `700 66px ${CANVAS_FONT}`;
  ctx.fillText('서로 돕고 함께 웃자', 320, 150);
  return toTexture(canvas);
}

export function timetableTexture(day) {
  const [canvas, ctx] = makeCanvas(512, 620);
  ctx.fillStyle = '#fdf9ec';
  ctx.fillRect(0, 0, 512, 620);
  ctx.fillStyle = '#2d5a45';
  ctx.font = `700 54px ${CANVAS_FONT}`;
  ctx.textAlign = 'center';
  ctx.fillText('시간표', 256, 64);
  const left = 64;
  const top = 90;
  const cw = 84;
  const ch = 76;
  ctx.font = `700 34px ${CANVAS_FONT}`;
  ctx.textBaseline = 'middle';
  ['월', '화', '수', '목', '금'].forEach((label, col) => {
    if (col + 1 === day) {
      ctx.fillStyle = '#f7dc8c';
      ctx.fillRect(left + col * cw, top, cw, ch * 7);
    }
    ctx.fillStyle = '#2d2a26';
    ctx.fillText(label, left + col * cw + cw / 2, top + ch / 2);
  });
  ctx.font = `700 29px ${CANVAS_FONT}`;
  for (let row = 0; row < 6; row++) {
    ctx.fillStyle = '#8a3b2a';
    ctx.fillText(String(row + 1), left - 26, top + ch * (row + 1) + ch / 2);
    ctx.fillStyle = '#2d2a26';
    for (let col = 0; col < 5; col++) {
      ctx.fillText(TIMETABLE[col][row], left + col * cw + cw / 2, top + ch * (row + 1) + ch / 2);
    }
  }
  ctx.strokeStyle = 'rgba(45,42,38,.5)';
  ctx.lineWidth = 2;
  for (let i = 0; i <= 7; i++) {
    ctx.beginPath();
    ctx.moveTo(left, top + i * ch);
    ctx.lineTo(left + cw * 5, top + i * ch);
    ctx.stroke();
  }
  for (let i = 0; i <= 5; i++) {
    ctx.beginPath();
    ctx.moveTo(left + i * cw, top);
    ctx.lineTo(left + i * cw, top + ch * 7);
    ctx.stroke();
  }
  return toTexture(canvas);
}

export function clockTexture() {
  const [canvas, ctx] = makeCanvas(256, 256);
  ctx.fillStyle = '#fbf8ee';
  ctx.beginPath();
  ctx.arc(128, 128, 126, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#222';
  ctx.font = `700 30px ${CANVAS_FONT}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  for (let i = 1; i <= 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    ctx.fillText(String(i), 128 + Math.sin(a) * 96, 128 - Math.cos(a) * 96);
  }
  return toTexture(canvas);
}

// 게시판에 붙일 어린이 그림. 무작위 크레파스 풍경.
export function drawingTexture(seed) {
  const [canvas, ctx] = makeCanvas(256, 200);
  const rand = seeded(seed * 97 + 13);
  const paper = ['#fffdf5', '#fff4d9', '#f0f6ff', '#fdeef0'][seed % 4];
  ctx.fillStyle = paper;
  ctx.fillRect(0, 0, 256, 200);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  const crayon = (color, width = 5) => { ctx.strokeStyle = color; ctx.fillStyle = color; ctx.lineWidth = width; };

  crayon('#6aa84f', 7);
  for (let x = 0; x < 256; x += 9) {
    ctx.beginPath();
    ctx.moveTo(x, 200);
    ctx.lineTo(x + rand() * 8, 158 + rand() * 12);
    ctx.stroke();
  }
  const sunX = seed % 2 ? 216 : 38;
  crayon(seed % 5 === 2 ? '#e8702a' : '#f2b632');
  ctx.beginPath();
  ctx.arc(sunX, 36, 16 + rand() * 5, 0, Math.PI * 2);
  ctx.fill();
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    ctx.beginPath();
    ctx.moveTo(sunX + Math.cos(a) * 24, 36 + Math.sin(a) * 24);
    ctx.lineTo(sunX + Math.cos(a) * 34, 36 + Math.sin(a) * 34);
    ctx.stroke();
  }

  const kind = seed % 5;
  if (kind === 3) {
    // 무지개
    ['#d1553f', '#e8a02a', '#e6d33f', '#5da84f', '#3d85c6', '#7b5ab5'].forEach((color, i) => {
      crayon(color, 8);
      ctx.beginPath();
      ctx.arc(128, 168, 94 - i * 9, Math.PI, 0);
      ctx.stroke();
    });
  } else if (kind === 4) {
    // 나무
    crayon('#7a4f2c', 14);
    ctx.beginPath();
    ctx.moveTo(128, 166);
    ctx.lineTo(128, 96);
    ctx.stroke();
    crayon(seed % 2 ? '#d98a2e' : '#4f9a48');
    for (let i = 0; i < 7; i++) {
      ctx.beginPath();
      ctx.arc(128 + Math.cos(i) * 34, 76 + Math.sin(i) * 26, 24, 0, Math.PI * 2);
      ctx.fill();
    }
  } else if (kind === 0) {
    crayon('#d1553f');
    ctx.beginPath();
    ctx.moveTo(90, 100); ctx.lineTo(150, 54); ctx.lineTo(210, 100); ctx.closePath();
    ctx.fill();
    crayon('#8d6e4d');
    ctx.fillRect(104, 100, 92, 62);
    crayon('#fff4d9');
    ctx.fillRect(140, 122, 22, 40);
  } else if (kind === 1) {
    for (let i = 0; i < 4; i++) {
      const x = 76 + i * 44;
      crayon(['#d1553f', '#7b5ab5', '#e58fb0', '#3d85c6'][i]);
      for (let p = 0; p < 6; p++) {
        const a = (p / 6) * Math.PI * 2;
        ctx.beginPath();
        ctx.arc(x + Math.cos(a) * 10, 104 + Math.sin(a) * 10, 7, 0, Math.PI * 2);
        ctx.fill();
      }
      crayon('#f2b632');
      ctx.beginPath();
      ctx.arc(x, 104, 6, 0, Math.PI * 2);
      ctx.fill();
      crayon('#4f8a3f', 4);
      ctx.beginPath();
      ctx.moveTo(x, 118);
      ctx.lineTo(x, 164);
      ctx.stroke();
    }
  } else {
    for (let i = 0; i < 3; i++) {
      const x = 90 + i * 54;
      crayon('#333', 4);
      ctx.beginPath();
      ctx.arc(x, 84, 16, 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(x, 100); ctx.lineTo(x, 134);
      ctx.moveTo(x - 20, 112); ctx.lineTo(x + 20, 112);
      ctx.moveTo(x, 134); ctx.lineTo(x - 14, 160);
      ctx.moveTo(x, 134); ctx.lineTo(x + 14, 160);
      ctx.stroke();
    }
  }
  return toTexture(canvas);
}

export function bulletinHeaderTexture() {
  const [canvas, ctx] = makeCanvas(640, 110);
  ctx.clearRect(0, 0, 640, 110);
  ctx.font = `700 74px ${CANVAS_FONT}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const letters = [...'우리 반 작품'];
  const colors = ['#c9503e', '#3f6ea6', '#e0a52e', '#4e8a5f', '#8a5aa8', '#c9503e', '#3f6ea6'];
  letters.forEach((letter, i) => {
    ctx.fillStyle = colors[i % colors.length];
    ctx.fillText(letter, 110 + i * 70, 56 + (i % 2 ? 5 : -5));
  });
  return toTexture(canvas);
}

export function classSignTexture(name) {
  const [canvas, ctx] = makeCanvas(320, 120);
  ctx.fillStyle = '#fbf6e6';
  ctx.fillRect(0, 0, 320, 120);
  ctx.fillStyle = '#2d2a26';
  ctx.font = `700 62px ${CANVAS_FONT}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(name, 160, 62);
  return toTexture(canvas);
}

export function softBlobTexture(inner = 'rgba(255,255,255,1)', outer = 'rgba(255,255,255,0)') {
  const [canvas, ctx] = makeCanvas(128, 128);
  const gradient = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
  gradient.addColorStop(0, inner);
  gradient.addColorStop(1, outer);
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 128, 128);
  return toTexture(canvas);
}
