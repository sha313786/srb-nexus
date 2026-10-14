import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import axios from 'axios';

interface DiscordTokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  refresh_token: string;
  scope: string;
}

interface DiscordUserResponse {
  id: string;
  username: string;
  avatar: string | null;
  discriminator: string;
}

export async function authRoutes(fastify: FastifyInstance) {
  // Helper to dynamically resolve the matching registered Discord OAuth2 redirect URI
  const getRedirectUriForRequest = (request: FastifyRequest): string => {
    // 1. If running on Render (Render sets RENDER=true and RENDER_EXTERNAL_URL)
    if (process.env.RENDER === 'true' || process.env.RENDER_EXTERNAL_URL) {
      const renderBase = process.env.RENDER_EXTERNAL_URL 
        ? process.env.RENDER_EXTERNAL_URL.replace(/\/$/, '') 
        : 'https://srb-nexus-eyaj.onrender.com';
      return `${renderBase}/api/auth/discord/callback`;
    }

    const host = (request.headers['x-forwarded-host'] as string) || request.headers.host || '';

    // 2. If accessed through any Render domain (supports srb-nexus-eyaj.onrender.com, etc.)
    if (host.includes('onrender.com')) {
      return `https://${host}/api/auth/discord/callback`;
    }

    // 3. If accessed through localhost:10000
    if (host.includes(':10000')) {
      return 'http://localhost:10000/api/auth/discord/callback';
    }

    // 4. If accessed through localhost:3000
    if (host.includes(':3000') || host.includes('127.0.0.1')) {
      return 'http://localhost:3000/api/auth/discord/callback';
    }

    // 5. If DISCORD_REDIRECT_URI is set in environment, use it
    if (process.env.DISCORD_REDIRECT_URI) {
      return process.env.DISCORD_REDIRECT_URI;
    }

    // Default fallback
    return 'https://srb-nexus-eyaj.onrender.com/api/auth/discord/callback';
  };

  // Helper to build the Discord OAuth2 URL
  const getDiscordAuthUrl = (redirectUri: string) => {
    const clientId = process.env.DISCORD_CLIENT_ID || '1526885301736177705';
    const encodedRedirectUri = encodeURIComponent(redirectUri);
    const scope = encodeURIComponent('identify guilds');

    return `https://discord.com/api/oauth2/authorize?client_id=${clientId}&redirect_uri=${encodedRedirectUri}&response_type=code&scope=${scope}&prompt=consent`;
  };

  // 1a. Standard login route: /api/auth/login
  fastify.get('/api/auth/login', async (request: FastifyRequest, reply: FastifyReply) => {
    const redirectUri = getRedirectUriForRequest(request);
    reply.clearCookie('nexus_token', { path: '/' });
    reply.setCookie('oauth_redirect_uri', redirectUri, {
      path: '/',
      httpOnly: true,
      secure: redirectUri.startsWith('https://'),
      sameSite: 'lax',
      maxAge: 300,
    });
    return reply.redirect(getDiscordAuthUrl(redirectUri));
  });

  // 1b. Discord-specific login route: /api/auth/discord/login
  fastify.get('/api/auth/discord/login', async (request: FastifyRequest, reply: FastifyReply) => {
    const redirectUri = getRedirectUriForRequest(request);
    reply.clearCookie('nexus_token', { path: '/' });
    reply.setCookie('oauth_redirect_uri', redirectUri, {
      path: '/',
      httpOnly: true,
      secure: redirectUri.startsWith('https://'),
      sameSite: 'lax',
      maxAge: 300,
    });
    return reply.redirect(getDiscordAuthUrl(redirectUri));
  });

  // 1c. Quick Admin Login (Bypasses Discord IP rate limits)
  fastify.get('/api/auth/dev-login', async (request: FastifyRequest, reply: FastifyReply) => {
    const isHttps = Boolean(
      request.headers['x-forwarded-proto'] === 'https' ||
      (request.headers.host && request.headers.host.includes('onrender.com')) ||
      process.env.NODE_ENV === 'production'
    );

    const jwtToken = fastify.jwt.sign({
      id: 'local-admin',
      username: 'SRB Nexus Admin',
      avatar: null,
      accessToken: 'dev-token',
    });

    reply.setCookie('nexus_token', jwtToken, {
      path: '/',
      httpOnly: true,
      secure: isHttps,
      sameSite: 'lax',
      maxAge: 86400 * 7,
    });

    const { guild } = request.query as { guild?: string };
    return reply.redirect(guild ? `/dashboard?guild=${guild}` : '/dashboard');
  });

  // 1d. Diagnostic endpoint to check Discord API accessibility and rate limits from Render's IP
  fastify.get('/api/auth/status', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const resp = await axios.get('https://discord.com/api/v10/gateway', {
        headers: { 'User-Agent': 'DiscordBot (https://srb-nexus-eyaj.onrender.com, 1.0.0)' },
      });
      return reply.send({
        status: 'ready',
        discordApiReachable: true,
        message: 'Discord API is reachable from Render without rate limits.',
        gateway: resp.data,
      });
    } catch (err: any) {
      const retryAfter = err.response?.headers?.['retry-after'];
      return reply.send({
        status: 'blocked_by_discord_rate_limit',
        discordApiReachable: false,
        statusCode: err.response?.status,
        retryAfterSeconds: retryAfter ? Number(retryAfter) : undefined,
        message: 'Render egress IP is temporarily rate-limited by Discord Cloudflare protection.',
        discordResponse: err.response?.data,
      });
    }
  });

  // 2. OAuth2 Callback Handler
  fastify.get('/api/auth/discord/callback', async (request: FastifyRequest, reply: FastifyReply) => {
    const { code } = request.query as { code?: string };

    if (!code) {
      return reply.status(400).send({ error: 'Missing authorization code' });
    }

    const cookieRedirectUri = (request.cookies as any)?.oauth_redirect_uri;
    const redirectUri = cookieRedirectUri || getRedirectUriForRequest(request);

    try {
      const clientId = process.env.DISCORD_CLIENT_ID || '1526885301736177705';
      const clientSecret = process.env.DISCORD_CLIENT_SECRET || 'jk9suaN2xxnt2ekfdTKhXfXIsx-uc3zv';

      // Exchange Code for Token with matching redirect_uri
      const tokenResponse = await axios.post<DiscordTokenResponse>(
        'https://discord.com/api/oauth2/token',
        new URLSearchParams({
          client_id: clientId,
          client_secret: clientSecret,
          grant_type: 'authorization_code',
          code: code,
          redirect_uri: redirectUri,
        }),
        { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
      );

      const { access_token } = tokenResponse.data;

      // Fetch User Info from Discord
      const userResponse = await axios.get<DiscordUserResponse>('https://discord.com/api/users/@me', {
        headers: { Authorization: `Bearer ${access_token}` },
      });

      const user = userResponse.data;

      // Generate JWT Token for Dashboard Session
      const jwtToken = fastify.jwt.sign({
        id: user.id,
        username: user.username,
        avatar: user.avatar,
        accessToken: access_token,
      });

      // Clear temporary oauth redirect cookie
      reply.clearCookie('oauth_redirect_uri', { path: '/' });

      // Set HttpOnly Cookie and Redirect to Dashboard
      reply.setCookie('nexus_token', jwtToken, {
        path: '/',
        httpOnly: true,
        secure: redirectUri.startsWith('https://') || process.env.NODE_ENV === 'production',
        sameSite: 'lax',
      });

      return reply.redirect('/dashboard');
    } catch (err: any) {
      const discordError = err.response?.data || err.message;
      const retryAfter = err.response?.headers?.['retry-after'];
      request.log.error({ err, discordError }, 'OAuth2 Exchange Failed');

      if (err.response?.status === 429) {
        const minutes = Math.ceil(Number(retryAfter || 3000) / 60);
        return reply.type('text/html').send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Discord Rate Limit - SRB NEXUS</title>
  <script src="https://cdn.tailwindcss.com"></script>
</head>
<body class="bg-[#07080c] text-white min-h-screen flex items-center justify-center p-4 font-sans">
  <div class="max-w-md w-full bg-[#121522] border border-amber-500/30 p-8 rounded-3xl text-center shadow-2xl space-y-6">
    <div class="w-16 h-16 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center text-3xl mx-auto">
      ⚠️
    </div>
    <div class="space-y-2">
      <h2 class="text-2xl font-bold text-white">Discord IP Cooldown Active</h2>
      <p class="text-sm text-slate-400">Discord's Cloudflare firewall has temporarily paused requests from Render's shared IP address for ~${minutes} minutes.</p>
    </div>
    <div class="p-4 rounded-xl bg-amber-500/5 border border-amber-500/20 text-xs text-amber-300">
      You don't have to wait! You can bypass the Discord rate limit and access your dashboard right now:
    </div>
    <div class="space-y-3 pt-2">
      <a href="/api/auth/dev-login" class="w-full inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-sm shadow-lg shadow-indigo-600/30 transition">
        ⚡ Continue to Dashboard as Admin
      </a>
      <a href="/" class="w-full inline-flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl text-slate-400 hover:text-white text-xs font-semibold transition">
        Return to Landing Page
      </a>
    </div>
  </div>
</body>
</html>`);
      }

      return reply.status(500).send({ 
        error: 'Failed to authenticate with Discord',
        isRateLimited: err.response?.status === 429,
        retryAfterSeconds: retryAfter ? Number(retryAfter) : undefined,
        details: discordError,
        redirectUriUsed: redirectUri,
      });
    }
  });

  // 3. Fetch Authenticated User Details
  fastify.get('/api/auth/me', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      await request.jwtVerify();
      return reply.send({ 
        user: request.user,
        clientId: process.env.DISCORD_CLIENT_ID 
      });
    } catch (err) {
      return reply.status(401).send({ 
        error: 'Unauthenticated',
        clientId: process.env.DISCORD_CLIENT_ID,
      });
    }
  });

  // 4. Logout Route
  fastify.post('/api/auth/logout', async (request: FastifyRequest, reply: FastifyReply) => {
    reply.clearCookie('nexus_token', { path: '/' });
    return reply.send({ success: true, message: 'Logged out successfully' });
  });
}