#!/bin/sh
set -e

# Gera rclone.conf a partir do token na env var (evita montar arquivo do host)
if [ -n "$RCLONE_TOKEN" ]; then
  mkdir -p /root/.config/rclone
  node -e "
const remote = process.env.RCLONE_REMOTE || 'gdrive';
const token  = process.env.RCLONE_TOKEN;
const conf   = '[' + remote + ']\ntype = drive\nscope = drive\ntoken = ' + token + '\n';
require('fs').writeFileSync('/root/.config/rclone/rclone.conf', conf);
console.log('rclone.conf gerado para remote:', remote);
"
fi

npx prisma migrate deploy
exec node src/index.js
