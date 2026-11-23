# Multi-stage Dockerfile for FRP Server and Client

# frp release to package. Build info for labels and the startup banner.
ARG FRP_VERSION=0.72.0
ARG VERSION=dev
ARG BUILD_DATE=unknown

# Base stage with FRP binaries
FROM alpine:3.24 AS frp-base
RUN apk add --no-cache curl tar

# Download and extract FRP with automatic architecture detection
ARG FRP_VERSION
ARG TARGETPLATFORM
WORKDIR /app

# Convert Docker platform to FRP architecture naming
RUN case "${TARGETPLATFORM}" in \
        "linux/amd64") FRP_ARCH="amd64" ;; \
        "linux/arm64") FRP_ARCH="arm64" ;; \
        "linux/arm/v7") FRP_ARCH="arm" ;; \
        "linux/arm/v6") FRP_ARCH="arm" ;; \
        "linux/386") FRP_ARCH="386" ;; \
        *) echo "Unsupported platform: ${TARGETPLATFORM}" && exit 1 ;; \
    esac && \
    echo "Building for platform: ${TARGETPLATFORM}, using FRP arch: ${FRP_ARCH}" && \
    curl -fL "https://github.com/fatedier/frp/releases/download/v${FRP_VERSION}/frp_${FRP_VERSION}_linux_${FRP_ARCH}.tar.gz" -o frp.tar.gz && \
    tar -xzf frp.tar.gz --strip-components=1 && \
    rm frp.tar.gz && \
    chmod +x frps frpc

# Shared runtime: shell tools, entrypoint, masking, health check, build info
FROM alpine:3.24 AS runtime-base
ARG FRP_VERSION
ARG VERSION
ARG BUILD_DATE
# tini reaps orphaned processes. frps/frpc as PID 1 never do, and every passing
# health check orphans BusyBox `timeout`'s watchdog: the zombies filled the
# container's pids limit within a day and then every health check failed.
RUN apk add --no-cache bash gettext dos2unix tini
COPY entrypoint.sh mask-config.sh healthcheck.sh /app/
RUN dos2unix /app/*.sh && chmod +x /app/*.sh && \
    mkdir -p /app/configs && \
    printf 'docker-frp %s, frp %s, built %s\n' "${VERSION}" "${FRP_VERSION}" "${BUILD_DATE}" > /app/BUILD_INFO
LABEL org.opencontainers.image.version="${VERSION}" \
      org.opencontainers.image.created="${BUILD_DATE}" \
      io.github.fatedier.frp.version="${FRP_VERSION}"
VOLUME ["/app/configs"]
WORKDIR /app
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 CMD ["/app/healthcheck.sh"]
# -s: also reap when tini is not PID 1 (e.g. under `docker run --init`).
ENTRYPOINT ["/sbin/tini", "-s", "--", "/app/entrypoint.sh"]

# Server image
FROM runtime-base AS server
COPY --from=frp-base /app/frps /usr/local/bin/frps
COPY frps.toml.template /app/frps.toml.template
EXPOSE 7000 7500 8080 8443
ENV MODE=server

# Client image
FROM runtime-base AS client
COPY --from=frp-base /app/frpc /usr/local/bin/frpc
COPY frpc.toml.template /app/frpc.toml.template
EXPOSE 7400
ENV MODE=client

# Combined image (default)
FROM runtime-base AS both
COPY --from=frp-base /app/frps /usr/local/bin/frps
COPY --from=frp-base /app/frpc /usr/local/bin/frpc
COPY frps.toml.template /app/frps.toml.template
COPY frpc.toml.template /app/frpc.toml.template
EXPOSE 7000 7500 7400 8080 8443

# Default environment variables
ENV MODE=server
ENV BIND_PORT=7000
ENV DASHBOARD_PORT=7500
ENV DASHBOARD_USER=admin
ENV ADMIN_PORT=7400
ENV VHOST_HTTP_PORT=8080
ENV VHOST_HTTPS_PORT=8443
# DASHBOARD_PASSWORD / ADMIN_PASSWORD must be set at runtime when the config
# is generated from the template; "admin" or empty is refused.
