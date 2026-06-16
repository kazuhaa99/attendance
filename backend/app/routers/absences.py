import asyncio
import datetime as dt
import re
from typing import Any

from fastapi import APIRouter, HTTPException, Query

from ..config import settings

router = APIRouter(prefix="/api")

_DATE_RE = re.compile(r'^\d{4}-\d{2}-\d{2}$')

# Kazakh → Russian character normalization for fuzzy name matching
_KZ_MAP = str.maketrans('әқңүұіөғһӘҚҢҮҰІӨҒҺ', 'акнууиогхАКНУУИОГХ')

def _normalize(s: str) -> str:
    return s.translate(_KZ_MAP).lower().strip()


def _patch_ssl() -> None:
    """Lower OpenSSL security level to allow RSA key-exchange ciphers
    required by Impala (AES256-GCM-SHA384).  Python 3.12 + OpenSSL 3.x
    disable them by default."""
    try:
        import thrift.transport.TSSLSocket as _tssl
        _orig = _tssl.TSSLBase._init_context

        def _patched(self, ssl_version):
            _orig(self, ssl_version)
            if getattr(self, '_context', None):
                self._context.set_ciphers('DEFAULT:@SECLEVEL=0')

        _tssl.TSSLBase._init_context = _patched
    except Exception:
        pass


_patch_ssl()

# ── Daily cache (витрина обновляется в 22:00) ─────────────────────────────────
_cache: dict[str, Any] = {"rows": None, "cached_at": None}


def _last_22() -> dt.datetime:
    """Момент последней 22:00 в локальном времени сервера."""
    now = dt.datetime.now()
    today_22 = now.replace(hour=22, minute=0, second=0, microsecond=0)
    return today_22 if now >= today_22 else today_22 - dt.timedelta(days=1)


def _cache_valid() -> bool:
    at = _cache["cached_at"]
    return at is not None and _cache["rows"] is not None and at >= _last_22()


def _broad_range() -> tuple[str, str]:
    """Запрашиваем широкий диапазон; фронт фильтрует сам."""
    today = dt.date.today()
    date_from = (today.replace(day=1) - dt.timedelta(days=31)).strftime('%Y-%m-%d')
    date_to   = (today.replace(day=1) + dt.timedelta(days=62)).replace(
        day=1
    ) - dt.timedelta(days=1)
    return date_from, date_to.strftime('%Y-%m-%d')

# ─────────────────────────────────────────────────────────────────────────────


def _query_sync() -> list[dict]:
    from impala.dbapi import connect

    date_from, date_to = _broad_range()

    conn = connect(
        host=settings.impala_host,
        port=settings.impala_port,
        database=settings.impala_database,
        use_ssl=settings.impala_ssl,
        auth_mechanism="PLAIN",
        user=settings.impala_user,
        password=settings.impala_password,
        timeout=30,
    )
    try:
        cur = conn.cursor()
        cur.execute(
            f"""
            SELECT *
            FROM {settings.impala_table}
            WHERE enddate >= '{date_from}'
              AND startdate <= '{date_to}'
            LIMIT 10000
            """
        )
        cols = [d[0].lower() for d in cur.description]
        rows = []
        for row in cur.fetchall():
            obj = {}
            for k, v in zip(cols, row):
                obj[k] = v if v is None or isinstance(v, (str, int, float, bool)) else str(v)
            parts = [obj.get('lastname') or '', obj.get('firstname') or '', obj.get('fathername') or '']
            full = ' '.join(p for p in parts if p).strip()
            obj['full_name']      = full
            obj['_norm_full']     = _normalize(full)
            obj['_norm_lastname'] = _normalize(obj.get('lastname') or '')
            rows.append(obj)
        return rows
    finally:
        conn.close()


@router.get("/absences")
async def get_absences(
    date_from: str = Query(..., description="YYYY-MM-DD"),
    date_to:   str = Query(..., description="YYYY-MM-DD"),
) -> dict[str, Any]:
    if not settings.impala_enabled:
        return {"rows": [], "disabled": True}

    try:
        _validate(date_from)
        _validate(date_to)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))

    if not _cache_valid():
        try:
            rows = await asyncio.to_thread(_query_sync)
            _cache["rows"]      = rows
            _cache["cached_at"] = dt.datetime.now()
        except Exception as exc:
            # Если кэш устарел но Impala недоступна — вернуть старые данные
            if _cache["rows"] is not None:
                return {"rows": _cache["rows"], "columns": list(_cache["rows"][0].keys()) if _cache["rows"] else [], "stale": True}
            raise HTTPException(status_code=502, detail=f"Impala error: {exc}")

    rows = _cache["rows"] or []
    return {
        "rows":      rows,
        "columns":   list(rows[0].keys()) if rows else [],
        "cached_at": _cache["cached_at"].isoformat() if _cache["cached_at"] else None,
    }


@router.post("/absences/refresh")
async def force_refresh() -> dict[str, Any]:
    """Принудительно сбросить кэш и загрузить данные из Impala."""
    if not settings.impala_enabled:
        return {"ok": False, "detail": "Impala disabled"}
    try:
        rows = await asyncio.to_thread(_query_sync)
        _cache["rows"]      = rows
        _cache["cached_at"] = dt.datetime.now()
        return {"ok": True, "rows_count": len(rows), "cached_at": _cache["cached_at"].isoformat()}
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"Impala error: {exc}")


@router.get("/absences/cache-status")
async def cache_status() -> dict[str, Any]:
    """Отладочный эндпоинт: когда был последний запрос к Impala."""
    return {
        "cached_at":   _cache["cached_at"].isoformat() if _cache["cached_at"] else None,
        "valid":       _cache_valid(),
        "next_refresh": (_last_22() + dt.timedelta(days=1)).isoformat(),
        "rows_count":  len(_cache["rows"]) if _cache["rows"] else 0,
    }


def _validate(d: str) -> None:
    if not _DATE_RE.match(d):
        raise ValueError(f"Invalid date format: {d!r}")
