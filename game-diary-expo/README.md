# PLOG Expo

Figma 기준의 iOS·Android 화면을 React Native로 구현하는 Expo 앱입니다. 기존 `game-diary-web`은 데스크톱 웹과 API 서버 역할을 유지합니다.

## 시작

1. `.env.example`을 `.env.local`로 복사하고 `EXPO_PUBLIC_API_BASE_URL`에 웹 서비스의 HTTPS 주소를 입력합니다.
2. `npm run start`
3. 화면 디자인 확인은 터미널의 QR 코드를 Expo Go로 열거나 `npm run ios`, `npm run android`을 사용합니다.

Discord 로그인처럼 고정된 콜백 주소가 필요한 기능은 Expo Go가 아닌 개발 빌드에서 검증합니다. 서버의 `MOBILE_APP_LINK_BASE_URL`과 앱 링크를 연결한 뒤, 개발 빌드에는 `plog://mobile/auth/callback`, 운영 앱에는 HTTPS Universal Links / Android App Links를 사용합니다.

## 주요 명령

```sh
npm run start
npm run ios
npm run android
npx tsc --noEmit
```

앱 ID, 아이콘, 스플래시 이미지는 스토어 등록 전에 `app.json`에서 확정합니다.
