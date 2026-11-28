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
# Nx sees only beacon-ui and nx-utils (whose gzip-budget executor check-budget
# runs): a plugin-free nx.json (the repo's plugins need projects this stage does
# not copy) and no other project.json (the libraries' docs apps depend on osw
# projects). The libraries are compiled from source.
RUN echo '{}' > nx.json \
    && find libs -name project.json -not -path 'libs/nx-utils/*' -delete \
    && pnpm exec nx run beacon-ui:check-budget --skip-nx-cache

FROM --platform=$BUILDPLATFORM golang:1.25-alpine AS src
# The module sits at its repo path: go.mod replaces go-kit with ../../libs/go-kit.
WORKDIR /src/apps/beacon
# hadolint ignore=DL3022
COPY --from=workspace libs/go-kit /src/libs/go-kit
COPY go.mod go.sum ./
RUN go mod download
COPY cmd ./cmd
COPY internal ./internal
COPY test ./test
COPY examples ./examples
COPY --from=ui /workspace/apps/beacon/internal/web/dist ./internal/web/dist

# Unit tests of Beacon and go-kit: docker build --build-context workspace=../.. --target test .
FROM src AS test
RUN go vet ./... && go test ./... \
    && go vet -C /src/libs/go-kit ./... && go test -C /src/libs/go-kit ./...

FROM src AS build
ARG TARGETOS
ARG TARGETARCH
ARG VERSION=dev
# Pure Go (no cgo), so cross-compiling for arm64 needs no emulation.
RUN CGO_ENABLED=0 GOOS=$TARGETOS GOARCH=$TARGETARCH \
    go build -trimpath -ldflags "-s -w -X main.version=${VERSION}" -o /out/beacon ./cmd/beacon \
    && mkdir -p /out/data

# The fake platforms of the RSS check (test/rss), not published:
#   docker build --build-context workspace=../.. --target fakeplatform -t beacon-fakeplatform .
FROM src AS fakeplatform-build
RUN CGO_ENABLED=0 go build -trimpath -o /out/fakeplatform ./test/fakeplatform \
    && mkdir -p /out/shared

FROM gcr.io/distroless/static-debian12:nonroot AS fakeplatform
COPY --from=fakeplatform-build /out/fakeplatform /fakeplatform
# A new named volume mounted here takes this ownership, so the key and the
# config it writes are readable by Beacon's nonroot user.
COPY --from=fakeplatform-build --chown=nonroot:nonroot /out/shared /shared
USER nonroot:nonroot
ENTRYPOINT ["/fakeplatform"]

# Last stage: what a plain docker build produces.
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
