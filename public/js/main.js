import * as THREE from 'three';
import { Avatar } from './avatar.js';
import { Board } from './board.js';
import { HAIR_BY_GENDER, LOOKS, PHRASES, REGIONS, ROOM_CAPACITY, ROOM_KINDS, nickName, parseRoomId, phrasesFor, plateName, randomHair, randomLook, randomNick } from './data.js';
import { Nav } from './nav.js';
import { Net } from './net.js';
import { currentPeriod } from './schedule.js';
import { Sound } from './sound.js';
import { setupStudy } from './study.js';
import { loadCanvasFont } from './textures.js';
import { ROOM, buildWorld } from './world.js';

const $ = (id) => document.getElementById(id);
const clamp = THREE.MathUtils.clamp;
const damp = (current, target, rate, dt) => current + (target - current) * (1 - Math.exp(-rate * dt));
const hex = (value) => `#${value.toString(16).padStart(6, '0')}`;

const NPC_TARGET = 8;
const WALK_SPEED = 2.5;
const BOUNDS = { minX: -7.6, maxX: 7.6, minZ: -8.5, maxZ: 8.1 };

const store = {
  get(key, fallback) {
    try {
      const raw = localStorage.getItem(`classroom.${key}`);
      return raw === null ? fallback : JSON.parse(raw);
    } catch { return fallback; }
  },
  set(key, value) {
    try { localStorage.setItem(`classroom.${key}`, JSON.stringify(value)); } catch { /* 저장 못 해도 동작에는 지장 없다 */ }
  },
};

const params = new URLSearchParams(location.search);
let room = parseRoomId(params.get('room'));

const look = store.get('look', null) || randomLook();
const nick = store.get('nick', null) || randomNick();
store.set('look', look);
store.set('nick', nick);
const settings = { volume: 0.7, shadows: true, npc: true, ...store.get('settings', {}) };

const sound = new Sound();
sound.volume = settings.volume;

let renderer, scene, camera, world, nav, board;
let player;
const actors = new Map();
const npcs = [];
const planes = [];
const raycaster = new THREE.Raycaster();
const pointerNdc = new THREE.Vector2();
const keys = new Set();
const view = { yaw: 0, pitch: 0.3, dist: 4.4, targetDist: 4.4, pos: new THREE.Vector3(), look: new THREE.Vector3() };
let clickRing;
let realOthers = 0;
let lastSent = '';
let sendClock = 0;
const periodSpeed = params.get('demo') === '1' ? 60 : 1;
let period = currentPeriod(Date.now(), periodSpeed);
let net;

class Actor {
  constructor({ id, lookValue, nickValue, regionValue, kind }) {
    this.id = id;
    this.kind = kind;
    this.avatar = new Avatar(lookValue);
    this.x = 2.3;
    this.z = 2.9;
    this.r = Math.PI;
    this.tr = Math.PI;
    this.path = [];
    this.seat = -1;
    this.pendingSeat = -1;
    this.onArrive = null;
    this.net = null;
    this.nick = nickValue;
    this.region = regionValue;
    scene.add(this.avatar.root);
    this.buildLabel();
  }

  buildLabel() {
    this.label = document.createElement('div');
    this.label.className = 'label';
    this.bubble = document.createElement('div');
    this.bubble.className = 'bubble';
    this.bubble.hidden = true;
    this.plate = document.createElement('div');
    this.label.append(this.bubble, this.plate);
    $('labels').append(this.label);
    this.renderPlate();
  }

  renderPlate() {
    const badge = { me: '나', npc: 'NPC' }[this.kind];
    this.plate.className = `nameplate ${badge ? '' : 'plain'} ${this.kind === 'npc' ? 'npc' : ''}`;
    this.plate.textContent = '';
    if (badge) {
      const mark = document.createElement('span');
      mark.className = 'badge';
      mark.textContent = badge;
      this.plate.append(mark);
    }
    this.plate.append(plateName(this.region, this.nick));
  }

  say(text) {
    this.bubble.textContent = text;
    this.bubble.hidden = false;
    this.bubble.style.animation = 'none';
    void this.bubble.offsetWidth;
    this.bubble.style.animation = '';
    clearTimeout(this.bubbleTimer);
    this.bubbleTimer = setTimeout(() => { this.bubble.hidden = true; }, 3600);
  }

  // 앉아 있으면 먼저 책상 뒤로 나온 뒤 길을 찾는다.
  leaveSeat() {
    const seat = this.seat >= 0 ? world.seats[this.seat] : null;
    this.seat = -1;
    this.avatar.seated = false;
    return seat ? { x: seat.standX, z: seat.standZ } : null;
  }

  walkTo(x, z, onArrive) {
    const prefix = this.leaveSeat();
    const from = prefix || { x: this.x, z: this.z };
    this.path = [...(prefix ? [prefix] : []), ...nav.find(from.x, from.z, x, z)];
    this.pendingSeat = -1;
    this.onArrive = onArrive || null;
  }

