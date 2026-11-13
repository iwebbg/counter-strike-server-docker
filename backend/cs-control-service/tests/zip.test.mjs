import assert from "node:assert/strict";
import test from "node:test";
import { parseZip } from "../src/infrastructure/Zip.mjs";

function crc32(buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) crc = crc & 1 ? 0xedb88320 ^ (crc >>> 1) : crc >>> 1;
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function storedZip(entries) {
  const local = [];
  const central = [];
  let localOffset = 0;
  for (const [name, value] of entries) {
    const filename = Buffer.from(name);
    const content = Buffer.from(value);
    const crc = crc32(content);
    const localHeader = Buffer.alloc(30);
    localHeader.writeUInt32LE(0x04034b50, 0);
    localHeader.writeUInt16LE(20, 4);
    localHeader.writeUInt32LE(crc, 14);
    localHeader.writeUInt32LE(content.length, 18);
    localHeader.writeUInt32LE(content.length, 22);
    localHeader.writeUInt16LE(filename.length, 26);
    local.push(localHeader, filename, content);

    const centralHeader = Buffer.alloc(46);
    centralHeader.writeUInt32LE(0x02014b50, 0);
    centralHeader.writeUInt16LE(20, 4);
    centralHeader.writeUInt16LE(20, 6);
    centralHeader.writeUInt32LE(crc, 16);
    centralHeader.writeUInt32LE(content.length, 20);
    centralHeader.writeUInt32LE(content.length, 24);
    centralHeader.writeUInt16LE(filename.length, 28);
    centralHeader.writeUInt32LE(localOffset, 42);
    central.push(centralHeader, filename);
    localOffset += localHeader.length + filename.length + content.length;
  }
  const centralBuffer = Buffer.concat(central);
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);
  eocd.writeUInt16LE(entries.length, 8);
  eocd.writeUInt16LE(entries.length, 10);
  eocd.writeUInt32LE(centralBuffer.length, 12);
  eocd.writeUInt32LE(localOffset, 16);
  return Buffer.concat([...local, centralBuffer, eocd]);
}

test("reads stored ZIP map packages and verifies integrity", () => {
  const files = parseZip(
    storedZip([
      ["package/cstrike/maps/de_zip_test.bsp", "bsp"],
      ["package/cstrike/sound/test.wav", "sound"],
    ]),
  );
  assert.deepEqual(
    files.map((file) => [file.path, file.content.toString()]),
    [
      ["package/cstrike/maps/de_zip_test.bsp", "bsp"],
      ["package/cstrike/sound/test.wav", "sound"],
    ],
  );
});

test("rejects traversal and extraction limit violations", () => {
  assert.throws(() => parseZip(storedZip([["../server.cfg", "bad"]])), /Unsafe ZIP path/);
  assert.throws(() => parseZip(storedZip([["maps/de_big.bsp", "12345"]]), { maxFileBytes: 4 }), /file size limit/);
});
