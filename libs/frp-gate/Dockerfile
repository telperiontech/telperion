# frp-gate: multi-tenant gateway for frp (server plugin + Caddy TLS ask + admin UI)

FROM --platform=$BUILDPLATFORM golang:1.25-alpine AS src
WORKDIR /src
COPY go.mod go.sum ./
RUN go mod download
COPY cmd ./cmd
COPY internal ./internal

# Unit tests: docker build --target test .
FROM src AS test
RUN go vet ./... && go test ./...

FROM src AS build
ARG TARGETOS
ARG TARGETARCH
ARG VERSION=dev
# Pure Go (no cgo), so cross-compiling for arm64 needs no emulation.
RUN CGO_ENABLED=0 GOOS=$TARGETOS GOARCH=$TARGETARCH \
    go build -trimpath -ldflags "-s -w -X main.version=${VERSION}" -o /out/frp-gate ./cmd/frp-gate \
    && mkdir -p /out/data

FROM gcr.io/distroless/static-debian12:nonroot AS runtime
COPY --from=build /out/frp-gate /usr/local/bin/frp-gate
COPY --from=build --chown=nonroot:nonroot /out/data /data
ENV FRP_GATE_DB=/data/frp-gate.db
VOLUME ["/data"]
EXPOSE 7600 7601
USER nonroot:nonroot
HEALTHCHECK --interval=30s --timeout=5s --start-period=5s CMD ["/usr/local/bin/frp-gate", "healthcheck"]
ENTRYPOINT ["/usr/local/bin/frp-gate"]
