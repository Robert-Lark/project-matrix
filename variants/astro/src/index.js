// The one-line assets forwarder (spike hardening 1, ADR-0004 addendum):
// serving assets *through a service binding without a script* is undocumented,
// so every static variant ships this default handler — every hop in the
// composition is then a documented Cloudflare behavior.
export default {
  fetch(request, env) {
    return env.ASSETS.fetch(request);
  },
};
