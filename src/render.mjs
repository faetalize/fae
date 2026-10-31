#!/usr/bin/env node
//render the dark pixel-art blob fairy as a transparent svg.
//usage: render.mjs awake|frantic|asleep|faces output [freeze_seconds]
import { readFileSync, writeFileSync } from "node:fs";

const [mood, output, freezeArg] = process.argv.slice(2);
//an optional third argument pauses the loop at that second, for checking single frames.
const FREEZE = Number(freezeArg ?? 0);
//FAIRY_COUNT is the contribution count her speech bubble reads out.
const COUNT = process.env.FAIRY_COUNT;
const counted = COUNT && `${COUNT} contrib${COUNT === "1" ? "" : "s"} today!`;
const WIDTH = 830;
const HEIGHT = 90;
const PX = 3;

//her pixels live in art/ under their own licence, so nothing here is covered by it or she by gpl.
//the mid violet outline is the one colour with enough contrast on both github themes.
const {
  colours: COLOURS,
  body: BODY,
  cheeks: CHEEKS,
  faces: FACES,
  wing: WING,
} = JSON.parse(readFileSync(new URL("../art/fae.json", import.meta.url), "utf8"));

const SPRITE_W = 31;
const BODY_X = 7;
const BODY_Y = 4;

const pixel = (x, y, ch, size) =>
  `<rect x="${x * size}" y="${y * size}" width="${size}" height="${size}" fill="${COLOURS[ch]}"/>`;

function drawRows(rows, offsetX, offsetY, size) {
  let out = "";
  rows.forEach((row, y) =>
    [...row].forEach((ch, x) => {
      if (ch !== ".") out += pixel(x + offsetX, y + offsetY, ch, size);
    }),
  );
  return out;
}

const mirrorRow = (row) => [...row].reverse().join("");

function wings(rows, y, size) {
  const right = rows.map(mirrorRow);
  return drawRows(rows, 0, y, size) + drawRows(right, SPRITE_W - rows[0].length, y, size);
}

//stamp the face onto the body, then drop rows to squash her without moving the features apart.
function body(face, dropped, offsetY, size) {
  const grid = BODY.map((row) => [...row]);
  for (const [x, y, ch] of [...CHEEKS, ...face]) grid[y][x] = ch;
  const rows = grid.filter((_, y) => !dropped.includes(y)).map((row) => row.join(""));
  return drawRows(rows, BODY_X, offsetY, size);
}

const ember = (colour) =>
  [
    [1, 0],
    [0, 1],
    [1, 1],
    [2, 1],
    [1, 2],
  ]
    .map(([x, y]) => `<rect x="${x * 2}" y="${y * 2}" width="2" height="2" fill="${colour}"/>`)
    .join("");

const zed = [
  [0, 0],
  [1, 0],
  [2, 0],
  [2, 1],
  [1, 2],
  [0, 3],
  [1, 3],
  [2, 3],
]
  .map(([x, y]) => `<rect x="${x * 3}" y="${y * 3}" width="3" height="3" fill="#9d8bc4"/>`)
  .join("");

//css easing curves, solved for progress at time u, so an ember lands exactly where she is.
//"in" has no slowdown at the end, which is what lets her hit the wall instead of parking at it.
const CURVES = { inOut: [0.42, 0, 0.58, 1], in: [0.42, 0, 1, 1] };

function eased(u, [x1, y1, x2, y2]) {
  const bezier = (a, b, t) => 3 * a * t * (1 - t) ** 2 + 3 * b * t ** 2 * (1 - t) + t ** 3;
  let [low, high] = [0, 1];
  for (let i = 0; i < 20; i++) {
    const mid = (low + high) / 2;
    if (bezier(x1, x2, mid) < u) low = mid;
    else high = mid;
  }
  return bezier(y1, y2, low);
}

//below this share of her top speed she counts as hovering.
const SLOW = 0.2;

function positionAt(stops, percent) {
  const end = stops.findIndex(([at]) => at >= percent);
  const [from, to] = [stops[Math.max(end - 1, 0)], stops[end]];
  const progress = eased((percent - from[0]) / (to[0] - from[0] || 1), CURVES[from[3] ?? "inOut"]);
  return [from[1] + (to[1] - from[1]) * progress, from[2] + (to[2] - from[2]) * progress];
}

