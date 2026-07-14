# PLOG(game-diary-2) 보안 점검 요청 프롬프트

아래 프롬프트를 그대로 다른 AI/바이브 코딩 에이전트에게 전달해 주세요.

---

당신은 Next.js/Vercel/Supabase/NextAuth/Discord OAuth 기반 웹 서비스의 보안 점검을 돕는 시니어 보안 리뷰어입니다.

대상 서비스는 배포형 웹 서비스입니다.

- 서비스 URL: https://game-diary-2.vercel.app/
- 서비스명: 플로그(PLOG) - 우리들의 게임 일기장
- 주요 기능 추정: Discord 로그인 기반 게임 일기/통계/프로필/푸시 알림
- 배포 환경 추정: Vercel
- 프레임워크 추정: Next.js App Router
- 인증 추정: NextAuth + Discord OAuth
- DB/백엔드 추정: Supabase
- 푸시 알림 추정: Firebase Cloud Messaging

## 중요한 원칙

실제 운영 서비스일 수 있으므로 파괴적/공격적 테스트를 하지 마세요.

금지:
- 계정 탈취 시도
- 권한 없는 DB 조회/수정/삭제
- 대량 요청/부하 테스트
- 크리덴셜 탈취 시도
- 실제 사용자 데이터 접근
- 서비스 중단 유발
- 무차별 스캔
- 허가 없는 침투 공격

허용:
- 코드 리뷰
- 설정 리뷰
- 보안 헤더 점검
- 인증/인가 로직 검토
- Supabase RLS 정책 검토
- 환경변수 노출 여부 검토
- API route 권한 검증 코드 검토
- 테스트 계정이 있다면 안전한 범위의 권한 분리 테스트
- 보완 코드 제안

## 1차 공개 점검에서 관찰된 내용

아래는 외부에서 안전하게 확인한 1차 결과입니다. 이 결과를 바탕으로 코드/설정을 더 깊게 점검해 주세요.

### 기본 페이지

- `/` 접근 가능
- 타이틀: `플로그(PLOG) - 우리들의 게임 일기장`
- 메인 CTA: `디스코드로 시작하기`
- 네비게이션: 홈, 일기장, 통계, 로그인

### 로그인/접근 제어

비로그인 상태에서:

- `/diary` → `/auth/signin?callbackUrl=%2Fdiary`로 리다이렉트
- `/stats` → `/auth/signin?callbackUrl=%2Fstats`로 리다이렉트

즉, 화면 단위 기본 인증 보호는 동작하는 것으로 보입니다.

### NextAuth 공개 API

확인된 엔드포인트:

- `/api/auth/session` → `{}` 반환
- `/api/auth/csrf` → CSRF 토큰 반환
- `/api/auth/providers` → Discord provider 정보 반환

쿠키 설정은 대체로 양호해 보였습니다.

관찰된 쿠키 속성:

- `HttpOnly`
- `Secure`
- `SameSite=Lax`
- `__Host-next-auth.csrf-token`
- `__Secure-next-auth.callback-url`

### Discord OAuth

로그인 클릭 시 Discord OAuth로 이동했습니다.

확인된 scope:

```text
identify email
```

이메일 수집이 꼭 필요하지 않다면 `email` scope 제거를 검토해 주세요.

### 보안 헤더

루트 페이지 응답 기준으로 확인된 보안 헤더:

있음:

```text
Strict-Transport-Security: max-age=63072000; includeSubDomains; preload
```

없거나 확인되지 않음:

```text
Content-Security-Policy
X-Frame-Options
X-Content-Type-Options
Referrer-Policy
Permissions-Policy
```

Vercel/Next.js 환경에서 위 보안 헤더를 추가하는 방안을 제안해 주세요.

### 프론트엔드 번들에서 관찰된 정보

프론트엔드 JS 번들에서 아래 흔적이 보였습니다.

- Supabase URL 노출
- Supabase 테이블명으로 보이는 `profiles`
- `NEXT_PUBLIC_FIREBASE_VAPID_KEY`
- Firebase 관련 API 사용 흔적
- NextAuth/Auth.js 관련 코드
- Discord signIn 코드

중요:
Supabase URL, anon key, public Firebase VAPID key는 프론트엔드에 노출될 수 있는 정보입니다. 하지만 RLS/권한 정책이 잘못되어 있으면 심각한 문제가 됩니다.

## 우선 점검해야 할 핵심 항목

### 1. Supabase RLS(Row Level Security)

가장 중요합니다.

아래 항목을 확인해 주세요.

