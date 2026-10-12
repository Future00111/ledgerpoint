# Latest C4 outcome — live sequence executed, qualification failed

Producer PR #15 merged; C4 protected and published; identity passed; Environment switched to exact C4. Fresh qualification 37677799309 attempt 1 failed at nested pnpm offline resolution. Cleanup verified. No retry performed. See [full live report](ledgerly-tr01-c4-live-execution-report.md).

The C5 repair/preparation stage subsequently cleared binding replay on a
supported isolated diagnostic runner and normally merged only the separate
producer, recording actual M5. See the
[current C5 execution outcome](ledgerly-tr01-c5-authorized-execution-report.md)
and [current live next actions](ledgerly-tr01-c5-live-next-actions.md). C4 remains
frozen; live pins/admission/protection remain unchanged. No C4 retry or live
C5 protection/publication/identity/qualification step ran.

The original prepared sequence below is preserved as historical evidence.

# C4 exact next actions — tested review publication complete

C4 candidate [PR #14](https://github.com/Future00111/ledgerpoint/pull/14) and separate protected-main producer [PR #15](https://github.com/Future00111/ledgerpoint/pull/15) are draft and unmerged. Repair [PR #13](https://github.com/Future00111/ledgerpoint/pull/13) is published.

Candidate SHA: 273f714c876260636346b7fbcc588224e9795141

Git tree: 168f81192d1fea635cd3c038e6be3a709ab11a82

Sole parent: 9d50d4e86696fd18eb7f877c9edfaba710b3572e (the one-line C3 repair).

Producer SHA: f03abf3fc7c481ed50ecfb30fc5275b8f2013849; sole parent protected main 65f3453c29f1eb1057bc66edc0cc7de508e87c2d.

All six disposable binding regressions, identity/acceptance checks, both typecheck sets, actual Docker build, three offline regressions and 26 producer tests passed. Full hosted canonical posting/concurrency/isolation/cleanup qualification has not run for C4.

## Concrete remaining sequence

1. Normally ready/merge exact producer PR #15 without bypass, after fresh base/head/readback checks. Record actual resulting protected-main commit M4 and unchanged hashes of the three producer files. Never merge candidate PR #14 into main or frozen C3.
2. Create a new exact C4 active frozen ruleset from ledgerly-tr01-c4-ruleset-proposed.json. It preserves C3's update/deletion/force-push restrictions, zero bypass actors, strict GitHub Actions app 15368 status policy and create-only status exemption, changing only the exact ref/context/name to C4. Verify stored and effective rules.
3. Publish refs/heads/tr01/implementation-identity-successor-c4 once at the exact candidate SHA above, without force/update/history rewriting. Verify SHA/tree/single parent and protected/frozen status. C/C2/C3 remain frozen.
4. Add Environment TR01_C4_APPROVED_WORKFLOW_SHA=M4, after verifying protected main still equals M4. Retain C2/C3 producer pins. Dispatch ledgerly-tr01-c4-identity-status.yml on exact main once; use normal owner Environment review. Verify exact workflow/source/C4 identity and bot-issued tr01/c4-identity-validation. This is non-DB identity validation only.
5. Only after identity success, set LEDGERLY_APPROVED_CANDIDATE_SHA to exact C4 and replace only the exact C3 deployment branch policy with tr01/implementation-identity-successor-c4. Preserve main, custom-policy mode, normal owner reviewer settings, zero tag/wildcard admissions, and all frozen ancestor protections. Fresh readback must show only main+C4 and the matching C4 pin.
6. Record the owner's authorization/attestation for one fresh development/disposable qualification with current preflight evidence. Dispatch ledgerly-canonical-postgresql.yml on the exact C4 ref, using normal owner release without bypass. Verify schema-v2 artifacts/digests, posting/concurrency/negative controls, four isolation probes and all five cleanup flags. Preserve failure evidence and stop if anything fails; no failed-run retry or production/Helium access is authorized by preparation.

## Prepared ruleset payload — unapplied

```json
{
  "name": "Protect TR-01 implementation successor C4",
  "target": "branch",
  "enforcement": "active",
  "conditions": {
    "ref_name": {
      "exclude": [],
      "include": [
        "refs/heads/tr01/implementation-identity-successor-c4"
      ]
    }
  },
  "rules": [
    {
      "type": "deletion"
    },
    {
      "type": "non_fast_forward"
    },
    {
      "type": "update"
    },
    {
      "type": "required_status_checks",
      "parameters": {
        "strict_required_status_checks_policy": true,
        "do_not_enforce_on_create": true,
        "required_status_checks": [
          {
            "context": "tr01/c4-identity-validation",
            "integration_id": 15368
          }
        ]
      }
    }
  ],
  "bypass_actors": []
}
```
