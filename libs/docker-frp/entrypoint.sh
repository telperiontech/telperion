#!/bin/bash

# Docker FRP Entrypoint Script
# Handles both server and client modes based on MODE environment variable

set -e

echo "🚀 Starting Docker FRP Container..."
echo "Mode: ${MODE:-server}"
if [ -f /app/BUILD_INFO ]; then
    echo "Version: $(cat /app/BUILD_INFO)"
fi

# Function to display usage information
show_usage() {
    echo ""
    echo "Docker FRP - Fast Reverse Proxy Container"
    echo "==========================================="
    echo ""
    echo "MODES:"
    echo "  server  - Run FRP server mode (default)"
    echo "  client  - Run FRP client mode with admin UI"
    echo ""
    echo "SERVER MODE Environment Variables:"
    echo "  BIND_PORT         - FRP server bind port (default: 7000)"
    echo "  DASHBOARD_PORT    - Dashboard web port (default: 7500)"
    echo "  DASHBOARD_USER    - Dashboard username (default: admin)"
    echo "  DASHBOARD_PASSWORD - Dashboard password (required for a generated config)"
    echo "  AUTH_TOKEN        - Authentication token (optional; leave it unset only when"
    echo "                      frps uses frp-gate as its auth plugin)"
    echo "  LOG_LEVEL         - Log level (default: info)"
    echo "  TLS_ENABLE        - Enable TLS (default: false)"
    echo "  VHOST_HTTP_PORT   - HTTP vhost port (default: 8080)"
    echo "  VHOST_HTTPS_PORT  - HTTPS vhost port (default: 8443)"
    echo ""
    echo "CLIENT MODE Environment Variables:"
    echo "  SERVER_ADDR       - FRP server address (default: x.x.x.x)"
    echo "  SERVER_PORT       - FRP server port (default: 7000)"
    echo "  AUTH_TOKEN        - Authentication token (optional)"
    echo "  ADMIN_PORT        - Admin UI port (default: 7400)"
    echo "  ADMIN_USER        - Admin UI username (default: admin)"
    echo "  ADMIN_PASSWORD    - Admin UI password (required for a generated config)"
    echo ""
    echo "PERSISTENT CONFIGURATION:"
    echo "  Mount /app/configs as a volume to persist configurations:"
    echo "  docker run -v ./configs:/app/configs telperiontech/docker-frp"
    echo "  • First run: Generates config from template and saves to volume"
    echo "  • Subsequent runs: Uses existing config from volume. It is never"
    echo "    regenerated: changed env vars do nothing until the file is removed"
    echo "  • Custom configs: Place frps.toml or frpc.toml in mounted volume"
    echo "  • Manual editing: Edit files in mounted volume and restart"
    echo ""
    echo "EXAMPLES:"
    echo "  # Server mode"
    echo "  docker run -p 7000:7000 -p 7500:7500 -e MODE=server \\"
    echo "    -e DASHBOARD_PASSWORD=change-me telperiontech/docker-frp"
    echo ""
    echo "  # Client mode with admin UI"
    echo "  docker run -p 7400:7400 -e MODE=client -e SERVER_ADDR=frp.example.com \\"
    echo "    -e ADMIN_PASSWORD=change-me telperiontech/docker-frp"
    echo ""
    echo "  # Server with custom settings"
    echo "  docker run -p 7000:7000 -p 7500:7500 \\"
    echo "    -e MODE=server \\"
    echo "    -e BIND_PORT=7000 \\"
    echo "    -e DASHBOARD_USER=myuser \\"
    echo "    -e DASHBOARD_PASSWORD=mypass \\"
    echo "    telperiontech/docker-frp"
    echo ""
}

# Check if help is requested
if [ "$1" = "--help" ] || [ "$1" = "-h" ] || [ "$1" = "help" ]; then
    show_usage
    exit 0
fi

# refuse_unsafe_password NAME: a generated config must not keep the default
# "admin" (or an empty) password. Mounted or existing configs are not checked.
refuse_unsafe_password() {
    local name=$1
    local value=${!name}
    if [ -z "$value" ] || [ "$value" = "admin" ]; then
        if [ -z "$value" ]; then
            echo "❌ Error: $name is not set."
        else
            echo "❌ Error: $name is still \"admin\"."
        fi
        echo "   The configuration is generated from the template, so its web UI would"
        echo "   accept a well-known password. Set $name to a strong value, or mount"
        echo "   your own configuration file into /app/configs/."
        exit 1
    fi
}

