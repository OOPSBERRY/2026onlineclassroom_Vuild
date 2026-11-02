import { QUESTION_COUNT, makeQuestions, resultMessage } from './gugudan.js';

const $ = (id) => document.getElementById(id);
const RIGHT_DELAY = 800;
const WRONG_DELAY = 1700;
const MAX_DIGITS = 2;

// 구구단 창. 문제와 점수는 내 화면에만 있고 서버로 보내지 않는다.
export function setupStudy({ sound, onFinish }) {
  const state = { dan: 0, questions: [], index: 0, correct: 0, input: '', locked: false, timer: null };

  const show = (stage) => {
    for (const id of ['study-pick', 'study-quiz', 'study-result']) $(id).hidden = id !== stage;
  };

  function renderQuestion() {
    const q = state.questions[state.index];
    $('study-progress').textContent = `${state.index + 1} / ${QUESTION_COUNT}`;
    $('study-question').textContent = `${q.a} × ${q.b} =`;
    $('study-input').textContent = state.input || '?';
    $('study-feedback').textContent = '';
    $('study-feedback').className = 'study-feedback';
    $('study-submit').disabled = !state.input;
  }

  function start(dan) {
    clearTimeout(state.timer);
    Object.assign(state, { dan, questions: makeQuestions(dan), index: 0, correct: 0, input: '', locked: false });
    show('study-quiz');
    renderQuestion();
  }

  function press(digit) {
    if (state.locked || state.input.length >= MAX_DIGITS) return;
    state.input += digit;
    $('study-input').textContent = state.input;
    $('study-submit').disabled = false;
  }

  function erase() {
    if (state.locked) return;
    state.input = state.input.slice(0, -1);
    $('study-input').textContent = state.input || '?';
    $('study-submit').disabled = !state.input;
  }

  function submit() {
    if (state.locked || !state.input) return;
    state.locked = true;
    const q = state.questions[state.index];
    const right = Number(state.input) === q.answer;
    if (right) state.correct += 1;
    $('study-feedback').textContent = right ? '딩동댕!' : `정답은 ${q.answer}이에요`;
    $('study-feedback').className = `study-feedback ${right ? 'right' : 'wrong'}`;
    if (right) sound.ding();
    else sound.pop();
    state.timer = setTimeout(next, right ? RIGHT_DELAY : WRONG_DELAY);
  }

  function next() {
    state.index += 1;
    state.input = '';
    state.locked = false;
    if (state.index < QUESTION_COUNT) renderQuestion();
    else finish();
  }

  function finish() {
    $('study-score').textContent = `${QUESTION_COUNT}개 중 ${state.correct}개 맞았어요`;
    $('study-message').textContent = resultMessage(state.correct);
    show('study-result');
    sound.fanfare();
    celebrate();
    onFinish();
  }

  function celebrate() {
    const box = $('confetti');
    const colors = ['#f7dd72', '#f2a3b3', '#9fd0ef', '#a8dcb5', '#f2994a'];
    box.replaceChildren(...Array.from({ length: 46 }, (_, i) => {
      const piece = document.createElement('i');
      piece.style.left = `${Math.random() * 100}%`;
      piece.style.background = colors[i % colors.length];
      piece.style.animationDelay = `${Math.random() * 0.5}s`;
      piece.style.animationDuration = `${1.5 + Math.random() * 1.1}s`;
      return piece;
    }));
    setTimeout(() => box.replaceChildren(), 3200);
  }

  function open() {
    $('study-dialog').hidden = false;
    if ($('study-quiz').hidden) show('study-pick');
  }

  function close() {
    clearTimeout(state.timer);
    state.locked = false;
    state.input = '';
    $('study-dialog').hidden = true;
    show('study-pick');
  }

  $('study-dans').replaceChildren(...[2, 3, 4, 5, 6, 7, 8, 9, 0].map((dan) => {
    const button = document.createElement('button');
    button.className = dan ? 'study-dan' : 'study-dan all';
    button.textContent = dan ? `${dan}단` : '전체 섞기';
    button.onclick = () => start(dan);
    return button;
  }));
  $('study-keys').replaceChildren(...[1, 2, 3, 4, 5, 6, 7, 8, 9, 'erase', 0, 'submit'].map((key) => {
    const button = document.createElement('button');
    if (key === 'erase') {
      button.textContent = '지우기';
      button.className = 'study-key small';
      button.onclick = erase;
    } else if (key === 'submit') {
      button.id = 'study-submit';
      button.textContent = '확인';
      button.className = 'study-key small primary';
      button.onclick = submit;
    } else {
      button.textContent = key;
      button.className = 'study-key';
      button.onclick = () => press(String(key));
    }
    return button;
  }));
  $('study-again').onclick = () => start(state.dan);
  $('study-other').onclick = () => show('study-pick');
  $('study-close').onclick = close;

  addEventListener('keydown', (e) => {
    if ($('study-dialog').hidden) return;
    if (e.key === 'Escape') close();
    if ($('study-quiz').hidden) return;
    if (/^[0-9]$/.test(e.key)) press(e.key);
    else if (e.key === 'Backspace') erase();
    else if (e.key === 'Enter') {
      e.preventDefault();
      submit();
    }
  });

  return { open };
}
