"""Extract official cached NI cells offline. Never calculate contributions."""
import hashlib
import io
import json
from collections import Counter
from pathlib import Path
import xml.etree.ElementTree as ET
import zipfile
from import_hmrc_paye_fixtures import minor

ROOT = Path(__file__).resolve().parent
SOURCE = ROOT / 'fixtures/hmrc-ni-2026-27-v1.0.zip'
SHA = '49edd60c91df45d5f529b92291c018e4fc453ab17675035d1f2662825c0b0368'
PAGE = 'https://www.gov.uk/government/publications/software-developers-payroll-test-data-2026-to-2027'
URL = 'https://assets.publishing.service.gov.uk/media/69676c2297d42030a67b0d60/NI-test-data-examples-from-April-2026-v1-0__1_.zip'
S = '{http://schemas.openxmlformats.org/spreadsheetml/2006/main}'
R = '{http://schemas.openxmlformats.org/officeDocument/2006/relationships}'
BOOKS = {'NIC test data v1.0.xlsx': 'ABCHJMVZ',
         'NICs test data Freeports and Investment Zone v1.0.xlsx': 'FISLDEKN'}
FREQUENCIES = {'Weekly': 'weekly', '2-weekly': 'fortnightly', '4-weekly': 'four_weekly', 'Monthly': 'monthly'}

def extract():
    raw = SOURCE.read_bytes()
    if hashlib.sha256(raw).hexdigest() != SHA:
        raise ValueError('Pinned HMRC NI source digest mismatch')
    cases, books = [], []
    with zipfile.ZipFile(io.BytesIO(raw)) as archive:
        for filename, categories in BOOKS.items():
            paths = [p for p in archive.namelist() if p.endswith('/'+filename)]
            if len(paths) != 1:
                raise ValueError('Expected unique official workbook')
            name = paths[0]
            data = archive.read(name)
            books.append({'path': name, 'sha256': hashlib.sha256(data).hexdigest()})
            with zipfile.ZipFile(io.BytesIO(data)) as book:
                strings = [''.join(x.itertext()) for x in ET.fromstring(book.read('xl/sharedStrings.xml')).findall(S+'si')]
                rels = {x.attrib['Id']: x.attrib['Target'] for x in ET.fromstring(book.read('xl/_rels/workbook.xml.rels'))}
                sheets = ET.fromstring(book.read('xl/workbook.xml')).find(S+'sheets')
                if [x.get('name') for x in sheets] != ['Cat_'+c for c in categories]:
                    raise ValueError('Unexpected category sheets')
                for sheet in sheets:
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
                    if rows[1].get('B') != title[-1] or rows[2].get('B') != '2026 - 27':
                        raise ValueError('Category/year header mismatch')
                    if [rows[4].get(c) for c in 'ABCDEFG'] != ['Pay frequency','Gross Pay','Period','NIC Letter','Employee NIC','Employer NIC','Total NIC']:
                        raise ValueError('Unexpected reference column headings')
                    counts = Counter()
                    for row, cells in rows.items():
                        if cells.get('A') not in FREQUENCIES:
                            continue
                        if not all(c in cells for c in 'ABCDEFGHIJKL') or cells['D'] != title[-1] or cells['C'] not in ('0','1'):
                            raise ValueError(f'Unexpected reference row shape or period: {title} row {row}: {cells}')
                        frequency = FREQUENCIES[cells['A']]
                        counts[frequency] += 1
                        amounts = {c: minor(cells[c]) for c in 'BEFGHIJKL'}
                        if int(amounts['E']) + int(amounts['F']) != int(amounts['G']):
                            raise ValueError('Official total does not reconcile')
                        cases.append({'id': f'hmrc-ni-2026-27-{title}-row-{row}',
                          'sourceWorkbook': name, 'sourceSheet': title, 'sourceRow': row,
                          'sourceIssues': ['period_zero_requires_source_clarification'] if cells['C']=='0' else [],
                          'input': {'taxYear':'2026-27','category':cells['D'],'frequency':frequency,
                                    'period':int(cells['C']),'grossPayMinor':amounts['B']},
                          'expected': {'employeeNiMinor':amounts['E'],'employerNiMinor':amounts['F'],'totalNiMinor':amounts['G']},
                          'sourceReportingCells': {rows[4][c]:amounts[c] for c in 'HIJKL'},
                          'sourceNumericLexemes': {c:cells[c] for c in 'BCEFGHIJKL'}})
                    if counts != Counter({f:14 for f in FREQUENCIES.values()}):
                        raise ValueError('Missing or extra frequency examples')
    if len(cases) != 896 or len({x['id'] for x in cases}) != 896:
        raise ValueError('Unexpected NI reference corpus')
    return {'version':1,'taxYear':'2026-27','effectiveFrom':'2026-04-06','effectiveTo':'2027-04-05',
      'status':'reference_fixtures_only_not_engine_qualification','independentReview':None,
      'source':{'publisher':'HM Revenue & Customs','version':'1.0','page':PAGE,'url':URL,
        'sha256':SHA,'retrievedAt':'2026-11-06','workbooks':books,
        'licence':'Open Government Licence v3.0','licenceUrl':'https://www.nationalarchives.gov.uk/doc/open-government-licence/version/3/'},
      'limitations':['Cached official examples, not a calculation engine or accountant approval.',
        'Category eligibility and geographic relief eligibility are NOT inferred from category letters.',
        'Directors workbook is preserved in the archive but not extracted or qualified.',
        'Four Cat_S/Cat_L rows contain source period zero; retained verbatim and quarantined pending source clarification, never repaired by inference.',
        'No category changes, irregular periods, corrections, refunds, negative pay or other tax years qualified.',
        'Original lexemes retained; only cached numeric residues below 0.000001 pence normalized by the existing PAYE reference importer.'],
      'cases':cases}

if __name__ == '__main__':
    print(json.dumps(extract(), separators=(',', ':')))
