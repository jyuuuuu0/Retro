import { Suspense } from "react";
import { LoginButton } from "@/components/LoginButton";

const ERRORS: Record<string, string> = {
  auth: "로그인에 실패했어요. 다시 시도해 주세요.",
  token: "GitHub 연결이 만료됐어요. 다시 로그인해 주세요.",
};

async function ErrorMessage({ searchParams }: { searchParams: PageProps<"/login">["searchParams"] }) {
  const { error, bye } = await searchParams;
  if (bye) return <p className="muted">탈퇴가 완료됐어요. 계정과 회고, GitHub 토큰이 모두 삭제됐어요.</p>;
  const message = typeof error === "string" ? ERRORS[error] : undefined;
  return message ? <p className="error-text">{message}</p> : null;
}

export default function LoginPage(props: PageProps<"/login">) {
  return (
    <main className="login">
      <div className="login-box">
        <div className="logo logo-lg">
          retro<span className="logo-dot" />
        </div>
        <h1 className="login-title">
          오늘 올린 PR,
          <br />
          5분이면 회고 끝.
        </h1>
        <p className="muted login-sub">GitHub로 로그인하면 오늘 만든 PR이 레포 상관없이 한 번에 모여요.</p>
        <Suspense>
          <ErrorMessage searchParams={props.searchParams} />
        </Suspense>
        <LoginButton />
        <p className="muted login-note">private 레포 PR까지 불러오기 위해 repo 권한을 요청해요. 회고는 이 사이트에만 저장돼요.</p>
      </div>
    </main>
  );
}
