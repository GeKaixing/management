# Camera/Screens/Inputs UI 规范

## 目标

- 多设备卡片展示
- 每张卡显示：设备 ID + 用户名
- 两个媒体卡：屏幕流 / 摄像头流
- 三行输入：键盘 / 鼠标 / 语音（点击展开图表）

## 数据来源

- 设备：`GET /devices`
- 屏幕：`/screen/latest?deviceId=...`
- 摄像头：`/camera/latest?deviceId=...`
- 输入：`GET /input/events`
- 语音：`GET /audio/list`

## 图表

- 默认展示最近 10 分钟
- 10 秒一个柱（60 个柱）
