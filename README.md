# SoundTag

SoundTag 是一个面向实体物品数字化场景的 MVP 单仓项目。当前仓库包含：

- `frontend/`: 基于 Expo + React Native 的移动端，覆盖登录、NFC 扫描、录音、直传 OSS、播放详情和个人记录页。
- `backend/`: 基于 FastAPI + SQLModel 的服务端，覆盖手机号验证码登录、JWT 鉴权、标签状态路由、录音绑定/覆写、记录时间轴和阿里云 OSS STS 凭证发放。

## 已实现的 MVP 链路

1. 用户通过手机号验证码登录，拿到 JWT。
2. 客户端扫描 NFC 标签 UID，调用后端查询标签状态。
3. 新标签进入录音页，录音结束后向后端申请 OSS STS 临时凭证。
4. 客户端基于临时凭证直传音频到 OSS。
5. 上传完成后，客户端通知后端完成标签与音频元数据绑定。
6. 已绑定标签进入详情页并自动播放最新录音。
7. 个人记录页按时间倒序查看所有标签音频记录。
8. 对已绑定标签重新录音时，后端会把旧记录置为历史版本，并尝试删除旧的 OSS 对象。

## 目录结构

```text
.
├─ backend/
│  ├─ app/
│  │  ├─ api/
│  │  ├─ core/
│  │  └─ services/
│  ├─ .env.example
│  └─ requirements.txt
└─ frontend/
   ├─ src/
   │  ├─ components/
   │  ├─ contexts/
   │  ├─ navigation/
   │  ├─ screens/
   │  ├─ services/
   │  └─ utils/
   ├─ .env.example
   ├─ App.tsx
   └─ package.json
```

## 后端启动

1. 创建虚拟环境并安装依赖：

```powershell
cd backend
python -m venv .venv
.venv\Scripts\Activate.ps1
pip install -r requirements.txt
```

2. 复制环境变量模板并填写数据库、JWT 和阿里云 OSS 配置：

```powershell
Copy-Item .env.example .env
```

3. 启动 FastAPI：

```powershell
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

说明：

- `DATABASE_URL` 建议使用 PostgreSQL，示例已提供 `psycopg` 连接串。
- 本地联调如果暂时没有 PostgreSQL，可以手动把 `DATABASE_URL` 改成 `sqlite:///./soundtag.db`。
- `DEBUG_EXPOSE_OTP=true` 时，验证码会直接出现在接口响应里，方便前端联调。
- OSS 必须配置为 STS AssumeRole 方案，`OSS_ROLE_ARN` 应授予当前上传前缀的 `oss:PutObject` 权限。

## 前端启动

1. 安装依赖：

```powershell
cd frontend
npm install
```

2. 复制环境变量模板并指向你的后端地址：

```powershell
Copy-Item .env.example .env
```

3. 生成并运行自定义 Dev Client：

```powershell
npx expo run:android
# 执行下面这个
npx expo run:android
npx expo start --dev-client
```

说明：

- `react-native-nfc-manager` 不是 Expo Go 自带模块，因此 NFC 调试必须使用自定义 Dev Client。
- 真机调试时，`EXPO_PUBLIC_API_BASE_URL` 应填写手机可以访问到的局域网 IP，而不是 `localhost`。
- 当前录音上传是客户端基于 STS 凭证直传 OSS，后端只负责签发临时凭证和绑定元数据。

## 核心接口

- `POST /api/v1/auth/request-code`
- `POST /api/v1/auth/verify-code`
- `GET /api/v1/auth/me`
- `GET /api/v1/tags/{uid}`
- `POST /api/v1/tags/uploads/sts`
- `POST /api/v1/tags/{uid}/bind`
- `GET /api/v1/records`

## 当前已知约束

- iOS NFC 能力依赖原生 entitlements，首次真机构建前需要确认 Apple Developer 配置。
- 录音上传默认假设 OSS 表单直传策略可接受 `POST` + `FormData`；如果你的 OSS 安全策略更严格，需要同步调整前端 policy 条件和服务端授权范围。
- 短信验证码目前是 MVP 开发态实现，生产环境需要接入真实短信服务。
