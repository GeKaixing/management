# 屏幕实时流规范

## 功能目标

从被监控电脑采集屏幕并实时传输到服务端，Dashboard 展示最新帧。

## Agent 行为

- 启动参数 `--screen` 时启用屏幕监控。
- 默认每 500ms 抓取一次屏幕（`--screen-interval <ms>` 可调整）。
- 使用 `screenshot-desktop` 抓取 JPG 并上报。

## Server API

`POST /screen/frame`

请求体：
```json
{
  "deviceId": "cam-001",
  "frameBase64": "<base64>",
  "timestamp": "2026-03-16T04:00:00.000Z"
}
```

`GET /screen/latest?deviceId=cam-001`

响应：`image/jpeg`（最新帧）

## Dashboard

- Live 页面通过轮询请求最新帧实现近实时预览。
