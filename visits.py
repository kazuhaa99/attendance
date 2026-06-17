import requests
import urllib3
from datetime import datetime

# Отключаем предупреждения SSL
urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)

BASE_URL = "https://pass.telecom.quest/api"
EMAIL = "dashboard@elpass.kz"
PASSWORD = "D@shboard1!"

# ─── 1. Получаем токен ───────────────────────────────────────────────────────
def get_token():
    resp = requests.post(
        f"{BASE_URL}/rpc/login",
        json={"email": EMAIL, "pass": PASSWORD},
        headers={"accept": "application/json", "content-type": "application/json"},
        verify=False
    )
    resp.raise_for_status()
    data = resp.json()
    token = data.get("token") or data.get("access_token") or (data[0].get("token") if isinstance(data, list) else None)
    if not token:
        print("Ответ сервера:", data)
        raise ValueError("Токен не найден в ответе")
    print(f"✓ Токен получен\n")
    return token

# ─── 2. Получаем данные посещений ────────────────────────────────────────────
def get_visits(token, date_from="2026-06-09", date_to="2026-06-10"):
    url = (
        f"{BASE_URL}/el_tvisits"
        f"?select=*,card(name,no)"
        f"&loged_at=gte.{date_from}"
        f"&loged_at=lte.{date_to}"
        f"&order=loged_at.desc"
    )
    resp = requests.get(
        url,
        headers={
            "Authorization": f"Bearer {token}",
            "Range": "0-49",
            "accept": "application/json"
        },
        verify=False
    )
    resp.raise_for_status()
    return resp.json()

# ─── 3. Выводим таблицу ──────────────────────────────────────────────────────
def print_table(data):
    if not data:
        print("Нет данных за указанный период.")
        return

    # Определяем все ключи из первой записи
    sample = data[0]
    
    # Основные поля для отображения
    fields = ["id", "loged_at", "card_id", "direction", "device_id"]
    card_fields = ["name", "no"]

    # Формируем строки
    rows = []
    for item in data:
        card = item.get("card") or {}
        row = {
            "id":        str(item.get("id", "")),
            "loged_at":  str(item.get("loged_at", ""))[:19].replace("T", " "),
            "card_id":   str(item.get("card_id", "")),
            "Имя":       str(card.get("name", "—")),
            "Номер":     str(card.get("no", "—")),
            "direction": str(item.get("direction", "")),
            "device_id": str(item.get("device_id", "")),
        }
        rows.append(row)

    columns = ["id", "loged_at", "Имя", "Номер", "card_id", "direction", "device_id"]

    # Считаем ширину колонок
    col_widths = {col: len(col) for col in columns}
    for row in rows:
        for col in columns:
            col_widths[col] = max(col_widths[col], len(row.get(col, "")))

    # Разделитель
    sep = "+" + "+".join("-" * (col_widths[c] + 2) for c in columns) + "+"

    # Заголовок
    header = "|" + "|".join(f" {c.ljust(col_widths[c])} " for c in columns) + "|"

    print(sep)
    print(header)
    print(sep)
    for row in rows:
        line = "|" + "|".join(f" {row.get(c,'').ljust(col_widths[c])} " for c in columns) + "|"
        print(line)
    print(sep)
    print(f"\nВсего записей: {len(rows)}")

# ─── Main ─────────────────────────────────────────────────────────────────────
if __name__ == "__main__":
    token = get_token()
    data = get_visits(token, date_from="2026-06-09", date_to="2026-06-10")
    print_table(data)
