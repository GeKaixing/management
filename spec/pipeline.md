# Pipeline 规格

## 帧处理流程

`frame -> ring buffer -> fall detector -> event engine`

## Ring Buffer

- 输入：每帧数据 `{ buffer, ts, meta }`
- 输出：最近 N 帧数组
- N = fps * seconds（默认 30 * 10）

## Fall Detector（初版规则）

触发条件之一满足即触发：
- 姿态：`tiltDeg >= 70` 且 `heightDrop >= 0.4`
- 动作：`state == lying` 且 `immobileSeconds >= 1.0`

## 事件触发

事件触发后执行：
- 快照保存：`recorder/snapshot.js`
- 录像保存：`recorder/videoRecorder.js`
- 事件落盘：`storage/db.js`
- 告警输出：`events/alert.js`
