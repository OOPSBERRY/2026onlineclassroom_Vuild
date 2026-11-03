import { UI_TEXT } from './data.js';

// 교실 안 화면의 글자. 첫 화면 글자(UI_TEXT)와 합쳐서 쓴다.
// 값이 함수인 항목은 숫자나 이름을 끼워 넣는 문장이다. 선생님 도구 화면은 한국어만 쓴다.
const L = (ko, en, zh, vi, ru) => ({ ko, en, zh, vi, ru });

const GAME_TEXT = {
  brand: L('우리 교실', 'Our Classroom', '我们的教室', 'Lớp học của chúng ta', 'Наш класс'),
  loading: L('교실 문을 여는 중', 'Opening the classroom…', '正在打开教室…', 'Đang mở cửa lớp học…', 'Открываем класс…'),
  noWebgl: L('이 브라우저에서는 3D 교실을 열 수 없어요', "This browser can't open the 3D classroom.", '此浏览器无法打开3D教室。', 'Trình duyệt này không mở được lớp học 3D.', 'Этот браузер не может открыть 3D-класс.'),
  exit: L('교실 나가기', 'Leave the classroom', '离开教室', 'Rời lớp học', 'Выйти из класса'),
  codeAria: L('방 코드와 QR 코드 보기', 'Show room code and QR code', '查看房间码和二维码', 'Xem mã phòng và mã QR', 'Показать код комнаты и QR-код'),
  roomCode: L('방 코드', 'Room code', '房间码', 'Mã phòng', 'Код комнаты'),
  countTitle: L('지금 접속한 사람 수', 'People in the room now', '当前在线人数', 'Số người đang trong phòng', 'Сейчас в комнате'),
  statsTitle: L('대략적인 이용자 수예요. 숫자가 바뀌는 데 시간이 걸릴 수 있어요.', 'This is a rough number of users. It may take time to update.', '这是大概的使用人数，数字更新可能需要一些时间。', 'Đây là số người dùng ước tính. Con số có thể cập nhật chậm.', 'Это примерное число пользователей. Обновление может занять время.'),
  stats: L((a, b) => `오늘 ${a} · 전체 ${b}`, (a, b) => `Today ${a} · Total ${b}`, (a, b) => `今天 ${a} · 总计 ${b}`, (a, b) => `Hôm nay ${a} · Tổng ${b}`, (a, b) => `Сегодня ${a} · Всего ${b}`),
  qrTitle: L('우리 반 방 코드', 'Our class room code', '我们班的房间码', 'Mã phòng của lớp mình', 'Код комнаты нашего класса'),
  qrDesc: L('학생들은 첫 화면에서 이 코드를 입력하거나 태블릿 카메라로 QR을 찍으면 들어와요.', 'Students enter this code on the first screen or scan the QR code with a tablet camera.', '学生可在首页输入此房间码，或用平板相机扫描二维码进入。', 'Học sinh nhập mã này ở màn hình đầu hoặc quét mã QR bằng camera máy tính bảng để vào.', 'Ученики вводят этот код на первом экране или сканируют QR-код камерой планшета.'),
  close: L('닫기', 'Close', '关闭', 'Đóng', 'Закрыть'),
  myLook: L('내 모습', 'My look', '我的形象', 'Diện mạo của tôi', 'Мой вид'),
  lookAria: L('내 모습 꾸미기', 'Customize my look', '装扮我的形象', 'Tùy chỉnh diện mạo', 'Настроить внешность'),
  sound: L('소리', 'Sound', '声音', 'Âm thanh', 'Звук'),
  soundOn: L('소리 켜기', 'Turn sound on', '开启声音', 'Bật âm thanh', 'Включить звук'),
  soundOff: L('소리 끄기', 'Turn sound off', '关闭声音', 'Tắt âm thanh', 'Выключить звук'),
  settings: L('설정', 'Settings', '设置', 'Cài đặt', 'Настройки'),
  bell: L('수업 종 듣기', 'Hear the school bell', '听上课铃', 'Nghe chuông vào lớp', 'Послушать звонок'),
  nameField: L('이름', 'Name', '名字', 'Tên', 'Имя'),
  reroll: L('다시 뽑기', 'Reroll', '重新抽取', 'Chọn lại', 'Выбрать заново'),
  hairStyle: L('머리 모양', 'Hairstyle', '发型', 'Kiểu tóc', 'Причёска'),
  hairColor: L('머리 색', 'Hair color', '发色', 'Màu tóc', 'Цвет волос'),
  skin: L('피부', 'Skin', '肤色', 'Màu da', 'Цвет кожи'),
  shirt: L('옷', 'Clothes', '衣服', 'Quần áo', 'Одежда'),
  bag: L('가방', 'Bag', '书包', 'Cặp sách', 'Рюкзак'),
  hat: L('노란 모자 쓰기', 'Wear a yellow hat', '戴黄色帽子', 'Đội mũ vàng', 'Надеть жёлтую шапку'),
  hair0: L('짧은 머리', 'Short hair', '短发', 'Tóc ngắn', 'Короткие волосы'),
  hair1: L('까까머리', 'Buzz cut', '平头', 'Tóc cắt sát', 'Стрижка ёжик'),
  hair2: L('단발', 'Bob', '波波头', 'Tóc ngang vai', 'Каре'),
  hair3: L('양갈래', 'Pigtails', '双马尾', 'Tóc hai bím', 'Два хвостика'),
  hair4: L('똥머리', 'Bun', '丸子头', 'Tóc búi', 'Пучок'),
  volume: L('소리 크기', 'Volume', '音量', 'Âm lượng', 'Громкость'),
  quality: L('그림자와 고화질', 'Shadows and high quality', '阴影和高画质', 'Bóng đổ và chất lượng cao', 'Тени и высокое качество'),
  settingsNote: L('친구 수에는 실제 접속한 사람만 표시돼요. 말풍선은 정해진 문장만 쓸 수 있어요.', 'The count shows only real people who are connected. Speech bubbles use preset sentences only.', '人数只显示实际在线的人。气泡只能使用固定的句子。', 'Số bạn chỉ tính những người đang kết nối thật. Bong bóng lời nói chỉ dùng các câu có sẵn.', 'В счётчике только реально подключённые люди. В пузырях можно использовать только готовые фразы.'),
  hint: L('바닥 클릭 · 드래그로 둘러보기 · 휠로 확대/축소', 'Click the floor to walk · Drag to look around · Scroll to zoom', '点击地面行走 · 拖动环顾四周 · 滚轮缩放', 'Nhấp sàn để đi · Kéo để nhìn quanh · Cuộn để phóng to/thu nhỏ', 'Нажмите на пол, чтобы идти · Перетащите, чтобы осмотреться · Колесо — масштаб'),
  actions: L('행동', 'Actions', '动作', 'Hành động', 'Действия'),
  sit: L('앉기', 'Sit', '坐下', 'Ngồi', 'Сесть'),
  stand: L('일어서기', 'Stand up', '起立', 'Đứng dậy', 'Встать'),
  study: L('자습하기', 'Self-study', '自习', 'Tự học', 'Самоподготовка'),
  jump: L('점프', 'Jump', '跳', 'Nhảy', 'Прыжок'),
  jumpTitle: L('스페이스 키로도 뛸 수 있어요', 'You can also jump with the Space key', '也可以按空格键跳', 'Bạn cũng có thể nhảy bằng phím Space', 'Можно прыгать и клавишей «Пробел»'),
  raise: L('손들기', 'Raise hand', '举手', 'Giơ tay', 'Поднять руку'),
  bow: L('인사', 'Greet', '问好', 'Chào', 'Поклон'),
  clap: L('박수', 'Clap', '鼓掌', 'Vỗ tay', 'Аплодисменты'),
  plane: L('종이비행기', 'Paper plane', '纸飞机', 'Máy bay giấy', 'Бумажный самолётик'),
  talk: L('말하기', 'Talk', '说话', 'Nói', 'Сказать'),
  multiply: L('구구단', 'Times tables', '乘法口诀', 'Bảng cửu chương', 'Таблица умножения'),
  divide: L('나눗셈', 'Division', '除法', 'Phép chia', 'Деление'),
  again: L('한 번 더', 'Once more', '再来一次', 'Thêm một lần nữa', 'Ещё раз'),
  otherDan: L('다른 단 고르기', 'Pick another table', '选择其他口诀', 'Chọn bảng khác', 'Выбрать другую таблицу'),
  leadMultiply: L('몇 단을 풀어 볼까요?', 'Which table do you want to try?', '想练习几的乘法口诀？', 'Bạn muốn luyện bảng nhân nào?', 'Какую таблицу будем решать?'),
  leadDivide: L('어떤 수로 나눠 볼까요?', 'Which number shall we divide by?', '要除以几？', 'Chia cho số nào?', 'На какое число будем делить?'),
  dan: L((n) => `${n}단`, (n) => `Table of ${n}`, (n) => `${n}的口诀`, (n) => `Bảng ${n}`, (n) => `×${n}`),
  shuffleAll: L('전체 섞기', 'Mix all', '全部混合', 'Trộn tất cả', 'Всё вперемешку'),
  erase: L('지우기', 'Erase', '删除', 'Xóa', 'Стереть'),
  okBtn: L('확인', 'OK', '确定', 'Xác nhận', 'ОК'),
  perfectMultiply: L('모두 맞았어요! 구구단 박사님이에요!', "All correct! You're a times-table master!", '全部答对了！你是乘法口诀小博士！', 'Đúng hết rồi! Bạn là bậc thầy bảng cửu chương!', 'Всё верно! Ты мастер таблицы умножения!'),
  perfectDivide: L('모두 맞았어요! 나눗셈 박사님이에요!', "All correct! You're a division master!", '全部答对了！你是除法小博士！', 'Đúng hết rồi! Bạn là bậc thầy phép chia!', 'Всё верно! Ты мастер деления!'),
  great: L('정말 잘했어요!', 'Great job!', '太棒了！', 'Giỏi lắm!', 'Отлично!'),
  good: L('잘했어요! 조금만 더 해 볼까요?', 'Well done! Shall we try a little more?', '做得好！再试一次吧？', 'Làm tốt lắm! Thử thêm chút nữa nhé?', 'Хорошо! Попробуем ещё немного?'),
  keepGoing: L('끝까지 푼 것이 멋져요! 한 번 더 해 봐요!', "You finished it all, that's wonderful! Try once more!", '坚持做完真了不起！再来一次吧！', 'Làm đến cùng thật tuyệt! Thử lại lần nữa nhé!', 'Ты дошёл до конца — здорово! Попробуй ещё раз!'),
  gaugeLabel: L('우리 반 협동 게이지', 'Class teamwork gauge', '全班合作进度', 'Thanh hợp tác của lớp', 'Шкала командной работы класса'),
  gaugeFull: L('우리 반이 목표 게이지를 모두 채웠어요!', 'Our class filled the goal gauge!', '我们班填满了目标进度条！', 'Lớp mình đã lấp đầy thanh mục tiêu!', 'Наш класс заполнил шкалу цели!'),
  bye: L('내일 또 만나요', 'See you tomorrow', '明天见', 'Hẹn gặp lại ngày mai', 'До завтра'),
  reenter: L('다시 들어가기', 'Enter again', '重新进入', 'Vào lại', 'Войти снова'),
  toEntry: L('처음 화면으로', 'Back to start', '回到首页', 'Về màn hình đầu', 'На главный экран'),
  me: L('나', 'Me', '我', 'Tôi', 'Я'),
  teacherName: L('선생님', 'Teacher', '老师', 'Thầy cô', 'Учитель'),
  periodClass: L('수업 시간', 'Class time', '上课时间', 'Giờ học', 'Урок'),
  periodBreak: L('쉬는 시간', 'Break time', '课间休息', 'Giờ ra chơi', 'Перемена'),
  left: L((n, unit) => `${n}${unit === 'min' ? '분' : '초'} 남음`, (n, unit) => `${n} ${unit === 'min' ? 'min' : 'sec'} left`, (n, unit) => `还剩 ${n} ${unit === 'min' ? '分钟' : '秒'}`, (n, unit) => `còn ${n} ${unit === 'min' ? 'phút' : 'giây'}`, (n, unit) => `осталось ${n} ${unit === 'min' ? 'мин' : 'сек'}`),
  classStart: L('수업 시작이에요', 'Class is starting', '上课了', 'Bắt đầu giờ học', 'Урок начинается'),
  breakStart: L('쉬는 시간이에요', "It's break time", '课间休息了', 'Đến giờ ra chơi', 'Началась перемена'),
  bellToast: L('딩동댕동 — 수업 종이 울려요', 'Ding-dong — the school bell is ringing', '叮咚——上课铃响了', 'Ting-tong — chuông vào lớp reo rồi', 'Динь-дон — звенит школьный звонок'),
  joined: L((c) => `방 코드 ${c} 교실에 들어왔어요. 같은 방 친구들만 보여요.`, (c) => `You joined room ${c}. You can only see friends in this room.`, (c) => `你已进入房间 ${c}，只能看到同一房间的同学。`, (c) => `Bạn đã vào phòng ${c}. Chỉ thấy các bạn trong cùng phòng.`, (c) => `Вы вошли в комнату ${c}. Видны только друзья из этой комнаты.`),
  noSeat: L('지금은 빈자리가 없어요', 'There are no empty seats right now', '现在没有空座位', 'Hiện không còn chỗ trống', 'Сейчас нет свободных мест'),
  seatTaken: L('다른 친구가 앉은 자리예요', 'Another friend is sitting there', '这个座位已有同学', 'Bạn khác đang ngồi ở đó', 'Это место уже занято'),
  jumpStand: L('일어서면 점프할 수 있어요', 'Stand up to jump', '站起来才能跳', 'Hãy đứng dậy để nhảy', 'Встаньте, чтобы прыгать'),
  sitHere: L('여기 앉기', 'Sit here', '坐这里', 'Ngồi đây', 'Сесть здесь'),
  noPlane: L('지금은 종이비행기를 날릴 수 없어요', "You can't throw paper planes right now", '现在不能扔纸飞机', 'Bây giờ chưa được ném máy bay giấy', 'Сейчас нельзя запускать самолётики'),
  planeOk: L('다시 종이비행기를 날릴 수 있어요', 'You can throw paper planes again', '又可以扔纸飞机了', 'Bạn lại có thể ném máy bay giấy', 'Снова можно запускать самолётики'),
  planeLocked: L('선생님이 수업을 시작해서 날릴 수 없어요', "Your teacher started class, so you can't throw them", '老师已开始上课，不能扔', 'Thầy cô đã bắt đầu giờ học nên không ném được', 'Учитель начал урок, поэтому нельзя'),
  closedToast: L('이 교실은 닫혔어요. 처음 화면으로 돌아가요.', 'This classroom is closed. Going back to the start.', '这个教室已关闭，正在返回首页。', 'Lớp học này đã đóng. Quay về màn hình đầu.', 'Этот класс закрыт. Возвращаемся на главный экран.'),
  nonameToast: L('이름을 적고 다시 들어와 주세요.', 'Please write your name and enter again.', '请填写名字后重新进入。', 'Hãy nhập tên rồi vào lại.', 'Введите имя и войдите снова.'),
  quizEndToast: L('선생님이 문제를 끝냈어요', 'Your teacher ended the questions', '老师结束了题目', 'Thầy cô đã kết thúc câu hỏi', 'Учитель завершил вопросы'),
};

const TEXT = { ...UI_TEXT, ...GAME_TEXT };

// 키에 해당하는 글자를 고른 언어로 돌려준다. 없는 언어는 한국어로 보여 준다.
export function uiText(key, lang, ...args) {
  const entry = TEXT[key]?.[lang] ?? TEXT[key]?.ko ?? '';
  return typeof entry === 'function' ? entry(...args) : entry;
}

// data-i18n(글자), data-i18n-placeholder, data-i18n-title, data-i18n-aria가 붙은 곳을 모두 바꾼다.
export function applyI18n(root, lang) {
  for (const el of root.querySelectorAll('[data-i18n]')) el.textContent = uiText(el.dataset.i18n, lang);
  for (const el of root.querySelectorAll('[data-i18n-placeholder]')) el.placeholder = uiText(el.dataset.i18nPlaceholder, lang);
  for (const el of root.querySelectorAll('[data-i18n-title]')) el.title = uiText(el.dataset.i18nTitle, lang);
  for (const el of root.querySelectorAll('[data-i18n-aria]')) el.setAttribute('aria-label', uiText(el.dataset.i18nAria, lang));
}
