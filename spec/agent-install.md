# Agent 安装与运行（Windows / macOS）

## 通用要求

- Node.js 18/20 LTS
- FFmpeg

## Windows

摄像头列举：
```
ffmpeg -list_devices true -f dshow -i dummy
```

启动示例：
```
node agent/cli.js start --device cam-001 --server http://<server-host>:3000 --camera "video=Integrated Camera" --input --screen
```

## macOS

摄像头列举：
```
ffmpeg -f avfoundation -list_devices true -i ""
```

启动示例（默认使用摄像头 0）：
```
node agent/cli.js start --device cam-001 --server http://<server-host>:3000 --camera 0 --format avfoundation --input --screen
```