  goToSeat(index) {
    const seat = world.seats[index];
    this.walkTo(seat.standX, seat.standZ);
    this.path.push({ x: seat.x, z: seat.z, final: true });
    this.pendingSeat = index;
    this.onArrive = () => {
      this.seat = index;
      this.pendingSeat = -1;
      this.avatar.seated = true;
      this.tr = Math.PI;
    };
  }

  act(name) {
    this.avatar.play(name);
    if (name === 'clap') sound.clap();
    if (name === 'throw') setTimeout(() => launchPlane(this), 300);
  }

  update(dt) {
    let moving = false;
    if (this.net) {
      const dist = Math.hypot(this.net.x - this.x, this.net.z - this.z);
      moving = dist > 0.06;
      this.x = damp(this.x, this.net.x, 8, dt);
      this.z = damp(this.z, this.net.z, 8, dt);
      this.tr = this.net.r;
    } else if (this.path.length) {
      let budget = WALK_SPEED * dt * (this.kind === 'npc' ? 0.72 : 1);
      moving = true;
      while (budget > 0 && this.path.length) {
        const next = this.path[0];
        const dx = next.x - this.x;
        const dz = next.z - this.z;
        const dist = Math.hypot(dx, dz);
        if (dist > 0.001 && !next.final) this.tr = Math.atan2(dx, dz);
        if (dist <= budget) {
          this.x = next.x;
          this.z = next.z;
          budget -= dist;
          this.path.shift();
        } else {
          this.x += (dx / dist) * budget;
          this.z += (dz / dist) * budget;
          budget = 0;
        }
      }
      if (!this.path.length) {
        moving = false;
        const done = this.onArrive;
        this.onArrive = null;
        done?.();
      }
    }

    if (this.keyMoving) moving = true;
    this.keyMoving = false;

    // 짧은 회전 방향으로 돌아선다.
    let delta = this.tr - this.r;
    delta = Math.atan2(Math.sin(delta), Math.cos(delta));
    this.r += delta * (1 - Math.exp(-12 * dt));

    this.avatar.moving = moving;
    this.avatar.update(dt);
    this.avatar.root.position.x = this.x;
    this.avatar.root.position.z = this.z;
    this.avatar.root.rotation.y = this.r;
  }

  dispose() {
    scene.remove(this.avatar.root);
    this.label.remove();
    clearTimeout(this.bubbleTimer);
  }
}

// ---------- 시작 ----------

// 주소의 다른 값(demo 등)은 그대로 두고 반 번호만 바꾼 주소를 만든다.
function searchWithRoom(id) {
  const next = new URLSearchParams(location.search);
  if (id) next.set('room', id);
  else next.delete('room');
  return `?${next}`;
}

async function fetchRooms() {
  try {
    const response = await fetch('/api/rooms');
    if (response.ok) return await response.json();
  } catch { /* 서버가 없으면 인원 없이 보여 준다 */ }
  return Object.keys(ROOM_KINDS).map((kind) => ({ ...parseRoomId(`${kind}-1`), count: null }));
}

// 어느 반으로 갈지는 서버가 정한다. 서버가 없으면 1반으로 들어간다.
async function chooseRoom(kind) {
  try {
    const response = await fetch(`/api/assign?kind=${kind}`);
    if (response.ok) return parseRoomId((await response.json()).id);
  } catch { /* 아래의 1반으로 */ }
  return parseRoomId(`${kind}-1`);
}

function showEntry() {
  return new Promise((resolve) => {
    const picks = { kind: room?.kind ?? store.get('kind', null), region: store.get('region', null), gender: store.get('gender', null) };
    const select = $('entry-region');
    select.append(...REGIONS.map((name, i) => new Option(name, i)));
    if (picks.region !== null) select.value = picks.region;

    const kindCards = [...document.querySelectorAll('[data-kind]')];
    const genderCards = [...document.querySelectorAll('[data-gender]')];
    const refresh = () => {
      kindCards.forEach((c) => c.setAttribute('aria-pressed', c.dataset.kind === picks.kind));
      genderCards.forEach((c) => c.setAttribute('aria-pressed', Number(c.dataset.gender) === picks.gender));
      $('btn-enter').disabled = picks.kind === null || picks.region === null || picks.gender === null;
    };
    kindCards.forEach((c) => { c.onclick = () => { picks.kind = c.dataset.kind; refresh(); }; });
    genderCards.forEach((c) => { c.onclick = () => { picks.gender = Number(c.dataset.gender); refresh(); }; });
    select.onchange = () => {
      picks.region = select.value === '' ? null : Number(select.value);
      refresh();
    };

    $('btn-enter').onclick = async () => {
      $('btn-enter').disabled = true;
      for (const key of Object.keys(picks)) store.set(key, picks[key]);
      if (!HAIR_BY_GENDER[picks.gender].includes(look.hair)) {
        look.hair = randomHair(picks.gender);
        store.set('look', look);
      }
      room = await chooseRoom(picks.kind);
      history.replaceState(null, '', searchWithRoom(room.id));
      $('entry').hidden = true;
      resolve();
    };

    refresh();
    $('entry').hidden = false;
  });
}

