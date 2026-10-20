"""Offline documentation/golden-case checks only; never imports app code or opens a DB."""
import datetime
from decimal import Decimal, ROUND_HALF_UP, localcontext
import hashlib
import json
from pathlib import Path
import random
import re
import subprocess

ROOT = Path(__file__).resolve().parents[4]
HERE = Path(__file__).resolve().parent
BASE = ROOT / "generated-artifacts/w03-contract-review/baseline-source-evidence.json"
PROPOSAL = "docs/governance/drafts/ledgerpoint-w03-implementation-ticket-proposal.md"
DOC_NAMES = [
    "ledgerpoint-w03-contract-review-package.md",
    "ledgerpoint-w03-role-and-membership-contract.md",
    "ledgerpoint-w03-draft-api-money-contract.md",
    "ledgerpoint-w03-transaction-compatibility-review.md",
    "ledgerpoint-w03-implementation-ticket-proposal.md",
]
MAX = 999999999999
PATTERN = re.compile(r"(0|[1-9][0-9]*)([.][0-9]{1,4})?")

class Rejected(ValueError):
    pass

def scaled(value):
    if not isinstance(value, str):
        raise Rejected("DECIMAL_REQUIRED")
    if not PATTERN.fullmatch(value):
        raise Rejected("DECIMAL_INVALID")
    whole, _, fraction = value.partition(".")
    return int(whole) * 10000 + int(fraction.ljust(4, "0") or "0")

def proposed_integer_calculation(lines):
    if not 1 <= len(lines) <= 200:
        raise Rejected("LINES_RANGE")
    totals = [0, 0, 0]
    results = []
    for line in lines:
        if set(line) != {"q", "p", "rate"}:
            raise Rejected("UNKNOWN_FIELD")
        q, p = scaled(line["q"]), scaled(line["p"])
        if not 0 < q <= 9999999999:
            raise Rejected("QUANTITY_RANGE")
        if not 0 <= p <= 999999999999:
            raise Rejected("UNIT_PRICE_RANGE")
        rate = line["rate"]
        if type(rate) is not int or rate not in (0, 5, 20):
            raise Rejected("TAX_TREATMENT_UNSUPPORTED")
        net = (q * p + 500000) // 1000000
        vat = (net * rate + 50) // 100
        result = [net, vat, net + vat]
        totals = [a + b for a, b in zip(totals, result)]
        if any(v > MAX for v in result + totals):
            raise Rejected("MONEY_LIMIT")
        results.append([str(v) for v in result])
    return results, [str(v) for v in totals]

def independent_decimal_calculation(lines):
    results = []
    with localcontext() as ctx:
        ctx.prec = 80
        for line in lines:
            net = (Decimal(line["q"]) * Decimal(line["p"]) * 100).quantize(Decimal("1"), rounding=ROUND_HALF_UP)
            vat = (net * Decimal(line["rate"]) / 100).quantize(Decimal("1"), rounding=ROUND_HALF_UP)
            results.append([int(net), int(vat), int(net + vat)])
    return [[str(v) for v in line] for line in results], [
        str(sum(line[i] for line in results)) for i in range(3)]

def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()

