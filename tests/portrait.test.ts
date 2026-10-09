import test from "node:test";
import assert from "node:assert/strict";
import { isPortrait } from "../src/lib/portrait";

test("isPortrait accepts small image data URLs only", () => {
  assert.equal(isPortrait("data:image/jpeg;base64,/9j/4AAQSkZJRg=="), true);
  assert.equal(isPortrait("data:image/svg+xml;base64,PHN2Zz4="), false);
  assert.equal(isPortrait("https://example.com/a.jpg"), false);
  assert.equal(isPortrait("data:image/jpeg;base64," + "A".repeat(300_000)), false);
  assert.equal(isPortrait(undefined), false);
});
