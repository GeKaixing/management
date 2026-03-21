# Remote Camera System

This repository contains a working skeleton for a remote camera monitoring system.
It provides a CLI agent for screen/camera/input/mic capture, a Node.js server with REST + WebSocket signaling,
frame processing, event handling, and a Next.js dashboard.

## Requirements

- Node.js 18/20+
- FFmpeg in PATH for camera capture (optional if using `--no-camera`)
- macOS: allow Screen Recording / Microphone / Camera permissions when prompted

## Quick start (local)

1. Install dependencies:

   npm install

2. Start the server:

   npm run server

3. Start the dashboard (Next.js on 3001):

   npm run dashboard

4. Start the agent (example):

   node agent/cli.js start --device cam-001 --server http://localhost:3000 --screen --input --no-camera

## Agent CLI usage

Basic:

```
node agent/cli.js start --device cam-001 --server http://<server-host>:3000 --screen --input --mic --camera-frames
```

Disable camera (no FFmpeg):

```
node agent/cli.js start --device cam-001 --server http://<server-host>:3000 --screen --input --no-camera
```

PowerShell tip (pass args through npm):

```
npm run agent:start --% --device cam-001 --server http://localhost:3000 --screen --input --no-camera
```

## Quick start (Docker)

This project includes Docker support for the core server and dashboard.

1. Build and start containers:

   ```bash
   docker compose up -d --build
   ```

2. Open services:

   - Server: `http://localhost:3000`
   - Dashboard: `http://localhost:3001`

3. View logs (optional):

   ```bash
   docker compose logs -f
   ```

4. Stop containers:

   ```bash
   docker compose down
   ```

Notes:
- `storage_data` is mounted to the host (`./storage_data`) for persistence.
- The CLI agent should run on the host machine (not in Docker), because it needs local screen/input/mic/camera access.
- Example host agent command (connects to Dockerized server):

  ```bash
  node agent/cli.js start --device cam-001 --server http://localhost:3000 --screen --input --no-camera
  ```

Common flags:

- `--screen` screen capture
- `--input` keyboard/mouse monitoring
- `--mic` microphone recording (continuous, segmented)
- `--camera-frames` camera frame capture for dashboard
- `--no-camera` disable camera capture
- Device ID is persisted per machine in `~/.remote-camera-device-id`. Pass `--device` once to bind.

## One-line install (interactive)

macOS/Linux/Git Bash:

```
curl -fsSL https://raw.githubusercontent.com/GeKaixing/management/main/install.sh | bash -s -- --install-method git
```

Windows PowerShell:

```
powershell -NoProfile -ExecutionPolicy Bypass -Command "iwr -useb https://raw.githubusercontent.com/GeKaixing/management/main/install.ps1 | iex"
```

Both scripts prompt for:
- server host
- device id
- which monitors to enable

## Ports

- Server: `http://localhost:3000`
- Dashboard: `http://localhost:3001`

## Notes

- WebRTC media transport is stubbed; RTSP is used for camera stream. The dashboard uses frame snapshots.
- Event storage is file-based and can be replaced by PostgreSQL later.
- Use only with explicit authorization from the monitored user.

## Project structure

- agent/: CLI camera agent
- server/: Node.js core server
- stream/: signaling and frame pipeline
- ai/: fall detection stubs
- recorder/: ring buffer, snapshot, video clip recorder
- events/: event engine and alerts
- storage/: storage and database helpers
- dashboard/: Next.js app (App Router, TS)
