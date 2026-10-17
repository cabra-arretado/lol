import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import sharp from "sharp";

export async function generateBrandIcons(publicDir, writeOrCheck) {
  const root = resolve(publicDir, "../../..");
  const mark = await readFile(resolve(root, "assets/bb-logo.svg"), "utf8");
  if (
    mark.split("<svg ").length !== 2 ||
    mark.split('fill="#151515"').length !== 2 ||
    [...mark.matchAll(/<path\b/g)].length !== 1 ||
    [...mark.matchAll(/\bfill\s*=/g)].length !== 1 ||
    /<style\b|\bstyle\s*=/.test(mark)
  ) {
    throw new Error(
      'Unsupported logo SVG: expected one <svg root and one path with fill="#151515", without inline styles. Update the icon generator when changing this structure.',
    );
  }
  const glyph = (color, x, y, size) =>
    mark
      .replace(
        "<svg ",
        `<svg x="${x}" y="${y}" width="${size}" height="${size}" `,
      )
      .replace('fill="#151515"', `fill="${color}"`);
  const canvas = (content) =>
    Buffer.from(
      `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024">${content}</svg>`,
    );
  const render = (svg, size) => sharp(svg).resize(size, size).png().toBuffer();
  const tile = (background, color, grid = false) =>
    canvas(
      `<defs><clipPath id="tile"><rect x="88" y="88" width="848" height="848" rx="200"/></clipPath></defs>` +
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
        glyph(color, 202, 202, 620),
    );
  const opaque = (size) =>
    canvas(
      `<rect width="1024" height="1024" fill="#fff"/>${glyph("#151515", (1024 - size) / 2, (1024 - size) / 2, size)}`,
    );
  const write = (path, content) => writeOrCheck(resolve(root, path), content);

  for (const [file, color] of [
    ["bb-logo.png", "#151515"],
    ["bb-logo-white.png", "#fff"],
    ["bb-logo-dev.png", "#e5484d"],
  ]) {
    await write(
      `assets/${file}`,
      await render(canvas(glyph(color, 0, 0, 1024)), 568),
    );
  }
  await write(
    "assets/bb-logo-black-white-bg-discord.png",
    await render(opaque(720), 1024),
  );

  for (const [suffix, color] of [
    ["", "#151515"],
    ["-dark", "#fff"],
    ["-dev", "#e5484d"],
  ]) {
    for (const size of [16, 32]) {
      await writeOrCheck(
        `favicon-${size}x${size}${suffix}.png`,
        await render(canvas(glyph(color, 0, 0, 1024)), size),
      );
    }
  }
  for (const size of [192, 512]) {
    await writeOrCheck(`icon-${size}.png`, await render(opaque(720), size));
    await writeOrCheck(
      `icon-${size}-maskable.png`,
      await render(opaque(600), size),
    );
  }
  await writeOrCheck("apple-touch-icon.png", await render(opaque(720), 180));

  for (const [suffix, svg] of [
    ["", tile("#fff", "#151515")],
    ["-nightly", tile("#202020", "#fff")],
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
}
