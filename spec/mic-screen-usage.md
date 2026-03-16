# Screen + Mic 启动示例补充（Windows/macOS）

## Windows

```
node agent/cli.js start --device cam-001 --server http://<server-host>:3000 --camera "video=Integrated Camera" --input --screen --mic
```

若麦克风名称不同，先列出设备：
```
ffmpeg -list_devices true -f dshow -i dummy
```

然后指定：
```
--mic-input "audio=Microphone (Realtek Audio)"
```

## macOS

```
node agent/cli.js start --device cam-001 --server http://<server-host>:3000 --camera 0 --format avfoundation --input --screen --mic
```

列出设备：
```
ffmpeg -f avfoundation -list_devices true -i ""
```

若音频设备不是 0，使用：
```
--mic-input ":1"
```
