#!/bin/bash
# Docker FRP Test Suite
# Tests all container functionality including builds, startup, and volume persistence

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Test configuration
TEST_TAG="${TEST_TAG:-test/docker-frp}"
CLEANUP_ON_SUCCESS="${CLEANUP_ON_SUCCESS:-true}"
VERBOSE="${VERBOSE:-false}"

# Logging functions
log_info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

log_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

log_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

log_error() {
    echo -e "${RED}❌ $1${NC}"
}

log_test() {
    echo -e "${BLUE}🧪 $1${NC}"
}

# Cleanup function
cleanup() {
    local exit_code=$?
    log_info "Cleaning up test resources..."

    # Stop and remove test containers
    local containers="frp-server-test frp-client-test frp-test-server frp-volume-test frp-secret-server-test
        frp-secret-client-test frp-mask-client-test frp-mask-server-test frp-mounted-test frp-health-server-test
        frp-health-client-test frp-health-plain-test frp-health-bad-test"
    # shellcheck disable=SC2086
    docker rm -f $containers >/dev/null 2>&1 || true

    # Remove test configs directories
    rm -rf ./test-configs ./test-secret-configs ./test-health-config.toml 2>/dev/null || true

    # Remove test images if cleanup is enabled
    if [ "$CLEANUP_ON_SUCCESS" = "true" ] && [ $exit_code -eq 0 ]; then
        log_info "Removing test images..."
        docker rmi "${TEST_TAG}:latest" "${TEST_TAG}:server" "${TEST_TAG}:client" 2>/dev/null || true
    fi

    if [ $exit_code -eq 0 ]; then
        log_success "All tests completed successfully!"
    else
        log_error "Tests failed with exit code $exit_code"
    fi

    exit $exit_code
}

# Set up cleanup trap
trap cleanup EXIT

# Helper function to show container logs if verbose
show_logs_if_verbose() {
    local container_name=$1
    if [ "$VERBOSE" = "true" ]; then
        echo "📋 $container_name logs:"
        docker logs "$container_name" 2>&1 || echo "Could not get logs"
        echo ""
    fi
}

# Test Docker builds
test_builds() {
    log_test "Testing Docker builds..."

    log_info "Building combined image..."
    docker build -t "${TEST_TAG}:latest" --target both .

    log_info "Building server image..."
    docker build -t "${TEST_TAG}:server" --target server .

    log_info "Building client image..."
    docker build -t "${TEST_TAG}:client" --target client .

    log_success "All Docker builds completed successfully"
}

# Test server container functionality
test_server_container() {
    log_test "Testing server container startup..."

    docker run -d --name frp-server-test \
        -e MODE=server \
        -e BIND_PORT=7000 \
        -e DASHBOARD_PORT=7500 \
        -e DASHBOARD_USER=admin \
        -e DASHBOARD_PASSWORD=testpass \
        "${TEST_TAG}:server"

    sleep 5

    show_logs_if_verbose frp-server-test

    # Check container status
    if ! docker ps -q -f name=frp-server-test | grep -q .; then
        log_error "Server container is not running"
        docker logs frp-server-test 2>&1 || true
        return 1
    fi

    # Validate that server started correctly by checking for expected log messages
    if docker logs frp-server-test 2>&1 | grep -q "frps started successfully"; then
        log_success "Server container started and FRP server is running"
    else
        log_error "Server container failed to start FRP server properly"
        docker logs frp-server-test 2>&1 || true
        return 1
    fi

    # Check if dashboard is accessible
    if docker logs frp-server-test 2>&1 | grep -q "dashboard listen on 0.0.0.0:7500"; then
        log_success "Server dashboard is available"
    else
        log_warning "Server dashboard may not be available"
    fi

    # Check VHost ports
    if docker logs frp-server-test 2>&1 | grep -q "http service listen on 0.0.0.0:8080"; then
        log_success "VHost HTTP port (8080) is available"
    else
        log_warning "VHost HTTP port may not be available"
    fi

    docker stop frp-server-test
    docker rm frp-server-test
}