const GLYPHS = {
  a: "010101111101101",
  b: "110101110101110",
  c: "011100100100011",
  d: "110101101101110",
  h: "101101111101101",
  i: "111010010010111",
  n: "110101101101101",
  o: "010101101101010",
  r: "110101110101101",
  s: "011100010001110",
  t: "111010010010010",
  y: "101101010010010",
  "!": "010010010000010",
  "+": "000010111010000",
  0: "111101101101111",
  1: "010110010010111",
  2: "110001010100111",
  3: "110001010001110",
  4: "101101111001001",
  5: "111100110001110",
  6: "111100111101111",
  7: "111001010010010",
  8: "111101111101111",
  9: "111101111001111",
};

function pixelText(line, x, y, colour) {
  let out = "";
  [...line].forEach((ch, i) =>
    [...(GLYPHS[ch] ?? "")].forEach((on, cell) => {
      if (on !== "1") return;
      const [cx, cy] = [x + i * 8 + (cell % 3) * 2, y + Math.floor(cell / 3) * 2];
      out += `<rect x="${cx}" y="${cy}" width="2" height="2" fill="${colour}"/>`;
    }),
  );
  return out;
}

//keyframes that switch something on during each window, in the loop's percentages. the inline
//opacity is its resting state, so reduced motion doesn't stack every face on top of each other.
const moments = [];

function timeline(windows, base = 0) {
  const name = `m${moments.length}`;
  const frames = windows.flatMap(([on, off]) => [`${on}%{opacity:${1 - base}}`, `${off}%{opacity:${base}}`]);
  moments.push(`@keyframes ${name}{0%{opacity:${base}}${frames.join("")}100%{opacity:${base}}}`);
  return `class="m" style="animation-name:${name};opacity:${base}"`;
}

const overlay = (cells) => cells.map(([x, y, ch]) => pixel(x + BODY_X, y + BODY_Y, ch, PX)).join("");

//she reads the mood out loud here, since nobody can guess that fast flapping means commits >_<
function bubble(line, x, y, on) {
  const [w, h] = [line.length * 8 + 12, 22];
  return (
    `<g ${on}><rect x="${x + 6}" y="${y}" width="${w}" height="${h}" fill="${COLOURS.d}" stroke="${COLOURS.o}" stroke-width="2"/>` +
    `<rect x="${x}" y="${y + 12}" width="6" height="4" fill="${COLOURS.o}"/>` +
    `${pixelText(line, x + 13, y + 6, COLOURS.L)}</g>`
  );
}

