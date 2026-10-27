# App Store және Google Play талаптарына сәйкестік

Бұл құжат Birge-дің дүкендер ережелерін қалай орындайтынын және тексеруге жіберерде консольдерде нені толтыру
керегін көрсетеді. Ережелер жиі жаңарады — жіберер алдында ресми нұсқаларын қайта қараңыз:
[App Store Review Guidelines](https://developer.apple.com/app-store/review/guidelines/),
[Google Play Developer Policy Center](https://play.google.com/about/developer-content-policy/).

## 1. Ережелер → іске асырылуы

| Талап | Қалай орындалған | Қайда |
|---|---|---|
| **Apple 4.8 — Login Services.** Google арқылы кіру болса, Sign in with Apple да болуы керек | iOS-та нативті «Sign in with Apple» батырмасы; Google батырмасы iOS-та тек Apple бапталғанда ғана көрінеді | `apps/app/src/app/sign-in/index.tsx`, `components/AppleButton.ios.tsx` |
| **Apple HIG** — Apple батырмасының ресми түрі | `AppleAuthenticationButton` (iOS), қара батырма (Android/Web) | `components/AppleButton*.tsx` |
| **Apple 5.1.1(v) — аккаунтты қосымша ішінде жою** | Баптаулар → «Аккаунтты жою»: профиль, сессиялар, хабарламалар, ашқан бөлмелер, жүктелген файлдар өшіріледі | `app/settings.tsx`, `server/src/accounts.ts` |
| **Apple — Sign in with Apple токенін қайтарып алу** | Аккаунт жойылғанда `appleid.apple.com/auth/revoke` шақырылады; refresh-токен AES-GCM-мен шифрланып сақталады | `server/src/auth/oauth.ts` |
| **Google Play — Account deletion** (қосымшада және вебте) | Қосымшада + `https://<домен>/delete-account` беті (кірмей-ақ нұсқаулығы көрінеді) | `app/delete-account.tsx` |
| **Apple 1.2 / Google UGC — пайдаланушы мазмұны** | ① Тіркелуде шарттарды (EULA) міндетті қабылдау, «қолайсыз мазмұнға мүлдем төзбейміз» деп жазылған; ② чатта балағат сүзгісі; ③ хабарламаға/адамға/бөлмеге шағым; ④ кез келген адамды бұғаттау (хабарламасы жасырылады, дауысы өшеді); ⑤ модераторлар беті: шағымдар, бұғаттау, бөлмені жабу; ⑥ әкімшілер хабарламаны өшіріп, адамды шығара алады; ⑦ байланыс поштасы | `onboarding.tsx`, `moderation/filter.ts`, `room/ReportSheet.tsx`, `app/moderation.tsx`, `routes/moderation.ts` |
| Шағымға 24 сағат ішінде әрекет ету | Шарттарда жазылған; `MODERATOR_EMAILS` иелері `/moderation` бетінде қарайды | `legal/content.ts` |
| **Apple 5.2.2 / 5.2.3, Google IP саясаты** — басқа сервистерден медиа жүктемеу | Қосымша ішінде сайттардан бейне суыратын браузер жоқ; YouTube тек ресми IFrame ойнатқышы арқылы, ойнатқыштың үстіне ештеңе жабылмайды; шарттарда құқық иесіне шағым жолы бар | `room/player/YouTubePlayer*.tsx`, `legal/content.ts` |
| **Apple 5.1.1(i) / Google — Privacy Policy** | Қосымшада (кіру беті, онбординг, баптаулар) және вебте `/privacy`, екі тілде | `legal/content.ts` |
| **Apple 5.1.1 — рұқсат сұрау** | Микрофон тек қолданушы «микрофонды қосу» батырмасын басқанда, алдын ала түсіндірме терезесінен кейін сұралады; мәтіні қазақша/ағылшынша | `app/room/[id].tsx`, `locales/*.json` |
| Қолданылмайтын рұқсаттар | Android: `CAMERA`, `SYSTEM_ALERT_WINDOW`, `READ/WRITE_EXTERNAL_STORAGE`, `READ_PHONE_STATE` манифесттен алынып тасталған; iOS-та Face ID жазбасы жоқ | `app.config.ts` |
| **Apple Privacy Manifest** | `NSPrivacyTracking=false`, жиналатын деректер мен «required reason API» тізімі | `app.config.ts → ios.privacyManifests` |
| **App Tracking Transparency** | Қадағалау (tracking) жоқ, жарнама/аналитика SDK жоқ → ATT терезесі керек емес | — |
| **Apple 2.5.4 — фондық режим** | `UIBackgroundModes: audio` — тек дауыстық чат пен музыканың экран сөнгенде үзілмеуі үшін | `app.config.ts` |
| Экспорттық шифрлау | Тек стандартты HTTPS/WebRTC → `ITSAppUsesNonExemptEncryption=false` | `app.config.ts` |
| **Apple 3.1.1 — төлемдер** | Қосымша тегін, ішкі сатылым да, сыртқы төлем сілтемесі де жоқ | — |
| **Apple 4.2 — минималды функционалдық** | Нативті ойнатқыш, дауыс, push-тен тыс толыққанды қосымша (веб-сайттың орамасы емес) | — |
| **Apple 2.1 — тексерушіге қолжетімділік** | `REVIEW_LOGINS` — тұрақты кодпен кіретін демо-аккаунт, SMS/хат жіберілмейді | `server/src/config.ts` |
| **Google — target API level** | Expo SDK 58 соңғы Android API деңгейіне бағытталған | — |
| **Google — Foreground service** | `FOREGROUND_SERVICE_MEDIA_PLAYBACK` (expo-video, фондық музыка) — Play Console-да декларация керек | төменде |
| **Тілдер** | Тек `kk` және `en`: iOS `CFBundleLocalizations`, Android `localeConfig` және `resourceConfigurations` | `app.config.ts`, `expo-localization` плагині |
| Жас шегі | Шарттар бойынша 16+, тіркелуде растау | `onboarding.tsx` |
| Деректер қауіпсіздігі | TLS; OTP кодтары мен сессия токендері хэш түрінде; токен құрылғыда Keychain/Keystore-да (expo-secure-store), Android backup-қа түспейді | `auth/service.ts`, `lib/storage.ts` |
| ҚР дербес деректер заңы | Деректерді ҚР аумағындағы серверде сақтау ұсынылады (README) | `README.md` |

## 2. App Store Connect

**App Privacy («тамақ жапсырмасы»)** — барлығы *пайдаланушыға байланысты*, *tracking үшін емес*, мақсаты *App Functionality*:

| Санат | Түрі |
|---|---|
| Contact Info | Email Address, Phone Number, Name |
| Identifiers | User ID |
| User Content | Other User Content (чат хабарламалары, бөлме атаулары), Photos or Videos / Audio Data (тек әкімші жүктеген файлдар) |

Дауыс пен экран ағыны нақты уақытта ғана таратылады және сақталмайды — Apple анықтамасы бойынша «collected» емес.

**Age Rating:** User-Generated Content — Yes; Messaging and Chat — Yes; Unrestricted Web Access — No.
Ұсынылатын рейтинг — **16+** (шарттардағы жас шегімен сәйкес).

**Review Notes үлгісі:**

```
Demo account: review@birge.example.kz — tap "Continue with email", enter the address, then code 246810
(no email is sent for this account). A test room with a sample video: code ABC123.
Voice chat: tap the microphone icon in the room header. Browser-tab sharing is a desktop-web-only feature.
Moderation: users can report/block from the message or person menu; reports are reviewed within 24 h.
Account deletion: Settings → Delete account.
```

## 3. Google Play Console

- **App access:** жоғарыдағы демо-аккаунт.
- **Data safety:** Personal info — Name, Email, Phone number, User IDs; Messages — Other in-app messages;
  Photos and videos / Audio — тек пайдаланушы жүктеген файлдар. Барлығы: collected, not shared, encrypted in transit,
  users can request deletion. Дауыс — «processed ephemerally».
- **Account deletion URL:** `https://<домен>/delete-account`.
- **Content rating (IARC):** Users can interact / exchange content — Yes. Нәтижесі әдетте «Teen / 16+».
- **Target audience:** 16+ (балаларға арналмаған, Families бағдарламасына қатыспайды).
- **Foreground service (Android 14+):** `FOREGROUND_SERVICE_MEDIA_PLAYBACK` — «Music/audio continues playing in the
  background while the user listens together with friends»; қысқа бейне-түсіндірме жүктеу керек болуы мүмкін.
- **Ads:** No ads.
- **News / Government / Health** — қатысы жоқ.

## 4. Жариялау алдындағы тексеру тізімі

- [ ] `.env`: `SECRET`, `SMTP_URL`, (қажет болса) Twilio, Google, Apple, LiveKit мәндері толтырылды
- [ ] `docker compose up -d --build`, `https://<домен>/api/health` → `{"ok":true}`
- [ ] Google және Apple redirect URI-лері консольдерде тіркелді
- [ ] `EXPO_PUBLIC_OPERATOR_NAME` және заңды тұлға деректері құжаттарда дұрыс; заңгер қарап шықты
- [ ] `MODERATOR_EMAILS` және `SUPPORT_EMAIL` нақты, хаттарға жауап беріледі
- [ ] `REVIEW_LOGINS` демо-аккаунты және сынақ бөлмесі дайын
- [ ] EAS development build нақты iPhone мен Android-та тексерілді (дауыс, микрофон рұқсаты, фондық режим, YouTube)
- [ ] Дүкен беттері қазақша және ағылшынша толтырылды
