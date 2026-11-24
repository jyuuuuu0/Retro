# retro.

그날 올린 GitHub PR별로 회고를 남기는 **개인용 데일리 도구**.

- 오늘(또는 고른 날) 내가 만든 PR을 레포 상관없이 한 번에 불러온다 (KST 기준)
- PR 옆에 커밋·변경 파일·받은 리뷰를 띄워 놓고 회고 작성: 한 줄 요약 / 배운 점 / 막힌 점 & 해결 / 다음엔 이렇게 / 만족도 / 태그
- 입력이 멈추면 자동 저장, 내용을 모두 지우면 '미작성'으로 돌아감
- 기록: 깃허브식 회고 잔디, 연속 작성일, 검색·기간·레포·태그·만족도 필터

## 스택

Next.js 16 (App Router, Cache Components) · Supabase (Auth, Postgres) · GitHub REST API (Octokit)

## 구조

```
src/
  proxy.ts                         # 세션 갱신 + 로그인 안 했으면 /login 으로
  app/
    login/                         # GitHub 로그인
    auth/callback/route.ts         # OAuth 코드 교환, GitHub 토큰 저장
    actions.ts                     # saveRetro, signOut (서버 액션)
    (app)/page.tsx                 # 오늘 화면  (?date=YYYY-MM-DD, ?sort=pending)
    (app)/pr/[owner]/[repo]/[number]  # 회고 작성
    (app)/records/                 # 기록 (잔디 + 필터 목록)
  components/                      # Nav, RetroForm, Heatmap …
  lib/
    github.ts                      # 내 PR 검색, PR 상세
    date.ts                        # KST 날짜 유틸
    retros.ts                      # 연속 작성일 계산 등
supabase/migrations/0001_init.sql  # profiles, retros 테이블 + RLS
```

## 처음 설정

### 1. Supabase

1. [supabase.com](https://supabase.com)에서 새 프로젝트를 만든다 (리전: Northeast Asia (Seoul)).
2. **SQL Editor**에서 `supabase/migrations/` 안의 SQL 파일을 번호 순서대로 실행한다.
3. **Project Settings → API**에서 `Project URL`과 `anon public` 키를 복사해 둔다.

### 2. GitHub OAuth App

1. GitHub → Settings → Developer settings → **OAuth Apps → New OAuth App**
2. Homepage URL: `http://localhost:3000` (배포 후엔 배포 주소)
3. Authorization callback URL: `https://<프로젝트-ref>.supabase.co/auth/v1/callback`
4. 만들어진 **Client ID**와 **Client Secret**(Generate)을 복사한다.

### 3. Supabase에 GitHub 로그인 연결

1. **Authentication → Sign In / Providers → GitHub** 켜고 Client ID / Secret 입력
2. **Authentication → URL Configuration**
   - Site URL: `http://localhost:3000` (배포 후 배포 주소로 변경)
   - Redirect URLs에 `http://localhost:3000/auth/callback`, `https://<배포주소>/auth/callback` 추가

### 4. 실행

```bash
cp .env.example .env.local   # URL, anon key, TOKEN_ENCRYPTION_KEY 채우기
openssl rand -base64 32      # → TOKEN_ENCRYPTION_KEY 값
npm install
npm run dev
```

## 알아둘 것

- **GitHub 토큰**: Supabase는 `provider_token`을 로그인 직후에만 준다. 그래서 `/auth/callback`에서 **AES-256-GCM으로 암호화**해 `profiles.github_token`에 저장한다 (`src/lib/crypto.ts`, 키는 `TOKEN_ENCRYPTION_KEY`). 예전에 평문으로 저장된 토큰은 다음 접속 때 자동으로 암호화된다. 키를 바꾸면 모두 한 번 다시 로그인하면 된다.
- **탈퇴**: 설정 화면에서 `delete_my_account()` (Supabase 함수)를 호출해 계정·회고·토큰을 모두 지운다.
- **org 레포**: VOID나 학교 org처럼 OAuth 앱 접근 제한이 걸린 org는 org 설정에서 이 OAuth 앱을 승인해야 PR이 보인다.
- **날짜 기준**: GitHub 검색은 `created:YYYY-MM-DDT00:00:00+09:00..T23:59:59+09:00`로 KST 하루를 정확히 잡는다. 잔디·연속 작성일도 PR을 만든 날(KST) 기준.
- **권한 범위**: private 레포 PR까지 보려면 `repo` scope가 필요하다. 회고는 GitHub에 아무것도 쓰지 않는다.

## 배포 (Vercel)

1. 레포를 Vercel에 Import
2. Environment Variables에 `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `TOKEN_ENCRYPTION_KEY` 추가
3. 배포 주소를 GitHub OAuth App의 Homepage URL, Supabase Site URL / Redirect URLs에 반영

## 나중에 추가할 것

기획 문서의 "나중에 추가할 것" 참고 — 템플릿 커스텀, 리뷰한 PR 회고, 미작성 알림, 주간/월간 모아보기, Markdown 내보내기, AI 회고 질문 등.
