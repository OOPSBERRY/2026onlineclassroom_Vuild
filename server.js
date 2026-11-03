import { randomBytes } from 'node:crypto';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { WebSocketServer } from 'ws';
import { ROOM_CAPACITY, SEAT_COUNT, PHRASES, cleanLook, cleanNick, parseRoomCode } from './public/js/data.js';

const PORT = Number(process.env.PORT) || 3000;
const PUBLIC_DIR = join(fileURLToPath(new URL('.', import.meta.url)), 'public');
const ACTIONS = new Set(['raise', 'bow', 'clap', 'throw', 'jump']);
const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.woff2': 'font/woff2',
  '.txt': 'text/plain; charset=utf-8',
};
// 선생님이 연 교실은 비어 있어도 이 시간 동안은 남겨 둔다. 그 뒤에는 닫고 코드도 거둔다.
const EMPTY_ROOM_LIFETIME = 3 * 60 * 60 * 1000;
const MAX_ROOMS = 1000;

const rooms = new Map();
let nextId = 1;

function createRoom() {
  if (rooms.size >= MAX_ROOMS) return null;
  let code;
  do code = String(Math.floor(Math.random() * 10000)).padStart(4, '0');
  while (rooms.has(code));
  // hostToken은 교실을 만든 선생님만 갖는다. 이 값을 보내야 교사 기능을 쓸 수 있다.
  const room = { code, hostToken: randomBytes(16).toString('hex'), players: new Map(), emptySince: Date.now(), quiz: null, results: new Map(), focus: false, levels: new Map(), gauge: { goal: 0, value: 0, base: 0, done: false } };
  rooms.set(code, room);
  return room;
}

function sendJson(res, status, body) {
  res.writeHead(status, { 'content-type': MIME['.json'], 'cache-control': 'no-store' });
  res.end(JSON.stringify(body));
}

const server = createServer(async (req, res) => {
  const { pathname, searchParams } = new URL(req.url, 'http://localhost');
  if (pathname === '/api/create') {
    if (req.method !== 'POST') return sendJson(res, 405, { error: 'method' });
    const room = createRoom();
    return room ? sendJson(res, 200, { code: room.code, token: room.hostToken }) : sendJson(res, 503, { error: 'no room' });
  }
  if (pathname === '/api/room') {
    const code = parseRoomCode(searchParams.get('code'));
    const room = code && rooms.get(code);
    return room ? sendJson(res, 200, { code, full: room.players.size >= ROOM_CAPACITY }) : sendJson(res, 404, { error: 'not found' });
  }
  try {
    const relative = normalize(decodeURIComponent(pathname === '/' ? '/index.html' : pathname));
    const filePath = join(PUBLIC_DIR, relative);
    if (!filePath.startsWith(PUBLIC_DIR + sep)) throw new Error('outside public');
    const body = await readFile(filePath);
    res.writeHead(200, { 'content-type': MIME[extname(filePath)] || 'application/octet-stream' });
    res.end(body);
  } catch {
    res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
    res.end('찾을 수 없어요');
  }
});

const wss = new WebSocketServer({ server, path: '/ws', maxPayload: 32 * 1024 });

function broadcast(room, message, except) {
  const text = JSON.stringify(message);
  for (const player of room.players.values()) {
    if (player !== except && player.socket.readyState === player.socket.OPEN) player.socket.send(text);
  }
}

// 학생의 진짜 이름(name)은 선생님에게만 보낸다. 친구들에게는 동물 이름만 보인다.
function publicPlayer(player, forTeacher = false) {
  const info = { id: player.id, teacher: player.teacher, look: player.look, nick: player.nick, x: player.x, z: player.z, r: player.r, s: player.s };
  if (forTeacher && !player.teacher) info.name = player.name;
  return info;
}

// 이름은 글자와 숫자, 띄어쓰기만 남기고 10자까지 쓴다.
function cleanName(name) {
  if (typeof name !== 'string') return '';
  return name.normalize('NFC').replace(/[^\p{L}\p{N} ]/gu, '').replace(/ +/g, ' ').trim().slice(0, 10);
}

function sendTeachers(room, message) {
  for (const p of room.players.values()) if (p.teacher) send(p, message);
}

function setFocus(room, on) {
  if (room.focus === on) return;
  room.focus = on;
  broadcast(room, { t: 'focus', on });
}

