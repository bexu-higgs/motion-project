import {Config} from '@remotion/cli/config';

Config.setVideoImageFormat('jpeg');
Config.setJpegQuality(95);
// h264 / CRF / pixel format are passed by `npm run render` so audio-only
// renders (`--codec=wav`) keep working.
Config.setOverwriteOutput(true);
Config.setEntryPoint('src/index.ts');

// Optional: point Remotion at an already-installed Chromium instead of letting
// it download Chrome Headless Shell (useful in offline or sandboxed machines).
if (process.env.REMOTION_BROWSER_EXECUTABLE) {
	Config.setBrowserExecutable(process.env.REMOTION_BROWSER_EXECUTABLE);
}
