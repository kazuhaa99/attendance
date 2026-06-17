import asyncio
from typing import Any

import httpx
from fastapi import APIRouter, Depends, HTTPException, Query

from ..auth import get_token, invalidate
from ..config import settings

router = APIRouter(prefix="/api")

# Zone canonical names: raw DB value → display name
_ZONE_CANONICAL: dict[str, str] = {
    'main':         'Kaisar plaza',
    'kaisar_plaza': 'Kaisar plaza',
}
# Reverse map: canonical → list of raw DB values for filtering
_ZONE_REVERSE: dict[str, list[str]] = {}
for _raw, _can in _ZONE_CANONICAL.items():
    _ZONE_REVERSE.setdefault(_can, []).append(_raw)

def _zone_display(z: str | None) -> str:
    if not z:
        return '—'
    return _ZONE_CANONICAL.get(z, z)


import pathlib as _pathlib

_CERT_DIR = _pathlib.Path("/app/certs")
_CLIENT_CERT = (_CERT_DIR / "client.crt", _CERT_DIR / "client.key")
_CA_CERT = _CERT_DIR / "ca.crt"

async def http_client():
    use_cert = _CLIENT_CERT[0].exists() and _CLIENT_CERT[1].exists()
    use_ca   = _CA_CERT.exists()
    async with httpx.AsyncClient(
        verify=str(_CA_CERT) if use_ca else False,
        cert=_CLIENT_CERT if use_cert else None,
        timeout=httpx.Timeout(90.0, connect=10.0),
    ) as client:
        yield client


@router.get("/visits")
async def get_visits(
    date_from: str = Query(..., description="YYYY-MM-DD"),
    date_to:   str = Query(..., description="YYYY-MM-DD"),
    name:      str | None = Query(None, description="Фильтр по имени (contains, case-insensitive)"),
    zone:      str | None = Query(None, description="Точное совпадение зоны"),
    terminal:  str | None = Query(None, description="Точное совпадение терминала"),
    direction: str | None = Query(None, description="'in' = входы (isOut=false), 'out' = выходы (isOut=true)"),
    no_name:   bool        = Query(False, description="Только записи без имени карты"),
    client: httpx.AsyncClient = Depends(http_client),
) -> dict[str, Any]:
    try:
        token = await get_token(client)
    except Exception:
        return {"total": 0, "loaded": 0, "rows": [], "unavailable": True}

    # loged_at=gte.YYYY-MM-DD  →  loged_at >= начало дня
    # loged_at=lte.YYYY-MM-DDT23:59:59  →  loged_at <= конец дня (включительно)
    parts = [
        f"{settings.elpass_base_url}/el_tvisits?select=*,card(name,no)",
        f"loged_at=gte.{date_from}",
        f"loged_at=lte.{date_to}T23:59:59",
        "order=loged_at.desc",
    ]
    # zone, terminal, direction — прямые поля таблицы, фильтруем на стороне PostgREST
    if zone:
        raw_zones = _ZONE_REVERSE.get(zone, [zone])
        if len(raw_zones) == 1:
            safe = raw_zones[0].replace("'", "''")
            parts.append(f"zone=eq.{safe}")
        else:
            zones_str = ','.join(f'"{z}"' for z in raw_zones)
            parts.append(f"zone=in.({zones_str})")
    if terminal:
        safe = terminal.replace("'", "''")
        parts.append(f"terminal=eq.{safe}")
    if direction == "in":
        parts.append("isOut=eq.false")
    elif direction == "out":
        parts.append("isOut=eq.true")

    # name — поле из embedded-ресурса card; фильтруем на backend после выборки
    base_url = "&".join(parts)
    headers = {
        "Authorization": f"Bearer {token}",
        "Prefer": "count=exact",
        "accept": "application/json",
    }

    try:
        first = await client.get(
            base_url,
            headers={**headers, "Range": f"0-{settings.page_size - 1}"},
        )
        # сброс токена при 401 — следующий запрос переавторизуется
        if first.status_code == 401:
            invalidate()
            raise HTTPException(status_code=502, detail="Upstream returned 401; token invalidated")
        first.raise_for_status()
    except httpx.HTTPStatusError as exc:
        raise HTTPException(status_code=502, detail=f"Upstream error: {exc}") from exc

    rows: list[dict] = first.json()
    total = _parse_total(first.headers.get("content-range", ""))

    if total and total > settings.page_size:
        num_pages = (total + settings.page_size - 1) // settings.page_size
        if settings.max_rows > 0:
            num_pages = min(num_pages, (settings.max_rows + settings.page_size - 1) // settings.page_size)

        sem = asyncio.Semaphore(settings.max_concurrent)

        async def _limited(i: int):
            async with sem:
                return await _fetch_page(client, base_url, headers, i)

        results = await asyncio.gather(
            *[_limited(i) for i in range(1, num_pages)],
            return_exceptions=True,
        )
        for chunk in results:
            if isinstance(chunk, list):
                rows.extend(chunk)

    transformed = [_transform(r) for r in rows]

    if name:
        needle = name.lower()
        transformed = [r for r in transformed if needle in r["name"].lower()]
        total = len(transformed)

    if no_name:
        transformed = [r for r in transformed if r["name"] == "—"]
        total = len(transformed)

    return {"total": total or len(transformed), "loaded": len(transformed), "rows": transformed}


async def _fetch_page(
    client: httpx.AsyncClient,
    base_url: str,
    headers: dict,
    page_index: int,
) -> list[dict]:
    start = page_index * settings.page_size
    end = start + settings.page_size - 1
    resp = await client.get(base_url, headers={**headers, "Range": f"{start}-{end}"})
    resp.raise_for_status()
    return resp.json()


def _parse_total(content_range: str) -> int | None:
    if "/" in content_range:
        try:
            return int(content_range.split("/")[-1])
        except ValueError:
            pass
    return None


def _transform(r: dict) -> dict:
    card = r.get("card") or {}
    return {
        "loged_at": r.get("loged_at", ""),
        "name":     card.get("name") or "—",
        "no":       r.get("no") or card.get("no") or "—",
        "is_out":   r.get("isOut"),
        "terminal": r.get("terminal") or "—",
        "zone":     _zone_display(r.get("zone")),
        "host":     r.get("host") or "—",
    }


@router.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}