// 수준은 상/중/하 세 단계이고 선생님이 학생(이름)별로 정한다. 정하지 않으면 중이다.
const LEVELS = ['high', 'mid', 'low'];
const levelOf = (room, name) => room.levels.get(name) ?? 'mid';

// 그 수준 문제가 비어 있으면 중, 상, 하 순서로 있는 것을 쓴다.
function setFor(room, level) {
  for (const l of [level, 'mid', 'high', 'low']) if (room.quiz.sets[l].length) return room.quiz.sets[l];
  return [];
}

// 이번 문제 세트를 받는 학생의 기록을 만든다. 이미 있으면(다시 들어온 경우) 그대로 쓴다.
function enrollStudent(room, name) {
  if (!room.quiz || room.results.has(name)) return room.results.get(name);
  const level = levelOf(room, name);
  const entry = { level, set: setFor(room, level), answers: new Map() };
  room.results.set(name, entry);
  return entry;
}

function sendGauge(room, target) {
  const { goal, value } = room.gauge;
  const message = { t: 'gauge', goal, value: Math.round(value * 10) / 10 };
  if (target) send(target, message);
  else broadcast(room, message);
}

// 모든 학생이 같은 몫을 채운다. 각 학생이 낸 기여는 '내 문제 중 맞힌 비율'이고, 세트가 채울 수 있는 칸은 게이지의 남은 칸이다.
// 그래서 어느 수준이든 다 맞히면 같은 만큼 채운다. 게이지는 줄어들지 않는다.
function updateGauge(room) {
  const g = room.gauge;
  if (!g.goal || !room.quiz || room.results.size === 0) return;
  let sum = 0;
  for (const entry of room.results.values()) {
    if (!entry.set.length) continue;
    sum += [...entry.answers.values()].filter(Boolean).length / entry.set.length;
  }
  const next = Math.min(g.goal, g.base + (sum * (g.goal - g.base)) / room.results.size);
  if (next <= g.value) return;
  g.value = next;
  sendGauge(room);
  if (g.value >= g.goal && !g.done) {
    g.done = true;
    broadcast(room, { t: 'gaugeFull' });
  }
}

// 선생님에게 학생 명단, 수준, 문제별 맞고 틀림을 보낸다. 한 문제는 처음 낸 답만 점수에 들어간다.
function sendProgress(room) {
  const rows = new Map();
  for (const p of room.players.values()) if (!p.teacher) rows.set(p.name, { name: p.name, here: true });
  for (const name of room.results.keys()) if (!rows.has(name)) rows.set(name, { name, here: false });
  const list = [...rows.values()].map((row) => {
    const level = levelOf(room, row.name);
    const entry = room.results.get(row.name);
    const marks = entry ? entry.set.map((_, i) => (entry.answers.has(i) ? (entry.answers.get(i) ? 'o' : 'x') : '-')).join('') : '';
    return { ...row, level, next: !!entry && entry.level !== level, marks };
  });
  list.sort((a, b) => a.name.localeCompare(b.name, 'ko'));
  sendTeachers(room, { t: 'progress', quiz: !!room.quiz, rows: list });
}

const finite = (value, min, max) => (Number.isFinite(value) ? Math.max(min, Math.min(max, value)) : null);

// 정답 비교: 띄어쓰기, 대소문자, 끝의 마침표는 무시한다.
const normalizeAnswer = (text) => String(text).normalize('NFC').toLowerCase().replace(/[\s ]+/g, '').replace(/[.。]+$/, '');

function send(player, message) {
  if (player.socket.readyState === player.socket.OPEN) player.socket.send(JSON.stringify(message));
}

// 서 있는 학생을 빈 자리에 하나씩 정해 준다. 서버가 정하므로 두 학생이 같은 자리에 앉지 않는다.
function seatEveryone(room) {
  const players = [...room.players.values()];
  const taken = new Set();
  for (const p of players) {
    if (p.s >= 0) taken.add(p.s);
    else if (p.assigned >= 0) taken.add(p.assigned);
  }
  const free = [];
  for (let i = 0; i < SEAT_COUNT; i++) if (!taken.has(i)) free.push(i);
  for (let i = free.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [free[i], free[j]] = [free[j], free[i]];
  }
  for (const p of players) {
    if (p.teacher) continue;
    if (p.s < 0 && p.assigned < 0) p.assigned = free.length ? free.pop() : -1;
    send(p, { t: 'sit', seat: p.s >= 0 ? p.s : p.assigned });
  }
}

