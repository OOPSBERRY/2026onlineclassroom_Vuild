import * as THREE from 'three';
import {
  bulletinHeaderTexture, ceilingTexture, classSignTexture, clockTexture, deskTexture, drawingTexture,
  flagTexture, floorTexture, mottoTexture, softBlobTexture, timetableTexture,
} from './textures.js';
import { kstNow } from './schedule.js';

export const ROOM = { halfX: 8, halfZ: 9, height: 4.8 };
export const BOARD = { width: 9.6, height: 2.2, y: 2.25, z: -8.84 };

// 자습 교실은 밝은 낮, 추억 교실은 노을 지는 저녁이다.
const MOODS = {
  day: {
    sunDir: new THREE.Vector3(-22, 14, 7).normalize(),
    sunColor: 0xffe2b8,
    sunPower: 2.5,
    hemi: [0xfff7ea, 0xd2c2a8, 1.55],
    bounce: [0xffd8a8, 9],
    fill: [0xfff0d8, 22],
    skyLow: [1.0, 0.86, 0.68],
    skyHigh: [0.45, 0.68, 0.92],
    sunGlow: [1.0, 0.78, 0.5],
    cloud: 0xffffff,
    shaft: [0.045, 0.034, 0.02],
    exposure: 0.92,
  },
  sunset: {
    sunDir: new THREE.Vector3(-24, 7, 8).normalize(),
    sunColor: 0xff9d5c,
    sunPower: 3.1,
    hemi: [0xffc9a6, 0x8f6c58, 1.05],
    bounce: [0xff9c62, 11],
    fill: [0xffc08e, 10],
    skyLow: [1.0, 0.56, 0.32],
    skyHigh: [0.34, 0.33, 0.62],
    sunGlow: [1.0, 0.55, 0.25],
    cloud: 0xffb48f,
    shaft: [0.028, 0.016, 0.007],
    exposure: 0.95,
  },
};

const unitBox = new THREE.BoxGeometry(1, 1, 1);

// 고정 소품은 재질별로 InstancedMesh 하나로 묶어 그리기 호출을 줄인다.
class BoxBatch {
  constructor() { this.groups = new Map(); }
  add(material, w, h, d, x, y, z, ry = 0) {
    if (!this.groups.has(material)) this.groups.set(material, []);
    const matrix = new THREE.Matrix4().compose(
      new THREE.Vector3(x, y, z),
      new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), ry),
      new THREE.Vector3(w, h, d),
    );
    this.groups.get(material).push(matrix);
  }
  build(scene) {
    for (const [material, matrices] of this.groups) {
      const mesh = new THREE.InstancedMesh(unitBox, material, matrices.length);
      matrices.forEach((m, i) => mesh.setMatrixAt(i, m));
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      scene.add(mesh);
    }
  }
}

const std = (color, roughness = 0.85, extra = {}) => new THREE.MeshStandardMaterial({ color, roughness, ...extra });

function plane(scene, w, h, material, x, y, z, ry = 0) {
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, h), material);
  mesh.position.set(x, y, z);
  mesh.rotation.y = ry;
  mesh.receiveShadow = true;
  scene.add(mesh);
  return mesh;
}