async function boot() {
  // 반 주소로 바로 왔어도 지역과 모습을 아직 안 골랐으면 입구부터 거친다.
  if (!room || store.get('region', null) === null || store.get('gender', null) === null) await showEntry();
  try {
    renderer = new THREE.WebGLRenderer({ canvas: $('scene'), antialias: true, powerPreference: 'high-performance' });
  } catch {
    $('loader-text').textContent = '이 브라우저에서는 3D 교실을 열 수 없어요';
    document.querySelector('.pulse').hidden = true;
    return;
  }
  await loadCanvasFont();

  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.shadowMap.enabled = settings.shadows;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  applyQuality();

  scene = new THREE.Scene();
  scene.background = new THREE.Color(0xd8e4e4);
  camera = new THREE.PerspectiveCamera(46, innerWidth / innerHeight, 0.08, 400);

  board = new Board();
  world = buildWorld(scene, board, room.name, room.kind === 'rest' ? 'sunset' : 'day');
  renderer.toneMappingExposure = world.exposure;
  nav = new Nav(world.obstacles, BOUNDS);

  clickRing = new THREE.Mesh(
    new THREE.RingGeometry(0.17, 0.23, 32),
    new THREE.MeshBasicMaterial({ color: 0xfff6d8, transparent: true, opacity: 0, depthWrite: false }),
  );
  clickRing.rotation.x = -Math.PI / 2;
  clickRing.position.y = 0.012;
  scene.add(clickRing);

  player = new Actor({ id: 'me', lookValue: look, nickValue: nick, regionValue: store.get('region', -1), kind: 'me' });
  // 함께 들어와도 겹치지 않게 책상 사이 통로 곳곳에서 시작한다.
  player.x = (Math.random() < 0.5 ? -2.3 : 2.3) + THREE.MathUtils.randFloatSpread(1);
  player.z = THREE.MathUtils.randFloat(-1.5, 3.2);
  view.look.x = player.x;
  view.look.z = player.z;
  view.pos.set(player.x, 3, player.z + 5);
  view.look.set(player.x, 1, player.z);
  board.drawBase(nickName(nick));

  setupUi();
  setupInput();
  syncNpcCount();
  connect();
  resize();
  addEventListener('resize', resize);

  renderer.setAnimationLoop(frame);
  setTimeout(() => {
    $('loader').classList.add('fade');
    setTimeout(() => {
      $('loader').hidden = true;
      toast(`${room.name}에 들어왔어요. 같은 반 친구들만 보여요.`);
    }, 950);
  }, 900);
  setTimeout(() => $('hint').classList.add('gone'), 11000);
}

function applyQuality() {
  renderer.setPixelRatio(settings.shadows ? Math.min(devicePixelRatio, 2) : 1);
  renderer.setSize(innerWidth, innerHeight, false);
}

function resize() {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight, false);
}

// ---------- 네트워크 ----------

function setCount() {
  $('room-count').textContent = `${net?.connected ? realOthers + 1 : 1}/${ROOM_CAPACITY}`;
}

function addRemote(info) {
  const actor = new Actor({ id: info.id, lookValue: info.look, nickValue: info.nick, regionValue: info.region, kind: 'real' });
  actor.x = info.x;
  actor.z = info.z;
  actor.r = info.r;
  actor.net = { x: info.x, z: info.z, r: info.r };
  applySeat(actor, info.s);
  actors.set(info.id, actor);
  realOthers = actors.size;
  setCount();
  syncNpcCount();
}

function applySeat(actor, seat) {
  actor.seat = seat;
  actor.avatar.seated = seat >= 0;
}

function clearRemotes() {
  for (const actor of actors.values()) actor.dispose();
  actors.clear();
  realOthers = 0;
}

function connect() {
  net = new Net(room.id, {
    welcome(msg) {
      clearRemotes();
      msg.players.forEach(addRemote);
      lastSent = '';
      setCount();
    },
    join: (msg) => addRemote(msg.player),
    leave(msg) {
      actors.get(msg.id)?.dispose();
      actors.delete(msg.id);
      realOthers = actors.size;
      setCount();
      syncNpcCount();
    },
    pos(msg) {
      const actor = actors.get(msg.id);
      if (!actor) return;
      actor.net = { x: msg.x, z: msg.z, r: msg.r };
      applySeat(actor, msg.s);
    },
    act: (msg) => actors.get(msg.id)?.act(msg.a),
    say(msg) {
      actors.get(msg.id)?.say(PHRASES[msg.i]);
      sound.pop();
    },
    look(msg) {
      const actor = actors.get(msg.id);
      if (!actor) return;
      actor.avatar.setLook(msg.look);
      actor.nick = msg.nick;
      actor.renderPlate();
    },
    full() {
      net.full = true;
      toast('지금은 모든 반이 다 찼어요. 잠시 뒤에 다시 들어와 주세요.');
    },
    redirect(msg) {
      net.full = true;
      location.search = searchWithRoom(msg.room);
    },
    lost() {
      clearRemotes();
      setCount();
      syncNpcCount();
    },
  });
  net.connect(() => ({ look, nick, region: player.region }));
}

