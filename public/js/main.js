import * as THREE from 'three';
import { Avatar } from './avatar.js';
import { Board } from './board.js';
import { setupClassQuiz } from './classquiz.js';
import { HAIR_BY_GENDER, LANGS, LOOKS, MENU_TITLES, PHRASES, SIT_ALERT, cleanLang, phraseText, quizText, ROOM_CAPACITY, ROOM_CODE_LENGTH, nickName, parseRoomCode, phrasesFor, randomHair, randomLook, randomNick } from './data.js';
import { applyI18n, uiText } from './i18n.js';
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
let roomCode = parseRoomCode(params.get('room'));

const look = store.get('look', null) || randomLook();
const nick = store.get('nick', null) || randomNick();
store.set('look', look);
store.set('nick', nick);
let lang = cleanLang(store.get('lang', 'ko'));
// 진짜 이름은 이 탭에서만 기억한다. 학교 공용 기기에서 다음 학생에게 남지 않게 한다.
const nameStore = {
  get() { try { return sessionStorage.getItem('classroom.name') ?? ''; } catch { return ''; } },
  set(value) { try { sessionStorage.setItem('classroom.name', value); } catch { /* 저장 못 해도 된다 */ } },
};
let realName = nameStore.get();
const t = (key, ...args) => uiText(key, lang, ...args);
const settings = { volume: 0.7, shadows: true, ...store.get('settings', {}) };

const sound = new Sound();
sound.volume = settings.volume;

let renderer, scene, camera, world, nav, board;
let player;
const actors = new Map();
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
let isTeacher = false;
let focus = false;
let classQuiz;
let study;