export function buildWorld(scene, board, roomName, moodName) {
  const mood = MOODS[moodName];
  const batch = new BoxBatch();
  const mats = {
    wall: std(0xf0e7d2),
    wainscot: std(0x93ad98),
    trim: std(0x6e5138, 0.7),
    frame: std(0xece8df, 0.5),
    wood: std(0xa8743f, 0.65),
    woodDark: std(0x6e4a2a, 0.65),
    desk: std(0xffffff, 0.55, { map: deskTexture() }),
    metal: std(0x8d9296, 0.45),
    chair: std(0xc99a5f, 0.6),
    locker: std(0xe9dfc8, 0.6),
    lockerDoor: [std(0xd98f73, 0.6), std(0x8fb6c9, 0.6), std(0xdcc06d, 0.6), std(0x9cbf95, 0.6)],
    cork: std(0xb98b57, 0.95),
    white: std(0xf7f5ef, 0.6),
    black: std(0x24262a, 0.45),
    pot: std(0xb5613f, 0.8),
    leaf: std(0x4f8a4a, 0.8),
    tray: std(0x8e8a80, 0.6),
  };

  const obstacles = [];
  const block = (minX, maxX, minZ, maxZ) => obstacles.push({ minX, maxX, minZ, maxZ });

  buildShell(scene, batch, mats);
  buildFrontWall(scene, batch, mats, board);
  buildBackWall(scene, batch, mats, block);
  buildDoorWall(scene, batch, mats);
  const seats = buildDesks(batch, mats, block);
  const pickSeats = seatHitBoxes(scene, seats);
  buildTeacherCorner(batch, mats, block);
  const sign = plane(scene, 1.1, 0.42, new THREE.MeshStandardMaterial({ map: classSignTexture(roomName), roughness: 0.8 }), -5.9, 3.86, -8.84);
  sign.castShadow = false;

  batch.build(scene);
  buildLights(scene, mood);
  buildOutdoors(scene, mood);

  const fans = buildFans(scene, mats);
  const clock = buildClock(scene);
  const dust = buildDust(scene);
  buildLightShafts(scene, mood);

  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(ROOM.halfX * 2, ROOM.halfZ * 2),
    new THREE.MeshStandardMaterial({ map: floorTexture(), roughness: 0.5 }),
  );
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  scene.add(floor);

  const boardMesh = new THREE.Mesh(new THREE.PlaneGeometry(BOARD.width, BOARD.height), board.material);
  boardMesh.position.set(0, BOARD.y, BOARD.z);
  boardMesh.receiveShadow = true;
  scene.add(boardMesh);

  function update(dt, time) {
    for (const fan of fans) fan.rotation.y += dt * 1.1;
    const t = kstNow();
    clock.minute.rotation.z = -((t.minute + t.second / 60) / 60) * Math.PI * 2;
    clock.hour.rotation.z = -(((t.hour % 12) + t.minute / 60) / 12) * Math.PI * 2;
    dust.material.opacity = 0.5 + Math.sin(time * 0.4) * 0.12;
    const position = dust.geometry.attributes.position;
    for (let i = 0; i < position.count; i++) {
      let y = position.getY(i) + dt * 0.035;
      if (y > 3.8) y = 0.3;
      position.setY(i, y);
      position.setX(i, position.getX(i) + Math.sin(time * 0.3 + i) * dt * 0.03);
    }
    position.needsUpdate = true;
  }

  return { floor, boardMesh, pickSeats, seats, obstacles, update, exposure: mood.exposure };
}

