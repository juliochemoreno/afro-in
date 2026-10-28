import { glob } from "astro/loaders";
import { defineCollection, reference, z } from "astro:content";

const blog = defineCollection({
  // Load Markdown and MDX files in the `src/content/blog/` directory.
  loader: glob({ base: "./src/content/blog", pattern: "**/*.{md,mdx}" }),
  // Type-check frontmatter using a schema
  schema: z.object({
    title: z.string(),
    description: z.string(),
    // Transform string to Date object
    pubDate: z.coerce.date(),
    updatedDate: z.coerce.date().optional(),
    heroImage: z.string().optional(),
  }),
});

const tour2026 = defineCollection({
  loader: glob({ base: "./src/content/tour2026", pattern: "**/*.{md,mdx}" }),
  schema: ({ image }) =>
    z.object({
      name: z.string(),
      dates: z.string(),
      location: z.string(),
      badge: z.string(),
      order: z.number(),
      heroImage: image(),
      sliderImages: z.array(image()).optional(),
      gallery: z.array(image()).optional(),
      schedule: z.array(
        z.object({
          day: z.string(),
          month: z.string(),
          weekday: z.string(),
          venue: z.string(),
          venueSubtitle: z.string().optional(),
          mapUrl: z.string().optional(),
          image: image().optional(),
          activities: z.array(
            z.object({
              time: z.string(),
              title: z.string(),
              artist: z.string().optional(),
              artistImage: image().optional(),
              description: z.string().optional(),
              activityType: z
                .enum([
                  "concierto",
                  "dj",
                  "workshop",
                  "pool",
                  "cultural",
                  "gastronomia",
                  "fiesta",
                  "viaje",
                ])
                .optional(),
            })
          ),
        })
      ),
      stats: z
        .object({
          days: z.number(),
          venues: z.number(),
          activities: z.number(),
        })
        .optional(),
      tribute: z.string().optional(),
    }),
});

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

const artists2027 = defineCollection({
  loader: glob({ base: "./src/content/artists2027", pattern: "**/*.md" }),
  schema: ({ image }) =>
    z.object({
      name: z.string(),
      countryCode: z.string().regex(/^[A-Z]{2}$/),
      country: z.object({ es: z.string(), en: z.string(), fr: z.string() }),
      photo: image(),
      order: z.number(),
      // The edition's star artist, shown in its own block.
      featured: z.boolean().default(false),
    }),
});

const tour2027 = defineCollection({
  loader: glob({ base: "./src/content/tour2027", pattern: "**/*.{md,mdx}" }),
  schema: ({ image }) =>
    z.object({
      name: z.string(),
      startDate: isoDate,
      endDate: isoDate,
      location: z.string(),
      order: z.number(),
      intro: z.string(),
      heroImage: image(),
      // CSS object-position keeping the people in frame ("center 30%").
      heroPosition: z.string().default("center"),
      cardImage: image(),
      cardPosition: z.string().default("center"),
      days: z.array(
        z.object({
          date: isoDate,
          // Photo for this day in the listing's journey (else the first artist's).
          photo: image().optional(),
          photoPosition: z.string().default("center"),
          venue: z.string().optional(),
          venueArea: z.string().optional(),
          venueLogo: image().optional(),
          mapUrl: z.string().url().optional(),
          activities: z.array(
            z.object({
              time: z.string().optional(),
              title: z.string(),
              kind: z.string().optional(),
              artist: reference("artists2027").optional(),
              signupUrl: z.string().url().optional(),
              note: z.string().optional(),
            })
          ),
        })
      ),
      // Information only: no sale happens on these pages.
      tickets: z
        .object({
          tiers: z
            .array(
              z.object({
                period: z.string(),
                price: z.number().int().positive(),
                note: z.string().optional(),
              })
            )
            .min(1),
          includes: z.string().optional(),
        })
        .optional(),
    }),
});

export const collections = { blog, tour2026, tour2027, artists2027 };

