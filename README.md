# motion-project

Бұл Instagram-ға арналған моушн-дизайн видео жобасы: **«AI видео генерациялау»**. Бұл Higgsfield-те алғашқы AI видеоны жасауға арналған қазақша сабақ. Формат 9:16, 1080×1920, 30 fps, ≈ 2:45.

* Сценарий мен таймлайн: [`script/storyboard.md`](script/storyboard.md)
* Диктор мәтіні (бекітілген): [`script/voiceover_kk.txt`](script/voiceover_kk.txt)
* Субтитрлер: `script/captions_kk.srt` (`npm run prepare-assets` генерациялайды)
* Түсірілім тізімі мен промпттар: [`capture/SHOTLIST.md`](capture/SHOTLIST.md)

## Қалай жұмыс істейді

Видео кадрлап рендерленеді. `src/` ішіндегі HTML композицияда әр элемент уақыттың таза функциясы, сондықтан Playwright әр кадрды дәл осы уақытқа «секіріп» скриншот алады, ал ffmpeg кадрларды MP4-ке жинайды.

```
src/lesson.json        мәтін: сахналар, диктор жолдары, промпттар, тапсырма
src/scenes.js          9 сахнаның анимациясы
src/engine.js          easing, медиа слоттары, промпт терілуі
project.config.json    нақты жазбалар, логотип, аудио, модель атауы, баптаулар
tools/capture.mjs      Higgsfield интерфейсін жазу (курсормен, 30 fps)
tools/align.py         субтитрлер мен сахналарды дикторға синхрондау
tools/prepare.mjs      жазбаларды кадр тізбегіне айналдыру + manifest + SRT
tools/render.mjs       кадрлап рендер → out/higgsfield-ai-video-kk.mp4
```

## Командалар

```bash
npm install
npm run preview          # http://127.0.0.1:5173/ : ойнату, уақыт жолағы (?t=42)
npm run stills           # бақылау кадрлары → out/stills/
python3 tools/align.py   # assets/audio/voiceover.* бойынша уақытты есептеу
npm run check            # финалға дайындықты тексеру
npm run render           # → out/higgsfield-ai-video-kk.mp4
```

Талаптар: Node 18+, ffmpeg, Python 3 + numpy (тек `align.py` үшін), Chromium (Playwright табады немесе `CHROME_PATH`).

## Финалға не керек

Барлық материал орнында болғанда ғана финал рендерленеді (`npm run check`). Әзірге жоқ материалдың орнында сары **DRAFT** белгісі тұрады, ол тек жұмыс нұсқасына арналған.

1. `assets/audio/voiceover.wav` (немесе mp3/m4a): автордың қазақша дауысы, видеодағы жалғыз аудио.
2. `assets/brand/higgsfield-logo.svg`: ресми логотип.
3. `assets/captures/*.mp4` және `assets/media/start-frame.jpg`: Higgsfield-тің нақты интерфейс жазбалары мен генерациялары ([тізім](capture/SHOTLIST.md)).
4. `project.config.json`: таңдалған модельдің нақты атауы мен баптаулары (тек интерфейсте көрінетін мәндер).