function buildShell(scene, batch, m) {
  const { halfX: X, halfZ: Z, height: H } = ROOM;
  const t = 0.3;

  // 창문 쪽 벽(x = -8): 빛이 들어오도록 네 개의 창을 뚫는다.
  const sill = 1.05;
  const head = 3.95;
  const centers = [-6, -2, 2, 6];
  const winW = 3.2;
  const wx = -X - t / 2;
  batch.add(m.wall, t, H - head, Z * 2, wx, (H + head) / 2, 0);
  batch.add(m.wall, t, sill, Z * 2, wx, sill / 2, 0);
  batch.add(m.wainscot, 0.03, sill, Z * 2, -X + 0.015, sill / 2, 0);
  const edges = [-Z, ...centers.flatMap((c) => [c - winW / 2, c + winW / 2]), Z];
  for (let i = 0; i < edges.length; i += 2) {
    const w = edges[i + 1] - edges[i];
    batch.add(m.wall, t, head - sill, w, wx, (head + sill) / 2, (edges[i] + edges[i + 1]) / 2);
  }
  for (const c of centers) {
    batch.add(m.frame, 0.1, 0.08, winW, -X, sill, c);
    batch.add(m.frame, 0.1, 0.08, winW, -X, head, c);
    batch.add(m.frame, 0.1, 0.05, winW, -X, 2.75, c);
    batch.add(m.frame, 0.1, head - sill, 0.07, -X, (head + sill) / 2, c);
    batch.add(m.frame, 0.1, head - sill, 0.06, -X, (head + sill) / 2, c - winW / 2);
    batch.add(m.frame, 0.1, head - sill, 0.06, -X, (head + sill) / 2, c + winW / 2);
    batch.add(m.white, 0.26, 0.06, winW, -X + 0.13, sill - 0.03, c);

    // 접어 둔 커튼
    const curtain = std(0xe9dcbd, 0.95);
    for (const side of [-1, 1]) {
      for (let f = 0; f < 3; f++) {
        batch.add(curtain, 0.12, head - sill + 0.35, 0.09, -X + 0.14, (head + sill) / 2 - 0.1, c + side * (winW / 2 - 0.05 - f * 0.1));
      }
    }
    batch.add(m.metal, 0.05, 0.05, winW + 0.5, -X + 0.14, head + 0.1, c);

    const glass = new THREE.Mesh(
      new THREE.PlaneGeometry(winW, head - sill),
      new THREE.MeshStandardMaterial({ color: 0xdfeef2, transparent: true, opacity: 0.07, roughness: 0.05 }),
    );
    glass.position.set(-X - 0.02, (head + sill) / 2, c);
    glass.rotation.y = Math.PI / 2;
    scene.add(glass);
  }

  // 화분과 창턱 소품
  for (const [z, s] of [[-6.8, 1], [-1.2, 0.8], [2.7, 1.1], [6.5, 0.85]]) {
    batch.add(m.pot, 0.2, 0.18, 0.2, -X + 0.14, sill + 0.09, z);
    const leaf = new THREE.Mesh(new THREE.IcosahedronGeometry(0.17 * s, 1), m.leaf);
    leaf.position.set(-X + 0.14, sill + 0.3 * s, z);
    leaf.castShadow = true;
    scene.add(leaf);
  }

  // 나머지 세 벽
  batch.add(m.wall, t, H, Z * 2, X + t / 2, H / 2, 0);
  batch.add(m.wainscot, 0.03, 1.05, Z * 2, X - 0.015, 0.525, 0);
  batch.add(m.wall, X * 2 + t * 2, H, t, 0, H / 2, -Z - t / 2);
  batch.add(m.wainscot, X * 2, 1.05, 0.03, 0, 0.525, -Z + 0.015);
  batch.add(m.wall, X * 2 + t * 2, H, t, 0, H / 2, Z + t / 2);
  batch.add(m.wainscot, X * 2, 1.05, 0.03, 0, 0.525, Z - 0.015);

  // 몰딩과 걸레받이
  batch.add(m.trim, X * 2, 0.06, 0.05, 0, 1.08, -Z + 0.03);
  batch.add(m.trim, X * 2, 0.06, 0.05, 0, 1.08, Z - 0.03);
  batch.add(m.trim, 0.05, 0.06, Z * 2, X - 0.03, 1.08, 0);
  batch.add(m.trim, 0.05, 0.06, Z * 2, -X + 0.03, 1.08, 0);

  // 천장
  const ceilingMat = new THREE.MeshStandardMaterial({ map: ceilingTexture(), roughness: 0.9, emissive: 0x8d8778, emissiveIntensity: 0.55 });
  const ceiling = plane(scene, X * 2, Z * 2, ceilingMat, 0, H, 0);
  ceiling.rotation.x = Math.PI / 2;
  batch.add(m.wall, X * 2 + t * 2, 0.3, Z * 2 + t * 2, 0, H + 0.16, 0);

  // 형광등
  const lamp = new THREE.MeshStandardMaterial({ color: 0xfffaf0, emissive: 0xfff4dc, emissiveIntensity: 1.1 });
  for (const x of [-4.2, 0, 4.2]) {
    for (const z of [-5, 0, 5]) {
      batch.add(lamp, 0.34, 0.05, 2.1, x, H - 0.05, z);
      batch.add(m.frame, 0.46, 0.04, 2.2, x, H - 0.02, z);
    }
  }
}