function sendPosition(dt) {
  sendClock += dt;
  if (sendClock < 0.11) return;
  sendClock = 0;
  const packet = { t: 'pos', x: +player.x.toFixed(2), z: +player.z.toFixed(2), r: +player.tr.toFixed(2), s: player.seat };
  const key = JSON.stringify(packet);
  if (key === lastSent) return;
  lastSent = key;
  net.send(packet);
}

// ---------- NPC 친구들 ----------

function freeSeats() {
  const taken = new Set();
  for (const actor of [player, ...actors.values(), ...npcs]) {
    if (actor.seat >= 0) taken.add(actor.seat);
    if (actor.pendingSeat >= 0) taken.add(actor.pendingSeat);
  }
  return world.seats.filter((seat) => !taken.has(seat.index));
}

function freeSeat() {
  const free = freeSeats();
  return free.length ? free[Math.floor(Math.random() * free.length)].index : -1;
}

function toggleSit() {
  if (player.seat >= 0) {
    const seat = world.seats[player.seat];
    player.walkTo(seat.standX, seat.standZ);
    return;
  }
  if (player.pendingSeat >= 0) {
    player.path = [];
    player.pendingSeat = -1;
    player.onArrive = null;
    return;
  }
  sitNearest();
}

function sitNearest() {
  const distance = (seat) => Math.hypot(seat.standX - player.x, seat.standZ - player.z);
  const nearest = freeSeats().sort((a, b) => distance(a) - distance(b))[0];
  if (!nearest) {
    toast('지금은 빈자리가 없어요');
    return;
  }
  player.goToSeat(nearest.index);
  showRing(nearest.standX, nearest.standZ);
}

function updateSitButton() {
  const text = player.seat >= 0 || player.pendingSeat >= 0 ? '일어서기' : '앉기';
  const label = $('sit-text');
  if (label.textContent !== text) label.textContent = text;
}

function syncNpcCount() {
  const want = settings.npc ? Math.max(0, NPC_TARGET - realOthers) : 0;
  while (npcs.length > want) npcs.pop().dispose();
  while (npcs.length < want) {
    const npc = new Actor({ id: `npc-${npcs.length}`, lookValue: randomLook(), nickValue: randomNick(), regionValue: Math.floor(Math.random() * REGIONS.length), kind: 'npc' });
    const spot = randomSpot();
    npc.x = spot.x;
    npc.z = spot.z;
    npc.tr = npc.r = Math.random() * 6;
    npc.timer = Math.random() * 2;
    npcs.push(npc);
    const seat = freeSeat();
    if (period.kind === 'class' && seat >= 0) seatInstantly(npc, seat);
  }
}

function seatInstantly(actor, index) {
  const seat = world.seats[index];
  actor.x = seat.x;
  actor.z = seat.z;
  actor.r = actor.tr = Math.PI;
  actor.seat = index;
  actor.avatar.seated = true;
}

function randomSpot() {
  for (let i = 0; i < 40; i++) {
    const x = THREE.MathUtils.randFloat(BOUNDS.minX, BOUNDS.maxX);
    const z = THREE.MathUtils.randFloat(BOUNDS.minZ, BOUNDS.maxZ);
    if (nav.isFree(x, z)) return { x, z };
  }
  return { x: 2.3, z: 6 };
}

function updateNpcs(dt) {
  for (const npc of npcs) {
    npc.timer -= dt;
    if (npc.timer > 0 || npc.path.length) continue;
    npc.timer = 3 + Math.random() * 7;

    if (period.kind === 'class') {
      if (npc.seat < 0 && npc.pendingSeat < 0) {
        const seat = freeSeat();
        if (seat >= 0) npc.goToSeat(seat);
      } else if (Math.random() < 0.12) {
        npc.act('raise');
      } else if (Math.random() < 0.1) {
        npcSay(npc);
      }
      continue;
    }

    const roll = Math.random();
    if (roll < 0.34) {
      const spot = randomSpot();
      npc.walkTo(spot.x, spot.z);
    } else if (roll < 0.46) {
      const seat = freeSeat();
      if (seat >= 0) npc.goToSeat(seat);
    } else if (roll < 0.56) {
      npc.act('clap');
    } else if (roll < 0.66) {
      npc.act('bow');
    } else if (roll < 0.74) {
      npc.act('throw');
    } else if (roll < 0.86) {
      npcSay(npc);
    }
  }
}

function npcSay(npc) {
  const list = phrasesFor(period.kind);
  npc.say(list[Math.floor(Math.random() * list.length)].text);
}

// ---------- 종이비행기 ----------

