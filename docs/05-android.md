# Android-приложение и публикация в F-Droid

## Зачем это вообще

F-Droid распространяет только Android-приложения (APK), собранные из
исходников — готового веб-сайта для этого недостаточно. Open Poker — это
React-SPA + Socket.IO, поэтому для F-Droid он обёрнут в нативную
Android-оболочку через [Capacitor](https://capacitorjs.com/) (MIT-лицензия,
open source): `frontend/android/` — это настоящий Gradle-проект, который
просто показывает уже собранный фронтенд (`frontend/dist`) в WebView и
общается с сервером как обычно, через `wss://`/`https://`.

Важно: это **не** TWA (Trusted Web Activity) и не обёртка, завязанная на
Google Play Services — голый `android.webkit.WebView`, который есть в любой
прошивке Android, включая без-гугловые.

## Self-hosted по умолчанию

У приложения **нет зашитого сервера**. Это принципиальное решение, а не
недоделка: Open Poker — self-hosted-проект (см. `docs/04-deploy.md`), и
любой может поднять свой сервер для своей компании друзей. Поэтому:

- На главном экране в нативном приложении (и только в нём — см.
  `frontend/src/components/ServerSettings.tsx`, определяется через
  `Capacitor.isNativePlatform()`) есть кнопка **"⚙️ Адрес сервера"** —
  туда вводится адрес своего backend (`https://poker.example.com`).
- Адрес сохраняется в `localStorage` (`openpoker.backendUrlOverride`,
  см. `frontend/src/lib/backend.ts`) и переживает перезапуск приложения.
- В обычном вебе этой настройки нет и не нужно — там работает origin
  страницы/`VITE_BACKEND_URL`, как и раньше.

## Технические решения и реальные грабли

При сборке и ПОЛНОЙ живой проверке (реальный Android-эмулятор, реальный
backend, реальная WebSocket-раздача — не просто "gradle build прошёл")
нашлись два нюанса, которые стоит знать, прежде чем менять что-то здесь:

1. **`capacitor.config.ts` → `server.androidScheme: "http"`.** По
   умолчанию Capacitor отдаёт локальные ассеты по `https://localhost`.
   Тогда WebView блокирует как "Mixed Content" **любой** `http://`-запрос
   к серверу (даже если `usesCleartextTraffic=true` в манифесте — это
   разные механизмы: cleartext-permission разрешает http в принципе,
   mixed-content блокирует именно http-с-https-страницы). Раз сервер
   self-hosted и может быть поднят без TLS (небольшая домашняя сеть без
   реверс-прокси), ассеты тоже отдаются по `http://localhost` — тогда и
   `http://`, и `https://`/`wss://` бэкенды работают одинаково нормально
   (апгрейд с http на https никогда не блокируется).
2. **CORS на бэкенде разрешает фиксированные origin'ы нативного
   приложения всегда**, без дополнительной настройки (`backend/src/server.ts`,
   `NATIVE_APP_ORIGINS`). У обычного веб-фронтенда origin — это домен
   self-hoster'а (настраивается через `FRONTEND_ORIGIN`), а у нативного
   приложения origin фиксированный и одинаковый у всех инсталляций
   (`http://localhost` / `https://localhost` / `capacitor://localhost` для
   iOS) — он не зависит от домена конкретного сервера, поэтому его можно
   захардкодить в сам бэкенд раз и навсегда. `FRONTEND_ORIGIN` при этом
   можно указать списком через запятую, если нужно разрешить ещё и свой
   домен.

Если меняете `androidScheme` обратно на `https` — учтите (1): self-hosted
backend без TLS перестанет подключаться из приложения. Это осознанный
компромисс в пользу self-hosted-гибкости, а не недосмотр.

## Как собрать APK локально

```bash
cd frontend
npm run build                # обычная сборка веб-ассетов (vite build)
npx cap sync android         # копирует dist/ в android/app/src/main/assets/public
cd android
./gradlew assembleDebug      # или assembleRelease для релизной сборки
```

APK появится в `android/app/build/outputs/apk/debug/app-debug.apk`.
Реально собрано и проверено на Android-эмуляторе (arm64, API 34) в этой
среде: приложение запускается, подключается к реальному backend по
Socket.IO, раздаёт карты, принимает действия — полный цикл, не только
компиляция.