function buildFrontWall(scene, batch, m, board) {
  const { width, height, y, z } = BOARD;
  // 칠판 틀과 분필 받침
  batch.add(m.trim, width + 0.24, 0.1, 0.1, 0, y + height / 2 + 0.05, z - 0.08);
  batch.add(m.trim, width + 0.24, 0.1, 0.1, 0, y - height / 2 - 0.05, z - 0.08);
  batch.add(m.trim, 0.12, height, 0.1, -width / 2 - 0.06, y, z - 0.08);
  batch.add(m.trim, 0.12, height, 0.1, width / 2 + 0.06, y, z - 0.08);
  batch.add(m.tray, width + 0.1, 0.05, 0.2, 0, y - height / 2 - 0.1, z + 0.05);
  const chalks = [0xf5f3ea, 0xf7dd72, 0xf2a3b3, 0xf5f3ea];
  chalks.forEach((color, i) => batch.add(std(color), 0.14, 0.03, 0.03, -3.4 + i * 0.5, y - height / 2 - 0.06, z + 0.05, i * 0.5));
  batch.add(std(0x3b3f46, 0.9), 0.32, 0.07, 0.12, 2.8, y - height / 2 - 0.04, z + 0.05);

  // 태극기
  batch.add(m.trim, 1.0, 0.7, 0.04, 0, 4.05, -8.97);
  const flag = plane(scene, 0.9, 0.6, new THREE.MeshStandardMaterial({ map: flagTexture(), roughness: 0.8 }), 0, 4.05, -8.94);
  flag.castShadow = false;

  // 급훈
  batch.add(m.trim, 1.76, 0.66, 0.04, 3.1, 4.02, -8.97);
  plane(scene, 1.66, 0.56, new THREE.MeshStandardMaterial({ map: mottoTexture(), roughness: 0.8 }), 3.1, 4.02, -8.94);

  // 시간표
  batch.add(m.trim, 1.24, 1.48, 0.04, -6.4, 2.25, -8.97);
  plane(scene, 1.14, 1.38, new THREE.MeshStandardMaterial({ map: timetableTexture(kstNow().day), roughness: 0.85 }), -6.4, 2.25, -8.94);

  // TV
  batch.add(m.black, 1.5, 0.88, 0.09, 6.4, 3.3, -8.9);
  batch.add(std(0x11151a, 0.2), 1.42, 0.8, 0.02, 6.4, 3.3, -8.85);
  batch.add(m.metal, 0.08, 0.5, 0.08, 6.4, 3.92, -8.93);

  // 알림판
  batch.add(m.cork, 1.3, 1.1, 0.04, 6.4, 1.85, -8.97);
  [[0xfff4d9, -0.28, 0.15], [0xe7f1fa, 0.25, 0.2], [0xfde8ec, -0.15, -0.25], [0xf0f7e4, 0.3, -0.22]].forEach(([color, dx, dy]) => {
    batch.add(std(color), 0.42, 0.42, 0.01, 6.4 + dx, 1.85 + dy, -8.94);
  });
}

