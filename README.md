# market-sentiment-board

实时市场情绪看板（新闻驱动），覆盖 crypto / macro / tech_ai / geopolitics 四个赛道。

## 环境要求

- Node.js 18+
- npm

## 安装

```bash
npm install
```

## 启动

默认端口是 `8787`，可通过环境变量 `PORT` 覆盖。

```bash
# 默认 8787
npm start

# 自定义端口
PORT=8790 npm start
```

启动后访问：

- `http://localhost:8787`（或你指定的 `PORT`）
- 健康检查：`/api/health`
- 数据接口：`/api/data`

## 端口占用排查（EADDRINUSE）

如果出现 `EADDRINUSE: address already in use :::8787`：

### 1) 查占用进程

```bash
lsof -i :8787
```

### 2) 结束占用进程（按 PID）

```bash
kill <PID>
# 若仍占用再用
kill -9 <PID>
```

### 3) 或直接改端口启动

```bash
PORT=8790 npm start
```

## 说明

- 服务端入口：`server.js`
- 前端页面：`public/index.html`
- 缓存数据：`data/cache.json`
