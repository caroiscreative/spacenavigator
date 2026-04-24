// api/celestrak.js — Vercel serverless proxy for CelesTrak TLE data
// CelesTrak blocks requests with browser headers (Origin, Referer, sec-fetch-*)
// This function strips those headers and forwards with a neutral User-Agent.

export default async function handler(req, res) {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    return res.status(204).end();
  }

  const qs = new URLSearchParams(req.query || {}).toString();
  const upstream = `https://celestrak.org/NORAD/elements/gp.php${qs ? '?' + qs : ''}`;

  try {
    const response = await fetch(upstream, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; SpaceNavigator/1.0)',
        'Accept': 'text/plain, application/json, */*',
      },
    });

    const body = await response.text();
    const ct = response.headers.get('Content-Type') || 'text/plain';

    res.setHeader('Content-Type', ct);
    res.setHeader('Cache-Control', 'public, max-age=3600, s-maxage=3600');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.status(response.status).send(body);
  } catch (err) {
    console.error('[celestrak-proxy] fetch failed:', err.message);
    res.status(503).send('');
  }
}
