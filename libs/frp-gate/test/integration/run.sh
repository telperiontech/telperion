#!/usr/bin/env bash
# frp-gate integration test: real frps + frpc (docker-frp, FRP_VERSION) and
# frp-gate in Docker. Checks that an allowed name works, a foreign name is
# rejected, the TLS ask follows grants and claims, and revoked clients are
# cut off; that a second frpc of a client cannot take a proxy name the first
# one holds; that a client declared only in the config file (gate.yaml) works
# and survives the loss of frp-gate's database.
#
#   FRP_VERSION=0.65.0 ./run.sh      (default: 0.72.0, the version docker-frp ships)
#   VERBOSE=true ./run.sh            (print container logs at the end)
set -euo pipefail
cd "$(dirname "$0")"

export FRP_VERSION="${FRP_VERSION:-0.72.0}"
export FRP_GATE_ADMIN_PASSWORD="integration-test-password"
FRP_GATE_INSTANCE_KEY="$(od -An -N32 -tx1 /dev/urandom | tr -d ' \n')"
export FRP_GATE_INSTANCE_KEY
DAVE_TOKEN="dave_$(od -An -N24 -tx1 /dev/urandom | tr -d ' \n')"
export DAVE_TOKEN
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
        compose logs --no-color frp-gate frps frpc-alice frpc-bob frpc-carol frpc-dave frpc-dave2 2>&1 | tail -n 300 || true
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

info "Zone and server come from gate.yaml; creating group, grants and clients through the API..."
api POST groups '{"name":"devs"}' >/dev/null
api POST grants "{\"group\":\"devs\",\"kind\":\"host\",\"zone\":\"$ZONE\",\"pattern\":\"*.{client}\"}" >/dev/null
ALICE_TOKEN=$(api POST clients '{"name":"alice","groups":["devs"]}' | json_field token)
BOB_TOKEN=$(api POST clients '{"name":"bob","groups":["devs"]}' | json_field token)
CAROL_TOKEN=$(api POST clients '{"name":"carol","groups":["devs"]}' | json_field token)
export ALICE_TOKEN BOB_TOKEN CAROL_TOKEN
api POST grants '{"client":"alice","kind":"port","instance":"default","proto":"tcp","ports":"6000-6010"}' >/dev/null

info "Starting frps and the clients..."
compose up -d frps frpc-alice frpc-bob frpc-carol frpc-dave >/dev/null 2>&1
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
echo "🧪 Declarative config (gate.yaml)"
gate() { compose exec -T frp-gate frp-gate "$@"; }
api_status() { curl -s -o /dev/null -w '%{http_code}' -u "admin:$FRP_GATE_ADMIN_PASSWORD" -X "$1" "$GATE_ADMIN/api/v1/$2" || true; }
wait_for 45 "web.dave reachable" is_200 "web.dave.$ZONE" && pass "dave (declared only in gate.yaml, token from env) is reachable"
expect_eq "the API refuses to delete a managed client" "$(api_status DELETE clients/dave)" 409
expect_eq "the API refuses to delete a managed zone" "$(api_status DELETE "zones/$ZONE")" 409
DRY=$(gate apply --dry-run 2>&1 || true)
if echo "$DRY" | grep -q "No changes"; then
    pass "apply --dry-run of the same file: no changes"
else
    fail "apply --dry-run reports changes: $DRY"
fi
EXPORT=$(gate export 2>&1 || true)
if echo "$EXPORT" | grep -q "^  dave:" && echo "$EXPORT" | grep -q "token_sha256:" && ! echo "$EXPORT" | grep -qF "$DAVE_TOKEN"; then
    pass "export lists dave with token_sha256 and no token"
else
    fail "export is wrong: $EXPORT"
fi
BACKUP=$(mktemp)
gate backup - > "$BACKUP" 2>/dev/null || true
expect_eq "backup - writes an SQLite file" "$(head -c 15 "$BACKUP")" "SQLite format 3"
rm -f "$BACKUP"
METRICS=$(curl -s "$GATE_INTERNAL/metrics" || true)
if echo "$METRICS" | grep -q 'frp_gate_sessions_connected{client="dave"} 1' &&
    echo "$METRICS" | grep -q 'frp_gate_plugin_ops_total{op="Ping",result="reject",reason="disabled"}'; then
    pass "/metrics shows dave connected and alice's refused Pings"
else
    fail "/metrics lacks the expected series: $(echo "$METRICS" | grep -v '^#' | head -20)"
fi
if api GET audit | grep -q '"action": "client.disable"'; then
    pass "the audit log has the API's disable of alice"
else
    fail "audit log lacks client.disable"
fi

echo ""
echo "🧪 Lost database: rebuilt from gate.yaml"
compose rm -sf frp-gate >/dev/null 2>&1
docker volume rm frp-gate-it_gate-data >/dev/null
compose up -d frp-gate >/dev/null 2>&1
T0=$(date +%s)
wait_for 30 "frp-gate health after rebuild" curl -fsS "$GATE_INTERNAL/healthz"
expect_eq "alice (made through the API) is gone with the database" "$(api_status GET clients/alice)" 404
if wait_for 60 "web.dave reachable after rebuild" is_200 "web.dave.$ZONE"; then
    pass "dave works again $(( $(date +%s) - T0 ))s after frp-gate restarted with an empty database"
fi
# Connected = a Ping accepted by the rebuilt frp-gate (frps keeps the session
# only while Pings are accepted).
wait_for 30 "dave's Pings accepted by the rebuilt frp-gate" client_connected dave &&
    pass "the rebuilt frp-gate accepts dave's heartbeats"
# A fresh Login + NewProxy against the rebuilt database, with the same token.
compose restart frpc-dave >/dev/null 2>&1
sleep 2
if wait_for 60 "web.dave reachable after frpc restart" is_200 "web.dave.$ZONE"; then
    pass "dave logs in again with the same token after the rebuild"
fi

echo ""
echo "🧪 Two frpc of one client with the same proxy name"
compose up -d frpc-dave2 >/dev/null 2>&1
dave2_refused() { compose logs frpc-dave2 2>&1 | grep -q "already open in another frpc session"; }
wait_for 45 "p2.dave reachable" is_200 "p2.dave.$ZONE" && pass "the second frpc's own proxy name works"
wait_for 45 "dave2's clashing proxy refused" dave2_refused && pass "frpc sees why its clashing proxy was refused"
expect_eq "the first frpc keeps the name" "$(host_status "web.dave.$ZONE")" 200
expect_eq "the clashing name gets no route" "$(host_status "web2.dave.$ZONE")" 404
compose stop frpc-dave2 >/dev/null 2>&1

echo ""
if [ "$FAILED" -eq 0 ]; then
    pass "All integration tests passed (frp v$FRP_VERSION) 🎉"
else
    fail "Some integration tests failed (frp v$FRP_VERSION)"
fi
