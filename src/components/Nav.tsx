"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "@/app/actions";

export function Nav({ login, avatarUrl }: { login: string | null; avatarUrl: string | null }) {
  const path = usePathname();
  const onRecords = path.startsWith("/records");

  return (
    <nav className="nav">
      <Link href="/" className="logo" aria-label="retro 홈">
        retro<span className="logo-dot" />
      </Link>
      <Link href="/" className="nav-link" aria-current={!onRecords ? "page" : undefined}>
        오늘
      </Link>
      <Link href="/records" className="nav-link" aria-current={onRecords ? "page" : undefined}>
        기록
      </Link>
      <div className="nav-spacer" />
      <div className="nav-user">
        {login && (
          <>
            <span className="mono muted" style={{ fontSize: 13 }}>
              @{login}
            </span>
            <form action={signOut}>
              <button type="submit" className="link-btn">
                로그아웃
              </button>
            </form>
          </>
        )}
        {avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={avatarUrl} alt="" className="avatar" />
        ) : (
          <span className="avatar" />
        )}
      </div>
    </nav>
  );
}
