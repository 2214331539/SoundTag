# Environment Configuration

This project keeps runtime configuration in ignored `.env` files. Commit only `.env.*.example` templates.

## Local Android Phone Test

Use this mode when the backend runs on this Windows machine and the Android phone is connected through USB.

Frontend:

```env
EXPO_PUBLIC_API_BASE_URL=http://127.0.0.1:8000/api/v1
```

Backend:

```env
DEBUG=true
DATABASE_URL=postgresql+psycopg://soundtag:soundtag@127.0.0.1:5432/soundtag
DEBUG_EXPOSE_OTP=true
SMS_PROVIDER=log
```

Before opening the app on the phone:

```powershell
adb reverse tcp:8000 tcp:8000
```

Then start the backend:

```powershell
cd backend
.\.venv\Scripts\Activate.ps1
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

Start the frontend after changing any `EXPO_PUBLIC_*` value:

```powershell
cd frontend
npx expo start --dev-client -c
```

## Production Server

Production should use real server-only `.env` files and real secrets. The frontend production build should point to:

```env
EXPO_PUBLIC_API_BASE_URL=http://121.196.165.152:8000/api/v1
```

The backend server `.env` should use:

```env
DEBUG=false
DEBUG_EXPOSE_OTP=false
SMS_PROVIDER=aliyun_pnvs
DATABASE_URL=postgresql+psycopg://soundtag:soundtag@127.0.0.1:5432/soundtag
```

## Rules

- Never commit `frontend/.env`, `backend/.env`, or real secrets.
- Use `*.example` files as templates only.
- Restart Expo with `-c` after changing `EXPO_PUBLIC_*` variables.
- Restart Uvicorn or `systemd` after changing backend `.env`.
- For physical Android local testing, prefer `adb reverse` and `127.0.0.1` over LAN IPs.
