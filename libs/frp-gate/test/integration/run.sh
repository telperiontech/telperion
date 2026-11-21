#!/usr/bin/env bash
# frp-gate integration test: real frps + frpc (docker-frp, FRP_VERSION) and
# frp-gate in Docker. Checks that an allowed name works, a foreign name is
# rejected, the TLS ask follows grants and claims, and revoked clients are
# cut off.
#
#   FRP_VERSION=0.65.0 ./run.sh      (default: the version docker-frp ships)
#   VERBOSE=true ./run.sh            (print container logs at the end)
set -euo pipefail
cd "$(dirname "$0")"

export FRP_VERSION="${FRP_VERSION:-0.65.0}"
export FRP_GATE_ADMIN_PASSWORD="integration-test-password"
FRP_GATE_INSTANCE_KEY="$(od -An -N32 -tx1 /dev/urandom | tr -d ' \n')"
export FRP_GATE_INSTANCE_KEY
VERBOSE="${VERBOSE:-false}"

GATE_INTERNAL=http://127.0.0.1:17600
GATE_ADMIN=http://127.0.0.1:17601
VHOST=http://127.0.0.1:18080
ZONE=dev.test.example
FAILED=0

RED='\033[0;31m'; GREEN='\033[0;32m'; BLUE='\033[0;34m'; NC='\033[0m'
info() { echo -e "${BLUE}ℹ️  $*${NC}"; }
pass() { echo -e "${GREEN}✅ $*${NC}"; }
fail() { echo -e "${RED}❌ $*${NC}"; FAILED=1; }

compose() { docker compose "$@"; }

cleanup() {
    local code=$?
    if [ "$code" -ne 0 ] || [ "$FAILED" -ne 0 ] || [ "$VERBOSE" = "true" ]; then
        compose logs --no-color frp-gate frps frpc-alice frpc-bob frpc-carol 2>&1 | tail -n 300 || true
    fi
    compose down -v --remove-orphans >/dev/null 2>&1 || true
    [ "$FAILED" -eq 0 ] && [ "$code" -eq 0 ] || exit 1
}
trap cleanup EXIT