function buildBackWall(scene, batch, m, block) {
  const Z = ROOM.halfZ;
  // 게시판
  batch.add(m.trim, 13.4, 2.3, 0.05, 0, 2.9, Z - 0.05);
  batch.add(m.cork, 13.2, 2.1, 0.04, 0, 2.9, Z - 0.09);
  const ry = Math.PI;
  const header = plane(scene, 3.4, 0.58, new THREE.MeshStandardMaterial({ map: bulletinHeaderTexture(), transparent: true, roughness: 0.9 }), 0, 3.66, Z - 0.13, ry);
  header.castShadow = false;
  for (let i = 0; i < 12; i++) {
    const col = i % 6;
    const row = i < 6 ? 0 : 1;
    if (row === 0 && (col === 2 || col === 3)) continue;
    const x = -5.3 + col * 2.12;
    const y = (row === 0 ? 3.42 : 2.5) + ((i * 37) % 7) * 0.008;
    const w = 1.32;
    const h = 0.82;
    const paper = plane(scene, w, h, new THREE.MeshStandardMaterial({ map: drawingTexture(i), roughness: 0.95 }), x, y, Z - 0.13, ry);
    paper.rotation.z = ((i * 53) % 9 - 4) * 0.006;
    batch.add(std([0xd1553f, 0x3f6ea6, 0xe0a52e][i % 3], 0.4), 0.06, 0.06, 0.02, x, y + h / 2 - 0.04, Z - 0.14);
  }

  // 사물함: 네 줄이 아니라 두 줄 28칸
  const minX = -7;
  const cell = 0.96;
  for (let col = 0; col < 14; col++) {
    const x = minX + cell / 2 + col * cell;
    batch.add(m.locker, cell, 1.42, 0.68, x, 0.71, Z - 0.42);
    for (let row = 0; row < 2; row++) {
      const door = m.lockerDoor[(col * 3 + row) % m.lockerDoor.length];
      const y = 0.38 + row * 0.68;
      batch.add(door, cell - 0.07, 0.6, 0.03, x, y, Z - 0.77);
      batch.add(m.metal, 0.12, 0.03, 0.03, x, y + 0.2, Z - 0.8);
      batch.add(m.white, 0.3, 0.09, 0.01, x, y - 0.1, Z - 0.79);
    }
  }
  block(-7.1, 6.5, Z - 0.8, Z);

  // 청소도구함과 쓰레기통
  batch.add(std(0x7e8d94, 0.5), 0.9, 2.1, 0.68, 7.1, 1.05, Z - 0.42);
  batch.add(m.metal, 0.03, 0.2, 0.03, 6.82, 1.1, Z - 0.79);
  batch.add(std(0x4f7c8c, 0.7), 0.5, 0.65, 0.5, 7.4, 0.33, Z - 1.5);
  block(6.5, 8, Z - 0.8, Z);
  block(7.1, 7.7, Z - 1.8, Z - 1.2);
}

function buildDoorWall(scene, batch, m) {
  const x = ROOM.halfX - 0.04;
  const glow = new THREE.MeshStandardMaterial({ color: 0xdfe5df, emissive: 0xcfd8cf, emissiveIntensity: 0.42, roughness: 0.9 });
  for (const z of [-6.6, 6.2]) {
    batch.add(m.woodDark, 0.08, 3, 1.9, x, 1.5, z);
    batch.add(m.wood, 0.08, 2.8, 1.65, x - 0.03, 1.42, z);
    batch.add(glow, 0.02, 0.9, 0.8, x - 0.08, 2.1, z);
    batch.add(m.metal, 0.07, 0.22, 0.05, x - 0.09, 1.2, z - 0.6);
  }
  // 복도 창
  for (const z of [-2.8, 0, 2.8]) {
    batch.add(m.frame, 0.08, 1.46, 2.6, x, 2.4, z);
    batch.add(glow, 0.02, 1.3, 2.44, x - 0.05, 2.4, z);
    batch.add(m.frame, 0.03, 1.3, 0.05, x - 0.07, 2.4, z);
  }
}

function buildDesks(batch, m, block) {
  const seats = [];
  const columns = [-4.6, 0, 4.6];
  const rows = [-4.5, -1.7, 1.1, 3.9];
  const jitter = (i) => ((i * 7919) % 11 - 5) * 0.008;

  const addDesk = (x, deskZ) => {
    const i = seats.length;
    batch.add(m.desk, 0.92, 0.04, 0.6, x, 0.72, deskZ);
    batch.add(m.woodDark, 0.84, 0.02, 0.48, x, 0.6, deskZ);
    for (const [dx, dz] of [[-0.42, -0.26], [0.42, -0.26], [-0.42, 0.26], [0.42, 0.26]]) {
      batch.add(m.metal, 0.035, 0.7, 0.035, x + dx, 0.35, deskZ + dz);
    }
    const jx = jitter(i + 1);
    const chairZ = deskZ + 0.62 + jitter(i + 5);
    const chairX = x + jx;
    batch.add(m.chair, 0.42, 0.035, 0.42, chairX, 0.42, chairZ);
    batch.add(m.chair, 0.4, 0.22, 0.03, chairX, 0.72, chairZ + 0.2);
    for (const [dx, dz] of [[-0.18, -0.18], [0.18, -0.18], [-0.18, 0.18], [0.18, 0.18]]) {
      batch.add(m.metal, 0.03, 0.42, 0.03, chairX + dx, 0.21, chairZ + dz);
    }
    batch.add(m.metal, 0.025, 0.36, 0.025, chairX - 0.17, 0.6, chairZ + 0.19);
    batch.add(m.metal, 0.025, 0.36, 0.025, chairX + 0.17, 0.6, chairZ + 0.19);
    seats.push({ index: i, x: chairX, z: chairZ, standX: x, standZ: deskZ + 1.3, deskZ });
  };

  // 2인 책상 네 줄
  for (const deskZ of rows) {
    for (const cx of columns) {
      addDesk(cx - 0.48, deskZ);
      addDesk(cx + 0.48, deskZ);
      block(cx - 1, cx + 1, deskZ - 0.36, deskZ + 0.88);
    }
  }
  // 맨 뒤 가운데의 1인 책상 (25번째 자리)
  addDesk(0, 6.2);
  block(-0.52, 0.52, 5.84, 7.08);
  return seats;
}

