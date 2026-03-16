# 摄像头帧流规范

## 功能目标

从被监控电脑周期性抓取摄像头帧并上传服务端，Dashboard 展示最新帧。

## Agent 行为

- 启动参数 `--camera-frames` 时启用。
- 默认每 1000ms 抓取一帧（`--camera-frames-interval <ms>` 可调整）。
- 使用 FFmpeg 抓取单帧 JPG 并上报。

## Server API

`POST /camera/frame`

请求体：
```json
{
  "deviceId": "cam-001",
  "frameBase64": "<base64>",
  "timestamp": "2026-03-16T04:00:00.000Z"
}
```

`GET /camera/latest?deviceId=cam-001`

响应：`image/jpeg`（最新帧）
