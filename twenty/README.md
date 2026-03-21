# 子项目：本地部署客户管理系统 Twenty

## 目录说明
- `docker-compose.yml`: Twenty 本地启动编排（server + worker + postgres + redis）
- `.env.example`: 本地环境变量模板（默认端口 `3020`，避免与主项目 `3000` 冲突）

## 启动步骤
在 `C:\Users\KaiXing\Desktop\management\twenty` 目录执行：

```powershell
Copy-Item .env.example .env
docker compose up -d
```

首次拉取镜像会稍慢，完成后访问：
- Twenty: `http://localhost:3020`

## 常用命令
```powershell
# 查看日志
docker compose logs -f

# 停止并移除容器
docker compose down

# 停止并删除数据卷（谨慎：会清空 Twenty 数据）
docker compose down -v
```

## 可选配置
- 如果你想改端口，修改 `.env` 中 `TWENTY_PORT` 和 `SERVER_URL`（两者保持一致）。
- 建议在 `.env` 中设置强密码 `PG_DATABASE_PASSWORD` 与随机 `APP_SECRET`。

## 说明
- 本子项目配置基于 Twenty 官方 Docker Compose 方案做了本地化端口调整。
- 当前为本地开发/体验部署，适合单机使用。
