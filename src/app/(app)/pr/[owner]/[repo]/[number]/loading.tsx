export default function Loading() {
  return (
    <div aria-busy="true" aria-label="불러오는 중">
      <div className="skeleton" style={{ width: 160, height: 16, marginBottom: 14 }} />
      <div className="skeleton" style={{ width: "60%", height: 34, marginBottom: 12 }} />
      <div className="skeleton" style={{ width: 260, height: 20, marginBottom: 28 }} />
      <div className="write-grid">
        <div className="skeleton" style={{ height: 480, borderRadius: 16 }} />
        <div className="skeleton" style={{ height: 560, borderRadius: 16 }} />
      </div>
    </div>
  );
}