const planeGeometry = (() => {
  const g = new THREE.BufferGeometry();
  const v = [
    0, 0, 0.26, -0.13, 0.015, -0.14, 0, -0.03, -0.14,
    0, 0, 0.26, 0, -0.03, -0.14, 0.13, 0.015, -0.14,
  ];
  g.setAttribute('position', new THREE.Float32BufferAttribute(v, 3));
  g.computeVertexNormals();
  return g;
})();
const planeMaterial = new THREE.MeshStandardMaterial({ color: 0xfffdf4, side: THREE.DoubleSide, roughness: 0.8 });

function launchPlane(actor) {
  const mesh = new THREE.Mesh(planeGeometry, planeMaterial);
  mesh.castShadow = true;
  const dirX = Math.sin(actor.r);
  const dirZ = Math.cos(actor.r);
  mesh.position.set(actor.x + dirX * 0.3, actor.seat >= 0 ? 1.15 : 1.05, actor.z + dirZ * 0.3);
  mesh.rotation.y = actor.r;
  scene.add(mesh);
  planes.push({ mesh, dirX, dirZ, vy: 0.75, life: 0, landed: false, wobble: Math.random() * 6 });
  if (planes.length > 40) scene.remove(planes.shift().mesh);
  sound.whoosh();
}

function updatePlanes(dt) {
  for (let i = planes.length - 1; i >= 0; i--) {
    const p = planes[i];
    p.life += dt;
    if (!p.landed) {
      const speed = 3.9 * Math.exp(-p.life * 0.28);
      p.mesh.position.x += p.dirX * speed * dt;
      p.mesh.position.z += p.dirZ * speed * dt;
      p.vy -= 0.62 * dt;
      p.mesh.position.y += p.vy * dt;
      p.mesh.rotation.x = -p.vy * 0.5;
      p.mesh.rotation.z = Math.sin(p.life * 3 + p.wobble) * 0.3;
      const outX = Math.abs(p.mesh.position.x) > ROOM.halfX - 0.2;
      const outZ = Math.abs(p.mesh.position.z) > ROOM.halfZ - 0.2;
      if (outX) p.dirX *= -0.4;
      if (outZ) p.dirZ *= -0.4;
      if (outX || outZ) {
        p.mesh.position.x = clamp(p.mesh.position.x, -ROOM.halfX + 0.2, ROOM.halfX - 0.2);
        p.mesh.position.z = clamp(p.mesh.position.z, -ROOM.halfZ + 0.2, ROOM.halfZ - 0.2);
      }
      if (p.mesh.position.y <= 0.05) {
        p.mesh.position.y = 0.05;
        p.mesh.rotation.x = 0;
        p.mesh.rotation.z = 0;
        p.landed = true;
        p.life = 0;
      }
    } else if (p.life > 20) {
      scene.remove(p.mesh);
      planes.splice(i, 1);
    }
  }
}

// ---------- 입력 ----------

function setupInput() {
  const canvas = $('scene');
  const pointers = new Map();
  let dragged = false;
  let pinch = 0;

  const pick = (x, y) => {
    pointerNdc.set((x / innerWidth) * 2 - 1, -(y / innerHeight) * 2 + 1);
    raycaster.setFromCamera(pointerNdc, camera);
    const hits = raycaster.intersectObjects([world.floor, ...world.pickSeats], false);
    return hits[0] || null;
  };

  canvas.addEventListener('pointerdown', (e) => {
    canvas.setPointerCapture(e.pointerId);
    closePopovers();
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY, sx: e.clientX, sy: e.clientY });
    dragged = false;
    if (pointers.size === 2) {
      const [a, b] = [...pointers.values()];
      pinch = Math.hypot(a.x - b.x, a.y - b.y);
    }
  });

  canvas.addEventListener('pointermove', (e) => {
    const state = pointers.get(e.pointerId);
    if (!state) {
      updateHover(e.clientX, e.clientY, pick);
      return;
    }
    if (pointers.size === 2) {
      state.x = e.clientX;
      state.y = e.clientY;
      const [a, b] = [...pointers.values()];
      const distance = Math.hypot(a.x - b.x, a.y - b.y);
      if (pinch) view.targetDist = clamp(view.targetDist * (pinch / distance), 1.7, 8.5);
      pinch = distance;
      dragged = true;
      return;
    }
    const dx = e.clientX - state.x;
    const dy = e.clientY - state.y;
    state.x = e.clientX;
    state.y = e.clientY;
    if (Math.hypot(e.clientX - state.sx, e.clientY - state.sy) > 5) dragged = true;
    if (dragged) {
      view.yaw -= dx * 0.0052;
      view.pitch = clamp(view.pitch + dy * 0.004, -0.12, 1.2);
      $('hint').classList.add('gone');
    }
  });

  const release = (e) => {
    const state = pointers.get(e.pointerId);
    pointers.delete(e.pointerId);
    if (state && !dragged && pointers.size === 0) handleClick(pick(e.clientX, e.clientY));
  };
  canvas.addEventListener('pointerup', release);
  canvas.addEventListener('pointercancel', (e) => pointers.delete(e.pointerId));
  canvas.addEventListener('pointerleave', () => { $('hover-tip').hidden = true; });
  canvas.addEventListener('wheel', (e) => {
    e.preventDefault();
    view.targetDist = clamp(view.targetDist * Math.exp(e.deltaY * 0.0011), 1.7, 8.5);
  }, { passive: false });

  addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      closePopovers();
      closePanels();
      return;
    }
    keys.add(e.code);
  });
  addEventListener('keyup', (e) => keys.delete(e.code));
  addEventListener('blur', () => keys.clear());
}