function seatHitBoxes(scene, seats) {
  const material = new THREE.MeshBasicMaterial();
  return seats.map((seat) => {
    const mesh = new THREE.Mesh(unitBox, material);
    mesh.scale.set(0.94, 0.95, 1.22);
    mesh.position.set(seat.standX, 0.47, seat.deskZ + 0.27);
    mesh.visible = false;
    mesh.userData.seat = seat.index;
    mesh.updateMatrixWorld(true);
    scene.add(mesh);
    return mesh;
  });
}

function buildTeacherCorner(batch, m, block) {
  const x = 5.5;
  const z = -7.2;
  batch.add(m.wood, 2.1, 0.07, 1, x, 0.86, z);
  batch.add(m.woodDark, 0.5, 0.82, 0.9, x - 0.75, 0.42, z);
  batch.add(m.woodDark, 0.5, 0.82, 0.9, x + 0.75, 0.42, z);
  batch.add(m.white, 0.38, 0.05, 0.28, x - 0.4, 0.92, z);
  batch.add(std(0x3f6ea6), 0.3, 0.04, 0.22, x - 0.4, 0.97, z + 0.02, 0.15);
  batch.add(m.pot, 0.13, 0.14, 0.13, x + 0.6, 0.97, z - 0.2);
  batch.add(m.chair, 0.5, 0.05, 0.5, x, 0.5, z - 0.85);
  batch.add(m.chair, 0.5, 0.45, 0.04, x, 0.92, z - 1.1);
  batch.add(m.metal, 0.06, 0.48, 0.06, x, 0.25, z - 0.85);
  block(x - 1.1, x + 1.1, -9, z + 0.55);
}

function buildFans(scene, m) {
  const fans = [];
  for (const x of [-2.1, 2.1]) {
    for (const z of [-2.5, 2.5]) {
      const fan = new THREE.Group();
      fan.position.set(x, ROOM.height - 0.42, z);
      const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.13, 0.13, 14), m.white);
      fan.add(hub);
      for (let i = 0; i < 3; i++) {
        const blade = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.012, 0.15), m.white);
        const a = (i / 3) * Math.PI * 2;
        blade.position.set(Math.cos(a) * 0.38, 0, Math.sin(a) * 0.38);
        blade.rotation.y = -a;
        blade.castShadow = true;
        fan.add(blade);
      }
      const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.42), m.metal);
      rod.position.set(x, ROOM.height - 0.21, z);
      scene.add(rod, fan);
      fans.push(fan);
    }
  }
  return fans;
}

function buildClock(scene) {
  const x = -3.1;
  const y = 4.02;
  const z = -8.94;
  const rim = new THREE.Mesh(new THREE.CylinderGeometry(0.36, 0.36, 0.05, 40), std(0x3a3f45, 0.5));
  rim.rotation.x = Math.PI / 2;
  rim.position.set(x, y, z - 0.03);
  scene.add(rim);
  const face = new THREE.Mesh(new THREE.CircleGeometry(0.32, 40), new THREE.MeshStandardMaterial({ map: clockTexture(), roughness: 0.5 }));
  face.position.set(x, y, z);
  scene.add(face);
  const hand = (length, width, color) => {
    const pivot = new THREE.Group();
    pivot.position.set(x, y, z + 0.015);
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(width, length, 0.006), std(color, 0.5));
    mesh.position.y = length / 2 - 0.02;
    pivot.add(mesh);
    scene.add(pivot);
    return pivot;
  };
  return { hour: hand(0.17, 0.026, 0x16181b), minute: hand(0.26, 0.016, 0x16181b) };
}

