import { test } from "node:test";
import assert from "node:assert/strict";
import { spotifyEmbedUrl } from "../src/lib/spotify.ts";

test("builds the official embed URL for a valid artist id", () => {
  assert.equal(
    spotifyEmbedUrl("4zDDd9Y92qW2QH0DQ52rQW"),
    "https://open.spotify.com/embed/artist/4zDDd9Y92qW2QH0DQ52rQW?utm_source=generator&theme=0"
  );
});

test("rejects ids that are not 22 alphanumeric characters", () => {
  for (const bad of ["", undefined, null, "short", "../etc/passwd", "4zDDd9Y92qW2QH0DQ52rQ?", "4zDDd9Y92qW2QH0DQ52rQWX"]) {
    assert.equal(spotifyEmbedUrl(bad as string | undefined | null), null);
  }
});