function updateHover(x, y, pick) {
  const hit = pick(x, y);
  const tip = $('hover-tip');
  const text = hit?.object.userData.seat !== undefined ? '여기 앉기' : '';
  tip.hidden = !text;
  $('scene').style.cursor = hit ? 'pointer' : 'grab';
  if (text) {
    tip.textContent = text;
    tip.style.transform = `translate(${x + 14}px, ${y + 14}px)`;
  }
}

function handleClick(hit) {
  if (!hit) return;
  $('hint').classList.add('gone');
  const seat = hit.object.userData.seat;
  if (seat !== undefined) {
    const occupied = [...actors.values(), ...npcs].some((a) => a.seat === seat || a.pendingSeat === seat);
    if (occupied) {
      toast('다른 친구가 앉은 자리예요');
      return;
    }
    if (player.seat === seat) return;
    player.goToSeat(seat);
    showRing(world.seats[seat].standX, world.seats[seat].standZ);
    return;
  }
  player.walkTo(hit.point.x, hit.point.z);
  showRing(hit.point.x, hit.point.z);
}

function showRing(x, z) {
  clickRing.position.x = x;
  clickRing.position.z = z;
  clickRing.material.opacity = 0.95;
  clickRing.scale.setScalar(0.7);
}

function updateKeyboard(dt) {
  let forward = 0;
  let strafe = 0;
  if (keys.has('KeyW') || keys.has('ArrowUp')) forward += 1;
  if (keys.has('KeyS') || keys.has('ArrowDown')) forward -= 1;
  if (keys.has('KeyA') || keys.has('ArrowLeft')) strafe -= 1;
  if (keys.has('KeyD') || keys.has('ArrowRight')) strafe += 1;
  if (!forward && !strafe) return;

  if (player.seat >= 0 || player.pendingSeat >= 0) {
    const stand = player.leaveSeat();
    if (stand) { player.x = stand.x; player.z = stand.z; }
    player.pendingSeat = -1;
    player.onArrive = null;
  }
  player.path = [];
  const dirX = -Math.sin(view.yaw) * forward + Math.cos(view.yaw) * strafe;
  const dirZ = -Math.cos(view.yaw) * forward - Math.sin(view.yaw) * strafe;
  const len = Math.hypot(dirX, dirZ);
  const step = WALK_SPEED * dt;
  const nx = player.x + (dirX / len) * step;
  const nz = player.z + (dirZ / len) * step;
  if (nav.isFree(nx, nz)) { player.x = nx; player.z = nz; }
  else if (nav.isFree(nx, player.z)) player.x = nx;
  else if (nav.isFree(player.x, nz)) player.z = nz;
  player.tr = Math.atan2(dirX, dirZ);
  player.keyMoving = true;
}

// ---------- UI ----------

function toast(text) {
  const el = $('toast');
  el.textContent = text;
  el.hidden = false;
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => { el.hidden = true; }, 3000);
}

function closePopovers() {
  for (const id of ['room-dialog', 'say-menu']) $(id).hidden = true;
  $('btn-room').setAttribute('aria-expanded', false);
}

function closePanels() {
  $('panel-look').hidden = true;
  $('panel-settings').hidden = true;
}

function saveLook() {
  store.set('look', look);
  store.set('nick', nick);
  player.avatar.setLook(look);
  player.nick = nick;
  player.renderPlate();
  board.drawBase(nickName(nick));
  $('look-chip').style.background = hex(LOOKS.shirt[look.shirt]);
  $('nick-text').textContent = nickName(nick);
  net?.send({ t: 'look', look, nick });
}

function renderLookOptions() {
  const hairs = HAIR_BY_GENDER.find((list) => list.includes(look.hair));
  $('opt-hair').replaceChildren(...hairs.map((i) => {
    const button = document.createElement('button');
    button.className = 'chip';
    button.textContent = LOOKS.hair[i];
    button.setAttribute('aria-pressed', look.hair === i);
    button.onclick = () => { look.hair = i; saveLook(); renderLookOptions(); };
    return button;
  }));
  const labels = { hairColor: '머리 색', skin: '피부', shirt: '옷', bag: '가방' };
  for (const key of Object.keys(labels)) {
    $(`opt-${key}`).replaceChildren(...LOOKS[key].map((color, i) => {
      const button = document.createElement('button');
      button.className = 'swatch';
      button.style.background = hex(color);
      button.setAttribute('aria-label', `${labels[key]} ${i + 1}`);
      button.setAttribute('aria-pressed', look[key] === i);
      button.onclick = () => { look[key] = i; saveLook(); renderLookOptions(); };
      return button;
    }));
  }
  $('opt-hat').checked = !!look.hat;
}

