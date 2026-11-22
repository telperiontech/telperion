#!/bin/bash
# Docker HEALTHCHECK for the server and client images.
#
# Healthy when the frp process (frps or frpc) is running and, if the config
# names a port, that port accepts a TCP connection:
#   server: bindPort (default 7000) on bindAddr
#   client: webServer.port on webServer.addr (only if the admin UI is enabled)
# A port written as a {{ .Envs.X }} placeholder is not probed; only the
# process is checked then.

MODE=${MODE:-server}
case "$MODE" in
    server) bin=frps; config=/app/configs/frps.toml; port_key=bindPort; addr_key=bindAddr; default_port=7000 ;;
    client) bin=frpc; config=/app/configs/frpc.toml; port_key=webServer.port; addr_key=webServer.addr; default_port= ;;
    *) echo "unknown MODE $MODE"; exit 1 ;;
esac

# The process must exist (PID 1 normally, or a child of an init such as tini).
if ! grep -qx "$bin" /proc/[0-9]*/comm 2>/dev/null; then
    echo "$bin is not running"
    exit 1
fi

# toml_value KEY: the value of a dotted key, written either as "a.b = v" or
# as "b = v" under "[a]". Quotes and comments are stripped.
toml_value() {
    [ -f "$config" ] || return 0
    awk -v want="$1" '
        function norm(s) { gsub(/[ \t"\047]/, "", s); return s }
        /^[ \t]*\[/ { table = $0; sub(/^[ \t]*\[+/, "", table); sub(/\].*$/, "", table); table = norm(table); next }
        /^[ \t]*[A-Za-z0-9_."\047-]+[ \t]*=/ {
            key = $0; sub(/=.*/, "", key); key = norm(key)
            if (table != "") key = table "." key
            if (key != want) next
            val = $0; sub(/^[^=]*=[ \t]*/, "", val); sub(/[ \t]*#.*$/, "", val)
            gsub(/^["\047]|["\047][ \t]*$/, "", val)
            print val
            exit
        }' "$config"
}

port=$(toml_value "$port_key")
port=${port:-$default_port}
case "$port" in
    "") exit 0 ;;                 # nothing to probe (e.g. frpc without admin UI)
    *[!0-9]*) exit 0 ;;           # placeholder or anything that is not a number
esac

addr=$(toml_value "$addr_key")
case "$addr" in
    ""|0.0.0.0|::|"[::]"|*"{{"*) addr=127.0.0.1 ;;
esac

if timeout 3 bash -c "exec 3<>/dev/tcp/$addr/$port" 2>/dev/null; then
    exit 0
fi
echo "$bin is running but $addr:$port does not accept connections"
exit 1
