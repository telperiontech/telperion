#!/usr/bin/env bash
# Beacon's memory check: runs the image against the fake platforms
# (test/fakeplatform: ~30 packages whose versions keep moving), polls for
# DURATION seconds with short intervals, and fails when the RSS ever exceeds
# LIMIT_MB, when packages are missing, or when a poll job ends in an error.
#
#   bash test/rss/run.sh                 (from apps/beacon; builds both images)
#   BUILD=0 IMAGE=ghcr.io/telperiontech/beacon:x bash test/rss/run.sh
#
# Env: DURATION (300), LIMIT_MB (64), PORT (17701), BUILD (1), IMAGE, FAKE_IMAGE.
set -euo pipefail
export MSYS_NO_PATHCONV=1 # Git Bash: keep container paths as they are
cd "$(dirname "$0")/../.."

DURATION=${DURATION:-300}
LIMIT_MB=${LIMIT_MB:-64}
PORT=${PORT:-17701}
IMAGE=${IMAGE:-beacon-rss:check}
FAKE_IMAGE=${FAKE_IMAGE:-beacon-fakeplatform:check}
SAMPLE_EVERY=15
PASSWORD=rss-check-admin-password
name=beacon-rss-$$

if [ "${BUILD:-1}" = 1 ]; then
  docker build --build-context workspace=../.. --target runtime -t "$IMAGE" .
  docker build --build-context workspace=../.. --target fakeplatform -t "$FAKE_IMAGE" .
fi

cleanup() {
  docker rm -fv "$name-beacon" "$name-fake" >/dev/null 2>&1 || true
  docker network rm "$name" >/dev/null 2>&1 || true
  docker volume rm "$name" >/dev/null 2>&1 || true
}
trap cleanup EXIT

docker network create "$name" >/dev/null
docker run -d --name "$name-fake" --network "$name" --network-alias fake \
  -v "$name:/shared" "$FAKE_IMAGE" -period 60s >/dev/null
for _ in $(seq 30); do
  docker logs "$name-fake" 2>&1 | grep -q "fakeplatform on" && break
  sleep 1
done

docker run -d --name "$name-beacon" --network "$name" -p "127.0.0.1:$PORT:7701" \
  -v "$name:/shared:ro" \
  -e BEACON_CONFIG=/shared/beacon.yaml -e BEACON_ADMIN_PASSWORD="$PASSWORD" \
  -e COOLIFY_TOKEN=fake-coolify-token \
  -e BEACON_POLL_HOT=5s -e BEACON_POLL_WARM=15s -e BEACON_POLL_COLD=30s \
  "$IMAGE" >/dev/null

rss_kb() { docker top "$name-beacon" -o pid,rss | awk 'NR == 2 { print $2 }'; }

max_kb=0
echo "sampling RSS every ${SAMPLE_EVERY}s for ${DURATION}s (limit ${LIMIT_MB} MB)"
for ((t = SAMPLE_EVERY; t <= DURATION; t += SAMPLE_EVERY)); do
  sleep "$SAMPLE_EVERY"
  if [ "$(docker inspect -f '{{.State.Running}}' "$name-beacon")" != true ]; then
    docker logs "$name-beacon" 2>&1 | tail -n 30
    echo "FAIL: beacon stopped"
    exit 1
  fi
  kb=$(rss_kb)
  ((kb > max_kb)) && max_kb=$kb
  printf '  %4ss  %6.1f MB\n' "$t" "$(echo "$kb" | awk '{ print $1 / 1024 }')"
done

summary=$(BASE="http://127.0.0.1:$PORT/api" AUTH="admin:$PASSWORD" node -e '
  const headers = { Authorization: "Basic " + Buffer.from(process.env.AUTH).toString("base64") };
  const get = path => fetch(process.env.BASE + "/" + path, { headers }).then(r => r.json());
  Promise.all([get("overview"), get("status")]).then(([o, s]) => {
    const gaps = o.packages.reduce((n, p) => n + p.gaps.length, 0);
    const failing = s.filter(j => j.lastError).map(j => j.key + ": " + j.lastError);
    console.log(JSON.stringify({ packages: o.packages.length, gaps, jobs: s.length, failing }));
  });
')
echo "state: $summary"
docker logs "$name-beacon" 2>&1 | grep -E "level=(WARN|ERROR)" | tail -n 10 || true

final_kb=$(rss_kb)
limit_kb=$((LIMIT_MB * 1024))
echo "RSS: final $((final_kb / 1024)) MB, max $((max_kb / 1024)) MB, limit $LIMIT_MB MB ($(uname -m))"

fail=0
((max_kb < limit_kb)) || { echo "FAIL: RSS above ${LIMIT_MB} MB"; fail=1; }
node -e '
  const s = JSON.parse(process.argv[1]);
  if (s.packages !== 30) { console.log("FAIL: " + s.packages + " packages, want 30"); process.exit(1); }
  if (s.gaps === 0) { console.log("FAIL: no gaps detected; the fake catalog always has some"); process.exit(1); }
  if (s.failing.length) { console.log("FAIL: poll jobs in error:\n  " + s.failing.join("\n  ")); process.exit(1); }
' "$summary" || fail=1
[ "$fail" = 0 ] && echo "PASS"
exit "$fail"
