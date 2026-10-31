"""Reproduce exact HMRC fixture data; no tax calculation or network access."""
import hashlib
import json
from pathlib import Path
import xml.etree.ElementTree as ET
import zipfile

ROOT = Path(__file__).resolve().parent
SOURCE = ROOT / "fixtures/hmrc-student-loans-2026-27-v1.0.ods"
N = {"table": "urn:oasis:names:tc:opendocument:xmlns:table:1.0"}
FREQUENCIES = {"Weekly": "weekly", "2 Weekly": "fortnightly", "4 Weekly": "four_weekly", "Monthly": "monthly"}
PLANS = {"Plan_1": "plan_1", "Plan_2": "plan_2", "Plan_4": "plan_4", "Plan_5": "plan_5", "Postgraduate": "postgraduate"}

def minor(value):
    import re
    if not re.fullmatch(r"[0-9]+\.[0-9]{2}", value):
        raise ValueError("Not an exact two-decimal fixture amount")
    whole, fraction = value.split(".")
    return str(int(whole) * 100 + int(fraction))

def extract():
    with zipfile.ZipFile(SOURCE) as archive:
        root = ET.fromstring(archive.read("content.xml"))
    cases = []
    for table in root.findall(".//table:table", N):
        sheet = table.attrib["{" + N["table"] + "}name"]
        plan = PLANS[sheet]
        next_row = 1
        for row in table.findall("table:table-row", N):
            row_number = next_row
            repeats = int(row.attrib.get("{" + N["table"] + "}number-rows-repeated", "1"))
            next_row += repeats
            values = []
            for cell in row.findall("table:table-cell", N):
                repeat_columns = int(cell.attrib.get("{" + N["table"] + "}number-columns-repeated", "1"))
                values.extend(["".join(cell.itertext()).strip()] * min(repeat_columns, 3 - len(values)))
                if len(values) == 3:
                    break
            if not values or values[0] not in FREQUENCIES:
                continue
            if repeats != 1:
                raise ValueError("Repeated fixture row requires explicit review")
            cases.append({"id": f"hmrc-loan-2026-27-{plan}-row-{row_number}",
                          "sourceSheet": sheet, "sourceRow": row_number,
                          "input": {"taxYear": "2026-27", "plan": plan,
                                    "frequency": FREQUENCIES[values[0]], "payMinor": minor(values[1])},
                          "expected": {"deductionMinor": minor(values[2])}})
    if len(cases) != 130:
        raise ValueError("Unexpected HMRC corpus size; review source before updating")
    return {"version": 1, "taxYear": "2026-27", "status": "reference_fixtures_only_not_engine_qualification",
            "source": {"publisher": "HM Revenue & Customs", "version": "1.0",
                       "page": "https://www.gov.uk/government/publications/software-developers-payroll-test-data-2026-to-2027",
                       "url": "https://assets.publishing.service.gov.uk/media/6968fd1f5fd54abe6531a807/2026-27-Student-Loan-Threshold-Examples-v1-0__1_.ods",
                       "sha256": hashlib.sha256(SOURCE.read_bytes()).hexdigest(),
                       "retrievedAt": "2026-10-31", "licence": "Open Government Licence v3.0; contains public sector information licensed under the OGL v3.0",
                       "licenceUrl": "https://www.nationalarchives.gov.uk/doc/open-government-licence/version/3/"},
            "limitations": ["Reference examples do not prove a LedgerPoint calculation engine.",
                             "This corpus alone does not cover eligibility, loan notices, concurrent plans, corrections or all earnings periods.",
                             "Other tax years must use their own pinned official examples; no carry-forward is permitted."],
            "cases": cases}

if __name__ == "__main__":
    print(json.dumps(extract(), indent=2))
