# 子项目：本地部署 Outline 知识库与文档中心

## 方案说明
- `Outline` 负责知识库与文档中心
- `PostgreSQL` 存储文档和系统数据
- `Redis` 提供缓存与队列
- `Mailpit` 提供本地邮件收件箱（用于注册/登录邮件）

## 目录说明
- `docker-compose.yml`: 本地一键启动配置
- `.env.example`: 环境变量模板
- `start.ps1` / `start.sh`: 启动脚本（首次自动生成 `.env` 和随机密钥）
- `stop.ps1` / `stop.sh`: 停止脚本
- `storage/`、`postgres/`、`redis/`: 数据持久化目录（启动后自动创建）

## 前置要求
- 已安装 Docker Desktop（或 Docker Engine + Docker Compose）

## 启动（Windows PowerShell）
在 `C:\Users\KaiXing\Desktop\management\outline` 目录执行：

```powershell
.\start.ps1
```

## 启动（macOS/Linux/Git Bash）
在 `management/outline` 目录执行：

```bash
chmod +x start.sh stop.sh
./start.sh
```

## 访问与注册/登录
- Outline: `http://127.0.0.1:13080`
- 邮件收件箱（查看注册链接）: `http://127.0.0.1:18025`
- 流程：
  - 在 Outline 页面选择邮箱登录/注册
  - 输入邮箱后，到 Mailpit 收件箱打开邮件
  - 点击邮件里的链接完成注册并进入系统

## 停止
```powershell
.\stop.ps1
```

```bash
./stop.sh
```

## 常用命令
```powershell
# 查看日志
docker compose logs -f

# 重启
docker compose restart
```

## 说明
- 首次启动通常需要 30-90 秒完成依赖初始化。
- 当前为本地开发方案，邮件只在 Mailpit 本地收件箱内可见，不会发到公网邮箱服务器。