def main():
    baseline = json.loads(BASE.read_text())
    assert baseline["baselineHead"] == "f968280e99efe34573ce80c339540f89a622d0c0"
    retained = []
    for rel, expected in baseline["files"].items():
        if rel == PROPOSAL:
            original = subprocess.check_output(["git", "show", baseline["baselineHead"] + ":" + rel], cwd=ROOT)
            assert hashlib.sha256(original).hexdigest() == expected["sha256"]
            continue
        assert digest(ROOT / rel) == expected["sha256"], "Changed baseline/concurrent file: " + rel
        retained.append(rel)
    # Preserve the original receipt byte-for-byte, not a reconstructed snapshot.
    (HERE / "baseline-source-evidence.json").write_bytes(BASE.read_bytes())
    g7 = json.loads((ROOT / "docs/governance/drafts/ledgerly-tr01-c7-g7-acceptance/owner-acceptance.json").read_text())
    assert g7["status"] == "ACCEPTED" and g7["runId"] == "38621069723" and g7["runAttempt"] == 1
    assert g7["productionAuthorization"] is False and g7["phaseAAuthorization"] is False
    changed = subprocess.check_output(["git", "diff", "--name-only", baseline["baselineHead"]], cwd=ROOT).decode().splitlines()
    allowed = {PROPOSAL} | {
        "docs/governance/drafts/" + name for name in DOC_NAMES
    } | {
        "docs/governance/drafts/ledgerpoint-w03-contract-review/" + name
        for name in ("verify-package.py", "money-golden-cases.json",
                     "baseline-source-evidence.json", "package-checks.json")
    }
    assert set(changed) <= allowed, "Unexpected tracked change outside W03 package: " + str(changed)
    tracked_or_untracked = subprocess.check_output(["git", "status", "--short"], cwd=ROOT).decode()
    assert not any(re.match(r".. (artifacts/|lib/|\.github/)", line) for line in tracked_or_untracked.splitlines())
    link_count = 0
    for name in DOC_NAMES:
        doc = HERE.parent / name
        for target in re.findall(r"\[[^\]]*\]\(([^)]+)\)", doc.read_text()):
            if "://" in target or target.startswith("#"):
                continue
            resolved = doc.parent / target.split("#")[0]
            if resolved != HERE / "package-checks.json":
                assert resolved.exists(), (name, target)
            link_count += 1
    cases = json.loads((HERE / "money-golden-cases.json").read_text())
    for case in cases["valid"]:
        actual = proposed_integer_calculation(case["lines"])
        assert actual == (case["expectedLines"], case["expected"]), case["id"]
        assert independent_decimal_calculation(case["lines"]) == actual, case["id"]
    for case in cases["invalid"]:
        try:
            proposed_integer_calculation(case["lines"])
        except Rejected as exc:
            assert str(exc) == case["expectedError"], case["id"]
        else:
            raise AssertionError("Invalid case accepted: " + case["id"])
    rng = random.Random(20261020)
    for _ in range(1000):
        # Safe-size generated fixtures; explicit boundary/rejection cases above.
        lines = [{"q": f"{rng.randint(1,999)}.{rng.randrange(10000):04d}",
                  "p": f"{rng.randrange(1000)}.{rng.randrange(10000):04d}",
                  "rate": rng.choice([0,5,20])} for _ in range(rng.randint(1,8))]
        assert proposed_integer_calculation(lines) == independent_decimal_calculation(lines)
    subprocess.run(["git", "diff", "--check"], cwd=ROOT, check=True)
    report = {
        "recordedAtUtc": datetime.datetime.now(datetime.timezone.utc).isoformat(),
        "status": "PASS_OFFLINE_PREPARATION_CHECKS_ONLY",
        "baselineHead": baseline["baselineHead"], "baselineTree": baseline["baselineTree"],
        "retainedBaselineAndConcurrentFiles": len(retained),
        "localLinksChecked": link_count,
        "goldenValid": len(cases["valid"]), "goldenRejects": len(cases["invalid"]),
        "independentGeneratedDecimalComparisons": 1000,
        "G7": "ACCEPTED_RECORDED_NOT_REPLAYED",
        "sourceAndDirtyG7EvidenceUnchanged": True,
        "trackedChangesWithinPreparationScope": True,
        "gitDiffCheck": "PASS",
        "applicationTypechecksRun": 0, "applicationRegressionsRun": 0,
        "authenticatedHttpTestsRun": 0, "databaseConcurrencyTestsRun": 0,
        "databaseAccess": False, "networkRequests": 0,
        "runtimeImplementation": False, "accountingPolicyApproved": False,
        "limitations": "Integer/Decimal checks validate proposed arithmetic only, not VAT eligibility, live HTTP enforcement, transactional behavior or implemented application code."
    }
    (HERE / "package-checks.json").write_text(json.dumps(report, indent=2) + "\n")
    print(json.dumps(report, indent=2))

if __name__ == "__main__":
    main()
