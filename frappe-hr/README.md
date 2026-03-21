# 子项目：本地部署人力资源管理系统 Frappe HR

## 方案说明
本子项目采用 Frappe HR 官方仓库内置的 Docker 开发环境进行本地部署：

1. 克隆官方仓库 `frappe/hrms`
2. 进入 `hrms/docker`
3. 运行 `docker compose up -d`

这样能最大程度保持与官方文档一致，后续升级也更简单。

## 目录说明
- `start.ps1` / `start.sh`：首次自动克隆仓库并启动
- `stop.ps1` / `stop.sh`：停止容器
- `hrms-src/`：首次启动后自动拉取的官方源码目录

## 前置要求
- 已安装 Docker Desktop（或 Docker Engine + Docker Compose）
- 已安装 Git

## 启动（Windows PowerShell）
在 `C:\Users\KaiXing\Desktop\management\frappe-hr` 目录执行：

```powershell
.\start.ps1
```

## 启动（macOS/Linux/Git Bash）
在仓库根目录执行：

```bash
cd frappe-hr
chmod +x start.sh stop.sh
./start.sh
```

## 访问地址与默认账号
- 地址：`http://localhost:8000`
- 用户名：`Administrator`
- 密码：`admin`

首次启动会自动初始化站点，通常需要等待几分钟。若页面暂时打不开，可用日志确认状态。

## 常用命令
```powershell
# 实时日志（Windows）
cd .\hrms-src\docker
docker compose logs -f

# 停止（在 frappe-hr 目录）
.\stop.ps1
```

```bash
# 实时日志（Linux/macOS）
cd hrms-src/docker
docker compose logs -f

# 停止（在 frappe-hr 目录）
./stop.sh
```

## 参考
- Frappe HR 官方仓库（Docker 开发启动说明）：
  https://github.com/frappe/hrms
