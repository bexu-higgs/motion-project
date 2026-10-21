// Master timing. All scene choreography is aligned to the narration:
// voice-over sentence boundaries were measured with ffmpeg silencedetect and
// are given here in voice-over time; the VO starts VO_OFFSET into the video.
export const VO_OFFSET = 0.6;
export const FPS = 30;
export const DURATION = 88;
export const W = 1080, H = 1920;

// Converts a voice-over timestamp to video time.
export const V = (t) => t + VO_OFFSET;

// Scene windows in video time.
export const SCENES = [
  [0, 6.65],
  [6.65, 15.95],
  [15.95, 25.85],
  [25.85, 38.1],
  [38.1, 51.8],
  [51.8, 61.0],
  [61.0, 75.05],
  [75.05, DURATION],
];

// Sound-effect cues, registered by scenes while they build. The audio
// script reads this list, so picture and sound always share one timeline.
export const CUES = [];
export function cue(t, type, opts = {}) {
  CUES.push({ t: Math.round(t * 1000) / 1000, type, ...opts });
}
