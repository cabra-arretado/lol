import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import sharp from "sharp";

export async function generateBrandIcons(publicDir, writeOrCheck) {
  const root = resolve(publicDir, "../../..");
  const source = await readFile(resolve(root, "assets/lol-logo-source.png"));
  const metadata = await sharp(source).metadata();
  if (
    metadata.format !== "png" ||
    metadata.width !== metadata.height ||
    metadata.width < 512
  ) {
    throw new Error(
      "Unsupported logo source: expected an opaque square PNG at least 512 pixels wide.",
    );
  }
  const { data, info } = await sharp(source)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const masks = new Map();
  for (const color of ["#151515", "#fff", "#e5484d", "#ffdf00"]) {
    const rgb =
      color === "#fff"
        ? [255, 255, 255]
        : [1, 3, 5].map((index) =>
            Number.parseInt(color.slice(index, index + 2), 16),
          );
    const pixels = Buffer.from(data);
    for (let index = 0; index < pixels.length; index += 4) {
      if (data[index + 3] !== 255) {
        throw new Error("Unsupported logo source: expected an opaque PNG.");
      }
      pixels[index] = rgb[0];
      pixels[index + 1] = rgb[1];
      pixels[index + 2] = rgb[2];
      pixels[index + 3] = Math.round(
        Math.max(0, Math.min(255, (data[index] - data[index + 1] / 2) * 3)),
      );
    }
    masks.set(
      color,
      await sharp(pixels, {
        raw: { width: info.width, height: info.height, channels: 4 },
      })
        .png()
        .toBuffer(),
    );
  }
  const artwork = Buffer.from(data);
  for (let index = 0; index < artwork.length; index += 4) {
    artwork[index + 3] = Math.round(
      Math.max(
        0,
        Math.min(
          255,
          Math.max(
            (data[index] - data[index + 1] / 2) * 3,
            ((150 - data[index + 1]) * 255) / 40,
          ),
        ),
      ),
    );
  }
  masks.set(
    "artwork",
    await sharp(artwork, {
      raw: { width: info.width, height: info.height, channels: 4 },
    })
      .png()
      .toBuffer(),
  );
  const glyph = (color, x, y, size) =>
    `<image x="${x}" y="${y}" width="${size}" height="${size}" href="data:image/png;base64,${(color === "brand" ? source : masks.get(color)).toString("base64")}"/>`;
  const canvas = (content) =>
    Buffer.from(
      `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024">${content}</svg>`,
    );
  const render = (svg, size) => sharp(svg).resize(size, size).png().toBuffer();
  const renderSource = (size) =>
    sharp(source).resize(size, size).png().toBuffer();
  const tile = (background, color, grid = false) =>
    canvas(
      `<defs><clipPath id="tile"><rect x="88" y="88" width="848" height="848" rx="200"/></clipPath></defs>` +
        `<g clip-path="url(#tile)">` +
        `<rect x="88" y="88" width="848" height="848" rx="200" fill="${background}"/>` +
        (grid
          ? `<g clip-path="url(#tile)" stroke="#6b6b6b" stroke-width="3">${Array.from(
              { length: 7 },
              (_, i) => {
                const p = 192 + i * 106;
                return `<path d="M${p} 88V936M88 ${p}H936"/>`;
              },
            ).join("")}</g>`
          : "") +
        glyph(color, 88, 88, 848) +
        `</g>`,
    );
  const opaque = (size, branded = true) =>
    canvas(
      `<rect width="1024" height="1024" fill="${branded ? "#00ad21" : "#fff"}"/>${glyph(branded ? "artwork" : "#151515", (1024 - size) / 2, (1024 - size) / 2, size)}`,
    );
  const write = (path, content) => writeOrCheck(resolve(root, path), content);

  for (const [file, color] of [
    ["bb-logo.png", "brand"],
    ["bb-logo-white.png", "#fff"],
    ["bb-logo-dev.png", "#e5484d"],
  ]) {
    await write(
      `assets/${file}`,
      color === "brand"
        ? await renderSource(568)
        : await render(canvas(glyph(color, 0, 0, 1024)), 568),
    );
  }
  await write(
    "assets/bb-logo-black-white-bg-discord.png",
    await renderSource(1024),
  );

  for (const [suffix, color] of [
    ["", "brand"],
    ["-dark", "brand"],
    ["-dev", "#e5484d"],
    ["-monochrome", "#fff"],
  ]) {
    for (const size of [16, 32]) {
      await writeOrCheck(
        `favicon-${size}x${size}${suffix}.png`,
        color === "brand"
          ? await renderSource(size)
          : await render(canvas(glyph(color, 0, 0, 1024)), size),
      );
    }
  }
  for (const size of [192, 512]) {
    await writeOrCheck(`icon-${size}.png`, await renderSource(size));
    await writeOrCheck(
      `icon-${size}-maskable.png`,
      await render(opaque(800), size),
    );
  }
  await writeOrCheck("apple-touch-icon.png", await renderSource(180));

  for (const [suffix, svg] of [
    ["", tile("#00ad21", "brand")],
    ["-nightly", tile("#202020", "#ffdf00")],
    ["-dev", tile("#454545", "#fff", true)],
  ]) {
    await write(
      `apps/desktop/assets/icon${suffix}.png`,
      await render(svg, 1024),
    );
    if (suffix === "-dev") continue;
    const chunks = [];
    for (const [type, size] of [
      ["icp4", 16],
      ["icp5", 32],
      ["ic11", 32],
      ["ic12", 64],
      ["ic07", 128],
      ["ic13", 256],
      ["ic08", 256],
      ["ic14", 512],
      ["ic09", 512],
      ["ic10", 1024],
    ]) {
      const png = await render(svg, size);
      const header = Buffer.alloc(8);
      header.write(type);
      header.writeUInt32BE(png.length + 8, 4);
      chunks.push(header, png);
    }
    const header = Buffer.alloc(8);
    header.write("icns");
    header.writeUInt32BE(
      chunks.reduce((size, chunk) => size + chunk.length, 8),
      4,
    );
    await write(
      `apps/desktop/assets/icon${suffix}.icns`,
      Buffer.concat([header, ...chunks]),
    );
  }
  const tintSources = new Map();
  for (const size of [192, 512]) {
    tintSources.set(
      `icon-${size}.png`,
      await render(opaque(1024, false), size),
    );
    tintSources.set(
      `icon-${size}-maskable.png`,
      await render(opaque(800, false), size),
    );
  }
  tintSources.set(
    "apple-touch-icon.png",
    await render(opaque(1024, false), 180),
  );
  return tintSources;
}