function togglePanel(id) {
  const panel = $(id);
  const open = panel.hidden;
  closePanels();
  closePopovers();
  panel.hidden = !open;
}

function renderSayMenu() {
  const title = document.createElement('p');
  title.className = 'say-title';
  title.textContent = period.kind === 'class' ? '수업 시간에 할 말' : '쉬는 시간에 할 말';
  const buttons = phrasesFor(period.kind).map(({ text, index }) => {
    const button = document.createElement('button');
    button.textContent = text;
    button.onclick = () => {
      player.say(text);
      sound.pop();
      net.send({ t: 'say', i: index });
      closePopovers();
    };
    return button;
  });
  $('say-menu').replaceChildren(title, ...buttons);
}

function setPeriodLabel() {
  $('period').textContent = period.label;
}

function checkPeriod() {
  const next = currentPeriod(Date.now(), periodSpeed);
  const changed = next.key !== period.key;
  period = next;
  setPeriodLabel();
  if (!changed) return;
  renderSayMenu();
  sound.chime();
  toast(period.kind === 'class' ? '수업 시작이에요' : '쉬는 시간이에요');
  for (const npc of npcs) npc.timer = Math.random() * 3;
}

async function loadRoomList() {
  const list = (await fetchRooms()).filter((r) => r.kind === room.kind);
  $('room-list').replaceChildren(...list.map((r) => {
    const current = r.id === room.id;
    const full = r.count !== null && r.count >= ROOM_CAPACITY;
    const card = document.createElement('button');
    card.className = 'room-card';
    card.setAttribute('aria-current', current);
    card.disabled = full && !current;
    const name = document.createElement('strong');
    name.textContent = r.name;
    const count = document.createElement('span');
    count.textContent = r.count === null ? '인원 확인 불가' : `${r.count} / ${ROOM_CAPACITY}명${full ? ' · 가득 참' : ''}`;
    card.append(name, count);
    card.onclick = () => {
      if (current) closePopovers();
      else location.search = searchWithRoom(r.id);
    };
    return card;
  }));
}

function setupUi() {
  $('room-name').textContent = room.name;
  $('room-dot').dataset.kind = room.kind;
  document.title = `${room.name} · 우리 교실`;
  setPeriodLabel();
  saveLookChip();
  renderLookOptions();

  $('btn-exit').onclick = () => {
    net.close();
    sound.stop();
    renderer.setAnimationLoop(null);
    $('exit-screen').hidden = false;
  };
  $('btn-reenter').onclick = () => location.reload();
  $('btn-to-entry').onclick = () => { location.search = searchWithRoom(null); };

  $('room-dialog-title').textContent = `${ROOM_KINDS[room.kind]} 교실 반 목록`;
  $('room-current').textContent = `현재 · ${room.name}`;
  $('btn-room').onclick = async () => {
    const open = $('room-dialog').hidden;
    closePopovers();
    if (open) {
      closePanels();
      await loadRoomList();
      $('room-dialog').hidden = false;
      $('btn-room').setAttribute('aria-expanded', true);
    }
  };
  $('btn-room-close').onclick = closePopovers;
  $('btn-room-refresh').onclick = async () => {
    const button = $('btn-room-refresh');
    button.disabled = true;
    await loadRoomList();
    button.disabled = false;
  };

  $('btn-look').onclick = () => togglePanel('panel-look');
  $('btn-settings').onclick = () => togglePanel('panel-settings');
  $('btn-nick').onclick = () => {
    const next = randomNick();
    nick[0] = next[0];
    nick[1] = next[1];
    saveLook();
  };
  $('opt-hat').onchange = (e) => { look.hat = e.target.checked ? 1 : 0; saveLook(); };

  const setSound = (on) => {
    sound.setOn(on);
    $('btn-sound').dataset.on = on;
    $('btn-sound').setAttribute('aria-label', on ? '소리 끄기' : '소리 켜기');
  };
  $('btn-sound').onclick = () => setSound(!sound.on);
  $('btn-bell').onclick = () => {
    setSound(true);
    sound.chime();
    toast('딩동댕동 — 수업 종이 울려요');
  };

  $('set-volume').value = settings.volume;
  $('set-volume').oninput = (e) => {
    settings.volume = Number(e.target.value);
    sound.setVolume(settings.volume);
    store.set('settings', settings);
  };
  $('set-shadow').checked = settings.shadows;
  $('set-shadow').onchange = (e) => {
    settings.shadows = e.target.checked;
    store.set('settings', settings);
    renderer.shadowMap.enabled = settings.shadows;
    scene.traverse((o) => { if (o.material) o.material.needsUpdate = true; });
    applyQuality();
  };
  $('set-npc').checked = settings.npc;
  $('set-npc').onchange = (e) => {
    settings.npc = e.target.checked;
    store.set('settings', settings);
    syncNpcCount();
  };

  $('btn-sit').onclick = toggleSit;

  // 축하는 내 화면에서만 한다. 점수와 동작을 서버로 보내지 않는다.
  const study = setupStudy({ sound, onFinish: () => player.avatar.play('clap') });
  $('btn-study').onclick = () => {
    if (player.seat < 0 && player.pendingSeat < 0) sitNearest();
    closePopovers();
    closePanels();
    study.open();
  };

  for (const button of document.querySelectorAll('[data-act]')) {
    button.onclick = () => {
      const action = button.dataset.act;
      player.act(action);
      net.send({ t: 'act', a: action });
    };
  }

  renderSayMenu();
  $('btn-say').onclick = () => {
    const open = $('say-menu').hidden;
    closePopovers();
    $('say-menu').hidden = !open;
  };
}

