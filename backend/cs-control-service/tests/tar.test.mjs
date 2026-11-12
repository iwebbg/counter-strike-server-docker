import test from "node:test";
import assert from "node:assert/strict";
import { createTar, parseTar } from "../src/infrastructure/Tar.mjs";

test("creates a padded ustar archive from validated resources", () => {
  const content = Buffer.from("custom-map");
  const archive = createTar([{ path: "maps/gg_test.bsp", content }]);
  assert.equal(archive.subarray(0, 100).toString("utf8").replaceAll("\0", ""), "maps/gg_test.bsp");
  assert.equal(Number.parseInt(archive.subarray(124, 136).toString("ascii"), 8), content.length);
  assert.equal(archive.subarray(257, 262).toString("ascii"), "ustar");
  assert.equal(archive.length % 512, 0);
  assert.equal(archive.subarray(512, 512 + content.length).toString(), "custom-map");
});

test("parses regular files and rejects unsafe TAR paths", () => {
  const archive = createTar([
    { path: "manifest.json", content: Buffer.from('{"version":1}') },
    { path: "amxx-data.tar", content: Buffer.from("nested") },
  ]);
  const files = parseTar(archive);
  assert.equal(files.get("manifest.json").toString(), '{"version":1}');
  assert.equal(files.get("amxx-data.tar").toString(), "nested");

  const unsafe = createTar([{ path: "safe.txt", content: Buffer.from("bad") }]);
  unsafe.write("../bad", 0, 6, "utf8");
  assert.throws(() => parseTar(unsafe), /Unsafe backup archive path/);
});
