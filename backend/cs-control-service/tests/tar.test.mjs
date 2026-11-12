import test from "node:test";
import assert from "node:assert/strict";
import { createTar } from "../src/infrastructure/Tar.mjs";

test("creates a padded ustar archive from validated resources", () => {
  const content = Buffer.from("custom-map");
  const archive = createTar([{ path: "maps/gg_test.bsp", content }]);
  assert.equal(archive.subarray(0, 100).toString("utf8").replaceAll("\0", ""), "maps/gg_test.bsp");
  assert.equal(Number.parseInt(archive.subarray(124, 136).toString("ascii"), 8), content.length);
  assert.equal(archive.subarray(257, 262).toString("ascii"), "ustar");
  assert.equal(archive.length % 512, 0);
  assert.equal(archive.subarray(512, 512 + content.length).toString(), "custom-map");
});