# Test client container functionality
test_client_container() {
    log_test "Testing client container startup..."

    # Start a server container first for client testing
    log_info "Starting test server for client connection..."
    docker run -d --name frp-test-server \
        -e MODE=server \
        -e BIND_PORT=7000 \
        -e DASHBOARD_PORT=7500 \
        -e DASHBOARD_USER=admin \
        -e DASHBOARD_PASSWORD=testpass \
        "${TEST_TAG}:server"

    # Get server container IP
    SERVER_IP=$(docker inspect -f '{{range.NetworkSettings.Networks}}{{.IPAddress}}{{end}}' frp-test-server)
    log_info "Server IP: $SERVER_IP"

    # Wait for server to be ready
    sleep 3

    # Run client container
    docker run -d --name frp-client-test \
        -e MODE=client \
        -e SERVER_ADDR="$SERVER_IP" \
        -e SERVER_PORT=7000 \
        -e ADMIN_PORT=7400 \
        -e ADMIN_USER=admin \
        -e ADMIN_PASSWORD=testpass \
        "${TEST_TAG}:client"

    sleep 8

    show_logs_if_verbose frp-client-test

    # Check if client container started properly by looking for admin UI message
    if docker logs frp-client-test 2>&1 | grep -q "admin server listen on 0.0.0.0:7400"; then
        log_success "Client container started correctly (admin UI available)"
    else
        log_error "Client container failed to start properly"
        docker logs frp-client-test 2>&1 || true
        return 1
    fi

    # Check if client attempted connection
    if docker logs frp-client-test 2>&1 | grep -q "try to connect to server"; then
        log_success "Client attempted server connection"
    else
        log_warning "Client may not have attempted server connection"
    fi

    # Clean up containers
    docker rm frp-client-test 2>/dev/null || true
    docker stop frp-test-server 2>/dev/null || true
    docker rm frp-test-server 2>/dev/null || true
}

# Test volume persistence functionality
test_volume_persistence() {
    log_test "Testing volume persistence..."

    # Create a test directory and run container with volume
    mkdir -p ./test-configs
    docker run --rm -d --name frp-volume-test \
        -v "$(pwd)/test-configs:/app/configs" \
        -e MODE=server \
        -e DASHBOARD_PASSWORD=volume123 \
        "${TEST_TAG}:server"

    sleep 5

    show_logs_if_verbose frp-volume-test

    # Check if config was generated and persisted
    if [ -f "./test-configs/frps.toml" ]; then
        log_success "Volume persistence working - config file created"

        # Verify config contains expected values
        if grep -q "password = \"volume123\"" ./test-configs/frps.toml; then
            log_success "Configuration templating working correctly"
        else
            log_error "Configuration templating failed"
            echo "Expected password = \"volume123\" in config file:"
            cat ./test-configs/frps.toml
            return 1
        fi

        # Test that existing config is used on restart
        docker stop frp-volume-test

        # Start again with different password - should use existing config
        docker run --rm -d --name frp-volume-test \
            -v "$(pwd)/test-configs:/app/configs" \
            -e MODE=server \
            -e DASHBOARD_PASSWORD=different456 \
            "${TEST_TAG}:server"

        sleep 3

        # Check logs for "Using existing configuration" message
        if docker logs frp-volume-test 2>&1 | grep -q "Using existing configuration"; then
            log_success "Existing configuration priority working correctly"
        else
            log_warning "May not be using existing configuration (check logs manually)"
        fi

        # Verify config still has original password
        if grep -q "password = \"volume123\"" ./test-configs/frps.toml && ! grep -q "password = \"different456\"" ./test-configs/frps.toml; then
            log_success "Configuration persistence working - original values preserved"
        else
            log_error "Configuration persistence failed - values were overwritten"
            cat ./test-configs/frps.toml
            return 1
        fi

    else
        log_error "Volume persistence failed - no config file created"
        docker logs frp-volume-test 2>&1 || true
        return 1
    fi

    # Clean up volume test
    docker stop frp-volume-test 2>/dev/null || true
    rm -rf ./test-configs
}

