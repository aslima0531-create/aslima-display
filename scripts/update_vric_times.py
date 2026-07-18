#!/usr/bin/env python3
"""Refresh the same-origin VRIC prayer-time mirror.

VRIC's public prayer widget is rendered in the browser, so a plain HTTP fetch
usually contains only an empty placeholder. This updater first tries the cheap
static routes, then uses the system Chrome/Chromium browser and reads the
rendered page plus any embedded frames. The JSON file is replaced only after a
complete chronological Adhan/Iqamah set is validated.
"""
from __future__ import annotations

import html
import json
import os
import re
import shutil
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
    "https://vric.org/",
    "https://vric.org/prayertimes/",
    "https://vric.org/home-2/",
)
PRAYERS = ("Fajr", "Sunrise", "Dhuhr", "Asr", "Maghrib", "Isha")
IQAMAH_PRAYERS = ("Fajr", "Dhuhr", "Asr", "Maghrib", "Isha")
ALIASES = {
    "Fajr": r"\bFajr\b",
    "Sunrise": r"\bSunrise\b",
    "Dhuhr": r"\b(?:Dhuhr|Duhr|Zuhr|Zuhur|Dhuhur)\b",
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
        next_start = positions[index + 1][0] if index + 1 < len(positions) else min(len(text), end + 220)
        segment = text[end : min(next_start, end + 220)]
        times = [
            canonical_time(match.group(0))
            for match in re.finditer(r"\b\d{1,2}:\d{2}\s*(?:AM|PM)?\b", segment, re.I)
        ]
        times = [value for value in times if value]
        if times and prayer not in adhan:
            adhan[prayer] = times[0]
        if prayer != "Sunrise" and len(times) > 1 and prayer not in iqamah:
            iqamah[prayer] = times[1]

    jumuah: list[str] = []
    # Handles rows such as "1st Jummah 1:45 PM" and "Jummah 1 Khutbah 1:45 PM".
    numbered = re.compile(
        r"(?:Jummah|Jumu[’'`]?ah)\s*(?:Prayer\s*)?(?:#?\s*(?:[1-4]|I{1,4}|first|second|third|fourth|1st|2nd|3rd|4th))[^0-9]{0,55}(\d{1,2}:\d{2}\s*(?:AM|PM))",
        re.I,
    )
    ordinal_first = re.compile(
        r"(?:[1-4](?:st|nd|rd|th)|first|second|third|fourth)\s+(?:Jummah|Jumu[’'`]?ah)[^0-9]{0,55}(\d{1,2}:\d{2}\s*(?:AM|PM))",
        re.I,
    )
    for pattern in (numbered, ordinal_first):
        for match in pattern.finditer(text):
            value = canonical_time(match.group(1))
            if value and to_12(value) not in jumuah:
                jumuah.append(to_12(value))

    if len(jumuah) < 2:
        phrase = re.search(r"(?:two|three|four)\s+(?:Jummah|Jumu[’'`]?ah)\s+prayers?[^.;]{0,240}", text, re.I)
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
            "User-Agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 ASLIMA/9.1.48",
            "Accept": "text/html,application/xhtml+xml,text/plain;q=0.9,*/*;q=0.8",
            "Cache-Control": "no-cache",
        },
    )
    with urllib.request.urlopen(request, timeout=25) as response:
        return response.read().decode(response.headers.get_content_charset() or "utf-8", errors="replace")


def chrome_executable() -> str:
    explicit = os.environ.get("ASLIMA_CHROME_BIN", "").strip()
    if explicit and Path(explicit).exists():
        return explicit
    for name in ("google-chrome-stable", "google-chrome", "chromium", "chromium-browser"):
        path = shutil.which(name)
        if path:
            return path
    raise RuntimeError("Chrome/Chromium is not installed on the workflow runner")


