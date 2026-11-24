"use client";

import { useRouter } from "next/navigation";

export function DatePicker({ date, today }: { date: string; today: string }) {
  const router = useRouter();
  return (
    <label className="date-picker">
      <span className="sr-only">날짜 고르기</span>
      <input
        type="date"
        value={date}
        max={today}
        onChange={(e) => {
          const v = e.target.value;
          if (v) router.push(v === today ? "/" : `/?date=${v}`);
        }}
      />
    </label>
  );
}
