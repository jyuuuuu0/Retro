import { addDays, weekday } from "@/lib/date";

const CELL = 19; // 15px 칸 + 4px 간격

function level(n: number) {
  if (n <= 0) return "";
  if (n === 1) return "l1";
  if (n === 2) return "l2";
  if (n <= 4) return "l3";
  return "l4";
}

/** 깃허브 잔디처럼 최근 53주를 일요일 시작 열로 그린다. */
export function Heatmap({ counts, today }: { counts: Map<string, number>; today: string }) {
  const lastSunday = addDays(today, -weekday(today));
  const start = addDays(lastSunday, -52 * 7);
  const end = addDays(lastSunday, 6);

  const cells: { date: string; n: number; future: boolean }[] = [];
  const months: { label: string; col: number }[] = [];
  let col = 0;
  let lastMonth = "";
  for (let d = start; d <= end; d = addDays(d, 1)) {
    if (weekday(d) === 0) {
      const m = d.slice(5, 7);
      if (m !== lastMonth && Number(d.slice(8, 10)) <= 7) {
        if (col < 52) months.push({ label: `${Number(m)}월`, col });
        lastMonth = m;
      }
      col++;
    }
    cells.push({ date: d, n: counts.get(d) ?? 0, future: d > today });
  }

  return (
    <div className="heat-scroll">
      <div className="gh">
        <div className="wd" aria-hidden="true">
          <span />
          <span>월</span>
          <span />
          <span>수</span>
          <span />
          <span>금</span>
          <span />
        </div>
        <div>
          <div className="months" aria-hidden="true">
            {months.map((m) => (
              <span key={`${m.label}-${m.col}`} style={{ left: (m.col - 1) * CELL }}>
                {m.label}
              </span>
            ))}
          </div>
          <div className="hm" role="img" aria-label="최근 1년 날짜별 회고 수">
            {cells.map((c) => (
              <i
                key={c.date}
                className={`cell ${c.future ? "future" : level(c.n)}`}
                title={c.future ? undefined : `${c.date} · 회고 ${c.n}개`}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export function HeatLegend() {
  return (
    <span className="legend">
      적음&nbsp;
      <i className="cell" />
      <i className="cell l1" />
      <i className="cell l2" />
      <i className="cell l3" />
      <i className="cell l4" />
      &nbsp;많음
    </span>
  );
}
