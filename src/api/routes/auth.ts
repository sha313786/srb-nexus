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
  // 1. Redirect user to Discord OAuth2 Authorization Page (Clears old token)
  fastify.get('/api/auth/discord/login', async (request: FastifyRequest, reply: FastifyReply) => {
    // Clear existing session cookie to force fresh login
    reply.clearCookie('nexus_token', { path: '/' });

    const clientId = process.env.DISCORD_CLIENT_ID;
    const redirectUri = encodeURIComponent(process.env.DISCORD_REDIRECT_URI || '');
    const scope = encodeURIComponent('identify guilds');

    const discordAuthUrl = `https://discord.com/api/oauth2/authorize?client_id=${clientId}&redirect_uri=${redirectUri}&response_type=code&scope=${scope}&prompt=consent`;
    
    return reply.redirect(discordAuthUrl);
  });

  // 2. OAuth2 Callback Handler
  fastify.get('/api/auth/discord/callback', async (request: FastifyRequest, reply: FastifyReply) => {
    const { code } = request.query as { code?: string };

    if (!code) {
      return reply.status(400).send({ error: 'Missing authorization code' });
    }

    try {
      // Exchange Code for Token
      const tokenResponse = await axios.post<DiscordTokenResponse>(
        'https://discord.com/api/oauth2/token',
        new URLSearchParams({
          client_id: process.env.DISCORD_CLIENT_ID || '',
          client_secret: process.env.DISCORD_CLIENT_SECRET || '',
          grant_type: 'authorization_code',
          code: code,
          redirect_uri: process.env.DISCORD_REDIRECT_URI || '',
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

      // Set HttpOnly Cookie and Redirect to Dashboard
      reply.setCookie('nexus_token', jwtToken, {
        path: '/',
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
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
      return reply.send({ user: request.user });
    } catch (err) {
      return reply.status(401).send({ error: 'Unauthorized' });
    }
  });

  // 4. Logout Route
  fastify.post('/api/auth/logout', async (request: FastifyRequest, reply: FastifyReply) => {
    reply.clearCookie('nexus_token', { path: '/' });
    return reply.send({ success: true, message: 'Logged out successfully' });
  });
}