(() => {
  "use strict";

  const canvas = document.querySelector("#artboard");
  const ctx = canvas.getContext("2d", { alpha: false });
  const frame = document.querySelector("#filmFrame");
  const progressBar = document.querySelector("#progressBar");
  const playButton = document.querySelector("#playButton");
  const replayButton = document.querySelector("#replayButton");
  const recordButton = document.querySelector("#recordButton");
  const fullscreenButton = document.querySelector("#fullscreenButton");
  const shell = document.querySelector(".stage-shell");
  const entryScreen = document.querySelector("#entryScreen");
  const galleryScreen = document.querySelector("#galleryScreen");
  const detailScreen = document.querySelector("#detailScreen");
  const enterButton = document.querySelector("#enterButton");
  const entrySeeds = [...document.querySelectorAll(".entry-seed")];
  const worldChoices = [...document.querySelectorAll(".world-choice")];
  const detailMotif = document.querySelector("#detailMotif");
  const detailNumber = document.querySelector("#detailNumber");
  const detailTitle = document.querySelector("#detailTitle");
  const detailMeta = document.querySelector("#detailMeta");
  const detailDescription = document.querySelector("#detailDescription");
  const sourceLink = document.querySelector("#sourceLink");
  const transitionBloom = document.querySelector("#transitionBloom");
  const backButton = document.querySelector("#backButton");
  const restartFromGallery = document.querySelector("#restartFromGallery");
  const immersiveButton = document.querySelector("#immersiveButton");
  const roomChoices = [...document.querySelectorAll(".room-choice")];
  const panoramaCanvas = document.querySelector("#panoramaCanvas");
  const panoramaCtx = panoramaCanvas.getContext("2d", { alpha: false });
  const panoramaCompass = document.querySelector("#panoramaCompass");
  const panoramaZoom = document.querySelector("#panoramaZoom");
  const zoomInButton = document.querySelector("#zoomInButton");
  const zoomOutButton = document.querySelector("#zoomOutButton");
  const soundtrack = document.querySelector("#soundtrack");
  soundtrack.volume = 0.72;

  const W = 1920;
  const H = 1080;
  const DURATION = 9;
  const previewParams = new URLSearchParams(window.location.search);
  const exportFrames = previewParams.has("exportFrames");
  const previewTime = previewParams.has("previewTime") ? Number(previewParams.get("previewTime")) : null;
  const TAU = Math.PI * 2;
  const palette = {
    black: "#050505",
    yellow: "#ffe000",
    magenta: "#d71972",
    red: "#ef233c",
    orange: "#ff6a00",
    wine: "#6e0b25"
  };

  // 作品资料取自收藏该作品或策划相关展览的博物馆。图形为原创抽象导览符号，并非作品原图。
  const artworks = [
    {
      title: "南瓜",
      meta: "Pumpkin · 2016",
      motif: "motif-pumpkin",
      description: "黄色南瓜上布满反复变化的黑色圆点。草间弥生将南瓜与波点这两种标志性母题结合，让熟悉的植物形体变成富有节奏的雕塑。",
      source: "https://www.si.edu/object/hmsg_2020.002"
    },
    {
      title: "百万光年之外的灵魂",
      meta: "Infinity Mirrored Room · 2013",
      motif: "motif-infinity",
      description: "镜面与闪烁的灯光在房间里相互映照，微小光点被重复为仿佛没有边界的空间。观众进入其中，亲身感受尺度与距离的变化。",
      source: "https://www.thebroad.org/visit/mirror-rooms"
    },
    {
      title: "自恋庭园",
      meta: "Narcissus Garden · 1966",
      motif: "motif-narcissus",
      description: "成群的镜面球体反射周围的人与环境。同一个圆形不断重复，每颗球又映出不同的景象，让观看者成为作品空间的一部分。",
      source: "https://www.moma.org/calendar/exhibitions/4995"
    }
  ];

  let playing = true;
  let startTime = performance.now();
  let pausedAt = 0;
  let pointerX = 0;
  let pointerY = 0;
  let recording = false;
  let currentArtwork = 0;
  let interfaceState = "intro";
  let transitionTimer = 0;
  let gestureStart = null;
  let entryRotation = 0;
  let entryDidDrag = false;
  let roomZoom = 1;
  let roomYaw = 0;
  let roomPitch = 0;
  let panoramaFrame = 0;
  let pinchDistance = 0;
  const activePointers = new Map();
  const panoramaImages = ["pumpkin-room.png", "infinity-room.png", "narcissus-room.png"].map((name) => {
    const image = new Image();
    image.src = new URL(`./assets/${name}`, document.baseURI).href;
    image.addEventListener("load", () => requestPanorama());
    return image;
  });
  const panoramaSideImages = ["gallery-corridor.png", "entry-space.png"].map((name) => {
    const image = new Image();
    image.src = new URL(`./assets/${name}`, document.baseURI).href;
    image.addEventListener("load", () => requestPanorama());
    return image;
  });

  const clamp = (v, lo = 0, hi = 1) => Math.min(hi, Math.max(lo, v));
  const mix = (a, b, t) => a + (b - a) * t;
  const smooth = (t) => {
    const x = clamp(t);
    return x * x * (3 - 2 * x);
  };
  const easeOut = (t) => 1 - Math.pow(1 - clamp(t), 3);
  const easeInOut = (t) => {
    const x = clamp(t);
    return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
  };
  const backOut = (t, amount = 1.7) => {
    const x = clamp(t) - 1;
    return 1 + (amount + 1) * x * x * x + amount * x * x;
  };
  const windowed = (t, start, end, feather = 0.12) => {
    const enter = smooth((t - start) / feather);
    const exit = 1 - smooth((t - (end - feather)) / feather);
    return clamp(Math.min(enter, exit));
  };
  const hash = (n) => {
    const x = Math.sin(n * 127.1 + 311.7) * 43758.5453;
    return x - Math.floor(x);
  };

  function playSoundtrack(syncToOpening = false) {
    if (syncToOpening && interfaceState === "intro") {
      const timelineTime = playing
        ? clamp((performance.now() - startTime) / 1000, 0, DURATION)
        : clamp(pausedAt, 0, DURATION);
      if (Math.abs(soundtrack.currentTime - timelineTime) > 0.35) {
        try {
          soundtrack.currentTime = timelineTime;
        } catch {
          // Metadata may still be loading; playback will begin at its current position.
        }
      }
    }
    const playback = soundtrack.play();
    if (playback) playback.catch(() => {});
  }

  function fill(color, alpha = 1) {
    ctx.globalAlpha = alpha;
    ctx.fillStyle = color;
  }

  function circle(x, y, r, color, alpha = 1, sx = 1, sy = 1) {
    if (r <= 0 || alpha <= 0) return;
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(sx, sy);
    fill(color, alpha);
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, TAU);
    ctx.fill();
    ctx.restore();
  }

  function ellipse(x, y, rx, ry, color, alpha = 1, rotation = 0) {
    if (rx <= 0 || ry <= 0 || alpha <= 0) return;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(rotation);
    fill(color, alpha);
    ctx.beginPath();
    ctx.ellipse(0, 0, rx, ry, 0, 0, TAU);
    ctx.fill();
    ctx.restore();
  }

  function cover(color, alpha = 1) {
    fill(color, alpha);
    ctx.fillRect(0, 0, W, H);
  }

  function drawColoredEcho(x, y, r, vx, vy, alpha) {
    circle(x - vx * 0.06, y - vy * 0.06, r * 0.92, palette.red, alpha * 0.32);
    circle(x - vx * 0.035, y - vy * 0.035, r * 0.96, palette.orange, alpha * 0.27);
  }

  function pumpkinSilhouettePoint(angle, width, height, squash = 0) {
    const c = Math.cos(angle);
    const s = Math.sin(angle);
    const scallop = 1 + 0.055 * Math.cos(angle * 8) + 0.018 * Math.cos(angle * 16);
    const pinch = 1 - 0.12 * Math.pow(Math.max(0, -s), 5) - squash * Math.abs(c);
    return { x: c * width * scallop * pinch, y: s * height * scallop };
  }

  function spiralPoint(u, rotation = 0) {
    const angle = -0.74 + u * 5.08 + rotation;
    const radius = 140 + Math.pow(u, 0.86) * 275;
    return {
      x: W / 2 + 8 + Math.cos(angle) * radius * 0.98,
      y: H / 2 + 48 + Math.sin(angle) * radius * 1.04
    };
  }

  function drawSpiralOpening(t) {
    const alpha = 1 - smooth((t - 1.46) / 0.34);
    if (alpha <= 0) return;

    const headU = clamp(backOut(t / 0.82, 1.35));
    const rotation = easeInOut(t / 1.32) * 0.08;
    const gather = 0;
    const count = 46;

    const headPoint = spiralPoint(Math.max(0.02, headU), rotation);
    ctx.save();
    ctx.globalAlpha = alpha;
    const yellowGlow = ctx.createRadialGradient(headPoint.x, headPoint.y, 0, headPoint.x, headPoint.y, 470);
    yellowGlow.addColorStop(0, "rgba(255, 224, 0, 0.16)");
    yellowGlow.addColorStop(0.34, "rgba(255, 224, 0, 0.065)");
    yellowGlow.addColorStop(1, "rgba(255, 224, 0, 0)");
    ctx.fillStyle = yellowGlow;
    ctx.fillRect(0, 0, W, H);
    const redGlow = ctx.createRadialGradient(W * 0.58, H * 0.57, 0, W * 0.58, H * 0.57, 660);
    redGlow.addColorStop(0, "rgba(239, 35, 60, 0.14)");
    redGlow.addColorStop(0.46, "rgba(110, 11, 37, 0.075)");
    redGlow.addColorStop(1, "rgba(110, 11, 37, 0)");
    ctx.fillStyle = redGlow;
    ctx.fillRect(0, 0, W, H);
    ctx.restore();

    for (let i = 0; i < count; i += 1) {
      const normalized = i / (count - 1);
      const u = Math.pow(normalized, 1.2) * headU;
      const point = spiralPoint(u, rotation);
      const targetAngle = -Math.PI * 0.94 + normalized * TAU;
      const target = pumpkinSilhouettePoint(targetAngle, 348, 486);
      const x = mix(point.x, W / 2 + target.x, gather);
      const y = mix(point.y, H / 2 + 38 + target.y, gather);
      const sizeCurve = Math.pow(normalized, 1.68);
      const radius = (4.7 + 57 * sizeCurve) * mix(1, 0.74, gather);
      const previousFar = spiralPoint(Math.max(0, u - 0.034), rotation);
      const previousNear = spiralPoint(Math.max(0, u - 0.018), rotation);
      const reveal = smooth((headU - u + 0.045) / 0.085);
      const colorIndex = i % 10;
      const color = normalized > 0.72
        ? palette.yellow
        : colorIndex === 2 || colorIndex === 7
          ? palette.red
          : colorIndex === 5
            ? palette.orange
            : palette.yellow;

      circle(previousFar.x - 3, previousFar.y + 4, radius * 0.92, palette.wine, alpha * reveal * 0.32);
      circle(previousNear.x - 1, previousNear.y + 2, radius * 0.96, palette.red, alpha * reveal * 0.25);
      circle(x, y, radius, color, alpha * reveal * (0.52 + normalized * 0.26));
    }

    if (headU > 0.025) {
      const point = spiralPoint(headU, rotation);
      const target = pumpkinSilhouettePoint(-Math.PI * 0.94 + headU * TAU, 348, 486);
      const x = mix(point.x, W / 2 + target.x, gather);
      const y = mix(point.y, H / 2 + 38 + target.y, gather);
      const pulse = 1 + Math.sin(clamp(t / 0.82) * Math.PI) * 0.065;
      const headRadius = mix(12, 100, Math.pow(headU, 1.25)) * pulse * mix(1, 0.72, gather);

      for (let echo = 7; echo >= 1; echo -= 1) {
        const trailU = Math.max(0, headU - echo * 0.021);
        const trailPoint = spiralPoint(trailU, rotation);
        const trailRadius = headRadius * mix(0.7, 0.94, 1 - echo / 7);
        const trailColor = echo % 3 === 0 ? palette.red : palette.yellow;
        circle(trailPoint.x, trailPoint.y, trailRadius, trailColor, alpha * (0.055 + (7 - echo) * 0.021));
      }

      ctx.save();
      ctx.shadowColor = "rgba(255, 224, 0, 0.34)";
      ctx.shadowBlur = 58;
      circle(x, y, headRadius, palette.yellow, alpha);
      ctx.restore();
      circle(x, y, headRadius * 0.23, palette.red, alpha * (1 - gather * 0.45));
    }
  }

  function drawPumpkin(cx, cy, scale, alpha, phase, options = {}) {
    const lobeCount = 9;
    const spread = options.spread ?? 1;
    const opening = options.opening ?? 0;
    const breathe = options.breathe ?? 0;
    const dotShift = options.dotShift ?? 0;
    const magentaDots = options.magentaDots ?? 0;
    // `roundness` only applies during the portal transition. All other scenes
    // retain the original tall, ribbed pumpkin silhouette.
    const roundness = options.roundness ?? (options.roundOpening ? smooth(opening / 0.2) : 0);
    const baseW = 190 * scale;
    // Keep the original ribbed pumpkin silhouette, with a gentler vertical
    // proportion so it never reads as a stretched capsule.
    const baseH = 440 * scale;

    for (let pass = 0; pass < lobeCount; pass += 1) {
      const index = pass < 4 ? pass : 12 - pass;
      const lane = index - 4;
      const depth = 1 - Math.abs(lane) / 5.2;
      const async = Math.sin(phase * TAU + index * 0.74) * breathe;
      const openDelay = smooth((opening - Math.abs(lane) * 0.055 - (index % 3) * 0.025) / 0.66);
      const side = lane === 0 ? 0 : Math.sign(lane);
      const openX = side * openDelay * (165 + Math.abs(lane) * 44) * scale;
      const openY = openDelay * (Math.abs(lane) * 24 - 18) * scale;
      const pumpkinX = cx + lane * 87 * scale * spread * (1 - roundness * 0.88) + openX;
      const pumpkinY = cy + 20 * scale + openY - async * 25 * scale;
      const orbitAngle = -Math.PI / 2 + lane * TAU / lobeCount;
      const separation = options.roundOpening
        ? smooth((opening - Math.abs(lane) * 0.018 - (index % 3) * 0.014) / 0.32)
        : 0;
      const x = mix(pumpkinX, cx + Math.cos(orbitAngle) * 520 * scale, separation);
      const y = mix(pumpkinY, cy + Math.sin(orbitAngle) * 520 * scale, separation);
      const discRadius = 220 * scale * (0.88 + depth * 0.12);
      const rx = mix(baseW * (0.64 + depth * 0.38) * (1 + async * 0.11), discRadius, roundness);
      const ry = mix(baseH * (0.79 + depth * 0.2) * (1 + async * 0.06), discRadius, roundness);
      const lobeAlpha = alpha * (0.83 + depth * 0.17);
      if (roundness >= 0.999) circle(x, y, discRadius, palette.yellow, lobeAlpha);
      else ellipse(x, y, rx, ry, palette.yellow, lobeAlpha);

      const cols = 5;
      const rows = 22;
      for (let row = 0; row < rows; row += 1) {
        const v = (row + 0.5) / rows;
        const pyN = v * 2 - 1;
        const rowWidth = Math.pow(Math.max(0, 1 - pyN * pyN), 0.54);
        for (let col = 0; col < cols; col += 1) {
          const u = cols === 1 ? 0 : col / (cols - 1) * 2 - 1;
          const jitterX = (hash(index * 103 + row * 11 + col) - 0.5) * 0.14;
          const jitterY = (hash(index * 89 + row * 17 + col) - 0.5) * 0.04;
          const dotIndex = row * cols + col;
          const discAngle = dotIndex * 2.3999632297 + index * 0.27;
          const discDistance = Math.sqrt((dotIndex + 0.5) / (rows * cols)) * discRadius * 0.87;
          const pumpkinDotX = x + (u + jitterX) * rx * 0.78 * rowWidth;
          const pumpkinDotY = y + (pyN + jitterY) * ry * 0.91;
          const discDotX = x + Math.cos(discAngle) * discDistance;
          const discDotY = y + Math.sin(discAngle) * discDistance;
          const centerWeight = 1 - Math.abs(pyN);
          const size = (4.4 + 13.5 * centerWeight + 4.8 * (1 - Math.abs(u))) * scale;
          const roundSize = (4.2 + 8.8 * (1 - discDistance / discRadius)) * scale;
          const selector = hash(index * 49 + row * 7 + col * 3 + 900);
          const color = selector < magentaDots ? palette.magenta : selector < magentaDots + 0.06 ? palette.red : palette.black;
          const dotAlpha = alpha * (0.78 + depth * 0.22);
          if (roundness < 0.999) circle(pumpkinDotX, pumpkinDotY, size * (1 + dotShift * centerWeight * 0.9), color, dotAlpha * (1 - roundness));
          if (roundness > 0.001) circle(discDotX, discDotY, roundSize, color, dotAlpha * roundness);
        }
      }
    }

    const stemAlpha = alpha * (1 - (options.stemFade ?? 0));
    if (stemAlpha > 0.01) {
      ellipse(cx + 22 * scale, cy - 448 * scale, 54 * scale, 92 * scale, palette.black, stemAlpha, -0.12);
      for (let i = 0; i < 10; i += 1) {
        const a = i / 10 * TAU;
        circle(cx + 22 * scale + Math.cos(a) * 25 * scale, cy - 448 * scale + Math.sin(a) * 51 * scale, 5 * scale, palette.yellow, stemAlpha * 0.8);
      }
    }
  }

  function drawCondensingPumpkin(t) {
    const alpha = smooth((t - 1.44) / 0.22) * (1 - smooth((t - 4.08) / 0.34));
    if (alpha <= 0) return;
    const incoming = 1 - smooth((t - 1.56) / 0.82);

    for (let i = 0; i < 46; i += 1) {
      const u = Math.pow(i / 45, 1.2);
      const start = spiralPoint(u, 0.08);
      const targetAngle = -Math.PI * 0.94 + u * TAU;
      const target = pumpkinSilhouettePoint(targetAngle, 390, 450);
      const p = easeInOut((t - 1.48 - u * 0.08) / 0.94);
      const x = mix(start.x, W / 2 + target.x, p);
      const y = mix(start.y, H / 2 + 45 + target.y, p);
      const startSize = 4.7 + 57 * Math.pow(u, 1.68);
      const r = mix(startSize * 0.74, 12 + 13 * Math.sin(u * Math.PI), p);
      const previous = spiralPoint(Math.max(0, u - 0.018), 0.08);
      const vx = x - previous.x;
      const vy = y - previous.y;
      drawColoredEcho(x, y, r, vx * 3.5, vy * 3.5, alpha * incoming);
      const colorIndex = i % 10;
      const color = u > 0.72
        ? palette.yellow
        : colorIndex === 2 || colorIndex === 7
          ? palette.red
          : colorIndex === 5
            ? palette.orange
            : palette.yellow;
      circle(x, y, r, color, alpha * incoming);
    }

    const formation = smooth((t - 1.7) / 0.78);
    const growth = backOut((t - 1.65) / 1.14, 1.3);
    const pressure = easeInOut((t - 2.66) / 1.42);
    const pulse = Math.sin(clamp((t - 2.58) / 1.48) * Math.PI) * 0.075;
    const scale = mix(0.18, 1.04, growth) + pressure * 0.5 + pulse;
    drawPumpkin(W / 2 + pointerX * 12 * pressure, H / 2 + 35 + pointerY * 12 * pressure, scale, alpha * formation, (t - 1.58) * 0.26, {
      spread: 0.95 + pressure * 0.04,
      breathe: 0.1 + pressure * 0.08,
      dotShift: pressure * 0.35
    });
  }

  function drawOrganicField(t, alpha) {
    if (alpha <= 0) return;
    cover(palette.magenta, alpha);
    for (let i = 0; i < 115; i += 1) {
      const row = Math.floor(i / 9);
      const col = i % 9;
      const x = (col + 0.5 + (row % 2) * 0.48) * W / 9 + (hash(i + 18) - 0.5) * 70;
      const y = (row + 0.3) * H / 13 + (hash(i + 80) - 0.5) * 65;
      const pulse = 0.86 + 0.14 * Math.sin(t * 3.2 + i * 1.7);
      const radius = (39 + hash(i + 3) * 53) * pulse;
      const color = i % 13 === 0 ? palette.yellow : palette.black;
      circle(x, y, radius, color, alpha * (i % 13 === 0 ? 0.7 : 0.92));
    }
  }

  function drawMagentaTransition(t) {
    const local = clamp((t - 3.82) / 1.42);
    if (local <= 0) return;
    const blackGrow = backOut(clamp(local / 0.48), 1.1);
    const blackR = mix(8, 1280, blackGrow);
    circle(W / 2, H / 2 + 70, blackR, palette.black, 1);

    const magentaGrow = backOut(clamp((local - 0.34) / 0.58), 1.0);
    if (magentaGrow > 0) {
      circle(W / 2, H / 2 + 70, 1360 * magentaGrow, palette.magenta, 1);
      const fieldAlpha = smooth((local - 0.58) / 0.24);
      drawOrganicField(t, fieldAlpha);
    }

    const pumpkinAlpha = smooth((local - 0.56) / 0.28);
    if (pumpkinAlpha > 0) {
      const rise = backOut((local - 0.56) / 0.44, 1.5);
      drawPumpkin(W / 2, mix(H + 680, H / 2 + 60, rise), 0.9 + 0.13 * rise, pumpkinAlpha, t * 0.35, {
        magentaDots: 0.56,
        breathe: 0.08
      });
    }
  }

  function drawPortal(t) {
    const local = clamp((t - 4.84) / 1.52);
    const alpha = smooth((t - 4.78) / 0.22) * (1 - smooth((t - 6.24) / 0.24));
    if (alpha <= 0) return;
    drawOrganicField(t, alpha * (1 - smooth((local - 0.7) / 0.3)));

    const portalRoundness = smooth((local - 0.10) / 0.22);
    drawPumpkin(W / 2, H / 2 + 55, 1.02, alpha, t * 0.44, {
      opening: smooth((local - 0.24) / 0.62),
      roundOpening: true,
      roundness: portalRoundness,
      spread: 0.94,
      breathe: 0.12,
      magentaDots: 0.38,
      stemFade: smooth((local - 0.25) / 0.18)
    });

    const holeP = backOut((local - 0.4) / 0.43, 1.4);
    if (holeP > 0) {
      const breath = 1 + Math.sin(local * Math.PI * 4) * 0.035;
      const holeRadius = 340 * holeP * breath;
      circle(W / 2, H / 2 + 65, holeRadius, palette.black, alpha);
      const ringCount = 44;
      for (let i = 0; i < ringCount; i += 1) {
        const a = i / ringCount * TAU;
        const ringRadius = 363 * holeP;
        const size = (6 + 16 * (0.5 + 0.5 * Math.cos(a))) * holeP;
        const color = i % 3 === 0 ? palette.red : i % 3 === 1 ? palette.yellow : palette.orange;
        circle(W / 2 + Math.cos(a) * ringRadius, H / 2 + 65 + Math.sin(a) * ringRadius, size, color, alpha);
      }
    }
  }

  function drawTunnel(t) {
    const local = clamp((t - 6.02) / 1.36);
    const alpha = smooth((t - 5.98) / 0.2) * (1 - smooth((t - 7.24) / 0.22));
    if (alpha <= 0) return;
    cover(palette.black, alpha);

    const speed = easeInOut(local);
    for (let ring = 0; ring < 15; ring += 1) {
      const z = ((ring / 15 + speed * 1.85) % 1);
      const perspective = Math.pow(z, 2.25);
      const ringRadius = 70 + perspective * 1010;
      const count = 14 + Math.floor(ring * 0.75);
      const twist = ring * 0.38 + local * 3.4;
      for (let i = 0; i < count; i += 1) {
        const a = i / count * TAU + twist;
        const wobble = 1 + 0.08 * Math.sin(a * 3 + ring);
        const x = W / 2 + Math.cos(a) * ringRadius * wobble;
        const y = H / 2 + 45 + Math.sin(a) * ringRadius * wobble;
        const r = 3 + perspective * (31 + hash(i + ring * 70) * 34);
        const color = (i + ring) % 7 === 0 ? palette.magenta : (i + ring) % 9 === 0 ? palette.red : palette.yellow;
        const vx = Math.cos(a) * ringRadius * 0.2;
        const vy = Math.sin(a) * ringRadius * 0.2;
        drawColoredEcho(x, y, r, vx, vy, alpha * perspective);
        circle(x, y, r, color, alpha * (0.25 + perspective * 0.75));
      }
    }
    const centerR = mix(340, 34, easeInOut(local));
    circle(W / 2, H / 2 + 45, centerR, palette.black, alpha);
  }

  function drawDotPumpkin(cx, cy, width, height, alpha, shapeIndex, colorA, colorB) {
    const rows = 18;
    const cols = 18;
    for (let r = 0; r < rows; r += 1) {
      const py = r / (rows - 1) * 2 - 1;
      for (let c = 0; c < cols; c += 1) {
        const px = c / (cols - 1) * 2 - 1;
        const angle = Math.atan2(py, px);
        const rad = Math.hypot(px, py);
        const edge = 1 + 0.07 * Math.cos(angle * (8 + shapeIndex)) - 0.05 * Math.max(0, -Math.sin(angle)) ** 4;
        if (rad > edge) continue;
        if ((r + c + shapeIndex) % 2 !== 0 && hash(r * 31 + c * 9 + shapeIndex) > 0.35) continue;
        const depth = 1 - rad;
        const lobeWave = 0.7 + 0.3 * Math.cos(px * Math.PI * (4 + shapeIndex * 0.3));
        const size = 4 + 14 * Math.max(0, depth) + 8 * lobeWave;
        const color = (r + c) % 5 === 0 ? colorB : colorA;
        circle(cx + px * width, cy + py * height, size, color, alpha * (0.55 + depth * 0.45));
      }
    }
  }

  function drawReformation(t) {
    const alpha = windowed(t, 7.12, 8.28, 0.16);
    if (alpha <= 0) return;
    cover(palette.black, alpha);
    const local = t - 7.12;
    const variants = [
      { start: 0.03, end: 0.43, w: 390, h: 265, y: 910, idx: 0 },
      { start: 0.34, end: 0.78, w: 245, h: 510, y: 965, idx: 1 },
      { start: 0.69, end: 1.14, w: 355, h: 365, y: 950, idx: 2 }
    ];
    variants.forEach((v) => {
      const a = windowed(local, v.start, v.end, 0.12) * alpha;
      const p = backOut((local - v.start) / 0.22, 1.8);
      if (a > 0) {
        drawDotPumpkin(W / 2, v.y, v.w * p, v.h * p, a, v.idx, palette.yellow, v.idx === 1 ? palette.red : palette.magenta);
      }
    });
  }

  function drawCollapse(t) {
    const local = clamp((t - 7.92) / 0.86);
    const alpha = smooth((t - 7.9) / 0.15) * (1 - smooth((t - 8.68) / 0.14));
    if (alpha <= 0) return;
    cover(palette.black, alpha * 0.96);
    const collapse = easeInOut(local);
    for (let i = 0; i < 132; i += 1) {
      const startA = hash(i + 600) * TAU;
      const startR = 120 + hash(i + 900) * 1010;
      const depth = hash(i + 1200);
      const delay = depth * 0.16;
      const p = easeInOut((local - delay) / (1 - delay));
      const spin = startA + p * (2.1 + depth * 2.4);
      const radius = startR * Math.pow(1 - p, 1.5);
      const x = W / 2 + Math.cos(spin) * radius;
      const y = H / 2 + Math.sin(spin) * radius * 1.55;
      const r = mix(6 + depth * 42, 2.5, p);
      const color = i % 8 === 0 ? palette.magenta : i % 11 === 0 ? palette.red : palette.yellow;
      drawColoredEcho(x, y, r, -Math.cos(spin) * radius, -Math.sin(spin) * radius, alpha * p);
      circle(x, y, r, color, alpha);
    }
    circle(W / 2, H / 2, mix(2, 22, collapse), palette.yellow, alpha);
  }

  function drawFinalDot(t) {
    const local = clamp((t - 8.58) / 0.42);
    if (local <= 0) return;
    cover(palette.black, smooth(local / 0.12));
    const grow = backOut(local / 0.55, 2.0);
    const settle = local > 0.55 ? mix(1.15, 1, smooth((local - 0.55) / 0.45)) : grow * 1.15;
    const radius = 54 * settle;
    circle(W / 2, H / 2, radius, palette.yellow, 1);
    const innerA = smooth((local - 0.42) / 0.13) * (1 - smooth((local - 0.75) / 0.17));
    circle(W / 2 - 18, H / 2 - 7, 7, palette.black, innerA);
    circle(W / 2 + 4, H / 2 + 14, 11, palette.black, innerA);
    circle(W / 2 + 22, H / 2 - 15, 4.5, palette.black, innerA);
  }

  function render(timeSeconds) {
    const t = clamp(timeSeconds, 0, DURATION);
    const punch = [
      [1.68, 0.085, 0.065],
      [2.83, 0.14, 0.12],
      [4.12, 0.18, 0.11],
      [5.62, 0.095, 0.09],
      [6.22, 0.16, 0.12],
      [7.94, 0.13, 0.1]
    ].reduce((amount, [beat, strength, width]) => amount + strength * Math.exp(-Math.pow((t - beat) / width, 2)), 0);
    ctx.globalCompositeOperation = "source-over";
    ctx.globalAlpha = 1;
    cover(palette.black, 1);
    ctx.save();
    ctx.translate(W / 2, H / 2);
    ctx.scale(1 + punch, 1 + punch);
    ctx.translate(-W / 2, -H / 2);

    drawSpiralOpening(t);
    drawCondensingPumpkin(t);
    drawMagentaTransition(t);
    drawPortal(t);
    drawTunnel(t);
    drawReformation(t);
    drawCollapse(t);
    drawFinalDot(t);
    ctx.restore();

    ctx.globalAlpha = 1;
    progressBar.style.transform = `scaleX(${t / DURATION})`;
  }

  function tick(now) {
    if (playing) {
      const elapsed = (now - startTime) / 1000;
      if (elapsed >= DURATION) {
        render(DURATION);
        playing = false;
        pausedAt = DURATION;
        playButton.classList.remove("is-playing");
        if (interfaceState === "intro" && !recording) {
          interfaceState = "entry";
          entryScreen.hidden = false;
        }
      } else {
        pausedAt = elapsed;
        render(elapsed);
      }
    }
    requestAnimationFrame(tick);
  }

  // Each room image is viewed through an equal-aspect-ratio window.  This keeps
  // dots, arches and artwork at their native proportions while yaw crossfades
  // through the four connected room sectors.
  function renderPanorama() {
    panoramaFrame = 0;
    if (interfaceState !== "detail" || !detailScreen.classList.contains("is-immersive")) return;
    const mainImage = panoramaImages[currentArtwork];
    if (!mainImage.complete || !mainImage.naturalWidth) return;
    const sideA = panoramaSideImages[0].naturalWidth ? panoramaSideImages[0] : mainImage;
    const sideB = panoramaSideImages[1].naturalWidth ? panoramaSideImages[1] : mainImage;
    const views = currentArtwork === 1
      ? [mainImage, sideB, sideA, mainImage]
      : [mainImage, sideA, sideB, mainImage];

    const width = panoramaCanvas.width;
    const height = panoramaCanvas.height;
    panoramaCtx.fillStyle = palette.black;
    panoramaCtx.fillRect(0, 0, width, height);

    const drawView = (image, drift, opacity) => {
      const sourceAspect = width / height;
      const zoom = Math.max(1, roomZoom);
      const cropWidth = image.naturalWidth / zoom;
      const cropHeight = cropWidth / sourceAspect;
      const sourceX = clamp(
        (image.naturalWidth - cropWidth) * (0.5 + drift * 0.28),
        0,
        image.naturalWidth - cropWidth,
      );
      const sourceY = clamp(
        (image.naturalHeight - cropHeight) * 0.5 + roomPitch * image.naturalHeight * 0.16,
        0,
        image.naturalHeight - cropHeight,
      );
      const displayScale = Math.min(roomZoom, 1);
      const displayWidth = width * displayScale;
      const displayHeight = height * displayScale;
      panoramaCtx.globalAlpha = opacity;
      panoramaCtx.drawImage(
        image,
        sourceX,
        sourceY,
        cropWidth,
        cropHeight,
        (width - displayWidth) / 2,
        (height - displayHeight) / 2,
        displayWidth,
        displayHeight,
      );
    };

    const turns = ((roomYaw / TAU + 0.125) % 1 + 1) % 1;
    const quarter = turns * 4;
    const sector = Math.floor(quarter);
    const localX = quarter - sector;
    const seam = 0.16;
    drawView(views[sector], localX - 0.5, 1);
    if (localX < seam) {
      const previous = (sector + 3) % 4;
      const fade = 1 - smooth(localX / seam);
      drawView(views[previous], localX + 0.5, fade);
    } else if (localX > 1 - seam) {
      const next = (sector + 1) % 4;
      const fade = smooth((localX - 1 + seam) / seam);
      drawView(views[next], localX - 1.5, fade);
    }
    panoramaCtx.globalAlpha = 1;

    const shade = panoramaCtx.createRadialGradient(width / 2, height / 2, height * 0.13, width / 2, height / 2, width * 0.77);
    shade.addColorStop(0, "rgba(0,0,0,0)");
    shade.addColorStop(1, "rgba(0,0,0,.48)");
    panoramaCtx.fillStyle = shade;
    panoramaCtx.fillRect(0, 0, width, height);
    panoramaCompass.textContent = `方位 ${Math.round(((roomYaw * 180 / Math.PI) % 360 + 360) % 360)}°`;
    panoramaZoom.textContent = `缩放 ${Math.round(roomZoom * 100)}%`;
  }

  function requestPanorama() {
    if (!panoramaFrame) panoramaFrame = requestAnimationFrame(renderPanorama);
  }

  function changeZoom(next) {
    roomZoom = clamp(next, 0.7, 3.4);
    requestPanorama();
  }

  function resetRoomView() {
    roomYaw = 0;
    roomPitch = 0;
    roomZoom = 1;
    activePointers.clear();
    pinchDistance = 0;
    panoramaCompass.textContent = "方位 0°";
    panoramaZoom.textContent = "缩放 100%";
    requestPanorama();
  }

  function restart() {
    clearTimeout(transitionTimer);
    interfaceState = "intro";
    entryRotation = 0;
    entryDidDrag = false;
    positionEntrySeeds();
    entryScreen.hidden = true;
    galleryScreen.hidden = true;
    detailScreen.hidden = true;
    detailScreen.classList.remove("is-immersive", "room-active");
    resetRoomView();
    immersiveButton.setAttribute("aria-pressed", "false");
    immersiveButton.textContent = "沉浸探索空间 ↗";
    shell.classList.remove("is-entering", "is-traversing", "is-revealing", "is-gallery", "is-detail");
    transitionBloom.style.transition = "none";
    transitionBloom.style.transform = "translate(-50%, -50%) scale(0)";
    transitionBloom.style.opacity = "0";
    startTime = performance.now();
    pausedAt = 0;
    playing = true;
    playButton.classList.add("is-playing");
    try {
      soundtrack.currentTime = 0;
    } catch {
      // The audio metadata may not be ready during the first page load.
    }
    playSoundtrack();
    render(0);
  }

  playButton.addEventListener("click", () => {
    if (pausedAt >= DURATION) {
      restart();
      return;
    }
    playing = !playing;
    playButton.classList.toggle("is-playing", playing);
    if (playing) {
      startTime = performance.now() - pausedAt * 1000;
      playSoundtrack(true);
    } else {
      soundtrack.pause();
    }
  });

  replayButton.addEventListener("click", restart);
  restartFromGallery.addEventListener("click", restart);

  function bloomAt(element, color) {
    shell.classList.remove("is-revealing");
    const rect = frame.getBoundingClientRect();
    const source = element.getBoundingClientRect();
    transitionBloom.style.left = `${source.left - rect.left + source.width / 2}px`;
    transitionBloom.style.top = `${source.top - rect.top + source.height / 2}px`;
    transitionBloom.style.background = color;
    transitionBloom.style.transition = "none";
    transitionBloom.style.transform = "translate(-50%, -50%) scale(0)";
    transitionBloom.style.opacity = "0";
    // Force layout so the next scale is animated even after a previous passage.
    void transitionBloom.offsetWidth;
    transitionBloom.style.removeProperty("transform");
    transitionBloom.style.removeProperty("opacity");
    transitionBloom.style.removeProperty("transition");
  }

  function setArtwork(index) {
    currentArtwork = (index + artworks.length) % artworks.length;
    const work = artworks[currentArtwork];
    detailMotif.className = `detail-motif ${work.motif}`;
    detailNumber.textContent = `0${currentArtwork + 1} / 0${artworks.length}`;
    detailTitle.textContent = work.title;
    detailMeta.textContent = work.meta;
    detailDescription.textContent = work.description;
    sourceLink.href = work.source;
    detailScreen.dataset.artwork = String(currentArtwork);
    roomChoices.forEach((choice, choiceIndex) => {
      if (choiceIndex === currentArtwork) choice.setAttribute("aria-current", "true");
      else choice.removeAttribute("aria-current");
    });
  }

  function positionEntrySeeds() {
    const angles = [Math.PI, -.73, .73];
    entrySeeds.forEach((seed, index) => {
      const angle = angles[index] + entryRotation;
      seed.style.left = `${50 + Math.cos(angle) * 27}%`;
      seed.style.top = `${50 + Math.sin(angle) * 35}%`;
    });
  }

  enterButton.addEventListener("click", () => {
    if (interfaceState !== "entry" || entryDidDrag) return;
    interfaceState = "transition";
    bloomAt(enterButton, palette.yellow);
    shell.classList.add("is-entering");
    transitionTimer = setTimeout(() => {
      entryScreen.hidden = true;
      galleryScreen.hidden = false;
      shell.classList.remove("is-entering");
      shell.classList.add("is-gallery", "is-revealing");
      setTimeout(() => shell.classList.remove("is-revealing"), 590);
      interfaceState = "gallery";
      worldChoices[0].focus({ preventScroll: true });
    }, 720);
  });

  function openArtwork(index, origin = worldChoices[index].querySelector(".world-art")) {
    if (interfaceState !== "entry" && interfaceState !== "gallery" && interfaceState !== "detail") return;
    const fromDetail = interfaceState === "detail";
    interfaceState = "transition";
    bloomAt(origin, [palette.yellow, palette.magenta, palette.orange][(index + artworks.length) % artworks.length]);
    shell.classList.add("is-traversing");
    transitionTimer = setTimeout(() => {
      setArtwork(index);
      detailScreen.classList.remove("is-immersive");
      resetRoomView();
      immersiveButton.setAttribute("aria-pressed", "false");
      immersiveButton.textContent = "沉浸探索空间 ↗";
      entryScreen.hidden = true;
      galleryScreen.hidden = true;
      detailScreen.hidden = false;
      shell.classList.remove("is-traversing", "is-gallery");
      shell.classList.add("is-detail", "is-revealing");
      setTimeout(() => shell.classList.remove("is-revealing"), 590);
      // Changing artworks inside a room replays the arrival motion.
      if (fromDetail) {
        detailScreen.style.animation = "none";
        void detailScreen.offsetWidth;
        detailScreen.style.removeProperty("animation");
      }
      detailScreen.classList.remove("room-active");
      void detailScreen.offsetWidth;
      detailScreen.classList.add("room-active");
      interfaceState = "detail";
      backButton.focus({ preventScroll: true });
    }, 720);
  }

  worldChoices.forEach((choice, index) => {
    choice.addEventListener("click", () => openArtwork(index, choice.querySelector(".world-art")));
  });
  entrySeeds.forEach((seed, index) => {
    seed.addEventListener("click", () => {
      if (!entryDidDrag) openArtwork(index, seed.querySelector(".seed-art"));
    });
  });

  function returnToGallery() {
    if (interfaceState !== "detail") return;
    interfaceState = "transition";
    bloomAt(backButton, palette.magenta);
    shell.classList.add("is-traversing");
    transitionTimer = setTimeout(() => {
      detailScreen.hidden = true;
      galleryScreen.hidden = false;
      shell.classList.remove("is-detail", "is-traversing");
      shell.classList.add("is-gallery", "is-revealing");
      setTimeout(() => shell.classList.remove("is-revealing"), 590);
      interfaceState = "gallery";
      worldChoices[currentArtwork].focus({ preventScroll: true });
    }, 720);
  }

  backButton.addEventListener("click", returnToGallery);
  immersiveButton.addEventListener("click", () => {
    if (interfaceState !== "detail") return;
    const immersive = detailScreen.classList.toggle("is-immersive");
    immersiveButton.setAttribute("aria-pressed", String(immersive));
    immersiveButton.textContent = immersive ? "查看作品简介 ↙" : "沉浸探索空间 ↗";
    if (immersive) requestPanorama();
  });
  detailScreen.addEventListener("wheel", (event) => {
    if (interfaceState !== "detail" || !detailScreen.classList.contains("is-immersive")) return;
    event.preventDefault();
    changeZoom(roomZoom * Math.exp(-event.deltaY * 0.00135));
  }, { passive: false });
  zoomInButton.addEventListener("click", () => changeZoom(roomZoom * 1.28));
  zoomOutButton.addEventListener("click", () => changeZoom(roomZoom / 1.28));
  roomChoices.forEach((choice, index) => {
    choice.addEventListener("click", () => {
      if (interfaceState === "detail" && index !== currentArtwork) openArtwork(index, choice);
    });
  });

  // Both mouse movement and touch dragging reveal the layered spatial layout.
  function updateSpace(clientX, clientY) {
    const rect = frame.getBoundingClientRect();
    const x = clamp((clientX - rect.left) / rect.width, 0, 1) * 2 - 1;
    const y = clamp((clientY - rect.top) / rect.height, 0, 1) * 2 - 1;
    frame.style.setProperty("--space-x", x.toFixed(3));
    frame.style.setProperty("--space-y", y.toFixed(3));
    frame.style.setProperty("--field-x", `${(-x * 18).toFixed(2)}px`);
    frame.style.setProperty("--field-y", `${(-y * 16).toFixed(2)}px`);
    frame.style.setProperty("--corridor-x", `${(-x * 11).toFixed(2)}px`);
    frame.style.setProperty("--corridor-y", `${(-y * 6).toFixed(2)}px`);
    frame.style.setProperty("--floor-x", `${(-x * 21).toFixed(2)}px`);
    frame.style.setProperty("--detail-drift-x", `${(-x * 23).toFixed(2)}px`);
    frame.style.setProperty("--detail-drift-y", `${(-y * 12).toFixed(2)}px`);
    frame.style.setProperty("--detail-yaw", `${(-x * 8).toFixed(2)}deg`);
    frame.style.setProperty("--scene-x", `${(-x * 34).toFixed(2)}px`);
    frame.style.setProperty("--scene-y", `${(-y * 20).toFixed(2)}px`);
    const imageDepth = detailScreen.classList.contains("is-immersive") ? 55 : 27;
    frame.style.setProperty("--image-x", `${(-x * imageDepth).toFixed(2)}px`);
    frame.style.setProperty("--image-y", `${(-y * imageDepth * .6).toFixed(2)}px`);
    entrySeeds.forEach((seed, index) => {
      const depth = [1.2, .7, 1.5][index];
      seed.style.setProperty("--seed-shift-x", `${(-x * depth * 13).toFixed(2)}px`);
      seed.style.setProperty("--seed-shift-y", `${(-y * depth * 9).toFixed(2)}px`);
    });
    worldChoices.forEach((choice, index) => {
      const depth = [1.25, .6, 1.55][index];
      choice.style.setProperty("--drift-x", `${(-x * depth * 19).toFixed(2)}px`);
      choice.style.setProperty("--drift-y", `${(-y * depth * 13).toFixed(2)}px`);
      choice.style.setProperty("--yaw", `${(-x * 5).toFixed(2)}deg`);
      choice.style.setProperty("--art-yaw", `${(-x * 11).toFixed(2)}deg`);
      choice.style.setProperty("--art-pitch", `${(y * 8).toFixed(2)}deg`);
      choice.style.setProperty("--hover-yaw", `${(-x * 17).toFixed(2)}deg`);
    });
  }

  frame.addEventListener("pointermove", (event) => {
    if (interfaceState === "entry" || interfaceState === "gallery" || interfaceState === "detail") updateSpace(event.clientX, event.clientY);
    if (interfaceState === "detail" && detailScreen.classList.contains("is-immersive") && activePointers.has(event.pointerId)) {
      activePointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
      if (activePointers.size >= 2) {
        const [first, second] = [...activePointers.values()];
        const distance = Math.hypot(first.x - second.x, first.y - second.y);
        if (pinchDistance > 0) changeZoom(roomZoom * distance / pinchDistance);
        pinchDistance = distance;
      } else if (gestureStart?.state === "detail") {
        const dx = event.clientX - gestureStart.lastX;
        const dy = event.clientY - gestureStart.lastY;
        if (Math.abs(event.clientX - gestureStart.x) + Math.abs(event.clientY - gestureStart.y) > 8) gestureStart.dragged = true;
        roomYaw -= dx / frame.clientWidth * TAU * 1.15;
        roomPitch = clamp(roomPitch + dy / frame.clientHeight * Math.PI * 0.95, -1.35, 1.35);
        gestureStart.lastX = event.clientX;
        gestureStart.lastY = event.clientY;
        requestPanorama();
      }
      return;
    }
    if (gestureStart?.state === "entry" && interfaceState === "entry") {
      const dx = event.clientX - gestureStart.x;
      if (Math.abs(dx) > 10) entryDidDrag = true;
      entryRotation = clamp(gestureStart.rotation + dx / frame.clientWidth * 1.1, -.42, .42);
      positionEntrySeeds();
    }
  });
  frame.addEventListener("pointerdown", (event) => {
    if (interfaceState !== "entry" && interfaceState !== "gallery" && interfaceState !== "detail") return;
    if (interfaceState === "detail" && detailScreen.classList.contains("is-immersive") && !event.target.closest("button, a")) {
      activePointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
      if (activePointers.size === 2) {
        const [first, second] = [...activePointers.values()];
        pinchDistance = Math.hypot(first.x - second.x, first.y - second.y);
      }
      frame.setPointerCapture(event.pointerId);
    }
    gestureStart = { x: event.clientX, y: event.clientY, lastX: event.clientX, lastY: event.clientY, state: interfaceState, rotation: entryRotation, dragged: false };
  });
  frame.addEventListener("pointerup", (event) => {
    activePointers.delete(event.pointerId);
    if (activePointers.size < 2) pinchDistance = 0;
    if (interfaceState === "detail" && detailScreen.classList.contains("is-immersive") && activePointers.size === 1) {
      const remaining = [...activePointers.values()][0];
      gestureStart = { x: remaining.x, y: remaining.y, lastX: remaining.x, lastY: remaining.y, state: "detail", rotation: entryRotation, dragged: true };
      return;
    }
    if (!gestureStart) return;
    const dx = event.clientX - gestureStart.x;
    const dy = event.clientY - gestureStart.y;
    if (gestureStart.state === "detail" && interfaceState === "detail" && !detailScreen.classList.contains("is-immersive") && Math.abs(dx) > Math.max(52, frame.clientWidth * .11) && Math.abs(dx) > Math.abs(dy) * 1.3) {
      openArtwork(currentArtwork + (dx < 0 ? 1 : -1), detailMotif);
    }
    gestureStart = null;
    if (entryDidDrag) setTimeout(() => { entryDidDrag = false; }, 80);
  });
  frame.addEventListener("pointercancel", (event) => {
    activePointers.delete(event.pointerId);
    pinchDistance = 0;
    gestureStart = null;
    entryDidDrag = false;
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") returnToGallery();
    if (interfaceState === "detail" && detailScreen.classList.contains("is-immersive")) {
      if (event.key === "+" || event.key === "=") changeZoom(roomZoom * 1.22);
      if (event.key === "-") changeZoom(roomZoom / 1.22);
      if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
        event.preventDefault();
        roomYaw += (event.key === "ArrowLeft" ? 1 : -1) * Math.PI / 12;
        requestPanorama();
        return;
      }
    }
    if (interfaceState === "detail" && (event.key === "ArrowLeft" || event.key === "ArrowRight")) {
      openArtwork(currentArtwork + (event.key === "ArrowRight" ? 1 : -1), detailMotif);
    }
  });

  fullscreenButton.addEventListener("click", async () => {
    if (!document.fullscreenElement) await frame.requestFullscreen();
    else await document.exitFullscreen();
  });

  frame.addEventListener("pointermove", (event) => {
    const rect = frame.getBoundingClientRect();
    pointerX = clamp((event.clientX - rect.left) / rect.width, 0, 1) * 2 - 1;
    pointerY = clamp((event.clientY - rect.top) / rect.height, 0, 1) * 2 - 1;
  });

  frame.addEventListener("pointerleave", () => {
    pointerX = 0;
    pointerY = 0;
  });

  recordButton.addEventListener("click", () => {
    if (recording || typeof MediaRecorder === "undefined") return;
    const stream = canvas.captureStream(60);
    const audioStream = typeof soundtrack.captureStream === "function"
      ? soundtrack.captureStream()
      : typeof soundtrack.mozCaptureStream === "function"
        ? soundtrack.mozCaptureStream()
        : null;
    if (audioStream) audioStream.getAudioTracks().forEach((track) => stream.addTrack(track));
    const candidates = ["video/webm;codecs=vp9", "video/webm;codecs=vp8", "video/webm"];
    const mimeType = candidates.find((type) => MediaRecorder.isTypeSupported(type)) || "video/webm";
    const recorder = new MediaRecorder(stream, { mimeType, videoBitsPerSecond: 16000000 });
    const chunks = [];
    recording = true;
    document.body.classList.add("is-recording");
    recordButton.classList.add("is-recording");
    recorder.addEventListener("dataavailable", (event) => {
      if (event.data.size) chunks.push(event.data);
    });
    recorder.addEventListener("stop", () => {
      const blob = new Blob(chunks, { type: mimeType });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = "infinite-pumpkin-opening-1920x1080-60fps.webm";
      anchor.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      recording = false;
      document.body.classList.remove("is-recording");
      recordButton.classList.remove("is-recording");
      if (pausedAt >= DURATION && interfaceState === "intro") {
        interfaceState = "entry";
        entryScreen.hidden = false;
      }
    });
    recorder.start(100);
    restart();
    setTimeout(() => recorder.stop(), DURATION * 1000 + 180);
  });

  render(0);
  positionEntrySeeds();
  const unlockSoundtrack = () => {
    if (soundtrack.paused && (playing || interfaceState !== "intro")) {
      playSoundtrack(interfaceState === "intro");
    }
  };
  document.addEventListener("pointerdown", unlockSoundtrack, { capture: true });
  document.addEventListener("keydown", unlockSoundtrack, { capture: true });
  if (previewTime !== null && Number.isFinite(previewTime)) {
    playing = false;
    pausedAt = clamp(previewTime, 0, DURATION);
    render(pausedAt);
    playButton.classList.remove("is-playing");
  } else if (exportFrames) {
    playing = false;
    window.__renderOpeningFrame = render;
  } else {
    playSoundtrack(true);
    requestAnimationFrame(tick);
  }
})();
