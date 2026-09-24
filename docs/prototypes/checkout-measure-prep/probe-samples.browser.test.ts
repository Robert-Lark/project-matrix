/**
 * The six `measureVisit` samples quoted in ADR-0001 addendum V and the
 * decision-map node (three checkout ids × two profiles: INP, CLS, interaction
 * bytes) — a REPRODUCING step, not a suite leg. It is a vitest file because
 * `measureVisit` and the profiles resolve only inside the origin-suite
 * workspace; to run it, copy it into `tools/origin-suite/suite/` (it starts
 * with `zz-` there so it sorts last), hold a plane, and run it alone:
 *
 *   PM_HOLD=1 node tools/origin-suite/run-local.mjs            # one shell
 *   cp docs/prototypes/checkout-measure-prep/probe-samples.browser.test.ts \
 *      tools/origin-suite/suite/zz-probe-samples.browser.test.ts
 *   PM_ORIGIN=http://127.0.0.1:8787 pnpm --filter @pm/origin-suite exec \
 *      vitest run suite/zz-probe-samples.browser.test.ts           # another
 *   rm tools/origin-suite/suite/zz-probe-samples.browser.test.ts
 *
 * One run each, on a loaded local machine: drivability evidence, never a
 * published number. It prints one line per visit.
 */
import { afterAll, beforeAll, it } from "vitest";
import { chromium, type Browser } from "playwright";
import { PROFILES } from "@pm/measurement";
import { measureVisit } from "@pm/bench-runner";

const ORIGIN = (process.env.PM_ORIGIN ?? "http://127.0.0.1:8787").replace(/\/$/, "");
let browser: Browser;
beforeAll(async () => {
  try {
    browser = await chromium.launch();
  } catch {
    browser = await chromium.launch({ channel: "chrome" });
  }
});
afterAll(async () => {
  await browser?.close();
});

for (const profileId of ["avg-broadband-desktop", "slow-4g-mid-phone"] as const) {
  for (const interactionId of ["checkout-type-card", "checkout-submit-invalid", "checkout-fix-and-submit"] as const) {
    it(`${profileId} ${interactionId}`, async () => {
      const { sample } = await measureVisit(browser, PROFILES[profileId], {
        effectiveUrl: `${ORIGIN}/vanilla/checkout/`,
        interactionId,
      });
      console.log(
        `SAMPLE ${profileId} ${interactionId} INP=${sample.webVitals.INP} CLS=${sample.webVitals.CLS} bytes=${sample.kb.interactionBytes} settled=${sample.interactionSettled}`,
      );
    }, 180_000);
  }
}
