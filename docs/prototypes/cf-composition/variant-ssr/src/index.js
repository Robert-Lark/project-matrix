// SSR echo: proves URL/query/header fidelity of requests forwarded through
// the front Worker's service binding (ADR-0004 §5 — the URL is the
// measurement condition, so nothing may be lost in transit).
export default {
  async fetch(request) {
    const url = new URL(request.url);
    const body = `<!doctype html>
<html lang="en">
<head><meta charset="utf-8"><title>ssr echo</title></head>
<body>
<div id="pm-chrome-slot"></div>
<h1>ssr variant</h1>
<p data-echo-path>${url.pathname}${url.search}</p>
<p data-echo-host>${url.hostname}</p>
</body>
</html>
`;
    return new Response(body, {
      headers: {
        'content-type': 'text/html; charset=utf-8',
        'x-pm-ssr': '1',
      },
    });
  },
};
