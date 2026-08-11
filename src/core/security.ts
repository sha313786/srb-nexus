import { logger } from './logger';
import { config } from './config';

export function enforceProductionHardening(): void {
  // 1. Mandatory Production Environment Checks
  const requiredEnv = ['DISCORD_TOKEN', 'DISCORD_CLIENT_ID', 'DATABASE_URL'];
  const missing = requiredEnv.filter((key) => !process.env[key]);

  if (missing.length > 0) {
    logger.fatal({ missing }, 'CRITICAL SECURITY BREACH: Missing mandatory environment variables');
    process.exit(1);
  }

  // 2. Warn if running with root privileges
  if (process.getuid && process.getuid() === 0) {
    logger.warn('SECURITY WARNING: SRB NEXUS is executing as root (UID 0). Consider running under a non-privileged user.');
  }

  // 3. Prevent process crash on memory warnings
  process.on('warning', (warning) => {
    logger.warn({ name: warning.name, message: warning.message, stack: warning.stack }, 'Node.js Runtime Warning Detected');
  });

  logger.info('Production hardening policies applied successfully');
}