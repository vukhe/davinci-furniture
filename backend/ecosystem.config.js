// PM2 Ecosystem – Production cluster config
// Chạy: pm2 start ecosystem.config.js --env production
module.exports = {
  apps: [
    {
      name:        'davinci-api',
      script:      'server.js',
      cwd:         '/var/www/davinci/backend',

      // Cluster mode – 1 process per CPU core
      instances:   'max',
      exec_mode:   'cluster',

      // Memory guard
      max_memory_restart: '400M',

      // Auto restart
      autorestart:  true,
      watch:        false,
      max_restarts: 10,
      restart_delay: 4000,
      min_uptime:    '10s',

      // Graceful reload (zero-downtime)
      kill_timeout:  5000,
      wait_ready:    true,
      listen_timeout: 8000,

      env: {
        NODE_ENV: 'development',
        PORT:      5000,
      },
      env_production: {
        NODE_ENV: 'production',
        PORT:      5000,
      },

      // Log
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
      out_file:    './logs/out.log',
      error_file:  './logs/error.log',
      merge_logs:  true,
      log_type:    'json',
    },
  ],
};
