# 모바일 인증 설정

Capacitor 앱은 Discord 로그인을 시스템 브라우저에서 완료한 뒤, 일회성 인가 코드를
`POST /api/mobile/auth/exchange`로 교환합니다. NextAuth 브라우저 쿠키를 앱 WebView에
복사하지 않습니다.

## 필요한 환경 변수

- `NEXTAUTH_URL`: 배포된 웹 서비스의 HTTPS 주소입니다. 예: `https://example.com`
- `MOBILE_APP_LINK_BASE_URL`: iOS Universal Link와 Android App Link에 연결할 HTTPS 주소입니다.
  예: `https://example.com`
- `MOBILE_APP_ORIGINS`: 선택 사항입니다. Capacitor 기본 origin 외에 허용할 origin을 쉼표로 구분합니다.

`MOBILE_APP_LINK_BASE_URL`은 앱 링크 연결 파일을 제공해야 합니다.

- `/.well-known/apple-app-site-association`
- `/.well-known/assetlinks.json`

## 앱 흐름

1. 앱이 `POST /api/mobile/auth/request`에 `{ "platform": "ios" | "android" }`를 보냅니다.
2. 응답의 `authorizationUrl`을 Capacitor Browser에서 엽니다. `state`는 앱의 암호화 저장소에 보관합니다.
3. Discord 로그인이 끝나면 앱 링크가 `code`와 `state`를 포함해 앱을 다시 엽니다.
4. 앱은 `POST /api/mobile/auth/exchange`에 코드와 state를 보내 access/refresh 토큰을 받습니다.
5. access 토큰은 `Authorization: Bearer <accessToken>`으로 보내고, 만료 시 refresh API로 두 토큰을 교체합니다.

access와 refresh 토큰은 앱의 암호화 저장소에만 보관해야 합니다. 일반 localStorage에는 저장하지 마세요.

## 모바일 일기 조회 API

모바일 앱은 Supabase에 직접 연결하지 않고 access 토큰으로 아래 API를 호출합니다.

- `GET /api/mobile/diary?limit=20&cursor=...`: 로그인한 사용자가 참여한 세션의 요약 목록
- `GET /api/mobile/diary/:sessionId`: 참여가 확인된 세션의 상세 데이터

두 API 모두 `Authorization: Bearer <accessToken>` 헤더가 필요합니다. 목록 응답의
`nextCursor`가 있으면 다음 목록 요청의 `cursor`로 전달합니다.
