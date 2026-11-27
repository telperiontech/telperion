# syntax=docker/dockerfile:1
# Beacon: release lifecycle panel (Go server with the Angular UI embedded)
#
# The context is apps/beacon. The UI imports workspace libraries (@telperion/ng-pack,
# @telperion/ng-ui and their dependencies) from the repo root, passed as the named
# build context "workspace":
#
#   docker build --build-context workspace=../.. .                 (in apps/beacon)
#   docker build --build-context workspace=. --target test apps/beacon   (repo root)

# UI: built once on the build platform; its output is the same for every architecture.
FROM --platform=$BUILDPLATFORM node:22-bookworm-slim AS ui
ENV COREPACK_ENABLE_DOWNLOAD_PROMPT=0 NX_DAEMON=false NX_NO_CLOUD=true CI=true
RUN corepack enable
WORKDIR /workspace
# hadolint ignore=DL3022
COPY --from=workspace package.json pnpm-lock.yaml ./
RUN --mount=type=cache,id=beacon-pnpm-store,target=/pnpm-store \
    pnpm install --frozen-lockfile --store-dir /pnpm-store
# All of libs/ (sources only, see the root .dockerignore): the UI's libraries
# import further workspace libraries, and a hand-kept list would go stale.
# hadolint ignore=DL3022
COPY --from=workspace tsconfig.base.json ./
# hadolint ignore=DL3022
COPY --from=workspace libs libs
COPY ui apps/beacon/ui
# Nx sees only beacon-ui: a plugin-free nx.json (the repo's plugins need projects
# this stage does not copy) and no project.json of the copied libraries (their
# docs apps depend on osw projects). The libraries are compiled from source.
RUN echo '{}' > nx.json \
    && find libs -name project.json -delete \
    && pnpm exec nx run beacon-ui:build --skip-nx-cache \
    && node apps/beacon/ui/scripts/check-gzip-budget.mjs apps/beacon/internal/web/dist 250

FROM --platform=$BUILDPLATFORM golang:1.25-alpine AS src
WORKDIR /src
COPY go.mod ./
COPY cmd ./cmd
COPY internal ./internal
COPY --from=ui /workspace/apps/beacon/internal/web/dist ./internal/web/dist

# Unit tests: docker build --build-context workspace=../.. --target test .
FROM src AS test
RUN go vet ./... && go test ./...

FROM src AS build
ARG TARGETOS
ARG TARGETARCH
ARG VERSION=dev
# Pure Go (no cgo), so cross-compiling for arm64 needs no emulation.
RUN CGO_ENABLED=0 GOOS=$TARGETOS GOARCH=$TARGETARCH \
    go build -trimpath -ldflags "-s -w -X main.version=${VERSION}" -o /out/beacon ./cmd/beacon \
    && mkdir -p /out/data

FROM gcr.io/distroless/static-debian12:nonroot AS runtime
COPY --from=build /out/beacon /usr/local/bin/beacon
COPY --from=build --chown=nonroot:nonroot /out/data /data
# Keeps the Go heap well under the 64 MB RSS target; override for big catalogs.
ENV GOMEMLIMIT=48MiB
VOLUME ["/data"]
# 7700 ingest (webhooks, CDEvents, /healthz), 7701 admin (UI, API; keep behind a proxy)
EXPOSE 7700 7701
USER nonroot:nonroot
HEALTHCHECK --interval=30s --timeout=5s --start-period=5s CMD ["/usr/local/bin/beacon", "healthcheck"]
ENTRYPOINT ["/usr/local/bin/beacon"]