- public schema 내 사용자 데이터 테이블의 RLS가 모두 켜져 있는가?
- `profiles` 테이블 RLS가 켜져 있는가?
- 일기/게임/통계/서버/멤버십 관련 테이블이 있다면 RLS가 켜져 있는가?
- SELECT/INSERT/UPDATE/DELETE 정책이 `auth.uid()` 또는 서버 검증 기준으로 안전하게 제한되어 있는가?
- 다른 유저의 일기/통계/프로필을 읽거나 수정할 수 없는가?
- `service_role` key가 절대 클라이언트 번들에 포함되지 않는가?
- Supabase anon key만 클라이언트에 노출되어 있는가?

점검 SQL 예시:

```sql
select schemaname, tablename, rowsecurity
from pg_tables
where schemaname = 'public'
order by tablename;
```

정책 예시:

```sql
-- 자기 프로필만 조회
create policy "Users can read own profile"
on profiles
for select
using (auth.uid() = id);

-- 자기 프로필만 수정
create policy "Users can update own profile"
on profiles
for update
using (auth.uid() = id)
with check (auth.uid() = id);
```

만약 Discord user id를 별도로 쓰는 구조라면, `auth.uid()`와 Discord id 매핑 방식도 안전한지 검토해 주세요.

### 2. API Route / Server Action 권한 검증

Next.js API route, route handler, server action 전체를 확인해 주세요.

모든 민감 작업에서 다음이 보장되어야 합니다.

- 세션 확인
- 사용자 ID 확인
- DB 쿼리 시 현재 사용자 소유 데이터만 접근
- 관리자 기능은 role/allowlist 검증
- 클라이언트에서 넘어온 `userId`, `profileId`, `guildId`를 그대로 신뢰하지 않기

권장 패턴:

```ts
const session = await auth();

if (!session?.user?.id) {
  return Response.json({ error: "Unauthorized" }, { status: 401 });
}
```

DB 접근 시:

```ts
.where('user_id', session.user.id)
```

또는 Supabase RLS로 강제.

### 3. Discord OAuth 설정

확인할 것:

- `redirect_uri`가 정확한 운영 도메인만 허용되어 있는가?
- callback URL이 와일드카드/로컬/테스트 도메인까지 열려 있지 않은가?
- `NEXTAUTH_URL` 또는 `AUTH_URL`이 운영 URL로 정확히 설정되어 있는가?
- `NEXTAUTH_SECRET` 또는 `AUTH_SECRET`이 충분히 강하고 노출되지 않았는가?
- email scope가 정말 필요한가?
- Discord access token/refresh token을 DB에 저장한다면 암호화/최소 저장/만료 처리가 되어 있는가?

### 4. 환경변수/시크릿 노출

확인할 것:

- `.env`, `.env.local`, Vercel env에 있는 secret이 클라이언트 번들에 포함되지 않는가?
- `NEXT_PUBLIC_` prefix가 붙은 값만 클라이언트에 노출되어도 되는 값인가?
- Supabase `service_role` key가 클라이언트 코드에서 절대 import되지 않는가?
- Discord client secret이 클라이언트 번들에 없는가?
- Firebase server key가 클라이언트 번들에 없는가?
- 로그에 토큰/세션/개인정보가 찍히지 않는가?

검색 예시:

```bash
rg -n "service_role|SUPABASE_SERVICE|DISCORD_CLIENT_SECRET|NEXTAUTH_SECRET|AUTH_SECRET|private_key|password|token|secret" .
```

### 5. 보안 헤더 추가

Next.js `next.config.js` 또는 Vercel 설정에 보안 헤더 추가를 제안해 주세요.

초기 예시:

```js
const securityHeaders = [
  {
    key: "Content-Security-Policy",
    value: [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: https:",
      "font-src 'self' data:",
      "connect-src 'self' https://*.supabase.co https://discord.com https://*.googleapis.com https://fcmregistrations.googleapis.com https://firebaseinstallations.googleapis.com",
      "frame-ancestors 'none'",
      "base-uri 'self'",
      "form-action 'self'",
    ].join('; '),
  },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
];
```

주의:
`unsafe-inline`, `unsafe-eval`은 가능하면 줄이는 것이 좋지만, Next.js/개발 환경에서 바로 제거하면 깨질 수 있으므로 단계적으로 적용해 주세요.

### 6. 입력값 검증/XSS

점검할 것:

- 게임 일기 본문/제목/댓글/닉네임 입력값 검증
- React에서 사용자 입력을 `dangerouslySetInnerHTML`로 출력하지 않는지
- markdown/HTML 렌더링이 있다면 sanitize 적용 여부
- URL 입력값이 있다면 open redirect, javascript: URL 방지
- 파일/이미지 업로드가 있다면 MIME/크기/확장자 검증

