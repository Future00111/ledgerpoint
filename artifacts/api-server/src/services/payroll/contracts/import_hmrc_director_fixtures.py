"""Pinned official cached results. Not a director NI calculation engine."""
import hashlib
import io
import json
import xml.etree.ElementTree as ET
import zipfile
from import_hmrc_ni_fixtures import SOURCE, SHA, PAGE, URL, S, R
from import_hmrc_paye_fixtures import minor

SHEETS = ['1_Dir_CatA_£1000pw', '2_Dir_catM_£1000_pw_from_week_5',
          '3_Dir_CatA_£52000_pa', '4_Dir_CatM_£48000pa_48_weeks']
STAGES = {'Weekly': 'weekly_employee_basis',
          'Weekly - annualised (A)': 'annualised_year_end_total',
          'Week 52 reconciliation': 'year_end_reconciliation',
          'Annual': 'annual_method_total'}

def extract(raw=None):
    raw = SOURCE.read_bytes() if raw is None else raw
    if hashlib.sha256(raw).hexdigest() != SHA:
        raise ValueError('Pinned HMRC NI source digest mismatch')
    with zipfile.ZipFile(io.BytesIO(raw)) as archive:
        name = next(n for n in archive.namelist() if n.endswith('/Directors NICs test data v1.0.xlsx'))
        data = archive.read(name)
    cases, contexts = [], []
    with zipfile.ZipFile(io.BytesIO(data)) as book:
        strings = [''.join(x.itertext()) for x in ET.fromstring(book.read('xl/sharedStrings.xml')).findall(S+'si')]
        rels = {x.get('Id'): x.get('Target') for x in ET.fromstring(book.read('xl/_rels/workbook.xml.rels'))}
        sheets = ET.fromstring(book.read('xl/workbook.xml')).find(S+'sheets')
        if [x.get('name') for x in sheets] != SHEETS:
            raise ValueError('Director workbook sheets changed')
        for index, sheet in enumerate(sheets):
            title = sheet.get('name')
            target = rels[sheet.get(R+'id')]
            target = target.lstrip('/') if target.startswith('/') else 'xl/'+target
            rows = {}
            for row in ET.fromstring(book.read(target)).find(S+'sheetData'):
                cells = {}
                for cell in row:
                    v = cell.find(S+'v')
                    if v is not None:
                        col = ''.join(c for c in cell.get('r') if c.isalpha())
                        cells[col] = strings[int(v.text)] if cell.get('t') == 's' else v.text
                rows[int(row.get('r'))] = cells
            category = 'A' if index in (0, 2) else 'M'
            if rows[1].get('B') != category or rows[2].get('B') != '2026 - 27':
                raise ValueError('Director category/year changed')
            # Retain all cached context, including reporting/YTD and reconciliation
            # headings. Do not reinterpret a year-end total as a weekly deduction.
            contexts.append({'sheet': title, 'cachedRows': rows})
            found = []
            for row, cells in rows.items():
                if cells.get('A') not in STAGES:
                    continue
                instruction = (cells.get('A') == 'Weekly' and cells.get('C') == '52'
                               and cells.get('E', '').strip().startswith('Use annualised figures'))
                if not all(c in cells for c in ('ABCD' if instruction else 'ABCDEFG')) or cells['D'] != category:
                    raise ValueError(f'Director reference row incomplete: {title} row {row}: {cells}')
                amounts = {c: minor(cells[c]) for c in ('B' if instruction else 'BEFG')}
                if not instruction and int(amounts['E'])+int(amounts['F']) != int(amounts['G']):
                    raise ValueError('Official director total does not reconcile')
                case = {'id': f'hmrc-director-ni-2026-27-sheet-{index+1}-row-{row}',
                        'sourceSheet': title, 'sourceRow': row, 'stage': STAGES[cells['A']],
                        'input': {'taxYear': '2026-27', 'category': category,
                                  'period': int(cells['C']), 'grossPayMinor': amounts['B']},
                        'expected': None if instruction else {'employeeNiMinor': amounts['E'], 'employerNiMinor': amounts['F'],
                                     'totalNiMinor': amounts['G']},
                        'sourceIssues': ['official_instruction_not_numeric_result'] if instruction else [],
                        'sourceLexemes': cells}
                cases.append(case); found.append(case)
            if index < 2:
                weekly = [c for c in found if c['stage'] == 'weekly_employee_basis']
                if [c['input']['period'] for c in weekly] != list(range(1, 53)) or len(found) != 54:
                    raise ValueError('Director weekly/reconciliation sequence changed')
            elif len(found) != 1 or found[0]['stage'] != 'annual_method_total':
                raise ValueError('Director annual reference changed')
    if len(cases) != 110 or len({c['id'] for c in cases}) != 110:
        raise ValueError('Director corpus changed')
    return {'version': 1, 'taxYear': '2026-27', 'effectiveFrom': '2026-04-06', 'effectiveTo': '2027-04-05',
            'status': 'reference_fixtures_only_not_engine_qualification', 'independentReview': None,
            'source': {'publisher': 'HM Revenue & Customs', 'page': PAGE, 'url': URL,
                       'archiveSha256': SHA, 'workbook': name, 'workbookSha256': hashlib.sha256(data).hexdigest(),
                       'version': '1.0', 'archiveRetrievedAt': '2026-11-06', 'licence': 'Open Government Licence v3.0'},
            'limitations': ['Cached official results, not calculated deductions or accountant approval.',
                           'Weekly, annualised and reconciliation rows are different stages, not additive examples.',
                           'No category eligibility, appointment rules, statutory rounding or other tax years implemented.'],
            'sourceContexts': contexts, 'cases': cases}

if __name__ == '__main__':
    print(json.dumps(extract(), separators=(',', ':')))
