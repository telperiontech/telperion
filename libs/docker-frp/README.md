# Docker FRP - Fast Reverse Proxy Container

[![GitHub Container Registry](https://img.shields.io/badge/ghcr.io-docker--frp-blue)](https://github.com/telperiontech/telperion/pkgs/container/docker-frp)
[![License](https://img.shields.io/badge/license-Apache%202.0-green.svg)](LICENSE)
[![Version](https://img.shields.io/badge/docker--frp-1.3.0-blue.svg)](https://github.com/telperiontech/telperion/releases?q=docker-frp)
[![FRP Version](https://img.shields.io/badge/frp-v0.72.0-brightgreen.svg)](https://github.com/fatedier/frp)

A comprehensive Docker container for [FRP (Fast Reverse Proxy)](https://github.com/fatedier/frp) with both server and client modes, featuring a modern web GUI for client configuration.

## ✨ Features

### 🖥️ Server Mode
- **Easy Setup**: One-command FRP server deployment
- **Web Dashboard**: Built-in management interface
- **Configurable**: Environment variable based configuration
- **Security**: Token-based authentication support
- **TLS Support**: Optional encrypted connections
- **Health Monitoring**: Docker `HEALTHCHECK` (frps running, bind port answers)
- **Safe Logs**: Secrets are masked in the configuration printed to `docker logs`

### 💻 Client Mode
- **Admin UI**: Built-in FRP admin interface for configuration
- **Real-time Management**: Monitor and manage client connections
- **Configuration**: Environment variable and file-based configuration
- **Live Monitoring**: Real-time status and connection monitoring
- **Multiple Proxy Types**: Support for TCP, UDP, HTTP, HTTPS, STCP, XTCP

### 🏗️ Architecture
- **Multi-stage Build**: Optimized image sizes for different modes
- **Alpine Linux**: Minimal base image (Alpine 3.24)
- **Latest FRP**: Ships the latest stable FRP release (v0.72.0)
- **Multi-Platform**: Supports AMD64, ARM64, ARM v7, ARM v6, and 386 architectures
- **Cloud Native**: Kubernetes and Docker Compose ready

## 🚀 Quick Start

### Server Mode (Default)
```bash
# Basic server setup with authentication
docker run -p 7000:7000 -p 7500:7500 -p 8080:8080 -p 8443:8443 \
  -e DASHBOARD_USER=admin \
  -e DASHBOARD_PASSWORD="$(openssl rand -hex 16)" \
  -e AUTH_TOKEN="$(openssl rand -hex 32)" \
  telperiontech/docker-frp:latest

# Server with custom vhost ports
docker run -p 7000:7000 -p 7500:7500 -p 80:8080 -p 443:8443 \
  -e DASHBOARD_USER=admin \
  -e DASHBOARD_PASSWORD=your_strong_password \
  -e AUTH_TOKEN=your_random_token \
  -e VHOST_HTTP_PORT=8080 \
  -e VHOST_HTTPS_PORT=8443 \
  telperiontech/docker-frp:latest
```

> **`DASHBOARD_PASSWORD` is required** when the configuration is generated from the template:
> the container refuses to start when it is empty or `admin`. The same holds for
> `ADMIN_PASSWORD` in client mode. A configuration you mount yourself is used as is.

> **Without `AUTH_TOKEN`** frps accepts every client. Leave it unset only when frps uses
> [frp-gate](../frp-gate) as its auth plugin: frp-gate then checks a token per client.

**Access points:**
- **Server Dashboard:** http://localhost:7500 (the user and password you set)
- **Client Admin UI:** http://localhost:7400 (the user and password you set)
- **HTTP Proxies:** http://localhost:8080 (via vhostHTTPPort)
- **HTTPS Proxies:** https://localhost:8443 (via vhostHTTPSPort)

### Client Mode with Admin UI
```bash
# Start client with authentication
docker run -p 7400:7400 \
  -e MODE=client \
  -e SERVER_ADDR=your.server.com \
  -e AUTH_TOKEN=your_random_token \
  -e ADMIN_USER=admin \
  -e ADMIN_PASSWORD=your_strong_password \
  telperiontech/docker-frp:latest

# Access admin UI at: http://localhost:7400
```

For a client of an [frp-gate](../frp-gate) server, mount your own `frpc.toml` (with `user` and
`metadatas.token = "{{ .Envs.FRP_GATE_TOKEN }}"`) instead; see the frp-gate README.

## 📦 Installation

### Pre-built Images
```bash
# Latest version (both server and client)
docker pull telperiontech/docker-frp:latest

# Server-only image (smaller)
docker pull telperiontech/docker-frp:server

# Client-only image (with admin UI)
docker pull telperiontech/docker-frp:client
```

### Build from Source
```bash
# Clone this repository
git clone https://github.com/telperiontech/telperion.git
cd telperion/libs/docker-frp

# Build all variants
nx run docker-frp:build-all

# Or build specific variants
nx run docker-frp:build:server
nx run docker-frp:build:client
```

## 🛠️ Configuration

### 📁 Persistent Configuration

Docker FRP supports persistent configuration storage through volume mounting. This allows you to:
- **Backup configurations**: Keep your settings safe across container updates
- **Easy editing**: Modify configuration files directly on the host
- **Configuration management**: Version control your FRP configurations

#### How it works:
1. **Simple priority**: Uses existing config from volume → generates from template if none exists
2. **Direct execution**: FRP runs directly from `/app/configs/` directory (no temporary files)
3. **Volume-first**: Mount your own `frps.toml` or `frpc.toml` files for custom configurations
4. **Persistent storage**: All configurations automatically saved to mounted volume for reuse

> ⚠️ **An existing `/app/configs/frps.toml` or `frpc.toml` is never regenerated.** The
> environment variables in the tables below are only used the first time, to generate the
> file. After that, changing `DASHBOARD_PASSWORD`, `AUTH_TOKEN`, ports and so on **does nothing**
> until you delete the file (or edit it) and restart the container. The startup log says
> `Using existing configuration` when this is the case.

#### Secrets in your own config

At startup the container prints the configuration with secrets masked: the value of every key
whose last part contains `token`, `password`, `passwd`, `secret` or `key` (also inside tables,
inline tables and multi-line arrays, e.g. `metadatas.token`, `[auth]` `token`,
`webServer.password`) becomes `"***"`, and so does the key in an frp-gate plugin path
(`/frps/***`). Values that are only `{{ .Envs.NAME }}` placeholders are printed as they are,
so you can see which variable is used. The file itself is never changed.

Prefer `{{ .Envs.NAME }}` placeholders (frp's own templating) over literal secrets in mounted
files: then the secret lives only in the container's environment.

#### Usage:
```bash
# Create a configs directory on your host
mkdir -p ./frp-configs

# Server with persistent config
docker run -p 7000:7000 -p 7500:7500 -p 8080:8080 -p 8443:8443 \
  -v ./frp-configs:/app/configs \
  -e DASHBOARD_PASSWORD=secure123 \
  telperiontech/docker-frp:server

# Client with persistent config  
docker run -p 7400:7400 \
  -v ./frp-configs:/app/configs \
  -e MODE=client \
  -e SERVER_ADDR=your.server.com \
  -e ADMIN_PASSWORD=secure123 \
  telperiontech/docker-frp:client
```

#### Configuration Files:
- **Server**: `/app/configs/frps.toml`
- **Client**: `/app/configs/frpc.toml`

To use a config from elsewhere (e.g. rendered by Ansible), mount it at that path.

### Server Mode Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `MODE` | `server` | Container mode (server/client) |
| `BIND_PORT` | `7000` | FRP server bind port |
| `DASHBOARD_PORT` | `7500` | Web dashboard port |
| `DASHBOARD_USER` | `admin` | Dashboard username |
| `DASHBOARD_PASSWORD` | *(required)* | Dashboard password. Empty or `admin` is refused when the config is generated |
| `AUTH_TOKEN` | *(optional)* | Client authentication token. If not set, frps accepts every client: only do this when frp-gate is the auth plugin |
| `LOG_LEVEL` | `info` | Log level (trace/debug/info/warn/error) |
| `TLS_ENABLE` | `false` | Enable TLS encryption |
| `TLS_CERT_FILE` | `` | TLS certificate file path |
| `TLS_KEY_FILE` | `` | TLS private key file path |
| `VHOST_HTTP_PORT` | `8080` | HTTP virtual host port |
| `VHOST_HTTPS_PORT` | `8443` | HTTPS virtual host port |

### Client Mode Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `MODE` | `server` | Set to `client` for client mode |
| `SERVER_ADDR` | `x.x.x.x` | FRP server address |
| `SERVER_PORT` | `7000` | FRP server port |
| `AUTH_TOKEN` | *(optional)* | Authentication token (must match server if server has auth) |
| `ADMIN_PORT` | `7400` | FRP client admin UI port |
| `ADMIN_USER` | `admin` | Admin UI username |
| `ADMIN_PASSWORD` | *(required)* | Admin UI password. Empty or `admin` is refused when the config is generated |
| `LOG_LEVEL` | `info` | Log level |

## 📋 Usage Examples

### Docker Compose

#### Complete Setup (Server + Client) with Persistent Configs
```yaml
version: '3.8'

services:
  frp-server:
    image: telperiontech/docker-frp:server
    ports:
      - "7000:7000"  # FRP server port
      - "7500:7500"  # Dashboard
      - "8080:8080"  # HTTP vhost
      - "8443:8443"  # HTTPS vhost
      - "6000-6010:6000-6010"  # Proxy ports
    environment:
      - MODE=server
      - DASHBOARD_USER=admin
      - DASHBOARD_PASSWORD=your_secure_password
      - AUTH_TOKEN=your_secret_token
    volumes:
      - ./frp-server-configs:/app/configs  # Persistent server configuration
    restart: unless-stopped

  frp-client:
    image: telperiontech/docker-frp:client
    ports:
      - "7400:7400"  # Admin UI
    environment:
      - MODE=client
      - SERVER_ADDR=frp-server
      - SERVER_PORT=7000
      - AUTH_TOKEN=your_secret_token
      - ADMIN_USER=admin
      - ADMIN_PASSWORD=your_secure_password
    volumes:
      - ./frp-client-configs:/app/configs  # Persistent client configuration
    depends_on:
      - frp-server
    restart: unless-stopped

volumes:
  frp-server-configs:
  frp-client-configs:
```

**First run creates**: 
- `./frp-server-configs/frps.toml` - Server configuration
- `./frp-client-configs/frpc.toml` - Client configuration

#### Server Only
```yaml
version: '3.8'

services:
  frp-server:
    image: telperiontech/docker-frp:server
    ports:
      - "7000:7000"
      - "7500:7500"
      - "8080:8080"  # HTTP vhost
      - "8443:8443"  # HTTPS vhost
      - "6000-6100:6000-6100"  # Proxy port range
    environment:
      - MODE=server
      - BIND_PORT=7000
      - DASHBOARD_PORT=7500
      - DASHBOARD_USER=admin
      - DASHBOARD_PASSWORD=secure_password_123
      - AUTH_TOKEN=my_secure_token_456
      - LOG_LEVEL=info
      - VHOST_HTTP_PORT=8080
      - VHOST_HTTPS_PORT=8443
    volumes:
      - frp_logs:/app/logs
    restart: unless-stopped

volumes:
  frp_logs:
```

### Kubernetes Deployment

#### Server Deployment
```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: frp-server
spec:
  replicas: 1
  selector:
    matchLabels:
      app: frp-server
  template:
    metadata:
      labels:
        app: frp-server
    spec:
      containers:
      - name: frp-server
        image: telperiontech/docker-frp:server
        ports:
        - containerPort: 7000
        - containerPort: 7500
        env:
        - name: MODE
          value: "server"
        - name: DASHBOARD_USER
          value: "admin"
        - name: DASHBOARD_PASSWORD
          valueFrom:
            secretKeyRef:
              name: frp-secret
              key: dashboard-password
        - name: AUTH_TOKEN
          valueFrom:
            secretKeyRef:
              name: frp-secret
              key: auth-token
---
apiVersion: v1
kind: Service
metadata:
  name: frp-server-service
spec:
  selector:
    app: frp-server
  ports:
  - name: frp
    port: 7000
    targetPort: 7000
  - name: dashboard
    port: 7500
    targetPort: 7500
  type: LoadBalancer
```

### Advanced Examples

#### Server with TLS
```bash
docker run -d \
  --name frp-server \
  -p 7000:7000 \
  -p 7500:7500 \
  -v /path/to/certs:/certs:ro \
  -e MODE=server \
  -e TLS_ENABLE=true \
  -e TLS_CERT_FILE=/certs/server.crt \
  -e TLS_KEY_FILE=/certs/server.key \
  -e DASHBOARD_PASSWORD=your_strong_password \
  -e AUTH_TOKEN=super_secure_token \
  telperiontech/docker-frp:server
```

#### Client with Custom Config
```bash
# Create custom config
cat > frpc.toml << EOF
serverAddr = "your-server.example.com"
serverPort = 7000

[auth]
token = "your_token_here"

[[proxies]]
name = "ssh"
type = "tcp"
localIP = "127.0.0.1"
localPort = 22
remotePort = 6000

[[proxies]]
name = "web"
type = "http"
localPort = 8080
customDomains = ["web.example.com"]
EOF

# Run with custom config: a file at /app/configs/frpc.toml is used as is
docker run -d \
  --name frp-client \
  -v $(pwd)/frpc.toml:/app/configs/frpc.toml:ro \
  telperiontech/docker-frp:client
```

## 🌐 Admin UI Usage

### Client Admin Interface

1. **Access the Admin UI**
   ```
   http://localhost:7400
   ```

2. **Login**
   - Use the configured `ADMIN_USER` and `ADMIN_PASSWORD`

3. **Monitor Client**
   - View real-time connection status
   - Monitor active proxies and tunnels
   - Check client statistics and logs

4. **Manage Proxies**
   - View configured proxy rules
   - Monitor proxy status and traffic
   - Access detailed connection information

### Proxy Types Supported

| Type | Description | Use Case |
|------|-------------|----------|
| **TCP** | TCP port forwarding | SSH, databases, general TCP services |
| **UDP** | UDP port forwarding | DNS, gaming, video streaming |
| **HTTP** | HTTP reverse proxy | Web applications with custom domains |
| **HTTPS** | HTTPS reverse proxy | Secure web applications |
| **STCP** | Secret TCP | Private services with shared key |
| **XTCP** | P2P TCP | Direct peer-to-peer connections |

## 🔧 Development

### Project Structure
```
libs/docker-frp/
├── Dockerfile              # Multi-stage Docker build with simplified architecture
├── entrypoint.sh           # Unified container entrypoint with integrated configuration
├── mask-config.sh          # Prints a config with secrets masked
├── healthcheck.sh          # Docker HEALTHCHECK (process + port)
├── project.json            # Nx project configuration
├── frps.toml.template      # Server configuration template
├── frpc.toml.template      # Client configuration template
├── test.sh                 # Test suite
├── test/mask/              # Masking samples (*.toml) and expected output (*.expected)
└── README.md               # This file
```

Build args: `FRP_VERSION` (default `0.72.0`), `VERSION` and `BUILD_DATE`. The last two are
set by the release workflow; they become OCI labels and the `Version:` line printed at
startup.

### Building the Project

```bash
# Build all variants
nx run docker-frp:build-all

# Build specific variants
nx run docker-frp:build:server
nx run docker-frp:build:client

# Run in development
nx run docker-frp:run-server
nx run docker-frp:run-client
```

### Testing the Project

Comprehensive test suites are available:

```bash
# Linux/Mac - Run test suite
./test.sh

# With verbose output
VERBOSE=true ./test.sh        # Linux/Mac

# Custom test configuration
TEST_TAG=my-test CLEANUP_ON_SUCCESS=false ./test.sh

# Windows (Git Bash): stop MSYS from rewriting the -v paths
MSYS_NO_PATHCONV=1 ./test.sh
```

**Test Coverage:**
- ✅ Docker multi-stage builds (server, client, combined)
- ✅ Container startup and FRP functionality
- ✅ Server dashboard and VHost ports
- ✅ Client admin UI and server connection
- ✅ Volume persistence and configuration priority
- ✅ Secret masking: sample configs in `test/mask/` and mounted configs in `docker logs`
- ✅ Refusal of empty / `admin` passwords for generated configs; mounted configs unaffected
- ✅ HEALTHCHECK (healthy server and clients, failing probe)
- ✅ Help functionality, build info and environment variables

### Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/amazing-feature`
3. Make your changes
4. Test thoroughly
5. Commit: `git commit -m 'Add amazing feature'`
6. Push: `git push origin feature/amazing-feature`
7. Open a Pull Request

## 🐛 Troubleshooting

### Common Issues

#### Architecture Compatibility
If you see the error `cannot execute binary file: Exec format error`, this means you're running the container on a different CPU architecture than expected.

**Solution:**
- **For Docker Hub/GHCR users**: Use the latest multi-platform image tags (v1.0.0+) which automatically select the correct architecture
- **For manual builds**: Ensure Docker BuildKit is enabled and use `--platform` flag:
```bash
# Build for your current platform
docker build --target client -t frp-client .

# Build for specific platform
docker build --platform linux/arm64 --target client -t frp-client .
```

**Supported Architectures:**
- `linux/amd64` (Intel/AMD 64-bit)
- `linux/arm64` (ARM 64-bit, Apple Silicon, Raspberry Pi 4+)
- `linux/arm/v7` (ARM 32-bit v7, Raspberry Pi 3+)
- `linux/arm/v6` (ARM 32-bit v6, Raspberry Pi Zero/1/2)
- `linux/386` (Intel/AMD 32-bit)

#### Server Mode
```bash
# Check server logs
docker logs container_name

# Test server connectivity
telnet your-server-ip 7000

# Access dashboard
curl http://your-server-ip:7500
```

#### Client Mode
```bash
# Check web GUI logs
docker logs container_name

# Access web interface
curl http://localhost:7400

# Check FRP client logs in admin UI
# Go to http://localhost:7400 and log in with admin credentials
```

#### Connection Issues
- Verify firewall settings on both server and client
- Ensure auth tokens match between server and client
- Check network connectivity between client and server
- Verify port mappings in Docker run commands

### Debug Mode
```bash
# Run with debug logging
docker run -e LOG_LEVEL=debug telperiontech/docker-frp

# Access container shell
docker exec -it container_name /bin/bash

# Check configuration files (these are the files frp runs with)
docker exec container_name cat /app/configs/frps.toml  # Server config
docker exec container_name cat /app/configs/frpc.toml  # Client config
```

## 📊 Monitoring

### Health Checks

Every image has a Docker `HEALTHCHECK` (`/app/healthcheck.sh`, every 30 s). It reads the
config in `/app/configs` and reports healthy when:

| Mode | Checks |
|------|--------|
| server | `frps` is running and `bindPort` (default 7000) accepts a TCP connection on `bindAddr` (127.0.0.1 when unset or `0.0.0.0`) |
| client | `frpc` is running and, if the admin UI is enabled, `webServer.port` accepts a connection. Without `webServer` only the process is checked |

The images run [tini](https://github.com/krallin/tini) as the init (`tini -s`), so processes the
health check leaves behind are reaped. Images up to 1.3.0 ran frps/frpc as PID 1: each passing
port probe left a zombie (BusyBox `timeout`'s watchdog), and after about a day the container hit
its pids limit and every health check failed with `procReady not received`. With those images,
run the container with `init: true` (Compose) or `--init`.

A port written as `{{ .Envs.X }}` is not probed. The client check does not tell whether frpc
is logged in to its server; use the admin UI or the server dashboard for that.

```bash
docker inspect -f '{{.State.Health.Status}}' container_name

# frp's own APIs
curl -u admin:password http://localhost:7500/api/serverinfo   # server dashboard
curl -u admin:password http://localhost:7400/api/status       # client admin UI
```

### Metrics

frps exposes Prometheus metrics on the dashboard port when `enablePrometheus = true` is set in
`frps.toml` (mount your own config for this).

## 🔒 Security

### Best Practices
- **Change Default Passwords**: Always set custom dashboard credentials
- **Use Strong Tokens**: Generate cryptographically secure auth tokens (optional but recommended)
- **Enable TLS**: Use encrypted connections in production
- **Network Isolation**: Run in isolated Docker networks
- **Regular Updates**: Keep container images updated
- **Monitor Access**: Review dashboard and proxy access logs

### Security Features
- Token-based authentication (`AUTH_TOKEN`), or per-client tokens with [frp-gate](../frp-gate)
- TLS encryption support
- Dashboard and admin UI access control; default/empty passwords are refused for generated configs
- Secrets masked in the configuration printed to `docker logs`
- No-auth mode only for setups where frp-gate is the auth plugin

## 📄 License

This project is licensed under the Apache License 2.0 - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- [FRP Project](https://github.com/fatedier/frp) - The excellent reverse proxy tool
- [Alpine Linux](https://alpinelinux.org/) - Secure, lightweight base image


## 📞 Support

- **Issues**: [GitHub Issues](https://github.com/telperiontech/telperion/issues)
- **Discussions**: [GitHub Discussions](https://github.com/telperiontech/telperion/discussions)
- **Documentation**: [Project Wiki](https://github.com/telperiontech/telperion/wiki)

---

**Made with ❤️ by the Telperion Team**