### Локальная разработка/тестирование

Если тестируете против backend без HTTPS в локальной сети (например,
`http://192.168.1.50:4000` с телефона или `http://10.0.2.2:4000` с
эмулятора Android, который видит так хост-машину) — `androidScheme: "http"`
уже всё решает, доп. настройка не нужна. `app/src/debug/AndroidManifest.xml`
с `usesCleartextTraffic="true"` добавлен **только для debug-сборок** (не
влияет на релизную/F-Droid-сборку) — дополнительная подстраховка на
случай, если где-то в будущем понадобится cleartext-permission отдельно
от mixed-content.

## Иконка и ассеты

Исходники — `frontend/assets/` (`icon.png`, `icon-foreground.png`,
`icon-background.png` для адаптивной иконки, `splash.png`). Все размеры
под Android сгенерированы официальным `@capacitor/assets`:

```bash
cd frontend
npx @capacitor/assets generate --android
```

## Публикация в F-Droid: чек-лист

F-Droid собирает APK **сам**, из исходников — наша задача только
подготовить метаданные. Подробный процесс:
[Submitting to F-Droid Quick Start Guide](https://f-droid.org/en/docs/Submitting_to_F-Droid_Quick_Start_Guide/).
Коротко, что уже сделано и что остаётся:

Сделано:
- [x] Публичный репозиторий + файл лицензии (`LICENSE`, AGPL-3.0-or-later)
- [x] Только FOSS-зависимости (Capacitor core, без Firebase/GMS/аналитики/рекламы)
- [x] Сборка полностью из командной строки (`./gradlew assembleRelease`),
      без шагов, требующих Android Studio
- [x] Метаданные листинга: `frontend/android/fastlane/metadata/android/{en-US,ru-RU}/`
      (описания, иконка, два реальных скриншота — главный экран и раздача
      за столом, сняты на настоящем эмуляторе)

Остаётся перед реальной подачей:
- [ ] Поставить git-тег на релизный коммит (`v1.0.0` и т.д.), сопоставленный
      с `versionName`/`versionCode` в `frontend/android/app/build.gradle`
- [ ] Решить вопрос с подписью релизной сборки (F-Droid предпочитает
      собирать APK сам и подписывать своим ключом; если хотите
      reproducible build со своим ключом разработчика — см.
      [Reproducible Builds](https://f-droid.org/en/docs/Reproducible_Builds/))
- [ ] Форкнуть [`fdroiddata`](https://gitlab.com/fdroid/fdroiddata),
      добавить `metadata/io.github.trawling.openpoker.yml` с рецептом
      сборки (репозиторий, коммит, `gradle: - assembleRelease`)
- [ ] Прогнать `fdroid lint` / `fdroid build` в их Docker-окружении
- [ ] Открыть merge request в `fdroiddata`

### Ожидаемые вопросы на ревью

- **"Приложение зависит от конкретного сервера?"** — Нет, сервер
  настраивается пользователем (см. выше), и сам сервер тоже открытый
  (AGPL-3.0) и self-hostable — см. `docs/04-deploy.md`. Это стоит явно
  указать в описании при подаче.
- **"Это азартная игра?"** — Нет реальных денег, фишки ничего не стоят
  вне игры (ключевой принцип всего проекта, см. `README.md`) — не
  подпадает под ограничения F-Droid на реальный гэмблинг.

## Структура файлов

```
frontend/
  capacitor.config.ts         — конфиг Capacitor (appId, androidScheme)
  assets/                     — исходники иконки/сплэша (до генерации размеров)
  android/                    — нативный Gradle-проект (коммитится в git;
                                 build/, local.properties, APK — в .gitignore)
    app/src/debug/AndroidManifest.xml — cleartext только для debug-сборок
    fastlane/metadata/android/ — описания, иконка, скриншоты для F-Droid/Play
  src/lib/backend.ts           — getBackendOverride/setBackendOverride
  src/components/ServerSettings.tsx — UI настройки адреса сервера (только native)

backend/src/server.ts          — CORS: NATIVE_APP_ORIGINS + FRONTEND_ORIGIN
```
