"use client";

import { useEffect, useRef, useState, useTransition, type KeyboardEvent, type ReactNode } from "react";
import { saveRetro, type RetroInput } from "@/app/actions";

type Fields = Omit<RetroInput, "pr">;
type Status = "idle" | "saving" | "saved" | "error";

const TEXT_FIELDS: { key: "summary" | "learned" | "struggled" | "next_time"; label: string; hint?: string; placeholder: string; multiline: boolean }[] = [
  { key: "summary", label: "한 줄 요약", placeholder: "이 PR에서 한 일", multiline: false },
  { key: "learned", label: "배운 점", hint: "새로 알게 된 것, 써본 것", placeholder: "처음 써본 API, 알게 된 개념…", multiline: true },
  { key: "struggled", label: "막힌 점 & 해결", hint: "어디서 막혔고 어떻게 풀었는지", placeholder: "에러, 헤맨 부분, 해결 방법…", multiline: true },
  { key: "next_time", label: "다음엔 이렇게", hint: "다시 한다면 다르게 할 것", placeholder: "다음 PR에서 바꿔볼 것…", multiline: true },
];

const SAVE_DELAY = 800;

function timeAgo(iso: string) {
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  if (diff < 60) return "방금 저장됨";
  if (diff < 3600) return `${Math.floor(diff / 60)}분 전 저장됨`;
  return new Date(iso).toLocaleString("ko-KR", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" }) + " 저장됨";
}

export function RetroForm({
  header,
  side,
  pr,
  prUrl,
  nextSlot,
  initial,
  savedAt: initialSavedAt,
}: {
  header: ReactNode;
  side: ReactNode;
  pr: RetroInput["pr"];
  prUrl: string;
  nextSlot: ReactNode;
  initial: Fields;
  savedAt: string | null;
}) {
  const [fields, setFields] = useState<Fields>(initial);
  const [tagDraft, setTagDraft] = useState("");
  const [status, setStatus] = useState<Status>(initialSavedAt ? "saved" : "idle");
  const [savedAt, setSavedAt] = useState<string | null>(initialSavedAt);
  const [, startTransition] = useTransition();
  const dirty = useRef(false);

  function update<K extends keyof Fields>(key: K, value: Fields[K]) {
    dirty.current = true;
    setFields((f) => ({ ...f, [key]: value }));
  }

  // 입력이 멈추면 자동 저장
  useEffect(() => {
    if (!dirty.current) return;
    setStatus("saving");
    const t = setTimeout(() => {
      startTransition(async () => {
        const res = await saveRetro({ pr, ...fields });
        if (res.ok) {
          setSavedAt(res.savedAt);
          setStatus("saved");
        } else {
          setStatus("error");
        }
      });
    }, SAVE_DELAY);
    return () => clearTimeout(t);
  }, [fields, pr]);

  // 저장 전에 나가려 하면 경고
  useEffect(() => {
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      if (status === "saving") e.preventDefault();
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [status]);

  function addTag() {
    const t = tagDraft.trim().replace(/^#/, "");
    if (t && !fields.tags.includes(t)) update("tags", [...fields.tags, t]);
    setTagDraft("");
  }

  function onTagKey(e: KeyboardEvent<HTMLInputElement>) {
    if (e.nativeEvent.isComposing) return; // 한글 조합 중 Enter 무시
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      addTag();
    } else if (e.key === "Backspace" && !tagDraft && fields.tags.length) {
      update("tags", fields.tags.slice(0, -1));
    }
  }

  const statusText =
    status === "saving" ? "저장 중…" : status === "error" ? "저장 실패" : status === "saved" && savedAt ? timeAgo(savedAt) : "";

  return (
    <>
      <div className="write-top">
        {header}
        <div className="write-actions">
          <span className={`saved ${status}`} role="status" aria-live="polite">
            {statusText && <i aria-hidden="true" />}
            {statusText}
          </span>
          <a href={prUrl} target="_blank" rel="noreferrer" className="btn btn-ghost">
            GitHub에서 보기
          </a>
          {nextSlot}
        </div>
      </div>

      <div className="write-grid">
        {side}
        <form className="card form" onSubmit={(e) => e.preventDefault()}>
          {TEXT_FIELDS.map((f) => (
            <div className="field" key={f.key}>
              <label htmlFor={f.key}>{f.label}</label>
              {f.hint && <div className="hint">{f.hint}</div>}
              {f.multiline ? (
                <textarea
                  id={f.key}
                  className="input"
                  rows={3}
                  placeholder={f.placeholder}
                  value={fields[f.key]}
                  onChange={(e) => update(f.key, e.target.value)}
                />
              ) : (
                <input
                  id={f.key}
                  className="input"
                  placeholder={f.placeholder}
                  value={fields[f.key]}
                  onChange={(e) => update(f.key, e.target.value)}
                  autoFocus={!initial.summary}
                />
              )}
            </div>
          ))}

          <div className="form-bottom">
            <div className="field" style={{ margin: 0 }}>
              <span className="label" id="rating-label">
                만족도
              </span>
              <div className="stars" role="group" aria-labelledby="rating-label">
                {[1, 2, 3, 4, 5].map((n) => (
                  <button
                    key={n}
                    type="button"
                    className="star"
                    aria-pressed={fields.rating === n}
                    aria-label={`만족도 ${n}`}
                    onClick={() => update("rating", fields.rating === n ? null : n)}
                  >
                    {n}
                  </button>
                ))}
              </div>
            </div>
            <div className="field" style={{ margin: 0 }}>
              <label htmlFor="tag-input">태그</label>
              <div className="input tags-box">
                {fields.tags.map((t) => (
                  <span className="tag" key={t}>
                    {t}
                    <button type="button" aria-label={`${t} 태그 삭제`} onClick={() => update("tags", fields.tags.filter((x) => x !== t))}>
                      ×
                    </button>
                  </span>
                ))}
                <input
                  id="tag-input"
                  value={tagDraft}
                  placeholder={fields.tags.length ? "+ 추가" : "react, 상태관리… (Enter로 추가)"}
                  onChange={(e) => setTagDraft(e.target.value)}
                  onKeyDown={onTagKey}
                  onBlur={addTag}
                />
              </div>
            </div>
          </div>
        </form>
      </div>
    </>
  );
}