function buildLights(scene, mood) {
  scene.add(new THREE.HemisphereLight(...mood.hemi));
  const sun = new THREE.DirectionalLight(mood.sunColor, mood.sunPower);
  sun.position.copy(mood.sunDir).multiplyScalar(26);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.bias = -0.0006;
  sun.shadow.normalBias = 0.02;
  const c = sun.shadow.camera;
  c.left = -15; c.right = 15; c.top = 12; c.bottom = -12; c.near = 2; c.far = 60;
  scene.add(sun);

  const bounce = new THREE.PointLight(...mood.bounce, 13, 1.6);
  bounce.position.set(-3, 1.1, 0);
  scene.add(bounce);
  const ceilingFill = new THREE.PointLight(...mood.fill, 16, 1.5);
  ceilingFill.position.set(3, 3.9, 0);
  scene.add(ceilingFill);
}

function buildOutdoors(scene, mood) {
  const sky = new THREE.Mesh(
    new THREE.SphereGeometry(180, 32, 18),
    new THREE.ShaderMaterial({
      side: THREE.BackSide,
      depthWrite: false,
      uniforms: {
        sunDir: { value: mood.sunDir },
        skyLow: { value: new THREE.Vector3(...mood.skyLow) },
        skyHigh: { value: new THREE.Vector3(...mood.skyHigh) },
        sunGlow: { value: new THREE.Vector3(...mood.sunGlow) },
      },
      vertexShader: 'varying vec3 vDir; void main(){ vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
      fragmentShader: `
        varying vec3 vDir; uniform vec3 sunDir; uniform vec3 skyLow; uniform vec3 skyHigh; uniform vec3 sunGlow;
        void main(){
          float h = clamp(vDir.y * 1.5, 0.0, 1.0);
          vec3 c = mix(skyLow, skyHigh, pow(h, 0.65));
          float s = max(dot(normalize(vDir), sunDir), 0.0);
          c += sunGlow * (pow(s, 7.0) * 0.32 + pow(s, 180.0) * 0.8);
          gl_FragColor = vec4(c, 1.0);
          #include <colorspace_fragment>
        }`,
    }),
  );
  scene.add(sky);

  const cloudMap = softBlobTexture('rgba(255,250,240,.9)', 'rgba(255,250,240,0)');
  const cloudMat = new THREE.SpriteMaterial({ map: cloudMap, color: mood.cloud, transparent: true, depthWrite: false, opacity: 0.8 });
  for (let i = 0; i < 26; i++) {
    const cloud = new THREE.Sprite(cloudMat);
    const puff = i % 4;
    const base = Math.floor(i / 4);
    cloud.position.set(-90 - base * 6 + puff * 2, 28 + ((base * 13) % 16) + puff, -68 + base * 22 + puff * 6);
    cloud.scale.set(16 + puff * 3, 6 + puff, 1);
    scene.add(cloud);
  }

  const grass = new THREE.Mesh(new THREE.CircleGeometry(170, 32), std(0x86a65f, 1));
  grass.rotation.x = -Math.PI / 2;
  grass.position.y = -0.4;
  scene.add(grass);

  const dirt = new THREE.Mesh(new THREE.PlaneGeometry(30, 52), std(0xd9bf91, 1));
  dirt.rotation.x = -Math.PI / 2;
  dirt.position.set(-30, -0.38, 0);
  scene.add(dirt);

  const line = std(0xf7f3e6, 1);
  for (const z of [-22, 22]) {
    const goal = new THREE.Group();
    const post = new THREE.BoxGeometry(0.16, 2.3, 0.16);
    for (const x of [-3, 3]) {
      const p = new THREE.Mesh(post, line);
      p.position.set(x, 0.75, 0);
      goal.add(p);
    }
    const bar = new THREE.Mesh(new THREE.BoxGeometry(6.16, 0.16, 0.16), line);
    bar.position.y = 1.9;
    goal.add(bar);
    goal.position.set(-30, 0, z);
    scene.add(goal);
  }

  const trunk = std(0x6b4a2f, 1);
  const leaves = [std(0x5f9150, 1), std(0x6f9f54, 1), std(0x88a84d, 1), std(0xd19c3e, 1)];
  const blob = new THREE.IcosahedronGeometry(1, 1);
  const trunkGeo = new THREE.CylinderGeometry(0.25, 0.4, 1, 8);
  let n = 0;
  const addTree = (x, z, s) => {
    const t = new THREE.Mesh(trunkGeo, trunk);
    t.scale.set(s, s * 3.2, s);
    t.position.set(x, s * 1.2, z);
    scene.add(t);
    for (let i = 0; i < 4; i++) {
      n += 1;
      const leaf = new THREE.Mesh(blob, leaves[n % leaves.length]);
      const r = s * (1.5 + (i % 2) * 0.7);
      leaf.scale.setScalar(r);
      leaf.position.set(x + Math.cos(i * 2) * s * 0.9, s * 3.2 + i * s * 0.5, z + Math.sin(i * 2) * s * 0.9);
      scene.add(leaf);
    }
  };
  for (let z = -60; z <= 60; z += 8) {
    addTree(-48 - ((z * z) % 7), z + ((z * 3) % 5), 2.3 + (Math.abs(z) % 3) * 0.5);
  }
  for (let z = -16; z <= 16; z += 8) addTree(-13.5, z, 1.25);

  const hill = new THREE.SphereGeometry(1, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2);
  [[-115, -50, 60, 16], [-125, 15, 75, 22], [-110, 80, 55, 14], [-135, -100, 75, 19]].forEach(([x, z, w, h]) => {
    const mesh = new THREE.Mesh(hill, std(0x7d9b78, 1));
    mesh.scale.set(w, h, w);
    mesh.position.set(x, -0.4, z);
    scene.add(mesh);
  });

  // 복도쪽·앞뒤는 벽 밖 공간이 보이지 않지만, 창밖의 교사 외벽처럼 보이는 낮은 턱을 둔다.
  const ledge = new THREE.Mesh(new THREE.BoxGeometry(1.4, 1.1, 40), std(0xe8e0cc, 0.9));
  ledge.position.set(-8.9, 0.05, 0);
  scene.add(ledge);
}

