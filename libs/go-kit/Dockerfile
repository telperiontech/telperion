# go-kit: unit tests (docker build --target test libs/go-kit)
FROM golang:1.25-alpine AS test
WORKDIR /src
COPY go.mod go.sum ./
RUN go mod download
COPY . .
RUN go vet ./... && go test ./...
