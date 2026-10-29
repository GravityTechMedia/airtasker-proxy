/**
 * Vercel Serverless Function — Airtasker MCP Proxy
 *
 * Set environment variable PROXY_SECRET in Vercel (any random string).
 * Must match AIRTASKER_MCP_PROXY_SECRET in your app's secrets.
 */

const MCP_ENDPOINT = 'https://mcp.airtasker.com/mcp';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const proxySecret = process.env.PROXY_SECRET;
  if (!proxySecret) {
    return res.status(500).json({ error: 'PROXY_SECRET environment variable is not set.' });
  }
  if (req.headers['x-proxy-secret'] !== proxySecret) {
    return res.status(403).json({ error: 'Unauthorized' });
  }

  const forwardHeaders = {};
  const skipHeaders = ['host', 'x-proxy-secret', 'content-length', 'connection'];
  for (const [key, value] of Object.entries(req.headers)) {
    if (!skipHeaders.includes(key.toLowerCase())) {
      forwardHeaders[key] = value;
    }
  }

  try {
    const upstream = await fetch(MCP_ENDPOINT, {
      method: 'POST',
      headers: forwardHeaders,
      body: JSON.stringify(req.body),
      redirect: 'manual',
    });

    const responseBody = await upstream.text();
    const responseHeaders = {};
    upstream.headers.forEach((value, key) => {
      if (!['transfer-encoding', 'content-encoding', 'content-length'].includes(key.toLowerCase())) {
        responseHeaders[key] = value;
      }
    });

    res.status(upstream.status).setHeader('Content-Type', upstream.headers.get('content-type') || 'application/json');
    for (const [key, value] of Object.entries(responseHeaders)) {
      res.setHeader(key, value);
    }
    res.send(responseBody);
  } catch (error) {
    res.status(502).json({ error: `Proxy error: ${error.message}` });
  }
}