function saveLookChip() {
  $('look-chip').style.background = hex(LOOKS.shirt[look.shirt]);
  $('nick-text').textContent = nickName(nick);
}

// ---------- 카메라와 라벨 ----------

const tmp = new THREE.Vector3();

function updateCamera(dt) {
  view.dist = damp(view.dist, view.targetDist, 9, dt);
  const lookY = player.avatar.seated ? 0.92 : 1.02;
  view.look.x = damp(view.look.x, player.x, 10, dt);
  view.look.y = damp(view.look.y, lookY, 7, dt);
  view.look.z = damp(view.look.z, player.z, 10, dt);

  const cp = Math.cos(view.pitch);
  tmp.set(
    view.look.x + Math.sin(view.yaw) * cp * view.dist,
    view.look.y + Math.sin(view.pitch) * view.dist,
    view.look.z + Math.cos(view.yaw) * cp * view.dist,
  );
  tmp.x = clamp(tmp.x, -ROOM.halfX + 0.25, ROOM.halfX - 0.25);
  tmp.y = clamp(tmp.y, 0.35, ROOM.height - 0.25);
  tmp.z = clamp(tmp.z, -ROOM.halfZ + 0.25, ROOM.halfZ - 0.25);
  view.pos.x = damp(view.pos.x, tmp.x, 14, dt);
  view.pos.y = damp(view.pos.y, tmp.y, 14, dt);
  view.pos.z = damp(view.pos.z, tmp.z, 14, dt);
  camera.position.copy(view.pos);
  camera.lookAt(view.look.x, view.look.y + 0.25, view.look.z);
}

function updateLabel(actor) {
  const seated = actor.avatar.seated;
  tmp.set(actor.x, seated ? 1.42 : 1.5, actor.z).project(camera);
  const visible = tmp.z < 1 && Math.abs(tmp.x) < 1.15 && Math.abs(tmp.y) < 1.15;
  actor.label.style.display = visible ? '' : 'none';
  if (!visible) return;
  const distance = camera.position.distanceTo(actor.avatar.root.position);
  const scale = clamp(3.4 / distance, 0.62, 1);
  actor.label.style.opacity = actor === player ? 1 : clamp(1.4 - distance / 16, 0.55, 1);
  const px = (tmp.x * 0.5 + 0.5) * innerWidth;
  const py = (-tmp.y * 0.5 + 0.5) * innerHeight;
  actor.label.style.transform = `translate(${px}px, ${py}px) translate(-50%, -100%) scale(${scale})`;
}

// ---------- 루프 ----------

const clock = new THREE.Clock();
let periodClock = 0;

function frame() {
  const dt = Math.min(clock.getDelta(), 0.05);
  const time = clock.elapsedTime;

  updateKeyboard(dt);
  player.update(dt);
  updateSitButton();
  for (const actor of actors.values()) actor.update(dt);
  updateNpcs(dt);
  for (const npc of npcs) npc.update(dt);
  updatePlanes(dt);
  world.update(dt, time);

  if (clickRing.material.opacity > 0) {
    clickRing.material.opacity = Math.max(0, clickRing.material.opacity - dt * 1.4);
    clickRing.scale.setScalar(clickRing.scale.x + dt * 0.8);
  }

  updateCamera(dt);
  renderer.render(scene, camera);

  updateLabel(player);
  for (const actor of actors.values()) updateLabel(actor);
  for (const npc of npcs) updateLabel(npc);
  sendPosition(dt);

  periodClock += dt;
  if (periodClock > 1) {
    periodClock = 0;
    checkPeriod();
  }
}

boot();

// 동작 확인용 입구
window.__classroom = {
  get player() { return player; },
  get camera() { return camera; },
  get view() { return view; },
  get npcs() { return npcs; },
  get actors() { return actors; },
  get board() { return board; },
  get world() { return world; },
  get net() { return net; },
};
