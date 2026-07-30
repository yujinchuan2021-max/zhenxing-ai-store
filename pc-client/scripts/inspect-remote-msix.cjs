"use strict";

const { execFileSync } = require("node:child_process");
const { inflateRawSync } = require("node:zlib");

const EOCD_SIGNATURE = 0x06054b50;
const ZIP64_EOCD_SIGNATURE = 0x06064b50;
const ZIP64_LOCATOR_SIGNATURE = 0x07064b50;
const CENTRAL_DIRECTORY_SIGNATURE = 0x02014b50;
const LOCAL_FILE_SIGNATURE = 0x04034b50;
const MAX_TAIL_BYTES = 128 * 1024;

function usage() {
  console.error("Usage: node scripts/inspect-remote-msix.cjs <https-url>");
  process.exitCode = 1;
}

function resolveRemote(url) {
  const output = execFileSync(
    "curl.exe",
    [
      "-sS",
      "-L",
      "--fail",
      "-r",
      "0-0",
      "-A",
      "AI-Hub-MSIX-Audit/1.0",
      "-D",
      "-",
      "-o",
      "NUL",
      "-w",
      "\nAI_HUB_FINAL_URL:%{url_effective}\n",
      url
    ],
    { encoding: "utf8", maxBuffer: 2 * 1024 * 1024 }
  );
  const finalUrl = /AI_HUB_FINAL_URL:(.+)/.exec(output)?.[1]?.trim() || "";
  const contentRanges = [...output.matchAll(/content-range:\s*([^\r\n]+)/gi)];
  const contentRange = contentRanges.at(-1)?.[1]?.trim() || "";
  if (!finalUrl || !contentRange) {
    throw new Error("Server did not provide a final URL and Content-Range");
  }
  return { finalUrl, contentRange };
}

function fetchRange(url, start, end) {
  return execFileSync(
    "curl.exe",
    [
      "-sS",
      "--fail",
      "-r",
      `${start}-${end}`,
      "-A",
      "AI-Hub-MSIX-Audit/1.0",
      url
    ],
    { encoding: "buffer", maxBuffer: Math.max(2 * 1024 * 1024, end - start + 2) }
  );
}

function totalBytesFromRange(contentRange) {
  const match = /\/(\d+)$/.exec(contentRange);
  return match ? Number(match[1]) : 0;
}

function findEocd(buffer) {
  for (let offset = buffer.length - 22; offset >= 0; offset -= 1) {
    if (buffer.readUInt32LE(offset) === EOCD_SIGNATURE) return offset;
  }
  return -1;
}

function safeUInt64LE(buffer, offset) {
  const value = buffer.readBigUInt64LE(offset);
  if (value > BigInt(Number.MAX_SAFE_INTEGER)) {
    throw new Error("ZIP64 offset exceeds JavaScript safe integer range");
  }
  return Number(value);
}

function parseCentralDirectory(buffer) {
  const entries = [];
  let offset = 0;
  while (offset + 46 <= buffer.length) {
    if (buffer.readUInt32LE(offset) !== CENTRAL_DIRECTORY_SIGNATURE) break;
    const compressionMethod = buffer.readUInt16LE(offset + 10);
    const compressedSize32 = buffer.readUInt32LE(offset + 20);
    const uncompressedSize32 = buffer.readUInt32LE(offset + 24);
    const fileNameLength = buffer.readUInt16LE(offset + 28);
    const extraLength = buffer.readUInt16LE(offset + 30);
    const commentLength = buffer.readUInt16LE(offset + 32);
    const localHeaderOffset32 = buffer.readUInt32LE(offset + 42);
    const fileName = buffer
      .subarray(offset + 46, offset + 46 + fileNameLength)
      .toString("utf8");
    const extra = buffer.subarray(
      offset + 46 + fileNameLength,
      offset + 46 + fileNameLength + extraLength
    );
    let compressedSize = compressedSize32;
    let uncompressedSize = uncompressedSize32;
    let localHeaderOffset = localHeaderOffset32;
    let extraOffset = 0;
    while (extraOffset + 4 <= extra.length) {
      const headerId = extra.readUInt16LE(extraOffset);
      const dataSize = extra.readUInt16LE(extraOffset + 2);
      const data = extra.subarray(
        extraOffset + 4,
        extraOffset + 4 + dataSize
      );
      if (headerId === 0x0001) {
        let zip64Offset = 0;
        if (uncompressedSize32 === 0xffffffff) {
          uncompressedSize = safeUInt64LE(data, zip64Offset);
          zip64Offset += 8;
        }
        if (compressedSize32 === 0xffffffff) {
          compressedSize = safeUInt64LE(data, zip64Offset);
          zip64Offset += 8;
        }
        if (localHeaderOffset32 === 0xffffffff) {
          localHeaderOffset = safeUInt64LE(data, zip64Offset);
        }
        break;
      }
      extraOffset += 4 + dataSize;
    }
    entries.push({
      fileName,
      compressionMethod,
      compressedSize,
      uncompressedSize,
      localHeaderOffset
    });
    offset += 46 + fileNameLength + extraLength + commentLength;
  }
  return entries;
}

