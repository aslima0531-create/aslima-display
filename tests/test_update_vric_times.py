import json
import io
import tempfile
import unittest
from contextlib import redirect_stderr, redirect_stdout
from datetime import date
from pathlib import Path
from unittest import mock

from scripts import update_vric_times as updater


FIXTURE = Path(__file__).parent / "fixtures" / "vric-rendered.html"


class VricUpdaterTests(unittest.TestCase):
    def parsed(self):
        return updater.parse_source(FIXTURE.read_text(encoding="utf-8"))

    def test_successful_rendered_vric_extraction(self):
        parsed = self.parsed()
        updater.validate(parsed)
        self.assertEqual(parsed["adhan"]["Dhuhr"], "13:34")
        self.assertEqual(parsed["iqamah"]["Isha"], "22:00")
        self.assertEqual(parsed["jumuah"], ["1:45 PM", "3:00 PM", "4:00 PM"])
        self.assertEqual(parsed["jumuahSchedule"], [
            {"adhan": "1:45 PM", "iqamah": "2:00 PM"},
            {"adhan": "3:00 PM", "iqamah": "3:15 PM"},
            {"adhan": "4:00 PM", "iqamah": "4:15 PM"},
        ])

    def test_alternate_prayer_name_spellings(self):
        payload = FIXTURE.read_text().replace("Dhuhr", "Zuhr").replace("Maghrib", "Magrib").replace("Isha", "Ishaa")
        parsed = updater.parse_source(payload)
        updater.validate(parsed)
        self.assertIn("Dhuhr", parsed["adhan"])

    def test_missing_prayer_rejected(self):
        parsed = self.parsed()
        del parsed["adhan"]["Asr"]
        with self.assertRaisesRegex(ValueError, "Missing Adhan: Asr"):
            updater.validate(parsed)

    def test_invalid_chronology_rejected(self):
        parsed = self.parsed()
        parsed["adhan"]["Asr"] = "12:00"
        with self.assertRaisesRegex(ValueError, "not chronological"):
            updater.validate(parsed)

    def test_implausible_iqamah_rejected(self):
        parsed = self.parsed()
        parsed["iqamah"]["Fajr"] = "09:30"
        with self.assertRaisesRegex(ValueError, "Implausible Fajr"):
            updater.validate(parsed)

    def test_previous_known_good_json_is_preserved(self):
        with tempfile.TemporaryDirectory() as directory:
            output = Path(directory) / "times.json"
            original = b'{"prayerDate":"2026-07-19","validation":{"valid":true}}\n'
            output.write_bytes(original)
            with mock.patch.object(updater, "OUTPUT", output), mock.patch.object(updater, "fetch", side_effect=OSError("offline")), mock.patch.object(updater, "fetch_rendered", side_effect=OSError("offline")), mock.patch.object(updater, "stored_age_days", return_value=0):
                with redirect_stdout(io.StringIO()), redirect_stderr(io.StringIO()):
                    self.assertEqual(updater.main(), 0)
            self.assertEqual(output.read_bytes(), original)

    def test_jumuah_retained_when_temporarily_unavailable(self):
        with tempfile.TemporaryDirectory() as directory:
            output = Path(directory) / "times.json"
            retained_schedule = [{"adhan": "1:45 PM", "iqamah": "2:00 PM"}, {"adhan": "3:00 PM", "iqamah": "3:15 PM"}]
            output.write_text(json.dumps({"jumuah": ["1:45 PM", "3:00 PM", "4:00 PM"], "jumuahSchedule": retained_schedule, "jumuahMeta": {"fetchedAt": "old", "source": "VRIC"}}))
            parsed = self.parsed()
            parsed["jumuah"] = []
            with mock.patch.object(updater, "OUTPUT", output):
                updater.write_output(parsed, {"official_url": updater.OFFICIAL_URLS[0], "route_label": "test"})
            written = json.loads(output.read_text())
            self.assertEqual(written["jumuah"], ["1:45 PM", "3:00 PM", "4:00 PM"])
            self.assertEqual(written["jumuahSchedule"], retained_schedule)
            self.assertEqual(written["jumuahMeta"]["status"], "retained")

    def test_stale_data_escalation(self):
        with mock.patch.object(updater, "stored_age_days", return_value=updater.MAX_SAFE_AGE_DAYS + 1):
            with redirect_stdout(io.StringIO()), redirect_stderr(io.StringIO()):
                self.assertEqual(updater.retain_or_escalate(["offline"]), 1)

    def test_stored_age_uses_prayer_date(self):
        with tempfile.TemporaryDirectory() as directory:
            output = Path(directory) / "times.json"
            output.write_text(json.dumps({"prayerDate": "2026-07-17", "validation": {"valid": True}}))
            with mock.patch.object(updater, "OUTPUT", output):
                self.assertEqual(updater.stored_age_days(date(2026, 7, 19)), 2)


if __name__ == "__main__":
    unittest.main()
