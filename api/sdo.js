/**
 * Vercel serverless function — NASA SDO image proxy
 *
 * sdo.gsfc.nasa.gov does not send Access-Control-Allow-Origin headers,
 * so browsers block the response from being read into WebGPU textures.
 * This function fetches the image server-side and re-serves it with CORS headers.
 *
 * Rewrite rule in vercel.json:
 *   /sdo/:path* → /api/sdo?proxyPath=:path*
 *
 * Example upstream URL:
 *   https://sdo.gsfc.nasa.gov/assets/img/latest/latest_256_0171.jpg
 */

export default async function handler(req, res) {
  const { proxyPath } = req.query;

  if (!proxyPath) {
    res.status(400).json({ error: 'Missing proxyPath' });
    return;
  }

  const upstreamUrl = `https://sdo.gsfc.nasa.gov/${proxyPath}`;

  try {
    const upstream = await fetch(upstreamUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; SpaceNavigator/1.0)',
        'Accept': 'image/jpeg, image/png, image/*, */*',
      },
      signal: AbortSignal.timeout(8_000),
    });

    if (!upstream.ok) {
      res.status(upstream.status).send('');
      return;
    }

    const buffer = await upstream.arrayBuffer();
    const contentType = upstream.headers.get('content-type') || 'image/jpeg';

    res.setHeader('Access-Control-Allow-Origin', '*');
    // SDO images update every 10 minutes — cache for 9 minutes on the edge
    res.setHeader('Cache-Control', 's-maxage=540, stale-while-revalidate=120');
    res.setHeader('Content-Type', contentType);
    res.status(200).send(Buffer.from(buffer));
  } catch (err) {
    console.error('[api/sdo] fetch error:', err.message);
    res.status(503).send('');
  }
}
