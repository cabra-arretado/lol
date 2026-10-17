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
const mark = await readFile(
  resolve(appDir, "../../assets/bb-logo.svg"),
  "utf8",
);

describe("brand icon source contract", () => {
  it.each([
    ["reformatted SVG root", mark.replace("<svg ", "<svg\n")],
    ["changed source color", mark.replace('fill="#151515"', 'fill="#000"')],
    [
      "inline fill style",
      mark.replace('fill="#151515"', 'style="fill:#151515"'),
    ],
    [
      "second uncolored path",
      mark.replace("</svg>", '<path d="M0 0H5V5Z"/></svg>'),
    ],
    ["multiple fills", mark.replace("<path ", '<path fill="#fff" ')],
  ])("rejects %s before writing any assets", async (_, source) => {
    const root = await mkdtemp(join(tmpdir(), "lol-brand-source-"));
    try {
      await mkdir(join(root, "assets"));
      await writeFile(join(root, "assets/bb-logo.svg"), source);
      let writes = 0;
      await expect(
        generateBrandIcons(join(root, "apps/app/public"), () => writes++),
      ).rejects.toThrow("Unsupported logo SVG");
      expect(writes).toBe(0);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("renders white and development glyphs with the same alpha silhouette as the dark mark", async () => {
    const outputs = new Map();
    await generateBrandIcons(publicDir, (file, content) =>
      outputs.set(file, content),
    );
    const alphaMasks = [];
    for (const [name, color] of [
      ["bb-logo.png", [21, 21, 21]],
      ["bb-logo-white.png", [255, 255, 255]],
      ["bb-logo-dev.png", [229, 72, 77]],
    ]) {
      const png = outputs.get(resolve(appDir, "../../assets", name));
      expect(png).toBeDefined();
      const { data } = await sharp(png)
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
      alphaMasks.push(Buffer.from(alpha));
    }
    expect(alphaMasks[1].equals(alphaMasks[0])).toBe(true);
    expect(alphaMasks[2].equals(alphaMasks[0])).toBe(true);
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
