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
tools/render.mjs       кадрлап рендер → out/higgsfield-ai-video-kk.mp4 (--sfx: дыбыс белгілерінің тізімі)
tools/audio.py         UI дыбыстары + фондық музыка (синтезделген) + дауыс → build/mix.wav
```

## Командалар

```bash
npm install
npm run preview          # http://127.0.0.1:5173/ : ойнату, уақыт жолағы (?t=42)
npm run stills           # бақылау кадрлары → out/stills/
python3 tools/align.py   # assets/audio/voiceover.* бойынша уақытты есептеу
npm run check            # финалға дайындықты тексеру
npm run render           # → out/higgsfield-ai-video-kk.mp4
npm run remux            # тек дыбысты қайта жинап, дайын видеоға салу
```

Талаптар: Node 18+, ffmpeg, Python 3 + numpy (тек `align.py` үшін), Chromium (Playwright табады немесе `CHROME_PATH`).

## Финал

Дайын видео: [`renders/higgsfield-ai-video-kk.mp4`](renders/higgsfield-ai-video-kk.mp4) (1080×1920, 30 fps, 2:49, H.264 + AAC стерео, ≈ −16 LUFS).

Дыбыс: автордың қазақша дауысы; әр басуда, теру кезінде, белгілер мен сахна ауысуларында UI дыбыстары; дауыс астында басылатын баяу тыныш музыка (Fmaj9–Cmaj7–Am9–G6, 68 BPM). Барлық эффект пен музыка `tools/audio.py` ішінде синтезделеді, лицензиялайтын дайын үлгі жоқ.
Субтитрлер: [`script/captions_kk.srt`](script/captions_kk.srt).

Материалдар: автордың қазақша дауысы (`assets/audio/`), ресми логотип (`assets/brand/`), Higgsfield-тің нақты интерфейс жазбалары мен автордың генерациялары (`assets/captures/`, [тізім](capture/SHOTLIST.md)), бастапқы фото (`assets/media/`).
Бір нәрсені өзгерткен соң: `npm run check && npm run render`.
