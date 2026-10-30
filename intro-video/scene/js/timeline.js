// Timeline of the first segment (0–10.5 s) of the intro.
// Phrase times come from tools/voice.py (scene/js/cues.js), so every
// animation stays locked to the narration when the voice is regenerated.
"use strict";

const FPS = 30;
const DURATION = 10.5;

const C = window.VO_CUES;
const at = (phrase, frac) => C[phrase][0] + (C[phrase][1] - C[phrase][0]) * frac;

const CUE = {
  // "Мен — Оралбекқызы Айназ."
  men: C.men[0],
  surname: C.name[0],
  firstname: at("name", 0.6),
  nameEnd: C.name[1],
  // "Екі мың төртінші жылы, қыркүйектің екісі,"
  year: C.year[0],
  yearLand: at("year", 0.62),
  month: C.month[0],
  monthDay: at("month", 0.56),
  monthEnd: C.month[1],
  // "Алматы облысы,"
  oblast: C.oblast[0],
  oblastEnd: C.oblast[1],
  // "Кеген ауданы,"
  district: C.district[0],
  districtEnd: C.district[1],
  // "Кеген ауылында өмірге келдім."
  village: C.village[0],
  born: C.born[0],
  voEnd: C.born[1],
};

// The map takes over while "екісі" is still being said.
const MAP_IN = CUE.monthEnd - 0.1;

// Map camera keyframes: [time the view is reached, view, easing into it].
const CAMERA = [
  [MAP_IN, "kzWide", null],
  [CUE.oblast + 0.3, "kz", "outCubic"],
  [CUE.district + 0.02, "oblast", "inOutCubic"],
  [CUE.districtEnd - 0.06, "district", "inOutCubic"],
  [CUE.born - 0.15, "village", "inOutQuart"],
  [DURATION, "villageClose", "outSine"],
];

window.TL = { FPS, DURATION, CUE, MAP_IN, CAMERA };
