#!/usr/bin/env bash
set -euo pipefail
echo 256337 | sudo -S install -m 644 /home/pp/soundtag.service /etc/systemd/system/soundtag.service
rm -f /home/pp/soundtag.service
pkill -f 'uvicorn app.main:app --host 0.0.0.0 --port 8000' || true
echo 256337 | sudo -S systemctl daemon-reload
echo 256337 | sudo -S systemctl enable soundtag.service
echo 256337 | sudo -S systemctl restart soundtag.service
sleep 3
echo '==== STATUS ===='
echo 256337 | sudo -S systemctl status soundtag.service --no-pager
echo '==== ENABLED ===='
echo 256337 | sudo -S systemctl is-enabled soundtag.service
echo '==== HEALTH ===='
curl -m 5 http://127.0.0.1:8000/health
