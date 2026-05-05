/**
 * Vercel serverless function — CelesTrak proxy
 *
 * CelesTrak blocks requests that carry browser-identifying headers
 * (Origin, Referer, Sec-Fetch-*). This function forwards the request
 * server-side with those headers stripped.
 *
 * Rewrite rule in vercel.json:
 *   /celestrak/:path* → /api/celestrak?proxyPath=:path*
 *
 * The original query string (GROUP=, FORMAT=, etc.) is forwarded as-is.
 */

export default async function handler(req, res) {
  // Extract the captured path segment; everything else is upstream query params
  const { proxyPath, ...upstreamQuery } = req.query;

  if (!proxyPath) {
    res.status(400).json({ error: 'Missing proxyPath' });
    return;
  }

  const qs = new URLSearchParams(upstreamQuery).toString();
  const upstreamUrl = `https://celestrak.org/${proxyPath}${qs ? '?' + qs : ''}`;

  try {
    const upstream = await fetch(upstreamUrl, {
      method: req.method,
      headers: {
        // Identify as a script, not a browser — prevents CelesTrak's hotlink filter
        'User-Agent': 'Mozilla/5.0 (compatible; SpaceNavigator/1.0; +https://spacenavigator.io)',
        'Accept': 'text/plain, application/json, */*',
        // Do NOT forward Origin, Referer, or Sec-Fetch-* headers
      },
      signal: AbortSignal.timeout(15_000),
    });

    if (!upstream.ok) {
      res.status(upstream.status).send('');
      return;
    }

    const body = await upstream.text();

    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate=600');
    res.setHeader('Content-Type', upstream.headers.get('content-type') || 'text/plain');
    res.status(200).send(body);
  } catch (err) {
    console.error('[api/celestrak] fetch error:', err.message);
    res.status(503).send('');
  }
}
