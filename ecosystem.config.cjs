// pm2-Konfiguration. Enthält KEINE Geheimnisse – die kommen aus server/.env.production
// (siehe DEPLOYMENT.md), geladen von server/src/env.ts, sobald NODE_ENV=production gesetzt ist.
module.exports = {
  apps: [
    {
      name: 'mathe-rakete',
      cwd: __dirname + '/server',
      script: 'dist/index.js',
      env_production: {
        NODE_ENV: 'production',
      },
      out_file: '/var/log/mathe-rakete/out.log',
      error_file: '/var/log/mathe-rakete/error.log',
      time: true,
    },
  ],
};
