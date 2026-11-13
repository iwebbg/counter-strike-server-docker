import { inflateRawSync } from "node:zlib";

const signatures = {
  central: 0x02014b50,
  eocd: 0x06054b50,
  local: 0x04034b50,
};

let crcTable = null;
function crc32(buffer) {
  if (!crcTable) {
    crcTable = Array.from({ length: 256 }, (_, value) => {
      let crc = value;
      for (let bit = 0; bit < 8; bit += 1) crc = crc & 1 ? 0xedb88320 ^ (crc >>> 1) : crc >>> 1;
      return crc >>> 0;
    });
  }
  let crc = 0xffffffff;
  for (const byte of buffer) crc = crcTable[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function safePath(value) {
  const normalized = value.replaceAll("\\", "/");
  const parts = normalized.split("/");
  if (
    !normalized ||
    normalized.startsWith("/") ||
    /^[a-zA-Z]:/.test(normalized) ||
    parts.some((part) => part === ".." || part === "." || /[\u0000-\u001f]/.test(part))
  ) {
    throw new Error(`Unsafe ZIP path: ${value || "(empty)"}`);
  }
  return normalized;
}

function findEocd(archive) {
  const minimum = Math.max(0, archive.length - 65_557);
  for (let offset = archive.length - 22; offset >= minimum; offset -= 1) {
    if (archive.readUInt32LE(offset) === signatures.eocd) return offset;
  }
  throw new Error("Invalid ZIP archive: end record was not found");
}

export function parseZip(archive, limits = {}) {
  const maxArchiveBytes = limits.maxArchiveBytes ?? 48 * 1024 * 1024;
  const maxFiles = limits.maxFiles ?? 128;
  const maxFileBytes = limits.maxFileBytes ?? 32 * 1024 * 1024;
  const maxTotalBytes = limits.maxTotalBytes ?? 32 * 1024 * 1024;
  const maxCompressionRatio = limits.maxCompressionRatio ?? 200;
  if (!Buffer.isBuffer(archive) || archive.length < 22) throw new Error("ZIP archive is empty or invalid");
  if (archive.length > maxArchiveBytes) throw new Error("ZIP archive exceeds the compressed size limit");

  const eocd = findEocd(archive);
  const disk = archive.readUInt16LE(eocd + 4);
  const centralDisk = archive.readUInt16LE(eocd + 6);
  const diskEntries = archive.readUInt16LE(eocd + 8);
  const totalEntries = archive.readUInt16LE(eocd + 10);
  const centralSize = archive.readUInt32LE(eocd + 12);
  const centralOffset = archive.readUInt32LE(eocd + 16);
  if (disk || centralDisk || diskEntries !== totalEntries)
    throw new Error("Multi-volume ZIP archives are not supported");
  if (totalEntries === 0xffff || centralSize === 0xffffffff || centralOffset === 0xffffffff) {
    throw new Error("ZIP64 archives are not supported");
  }
  if (totalEntries > maxFiles || centralOffset + centralSize > eocd) throw new Error("ZIP archive index is invalid");

  const files = [];
  const names = new Set();
  let totalBytes = 0;
  let offset = centralOffset;
  for (let index = 0; index < totalEntries; index += 1) {
    if (offset + 46 > archive.length || archive.readUInt32LE(offset) !== signatures.central) {
      throw new Error("ZIP central directory is invalid");
    }
    const flags = archive.readUInt16LE(offset + 8);
    const method = archive.readUInt16LE(offset + 10);
    const expectedCrc = archive.readUInt32LE(offset + 16);
    const compressedSize = archive.readUInt32LE(offset + 20);
    const uncompressedSize = archive.readUInt32LE(offset + 24);
    const nameLength = archive.readUInt16LE(offset + 28);
    const extraLength = archive.readUInt16LE(offset + 30);
    const commentLength = archive.readUInt16LE(offset + 32);
    const diskStart = archive.readUInt16LE(offset + 34);
    const externalAttributes = archive.readUInt32LE(offset + 38);
    const localOffset = archive.readUInt32LE(offset + 42);
    const entryEnd = offset + 46 + nameLength + extraLength + commentLength;
    if (entryEnd > archive.length || diskStart !== 0) throw new Error("ZIP entry index is invalid");
    const name = safePath(archive.subarray(offset + 46, offset + 46 + nameLength).toString("utf8"));
    offset = entryEnd;
    if (name.endsWith("/")) continue;
    if (flags & 0x1) throw new Error(`Encrypted ZIP entries are not supported: ${name}`);
    if (![0, 8].includes(method)) throw new Error(`Unsupported ZIP compression method for ${name}`);
    const unixMode = (externalAttributes >>> 16) & 0xf000;
    if (unixMode === 0xa000) throw new Error(`ZIP symbolic links are not supported: ${name}`);
    if (uncompressedSize > maxFileBytes) throw new Error(`ZIP entry exceeds the file size limit: ${name}`);
    totalBytes += uncompressedSize;
    if (totalBytes > maxTotalBytes) throw new Error("ZIP package exceeds the extracted size limit");
    if (uncompressedSize > 0 && compressedSize === 0) throw new Error(`Invalid compressed size for ${name}`);
    if (compressedSize && uncompressedSize / compressedSize > maxCompressionRatio) {
      throw new Error(`ZIP entry exceeds the compression ratio limit: ${name}`);
    }
    const key = name.toLowerCase();
    if (names.has(key)) throw new Error(`Duplicate ZIP entry: ${name}`);
    names.add(key);

    if (localOffset + 30 > archive.length || archive.readUInt32LE(localOffset) !== signatures.local) {
      throw new Error(`ZIP local header is invalid for ${name}`);
    }
    const localNameLength = archive.readUInt16LE(localOffset + 26);
    const localExtraLength = archive.readUInt16LE(localOffset + 28);
    const dataOffset = localOffset + 30 + localNameLength + localExtraLength;
    if (dataOffset + compressedSize > archive.length) throw new Error(`ZIP data is truncated for ${name}`);
    const compressed = archive.subarray(dataOffset, dataOffset + compressedSize);
    const content =
      method === 0 ? Buffer.from(compressed) : inflateRawSync(compressed, { maxOutputLength: maxFileBytes });
    if (content.length !== uncompressedSize || crc32(content) !== expectedCrc) {
      throw new Error(`ZIP integrity check failed for ${name}`);
    }
    files.push({ path: name, content });
  }
  if (!files.length) throw new Error("ZIP package does not contain files");
  return files;
}
