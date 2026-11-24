// 모든 날짜는 한국 시간(Asia/Seoul) 기준 'YYYY-MM-DD' 문자열로 다룬다.
export const TZ = "Asia/Seoul";
const KST_OFFSET = "+09:00";

const ymd = new Intl.DateTimeFormat("en-CA", {
  timeZone: TZ,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

export function toKstDate(input: string | Date): string {
  return ymd.format(typeof input === "string" ? new Date(input) : input);
}

export function kstToday(): string {
  return toKstDate(new Date());
}

export function isValidDate(s: string | undefined | null): s is string {
  return !!s && /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(`${s}T00:00:00${KST_OFFSET}`));
}

/** 'YYYY-MM-DD'에 n일을 더한다 (달력 계산이라 UTC로 해도 안전) */
export function addDays(date: string, n: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

export function weekday(date: string): number {
  return new Date(`${date}T00:00:00Z`).getUTCDay();
}

const WEEKDAYS = ["일요일", "월요일", "화요일", "수요일", "목요일", "금요일", "토요일"];

export function formatDay(date: string): string {
  const [, m, d] = date.split("-").map(Number);
  return `${m}월 ${d}일 ${WEEKDAYS[weekday(date)]}`;
}

export function formatDayShort(date: string): string {
  const [, , d] = date.split("-").map(Number);
  return `${d}일 ${WEEKDAYS[weekday(date)]}`;
}

export function formatYearMonth(date: string): string {
  const [y, m] = date.split("-").map(Number);
  return `${y}년 ${m}월`;
}

/** GitHub 검색용 KST 하루 범위 */
export function kstDayRange(date: string): string {
  return `${date}T00:00:00${KST_OFFSET}..${date}T23:59:59${KST_OFFSET}`;
}

/** KST 날짜의 시작 시각(ISO, UTC) */
export function kstStartIso(date: string): string {
  return new Date(`${date}T00:00:00${KST_OFFSET}`).toISOString();
}
