// Web-optimized artist portraits (see .agents/plans/d16-gemini-prompts.md):
// "<artist-id>-web-v.jpg" (4:5, desktop and every 4:5 card) and
// "<artist-id>-web-h.jpg" (16:10, the phone journey frame). Both are optional;
// the artist's own `photo` is used until they exist.
import type { ImageMetadata } from "astro";

const files = import.meta.glob<ImageMetadata>("/src/assets/img/2027/artistas/*-web-[vh].jpg", {
  eager: true,
  import: "default",
});

function webFile(id: string, kind: "v" | "h"): ImageMetadata | undefined {
  return files[`/src/assets/img/2027/artistas/${id}-web-${kind}.jpg`];
}

// Portrait for 4:5 frames.
export function artistPhoto(id: string, fallback: ImageMetadata): ImageMetadata {
  return webFile(id, "v") ?? fallback;
}

// Horizontal version for the phone journey frame, if it exists.
export function artistPhotoMobile(id: string): ImageMetadata | undefined {
  return webFile(id, "h");
}
