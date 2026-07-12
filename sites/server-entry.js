const asAssetRequest = (request, pathname) => {
  const url = new URL(request.url);
  url.pathname = pathname;
  url.search = '';
  return new Request(url, request);
};

export default {
  async fetch(request, env) {
    if (!env?.ASSETS?.fetch) {
      return new Response('Static asset binding unavailable.', { status: 503 });
    }

    const response = await env.ASSETS.fetch(request);
    if (response.status !== 404) return response;

    // Bumper Hearts is a single-page game; unknown navigation routes fall back
    // to the playable shell while missing file assets remain real 404s.
    const pathname = new URL(request.url).pathname;
    if (pathname.includes('.')) return response;
    return env.ASSETS.fetch(asAssetRequest(request, '/index.html'));
  },
};
