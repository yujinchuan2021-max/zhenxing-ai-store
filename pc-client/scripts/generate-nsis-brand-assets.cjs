"use strict";

const fs = require("node:fs");
const path = require("node:path");
const sharp = require("sharp");

const root = path.resolve(__dirname, "..");
const buildDir = path.join(root, "build");
const frameDir = path.join(buildDir, "installer-brand");
const starPath = path.join(root, "assets", "brand", "zhenxing-star.png");

const palette = {
  ink: [7, 20, 33],
  slate: [18, 42, 59],
  cyan: [34, 211, 238],
  silver: [226, 232, 238],
};

const lerp = (from, to, amount) =>
  from.map((value, index) => Math.round(value + (to[index] - value) * amount));

const svgBackground = (width, height, accentX, accentY) => Buffer.from(`
  <svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
    <defs>
      <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stop-color="#071421"/>
        <stop offset="1" stop-color="#122a3b"/>
      </linearGradient>
      <radialGradient id="halo">
        <stop offset="0" stop-color="#e2e8ee" stop-opacity=".16"/>
        <stop offset="1" stop-color="#e2e8ee" stop-opacity="0"/>
      </radialGradient>
    </defs>
    <rect width="100%" height="100%" fill="url(#bg)"/>
    <circle cx="${accentX}" cy="${accentY}" r="${Math.round(Math.min(width, height) * 0.46)}" fill="url(#halo)"/>
  </svg>
`);

const encodeBmp24 = (pixels, width, height) => {
  const rowStride = (width * 3 + 3) & ~3;
  const pixelBytes = rowStride * height;
  const output = Buffer.alloc(54 + pixelBytes);
  output.write("BM", 0, "ascii");
  output.writeUInt32LE(output.length, 2);
  output.writeUInt32LE(54, 10);
  output.writeUInt32LE(40, 14);
  output.writeInt32LE(width, 18);
  output.writeInt32LE(height, 22);
  output.writeUInt16LE(1, 26);
  output.writeUInt16LE(24, 28);
  output.writeUInt32LE(pixelBytes, 34);
  output.writeInt32LE(3780, 38);
  output.writeInt32LE(3780, 42);

  for (let y = 0; y < height; y += 1) {
    const sourceRow = y * width * 3;
    const targetRow = 54 + (height - 1 - y) * rowStride;
    for (let x = 0; x < width; x += 1) {
      const source = sourceRow + x * 3;
      const target = targetRow + x * 3;
      output[target] = pixels[source + 2];
      output[target + 1] = pixels[source + 1];
      output[target + 2] = pixels[source];
    }
  }
  return output;
};

const makeStarLayer = async (size, brightness, twinkle = false) => {
  const alpha = await sharp(starPath)
    .resize(size, size, { fit: "contain" })
    .ensureAlpha()
    .extractChannel(3)
    .raw()
    .toBuffer();
  const alphaMask = async (factor) => {
    const rgba = Buffer.alloc(size * size * 4);
    for (let index = 0; index < alpha.length; index += 1) {
      const offset = index * 4;
      rgba[offset] = 255;
      rgba[offset + 1] = 255;
      rgba[offset + 2] = 255;
      rgba[offset + 3] = Math.min(255, Math.round(alpha[index] * factor));
    }
    return sharp(rgba, { raw: { width: size, height: size, channels: 4 } }).png().toBuffer();
  };
  const mask = await alphaMask(0.5 + brightness * 0.5);
  const softMask = await alphaMask(0.04 + brightness * 0.28 + (twinkle ? 0.18 : 0));
  const lift = (color, amount) => color.map((value) => Math.min(255, value + amount));
  const dark = lift(lerp([38, 44, 50], [89, 98, 107], brightness), twinkle ? 10 : 0);
  const body = lift(lerp([56, 63, 70], [184, 193, 201], brightness), twinkle ? 24 : 0);
  const reflection = lift(lerp([76, 84, 92], [255, 255, 255], brightness), twinkle ? 28 : 0);
  const metallic = Buffer.from(`
    <svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}">
      <defs>
        <linearGradient id="metal" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stop-color="rgb(${dark.join(",")})"/>
          <stop offset=".2" stop-color="rgb(${reflection.join(",")})"/>
          <stop offset=".42" stop-color="rgb(${body.join(",")})"/>
          <stop offset=".58" stop-color="rgb(${reflection.join(",")})"/>
          <stop offset=".78" stop-color="rgb(${body.join(",")})"/>
          <stop offset="1" stop-color="rgb(${dark.join(",")})"/>
        </linearGradient>
      </defs>
      <rect width="100%" height="100%" fill="url(#metal)"/>
    </svg>
  `);

  const star = await sharp(metallic)
    .composite([{ input: mask, blend: "dest-in" }])
    .png()
    .toBuffer();
  const glow = await sharp({
    create: {
      width: size,
      height: size,
      channels: 4,
      background: { r: palette.silver[0], g: palette.silver[1], b: palette.silver[2], alpha: 1 },
    },
  })
    .composite([{ input: softMask, blend: "dest-in" }])
    .blur(Math.max(1.2, size * 0.045))
    .png()
    .toBuffer();
  const shadow = await sharp({
    create: { width: size, height: size, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0.7 } },
  })
    .composite([{ input: mask, blend: "dest-in" }])
    .blur(Math.max(0.8, size * 0.018))
    .png()
    .toBuffer();

  return {
    shadow,
    glow,
    star,
  };
};