# Test that secrets never appear in container output
test_secrets_not_logged() {
    log_test "Testing that secrets are masked in container output..."

    local token="leak-check-token-$$"
    local dashboard_password="leak-check-dashboard-$$"
    local admin_password="leak-check-admin-$$"

    mkdir -p ./test-secret-configs

    docker run -d --name frp-secret-server-test \
        -v "$(pwd)/test-secret-configs:/app/configs" \
        -e MODE=server \
        -e AUTH_TOKEN="$token" \
        -e DASHBOARD_PASSWORD="$dashboard_password" \
        "${TEST_TAG}:server"

    docker run -d --name frp-secret-client-test \
        -e MODE=client \
        -e SERVER_ADDR=127.0.0.1 \
        -e AUTH_TOKEN="$token" \
        -e ADMIN_PASSWORD="$admin_password" \
        "${TEST_TAG}:client"

    sleep 5

    show_logs_if_verbose frp-secret-server-test
    show_logs_if_verbose frp-secret-client-test

    local server_logs client_logs
    server_logs=$(docker logs frp-secret-server-test 2>&1)
    client_logs=$(docker logs frp-secret-client-test 2>&1)

    # The config must still be printed, with masked values
    if ! echo "$server_logs" | grep -q '^token = "\*\*\*"' || ! echo "$client_logs" | grep -q '^token = "\*\*\*"'; then
        log_error "Final configuration output does not show masked token"
        echo "$server_logs"; echo "$client_logs"
        return 1
    fi

    for secret in "$token" "$dashboard_password"; do
        if echo "$server_logs" | grep -qF "$secret"; then
            log_error "Server container output leaks a secret"
            return 1
        fi
    done
    for secret in "$token" "$admin_password"; do
        if echo "$client_logs" | grep -qF "$secret"; then
            log_error "Client container output leaks a secret"
            return 1
        fi
    done
    log_success "Secrets are masked in container output"

    # Masking must only affect the printed copy, never the config file
    if grep -qF "token = \"$token\"" ./test-secret-configs/frps.toml; then
        log_success "Config file on disk still contains the real token"
    else
        log_error "Config file on disk was modified by masking"
        cat ./test-secret-configs/frps.toml
        return 1
    fi

    docker stop frp-secret-server-test frp-secret-client-test 2>/dev/null || true
    docker rm frp-secret-server-test frp-secret-client-test 2>/dev/null || true
    rm -rf ./test-secret-configs
}

