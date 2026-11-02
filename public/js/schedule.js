// 모두가 같은 시계로 움직이는 40분 수업 + 10분 쉬는 시간 반복.
// 게시판의 시간표와 칠판의 날짜는 교실 소품으로만 쓴다.

const CLASS_MINUTES = 40;
const BREAK_MINUTES = 10;

export const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];

export const TIMETABLE = [
  ['국어', '수학', '과학', '체육', '음악', '창체'],
  ['수학', '영어', '사회', '국어', '미술', '미술'],
  ['과학', '국어', '체육', '수학', '창체', '동아리'],
  ['영어', '사회', '수학', '음악', '국어', '도덕'],
  ['국어', '체육', '사회', '과학', '수학', '창체'],
];

export function kstNow(now = Date.now()) {
  const shifted = new Date(now + 9 * 3600 * 1000);
  return {
    month: shifted.getUTCMonth() + 1,
    date: shifted.getUTCDate(),
    day: shifted.getUTCDay(),
    hour: shifted.getUTCHours(),
    minute: shifted.getUTCMinutes(),
    second: shifted.getUTCSeconds(),
  };
}

// speed를 60으로 주면 40초 + 10초로 돌아 시험해 보기 쉽다.
export function currentPeriod(now = Date.now(), speed = 1) {
  const classLength = (CLASS_MINUTES * 60000) / speed;
  const cycle = ((CLASS_MINUTES + BREAK_MINUTES) * 60000) / speed;
  const count = Math.floor(now / cycle);
  const elapsed = now - count * cycle;
  const inClass = elapsed < classLength;
  const left = inClass ? classLength - elapsed : cycle - elapsed;
  const remaining = speed === 1 ? `${Math.ceil(left / 60000)}분` : `${Math.ceil(left / 1000)}초`;
  const kind = inClass ? 'class' : 'break';
  return {
    kind,
    key: `${kind}-${count}`,
    label: `${inClass ? '수업 시간' : '쉬는 시간'} · ${remaining} 남음`,
  };
}
