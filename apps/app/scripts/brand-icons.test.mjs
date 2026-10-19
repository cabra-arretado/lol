import {
  mkdtemp,
  mkdir,
  readFile,
  rm,
  writeFile,
  readdir,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";
import { describe, expect, it } from "vitest";
import { generateBrandIcons } from "./generate-brand-icons.mjs";
import { brandAssetsEqual } from "./brand-assets-equal.mjs";

const appDir = fileURLToPath(new URL("..", import.meta.url));
const publicDir = join(appDir, "public");
const source = await readFile(
  resolve(appDir, "../../assets/lol-logo-source.png"),
);

describe("brand icon source contract", () => {
  it.each([
    [
      "non-square image",
      { width: 1024, height: 512, channels: 3, background: "#00ad21" },
    ],
    [
      "undersized image",
      { width: 128, height: 128, channels: 3, background: "#00ad21" },
    ],
    [
      "transparent image",
      { width: 512, height: 512, channels: 4, background: "#0000" },
    ],
  ])("rejects %s before writing any assets", async (_, create) => {
    const root = await mkdtemp(join(tmpdir(), "lol-brand-source-"));
    try {
      await mkdir(join(root, "assets"));
      await writeFile(
        join(root, "assets/lol-logo-source.png"),
        await sharp({ create }).png().toBuffer(),
      );
      let writes = 0;
      await expect(
        generateBrandIcons(join(root, "apps/app/public"), () => writes++),
      ).rejects.toThrow("Unsupported logo source");
      expect(writes).toBe(0);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("preserves the selected artwork and derives transparent glyphs without the green tile", async () => {
    const outputs = new Map();
    const tintSources = await generateBrandIcons(publicDir, (file, content) =>
      outputs.set(file, content),
    );
    const brand = outputs.get(resolve(appDir, "../../assets/bb-logo.png"));
    const selected = await sharp(source)
      .resize(568, 568)
      .ensureAlpha()
      .raw()
      .toBuffer();
    const rendered = await sharp(brand).ensureAlpha().raw().toBuffer();
    expect(rendered.equals(selected)).toBe(true);
    const alphaMasks = [];
    for (const [name, color] of [
      ["bb-logo-white.png", [255, 255, 255]],
      ["bb-logo-dev.png", [229, 72, 77]],
    ]) {
      const png = outputs.get(resolve(appDir, "../../assets", name));
      const { data, info } = await sharp(png)
        .ensureAlpha()
        .raw()
        .toBuffer({ resolveWithObject: true });
      const alpha = [];
      let solidPixels = 0;
      let incorrectPixels = 0;
      for (let i = 0; i < data.length; i += 4) {
        alpha.push(data[i + 3]);
        if (data[i + 3] === 255) {
          solidPixels++;
          if (color.some((channel, offset) => data[i + offset] !== channel))
            incorrectPixels++;
        }
      }
      expect(solidPixels).toBeGreaterThan(1000);
      expect(incorrectPixels).toBe(0);
      expect(data[3]).toBe(0);
      expect(
        data[((info.height - 1) * info.width + info.width - 1) * 4 + 3],
      ).toBe(0);
      alphaMasks.push(Buffer.from(alpha));
    }
    expect(alphaMasks[1].equals(alphaMasks[0])).toBe(true);
    const maskable = await sharp(tintSources.get("icon-512-maskable.png"))
      .removeAlpha()
      .raw()
      .toBuffer();
    let outsideSafeArea = 0;
    let glyphPixels = 0;
    for (let y = 0; y < 512; y++) {
      for (let x = 0; x < 512; x++) {
        if (maskable[(y * 512 + x) * 3] < 245) {
          glyphPixels++;
          if (Math.hypot(x - 255.5, y - 255.5) > 204.8) outsideSafeArea++;
        }
      }
    }
    expect(glyphPixels).toBeGreaterThan(1000);
    expect(outsideSafeArea).toBe(0);
  });
});

function icns(representations) {
  const chunks = representations.flatMap(([type, png]) => {
    const header = Buffer.alloc(8);
    header.write(type);
    header.writeUInt32BE(png.length + 8, 4);
    return [header, png];
  });
  const header = Buffer.alloc(8);
  header.write("icns");
  header.writeUInt32BE(
    chunks.reduce((size, chunk) => size + chunk.length, 8),
    4,
  );
  return Buffer.concat([header, ...chunks]);
}

describe("portable asset comparisons", () => {
  const image = {
    create: { width: 32, height: 32, channels: 4, background: "#e5484d" },
  };

  it("accepts PNGs with identical pixels and different encoding", async () => {
    const first = await sharp(image).png({ compressionLevel: 0 }).toBuffer();
    const second = await sharp(image)
      .withMetadata({ density: 144 })
      .png({ compressionLevel: 9 })
      .toBuffer();
    expect(first.equals(second)).toBe(false);
    expect(await brandAssetsEqual("icon.png", first, second)).toBe(true);
    expect(
      await brandAssetsEqual("icon.png", Buffer.from("corrupt"), second),
    ).toBe(false);
    expect(await brandAssetsEqual("icon.png", null, second)).toBe(false);
    const changed = await sharp(image)
      .negate({ alpha: false })
      .png()
      .toBuffer();
    const resized = await sharp(image).resize(16).png().toBuffer();
    expect(await brandAssetsEqual("icon.png", first, changed)).toBe(false);
    expect(await brandAssetsEqual("icon.png", first, resized)).toBe(false);
  });

  it("compares ICNS pixels and representation types independently of encoding and order", async () => {
    const first = await sharp(image).png({ compressionLevel: 0 }).toBuffer();
    const second = await sharp(image).png({ compressionLevel: 9 }).toBuffer();
    const original = icns([
      ["icp5", first],
      ["ic11", first],
    ]);
    const reencoded = icns([
      ["ic11", second],
      ["icp5", second],
    ]);
    expect(await brandAssetsEqual("icon.icns", original, reencoded)).toBe(true);
    expect(
      await brandAssetsEqual("icon.icns", original, icns([["icp5", second]])),
    ).toBe(false);
    expect(
      await brandAssetsEqual(
        "icon.icns",
        original,
        icns([
          ["icp5", second],
          ["ic12", second],
        ]),
      ),
    ).toBe(false);
    const changed = await sharp(image)
      .negate({ alpha: false })
      .png()
      .toBuffer();
    expect(
      await brandAssetsEqual(
        "icon.icns",
        original,
        icns([
          ["icp5", changed],
          ["ic11", second],
        ]),
      ),
    ).toBe(false);
    const malformed = Buffer.from(original);
    malformed.writeUInt32BE(0, 12);
    expect(await brandAssetsEqual("icon.icns", malformed, original)).toBe(
      false,
    );
    expect(
      await brandAssetsEqual("icon.icns", original.subarray(0, -1), original),
    ).toBe(false);
  });

  it("keeps manifest comparisons exact", async () => {
    expect(
      await brandAssetsEqual(
        "manifest.webmanifest",
        Buffer.from('{"name":"bb"}'),
        Buffer.from('{"name":"lol"}'),
      ),
    ).toBe(false);
  });
});

it("keeps all install names and colored manifests in sync with the lol web shell", async () => {
  const base = JSON.parse(
    await readFile(join(publicDir, "manifest.webmanifest"), "utf8"),
  );
  expect(base.name).toBe("lol");
  expect(base.short_name).toBe("lol");
  const manifests = (await readdir(publicDir)).filter((file) =>
    file.endsWith(".webmanifest"),
  );
  expect(manifests).toHaveLength(9);
  for (const file of manifests) {
    const manifest = JSON.parse(await readFile(join(publicDir, file), "utf8"));
    const suffix = file.slice("manifest".length, -".webmanifest".length);
    expect(manifest).toEqual({
      ...base,
      icons: base.icons.map((icon) =>
        icon.purpose === "monochrome"
          ? icon
          : { ...icon, src: icon.src.replace(/\.png$/, `${suffix}.png`) },
      ),
    });
  }
  const html = await readFile(join(appDir, "index.html"), "utf8");
  expect(html).toContain("<title>lol</title>");
  expect(html).toContain(
    '<meta name="apple-mobile-web-app-title" content="lol" />',
  );
});