function buildDust(scene) {
  const count = 170;
  const positions = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    positions[i * 3] = -7.5 + Math.random() * 9;
    positions[i * 3 + 1] = 0.3 + Math.random() * 3.5;
    positions[i * 3 + 2] = -8 + Math.random() * 16;
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  const points = new THREE.Points(geometry, new THREE.PointsMaterial({
    map: softBlobTexture(),
    color: 0xffe9c0,
    size: 0.045,
    transparent: true,
    opacity: 0.55,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  }));
  points.frustumCulled = false;
  scene.add(points);
  return points;
}

// 창으로 들어오는 빛줄기. 창 쪽은 밝고 바닥으로 갈수록 사라지는 면을 겹친다.
function buildLightShafts(scene, mood) {
  const SUN = mood.sunDir;
  const material = new THREE.MeshBasicMaterial({
    vertexColors: true,
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending,
  });
  const positions = [];
  const colors = [];
  const near = mood.shaft;
  const far = [0, 0, 0];
  for (const c of [-6, -2, 2, 6]) {
    for (const y of [1.3, 2.1, 2.9, 3.7]) {
      const t = y / SUN.y;
      const start = [-7.9, y];
      const end = [start[0] - SUN.x * t, 0];
      const shift = -SUN.z * t;
      const a = [start[0], start[1], c - 1.45];
      const b = [start[0], start[1], c + 1.45];
      const d = [end[0], end[1], c - 1.45 + shift];
      const e = [end[0], end[1], c + 1.45 + shift];
      positions.push(...a, ...b, ...d, ...b, ...e, ...d);
      colors.push(...near, ...near, ...far, ...near, ...far, ...far);
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  scene.add(new THREE.Mesh(geometry, material));
}
