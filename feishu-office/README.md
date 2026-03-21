# AFFiNE Office (Local)

This subproject runs AFFiNE locally using the official self-host Docker Compose pattern.

## Start

From repo root:

```bash
npm run office
```

Or from this folder:

```bash
docker compose up -d
```

Open:

`http://localhost:3012`

## Chinese UI

From repo root:

```bash
npm run office:zh
```

This opens AFFiNE with browser language parameter `zh-CN` (Edge/Chrome if available).

## Stop

From repo root:

```bash
npm run office:stop
```

Or from this folder:

```bash
docker compose down
```

## Logs

```bash
npm run office:logs
```

## Data persistence

Local data directories:

- `./data/postgres/pgdata`
- `./data/storage`
- `./data/config`

## Configuration

Runtime env is in `.env`. You can adjust defaults via `.env.example`.
