function octal(value, length) {
  return `${Math.max(0, value)
    .toString(8)
    .padStart(length - 1, "0")}\0`;
}

function writeString(buffer, offset, length, value) {
  buffer.write(String(value).slice(0, length), offset, length, "utf8");
}

export function createTar(files) {
  const chunks = [];
  for (const file of files) {
    const name = String(file.path);
    const content = Buffer.isBuffer(file.content) ? file.content : Buffer.from(file.content);
    if (!name || Buffer.byteLength(name) > 100) throw new Error(`Tar path is too long: ${name}`);
    const header = Buffer.alloc(512);
    writeString(header, 0, 100, name);
    writeString(header, 100, 8, octal(0o644, 8));
    writeString(header, 108, 8, octal(1000, 8));
    writeString(header, 116, 8, octal(1000, 8));
    writeString(header, 124, 12, octal(content.length, 12));
    writeString(header, 136, 12, octal(Math.floor(Date.now() / 1000), 12));
    header.fill(0x20, 148, 156);
    header[156] = "0".charCodeAt(0);
    writeString(header, 257, 6, "ustar\0");
    writeString(header, 263, 2, "00");
    writeString(header, 265, 32, "hlds");
    writeString(header, 297, 32, "hlds");
    const checksum = [...header].reduce((sum, byte) => sum + byte, 0);
    writeString(header, 148, 8, `${checksum.toString(8).padStart(6, "0")}\0 `);
    chunks.push(header, content);
    const remainder = content.length % 512;
    if (remainder) chunks.push(Buffer.alloc(512 - remainder));
  }
  chunks.push(Buffer.alloc(1024));
  return Buffer.concat(chunks);
}