# Function to handle configuration
# setup_config MODE_LETTER PASSWORD_VAR
setup_config() {
    local mode=$1
    local password_var=$2
    local config_file="/app/configs/frp${mode}.toml"
    local template_file="/app/frp${mode}.toml.template"

    # Create configs directory
    mkdir -p /app/configs

    # Configuration priority:
    # 1. If config exists in /app/configs/, use it directly
    # 2. Generate from template and save to /app/configs/

    if [ -f "$config_file" ]; then
        echo "📁 Using existing configuration from $config_file"
        return 0
    else
        echo "🔧 Generating configuration from template"
        refuse_unsafe_password "$password_var"
        if [ -f "$template_file" ]; then
            envsubst < "$template_file" > "$config_file"
            echo "💾 Saved generated configuration to $config_file"
            echo "ℹ️  You can now edit $config_file and restart to use custom configuration"
            echo "ℹ️  It is never regenerated: later env changes do nothing until you remove it"
            return 0
        else
            echo "❌ Error: Template $template_file not found"
            exit 1
        fi
    fi
}

# Prints a config file with secret values masked (see mask-config.sh).
# Only the printed copy is altered; the file on disk is never modified.
print_masked_config() {
    /app/mask-config.sh "$1"
}

# Determine mode
MODE=${MODE:-server}

case "$MODE" in
    "server")
        echo "🖥️  Starting in SERVER mode..."
        echo "   📡 Bind Port: ${BIND_PORT:-7000}"
        echo "   🌐 Dashboard: http://localhost:${DASHBOARD_PORT:-7500}"
        echo "   👤 Dashboard User: ${DASHBOARD_USER:-admin}"
        echo ""

        # Check if frps binary exists
        if ! command -v frps &> /dev/null; then
            echo "❌ Error: frps binary not found"
            exit 1
        fi

        # Set default values for template processing
        export BIND_PORT=${BIND_PORT:-7000}
        export DASHBOARD_PORT=${DASHBOARD_PORT:-7500}
        export DASHBOARD_USER=${DASHBOARD_USER:-admin}
        export DASHBOARD_PASSWORD=${DASHBOARD_PASSWORD:-}
        export VHOST_HTTP_PORT=${VHOST_HTTP_PORT:-8080}
        export VHOST_HTTPS_PORT=${VHOST_HTTPS_PORT:-8443}

        # Configure authentication section
        if [ -n "$AUTH_TOKEN" ] && [ "$AUTH_TOKEN" != "" ]; then
            export AUTH_SECTION="# Authentication method
[auth]
method = \"token\"
token = \"$AUTH_TOKEN\""
            echo "  Auth Token: [CONFIGURED]"
        else
            export AUTH_SECTION="# No authentication configured"
            echo "  Auth Token: [DISABLED]"
        fi

        echo "Configuration:"
        echo "  Bind Port: $BIND_PORT"
        echo "  Dashboard Port: $DASHBOARD_PORT"
        echo "  Dashboard User: $DASHBOARD_USER"
        echo "  VHost HTTP Port: $VHOST_HTTP_PORT"
        echo "  VHost HTTPS Port: $VHOST_HTTPS_PORT"

        # Setup configuration
        setup_config "s" DASHBOARD_PASSWORD

        echo "Final configuration:"
        print_masked_config /app/configs/frps.toml

        # Start FRP server directly from configs
        exec frps -c /app/configs/frps.toml
        ;;

    "client")
        echo "💻 Starting in CLIENT mode..."
        echo "   🔧 Server: ${SERVER_ADDR:-x.x.x.x}:${SERVER_PORT:-7000}"
        echo "   🌐 Admin UI: http://localhost:${ADMIN_PORT:-7400}"
        echo ""

        # Check if frpc binary exists
        if ! command -v frpc &> /dev/null; then
            echo "❌ Error: frpc binary not found"
            exit 1
        fi

        # Set default values for template processing
        export SERVER_ADDR=${SERVER_ADDR:-"x.x.x.x"}
        export SERVER_PORT=${SERVER_PORT:-7000}
        export ADMIN_PORT=${ADMIN_PORT:-7400}
        export ADMIN_USER=${ADMIN_USER:-"admin"}
        export ADMIN_PASSWORD=${ADMIN_PASSWORD:-}

        # Configure authentication section
        if [ -n "$AUTH_TOKEN" ] && [ "$AUTH_TOKEN" != "" ]; then
            export AUTH_SECTION="# Authentication
[auth]
method = \"token\"
token = \"$AUTH_TOKEN\""
            echo "  Auth Token: [CONFIGURED]"
        else
            export AUTH_SECTION="# No authentication configured"
            echo "  Auth Token: [DISABLED]"
        fi

        echo "Configuration:"
        echo "  Server: $SERVER_ADDR:$SERVER_PORT"
        echo "  Admin UI: http://localhost:$ADMIN_PORT"
        echo "  Admin User: $ADMIN_USER"

        # Setup configuration
        setup_config "c" ADMIN_PASSWORD

        echo "Final configuration:"
        print_masked_config /app/configs/frpc.toml

        # Start FRP client directly from configs
        echo "Starting FRP client..."
        exec frpc -c /app/configs/frpc.toml
        ;;

    *)
        echo "❌ Error: Invalid MODE '$MODE'"
        echo "   Valid modes: server, client"
        echo ""
        show_usage
        exit 1
        ;;
esac
