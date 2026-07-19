# 使用 GitHub Actions 构建并从 GHCR 部署

本方案由 GitHub Actions 构建 CPA Manager Plus 镜像并推送到 GitHub Container Registry（GHCR），服务器只需拉取镜像后使用 Docker Compose 启动。工作流在 `main` 分支收到 push 时自动运行，也可以在仓库的 **Actions > Build Fork Image > Run workflow** 手动触发。为避免其他分支覆盖生产用的 `latest`，构建任务只会在 `main` 分支执行。

每次构建会同时发布 `linux/amd64` 和 `linux/arm64`，并生成两个标签：

- `ghcr.io/<仓库所有者>/cpa-manager-plus:latest`
- `ghcr.io/<仓库所有者>/cpa-manager-plus:<完整提交 SHA>`

## 1. 启用工作流写入权限

工作流使用仓库自动提供的 `GITHUB_TOKEN`，不需要额外创建推送镜像用的密钥。它已经声明 `contents: read` 和 `packages: write`。

通常不需要把整个仓库的默认工作流权限改为 Read and write；当前工作流已经只为自身声明最小的 `packages: write`。如果推送 GHCR 仍返回权限错误，请先检查包页面的 **Manage Actions access**、仓库/组织的 Actions 策略，以及组织是否禁止工作流写入 Packages。

## 2. 设置 GitHub Packages 可见性

首次构建完成后，在 GitHub 个人主页或组织主页进入 **Packages > cpa-manager-plus > Package settings** 检查访问权限。新包通常是私有包，也可能按仓库或组织策略继承可见性。

- 公共部署：将包的 **Change visibility** 设置为 **Public**。公共 GHCR 镜像可以匿名拉取。
- 私有部署：保持 **Private**，并确认运行工作流的仓库已在包的 **Manage Actions access** 中获得写权限；服务器需要使用有 `read:packages` 权限的 Personal Access Token（classic）登录。

可见性改为 Public 通常不可逆，请先确认镜像中不包含私密配置。当前 Dockerfile 只打包应用，不应把服务器的 `/data` 数据卷放进镜像。

## 3. 在服务器登录 GHCR

私有包需要先登录。创建一个 Personal Access Token（classic），至少授予 `read:packages`；如果账号启用了组织 SSO，还要为该 Token 授权 SSO。然后在服务器执行：

```bash
export CR_PAT='你的 GitHub Personal Access Token'
echo "$CR_PAT" | docker login ghcr.io -u 你的GitHub用户名 --password-stdin
unset CR_PAT
```

公共包可跳过登录。

## 4. 拉取并启动

把仓库中的 `docker-compose.ghcr.yml` 放到服务器部署目录，然后执行：

```bash
docker compose -f docker-compose.ghcr.yml pull
docker compose -f docker-compose.ghcr.yml up -d
docker compose -f docker-compose.ghcr.yml ps
```

默认镜像为 `ghcr.io/hiki79/cpa-manager-plus:latest`，数据保存在 Docker named volume `cpa-manager-plus-data` 中。为避免把管理面板直接暴露到公网，Compose 默认只绑定服务器回环地址 `127.0.0.1:18317`。先在服务器验证：

```bash
curl -fsS http://127.0.0.1:18317/health
```

生产环境建议使用 Caddy、Nginx、Traefik 或 VPN，把 HTTPS 请求反向代理到 `http://127.0.0.1:18317`，然后通过自己的 HTTPS 域名打开：

```text
https://<你的域名>/management.html
```

如果只是临时测试且已经配置防火墙，也可以在 `.env` 中显式允许外部直连：

```dotenv
CPAMP_BIND_ADDRESS=0.0.0.0
CPAMP_PORT=18317
```

此时可访问 `http://<服务器地址>:18317/management.html`。不建议把明文 HTTP 管理端长期暴露在公网。

如需部署其他所有者、标签或回滚到固定提交，可以用 `CPAMP_IMAGE` 覆盖镜像：

```bash
CPAMP_IMAGE=ghcr.io/hiki79/cpa-manager-plus:<完整提交SHA> \
  docker compose -f docker-compose.ghcr.yml up -d
```

也可以在 Compose 文件同目录创建 `.env`：

