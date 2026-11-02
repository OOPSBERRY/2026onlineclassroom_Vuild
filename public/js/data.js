// 서버와 클라이언트가 함께 쓰는 고정 데이터.
// 자유 입력을 받지 않도록 닉네임과 말풍선은 모두 목록의 번호로만 주고받는다.

// 반 번호는 "study-2"처럼 종류와 번호로 이루어진다. 1반은 늘 있고 나머지는 서버가 필요할 때 만든다.
export const ROOM_KINDS = { study: '자습', rest: '추억' };
export const MAX_ROOMS_PER_KIND = 100;

export function parseRoomId(id) {
  const match = /^(study|rest)-([1-9]\d*)$/.exec(id ?? '');
  if (!match || Number(match[2]) > MAX_ROOMS_PER_KIND) return null;
  const [, kind, number] = match;
  return { id, kind, number: Number(number), name: `${ROOM_KINDS[kind]} ${number}반` };
}

export const REGIONS = ['서울', '부산', '대구', '인천', '광주', '대전', '울산', '세종', '경기', '강원', '충북', '충남', '전북', '전남', '경북', '경남', '제주'];
export const ROOM_CAPACITY = 25;
export const SEAT_COUNT = 25;

export const ADJECTIVES = ['졸린', '용감한', '수줍은', '씩씩한', '작은', '느긋한', '반짝이는', '배고픈', '조용한', '신나는', '엉뚱한', '다정한'];
export const ANIMALS = ['참새', '다람쥐', '토끼', '고양이', '강아지', '병아리', '거북이', '수달', '판다', '오리', '너구리', '여우'];

const CLASS_PHRASES = [
  '집중해!',
  '쉿, 조용!',
  '발표할 사람?',
  '저요 저요!',
  '이거 어려워…',
  '다 했다!',
  '화이팅!',
  '졸지 마~',
];
const BREAK_PHRASES = [
  '화장실 가야지',
  '같이 놀자!!',
  '오늘 급식 뭐야?',
  '숙제 했어?',
  '고마워!',
  '벌써 종 쳤어?',
  '또 만나!',
];

// 네트워크로는 이 목록의 번호만 주고받는다.
export const PHRASES = [...CLASS_PHRASES, ...BREAK_PHRASES];

export function phrasesFor(kind) {
  const list = kind === 'class' ? CLASS_PHRASES : BREAK_PHRASES;
  const offset = kind === 'class' ? 0 : CLASS_PHRASES.length;
  return list.map((text, i) => ({ text, index: offset + i }));
}

export const LOOKS = {
  hair: ['짧은 머리', '까까머리', '단발', '양갈래', '똥머리'],
  hairColor: [0x2b2019, 0x4a2f1f, 0x7a4a26, 0x15151a],
  skin: [0xf2c9a4, 0xe8b48c, 0xd19a6e],
  shirt: [0xf4f1e6, 0x8fb6d9, 0xe58f7a, 0x9ec58c, 0xf0c95b, 0xb9a2d8],
  bag: [0xc9503e, 0x3f6ea6, 0xe0a52e, 0x4e8a5f, 0x8a5aa8],
};

// 남(0)과 여(1)는 고를 수 있는 머리 모양만 다르다. 성별 자체는 서버로 보내지 않는다.
export const HAIR_BY_GENDER = [[0, 1], [2, 3, 4]];

export function randomHair(gender) {
  const list = HAIR_BY_GENDER[gender];
  return list[Math.floor(Math.random() * list.length)];
}

export function randomLook() {
  const pick = (list) => Math.floor(Math.random() * list.length);
  return {
    hair: randomHair(pick(HAIR_BY_GENDER)),
    hairColor: pick(LOOKS.hairColor),
    skin: pick(LOOKS.skin),
    shirt: pick(LOOKS.shirt),
    bag: pick(LOOKS.bag),
    hat: Math.random() < 0.5 ? 1 : 0,
  };
}

export function randomNick() {
  return [Math.floor(Math.random() * ADJECTIVES.length), Math.floor(Math.random() * ANIMALS.length)];
}

export function nickName(nick) {
  return `${ADJECTIVES[nick[0]]} ${ANIMALS[nick[1]]}`;
}

export function plateName(region, nick) {
  const name = nickName(nick);
  return REGIONS[region] ? `${REGIONS[region]} · ${name}` : name;
}

// 목록에 없는 지역은 표시하지 않는다.
export function cleanRegion(region) {
  return Number.isInteger(region) && region >= 0 && region < REGIONS.length ? region : -1;
}

// 서버에서 받은 값이 범위를 벗어나지 않게 정리한다.
export function cleanLook(look = {}) {
  const clean = {};
  for (const key of Object.keys(LOOKS)) {
    const value = Number.isInteger(look[key]) ? look[key] : 0;
    clean[key] = Math.max(0, Math.min(LOOKS[key].length - 1, value));
  }
  clean.hat = look.hat ? 1 : 0;
  return clean;
}

export function cleanNick(nick) {
  if (!Array.isArray(nick)) return [0, 0];
  const clampIndex = (value, list) => (Number.isInteger(value) ? Math.max(0, Math.min(list.length - 1, value)) : 0);
  return [clampIndex(nick[0], ADJECTIVES), clampIndex(nick[1], ANIMALS)];
}
