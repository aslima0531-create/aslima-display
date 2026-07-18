#!/usr/bin/env python3
"""Refresh the same-origin VRIC prayer-time mirror.

The script only replaces the output after a complete, chronological set of
Adhan and Iqamah times is found. A source failure therefore cannot overwrite
the previous known-good file with partial or empty data.
"""
from __future__ import annotations

import html
import json
import re
import sys
import tempfile
import urllib.request
from datetime import datetime, timezone
from html.parser import HTMLParser
from pathlib import Path
from zoneinfo import ZoneInfo

ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "data" / "vric-prayer-times.json"
TIMEZONE = "America/Chicago"
OFFICIAL_URLS = (
    "https://vric.org/prayertimes/",
    "https://vric.org/",
    "https://vric.org/home-2/",
)
PRAYERS = ("Fajr", "Sunrise", "Dhuhr", "Asr", "Maghrib", "Isha")
IQAMAH_PRAYERS = ("Fajr", "Dhuhr", "Asr", "Maghrib", "Isha")
ALIASES = {
    "Fajr": r"\bFajr\b",
    "Sunrise": r"\bSunrise\b",
    "Dhuhr": r"\b(?:Dhuhr|Zuhr|Zuhur|Dhuhur)\b",
    "Asr": r"\bAsr\b",
    "Maghrib": r"\b(?:Maghrib|Magrib)\b",
    "Isha": r"\bIsha(?:a|’a|'a)?\b",
}


class TextExtractor(HTMLParser):
    def __init__(self) -> None:
        super().__init__()
        self.parts: list[str] = []
        self._hidden = 0

    def handle_starttag(self, tag: str, attrs) -> None:
        if tag.lower() in {"script", "style", "noscript"}:
            self._hidden += 1

    def handle_endtag(self, tag: str) -> None:
        if tag.lower() in {"script", "style", "noscript"} and self._hidden:
            self._hidden -= 1

    def handle_data(self, data: str) -> None:
        if not self._hidden:
            self.parts.append(data)


def normalize_source(payload: str) -> str:
    if "<" in payload and ">" in payload:
        parser = TextExtractor()
        parser.feed(payload)
        payload = " ".join(parser.parts)
    return re.sub(r"\s+", " ", html.unescape(payload)).strip()


def canonical_time(value: str) -> str:
    match = re.search(r"\b(\d{1,2}):(\d{2})\s*(AM|PM)?\b", value, re.I)
    if not match:
        return ""
    hour = int(match.group(1))
    minute = int(match.group(2))
    period = (match.group(3) or "").upper()
    if minute > 59:
        return ""
    if period:
        if not 1 <= hour <= 12:
            return ""
        if period == "PM" and hour < 12:
            hour += 12
        elif period == "AM" and hour == 12:
            hour = 0
    elif not 0 <= hour <= 23:
        return ""
    return f"{hour:02d}:{minute:02d}"


def to_minutes(value: str) -> int:
    hour, minute = map(int, value.split(":"))
    return hour * 60 + minute


def to_12(value: str) -> str:
    hour, minute = map(int, value.split(":"))
    suffix = "PM" if hour >= 12 else "AM"
    return f"{hour % 12 or 12}:{minute:02d} {suffix}"


def parse_source(payload: str) -> dict:
    text = normalize_source(payload)
    positions: list[tuple[int, int, str]] = []
    for prayer, pattern in ALIASES.items():
        for match in re.finditer(pattern, text, re.I):
            positions.append((match.start(), match.end(), prayer))
    positions.sort()

    adhan: dict[str, str] = {}
    iqamah: dict[str, str] = {}
    for index, (_, end, prayer) in enumerate(positions):
        next_start = positions[index + 1][0] if index + 1 < len(positions) else min(len(text), end + 160)
        segment = text[end : min(next_start, end + 160)]
        times = [canonical_time(m.group(0)) for m in re.finditer(r"\b\d{1,2}:\d{2}\s*(?:AM|PM)?\b", segment, re.I)]
        times = [value for value in times if value]
        if times and prayer not in adhan:
            adhan[prayer] = times[0]
        if prayer != "Sunrise" and len(times) > 1 and prayer not in iqamah:
            iqamah[prayer] = times[1]

    jumuah: list[str] = []
    numbered = re.compile(
        r"(?:Jummah|Jumu[’'`]?ah)\s*(?:Prayer\s*)?(?:#?\s*(?:[1-4]|I{1,4}|first|second|third|fourth))[^0-9]{0,30}(\d{1,2}:\d{2}\s*(?:AM|PM))",
        re.I,
    )
    for match in numbered.finditer(text):
        value = canonical_time(match.group(1))
        if value and to_12(value) not in jumuah:
            jumuah.append(to_12(value))

    if len(jumuah) < 2:
        phrase = re.search(r"(?:two|three|four)\s+(?:Jummah|Jumu[’'`]?ah)\s+prayers?[^.;]{0,180}", text, re.I)
        if phrase:
            has_pm = bool(re.search(r"PM", phrase.group(0), re.I))
            for item in re.finditer(r"\d{1,2}:\d{2}\s*(?:AM|PM)?", phrase.group(0), re.I):
                raw = item.group(0)
                if has_pm and not re.search(r"AM|PM", raw, re.I):
                    raw += " PM"
                value = canonical_time(raw)
                if value and to_12(value) not in jumuah:
                    jumuah.append(to_12(value))

    return {"adhan": adhan, "iqamah": iqamah, "jumuah": jumuah[:4], "text": text}


