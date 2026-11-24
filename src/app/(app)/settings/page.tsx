import { Suspense } from "react";
import { DeleteAccount } from "@/components/DeleteAccount";
import { getSession } from "@/lib/session";

export default function SettingsPage() {
  return (
    <>
      <h1 className="page-title" style={{ marginBottom: 28 }}>
        설정
      </h1>
      <Suspense fallback={<div className="skeleton" style={{ height: 320, borderRadius: 16 }} />}>
        <SettingsContent />
      </Suspense>
    </>
  );
}

async function SettingsContent() {
  const { supabase, userId, profile } = await getSession();
  const { count } = await supabase
    .from("retros")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId);

  return (
    <div className="settings">
      <section className="card setting-card">
        <h2>계정</h2>
        <div className="setting-row">
          <span className="muted">GitHub</span>
          <a href={`https://github.com/${profile.github_login}`} target="_blank" rel="noreferrer" className="mono">
            @{profile.github_login}
          </a>
        </div>
        <div className="setting-row">
          <span className="muted">저장된 회고</span>
          <span>{count ?? 0}개</span>
        </div>
        <div className="setting-row">
          <span className="muted">GitHub 토큰</span>
          <span>암호화해서 저장 중</span>
        </div>
      </section>

      <section className="card setting-card danger">
        <h2>회원 탈퇴</h2>
        <p className="muted">
          계정, 저장된 회고 {count ?? 0}개, 암호화된 GitHub 토큰이 바로 삭제되고 되돌릴 수 없어요. GitHub에 있는 PR이나
          레포에는 아무 영향이 없어요.
        </p>
        <DeleteAccount />
        <p className="muted small">
          GitHub 쪽 앱 연결까지 끊으려면 탈퇴 후{" "}
          <a href="https://github.com/settings/applications" target="_blank" rel="noreferrer" className="underline">
            GitHub 설정 › Applications
          </a>
          에서 retro를 Revoke 하세요.
        </p>
      </section>
    </div>
  );
}
