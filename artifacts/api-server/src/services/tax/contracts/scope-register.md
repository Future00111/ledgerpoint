# Tax and payroll declaration register

The `scopeRegister` section of `docs/development/tax-payroll-supported-cases.json`
maps all 29 original implementation requirements in P08-01–05, P09-01–10,
P10-01–07 and P11-01–07. It declares 258 variants across the existing three
tax years. The resulting 909 entity/variant/year selections are qualification
obligations, not 909 completed product features or independent calculation cases.

Each family retains its exact backlog description and a digest binding the
description and original acceptance criteria. It includes an owner, official
discovery source, required input fields with a concrete synthetic example,
required output fields, an explicit unqualified output example, and a named
acceptance test. The original 44 case rows and all reference packs remain intact.

`resolveDeclaredScopeCase` refuses unknown domain, entity, family, variant and
tax-year combinations. `assessDeclaredScopeInput` additionally refuses missing
or invented input fields and conflicting explicit tax years. This is an offline
shape/qualification boundary: it does not validate statutory amounts, authenticate
identities or notices, persist records, calculate payroll, or authorise filing.
An unqualified output uses `null`, never an assumed zero liability. All original
production access and external provider gates remain.

The new official discovery checks on 17 November 2026 cover:

- [VAT return boxes and scheme differences](https://www.gov.uk/guidance/how-to-fill-in-and-submit-your-vat-return-vat-notice-70012).
- [Self Assessment supplementary-page selection](https://www.gov.uk/self-assessment-tax-return-forms).
- [Per-business MTD quarterly updates](https://www.gov.uk/guidance/use-making-tax-digital-for-income-tax/send-quarterly-updates).
- [MTD preparation and final return stages](https://www.gov.uk/guidance/use-making-tax-digital-for-income-tax/using-making-tax-digital-for-income-tax-for-the-first-time).
- [CT600 supplementary-page inventory](https://www.gov.uk/government/collections/corporation-tax-forms) and [return content](https://www.gov.uk/guidance/the-company-tax-return-guide).
- [Accounts frameworks and accounts/computation taxonomies](https://www.gov.uk/government/publications/xbrl-guide-for-uk-businesses/xbrl-guide-for-uk-businesses).
- [Employer pension assessment and enrolment duties](https://www.gov.uk/workplace-pensions-employers).

Those checks establish the subject and source of the declaration. They do not
pin calculation routines, taxonomy files, future-year rates, exceptional-case
instructions, or independent monetary results. Optional CT600 forms are an
applicability inventory; their presence does not expand promised company types
or claim support for specialist regimes. FRS102 Section1A and FRS105 are explicit
qualification choices, not an automatic framework election.

## Qualification handoff

P04-03 still needs independently reviewed, year-specific numeric results and
rule provenance. The existing Plan1 notice/boundary material supplies the next
bounded verification assignment; no real employee information is needed for it.
P04-02 implements calculations only after its existing dependencies are accepted.
P02-04 must separately establish payroll/personal-tax access separation before
native sensitive records are exposed. Complete registers, fixture qualification,
calculation implementation and end-to-end statutory qualification remain distinct
acceptance decisions. This change does not mark any queue task accepted.

Run the tax and payroll contract tests with:

```sh
node --test artifacts/api-server/src/services/tax/contracts/*.test.mjs artifacts/api-server/src/services/payroll/contracts/*.test.mjs
```

The independent coverage checks bind the original backlog, exercise every declared
selection, reject missing fields and incompatible combinations, and detect deleted,
duplicated, invented or falsely qualified declarations. The existing combined
development check discovers these tests automatically.
