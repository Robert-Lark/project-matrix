/**
 * Loose schemas for RAW Discogs responses — the capture's trust boundary
 * (never trust external input; validate at the system boundary).
 *
 * Loose on purpose: they pin only the fields the pipeline reads and pass the
 * rest through, because the docs publish example responses, not field tables —
 * several fields are documented as inconsistent (search-result `year` is a
 * string and sometimes absent; `formats[].qty` is a string; `lowest_price`
 * null when nothing is for sale). Checkpoints store the raw bytes as returned;
 * these schemas gate what the pipeline consumes.
 *
 * Field facts verified against https://www.discogs.com/developers (research
 * pass, 2026-07-10; search/auth areas adversarially re-fetched).
 */
import { z } from "zod";

export const RawSearchItem = z.looseObject({
  id: z.number().int(),
  type: z.string().optional(),
  title: z.string().optional(),
  year: z.union([z.string(), z.number()]).optional(), // string in search results, may be absent
  format: z.array(z.string()).optional(),
  label: z.array(z.string()).optional(),
  community: z
    .looseObject({
      want: z.number().optional(),
      have: z.number().optional(),
    })
    .optional(),
  cover_image: z.string().optional(), // undocumented in the search example — treated as a hint only
  thumb: z.string().optional(),
});
export type RawSearchItem = z.infer<typeof RawSearchItem>;

export const RawSearchPage = z.looseObject({
  pagination: z.looseObject({
    page: z.number().int(),
    pages: z.number().int(),
    items: z.number().int().optional(),
  }),
  results: z.array(RawSearchItem),
});
export type RawSearchPage = z.infer<typeof RawSearchPage>;

export const RawArtistCredit = z.looseObject({
  name: z.string(),
  anv: z.string().optional(), // alternate name variation — display name when non-empty
  join: z.string().optional(), // joining word/punctuation to the NEXT credit ("And", ",", "&")
});

export const RawImage = z.looseObject({
  type: z.string().optional(), // "primary" | "secondary" in the docs example
  uri: z.string().optional(), // signed full-size URL — fetch as-is, never modify
  width: z.number().optional(),
  height: z.number().optional(),
});
export type RawImage = z.infer<typeof RawImage>;

export const RawRelease = z.looseObject({
  id: z.number().int(),
  title: z.string(),
  year: z.number().optional(),
  artists: z.array(RawArtistCredit).optional(),
  genres: z.array(z.string()).optional(),
  styles: z.array(z.string()).optional(),
  labels: z
    .array(z.looseObject({ name: z.string(), catno: z.string().optional() }))
    .optional(),
  formats: z
    .array(
      z.looseObject({
        name: z.string(),
        qty: z.union([z.string(), z.number()]).optional(), // "1" — a string in the docs example
        descriptions: z.array(z.string()).optional(),
        text: z.string().optional(), // free text ("Digipak", vinyl color) — folded into descriptions
      }),
    )
    .optional(),
  images: z.array(RawImage).optional(),
  lowest_price: z.number().nullable().optional(), // null = nothing for sale / blocked
  num_for_sale: z.number().nullable().optional(),
  notes: z.string().nullable().optional(),
  tracklist: z
    .array(
      z.looseObject({
        position: z.string().optional(),
        title: z.string().optional(),
        duration: z.string().optional(), // "M:SS" string
        type_: z.string().optional(), // "track"; headings/index rows are undocumented but real
      }),
    )
    .optional(),
});
export type RawRelease = z.infer<typeof RawRelease>;
