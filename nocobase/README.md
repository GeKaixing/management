# 子项目：本地部署 NocoBase

## 目录说明
- `docker-compose.yml`: 本地启动 NocoBase（NocoBase + PostgreSQL）
- `db_data/`: PostgreSQL 持久化数据目录
- `storage/`: NocoBase 持久化数据目录

## 启动步骤
在 `C:\Users\KaiXing\Desktop\management\nocobase` 目录执行：

```powershell
docker compose up -d
```

## 访问地址
- NocoBase: `http://127.0.0.1:13000`

首次访问会进入初始化流程（创建管理员账号、初始化应用）。

## 常用命令
```powershell
# 查看服务状态
docker compose ps

# 查看日志
docker compose logs -f

# 停止
docker compose down

# 重启
docker compose restart
```

## 故障排查
如果访问不到：
```powershell
docker compose ps
docker compose logs --tail=200 nocobase
```

如果页面一直 loading，请优先使用 `http://127.0.0.1:13000`，不要用 `localhost`（部分 Windows + Docker Desktop 环境下 `localhost` 的 IPv6 回环可能异常）。

## 备注
- 已显式配置 `DB_DIALECT=postgres`，避免容器循环重启。
- 生产环境请务必替换 `APP_KEY` 和数据库密码。
