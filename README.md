# Remote Camera System

This repository contains a minimal working skeleton for a remote camera monitoring system.
It provides a CLI agent for camera capture, a Node.js server with REST + WebSocket signaling,
frame processing with a ring buffer, event handling, and a basic Next.js dashboard.

## Requirements

- Node.js 18+
- FFmpeg in PATH for real video capture

## Quick start

1. Install dependencies at the repo root:

   npm install

2. Start the server:

   npm run server

3. Start the agent (example):

   node agent/cli.js start --device cam-001 --server http://localhost:3000 --camera "video=Integrated Camera"

4. Start the dashboard (optional):

   npm run dashboard

## Notes

- This project is a skeleton. WebRTC media transport is stubbed; RTSP is used in the agent example.
- Event storage is file-based for now and can be replaced by PostgreSQL later.
- Video clip encoding depends on FFmpeg; if FFmpeg is missing the recorder will create empty files.

## Project structure

- agent/: CLI camera agent
- server/: Node.js core server
- stream/: signaling and frame pipeline
- ai/: fall detection stubs
- recorder/: ring buffer, snapshot, video clip recorder
- events/: event engine and alerts
- storage/: storage and database helpers
- dashboard/: Next.js app