```dotenv
CPAMP_IMAGE=ghcr.io/hiki79/cpa-manager-plus:<完整提交SHA>
```

生产服务器建议固定完整提交 SHA，而不是长期跟随可覆盖的 `latest`。需要升级时先修改这个值，再执行 `pull` 和 `up -d`，这样回滚目标也更明确。

如果 CPA 本体运行在同一台 Linux 宿主机上，面板首次配置 CPA 地址时可填写：

```text
http://host.docker.internal:8317
```

本 Compose 已添加 Linux 的 `host-gateway` 映射。如果 CPA 也运行在 Docker 中，更推荐让两个服务加入同一个 Docker network，并使用 CPA 的服务名作为主机名。

默认 CORS 只声明本机管理地址。管理页面与 API 同源访问不受影响；只有把其他域名上的独立前端连接到该 API 时，才需要在 `.env` 中设置 `CPAMP_CORS_ORIGINS=https://panel.example.com`，多个来源用英文逗号分隔。

> 仓库中原有的 `Build and Release` 是上游正式发版工作流，并包含上游镜像目标。fork 日常部署只需要使用本文的 `Build Fork Image`，不要仅为服务器部署创建 `v*` 标签。

## 5. 查看 Admin Key

首次启动且未显式配置管理员密钥时，服务只在首次启动日志中输出一次生成的 `cpamp_...`：

```bash
docker compose -f docker-compose.ghcr.yml logs cpa-manager-plus \
  | grep 'CPA Manager Plus admin key generated'
```

请立即妥善保存该密钥，不要把含有密钥的终端截图发给他人。如果日志已经轮转且密钥丢失，请先备份数据，再按照项目的 `docs/reset-admin-key.zh-CN.md` 重置管理员密钥。

该通用指南示例使用的是 `docker-compose.manager.yml`；使用本文 GHCR 方案时，把其中的 Compose 文件名替换为 `docker-compose.ghcr.yml`。对应命令为：

```bash
docker compose -f docker-compose.ghcr.yml stop cpa-manager-plus
docker compose -f docker-compose.ghcr.yml run --rm cpa-manager-plus reset-admin-key
docker compose -f docker-compose.ghcr.yml up -d cpa-manager-plus
```

## 6. 升级

`main` 分支产生新构建并成功推送后，在服务器部署目录执行：

```bash
docker compose -f docker-compose.ghcr.yml pull
docker compose -f docker-compose.ghcr.yml up -d
docker compose -f docker-compose.ghcr.yml ps
```

`up -d` 会用新镜像重建容器，但保留 `cpa-manager-plus-data` 数据卷。出现问题时，把 `CPAMP_IMAGE` 改为升级前的完整提交 SHA 标签，再次执行 `up -d` 即可回滚应用版本。不要在未确认兼容性的情况下回滚数据库数据。

## 7. 备份与恢复

数据卷包含 SQLite 数据库和 `/data/data.key`。二者必须一起备份，否则已加密保存的 CPA Management Key 可能无法解密。为避免复制 SQLite 写入中的文件，先停止服务再备份：

```bash
DATA_VOLUME="$(docker inspect \
  "$(docker compose -f docker-compose.ghcr.yml ps -q cpa-manager-plus)" \
  --format '{{range .Mounts}}{{if eq .Destination "/data"}}{{.Name}}{{end}}{{end}}')"
test -n "$DATA_VOLUME" || { echo '未找到 /data 数据卷'; exit 1; }

docker compose -f docker-compose.ghcr.yml stop cpa-manager-plus
docker run --rm \
  -v "$DATA_VOLUME":/data:ro \
  -v "$PWD":/backup \
  alpine:3.21 \
  tar -czf /backup/cpa-manager-plus-data-$(date +%F-%H%M%S).tar.gz -C /data .
docker compose -f docker-compose.ghcr.yml start cpa-manager-plus
```

这里会先从正在运行的容器中读取 `/data` 对应的真实卷名，避免 Compose project name 前缀导致误备份一个新建的空卷。也可以用 `docker volume ls` 再次核对。

恢复前先停止服务，并建议先保留当前数据卷的额外备份。然后把备份包解压回同一个数据卷，确认文件所有权和权限未被意外改变，再重新启动服务。
