// Толық сценарий: екі адам тіркеліп, бір бөлмеде бейнені бірге көреді, чатта сөйлеседі.
// Іске қосу: npm run build:web && npm run e2e   (Playwright және ffmpeg керек)
import { spawn, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

// Playwright жобаға тәуелділік ретінде емес, жүйеге орнатылған болуы мүмкін (NODE_PATH).
const { chromium } = createRequire(import.meta.url)('playwright');

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const artifacts = path.join(root, 'e2e', 'artifacts');
mkdirSync(artifacts, { recursive: true });
const PORT = Number(process.env.E2E_PORT ?? 4010);
const BASE = `http://127.0.0.1:${PORT}`;
const dataDir = mkdtempSync(path.join(tmpdir(), 'birge-e2e-'));

function assert(condition, message) {
  if (!condition) throw new Error(`Assertion failed: ${message}`);
  console.log(`  ✓ ${message}`);
}

function testVideo() {
  if (process.env.TEST_VIDEO) return process.env.TEST_VIDEO;
  const file = path.join(dataDir, 'test-movie.webm');
  const res = spawnSync('ffmpeg', [
    '-y', '-loglevel', 'error',
    '-f', 'lavfi', '-i', 'testsrc2=size=640x360:rate=25:duration=30',
    '-f', 'lavfi', '-i', 'sine=frequency=440:duration=30',
    '-c:v', 'libvpx', '-b:v', '600k', '-c:a', 'libopus', '-shortest', file,
  ]);
  if (res.status !== 0) throw new Error('ffmpeg is required to generate the test video (or set TEST_VIDEO)');
  return file;
}

async function startServer() {
  const dist = path.join(root, 'apps/server/dist/index.js');
  const args = existsSync(dist) ? [dist] : [path.join(root, 'node_modules/.bin/tsx'), path.join(root, 'apps/server/src/index.ts')];
  const child = spawn(process.execPath, args, {
    env: {
      ...process.env,
      NODE_ENV: 'test',
      PORT: String(PORT),
      HOST: '127.0.0.1',
      PUBLIC_URL: BASE,
      DATA_DIR: dataDir,
      WEB_DIST: path.join(root, 'apps/app/dist'),
      DEV_OTP: '1',
      LOG_LEVEL: 'warn',
      ...(process.env.E2E_LIVEKIT_URL
        ? { LIVEKIT_URL: process.env.E2E_LIVEKIT_URL, LIVEKIT_API_KEY: 'devkey', LIVEKIT_API_SECRET: 'secret_secret_secret_secret_secret' }
        : {}),
    },
    stdio: ['ignore', 'inherit', 'inherit'],
  });
  for (let i = 0; i < 100; i++) {
    try {
      if ((await fetch(`${BASE}/api/health`)).ok) return child;
    } catch {
      // сервер әлі іске қосылып жатыр
    }
    await new Promise((r) => setTimeout(r, 200));
  }
  child.kill();
  throw new Error('server did not start');
}

async function signUp(page, { channel, target, name }) {
  await page.goto(BASE);
  await page.getByTestId(`sign-in-${channel}`).waitFor();
  await page.screenshot({ path: path.join(artifacts, `${name}-01-sign-in.png`) });
  await page.getByTestId(`sign-in-${channel}`).click();
  await page.getByTestId('contact-input').fill(target);
  const [response] = await Promise.all([
    page.waitForResponse((r) => r.url().includes('/api/auth/otp/request')),
    page.getByTestId('send-code').click(),
  ]);
  const { devCode } = await response.json();
  assert(/^\d{6}$/.test(devCode), `${name}: received a 6-digit code by ${channel}`);
  await page.getByTestId('code-input').fill(devCode);
  await page.getByTestId('display-name').waitFor();
  await page.screenshot({ path: path.join(artifacts, `${name}-02-onboarding.png`) });
  await page.getByTestId('display-name').fill(name);
  await page.getByTestId('accept-terms').click();
  await page.getByTestId('onboarding-submit').click();
  await page.getByTestId('create-room').waitFor();
  assert(true, `${name}: signed up and accepted the terms`);
}

const videoTime = (page) => page.evaluate(() => document.querySelector('video[data-testid="media-video"]')?.currentTime ?? -1);
const videoPaused = (page) => page.evaluate(() => document.querySelector('video[data-testid="media-video"]')?.paused ?? null);

const openPages = [];

async function main() {
  const video = testVideo();
  const server = await startServer();
  const browser = await chromium.launch({
    args: ['--autoplay-policy=no-user-gesture-required', '--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream'],
  });
  try {
    // Әсем — ноутбукта, қазақ тілінде; Dana — телефонда, ағылшын тілінде.
    const hostCtx = await browser.newContext({ locale: 'kk-KZ', viewport: { width: 1440, height: 900 } });
    const guestCtx = await browser.newContext({ locale: 'en-US', viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
    const host = await hostCtx.newPage();
    const guest = await guestCtx.newPage();
    for (const [name, page] of [['host', host], ['guest', guest]]) {
      openPages.push([name, page]);
      page.on('pageerror', (err) => console.error(`[${name} pageerror]`, err.message));
      page.on('console', (msg) => msg.type() === 'error' && console.error(`[${name} console]`, msg.text()));
      page.on('requestfailed', (req) => console.error(`[${name} requestfailed]`, req.url(), req.failure()?.errorText));
    }

    console.log('1. Sign up');
    await signUp(host, { channel: 'email', target: 'asem@example.kz', name: 'Әсем' });
    await signUp(guest, { channel: 'phone', target: '+7 701 555 12 34', name: 'Dana' });
    assert((await host.textContent('body')).includes('Сәлем, Әсем!'), 'host sees the Kazakh UI');
    assert((await guest.textContent('body')).includes('Hi, Dana!'), 'guest sees the English UI');

    console.log('2. Create a room and join it by code');
    await host.getByTestId('create-room').click();
    await host.getByTestId('room-name').fill('Жұма кинокеші');
    await host.getByTestId('create-room-submit').click();
    await host.getByTestId('room-title').waitFor();
    assert((await host.getByTestId('room-title').textContent()) === 'Жұма кинокеші', 'host is inside the new room');
    const meta = await host.locator('text=/· [A-Z2-9]{6}$/').first().textContent();
    const code = meta.trim().slice(-6);
    assert(/^[A-Z2-9]{6}$/.test(code), `room code is ${code}`);

    await guest.getByTestId('join-code').fill(code);
    await guest.getByTestId('join-submit').click();
    await guest.getByTestId('room-title').waitFor();
    assert(true, 'guest joined the room by code');

    console.log('3. Host uploads a movie');
    await host.getByTestId('header-add-media').click();
    await host.getByTestId('media-tab-upload').click();
    const [chooser] = await Promise.all([host.waitForEvent('filechooser'), host.getByTestId('media-pick').click()]);
    await chooser.setFiles(video);
    await host.waitForSelector('video[data-testid="media-video"]');
    await guest.waitForSelector('video[data-testid="media-video"]');
    assert(true, 'both players loaded the uploaded movie');

    console.log('4. Synchronised playback');
    await host.getByTestId('play-pause').click();
    await host.waitForTimeout(5000);
    const [t1, t2] = await Promise.all([videoTime(host), videoTime(guest)]);
    console.log(`     host=${t1.toFixed(2)}s guest=${t2.toFixed(2)}s`);
    assert(t1 > 2 && t2 > 2, 'both videos are playing');
    assert(Math.abs(t1 - t2) < 1, 'players are within 1 second of each other');
    await host.screenshot({ path: path.join(artifacts, 'host-03-room-playing.png') });
    await guest.screenshot({ path: path.join(artifacts, 'guest-03-room-playing.png') });

    // Әкімші ойнату жолағының ортасына басады — қонақ та сол жерге секіреді.
    const bar = await host.getByTestId('seek-bar').boundingBox();
    await host.mouse.click(bar.x + bar.width * 0.6, bar.y + bar.height / 2);
    await guest.waitForTimeout(2500);
    const [s1, s2] = await Promise.all([videoTime(host), videoTime(guest)]);
    console.log(`     after seek host=${s1.toFixed(2)}s guest=${s2.toFixed(2)}s`);
    assert(s1 > 16 && s2 > 16 && Math.abs(s1 - s2) < 1, 'seeking moves everyone to the same moment');

    console.log('5. Chat');
    await guest.getByTestId('chat-input').fill('Сәлем! Great movie 🍿');
    await guest.getByTestId('chat-send').click();
    await host.getByText('Сәлем! Great movie 🍿').waitFor({ timeout: 5000 });
    assert(true, 'host received the guest message');
    await host.getByTestId('chat-input').fill('Керемет, жалғастырайық');
    await host.keyboard.press('Enter');
    await guest.getByText('Керемет, жалғастырайық').waitFor({ timeout: 5000 });
    assert(true, 'guest received the host message (Enter sends on desktop)');

    console.log('6. Only admins control playback');
    assert((await guest.getByTestId('play-pause').count()) === 0, 'guest has no play/pause button');
    await host.getByTestId('play-pause').click();
    await guest.waitForTimeout(2000);
    assert((await videoPaused(guest)) === true, 'pausing on host pauses the guest');

    console.log('7. People list and moderation tools');
    await guest.getByTestId('tab-people').click();
    await guest.getByTestId('member-Әсем').click();
    await guest.getByTestId('action-report').waitFor();
    await guest.waitForTimeout(600);
    await guest.screenshot({ path: path.join(artifacts, 'guest-04-member-actions.png') });
    await guest.getByTestId('action-report').click();
    await guest.getByTestId('reason-spam').click();
    await guest.waitForTimeout(600);
    await guest.screenshot({ path: path.join(artifacts, 'guest-05-report.png') });
    await guest.keyboard.press('Escape');

    await host.getByTestId('invite').click();
    await host.getByTestId('room-code').waitFor();
    await host.waitForTimeout(600);
    await host.screenshot({ path: path.join(artifacts, 'host-04-invite.png') });
    assert((await host.getByTestId('room-code').textContent()) === code, 'invite sheet shows the room code');

    console.log('7b. Deep links');
    const direct = await hostCtx.newPage();
    await direct.goto(host.url());
    await direct.getByTestId('room-title').waitFor();
    assert(true, 'opening a room URL directly (full page load) reconnects to the room');
    await direct.close();

    // Үшінші адам шақыру сілтемесін ашады: алдымен тіркеледі, содан кейін бөлмеге қосылады.
    const thirdCtx = await browser.newContext({ locale: 'kk-KZ', viewport: { width: 1280, height: 800 } });
    const third = await thirdCtx.newPage();
    openPages.push(['third', third]);
    await third.goto(`${BASE}/join/${code}`);
    await third.getByTestId('sign-in-email').click();
    await third.getByTestId('contact-input').fill('erlan@example.kz');
    const [otp] = await Promise.all([
      third.waitForResponse((r) => r.url().includes('/api/auth/otp/request')),
      third.getByTestId('send-code').click(),
    ]);
    await third.getByTestId('code-input').fill((await otp.json()).devCode);
    await third.getByTestId('display-name').fill('Ерлан');
    await third.getByTestId('accept-terms').click();
    await third.getByTestId('onboarding-submit').click();
    await third.getByTestId('join-confirm').click();
    await third.getByTestId('room-title').waitFor();
    assert(true, 'an invite link survives sign-up and lands in the room');
    await host.getByText('Ерлан бөлмеге кірді').waitFor({ timeout: 5000 });
    assert(true, 'host sees the "joined" notice in Kazakh');
    await thirdCtx.close();

    console.log('8. Settings, language and legal pages');
    const settings = await hostCtx.newPage();
    openPages.push(['settings', settings]);
    if (process.env.E2E_DEBUG) settings.on('response', (r) => r.url().includes('/api/') && console.log('   [settings]', r.status(), r.request().method(), r.url(), Boolean(r.request().headers().authorization)));
    await settings.goto(`${BASE}/settings`);
    await settings.getByTestId('delete-account').waitFor();
    assert((await settings.getByTestId('settings-name').inputValue()) === 'Әсем', 'settings form is filled after a full page load');
    await settings.screenshot({ path: path.join(artifacts, 'host-05-settings-kk.png'), fullPage: true });
    await settings.getByTestId('lang-en').click();
    await settings.getByText('App language').waitFor();
    assert(true, 'switching the language to English updates the UI');
    await settings.getByTestId('lang-kk').click();
    await settings.goto(`${BASE}/delete-account`);
    await settings.getByTestId('web-delete-account').waitFor();
    assert(true, 'web account deletion page is reachable (Google Play requirement)');
    await settings.goto(`${BASE}/privacy`);
    await settings.getByText('Құпиялылық саясаты').first().waitFor();
    await settings.screenshot({ path: path.join(artifacts, 'host-06-privacy-kk.png') });

    console.log('9. Account deletion');
    const guestSettings = await guestCtx.newPage();
    guestSettings.on('dialog', (d) => d.accept());
    await guestSettings.goto(`${BASE}/settings`);
    await guestSettings.getByTestId('delete-account').click();
    await guestSettings.getByTestId('sign-in-email').waitFor({ timeout: 10_000 });
    assert(true, 'guest deleted the account and was signed out');

    console.log('\nAll e2e checks passed. Screenshots: e2e/artifacts/');
  } catch (err) {
    for (const [name, page] of openPages) {
      await page.screenshot({ path: path.join(artifacts, `failure-${name}.png`) }).catch(() => undefined);
    }
    throw err;
  } finally {
    await browser.close();
    server.kill();
    rmSync(dataDir, { recursive: true, force: true });
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
