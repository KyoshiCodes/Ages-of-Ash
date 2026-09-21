/** Deterministic original SVG placeholders; paths use only fixed content IDs. */
import { mkdirSync, writeFileSync } from "node:fs";
import { deflateSync } from "node:zlib";
import { eras } from "../packages/gamedata/src/index.ts";
mkdirSync("apps/web/public/icons", { recursive: true });
for (const era of eras)
  writeFileSync(
    `apps/web/public/icons/era-${era.id}.svg`,
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128"><rect width="128" height="128" rx="20" fill="#121716"/><g fill="none" stroke="${era.accent}" stroke-width="3"><circle cx="64" cy="64" r="44"/><path d="M64 24 101 88H27Z"/><path d="M64 44 81 76H47Z" transform="rotate(${era.id * 90} 64 64)"/></g></svg>\n`,
  );
// PNG fallback makes the install manifest work on browsers that reject SVG app icons.
function crc32(bytes: Buffer) {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit++)
      crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
  }
  return (crc ^ 0xffffffff) >>> 0;
}
function chunk(type: string, data: Buffer) {
  const tag = Buffer.from(type);
  const size = Buffer.alloc(4);
  size.writeUInt32BE(data.length);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([tag, data])));
  return Buffer.concat([size, tag, data, crc]);
}
for (const size of [192, 512]) {
  const raw = Buffer.alloc((size * 4 + 1) * size);
  for (let y = 0; y < size; y++)
    for (let x = 0; x < size; x++) {
      const px = x / size,
        py = y / size;
      const inside =
        py > 0.18 && py < 0.8 && Math.abs(px - 0.5) < (py - 0.18) * 0.52;
      const inner =
        py > 0.28 && py < 0.75 && Math.abs(px - 0.5) < (py - 0.28) * 0.48;
      const mark = inside && !inner;
      const offset = y * (size * 4 + 1) + 1 + x * 4;
      raw.set(mark ? [232, 173, 99, 255] : [18, 23, 22, 255], offset);
    }
  const header = Buffer.alloc(13);
  header.writeUInt32BE(size, 0);
  header.writeUInt32BE(size, 4);
  header[8] = 8;
  header[9] = 6;
  writeFileSync(
    `apps/web/public/icons/app-${size}.png`,
    Buffer.concat([
      Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
      chunk("IHDR", header),
      chunk("IDAT", deflateSync(raw)),
      chunk("IEND", Buffer.alloc(0)),
    ]),
  );
}
