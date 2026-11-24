import type { PRState } from "@/lib/github";

const LABEL: Record<PRState, string> = { open: "Open", merged: "Merged", closed: "Closed" };

export function StateBadge({ state }: { state: PRState }) {
  return (
    <span className="badge">
      <i className={`dot dot-${state}`} aria-hidden="true" />
      {LABEL[state]}
    </span>
  );
}

export function Diff({ add, del }: { add: number; del: number }) {
  return (
    <>
      <span className="mono add">+{add}</span>
      <span className="mono del">−{del}</span>
    </>
  );
}