def fetch_rendered(url: str) -> str:
    """Return visible text from the rendered page and all accessible frames."""
    try:
        from playwright.sync_api import sync_playwright
    except ImportError as exc:
        raise RuntimeError("Playwright is not installed") from exc

    executable = chrome_executable()
    with sync_playwright() as playwright:
        browser = playwright.chromium.launch(
            headless=True,
            executable_path=executable,
            args=[
                "--no-sandbox",
                "--disable-dev-shm-usage",
                "--disable-gpu",
                "--disable-background-networking",
            ],
        )
        page = browser.new_page(
            viewport={"width": 1440, "height": 1200},
            user_agent="Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/126 Safari/537.36",
        )
        try:
            page.goto(url, wait_until="domcontentloaded", timeout=45_000)
            best = ""
            # The VRIC widget populates asynchronously. Poll rather than relying
            # on networkidle, because third-party widgets may keep connections open.
            for _ in range(18):
                page.wait_for_timeout(1_000)
                chunks: list[str] = []
                for frame in page.frames:
                    try:
                        body = frame.locator("body")
                        if body.count():
                            visible = body.inner_text(timeout=2_000).strip()
                            if visible:
                                chunks.append(visible)
                    except Exception:
                        continue
                candidate = "\n".join(chunks)
                if len(candidate) > len(best):
                    best = candidate
                parsed = parse_source(candidate)
                try:
                    validate(parsed)
                    return candidate
                except Exception:
                    pass
            if best:
                return best
            raise RuntimeError("Rendered page contained no readable text")
        finally:
            browser.close()


def current_jumuah() -> tuple[list[str], dict]:
    try:
        existing = json.loads(OUTPUT.read_text(encoding="utf-8"))
        values = existing.get("jumuah")
        meta = existing.get("jumuahMeta") if isinstance(existing.get("jumuahMeta"), dict) else {}
        clean = [str(value) for value in values if str(value).strip()][:4] if isinstance(values, list) else []
        if clean:
            return clean, meta
    except Exception:
        pass
    return [], {"status": "unavailable", "fetchedAt": "", "checkedAt": "", "source": ""}


def write_output(parsed: dict, selected: dict) -> None:
    now = datetime.now(timezone.utc).replace(microsecond=0)
    prayer_date = datetime.now(ZoneInfo(TIMEZONE)).date().isoformat()
    stamp = now.isoformat().replace("+00:00", "Z")
    if len(parsed["jumuah"]) >= 2:
        jumuah = parsed["jumuah"]
        jumuah_meta = {
            "status": "verified",
            "fetchedAt": stamp,
            "checkedAt": stamp,
            "source": "VRIC rendered official page",
        }
    else:
        jumuah, previous_meta = current_jumuah()
        if jumuah:
            jumuah_meta = {
                "status": "retained",
                "fetchedAt": str(previous_meta.get("fetchedAt") or ""),
                "checkedAt": stamp,
                "source": str(previous_meta.get("source") or "Previous verified VRIC schedule"),
            }
        else:
            jumuah_meta = {
                "status": "unavailable",
                "fetchedAt": "",
                "checkedAt": stamp,
                "source": "VRIC page did not publish a complete Jumuah schedule",
            }

    output = {
        "schemaVersion": 2,
        "prayerDate": prayer_date,
        "timezone": TIMEZONE,
        "fetchedAt": stamp,
        "generatedAt": stamp,
        "source": {
            "id": "vric",
            "label": "Valley Ranch Islamic Center",
            "kind": "official-mirror",
            "url": selected["official_url"],
            "route": selected["route_label"],
        },
        "adhan": parsed["adhan"],
        "iqamah": parsed["iqamah"],
        "jumuah": jumuah,
        "jumuahMeta": jumuah_meta,
        "scheduleMeta": {
            "status": "verified",
            "prayerDate": prayer_date,
            "fetchedAt": stamp,
            "source": "VRIC",
        },
        "validation": {"valid": True, "validatedAt": stamp},
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


def main() -> int:
    errors: list[str] = []
    selected: dict | None = None
    parsed: dict | None = None

    # Cheap static routes first. They currently contain only the widget shell,
    # but keeping this path makes the updater efficient if VRIC later returns
    # server-rendered times again.
    for url in OFFICIAL_URLS:
        try:
            candidate = parse_source(fetch(url))
            validate(candidate)
            selected = {"official_url": url, "route_label": "Official page (server rendered)"}
            parsed = candidate
            break
        except Exception as exc:
            errors.append(f"static {url}: {exc}")

    # VRIC's current page loads its prayer widget with JavaScript. Render it in
    # a real browser and include cross-origin frame text.
    if not parsed:
        for url in OFFICIAL_URLS:
            try:
                candidate = parse_source(fetch_rendered(url))
                validate(candidate)
                selected = {"official_url": url, "route_label": "Rendered official page"}
                parsed = candidate
                break
            except Exception as exc:
                errors.append(f"rendered {url}: {exc}")

    if not parsed or not selected:
        print("VRIC refresh failed; previous known-good JSON was retained.", file=sys.stderr)
        for error in errors:
            print("- " + error, file=sys.stderr)
        return 1

    write_output(parsed, selected)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
