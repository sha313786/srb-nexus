module.exports = {
  apps: [
    {
      name: 'srb-nexus',
      script: 'dist/index.js',
      instances: 1, // Discord bots require 1 instance unless using Discord Sharding
      autorestart: true,
      watch: false,
      max_memory_restart: '1G',
      env_production: {
        NODE_ENV: 'production',
        PORT: 3000,
      },
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      error_file: './logs/pm2-error.log',
      out_file: './logs/pm2-out.log',
      merge_logs: true,
    },
  ],
};