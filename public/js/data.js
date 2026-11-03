// 서버와 클라이언트가 함께 쓰는 고정 데이터.
// 자유 입력을 받지 않도록 닉네임과 말풍선은 모두 목록의 번호로만 주고받는다.

// 방 코드는 선생님이 교실을 열 때 서버가 정하는 4자리 숫자다. 같은 코드를 입력한 사람끼리만 한 교실에 모인다.
export const ROOM_CODE_LENGTH = 4;

export function parseRoomCode(code) {
  return /^\d{4}$/.test(code ?? '') ? String(code) : null;
}

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

// 말풍선 번역. PHRASES와 같은 순서이며, 번호만 주고받으므로 보는 사람이 고른 언어로 보인다.
export const LANGS = [
  { code: 'ko', label: '한국어' },
  { code: 'en', label: 'English' },
  { code: 'zh', label: '中文' },
  { code: 'vi', label: 'Tiếng Việt' },
  { code: 'ru', label: 'Русский' },
];

const TRANSLATIONS = {
  en: ['Focus!', 'Shh, be quiet!', 'Who wants to present?', 'Me, me!', 'This is hard…', "I'm done!", 'You can do it!', "Don't fall asleep~",
    'I need to go to the bathroom', "Let's play together!!", "What's for lunch today?", 'Did you do your homework?', 'Thank you!', 'Did the bell already ring?', 'See you again!'],
  zh: ['集中注意力！', '嘘，安静！', '谁想发言？', '我我我！', '这个好难…', '我做完了！', '加油！', '别睡着啦~',
    '我要去厕所', '一起玩吧！！', '今天午饭吃什么？', '你写作业了吗？', '谢谢！', '已经打铃了吗？', '下次见！'],
  vi: ['Tập trung nào!', 'Suỵt, im lặng!', 'Ai muốn phát biểu?', 'Em, em ạ!', 'Cái này khó quá…', 'Mình làm xong rồi!', 'Cố lên!', 'Đừng ngủ gật nhé~',
    'Mình phải đi vệ sinh', 'Cùng chơi nhé!!', 'Hôm nay ăn trưa món gì?', 'Bạn làm bài tập chưa?', 'Cảm ơn bạn!', 'Reo chuông rồi à?', 'Hẹn gặp lại!'],
  ru: ['Сосредоточься!', 'Тсс, тихо!', 'Кто хочет ответить?', 'Я, я!', 'Это сложно…', 'Я закончил(а)!', 'Давай!', 'Не засыпай~',
    'Мне надо в туалет', 'Давай играть вместе!!', 'Что сегодня на обед?', 'Ты сделал(а) домашку?', 'Спасибо!', 'Уже был звонок?', 'До встречи!'],
};

export const MENU_TITLES = {
  class: { ko: '수업 시간에 할 말', en: 'Things to say in class', zh: '上课时可以说的话', vi: 'Câu nói trong giờ học', ru: 'Фразы для урока' },
  break: { ko: '쉬는 시간에 할 말', en: 'Things to say at break', zh: '课间可以说的话', vi: 'Câu nói giờ ra chơi', ru: 'Фразы для перемены' },
};

// 선생님이 모두 앉히기를 눌렀을 때 학생 화면에 뜨는 알림과 선생님 문제 창의 글자.
export const SIT_ALERT = { ko: '앉아야 합니다!', en: 'Please sit down!', zh: '请坐下！', vi: 'Hãy ngồi xuống!', ru: 'Пожалуйста, сядьте!' };

const QUIZ_UI = {
  title: { ko: '선생님 문제', en: "Teacher's questions", zh: '老师的题目', vi: 'Câu hỏi của thầy cô', ru: 'Вопросы учителя' },
  submit: { ko: '확인', en: 'Submit', zh: '提交', vi: 'Gửi', ru: 'Ответить' },
  placeholder: { ko: '답을 써 주세요', en: 'Type your answer', zh: '请输入答案', vi: 'Nhập đáp án', ru: 'Введите ответ' },
  right: { ko: '딩동댕!', en: 'Correct!', zh: '答对了！', vi: 'Đúng rồi!', ru: 'Верно!' },
  wrong: {
    ko: (a) => `정답은 ${a}이에요`, en: (a) => `The answer is ${a}`, zh: (a) => `正确答案是 ${a}`,
    vi: (a) => `Đáp án là ${a}`, ru: (a) => `Правильный ответ: ${a}`,
  },
  score: {
    ko: (n, t) => `${t}개 중 ${n}개 맞았어요`, en: (n, t) => `${n} out of ${t} correct`, zh: (n, t) => `${t} 题中答对 ${n} 题`,
    vi: (n, t) => `Đúng ${n}/${t} câu`, ru: (n, t) => `Верно: ${n} из ${t}`,
  },
};

export function quizText(key, lang, ...args) {
  const entry = QUIZ_UI[key][lang] ?? QUIZ_UI[key].ko;
  return typeof entry === 'function' ? entry(...args) : entry;
}

export function cleanLang(code) {
  return LANGS.some((l) => l.code === code) ? code : 'ko';
}

export function phraseText(index, lang) {
  return TRANSLATIONS[lang]?.[index] ?? PHRASES[index];
}

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