const render = async ({ width, height, starSize, starX, starY, brightness, twinkle = false }) => {
  const { shadow, glow, star } = await makeStarLayer(starSize, brightness, twinkle);
  const left = Math.round(starX - starSize / 2);
  const top = Math.round(starY - starSize / 2);
  const { data, info } = await sharp(svgBackground(width, height, starX, starY))
    .composite([
      { input: shadow, left: left + 1, top: top + 2, blend: "over" },
      { input: glow, left, top, blend: "screen" },
      { input: star, left, top, blend: "over" },
    ])
    .flatten({ background: { r: palette.ink[0], g: palette.ink[1], b: palette.ink[2] } })
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  if (info.channels !== 3) {
    throw new Error(`installer asset renderer produced ${info.channels} channels instead of RGB`);
  }
  return encodeBmp24(data, width, height);
};

const shellBackground = (size) => Buffer.from(`
  <svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}">
    <defs>
      <linearGradient id="glass" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stop-color="#102b3d"/>
        <stop offset="1" stop-color="#0a1b27"/>
      </linearGradient>
      <linearGradient id="edge" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stop-color="#4b8198" stop-opacity=".7"/>
        <stop offset="1" stop-color="#153648" stop-opacity=".9"/>
      </linearGradient>
    </defs>
    <rect width="100%" height="100%" fill="#071421"/>
    <rect x="78" y="318" width="464" height="262" rx="30" fill="url(#glass)" stroke="url(#edge)" stroke-width="2"/>
    <rect x="116" y="334" width="388" height="2" rx="1" fill="#22d3ee" fill-opacity=".32"/>
  </svg>
`);

const renderStarShell = async (brightness, twinkle = false) => {
  const size = 620;
  const starSize = twinkle ? 318 : 308;
  const starX = 310;
  const starY = 166;
  const { shadow, glow, star } = await makeStarLayer(starSize, brightness, twinkle);
  const left = Math.round(starX - starSize / 2);
  const top = Math.round(starY - starSize / 2);
  const { data, info } = await sharp(shellBackground(size))
    .composite([
      { input: shadow, left: left + 2, top: top + 4, blend: "over" },
      { input: glow, left, top, blend: "screen" },
      { input: star, left, top, blend: "over" },
    ])
    .flatten({ background: { r: palette.ink[0], g: palette.ink[1], b: palette.ink[2] } })
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  if (info.channels !== 3) {
    throw new Error(`star shell renderer produced ${info.channels} channels instead of RGB`);
  }
  return encodeBmp24(data, size, size);
};

const write = (target, bytes) => {
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, bytes);
};

async function main() {
  for (let index = 0; index < 8; index += 1) {
    const frame = await render({
      width: 150,
      height: 150,
      starSize: 132,
      starX: 75,
      starY: 74,
      brightness: index / 7,
    });
    write(path.join(frameDir, `star-${index}.bmp`), frame);
    write(
      path.join(frameDir, `star-${index}-twinkle.bmp`),
      await render({
        width: 150,
        height: 150,
        starSize: 138,
        starX: 75,
        starY: 74,
        brightness: index / 7,
        twinkle: true,
      })
    );
    write(path.join(frameDir, `star-shell-${index}.bmp`), await renderStarShell(index / 7));
    write(
      path.join(frameDir, `star-shell-${index}-twinkle.bmp`),
      await renderStarShell(index / 7, true)
    );
  }

  write(
    path.join(buildDir, "installerHeader.bmp"),
    await render({ width: 150, height: 57, starSize: 46, starX: 116, starY: 28, brightness: 0.46 })
  );
  write(
    path.join(buildDir, "installerSidebar.bmp"),
    await render({ width: 164, height: 314, starSize: 136, starX: 82, starY: 145, brightness: 0 })
  );
  write(
    path.join(buildDir, "uninstallerSidebar.bmp"),
    await render({ width: 164, height: 314, starSize: 136, starX: 82, starY: 145, brightness: 1 })
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
