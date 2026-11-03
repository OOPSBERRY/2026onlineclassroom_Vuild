// 서버와 클라이언트가 함께 쓰는 고정 데이터.
// 자유 입력을 받지 않도록 닉네임과 말풍선은 모두 목록의 번호로만 주고받는다.

// 방 코드는 선생님이 교실을 열 때 서버가 정하는 4자리 숫자다. 같은 코드를 입력한 사람끼리만 한 교실에 모인다.
export const ROOM_CODE_LENGTH = 4;

export function parseRoomCode(code) {
  return /^\d{4}$/.test(code ?? '') ? String(code) : null;
}

// 학생 수는 선생님이 교실을 만들 때 정한다(선생님은 따로 센다). 책상은 학생 수에 맞춰 25 / 32 / 40자리 중 하나를 쓴다.
export const DEFAULT_STUDENTS = 25;
export const MAX_STUDENTS = 40;

export function cleanStudents(count) {
  return Number.isInteger(count) && count >= 1 && count <= MAX_STUDENTS ? count : DEFAULT_STUDENTS;
}

export function seatsFor(students) {
  return students <= 25 ? 25 : students <= 32 ? 32 : 40;
}

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

// 첫 화면(입장 화면)의 글자. 고른 언어로 바뀐다. 키는 index.html의 data-i18n과 같다.
export const UI_TEXT = {
  gender: { ko: '어떤 친구로 들어갈까요?', en: 'Which character do you want to be?', zh: '你想选哪个小朋友？', vi: 'Bạn muốn vào lớp là bạn nào?', ru: 'Каким учеником вы хотите войти?' },
  boy: { ko: '남자 어린이', en: 'Boy', zh: '男孩', vi: 'Bạn nam', ru: 'Мальчик' },
  girl: { ko: '여자 어린이', en: 'Girl', zh: '女孩', vi: 'Bạn nữ', ru: 'Девочка' },
  nameLabel: { ko: '내 이름을 적어 주세요 (진짜 이름)', en: 'Please write your name (real name)', zh: '请填写你的名字（真名）', vi: 'Hãy nhập tên của bạn (tên thật)', ru: 'Введите своё имя (настоящее)' },
  namePlaceholder: { ko: '예) 김민준', en: 'e.g. Minjun Kim', zh: '例）金民俊', vi: 'VD: Kim Min Jun', ru: 'напр. Ким Минджун' },
  nameNote: { ko: '이름은 선생님만 볼 수 있어요. 친구들에게는 동물 이름으로 보여요.', en: 'Only your teacher can see your name. Your friends see an animal name.', zh: '只有老师能看到你的名字，同学们看到的是动物名字。', vi: 'Chỉ thầy cô thấy tên của bạn. Các bạn sẽ thấy tên con vật.', ru: 'Имя видит только учитель. Друзья видят имя животного.' },
  codeLabel: { ko: '선생님이 알려 준 방 코드를 입력해요', en: 'Enter the room code your teacher gave you', zh: '请输入老师告诉你的房间码', vi: 'Nhập mã phòng thầy cô đã cho', ru: 'Введите код комнаты, который дал учитель' },
  enter: { ko: '교실 들어가기', en: 'Enter the classroom', zh: '进入教室', vi: 'Vào lớp học', ru: 'Войти в класс' },
  teacherAsk: { ko: '선생님이신가요?', en: 'Are you a teacher?', zh: '您是老师吗？', vi: 'Bạn là giáo viên?', ru: 'Вы учитель?' },
  create: { ko: '우리 반 교실 만들기', en: 'Create our classroom', zh: '创建我们班的教室', vi: 'Tạo lớp học cho lớp mình', ru: 'Создать класс' },
  teacherNote: { ko: '만들면 방 코드와 QR 코드가 나와요. 학생들에게 보여 주세요.', en: 'You will get a room code and a QR code. Show them to your students.', zh: '创建后会出现房间码和二维码，请展示给学生。', vi: 'Sau khi tạo sẽ có mã phòng và mã QR. Hãy cho học sinh xem.', ru: 'Появятся код комнаты и QR-код. Покажите их ученикам.' },
  bottomNote: { ko: '학교 이름은 묻지 않아요. 친구들에게 보이는 이름은 자동으로 정해지는 동물 이름이에요.', en: "We don't ask for your school name. Your friends see a random animal name.", zh: '我们不询问学校名称。同学们看到的是自动分配的动物名字。', vi: 'Chúng tôi không hỏi tên trường. Các bạn thấy tên con vật được đặt tự động.', ru: 'Название школы не спрашивается. Друзья видят случайное имя животного.' },
  err_none: { ko: '없는 방 코드예요. 선생님이 알려 준 숫자를 다시 확인해 주세요.', en: "That room code doesn't exist. Check the number your teacher gave you.", zh: '没有这个房间码，请再确认老师告诉你的数字。', vi: 'Mã phòng không tồn tại. Hãy kiểm tra lại số thầy cô đã cho.', ru: 'Такого кода нет. Проверьте цифры, которые дал учитель.' },
  err_full: { ko: '이 교실은 자리가 다 찼어요.', en: 'This classroom is full.', zh: '这个教室已经满了。', vi: 'Lớp học này đã đầy.', ru: 'В этом классе нет мест.' },
  err_busy: { ko: '너무 자주 눌렀어요. 잠시 뒤에 다시 해 주세요.', en: 'Too many tries. Please try again in a moment.', zh: '点得太频繁了，请稍后再试。', vi: 'Bạn bấm quá nhiều lần. Hãy thử lại sau.', ru: 'Слишком много попыток. Попробуйте позже.' },
  err_create: { ko: '지금은 교실을 만들 수 없어요.', en: "Can't create a classroom right now.", zh: '现在无法创建教室。', vi: 'Hiện không thể tạo lớp học.', ru: 'Сейчас нельзя создать класс.' },
  err_offline: { ko: '서버에 연결할 수 없어요. 인터넷을 확인해 주세요.', en: "Can't connect to the server. Check your internet.", zh: '无法连接服务器，请检查网络。', vi: 'Không thể kết nối máy chủ. Hãy kiểm tra internet.', ru: 'Нет связи с сервером. Проверьте интернет.' },
};

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
