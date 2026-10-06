# Item 8, the Discogs API Terms of Use check, and Rob's call (2026-10-05)

Sub-decision (e) of the `domain-cutover` node, pulled forward by the runbook ("it
should be done before any application link goes out"). Reading and recording only;
the call is Rob's. **Rob's answer, 2026-10-05: defer, no call yet.** The facts below
are recorded; sub-decision (e) stays open.

## What was fetched, and how

Fetched 2026-10-05 with `curl`, read as page text, never from a summary model or
from training data:

- `https://support.discogs.com/hc/en-us/articles/360009334593-API-Terms-of-Use`,
  through the help centre's article endpoint
  (`/api/v2/help_center/en-us/articles/360009334593.json`). Title "API Terms of
  Use"; the page text opens "Last Updated: May 27th, 2025"; the endpoint reports
  `updated_at` 2025-07-23T14:54:18Z. Body as fetched: 25,114 B of JSON, sha256
  `bd248b7d32d4ce02eb2347e153130e309cb523af27f6bc04e852864cbea80138`; tags
  stripped to 19,531 B of text, sha256
  `d581398b9490e34992c8f1bdead55ffecf1fe2dd5bbe982a49c665f043707169`. Not committed
  (Discogs' text); the hashes let a reader check the copy they fetch against the
  one quoted here.
- `https://www.discogs.com/developers` (498,529 B).
- `https://data.discogs.com/` (3,603 B).

## What the Terms say, verbatim

Staleness and storage (section "API USE AND RESTRICTIONS"):

> You may not display in any format or to any audience the Content if it is more
> than six (6) hours older than the information on Our online properties or
> applications and applications. You may not cache or store the Content longer than
> is necessary to provide a service to Your application’s users.

Attribution (section "DISCOGS INTELLECTUAL PROPERTY"):

> We require You to display the following notice prominently on Your application
> and any other public-facing use of Our API and the Content that You create: "This
> application uses Discogs’ API but is not affiliated with, sponsored or endorsed by
> Discogs. ‘Discogs’ is a trademark of Zink Media, LLC." This notice may be included
> in Your terms and conditions or usage documentation.

> You must display the following notice directly next to any data You use from the
> Discogs API: “Data provided by Discogs.” The notice must include a hyperlink to
> the discogs.com page that includes the data. The link back must not use any
> mechanism that prevents passing along search engine ranking credit to that page,
> such as 'nofollow'.

What is CC0 and what is restricted (section "DESCRIPTION OF CONTENT WITHIN THE
API"): CC0 Data is "Release titles, notes, dates, format, track listings, barcodes
and other identifiers, credits, versions, URL links to third-party sites", "Artist
names, notes, associated releases" and "Label, producer, manufacturer, distributor,
etc. names and contact information, notes, and associated releases", and

> CC0 Data is made available under the CC0 No Rights Reserved license.

Restricted Data includes

> “Marketplace Data” such as related inventory, orders, lists, fees, pricing
> suggestions, including but not limited to: pricing, release images posted in
> connection with offers for sale, and sales history.

and "Images" (release, artist, label and user images, each required to be public
domain, CC0 by its uploader, already CC0, or fair use). For Restricted Data:

> Transfer Restricted Data to any third party.

> Use Restricted Data for any commercial purposes.

(both under "You may not"). Commercial use:

> Commercial use of Our API and the Content is generally permitted, but may not be
> permitted, if, in Our sole discretion we determine the commercial use is
> prohibited.

The developers page: "If you utilize the Discogs API, you are subject to the API
Terms of Use." and "Some Discogs data is made available under the CC0 No Rights
Reserved license, and some is restricted data, as defined in our API Terms of Use."
The data dumps page: "This data is made available under the CC0 No Rights Reserved
license: http://creativecommons.org/about/cc0", with no staleness clause.

## What the plane serves today

From the committed crate (`tools/snapshot-capture/crate/`): `manifest.json` says
`capturedAt` 2026-07-11, `releaseCount` 500, `source` api.discogs.com; 456 of the
500 summaries carry a `priceFrom` and a `numForSale` above zero (`jq`, both counts
456; the `snapshot-capture` node's "455 priced" is that node's own count from
freeze day, the committed summaries hold 456); 1,817 release images served as
3,634 self-hosted AVIF files, a 600 px derivative and a 160 px thumb per image
(`jq length` over `images-index.json`: 3,634, of which 1,817 are thumbs). Neither notice is served: `grep -rn` for "provided by
Discogs", "not affiliated" and "trademark of Zink" over every `.html`, `.mjs`, `.js`,
`.ts`, `.tsx` and `.astro` file outside `docs/` finds nothing; the footer line is "A
working store on frozen Discogs data. Nothing ships. Checkout is simulated."
(`packages/reference/render/shell.mjs:171`).

## What that means, as read (not legal advice)

- The frozen snapshot, the project's core design (ADR-0002 §1), displays Content far
  more than six hours old and stores it indefinitely; the clause is a contract term
  on API use and applies to CC0 Data and Restricted Data alike. The CC0 Data is also
  available from the monthly dumps under CC0 with no such clause, so the catalog text
  has a second, unencumbered source; the prices (`priceFrom`, `numForSale`) and the
  images do not.
- The two notices are cheap and owed whichever way the call goes. Where they would
  land, as read: the affiliation notice on `/methodology/` and in the shell footer
  beside the fiction sentence (`packages/reference/render/shell.mjs:171`), which
  every variant renders; the per-datum "Data provided by Discogs." link on each
  release card and PDP, a markup-contract change across the masters. The final
  placement is the `domain-cutover` unit's to fix with the rest of (e).
- Nothing sells on the site; the store is simulated (CONTEXT.md). Whether that is
  "commercial" is not a question the Terms answer and not one this record decides.

Options put to Rob, one question: record as deferred pending a written answer from
Discogs (recommended: only a written answer closes the six-hour and Restricted Data
questions, and he has an internal route); record as an accepted exposure; decide to
remove prices and images from the public plane (a re-capture unit); or defer with no
call. **Deferred, no call yet.**
