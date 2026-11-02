export const QUESTION_COUNT = 10;

function shuffle(list) {
  for (let i = list.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [list[i], list[j]] = [list[j], list[i]];
  }
  return list;
}

// dan이 2~9면 그 단만, 0이면 전체에서 섞어 낸다. 같은 문제가 연달아 나오지 않게 한다.
export function makeQuestions(dan) {
  const pool = [];
  for (const a of dan ? [dan] : [2, 3, 4, 5, 6, 7, 8, 9]) {
    for (let b = 1; b <= 9; b++) pool.push({ a, b, answer: a * b });
  }
  const questions = shuffle([...pool]).slice(0, QUESTION_COUNT);
  while (questions.length < QUESTION_COUNT) {
    const last = questions[questions.length - 1];
    const extra = pool[Math.floor(Math.random() * pool.length)];
    if (extra !== last) questions.push(extra);
  }
  return questions;
}

export function resultMessage(correct) {
  if (correct === QUESTION_COUNT) return '모두 맞았어요! 구구단 박사님이에요!';
  if (correct >= 8) return '정말 잘했어요!';
  if (correct >= 5) return '잘했어요! 조금만 더 해 볼까요?';
  return '끝까지 푼 것이 멋져요! 한 번 더 해 봐요!';
}
