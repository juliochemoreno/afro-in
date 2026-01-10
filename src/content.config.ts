import { glob } from "astro/loaders";
import { defineCollection, z } from "astro:content";

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

export const collections = { blog, tour2026 };

