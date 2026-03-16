# 组件职责说明

## Server（Node.js Core Server）

职责：系统中枢，负责设备管理、API、事件编排、信令入口。

具体职责：
- 提供 REST API（设备注册、事件查询、测试触发）。
- 提供 WebSocket 信令服务（为未来 WebRTC 连接准备）。
- 维护设备在线状态（内存 registry）。
- 接收帧数据并进入处理流水线。
- 调用事件引擎进行落盘与通知。

当前实现位置：
- `server/index.js`：HTTP + WS 服务入口。
- `server/router.js`：REST API。
- `stream/signaling.js`：WS 信令。

## Agent（CLI Camera Agent）

职责：运行在远端机器，采集摄像头并推送视频流。

具体职责：
- 通过 FFmpeg 采集本地摄像头。
- 按配置推送 RTSP 流到服务端/流媒体服务。
- 启动前向服务端进行设备注册。

当前实现位置：
- `agent/cli.js`：命令行入口。
- `agent/camera.js`：摄像头启动。
- `agent/stream.js`：FFmpeg 进程与推流参数。

## Dashboard（Next.js/React）

职责：运营控制台，提供实时监控和事件查看。

具体职责：
- 展示设备在线状态。
- 展示事件列表与事件详情。
- 为后续实时视频播放提供入口。

当前实现位置：
- `dashboard/nextjs-app/pages`：页面。
- `dashboard/nextjs-app/styles`：样式。
