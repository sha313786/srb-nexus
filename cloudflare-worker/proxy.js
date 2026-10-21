/**
 * SRB NEXUS — Cloudflare Worker Reverse Proxy for Discord API
 * 
 * Purpose:
 * Bypasses Cloudflare / Discord IP rate limits & 1015 bans encountered on shared cloud
 * platforms (such as Render, Railway, AWS, DigitalOcean).
 * 
 * Security:
 * Requires a shared secret in the `x-proxy-auth` header to prevent unauthorized access.
 * The secret is verified and stripped before forwarding the request to Discord.
 * 
 * Environment Variables (Set in Cloudflare Worker Settings -> Variables):
 * - SHARED_PROXY_SECRET: A secure random string matching DISCORD_PROXY_SECRET in your .env
 */

export default {
  async fetch(request, env, ctx) {
    // 1. Health check probe for the worker itself
    const url = new URL(request.url);
    if (url.pathname === '/' || url.pathname === '/worker-health') {
      return new Response(JSON.stringify({ status: 'ok', worker: 'srb-nexus-proxy' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // 2. Validate Authorization Secret Header
    if (env.SHARED_PROXY_SECRET) {
      const incomingSecret = request.headers.get('x-proxy-auth');
      if (incomingSecret !== env.SHARED_PROXY_SECRET) {
        return new Response(JSON.stringify({ error: 'Unauthorized: Invalid proxy authentication header' }), {
          status: 403,
          headers: { 'Content-Type': 'application/json' }
        });
      }
    }

    // 3. Construct Destination Discord URL
    // Supports paths like /api/v10/... or /v10/...
    let subPath = url.pathname;
    if (subPath.startsWith('/api')) {
      subPath = subPath.substring(4);
    }
    const targetDiscordUrl = `https://discord.com/api${subPath}${url.search}`;

    // 4. Clone and Clean Headers
    const forwardedHeaders = new Headers(request.headers);
    forwardedHeaders.delete('x-proxy-auth'); // Strip internal secret
    forwardedHeaders.delete('cf-connecting-ip');
    forwardedHeaders.delete('cf-ipcountry');
    forwardedHeaders.delete('cf-ray');
    forwardedHeaders.delete('cf-visitor');

    // 5. Forward request to Discord
    const init = {
      method: request.method,
      headers: forwardedHeaders,
      redirect: 'follow'
    };

    if (request.method !== 'GET' && request.method !== 'HEAD' && request.body) {
      init.body = request.body;
    }

    try {
      const response = await fetch(targetDiscordUrl, init);
      
      // Pass response directly back to bot
      const responseHeaders = new Headers(response.headers);
      return new Response(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers: responseHeaders
      });
    } catch (err) {
      return new Response(JSON.stringify({ error: 'Gateway Proxy Error', details: err.message }), {
        status: 502,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  }
};