//embers stay where they were dropped and die there. letting them ride her path, even briefly,
//reads as one star chasing her. every is seconds between drops, life is how long each lasts.
//hit is when she reaches the wall and shaken when she's recovered, notice the span she stops to
//look at the visitor. all three are percentages of the loop, kept out of step with her flapping
//and bobbing so the same moments never line up the same way twice.
function flying(face, loop, flap, bob, every, life, stops, { hit, shaken, notice, says }) {
  const path = stops
    .map(([at, x, y, curve]) => `${at}%{transform:translate(${x}px,${y}px)${curve ? ";animation-timing-function:ease-in" : ""}}`)
    .join("");
  let trail = "";
  const count = Math.floor(loop / every);
  const velocityAt = (seconds) => {
    const at = (t) => positionAt(stops, ((t % loop) / loop) * 100);
    const [a, b] = [at(seconds), at(seconds + 0.02)];
    return [(b[0] - a[0]) / 0.02, (b[1] - a[1]) / 0.02];
  };
  const peak = Math.max(
    ...Array.from({ length: 400 }, (_, i) => Math.hypot(...velocityAt((i * loop) / 400))),
  );
  for (let i = 0; i < count; i++) {
    const at = i * every;
    const [x, y] = positionAt(stops, (at / loop) * 100);
    //dropped on a ring around her, since anything inside her outline is hidden by the sprite.
    //moving, they land opposite her heading so they trail her. near a turn her heading means
    //little and she'd otherwise stop shedding, so there they land anywhere on the ring.
    const [vx, vy] = velocityAt(at);
    const spread = (((i * 7) % 5) - 2) * 0.22;
    const moving = Math.hypot(vx, vy) > SLOW * peak;
    const angle = moving ? Math.atan2(-vy, -vx) + spread : i * 2.4;
    const px = Math.round(x + 14.5 * PX + Math.cos(angle) * 16.5 * PX);
    const py = Math.round(y + 10 * PX + Math.sin(angle) * 9.5 * PX);
    trail +=
      `<use href="#${i % 3 ? "g" : "r"}" class="t" x="${px}" y="${py}" ` +
      `style="animation-delay:${(at - loop - FREEZE).toFixed(2)}s"/>`;
  }
  const [, wallY] = positionAt(stops, hit);
  for (let i = 0; i < 7; i++) {
    const at = (hit / 100) * loop;
    trail +=
      `<use href="#${i % 2 ? "g" : "r"}" class="t" x="${WIDTH - 20 - i * 10}" y="${Math.round(wallY) + (i % 2 ? -6 - i : 60 + i)}" ` +
      `style="animation-delay:${(at - loop - FREEZE).toFixed(2)}s"/>`;
  }

  const step = (0.25 / loop) * 100;
  const pct = (n) => Number(n.toFixed(3));
  const blink = [pct(notice[0] + step), pct(notice[0] + step * 2)];
  const smile = [pct(notice[0] + step * 2), notice[1]];

  const look = stops
    .map(([at, x], i) => {
      const dx = (stops[i + 1]?.[1] ?? x) - x;
      return `${at}%{transform:translateX(${Math.abs(dx) < 3 ? 0 : Math.sign(dx) * PX}px)}`;
    })
    .join("");
  const act =
    `0%{transform:none}${hit}%{transform:scale(.72,1.18)}${pct(hit + step)}%{transform:scale(.86,1.08)}` +
    `${pct(hit + step * 2)}%{transform:translateX(-${PX}px)}${pct(hit + step * 3)}%{transform:translateX(${PX}px)}` +
    `${pct(hit + step * 4)}%{transform:translateX(-${PX}px)}${pct(hit + step * 5)}%{transform:none}100%{transform:none}`;

  const faceLayers =
    `<g ${timeline([[hit, shaken], blink, smile], 1)}><g class="l">${overlay(face)}</g></g>` +
    `<g ${timeline([[hit, shaken]])}>${overlay(FACES.frantic)}</g>` +
    `<g ${timeline([blink])}>${overlay(FACES.asleep)}</g>` +
    `<g ${timeline([smile])}>${overlay(FACES.happy)}</g>`;

  const [noticeX, noticeY] = positionAt(stops, notice[0]);
  const speech = bubble(says, Math.round(noticeX) + SPRITE_W * PX + 2, Math.round(noticeY) + 8, timeline([smile]));

  const delay = `animation-delay:-${FREEZE}s`;
  const lifePercent = ((life / loop) * 100).toFixed(2);
  const style =
    `@keyframes path{${path}}.p{animation:path ${loop}s ease-in-out infinite;${delay}}` +
    `.t{opacity:0;animation:spark ${loop}s linear infinite}` +
    `@keyframes spark{0%{opacity:1;transform:translateY(0)}${lifePercent}%{opacity:0;transform:translateY(6px)}100%{opacity:0}}` +
    //hopping a whole sprite pixel at a time keeps the motion reading as pixel art.
    `.b{animation:bob ${bob}s step-end infinite}@keyframes bob{0%{transform:translateY(0)}50%{transform:translateY(${PX}px)}}` +
    `.u{animation:up ${flap}s step-end infinite}.n{animation:down ${flap}s step-end infinite}` +
    `.u,.n,.b{${delay}}` +
    "@keyframes up{0%{opacity:1}50%{opacity:0}}@keyframes down{0%{opacity:0}50%{opacity:1}}" +
    `.m{animation-duration:${loop}s;animation-iteration-count:infinite;animation-timing-function:step-end;${delay}}` +
    `.l{animation:look ${loop}s step-end infinite;${delay}}@keyframes look{${look}}` +
    `.j{transform-origin:${SPRITE_W * PX}px ${12 * PX}px;animation:act ${loop}s step-end infinite;${delay}}@keyframes act{${act}}` +
    moments.join("");
  const defs = `<defs><g id="g">${ember("#b8902f")}</g><g id="r">${ember("#b3202a")}</g></defs>`;
  const art =
    defs +
    trail +
    `<g class="p"><g class="j"><g class="b"><g class="u">${wings(WING.up, WING.upY, PX)}</g>` +
    `<g class="n">${wings(WING.down, WING.downY, PX)}</g>${body([], [], BODY_Y, PX)}${faceLayers}</g></g></g>` +
    speech;
  return { style, art };
}

