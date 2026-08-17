"use strict";

const fs = require("node:fs");
const path = require("node:path");
const sharp = require("sharp");

const root = path.resolve(__dirname, "..");
const sourcePath = path.join(root, "assets", "brand", "zhenxing-star.png");
const outputDir = path.join(root, "build", "inno", "brand");

function gradient(size, brightness) {
  const low = 56 + Math.round(brightness * 72);
  const mid = 102 + Math.round(brightness * 105);
  const high = 154 + Math.round(brightness * 101);
  return Buffer.from(`
    <svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}">
      <defs>
        <linearGradient id="silver" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stop-color="rgb(${low},${low + 5},${low + 10})"/>
          <stop offset=".24" stop-color="rgb(${high},${high},${high})"/>
          <stop offset=".48" stop-color="rgb(${mid},${mid + 4},${mid + 8})"/>
          <stop offset=".7" stop-color="rgb(${Math.min(255, high + 18)},${Math.min(255, high + 18)},${Math.min(255, high + 18)})"/>
          <stop offset="1" stop-color="rgb(${low},${low + 4},${low + 9})"/>
        </linearGradient>
      </defs>
      <rect width="100%" height="100%" fill="url(#silver)"/>
    </svg>`);
}

async function renderStar(size, brightness, twinkle) {
  const luminance = await sharp(sourcePath)
    .resize(size, size, { fit: "contain" })
    .flatten({ background: "#000000" })
    .greyscale()
    .linear(1.65, 0)
    .extractChannel(0)
    .png()
    .toBuffer();
  const alpha = await sharp({
    create: {
      width: size,
      height: size,
      channels: 3,
      background: "#ffffff",
    },
  })
    .joinChannel(luminance)
    .png()
    .toBuffer();
  const star = await sharp(gradient(size, brightness))
    .ensureAlpha()
    .composite([{ input: alpha, blend: "dest-in" }])
    .png()
    .toBuffer();
  const glowOpacity = 0.08 + brightness * 0.24 + (twinkle ? 0.22 : 0);
  const glow = await sharp({
    create: {
      width: size,
      height: size,
      channels: 4,
      background: { r: 190, g: 234, b: 244, alpha: glowOpacity },
    },
  })
    .composite([{ input: alpha, blend: "dest-in" }])
    .blur(Math.max(2, size * (twinkle ? 0.05 : 0.035)))
    .png()
    .toBuffer();
  const shadow = await sharp({
    create: {
      width: size,
      height: size,
      channels: 4,
      background: { r: 0, g: 7, b: 14, alpha: 0.62 },
    },
  })
    .composite([{ input: alpha, blend: "dest-in" }])
    .blur(Math.max(1, size * 0.018))
    .png()
    .toBuffer();
  return sharp({
    create: { width: size, height: size, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } },
  })
    .composite([
      { input: shadow, left: 2, top: 3 },
      { input: glow, blend: "screen" },
      { input: star },
    ])
    .png()
    .toBuffer();
}

async function renderBackground() {
  const width = 1192;
  const height = 864;
  const base = Buffer.from(`
    <svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
      <defs>
        <linearGradient id="back" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stop-color="#071421"/>
          <stop offset=".55" stop-color="#0b2432"/>
          <stop offset="1" stop-color="#123847"/>
        </linearGradient>
        <radialGradient id="aura" cx="78%" cy="35%" r="45%">
          <stop offset="0" stop-color="#75d5e7" stop-opacity=".22"/>
          <stop offset="1" stop-color="#75d5e7" stop-opacity="0"/>
        </radialGradient>
      </defs>
      <rect width="100%" height="100%" fill="url(#back)"/>
      <rect width="100%" height="100%" fill="url(#aura)"/>
      <circle cx="930" cy="302" r="214" fill="none" stroke="#86d5e4" stroke-opacity=".13" stroke-width="2"/>
      <circle cx="930" cy="302" r="282" fill="none" stroke="#86d5e4" stroke-opacity=".08" stroke-width="2"/>
      <rect x="64" y="68" width="6" height="112" rx="3" fill="#31c5dd"/>
    </svg>`);
  return sharp(base).png().toBuffer();
}

async function renderProgressTrack() {
  const border = await sharp({
    create: { width: 342, height: 16, channels: 4, background: "#354456" },
  }).png().toBuffer();
  const inset = await sharp({
    create: { width: 340, height: 14, channels: 4, background: "#202936" },
  }).png().toBuffer();
  return sharp(border).composite([{ input: inset, left: 1, top: 1 }]).png().toBuffer();
}

async function renderProgressFill() {
  return sharp({
    create: { width: 4, height: 12, channels: 4, background: "#64d6dc" },
  }).png().toBuffer();
}

async function main() {
  if (!fs.existsSync(sourcePath) || !fs.statSync(sourcePath).isFile()) {
    throw new Error("supplied star source asset is missing");
  }
  fs.mkdirSync(outputDir, { recursive: true });
  for (let index = 0; index < 8; index += 1) {
    const brightness = index / 7;
    fs.writeFileSync(path.join(outputDir, `star-${index}.png`), await renderStar(320, brightness, false));
    fs.writeFileSync(path.join(outputDir, `star-${index}-twinkle.png`), await renderStar(320, brightness, true));
  }
  fs.writeFileSync(path.join(outputDir, "wizard-back.png"), await renderBackground());
  fs.writeFileSync(path.join(outputDir, "progress-track.png"), await renderProgressTrack());
  fs.writeFileSync(path.join(outputDir, "progress-fill.png"), await renderProgressFill());
}

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.message : "Inno brand asset generation failed"}\n`);
  process.exitCode = 1;
});
