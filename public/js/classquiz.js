import { quizText } from './data.js';

const $ = (id) => document.getElementById(id);
const RIGHT_DELAY = 900;
const WRONG_DELAY = 1900;

// 선생님이 보낸 문제를 푸는 창. 정답은 서버에만 있고, 학생이 답을 보내면 서버가 맞았는지 알려 준다.
export function setupClassQuiz({ sound, getLang, send, onFinish }) {
  const state = { qs: null, index: 0, correct: 0, locked: false, done: false, timer: null };

  const text = (key, ...args) => quizText(key, getLang(), ...args);

  function render() {
    $('quiz-title').textContent = text('title');
    $('quiz-btn-text').textContent = text('title');
    $('quiz-submit').textContent = text('submit');
    $('quiz-input').placeholder = text('placeholder');
    if (!state.qs) return;
    if (state.done) {
      $('quiz-score').textContent = text('score', state.correct, state.qs.length);
      return;
    }
    $('quiz-progress').textContent = `${state.index + 1} / ${state.qs.length}`;
    $('quiz-question').textContent = state.qs[state.index];
  }

  function showStage() {
    $('quiz-play').hidden = state.done;
    $('quiz-result').hidden = !state.done;
  }

  function resetQuestion() {
    state.locked = false;
    $('quiz-input').value = '';
    $('quiz-input').disabled = false;
    $('quiz-feedback').textContent = '';
    $('quiz-feedback').className = 'study-feedback';
    $('quiz-submit').disabled = false;
    render();
  }

  function open() {
    if (!state.qs) return;
    $('quiz-dialog').hidden = false;
    if (!state.done) $('quiz-input').focus();
  }

  function close() {
    $('quiz-dialog').hidden = true;
  }

  function start(qs) {
    clearTimeout(state.timer);
    Object.assign(state, { qs, index: 0, correct: 0, done: false });
    $('btn-quiz').hidden = false;
    showStage();
    resetQuestion();
    open();
  }

  function end() {
    clearTimeout(state.timer);
    state.qs = null;
    $('btn-quiz').hidden = true;
    close();
  }

  function submit() {
    const value = $('quiz-input').value.trim();
    if (state.locked || state.done || !value) return;
    state.locked = true;
    $('quiz-input').disabled = true;
    $('quiz-submit').disabled = true;
    send({ t: 'answer', i: state.index, v: value });
  }

  // 서버가 채점한 결과가 오면 보여 주고 다음 문제로 넘어간다.
  function result(msg) {
    if (!state.qs || state.done || msg.i !== state.index) return;
    if (msg.ok) state.correct += 1;
    $('quiz-feedback').textContent = msg.ok ? text('right') : text('wrong', msg.answer);
    $('quiz-feedback').className = `study-feedback ${msg.ok ? 'right' : 'wrong'}`;
    if (msg.ok) sound.ding();
    else sound.pop();
    state.timer = setTimeout(() => {
      state.index += 1;
      if (state.index < state.qs.length) {
        resetQuestion();
        $('quiz-input').focus();
        return;
      }
      state.done = true;
      showStage();
      render();
      sound.fanfare();
      onFinish();
    }, msg.ok ? RIGHT_DELAY : WRONG_DELAY);
  }

  $('quiz-submit').onclick = submit;
  $('quiz-close').onclick = close;
  $('btn-quiz').onclick = () => ($('quiz-dialog').hidden ? open() : close());
  $('quiz-input').onkeydown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      submit();
    }
  };
  addEventListener('keydown', (e) => {
    if (e.key === 'Escape') close();
  });

  render();
  return { start, end, result, render };
}