async function extractEntry(url, entry) {
  const header = fetchRange(
    url,
    entry.localHeaderOffset,
    entry.localHeaderOffset + 29
  );
  if (
    header.length < 30 ||
    header.readUInt32LE(0) !== LOCAL_FILE_SIGNATURE
  ) {
    throw new Error(`Invalid local header for ${entry.fileName}`);
  }
  const fileNameLength = header.readUInt16LE(26);
  const extraLength = header.readUInt16LE(28);
  const dataOffset =
    entry.localHeaderOffset + 30 + fileNameLength + extraLength;
  const data = fetchRange(url, dataOffset, dataOffset + entry.compressedSize - 1);
  if (entry.compressionMethod === 0) return data;
  if (entry.compressionMethod === 8) return inflateRawSync(data);
  throw new Error(
    `Unsupported compression method ${entry.compressionMethod} for ${entry.fileName}`
  );
}

function identityFromManifest(xml) {
  const identityTag = /<Identity\b[^>]*>/i.exec(xml)?.[0] || "";
  const attributes = {};
  for (const match of identityTag.matchAll(/([\w:.-]+)="([^"]*)"/g)) {
    attributes[match[1]] = match[2];
  }
  return attributes;
}

async function main() {
  const url = process.argv[2];
  if (!url || !/^https:\/\//i.test(url)) return usage();

  const remote = resolveRemote(url);
  const totalBytes = totalBytesFromRange(remote.contentRange);
  if (!Number.isSafeInteger(totalBytes) || totalBytes < 22) {
    throw new Error("Server did not provide a usable Content-Range");
  }

  const tailStart = Math.max(0, totalBytes - MAX_TAIL_BYTES);
  const tail = fetchRange(remote.finalUrl, tailStart, totalBytes - 1);
  const eocdOffset = findEocd(tail);
  if (eocdOffset < 0) throw new Error("MSIX end-of-central-directory not found");

  let centralSize = tail.readUInt32LE(eocdOffset + 12);
  let centralOffset = tail.readUInt32LE(eocdOffset + 16);
  if (centralSize === 0xffffffff || centralOffset === 0xffffffff) {
    const locatorOffset = eocdOffset - 20;
    if (
      locatorOffset < 0 ||
      tail.readUInt32LE(locatorOffset) !== ZIP64_LOCATOR_SIGNATURE
    ) {
      throw new Error("ZIP64 end-of-central-directory locator not found");
    }
    const zip64Offset = safeUInt64LE(tail, locatorOffset + 8);
    const zip64 = fetchRange(remote.finalUrl, zip64Offset, zip64Offset + 55);
    if (zip64.readUInt32LE(0) !== ZIP64_EOCD_SIGNATURE) {
      throw new Error("ZIP64 end-of-central-directory record is invalid");
    }
    centralSize = safeUInt64LE(zip64, 40);
    centralOffset = safeUInt64LE(zip64, 48);
  }
  const central = fetchRange(
    remote.finalUrl,
    centralOffset,
    centralOffset + centralSize - 1
  );
  const entries = parseCentralDirectory(central);
  const manifestEntry = entries.find(
    (entry) => entry.fileName.toLowerCase() === "appxmanifest.xml"
  );
  const signatureEntry = entries.find(
    (entry) => entry.fileName.toLowerCase() === "appxsignature.p7x"
  );
  if (!manifestEntry || !signatureEntry) {
    throw new Error("Required MSIX identity or signature entry is missing");
  }

  const manifest = (await extractEntry(remote.finalUrl, manifestEntry)).toString(
    "utf8"
  );
  const identity = identityFromManifest(manifest);
  console.log(
    JSON.stringify(
      {
        sourceUrl: url,
        finalUrl: remote.finalUrl,
        totalBytes,
        identity,
        signatureEntry: {
          fileName: signatureEntry.fileName,
          compressedSize: signatureEntry.compressedSize,
          uncompressedSize: signatureEntry.uncompressedSize
        }
      },
      null,
      2
    )
  );
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
