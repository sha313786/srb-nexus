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
    const host = (request.headers['x-forwarded-host'] as string) || request.headers.host || '';

    // 1. If accessed through Render domain
    if (host.includes('srb-nexus.onrender.com')) {
      return 'https://srb-nexus.onrender.com/api/auth/discord/callback';
    }

    // 2. If accessed through localhost:10000
    if (host.includes(':10000')) {
      return 'http://localhost:10000/api/auth/discord/callback';
    }

    // 3. If accessed through localhost:3000
    if (host.includes(':3000') || host.includes('127.0.0.1')) {
      return 'http://localhost:3000/api/auth/discord/callback';
    }

    // 4. If DISCORD_REDIRECT_URI is set in environment, use it
    if (process.env.DISCORD_REDIRECT_URI) {
      return process.env.DISCORD_REDIRECT_URI;
    }

    // Default fallback
    return 'https://srb-nexus.onrender.com/api/auth/discord/callback';
  };

  // Helper to build the Discord OAuth2 URL
  const getDiscordAuthUrl = (redirectUri: string) => {
    const clientId = process.env.DISCORD_CLIENT_ID;
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

  // 1c. Quick Local Admin Login (Bypasses OAuth redirect issues for local development)
  fastify.get('/api/auth/dev-login', async (request: FastifyRequest, reply: FastifyReply) => {
    const jwtToken = fastify.jwt.sign({
      id: 'local-admin',
      username: 'SRB Nexus Admin',
      avatar: null,
      accessToken: 'dev-token',
    });

    reply.setCookie('nexus_token', jwtToken, {
      path: '/',
      httpOnly: true,
      secure: false,
      sameSite: 'lax',
    });

    const { guild } = request.query as { guild?: string };
    return reply.redirect(guild ? `/dashboard?guild=${guild}` : '/dashboard');
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
      // Exchange Code for Token with matching redirect_uri
      const tokenResponse = await axios.post<DiscordTokenResponse>(
        'https://discord.com/api/oauth2/token',
        new URLSearchParams({
          client_id: process.env.DISCORD_CLIENT_ID || '',
          client_secret: process.env.DISCORD_CLIENT_SECRET || '',
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
      request.log.error(err, 'OAuth2 Exchange Failed');
      return reply.status(500).send({ error: 'Failed to authenticate with Discord' });
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