api() { # api METHOD PATH [JSON]
    local args=(-sS -u "admin:$FRP_GATE_ADMIN_PASSWORD" -X "$1" "$GATE_ADMIN/api/v1/$2")
    [ $# -ge 3 ] && args+=(-H "Content-Type: application/json" -d "$3")
    curl --fail-with-body "${args[@]}"
}
json_field() { sed -n "s/.*\"$1\": \"\([^\"]*\)\".*/\1/p" | head -n1; }
host_status() { curl -s -o /dev/null -w '%{http_code}' --max-time 5 -H "Host: $1" "$VHOST/${2:-}" || true; }
ask_status() { curl -s -o /dev/null -w '%{http_code}' --max-time 5 "$GATE_INTERNAL/tls/ask?domain=$1" || true; }

# wait_for SECONDS DESCRIPTION COMMAND...: retry COMMAND once a second.
wait_for() {
    local timeout=$1 what=$2; shift 2
    for _ in $(seq "$timeout"); do
        if "$@" >/dev/null 2>&1; then return 0; fi
        sleep 1
    done
    fail "timed out after ${timeout}s waiting for: $what"
    return 1
}
is_200() { [ "$(host_status "$1")" = "200" ]; }
not_200() { [ "$(host_status "$1")" != "200" ]; }
client_connected() { api GET status | grep -q "\"client\": \"$1\""; }
client_gone() { ! client_connected "$1"; }
frps_log_has() { compose logs frps 2>&1 | grep -q "$1"; }

expect_eq() { # expect_eq DESCRIPTION GOT WANT
    if [ "$2" = "$3" ]; then pass "$1 ($2)"; else fail "$1: got $2, want $3"; fi
}

echo "🚀 frp-gate integration test (frp v$FRP_VERSION)"

info "Building images..."
compose build --quiet >/dev/null 2>&1 || compose build
compose up -d --quiet-pull frp-gate backend >/dev/null 2>&1
wait_for 30 "frp-gate health" curl -fsS "$GATE_INTERNAL/healthz"

info "Creating zone, group, grants and clients through the API..."
api POST zones "{\"domain\":\"$ZONE\"}" >/dev/null
api PUT instances/default/zones "{\"zones\":[\"$ZONE\"]}" >/dev/null
api POST groups '{"name":"devs"}' >/dev/null
api POST grants "{\"group\":\"devs\",\"kind\":\"host\",\"zone\":\"$ZONE\",\"pattern\":\"*.{client}\"}" >/dev/null
ALICE_TOKEN=$(api POST clients '{"name":"alice","groups":["devs"]}' | json_field token)
BOB_TOKEN=$(api POST clients '{"name":"bob","groups":["devs"]}' | json_field token)
CAROL_TOKEN=$(api POST clients '{"name":"carol","groups":["devs"]}' | json_field token)
export ALICE_TOKEN BOB_TOKEN CAROL_TOKEN
api POST grants '{"client":"alice","kind":"port","instance":"default","proto":"tcp","ports":"6000-6010"}' >/dev/null

info "Starting frps and the clients..."
compose up -d frps frpc-alice frpc-bob frpc-carol >/dev/null 2>&1
wait_for 45 "app.alice reachable" is_200 "app.alice.$ZONE"
wait_for 30 "api.bob reachable" is_200 "api.bob.$ZONE"

echo ""
echo "🧪 Allowed names and ports"
expect_eq "alice's own name" "$(host_status "app.alice.$ZONE")" 200
expect_eq "bob's own name" "$(host_status "api.bob.$ZONE")" 200
expect_eq "alice's granted tcp port" "$(curl -s -o /dev/null -w '%{http_code}' --max-time 5 http://127.0.0.1:16001/ || true)" 200

echo ""
echo "🧪 Foreign names"
expect_eq "bob cannot take x.alice (frps has no route)" "$(host_status "x.alice.$ZONE")" 404
if compose logs frpc-bob 2>&1 | grep -q "not granted"; then
    pass "bob's frpc reports the rejection reason"
else
    fail "bob's frpc log has no rejection reason"
fi

echo ""
echo "🧪 TLS ask"
expect_eq "claimed + granted name" "$(ask_status "app.alice.$ZONE")" 200
expect_eq "granted but never used" "$(ask_status "other.alice.$ZONE")" 403
expect_eq "rejected claim (x.alice by bob)" "$(ask_status "x.alice.$ZONE")" 403
expect_eq "name outside every zone" "$(ask_status "evil.example.com")" 403

echo ""
echo "🧪 Heartbeats are enforced by frps (carol sends none)"
if wait_for 40 "frps heartbeat timeout for carol" frps_log_has "heartbeat timeout"; then
    pass "frps closed carol's session on its own"
fi

echo ""
echo "🧪 Revocation"
# An in-flight request when the client is disabled (informational).
INFLIGHT=$(mktemp)
(curl -s -o /dev/null -w '%{http_code}' --max-time 60 -H "Host: app.alice.$ZONE" "$VHOST/?wait=30s" >"$INFLIGHT" 2>/dev/null || true) &
INFLIGHT_PID=$!
sleep 2
api POST clients/alice/disable >/dev/null
T0=$(date +%s)
expect_eq "ask refuses a disabled client's name at once" "$(ask_status "app.alice.$ZONE")" 403
if wait_for 10 "new requests to app.alice fail" not_200 "app.alice.$ZONE"; then
    pass "new requests fail after $(( $(date +%s) - T0 ))s"
fi
if wait_for 30 "alice's session closed" client_gone alice; then
    pass "alice's session and proxies are gone after $(( $(date +%s) - T0 ))s"
fi
expect_eq "alice's tcp port is closed" "$(curl -s -o /dev/null -w '%{http_code}' --max-time 5 http://127.0.0.1:16001/ || true)" 000
wait "$INFLIGHT_PID" || true
info "in-flight request during revocation ended with HTTP $(cat "$INFLIGHT") (anything but 200 means it was cut off)"
rm -f "$INFLIGHT"
ops=$(compose logs frp-gate 2>&1 | grep 'msg=reject' | grep 'user=alice' | grep -o 'op=[A-Za-z]*' | sort | uniq -c | xargs echo || true)
info "frp-gate refusals for alice so far: ${ops:-none}"
expect_eq "bob is unaffected" "$(host_status "api.bob.$ZONE")" 200
if compose logs frpc-alice 2>&1 | grep -q "disabled"; then
    pass "alice's frpc reports that the client is disabled"
else
    fail "alice's frpc log does not say it was disabled"
fi

echo ""
echo "🧪 Re-enable"
api POST clients/alice/enable >/dev/null
wait_for 60 "app.alice reachable again" is_200 "app.alice.$ZONE" && pass "alice is back after re-enable"

echo ""
if [ "$FAILED" -eq 0 ]; then
    pass "All integration tests passed (frp v$FRP_VERSION) 🎉"
else
    fail "Some integration tests failed (frp v$FRP_VERSION)"
fi
