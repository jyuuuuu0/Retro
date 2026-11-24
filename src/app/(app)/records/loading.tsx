export default function Loading() {
  return (
    <div aria-busy="true" aria-label="불러오는 중">
      <h1 className="page-title" style={{ marginBottom: 28 }}>
        기록
      </h1>
      <div className="skeleton" style={{ height: 240, borderRadius: 16, marginBottom: 24 }} />
      <div className="skeleton" style={{ height: 42, borderRadius: 999, marginBottom: 32 }} />
      <div className="skeleton" style={{ height: 110, borderRadius: 16, marginBottom: 10 }} />
      <div className="skeleton" style={{ height: 110, borderRadius: 16 }} />
    </div>
  );
}
