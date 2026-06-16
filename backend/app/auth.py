import asyncio
import json
import pathlib
from datetime import datetime, timedelta, timezone

import httpx

from .config import settings

_TOKEN: str | None = None
_EXPIRES_AT: datetime | None = None
_LOCK = asyncio.Lock()

_CACHE_FILE = pathlib.Path("/app/data/token_cache.json")


def _load_cached_token() -> None:
    global _TOKEN, _EXPIRES_AT
    try:
        if _CACHE_FILE.exists():
            d = json.loads(_CACHE_FILE.read_text())
            exp = datetime.fromisoformat(d["expires_at"])
            if exp > datetime.now(tz=timezone.utc):
                _TOKEN = d["token"]
                _EXPIRES_AT = exp
    except Exception:
        pass


def _save_token_to_disk() -> None:
    try:
        _CACHE_FILE.parent.mkdir(parents=True, exist_ok=True)
        _CACHE_FILE.write_text(json.dumps({
            "token": _TOKEN,
            "expires_at": _EXPIRES_AT.isoformat(),
        }))
    except Exception:
        pass


_load_cached_token()


async def get_token(client: httpx.AsyncClient) -> str:
    global _TOKEN, _EXPIRES_AT

    now = datetime.now(tz=timezone.utc)
    if _TOKEN and _EXPIRES_AT and now < _EXPIRES_AT:
        return _TOKEN

    async with _LOCK:
        # повторная проверка после захвата лока
        if _TOKEN and _EXPIRES_AT and now < _EXPIRES_AT:
            return _TOKEN

        try:
            resp = await client.post(
                f"{settings.elpass_base_url}/rpc/login",
                json={"email": settings.elpass_email, "pass": settings.elpass_password},
            )
            resp.raise_for_status()
        except httpx.HTTPStatusError as exc:
            # Auth server returned an error — use stale token for a short grace period
            if _TOKEN:
                _EXPIRES_AT = now + timedelta(minutes=10)
                return _TOKEN
            raise RuntimeError(
                f"Сервер авторизации недоступен (HTTP {exc.response.status_code}). "
                "Попробуйте обновить страницу через несколько минут."
            ) from exc
        except httpx.RequestError as exc:
            if _TOKEN:
                _EXPIRES_AT = now + timedelta(minutes=10)
                return _TOKEN
            raise RuntimeError(
                "Нет связи с сервером авторизации. Проверьте подключение и попробуйте позже."
            ) from exc

        data = resp.json()

        token = (
            data.get("token")
            or data.get("access_token")
            or (data[0].get("token") if isinstance(data, list) else None)
        )
        if not token:
            raise ValueError(f"Token not found in response: {data}")

        _TOKEN = token
        _EXPIRES_AT = now + timedelta(hours=1)
        _save_token_to_disk()
        return _TOKEN


def invalidate() -> None:
    global _TOKEN, _EXPIRES_AT
    _TOKEN = None
    _EXPIRES_AT = None
