import sharp from "sharp";

async function samePixels(first, second) {
  const [a, b] = await Promise.all(
    [first, second].map((input) =>
      sharp(input)
        .toColourspace("srgb")
        .ensureAlpha()
        .raw()
        .toBuffer({ resolveWithObject: true }),
    ),
  );
  return (
    a.info.width === b.info.width &&
    a.info.height === b.info.height &&
    a.data.equals(b.data)
  );
}

function icnsChunks(buffer) {
  if (
    buffer.length < 8 ||
    buffer.toString("ascii", 0, 4) !== "icns" ||
    buffer.readUInt32BE(4) !== buffer.length
  )
    return null;
  const chunks = new Map();
  for (let offset = 8; offset < buffer.length;) {
    if (offset + 8 > buffer.length) return null;
    const type = buffer.toString("ascii", offset, offset + 4);
    const length = buffer.readUInt32BE(offset + 4);
    if (length < 8 || offset + length > buffer.length || chunks.has(type))
      return null;
    chunks.set(type, buffer.subarray(offset + 8, offset + length));
    offset += length;
  }
  return chunks;
}

export async function brandAssetsEqual(fileName, existing, generated) {
  if (!existing) return false;
  if (existing.equals(generated)) return true;
  try {
    if (fileName.endsWith(".png")) return await samePixels(existing, generated);
    if (fileName.endsWith(".icns")) {
      const first = icnsChunks(existing);
      const second = icnsChunks(generated);
      if (!first || !second || first.size !== second.size) return false;
      for (const [type, content] of first) {
        const other = second.get(type);
        if (!other || !(await samePixels(content, other))) return false;
      }
      return true;
    }
  } catch {
    return false;
  }
  return false;
}