class Actor {
  constructor({ id, lookValue, nickValue, kind, teacher = false, realName = '' }) {
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
    this.teacher = teacher;
    this.realName = realName;
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
    const badge = { me: t('me') }[this.kind];
    this.plate.className = `nameplate ${badge ? '' : 'plain'} ${this.teacher ? 'teacher' : ''}`;
    this.plate.textContent = '';
    if (badge) {
      const mark = document.createElement('span');
      mark.className = 'badge';
      mark.textContent = badge;
      this.plate.append(mark);
    }
    // 진짜 이름은 선생님 화면에만 온다. 친구들 화면에는 동물 이름만 보인다.
    this.plate.append(this.teacher ? t('teacherName') : this.realName ? `${this.realName} (${nickName(this.nick)})` : nickName(this.nick));
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
      let budget = WALK_SPEED * dt;
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

// 주소의 다른 값(demo 등)은 그대로 두고 방 코드만 바꾼 주소를 만든다.
function searchWithRoom(code) {
  const next = new URLSearchParams(location.search);
  if (code) next.set('room', code);
  else next.delete('room');
  return '?' + next;
}

// 방 코드가 열려 있는 교실인지 서버에 묻는다. 서버에 닿지 않으면(정적 호스팅 등) 혼자 모드로 들어간다.
async function lookupRoom(code) {
  try {
    const response = await fetch('/api/room?code=' + code);
    if (response.status === 404) return 'none';
    if (response.status === 429) return 'busy';
    if (!response.ok) return 'offline';
    return (await response.json()).full ? 'full' : 'ok';
  } catch { return 'offline'; }
}

// 말풍선 언어를 고른다. 내가 보는 말풍선만 바뀌고, 다른 친구에게는 영향이 없다.
function fillLangSelect(select, onChange) {
  select.replaceChildren(...LANGS.map((l) => new Option(l.label, l.code)));
  select.value = lang;
  select.onchange = () => {
    lang = cleanLang(select.value);
    store.set('lang', lang);
    for (const id of ['entry-lang', 'set-lang']) $(id).value = lang;
    onChange?.();
  };
}

// 선생님이 새 교실을 연다. 코드는 서버가 정해 준다.
async function createRoom() {
  try {
    const response = await fetch('/api/create', { method: 'POST' });
    if (response.ok) return await response.json();
    return { errorKey: 'err_create' };
  } catch { return { errorKey: 'err_offline' }; }
}


// 방 코드와 QR 코드를 보여 준다. 칠판 앞 TV에 띄워 두면 학생들이 코드를 입력하거나 태블릿으로 찍어 들어온다.
function setupQr() {
  const url = location.origin + '/?room=' + roomCode;
  $('btn-room').onclick = () => {
    const qr = window.qrcode(0, 'M');
    qr.addData(url);
    qr.make();
    $('qr-code').innerHTML = qr.createSvgTag({ cellSize: 4, margin: 0, scalable: true });
    $('qr-code-text').textContent = roomCode;
    $('qr-url').textContent = url;
    closePanels();
    $('qr-dialog').hidden = false;
  };
  $('btn-qr-close').onclick = () => { $('qr-dialog').hidden = true; };
  $('qr-dialog').onclick = (e) => { if (e.target === $('qr-dialog')) $('qr-dialog').hidden = true; };
}

// 화면의 글자를 고른 언어로 모두 바꾼다. 교실에 들어가기 전에는 첫 화면만 바뀐다.
function applyLang() {
  applyI18n(document, lang);
  document.documentElement.lang = lang;
  if (!player || !classQuiz) return;
  player.renderPlate();
  for (const actor of actors.values()) actor.renderPlate();
  renderLookOptions();
  renderSayMenu();
  classQuiz.render();
  study.refresh();
  setPeriodLabel();
  renderSoundLabel();
  renderStats();
  document.title = roomCode + ' · ' + t('brand');
  $('btn-room').title = t('codeAria');
}

function renderSoundLabel() {
  $('btn-sound').setAttribute('aria-label', t(sound.on ? 'soundOff' : 'soundOn'));
}

function showEntry(noticeKey = '') {
  return new Promise((resolve) => {
    let gender = store.get('gender', null);
    const input = $('entry-code');
    const error = $('entry-error');
    const genderCards = [...document.querySelectorAll('[data-gender]')];
    input.value = roomCode ?? '';
    const nameInput = $('entry-name');
    nameInput.value = realName;
    fillLangSelect($('entry-lang'), () => { applyLang(); showError(errorKey); });
    applyLang();

    // 오류는 글 대신 키를 기억해 두고, 언어를 바꾸면 다시 번역해 보여 준다.
    let errorKey = '';
    function showError(key) {
      errorKey = key;
      error.textContent = key ? uiText(key, lang) : '';
      error.hidden = !key;
    }
    const refresh = () => {
      genderCards.forEach((c) => c.setAttribute('aria-pressed', Number(c.dataset.gender) === gender));
      $('btn-enter').disabled = gender === null || !nameInput.value.trim() || input.value.length !== ROOM_CODE_LENGTH;
      $('btn-create').disabled = gender === null;
    };
    const finish = (code, token) => {
      realName = nameInput.value.trim().slice(0, 10);
      nameStore.set(realName);
      if (token) store.set(`host.${code}`, token);
      store.set('gender', gender);
      if (!HAIR_BY_GENDER[gender].includes(look.hair)) {
        look.hair = randomHair(gender);
        store.set('look', look);
      }
      roomCode = code;
      history.replaceState(null, '', searchWithRoom(code));
      $('entry').hidden = true;
      resolve();
    };

    genderCards.forEach((c) => { c.onclick = () => { gender = Number(c.dataset.gender); refresh(); }; });
    nameInput.oninput = () => { showError(''); refresh(); };
    input.oninput = () => {
      input.value = input.value.replace(/\D/g, '').slice(0, ROOM_CODE_LENGTH);
      showError('');
      refresh();
    };
    input.onkeydown = (e) => {
      if (e.key === 'Enter' && !$('btn-enter').disabled) $('btn-enter').click();
    };

    $('btn-enter').onclick = async () => {
      $('btn-enter').disabled = true;
      $('btn-create').disabled = true;
      const code = parseRoomCode(input.value);
      const status = await lookupRoom(code);
      if (status === 'ok' || status === 'offline') {
        finish(code);
        return;
      }
      showError('err_' + status);
      refresh();
    };

    $('btn-create').onclick = async () => {
      $('btn-enter').disabled = true;
      $('btn-create').disabled = true;
      const result = await createRoom();
      if (result.code) {
        finish(result.code, result.token);
        return;
      }
      showError(result.errorKey);
      refresh();
    };

    showError(noticeKey);
    refresh();
    $('entry').hidden = false;
  });
}

async function boot() {
  applyLang();
  // QR이나 링크로 방 코드가 같이 왔고 모습도 이미 골랐다면 바로 들어간다. 아니면 입구부터 거친다.
  let notice = '';
  let ready = false;
  if (roomCode && store.get('gender', null) !== null && (realName || store.get(`host.${roomCode}`, null))) {
    const status = await lookupRoom(roomCode);
    ready = status === 'ok' || status === 'offline';
    if (!ready) notice = 'err_' + status;
  }
  if (!ready) await showEntry(notice);
  try {
    renderer = new THREE.WebGLRenderer({ canvas: $('scene'), antialias: true, powerPreference: 'high-performance' });
  } catch {
    $('loader-text').textContent = t('noWebgl');
    $('loader-text').removeAttribute('data-i18n');
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
  world = buildWorld(scene, board, roomCode, 'day');
  renderer.toneMappingExposure = world.exposure;
  nav = new Nav(world.obstacles, BOUNDS);

  clickRing = new THREE.Mesh(
    new THREE.RingGeometry(0.17, 0.23, 32),
    new THREE.MeshBasicMaterial({ color: 0xfff6d8, transparent: true, opacity: 0, depthWrite: false }),
  );
  clickRing.rotation.x = -Math.PI / 2;
  clickRing.position.y = 0.012;
  scene.add(clickRing);

  player = new Actor({ id: 'me', lookValue: look, nickValue: nick, kind: 'me' });
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
  connect();
  resize();
  addEventListener('resize', resize);

  renderer.setAnimationLoop(frame);
  setTimeout(() => {
    $('loader').classList.add('fade');
    setTimeout(() => {
      $('loader').hidden = true;
      toast(t('joined', roomCode));
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
  const actor = new Actor({ id: info.id, lookValue: info.look, nickValue: info.nick, kind: 'real', teacher: !!info.teacher, realName: info.name ?? '' });
  actor.x = info.x;
  actor.z = info.z;
  actor.r = info.r;
  actor.net = { x: info.x, z: info.z, r: info.r };
  applySeat(actor, info.s);
  actors.set(info.id, actor);
  realOthers = actors.size;
  setCount();
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
  net = new Net(roomCode, {
    welcome(msg) {
      isTeacher = !!msg.teacher;
      setFocus(!!msg.focus);
      setGauge(msg.gauge);
      player.teacher = isTeacher;
      player.renderPlate();
      $('teacher-bar').hidden = !isTeacher;
      $('btn-study').hidden = isTeacher;
      if (msg.quiz) classQuiz.start(msg.quiz);
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
    },
    pos(msg) {
      const actor = actors.get(msg.id);
      if (!actor) return;
      actor.net = { x: msg.x, z: msg.z, r: msg.r };
      applySeat(actor, msg.s);
    },
    act: (msg) => actors.get(msg.id)?.act(msg.a),
    say(msg) {
      actors.get(msg.id)?.say(phraseText(msg.i, lang));
      sound.pop();
    },
    look(msg) {
      const actor = actors.get(msg.id);
      if (!actor) return;
      actor.avatar.setLook(msg.look);
      actor.nick = msg.nick;
      actor.renderPlate();
    },
    sit: (msg) => forceSit(msg.seat),
    focus(msg) {
      setFocus(msg.on);
      if (!isTeacher) toast(t(msg.on ? 'noPlane' : 'planeOk'));
    },
    gauge: (msg) => setGauge(msg),
    gaugeFull() {
      celebrate();
      sound.fanfare();
      toast(t('gaugeFull'));
    },
    progress(msg) {
      progressData = msg;
      renderProgress();
    },
    noname() {
      net.full = true;
      toast(t('nonameToast'));
      setTimeout(() => { location.search = searchWithRoom(null); }, 2000);
    },
    quiz(msg) {
      classQuiz.start(msg.qs);
      toast(quizText('title', lang));
    },
    quizEnd() {
      classQuiz.end();
      toast(t('quizEndToast'));
    },
    result: (msg) => classQuiz.result(msg),
    quizSent: (msg) => toast(`학생 ${msg.count}명에게 문제를 보냈어요`),
    full() {
      net.full = true;
      toast(t('err_full'));
    },
    // 오래 비어 닫혔거나 서버가 다시 시작된 경우다. 처음 화면에서 코드를 다시 입력하게 한다.
    closed() {
      net.full = true;
      toast(t('closedToast'));
      setTimeout(() => { location.search = searchWithRoom(null); }, 2500);
    },
    lost() {
      clearRemotes();
      setCount();
    },
  });
  net.connect(() => ({ look, nick, name: realName, token: store.get(`host.${roomCode}`, undefined) }));
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

// ---------- 선생님 기능 ----------

let progressData = null;

// 선생님이 앉히거나 문제를 내면 학생은 종이비행기를 날릴 수 없다. 선생님은 늘 날릴 수 있다.
function setFocus(on) {
  focus = on;
  const button = document.querySelector('[data-act="throw"]');
  button.disabled = on && !isTeacher;
  button.title = button.disabled ? t('planeLocked') : '';
}

const LEVELS = ['high', 'mid', 'low'];
const LEVEL_NAMES = { high: '상', mid: '중', low: '하' };

// 학생 현황 표: 이름, 수준(선생님이 고른다), 문제별 맞고 틀림, 맞힌 개수.
function renderProgress() {
  const rows = progressData?.rows ?? [];
  $('result-empty').hidden = rows.length > 0;
  $('result-rows').replaceChildren(...rows.map((row) => {
    const line = document.createElement('div');
    line.className = 'result-row';
    if (!row.here) line.classList.add('away');

    const name = document.createElement('strong');
    name.textContent = row.name + (row.here ? '' : ' (나감)');

    const levels = document.createElement('span');
    levels.className = 'levels';
    for (const level of LEVELS) {
      const button = document.createElement('button');
      button.textContent = LEVEL_NAMES[level];
      button.setAttribute('aria-pressed', row.level === level);
      button.setAttribute('aria-label', row.name + ' ' + LEVEL_NAMES[level] + ' 수준');
      button.onclick = () => net.send({ t: 'level', name: row.name, level });
      levels.append(button);
    }
    if (row.next) {
      const note = document.createElement('em');
      note.textContent = '다음 세트부터';
      levels.append(note);
    }

    const marks = document.createElement('span');
    marks.className = 'marks';
    for (const c of row.marks) {
      const dot = document.createElement('i');
      dot.className = c === 'o' ? 'right' : c === 'x' ? 'wrong' : 'none';
      dot.textContent = c === 'o' ? 'O' : c === 'x' ? 'X' : '·';
      marks.append(dot);
    }

    const score = document.createElement('span');
    score.className = 'score';
    if (row.marks) score.textContent = [...row.marks].filter((c) => c === 'o').length + '/' + row.marks.length;
    line.append(name, levels, marks, score);
    return line;
  }));
}

// 협동 게이지. 모두가 보고, 선생님이 정한 목표까지 학생들이 함께 채운다.
function setGauge(gauge) {
  $('gauge').hidden = !gauge;
  if (!gauge) return;
  const value = Math.min(gauge.value, gauge.goal);
  $('gauge-fill').style.width = (gauge.goal ? (value / gauge.goal) * 100 : 0) + '%';
  $('gauge-text').textContent = Math.floor(value) + ' / ' + gauge.goal;
}

function celebrate() {
  const box = $('confetti');
  const colors = ['#f7dd72', '#f2a3b3', '#9fd0ef', '#a8dcb5', '#f2994a'];
  box.replaceChildren(...Array.from({ length: 60 }, (_, i) => {
    const piece = document.createElement('i');
    piece.style.left = Math.random() * 100 + '%';
    piece.style.background = colors[i % colors.length];
    piece.style.animationDelay = Math.random() * 0.5 + 's';
    piece.style.animationDuration = 1.5 + Math.random() * 1.1 + 's';
    return piece;
  }));
  setTimeout(() => box.replaceChildren(), 3200);
}

// 선생님이 모두 앉히기를 눌렀다. 서버가 정해 준 자리로 걸어가 앉는다.
function forceSit(seat) {
  $('sit-alert-ko').textContent = SIT_ALERT.ko;
  $('sit-alert-tr').textContent = lang === 'ko' ? '' : SIT_ALERT[lang];
  $('sit-alert').hidden = false;
  clearTimeout(forceSit.timer);
  forceSit.timer = setTimeout(() => { $('sit-alert').hidden = true; }, 3200);
  sound.chime();
  if (player.seat >= 0) return;
  if (seat < 0) {
    toast(t('noSeat'));
    return;
  }
  player.goToSeat(seat);
  showRing(world.seats[seat].standX, world.seats[seat].standZ);
}

const QUIZ_LIMIT = 15;

function setupTeacher() {
  let draft = store.get('quizDraft2', null);
  if (!draft || typeof draft !== 'object') {
    const old = store.get('quizDraft', null);
    draft = { goal: 50, mid: Array.isArray(old) ? old : [] };
  }
  for (const level of LEVELS) if (!Array.isArray(draft[level])) draft[level] = [];
  if (!Number.isInteger(draft.goal) || draft.goal < 1 || draft.goal > 100) draft.goal = 50;
  let tab = 'mid';
  const save = () => store.set('quizDraft2', draft);

  const renderTabs = () => {
    for (const button of document.querySelectorAll('[data-level-tab]')) {
      button.setAttribute('aria-pressed', button.dataset.levelTab === tab);
      const count = draft[button.dataset.levelTab].filter((r) => r.q.trim() || r.a.trim()).length;
      button.textContent = LEVEL_NAMES[button.dataset.levelTab] + (count ? ' ' + count : '');
    }
    $('btn-copy-mid').hidden = tab === 'mid';
  };

  const renderRows = () => {
    const rows = draft[tab];
    if (!rows.length) rows.push({ q: '', a: '' });
    renderTabs();
    $('teacher-rows').replaceChildren(...rows.map((row, i) => {
      const box = document.createElement('div');
      box.className = 'teacher-row';
      const q = document.createElement('input');
      q.placeholder = (i + 1) + '번 문제';
      q.maxLength = 80;
      q.value = row.q;
      q.oninput = () => { row.q = q.value; save(); renderTabs(); };
      const a = document.createElement('input');
      a.placeholder = '정답';
      a.maxLength = 20;
      a.value = row.a;
      a.oninput = () => { row.a = a.value; save(); renderTabs(); };
      const del = document.createElement('button');
      del.className = 'row-del';
      del.textContent = '×';
      del.setAttribute('aria-label', (i + 1) + '번 문제 지우기');
      del.onclick = () => {
        rows.splice(i, 1);
        save();
        renderRows();
      };
      box.append(q, a, del);
      return box;
    }));
    $('btn-row-add').hidden = rows.length >= QUIZ_LIMIT;
  };

  const readGoal = () => {
    const goal = Number($('teacher-goal').value);
    if (!Number.isInteger(goal) || goal < 1 || goal > 100) {
      toast('목표 게이지는 1~100 사이 숫자로 적어 주세요');
      return null;
    }
    draft.goal = goal;
    save();
    return goal;
  };

  for (const button of document.querySelectorAll('[data-level-tab]')) {
    button.onclick = () => { tab = button.dataset.levelTab; renderRows(); };
  }
  $('btn-copy-mid').onclick = () => {
    draft[tab] = draft.mid.map((r) => ({ q: r.q, a: r.a }));
    save();
    renderRows();
  };

  $('btn-sit-all').onclick = () => {
    net.send({ t: 'sitAll' });
    toast('학생들을 자리에 앉혔어요');
  };
  $('btn-teach').onclick = () => {
    closePopovers();
    closePanels();
    $('teacher-goal').value = draft.goal;
    renderRows();
    $('teacher-dialog').hidden = false;
  };
  $('teacher-close').onclick = () => { $('teacher-dialog').hidden = true; };
  $('btn-row-add').onclick = () => {
    draft[tab].push({ q: '', a: '' });
    save();
    renderRows();
    $('teacher-rows').lastElementChild.querySelector('input').focus();
  };
  $('btn-gauge-reset').onclick = () => {
    const goal = readGoal();
    if (goal) {
      net.send({ t: 'gaugeSet', goal, reset: true });
      toast('협동 게이지를 처음부터 시작해요');
    }
  };
  $('btn-quiz-send').onclick = () => {
    const goal = readGoal();
    if (!goal) return;
    const sets = {};
    for (const level of LEVELS) {
      sets[level] = draft[level].map((r) => ({ q: r.q.trim(), a: r.a.trim() })).filter((r) => r.q || r.a);
      if (sets[level].some((r) => !r.q || !r.a)) {
        tab = level;
        renderRows();
        toast(LEVEL_NAMES[level] + ' 단계에 문제나 정답이 빈 줄이 있어요');
        return;
      }
    }
    if (!LEVELS.some((level) => sets[level].length)) {
      toast('문제를 하나 이상 적어 주세요');
      return;
    }
    net.send({ t: 'quiz', sets, goal });
    $('teacher-dialog').hidden = true;
    $('result-dialog').hidden = false;
  };
  const endQuiz = () => {
    net.send({ t: 'quizEnd' });
    toast('문제를 끝냈어요. 게이지는 그대로 이어져요');
  };
  $('btn-quiz-end').onclick = endQuiz;
  $('btn-result-end').onclick = endQuiz;
  $('btn-results').onclick = () => {
    renderProgress();
    $('result-dialog').hidden = !$('result-dialog').hidden;
  };
  $('result-close').onclick = () => { $('result-dialog').hidden = true; };
  $('btn-free').onclick = () => {
    net.send({ t: 'free' });
    toast('학생들이 다시 자유롭게 움직일 수 있어요');
  };
}

// ---------- 자리 ----------

function freeSeats() {
  const taken = new Set();
  for (const actor of [player, ...actors.values()]) {
    if (actor.seat >= 0) taken.add(actor.seat);
    if (actor.pendingSeat >= 0) taken.add(actor.pendingSeat);
  }
  return world.seats.filter((seat) => !taken.has(seat.index));
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
    toast(t('noSeat'));
    return;
  }
  player.goToSeat(nearest.index);
  showRing(nearest.standX, nearest.standZ);
}

function jump() {
  if (player.seat >= 0) {
    toast(t('jumpStand'));
    return;
  }
  if (player.avatar.airborne) return;
  player.act('jump');
  sound.hop();
  net.send({ t: 'act', a: 'jump' });
}

function updateSitButton() {
  const text = player.seat >= 0 || player.pendingSeat >= 0 ? t('stand') : t('sit');
  const label = $('sit-text');
  if (label.textContent !== text) label.textContent = text;
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
    if (e.code === 'Space' && canJumpFromKey(e.target)) {
      // 방금 누른 메뉴 버튼이 다시 눌리지 않게 막는다.
      e.preventDefault();
      if (!e.repeat) jump();
      return;
    }
    if (e.target.matches?.('input, textarea, select')) return;
    keys.add(e.code);
  });
  addEventListener('keyup', (e) => keys.delete(e.code));
  addEventListener('blur', () => keys.clear());
}

// 공부 창이나 설정 창을 쓰는 중에는 스페이스가 그 창의 버튼과 입력에 쓰이게 둔다.
function canJumpFromKey(target) {
  if (!$('study-dialog').hidden) return false;
  if (target.closest?.('#dock')) return true;
  return target === document.body || target === $('scene');
}

function updateHover(x, y, pick) {
  const hit = pick(x, y);
  const tip = $('hover-tip');
  const text = hit?.object.userData.seat !== undefined ? t('sitHere') : '';
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
    const occupied = [...actors.values()].some((a) => a.seat === seat || a.pendingSeat === seat);
    if (occupied) {
      toast(t('seatTaken'));
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
  for (const id of ['qr-dialog', 'say-menu']) $(id).hidden = true;
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
    button.textContent = t('hair' + i);
    button.setAttribute('aria-pressed', look.hair === i);
    button.onclick = () => { look.hair = i; saveLook(); renderLookOptions(); };
    return button;
  }));
  const labels = { hairColor: t('hairColor'), skin: t('skin'), shirt: t('shirt'), bag: t('bag') };
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
  title.textContent = MENU_TITLES[period.kind === 'class' ? 'class' : 'break'][lang];
  const buttons = phrasesFor(period.kind).map(({ text, index }) => {
    const button = document.createElement('button');
    button.append(phraseText(index, lang));
    if (lang !== 'ko') {
      const ko = document.createElement('span');
      ko.className = 'ko';
      ko.textContent = text;
      button.append(ko);
    }
    button.onclick = () => {
      player.say(phraseText(index, lang));
      sound.pop();
      net.send({ t: 'say', i: index });
      closePopovers();
    };
    return button;
  });
  $('say-menu').replaceChildren(title, ...buttons);
}

// 오늘과 전체 이용자 수. 못 가져오면 표시만 숨기고 교실은 그대로 쓴다.
let siteStats = null;

function renderStats() {
  $('site-stats').hidden = !siteStats;
  if (siteStats) $('site-stats').textContent = t('stats', siteStats.daily, siteStats.total);
}

async function loadSiteStats() {
  const base = 'https://minfp-online-classroom.goatcounter.com/counter/TOTAL.json';
  const today = new Date(Date.now() + 9 * 3600 * 1000).toISOString().slice(0, 10);
  const read = async (url) => {
    const response = await fetch(url);
    if (!response.ok) throw new Error(String(response.status));
    return (await response.json()).count;
  };
  try {
    const [daily, total] = await Promise.all([read(`${base}?start=${today}`), read(base)]);
    siteStats = { daily, total };
    renderStats();
  } catch {
    siteStats = null;
    renderStats();
  }
}

function setPeriodLabel() {
  $('period').textContent = t(period.kind === 'class' ? 'periodClass' : 'periodBreak') + ' · ' + t('left', period.remaining, period.unit);
}

function checkPeriod() {
  const next = currentPeriod(Date.now(), periodSpeed);
  const changed = next.key !== period.key;
  period = next;
  setPeriodLabel();
  if (!changed) return;
  renderSayMenu();
  sound.chime();
  toast(t(period.kind === 'class' ? 'classStart' : 'breakStart'));
}

function setupUi() {
  $('room-name').textContent = roomCode;
  loadSiteStats();
  setInterval(loadSiteStats, 10 * 60 * 1000);
  document.title = roomCode + ' · ' + t('brand');
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

  setupQr();

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
    renderSoundLabel();
  };
  $('btn-sound').onclick = () => setSound(!sound.on);
  $('btn-bell').onclick = () => {
    setSound(true);
    sound.chime();
    toast(t('bellToast'));
  };

  fillLangSelect($('set-lang'), applyLang);
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
  classQuiz = setupClassQuiz({
    sound,
    getLang: () => lang,
    send: (message) => net.send(message),
    onFinish: () => player.avatar.play('clap'),
  });
  setupTeacher();

  $('btn-sit').onclick = toggleSit;
  $('btn-jump').onclick = jump;

  // 축하는 내 화면에서만 한다. 점수와 동작을 서버로 보내지 않는다.
  study = setupStudy({ sound, getLang: () => lang, onFinish: () => player.avatar.play('clap') });
  $('btn-study').onclick = () => {
    if (player.seat < 0 && player.pendingSeat < 0) sitNearest();
    closePopovers();
    closePanels();
    study.open();
  };

  for (const button of document.querySelectorAll('[data-act]')) {
    button.onclick = () => {
      const action = button.dataset.act;
      if (action === 'throw' && focus && !isTeacher) {
        toast(t('noPlane'));
        return;
      }
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
  const jumpLift = actor.avatar.airborne ? actor.avatar.root.position.y : 0;
  tmp.set(actor.x, (seated ? 1.42 : 1.5) + jumpLift, actor.z).project(camera);
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
  get actors() { return actors; },
  get board() { return board; },
  get world() { return world; },
  get net() { return net; },
};
