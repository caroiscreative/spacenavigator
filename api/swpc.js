/**
 * Vercel serverless function — NOAA SWPC proxy
 *
 * services.swpc.noaa.gov sends CORS headers, so this proxy is not strictly
 * required for CORS reasons. However, it keeps the fetch path consistent
 * with dev (Vite proxy at /swpc/*) and lets us cache responses on Vercel's
 * edge network for faster global delivery.
 *
 * Rewrite rule in vercel.json:
 *   /swpc/:path* → /api/swpc?proxyPath=:path*
 *
 * Example upstream URL:
 *   https://services.swpc.noaa.gov/json/planetary_k_index_1m.json
 */

export default async function handler(req, res) {
  const { proxyPath } = req.query;

  if (!proxyPath) {
    res.status(400).json({ error: 'Missing proxyPath' });
    return;
  }

  const upstreamUrl = `https://services.swpc.noaa.gov/${proxyPath}`;

  try {
    const upstream = await fetch(upstreamUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; SpaceNavigator/1.0)',
        'Accept': 'application/json, text/plain, */*',
      },
      signal: AbortSignal.timeout(8_000),
    });

    if (!upstream.ok) {
      res.status(upstream.status).json({});
      return;
    }

    const body = await upstream.text();
    const contentType = upstream.headers.get('content-type') || 'application/json';

    res.setHeader('Access-Control-Allow-Origin', '*');
    // SWPC data refreshes every 1–15 minutes — cache for 60 seconds on the edge
    res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate=30');
    res.setHeader('Content-Type', contentType);
    res.status(200).send(body);
  } catch (err) {
    console.error('[api/swpc] fetch error:', err.message);
    res.status(503).json({});
  }
}