# Test the masking script on sample configs (test/mask/*.toml → *.expected).
# Runs inside the image, so BusyBox awk is what is tested.
test_mask_samples() {
    log_test "Testing secret masking on sample configs..."

    local sample expected got failed=0
    for sample in test/mask/*.toml; do
        expected="${sample%.toml}.expected"
        got=$(docker run --rm -i --entrypoint /app/mask-config.sh "${TEST_TAG}:latest" < "$sample")
        if [ "$got" = "$(cat "$expected")" ]; then
            log_success "Masked as expected: $sample"
        else
            log_error "Masking differs from $expected:"
            diff <(echo "$got") "$expected" || true
            failed=1
        fi
    done
    return $failed
}

# start_with_config NAME IMAGE CONFIG_FILE [docker run args...]: start a
# container with CONFIG_FILE copied in as /app/configs/frp?.toml (a "mounted"
# config), without bind mounts so it also works from Git Bash.
start_with_config() {
    local name=$1 image=$2 config=$3; shift 3
    local target=frps.toml
    case "$image" in *:client) target=frpc.toml ;; esac
    docker create --name "$name" "$@" "$image" >/dev/null
    docker cp "$config" "$name:/app/configs/$target" >/dev/null
    docker start "$name" >/dev/null
}

# Test that literal secrets in a mounted config never reach docker logs
test_mounted_config_masked() {
    log_test "Testing that mounted configs are printed masked..."

    start_with_config frp-mask-client-test "${TEST_TAG}:client" test/mask/frpc-frp-gate.toml
    start_with_config frp-mask-server-test "${TEST_TAG}:server" test/mask/frps-plugin.toml
    sleep 3

    local logs
    logs=$(docker logs frp-mask-client-test 2>&1; docker logs frp-mask-server-test 2>&1)
    local secret leaked=0
    for secret in fg_abcdefghijklmnopqrstuvwxyz hunter2-admin single-quoted-secret \
        dash-secret shared-auth-token 0123456789abcdef0123456789abcdef; do
        if echo "$logs" | grep -qF "$secret"; then
            log_error "docker logs leak a secret: $secret"
            leaked=1
        fi
    done
    if ! echo "$logs" | grep -qF 'path = "/frps/{{ .Envs.FRP_GATE_INSTANCE_KEY }}"'; then
        log_error "A {{ .Envs.X }} placeholder was masked; it should stay readable"
        leaked=1
    fi
    docker rm -f frp-mask-client-test frp-mask-server-test >/dev/null 2>&1 || true
    [ $leaked -eq 0 ] && log_success "Mounted configs are printed with secrets masked"
    return $leaked
}

# Test that a generated config refuses the default/empty password, while a
# mounted config starts without any password variables.
test_unsafe_defaults() {
    log_test "Testing refusal of unsafe default passwords..."

    local out failed=0
    if out=$(docker run --rm -e MODE=server "${TEST_TAG}:server" 2>&1); then
        log_error "Server started without DASHBOARD_PASSWORD"; failed=1
    elif echo "$out" | grep -q "DASHBOARD_PASSWORD is not set"; then
        log_success "Server refuses a generated config without DASHBOARD_PASSWORD"
    else
        log_error "Server failed without the expected message:"; echo "$out"; failed=1
    fi

    if out=$(docker run --rm -e MODE=server -e DASHBOARD_PASSWORD=admin "${TEST_TAG}:server" 2>&1); then
        log_error "Server started with DASHBOARD_PASSWORD=admin"; failed=1
    elif echo "$out" | grep -q 'DASHBOARD_PASSWORD is still "admin"'; then
        log_success "Server refuses DASHBOARD_PASSWORD=admin"
    else
        log_error "Server failed without the expected message:"; echo "$out"; failed=1
    fi

    if out=$(docker run --rm -e MODE=client -e SERVER_ADDR=127.0.0.1 "${TEST_TAG}:client" 2>&1); then
        log_error "Client started without ADMIN_PASSWORD"; failed=1
    elif echo "$out" | grep -q "ADMIN_PASSWORD is not set"; then
        log_success "Client refuses a generated config without ADMIN_PASSWORD"
    else
        log_error "Client failed without the expected message:"; echo "$out"; failed=1
    fi

    start_with_config frp-mounted-test "${TEST_TAG}:server" test/mask/frps-plugin.toml
    sleep 3
    if docker ps -q -f name=frp-mounted-test | grep -q . && \
        docker logs frp-mounted-test 2>&1 | grep -q "Using existing configuration"; then
        log_success "A mounted config starts without any password variables"
    else
        log_error "A mounted config no longer starts as is"
        docker logs frp-mounted-test 2>&1 || true
        failed=1
    fi
    docker rm -f frp-mounted-test >/dev/null 2>&1 || true
    return $failed
}

# wait_health NAME STATUS SECONDS: wait until the container's health is STATUS.
wait_health() {
    local status
    for _ in $(seq "$3"); do
        status=$(docker inspect -f '{{.State.Health.Status}}' "$1" 2>/dev/null || true)
        [ "$status" = "$2" ] && return 0
        sleep 1
    done
    echo "health of $1 is '$status', expected '$2'"
    docker inspect -f '{{range .State.Health.Log}}{{.Output}}{{end}}' "$1" 2>/dev/null || true
    return 1
}

# Test the image HEALTHCHECK
test_healthcheck() {
    log_test "Testing HEALTHCHECK..."

    local failed=0
    local fast=(--health-interval=2s --health-start-period=2s --health-retries=2)

    docker run -d --name frp-health-server-test "${fast[@]}" \
        -e DASHBOARD_PASSWORD=healthpass "${TEST_TAG}:server" >/dev/null
    if wait_health frp-health-server-test healthy 30; then
        log_success "Server reports healthy (frps running, bind port answers)"
    else
        failed=1
    fi

    # frpc with the admin UI from the generated config: port 7400 is probed.
    docker run -d --name frp-health-client-test "${fast[@]}" \
        -e SERVER_ADDR=127.0.0.1 -e ADMIN_PASSWORD=healthpass "${TEST_TAG}:client" >/dev/null
    if wait_health frp-health-client-test healthy 30; then
        log_success "Client with admin UI reports healthy"
    else
        failed=1
    fi

    # frpc without webServer (mounted config): only the process is checked.
    local cfg
    cfg=./test-health-config.toml
    printf 'serverAddr = "127.0.0.1"\nserverPort = 7000\nloginFailExit = false\n' > "$cfg"
    start_with_config frp-health-plain-test "${TEST_TAG}:client" "$cfg" "${fast[@]}"
    rm -f "$cfg"
    if wait_health frp-health-plain-test healthy 30; then
        log_success "Client without admin UI reports healthy"
    else
        failed=1
    fi

    # The probe must fail when the configured bind port does not answer:
    # frps keeps listening on 7000 while the file now says 7999.
    cfg=./test-health-config.toml
    printf 'bindPort = 7000\n' > "$cfg"
    start_with_config frp-health-bad-test "${TEST_TAG}:server" "$cfg"
    rm -f "$cfg"
    sleep 2
    if docker exec frp-health-bad-test sh -c \
        'sed -i "s/7000/7999/" /app/configs/frps.toml && /app/healthcheck.sh' >/dev/null 2>&1; then
        log_error "Health check passed although the bind port does not answer"
        failed=1
    else
        log_success "Health check fails when the bind port does not answer"
    fi

    docker rm -f frp-health-server-test frp-health-client-test frp-health-plain-test frp-health-bad-test >/dev/null 2>&1 || true
    return $failed
}

# Test that the build info replaced the old start-time "Build:" line
test_build_info() {
    log_test "Testing build info..."
    local out
    out=$(docker run --rm "${TEST_TAG}:latest" --help 2>&1)
    if echo "$out" | grep -q "^Version: docker-frp .*, frp .*, built " && ! echo "$out" | grep -q "^Build:"; then
        log_success "Startup banner shows the build info"
    else
        log_error "Startup banner has no build info"; echo "$out" | head -5
        return 1
    fi
}

# Test help functionality
test_help_functionality() {
    log_test "Testing help functionality..."

    # Test help flag
    if docker run --rm "${TEST_TAG}:latest" --help | grep -q "Docker FRP - Fast Reverse Proxy Container"; then
        log_success "Help functionality working"
    else
        log_error "Help functionality not working"
        return 1
    fi
}

# Main test execution
main() {
    echo "🚀 Docker FRP Test Suite"
    echo "========================"
    echo "Test Tag: ${TEST_TAG}"
    echo "Cleanup: ${CLEANUP_ON_SUCCESS}"
    echo "Verbose: ${VERBOSE}"
    echo ""

    # Run all tests
    test_builds
    test_server_container
    test_client_container
    test_volume_persistence
    test_secrets_not_logged
    test_mask_samples
    test_mounted_config_masked
    test_unsafe_defaults
    test_healthcheck
    test_build_info
    test_help_functionality

    log_success "All tests passed! 🎉"
}

# Check if Docker is available
if ! command -v docker &> /dev/null; then
    log_error "Docker is not installed or not in PATH"
    exit 1
fi

# Check if Docker daemon is running
if ! docker info &> /dev/null; then
    log_error "Docker daemon is not running"
    exit 1
fi

# Run main function
main "$@"