// 선생님이 보낸 수준별 문제를 다듬는다. 단계마다 15개까지, 글자 수도 제한한다. 모두 비어 있으면 받지 않는다.
function cleanQuizSets(sets) {
  if (sets === null || typeof sets !== 'object') return null;
  const clean = {};
  for (const level of LEVELS) {
    const items = sets[level] ?? [];
    if (!Array.isArray(items) || items.length > 15) return null;
    clean[level] = [];
    for (const item of items) {
      const q = typeof item?.q === 'string' ? item.q.trim().slice(0, 80) : '';
      const a = typeof item?.a === 'string' ? item.a.trim().slice(0, 20) : '';
      if (!q || !a) return null;
      clean[level].push({ q, a });
    }
  }
  return LEVELS.some((level) => clean[level].length) ? clean : null;
}

const cleanGoal = (goal) => (Number.isInteger(goal) && goal >= 1 && goal <= 100 ? goal : null);

function sendQuizTo(room, player) {
  const entry = enrollStudent(room, player.name);
  send(player, { t: 'quiz', qs: entry.set.map((item) => item.q) });
}

function handle(player, room, msg) {
  switch (msg.t) {
    case 'sitAll':
      if (!player.teacher) break;
      seatEveryone(room);
      setFocus(room, true);
      break;
    case 'free':
      if (player.teacher) setFocus(room, false);
      break;
    case 'quiz': {
      if (!player.teacher) break;
      const sets = cleanQuizSets(msg.sets);
      const goal = cleanGoal(msg.goal);
      if (!sets || !goal) break;
      room.quiz = { sets };
      room.results = new Map();
      const g = room.gauge;
      g.goal = goal;
      g.value = Math.min(g.value, goal);
      g.base = g.value;
      g.done = g.value >= goal;
      const students = [...room.players.values()].filter((p) => !p.teacher);
      for (const p of students) sendQuizTo(room, p);
      sendGauge(room);
      send(player, { t: 'quizSent', count: students.length });
      sendProgress(room);
      setFocus(room, true);
      break;
    }
    case 'quizEnd':
      if (!player.teacher) break;
      room.quiz = null;
      room.results = new Map();
      broadcast(room, { t: 'quizEnd' }, player);
      sendProgress(room);
      break;
    case 'answer': {
      const entry = player.teacher || !room.quiz ? null : room.results.get(player.name);
      const item = entry && Number.isInteger(msg.i) ? entry.set[msg.i] : null;
      if (!item || typeof msg.v !== 'string') break;
      const ok = normalizeAnswer(msg.v) === normalizeAnswer(item.a);
      send(player, { t: 'result', i: msg.i, ok, answer: item.a });
      if (!entry.answers.has(msg.i)) entry.answers.set(msg.i, ok);
      updateGauge(room);
      sendProgress(room);
      break;
    }
    case 'level': {
      if (!player.teacher || typeof msg.name !== 'string' || !LEVELS.includes(msg.level)) break;
      room.levels.set(msg.name, msg.level);
      // 아직 한 문제도 안 푼 학생은 바로 새 수준 문제를 받는다. 푼 학생은 다음 문제 세트부터 바뀐다.
      const entry = room.results.get(msg.name);
      if (room.quiz && entry && entry.answers.size === 0) {
        entry.level = msg.level;
        entry.set = setFor(room, msg.level);
        for (const p of room.players.values()) if (!p.teacher && p.name === msg.name) sendQuizTo(room, p);
      }
      sendProgress(room);
      break;
    }
    case 'gaugeSet': {
      if (!player.teacher) break;
      const goal = cleanGoal(msg.goal);
      if (!goal) break;
      const g = room.gauge;
      g.goal = goal;
      g.value = msg.reset ? 0 : Math.min(g.value, goal);
      g.base = g.value;
      g.done = g.value >= goal;
      sendGauge(room);
      break;
    }
    case 'pos': {
      const x = finite(msg.x, -8, 8);
      const z = finite(msg.z, -9, 9);
      const r = finite(msg.r, -10, 10);
      if (x === null || z === null || r === null) return;
      const seat = Number.isInteger(msg.s) && msg.s >= 0 && msg.s < SEAT_COUNT ? msg.s : -1;
      Object.assign(player, { x, z, r, s: seat });
      if (seat >= 0) player.assigned = -1;
      broadcast(room, { t: 'pos', id: player.id, x, z, r, s: seat }, player);
      break;
    }
    case 'act':
      // 선생님이 자리에 앉히거나 문제를 낸 동안에는 학생이 종이비행기를 날릴 수 없다.
      if (msg.a === 'throw' && room.focus && !player.teacher) break;
      if (ACTIONS.has(msg.a)) broadcast(room, { t: 'act', id: player.id, a: msg.a }, player);
      break;
    case 'say':
      if (Number.isInteger(msg.i) && msg.i >= 0 && msg.i < PHRASES.length) broadcast(room, { t: 'say', id: player.id, i: msg.i }, player);
      break;
    case 'look':
      player.look = cleanLook(msg.look);
      player.nick = cleanNick(msg.nick);
      broadcast(room, { t: 'look', id: player.id, look: player.look, nick: player.nick }, player);
      break;
  }
}

