import { Suspense } from "react";
import { Nav } from "@/components/Nav";
import { getSession } from "@/lib/session";

async function NavLoader() {
  const { profile } = await getSession();
  return <Nav login={profile.github_login} avatarUrl={profile.avatar_url} />;
}

function NavShell() {
  return (
    <nav className="nav">
      <span className="logo">
        retro<span className="logo-dot" />
      </span>
    </nav>
  );
}

function PageSkeleton() {
  return (
    <div aria-busy="true" aria-label="불러오는 중">
      <div className="skeleton" style={{ width: 120, height: 16, marginBottom: 14 }} />
      <div className="skeleton" style={{ width: 280, height: 40, marginBottom: 32 }} />
      <div className="skeleton" style={{ height: 120, marginBottom: 16, borderRadius: 16 }} />
      <div className="skeleton" style={{ height: 96, marginBottom: 12, borderRadius: 16 }} />
      <div className="skeleton" style={{ height: 96, borderRadius: 16 }} />
    </div>
  );
}

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Suspense fallback={<NavShell />}>
        <NavLoader />
      </Suspense>
      <main className="wrap">
        <Suspense fallback={<PageSkeleton />}>{children}</Suspense>
      </main>
    </>
  );
}