function sleeping() {
  const style =
    ".a{animation:a 3.2s step-end infinite}.c{animation:b 3.2s step-end infinite}" +
    "@keyframes a{0%{opacity:1}50%{opacity:0}}@keyframes b{0%{opacity:0}50%{opacity:1}}" +
    ".z{animation:rise 6s steps(10) infinite;opacity:0}" +
    "@keyframes rise{0%{transform:translate(0,0);opacity:0}15%{opacity:1}" +
    "80%{opacity:.8}100%{transform:translate(12px,-14px);opacity:0}}";
  const y = (rows) => Math.floor((HEIGHT - 4) / PX) - rows;
  const frame = (cls, dropped) => {
    const top = y(BODY.length - dropped.length);
    return `<g class="${cls}">${wings(WING.folded, top + 4, PX)}${body(FACES.asleep, dropped, top, PX)}</g>`;
  };
  const zeds = [-1.5, -3.5, -5.5]
    .map(
      (delay, i) =>
        `<g transform="translate(${100 + i * 9} ${44 - i * 6}) scale(${0.8 + i * 0.25})">` +
        `<g class="z" style="animation-delay:${delay}s">${zed}</g></g>`,
    )
    .join("");
  return { style, art: frame("a", [3, 4, 5]) + frame("c", [3, 4]) + zeds };
}

//each expression at reading size, since the real sprite is only about 90px wide.
function closeUps() {
  const size = 5;
  const art = ["awake", "frantic", "asleep"]
    .map((name, i) => {
      const wing = name === "asleep" ? wings(WING.folded, 7, size) : wings(WING.up, WING.upY, size);
      return `<g transform="translate(${50 + i * 260} 10)">${wing}${body(FACES[name], [], BODY_Y, size)}</g>`;
    })
    .join("");
  return { style: "", art };
}

const scenes = {
  awake: () =>
    flying(
      FACES.awake,
      60,
      0.32,
      0.9,
      0.5,
      1,
      [
        [0, 20, 6],
        [8, 300, 0, "in"],
        [16, 737, 14],
        [19, 737, 14],
        [23, 640, 8],
        [34, 320, 20],
        [40, 320, 20],
        [48, 320, 20],
        [60, 560, 2],
        [74, 700, 22],
        [86, 210, 2],
        [100, 20, 6],
      ],
      { hit: 16, shaken: 20, notice: [40, 48], says: counted ?? "hi!" },
    ),
  frantic: () =>
    flying(
      FACES.frantic,
      20,
      0.12,
      0.24,
      0.15,
      0.35,
      [
        [0, 10, 22],
        [6, 300, 0],
        [11, 150, 25, "in"],
        [15, 737, 10],
        [18, 737, 10],
        [21, 620, 4],
        [28, 330, 14],
        [30, 330, 14],
        [56, 330, 14],
        [62, 700, 0],
        [68, 390, 2],
        [74, 520, 25],
        [80, 100, 2],
        [87, 610, 20],
        [94, 250, 0],
        [100, 10, 22],
      ],
      { hit: 15, shaken: 18, notice: [30, 56], says: counted ?? "25+ contribs today!" },
    ),
  asleep: sleeping,
  faces: closeUps,
};

const { style, art } = scenes[mood]();
writeFileSync(
  output,
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${WIDTH} ${HEIGHT}" width="${WIDTH}" ` +
    `height="${HEIGHT}" shape-rendering="crispEdges" role="img" aria-label="A tiny dark fairy">` +
    `<style>${style}${freezeArg ? "*{animation-play-state:paused!important}" : ""}@media (prefers-reduced-motion:reduce){*{animation:none!important}}</style>${art}</svg>`,
);
