# API 规格（初版）

Base URL: `http://<server-host>:3000`

## 1. 设备注册

`POST /device/register`

请求头：
- `Content-Type: application/json`
- 可选：`X-Device-Token: <token>`

请求体：
```json
{ "id": "cam-001" }
```

响应：
```json
{ "ok": true, "id": "cam-001" }
```

错误：
- 400：缺少设备 id
- 401：token 不合法（当服务端设置了 DEVICE_TOKEN）

## 2. 设备列表

`GET /devices`

响应：
```json
{ "devices": [ { "id": "cam-001", "lastSeen": 1700000000000 } ] }
```

## 3. 上传帧（内部使用）

`POST /stream/frame`

请求头：
- `Content-Type: application/json`
- 可选：`X-Device-Token: <token>`

请求体：
```json
{
  "deviceId": "cam-001",
  "frameBase64": "<base64> ",
  "meta": {
    "pose": { "tiltDeg": 75, "heightDrop": 0.5 },
    "motion": { "state": "lying", "immobileSeconds": 1.2 }
  }
}
```

响应：
```json
{ "ok": true }
```

## 4. 触发测试事件

`POST /events/test`

请求体：
```json
{ "deviceId": "cam-001" }
```

响应：
```json
{ "ok": true, "event": { "id": "..." } }
```

## 5. 查询事件列表

`GET /events`

响应：
```json
{ "events": [ { "id": "...", "type": "fall", "timestamp": "..." } ] }
```

## 6. 查询单个事件

`GET /events/:id`

响应：
```json
{ "event": { "id": "...", "snapshot": "...", "video": "..." } }
```
