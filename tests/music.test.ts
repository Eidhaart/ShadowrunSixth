/* eslint-disable @typescript-eslint/ban-ts-comment */
// @ts-nocheck -- loose fixtures against the plain JS relay module
import test from "node:test";
import assert from "node:assert/strict";
import { emptyTable, opsForPlayer, permitted, viewFor } from "../server/vtt.mjs";
import { trackFromUrl, youtubeId } from "../src/lib/audio/table";

test("YouTube links of every shape give the video id", () => {
  for (const u of ["https://youtu.be/dQw4w9WgXcQ", "https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=30", "youtube.com/shorts/dQw4w9WgXcQ", "https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ"]) assert.equal(youtubeId(u), "dQw4w9WgXcQ");
  assert.equal(youtubeId("https://example.com/song.mp3"), null);
});

test("pasted links become tracks or a clear reason", () => {
  assert.equal(trackFromUrl("https://youtu.be/dQw4w9WgXcQ").kind, "youtube");
  const a = trackFromUrl("https://files.example.com/sprawl%20theme.mp3");
  assert.equal(a.kind, "audio");
  assert.equal(a.title, "sprawl theme.mp3");
  assert.ok("error" in trackFromUrl("http://insecure.example.com/a.mp3"));
  assert.ok("error" in trackFromUrl("just words"));
});

test("only the GM sets the music; players receive it", () => {
  const t = emptyTable();
  t.music = { track: { id: "x", kind: "ambient", src: "rain", title: "Rain" }, startedAt: 1, paused: false, pos: 0, volume: 0.8, ambience: { club: 0.5 } };
  assert.equal(permitted(t, { k: "set", p: ["music"], v: null }, "alice", false), false);
  assert.equal(permitted(t, { k: "set", p: ["music"], v: null }, "gm", true), true);
  assert.equal(viewFor(t, { role: "player" }).music.track.src, "rain");
  const ops = opsForPlayer(t, t, [{ k: "set", p: ["music"], v: t.music }], { role: "player", assetsSent: new Set() });
  assert.deepEqual(ops[0].v.ambience, { club: 0.5 });
});
