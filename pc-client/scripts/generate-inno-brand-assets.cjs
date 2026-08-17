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
  const stops = [
    [0, [low, low + 5, low + 10]],
    [0.24, [high, high, high]],
    [0.48, [mid, mid + 4, mid + 8]],
    [0.7, [Math.min(255, high + 18), Math.min(255, high + 18), Math.min(255, high + 18)]],
    [1, [low, low + 4, low + 9]],
  ];
  const data = Buffer.alloc(size * size * 4);
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const point = (x + y) / (2 * (size - 1));
      let upper = 1;
      while (upper < stops.length - 1 && point > stops[upper][0]) upper += 1;
      const lower = upper - 1;
      const span = stops[upper][0] - stops[lower][0];
      const mix = span === 0 ? 0 : (point - stops[lower][0]) / span;
      const offset = (y * size + x) * 4;
      for (let channel = 0; channel < 3; channel += 1) {
        data[offset + channel] = Math.round(
          stops[lower][1][channel] + (stops[upper][1][channel] - stops[lower][1][channel]) * mix,
        );
      }
      data[offset + 3] = 255;
    }
  }
  return data;
}

async function renderStar(size, brightness) {
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
  const star = await sharp(gradient(size, brightness), {
    raw: { width: size, height: size, channels: 4 },
  })
    .ensureAlpha()
    .composite([{ input: alpha, blend: "dest-in" }])
    .png()
    .toBuffer();
  const glowOpacity = 0.08 + brightness * 0.24;
  const glow = await sharp({
    create: {
      width: size,
      height: size,
      channels: 4,
      background: { r: 190, g: 234, b: 244, alpha: glowOpacity },
    },
  })
    .composite([{ input: alpha, blend: "dest-in" }])
    .blur(Math.max(2, size * 0.035))
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
    .raw()
    .toBuffer();
}

function encodePremultipliedBmp(rgba, width, height) {
  const pixelOffset = 14 + 40;
  const pixelBytes = width * height * 4;
  const output = Buffer.alloc(pixelOffset + pixelBytes);

  output.write("BM", 0, 2, "ascii");
  output.writeUInt32LE(output.length, 2);
  output.writeUInt32LE(pixelOffset, 10);
  output.writeUInt32LE(40, 14);
  output.writeInt32LE(width, 18);
  output.writeInt32LE(-height, 22);
  output.writeUInt16LE(1, 26);
  output.writeUInt16LE(32, 28);
  output.writeUInt32LE(0, 30);
  output.writeUInt32LE(pixelBytes, 34);
  output.writeInt32LE(2835, 38);
  output.writeInt32LE(2835, 42);

  for (let index = 0; index < width * height; index += 1) {
    const source = index * 4;
    const target = pixelOffset + source;
    const alpha = rgba[source + 3];
    output[target] = Math.round((rgba[source + 2] * alpha) / 255);
    output[target + 1] = Math.round((rgba[source + 1] * alpha) / 255);
    output[target + 2] = Math.round((rgba[source] * alpha) / 255);
    output[target + 3] = alpha;
  }
  return output;
}

async function renderProgressTrack() {
  const border = await sharp({
    create: { width: 342, height: 16, channels: 4, background: "#b9cad8" },
  }).png().toBuffer();
  const inset = await sharp({
    create: { width: 340, height: 14, channels: 4, background: "#e8f1f6" },
  }).png().toBuffer();
  return sharp(border).composite([{ input: inset, left: 1, top: 1 }]).png().toBuffer();
}

async function renderProgressFill() {
  return sharp({
    create: { width: 4, height: 12, channels: 4, background: "#16aabd" },
  }).png().toBuffer();
}

async function main() {
  if (!fs.existsSync(sourcePath) || !fs.statSync(sourcePath).isFile()) {
    throw new Error("supplied star source asset is missing");
  }
  fs.mkdirSync(outputDir, { recursive: true });
  for (const name of fs.readdirSync(outputDir)) {
    if (/^star-.*\.(?:png|bmp)$/.test(name) || name === "wizard-back.png") {
      fs.rmSync(path.join(outputDir, name));
    }
  }
  fs.writeFileSync(
    path.join(outputDir, "star-base.bmp"),
    encodePremultipliedBmp(await renderStar(220, 0), 220, 220),
  );
  fs.writeFileSync(
    path.join(outputDir, "star-silver.bmp"),
    encodePremultipliedBmp(await renderStar(220, 1), 220, 220),
  );
  fs.writeFileSync(path.join(outputDir, "progress-track.png"), await renderProgressTrack());
  fs.writeFileSync(path.join(outputDir, "progress-fill.png"), await renderProgressFill());
}

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.message : "Inno brand asset generation failed"}\n`);
  process.exitCode = 1;
});
