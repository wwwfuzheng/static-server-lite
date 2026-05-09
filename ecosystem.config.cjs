// pm2 配置 —— 用法见 OPS.md
//
// 本服务必须以 fork 模式跑单实例：
//   - 登录限流器是进程内 Map（server/src/middleware/...）
//   - 文件上传 / 删除直接落盘，多 worker 会竞争
// 千万不要改成 cluster 或多 instance。

const path = require('path');

module.exports = {
  apps: [
    {
      name: 'static-server-lite',
      script: 'server/src/server.js',
      cwd: __dirname,

      exec_mode: 'fork',
      instances: 1,

      env: {
        NODE_ENV: 'production',
      },

      autorestart: true,
      max_restarts: 10,
      min_uptime: '10s',
      max_memory_restart: '512M',
      kill_timeout: 5000,

      error_file: path.join(__dirname, 'logs/pm2-error.log'),
      out_file: path.join(__dirname, 'logs/pm2-out.log'),
      merge_logs: true,
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',

      watch: false,
    },
  ],
};