// 없는 교실이거나 가득 찬 교실이면 이유를 알려 주고 연결을 닫는다.
function reject(socket, reason) {
  socket.send(JSON.stringify({ t: reason }));
  socket.close();
}

wss.on('connection', (socket, req) => {
  const { searchParams } = new URL(req.url, 'http://localhost');
  const code = parseRoomCode(searchParams.get('room'));
  const room = code && rooms.get(code);
  if (!room) return reject(socket, 'closed');
  if (room.players.size >= ROOM_CAPACITY) return reject(socket, 'full');

  const player = { id: nextId++, socket, look: cleanLook(), nick: [0, 0], x: 2.3, z: 2.9, r: Math.PI, s: -1, assigned: -1, teacher: false, name: '', joined: false, alive: true, tokens: 40, refilled: Date.now() };
  socket.on('pong', () => { player.alive = true; });

  socket.on('message', (raw) => {
    // 초당 메시지 수를 제한한다.
    const now = Date.now();
    player.tokens = Math.min(60, player.tokens + ((now - player.refilled) / 1000) * 40);
    player.refilled = now;
    if (player.tokens < 1) return;
    player.tokens -= 1;

    let msg;
    try { msg = JSON.parse(raw.toString()); } catch { return; }
    if (msg === null || typeof msg !== 'object') return;

    if (!player.joined) {
      if (msg.t !== 'hello') return;
      if (rooms.get(room.code) !== room) return reject(socket, 'closed');
      if (room.players.size >= ROOM_CAPACITY) return reject(socket, 'full');
      player.look = cleanLook(msg.look);
      player.nick = cleanNick(msg.nick);
      player.teacher = typeof msg.token === 'string' && msg.token.length === room.hostToken.length && msg.token === room.hostToken;
      player.name = cleanName(msg.name);
      // 학생은 진짜 이름이 있어야 들어올 수 있다.
      if (!player.teacher && !player.name) return reject(socket, 'noname');
      player.joined = true;
      socket.send(JSON.stringify({
        t: 'welcome',
        id: player.id,
        teacher: player.teacher,
        quiz: !player.teacher && room.quiz ? enrollStudent(room, player.name).set.map((item) => item.q) : null,
        gauge: room.gauge.goal ? { goal: room.gauge.goal, value: Math.round(room.gauge.value * 10) / 10 } : null,
        focus: room.focus,
        players: [...room.players.values()].map((p) => publicPlayer(p, player.teacher)),
      }));
      room.players.set(player.id, player);
      for (const p of room.players.values()) if (p !== player) send(p, { t: 'join', player: publicPlayer(player, p.teacher) });
      sendProgress(room);
      return;
    }
    handle(player, room, msg);
  });

  socket.on('close', () => {
    if (room.players.delete(player.id)) {
      broadcast(room, { t: 'leave', id: player.id });
      sendProgress(room);
      if (room.players.size === 0) room.emptySince = Date.now();
    }
  });
  socket.on('error', () => socket.terminate());
  socket.player = player;
});

// 끊긴 연결 정리
setInterval(() => {
  for (const socket of wss.clients) {
    const player = socket.player;
    if (!player) continue;
    if (!player.alive) { socket.terminate(); continue; }
    player.alive = false;
    socket.ping();
  }
}, 30000);

// 오래 비어 있는 교실은 닫는다.
setInterval(() => {
  const now = Date.now();
  for (const room of rooms.values()) {
    if (room.players.size === 0 && now - room.emptySince > EMPTY_ROOM_LIFETIME) rooms.delete(room.code);
  }
}, 60000);

server.listen(PORT, () => {
  console.log(`교실 문이 열렸어요 → http://localhost:${PORT}`);
});