### 7. CSRF / SameSite / 상태 변경 요청

NextAuth CSRF는 동작하는 것으로 보이나, 자체 API route도 확인해야 합니다.

- POST/PATCH/DELETE가 인증 없이 실행되지 않는가?
- SameSite=Lax만으로 충분한가?
- 중요한 상태 변경은 CSRF 또는 same-origin 검증이 있는가?
- CORS가 불필요하게 `*`로 열려 있지 않은가?

외부 점검에서는 HTML 응답에 `access-control-allow-origin: *`가 보였습니다. API에도 필요한지/안전한지 확인해 주세요.

### 8. Rate Limit / Abuse 방어

게임 일기 서비스라면 다음이 필요할 수 있습니다.

- 로그인 시도/콜백 abuse 방어
- 일기 생성/수정/삭제 API rate limit
- 푸시 토큰 등록 API rate limit
- Discord webhook/bot 연동 API가 있다면 서명 검증
- Vercel Edge Middleware 또는 Upstash Rate Limit 적용 검토

### 9. Firebase Cloud Messaging

프론트 번들에 `NEXT_PUBLIC_FIREBASE_VAPID_KEY`가 보였습니다. 이는 public key 성격이라 노출 가능하지만, 아래를 확인해 주세요.

- FCM token 저장 테이블 RLS
- 유저가 타인의 FCM token을 읽거나 수정할 수 없는지
- 알림 발송 서버 키가 클라이언트에 없는지
- 푸시 수신 동의/철회 처리
- 로그에 FCM token을 남기지 않기

### 10. 개인정보/약관/운영

서비스가 Discord email을 수집한다면 개인정보 처리방침과 실제 수집 항목이 일치해야 합니다.

확인할 것:

- 이메일을 수집하는지
- Discord ID, username, avatar, guild 정보 저장 여부
- 게임 일기 내용 보관/삭제 정책
- 회원 탈퇴 시 데이터 삭제 정책
- 개인정보 처리방침에 실제 수집 항목 반영

## 요청하는 최종 결과물

아래 형식으로 보고서를 작성해 주세요.

```markdown
# PLOG 보안 점검 보고서

## 1. 요약
- 전체 위험도:
- 가장 중요한 보완점 3개:

## 2. 확인한 범위
- 코드/설정/DB 정책/환경변수/배포 설정 중 무엇을 확인했는지
- 확인하지 못한 범위

## 3. 발견 이슈

### 이슈 1. [제목]
- 심각도: Critical / High / Medium / Low
- 위치: 파일명/설정/URL
- 설명:
- 위험:
- 재현/확인 방법:
- 권장 수정:
- 수정 예시 코드:

## 4. Supabase RLS 점검 결과
- RLS ON/OFF 테이블 목록
- 위험한 정책
- 권장 정책 SQL

## 5. API 권한 검증 결과
- 보호된 API
- 취약한 API
- 수정 필요 코드

## 6. 보안 헤더 제안
- next.config.js 또는 vercel.json 수정안

## 7. 개인정보/OAuth 점검
- Discord scope 평가
- email 수집 필요성
- 개인정보 처리방침 반영 여부

## 8. 우선순위 액션 플랜
1. 오늘 바로 할 것
2. 이번 주 안에 할 것
3. 배포 전 최종 점검
```

## 최종 목표

단순히 “문제 있어요”라고 말하지 말고, 개발자가 바로 수정할 수 있게:

- 어떤 파일을 봐야 하는지
- 어떤 설정을 바꿔야 하는지
- 어떤 SQL 정책을 넣어야 하는지
- 어떤 코드 패턴을 고쳐야 하는지
- 배포 후 어떻게 검증해야 하는지

까지 구체적으로 제안해 주세요.

---

## 추가 체크리스트

가능하면 아래도 확인해 주세요.

- [ ] `npm audit` 또는 `pnpm audit` 결과
- [ ] Next.js/Auth.js/Supabase 패키지 버전 취약점
- [ ] `.env*` 파일 git 커밋 여부
- [ ] Vercel Preview Deployment에 민감 기능 노출 여부
- [ ] source map 공개 여부
- [ ] 에러 페이지에 stack trace 노출 여부
- [ ] 관리자 페이지/테스트 페이지가 배포되어 있지 않은지
- [ ] `/api/*` route 목록과 인증 여부
- [ ] DB delete/update 작업에 소유자 검증이 있는지
- [ ] Discord callback/open redirect 검증