def validate(parsed: dict) -> None:
    missing_adhan = [key for key in PRAYERS if not parsed["adhan"].get(key)]
    missing_iqamah = [key for key in IQAMAH_PRAYERS if not parsed["iqamah"].get(key)]
    if missing_adhan:
        raise ValueError("Missing Adhan: " + ", ".join(missing_adhan))
    if missing_iqamah:
        raise ValueError("Missing Iqamah: " + ", ".join(missing_iqamah))
    values = [to_minutes(parsed["adhan"][key]) for key in PRAYERS]
    if any(right <= left for left, right in zip(values, values[1:])):
        raise ValueError("Adhan times are not chronological")
    for prayer in IQAMAH_PRAYERS:
        delta = to_minutes(parsed["iqamah"][prayer]) - to_minutes(parsed["adhan"][prayer])
        if not 0 <= delta <= 180:
            raise ValueError(f"Implausible {prayer} Iqamah delta")


def fetch(url: str) -> str:
    request = urllib.request.Request(
        url,
        headers={
            "User-Agent": "ASLIMA-Azaan-Tablet/9.1.47 (+private household timing mirror)",
            "Accept": "text/html,application/xhtml+xml,text/plain;q=0.9,*/*;q=0.8",
        },
    )
    with urllib.request.urlopen(request, timeout=25) as response:
        return response.read().decode(response.headers.get_content_charset() or "utf-8", errors="replace")


def current_jumuah() -> tuple[list[str], dict]:
    try:
        existing = json.loads(OUTPUT.read_text())
        values = existing.get("jumuah")
        meta = existing.get("jumuahMeta") if isinstance(existing.get("jumuahMeta"), dict) else {}
        clean = [str(value) for value in values if str(value).strip()][:4] if isinstance(values, list) else []
        if clean:
            return clean, meta
    except Exception:
        pass
    return [], {"status": "unavailable", "fetchedAt": "", "checkedAt": "", "source": ""}


def main() -> int:
    errors: list[str] = []
    selected = None
    parsed = None
    routes: list[tuple[str, str]] = []
    for url in OFFICIAL_URLS:
        routes.append((url, url))
    for url in OFFICIAL_URLS:
        routes.append((f"https://r.jina.ai/http://{url.removeprefix('https://').removeprefix('http://')}", url))

    for route, official_url in routes:
        try:
            candidate = parse_source(fetch(route))
            validate(candidate)
            selected = {"route": route, "official_url": official_url}
            parsed = candidate
            break
        except Exception as exc:
            errors.append(f"{route}: {exc}")

    if not parsed or not selected:
        print("VRIC refresh failed; previous known-good JSON was retained.", file=sys.stderr)
        for error in errors:
            print("- " + error, file=sys.stderr)
        return 1

    now = datetime.now(timezone.utc).replace(microsecond=0)
    prayer_date = datetime.now(ZoneInfo(TIMEZONE)).date().isoformat()
    if len(parsed["jumuah"]) >= 2:
        jumuah = parsed["jumuah"]
        jumuah_meta = {
            "status": "verified",
            "fetchedAt": now.isoformat().replace("+00:00", "Z"),
            "checkedAt": now.isoformat().replace("+00:00", "Z"),
            "source": "VRIC official page",
        }
    else:
        jumuah, previous_meta = current_jumuah()
        if jumuah:
            jumuah_meta = {
                "status": "retained",
                "fetchedAt": str(previous_meta.get("fetchedAt") or ""),
                "checkedAt": now.isoformat().replace("+00:00", "Z"),
                "source": str(previous_meta.get("source") or "Previous verified VRIC schedule"),
            }
        else:
            jumuah_meta = {
                "status": "unavailable",
                "fetchedAt": "",
                "checkedAt": now.isoformat().replace("+00:00", "Z"),
                "source": "VRIC page did not publish a complete Jumuah schedule",
            }
    output = {
        "schemaVersion": 2,
        "prayerDate": prayer_date,
        "timezone": TIMEZONE,
        "fetchedAt": now.isoformat().replace("+00:00", "Z"),
        "generatedAt": now.isoformat().replace("+00:00", "Z"),
        "source": {
            "id": "vric",
            "label": "Valley Ranch Islamic Center",
            "kind": "official-mirror",
            "url": selected["official_url"],
            "route": "Official page" if selected["route"] == selected["official_url"] else "Jina server-side reader fallback",
        },
        "adhan": parsed["adhan"],
        "iqamah": parsed["iqamah"],
        "jumuah": jumuah,
        "jumuahMeta": jumuah_meta,
        "validation": {"valid": True, "validatedAt": now.isoformat().replace("+00:00", "Z")},
    }

    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    with tempfile.NamedTemporaryFile("w", encoding="utf-8", dir=OUTPUT.parent, delete=False) as handle:
        json.dump(output, handle, indent=2, ensure_ascii=False)
        handle.write("\n")
        temp_path = Path(handle.name)
    temp_path.replace(OUTPUT)
    try:
        output_label = OUTPUT.relative_to(ROOT)
    except ValueError:
        output_label = OUTPUT
    print(f"Updated {output_label} for {prayer_date} via {output['source']['route']}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
