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

export interface DaySlide {
  photo: ImageMetadata;
  mobile?: ImageMetadata;
  position: string;
  // Venue slides: the name with its place (bottom).
  venue?: { name: string; place: string };
  // Artist slides: the country (top left), the name and the time that day (bottom).
  artist?: { name: string; countryCode?: string; countryName?: string; time?: string };
}

interface SlideArtist {
  id: string;
  name: string;
  countryCode?: string;
  country?: Record<string, string>;
  photo: ImageMetadata;
  photoPosition: string;
  // The artist's time that day, when the agenda gives one.
  time?: string;
}

// Photos of a day for the journey frame: the venue's first, then the artists
// of the day's agenda (each once, in order).
export function daySlides(
  venue: { photos: ImageMetadata[]; position: string; positions?: string[]; name: string; place: string } | undefined,
  artists: SlideArtist[],
  fallback: { photo: ImageMetadata; name: string; place: string },
  lang: string
): DaySlide[] {
  const slides: DaySlide[] = (venue?.photos ?? []).map((photo, i) => ({
    photo,
    position: venue!.positions?.[i] ?? venue!.position,
    venue: { name: venue!.name, place: venue!.place },
  }));
  const seen = new Set<string>();
  for (const artist of artists) {
    if (seen.has(artist.id)) continue;
    seen.add(artist.id);
    slides.push({
      photo: artistPhoto(artist.id, artist.photo),
      mobile: artistPhotoMobile(artist.id),
      position: artist.photoPosition,
      artist: { name: artist.name, countryCode: artist.countryCode, countryName: artist.country?.[lang], time: artist.time },
    });
  }
  return slides.length
    ? slides
    : [{ photo: fallback.photo, position: "center", venue: { name: fallback.name, place: fallback.place } }];
}
