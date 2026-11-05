"""Extract cached HMRC reference cells, never calculate tax or access the network."""
import hashlib
import io
import json
from pathlib import Path
from decimal import Decimal, ROUND_HALF_EVEN
import xml.etree.ElementTree as ET
import zipfile

ROOT = Path(__file__).resolve().parent
SOURCE = ROOT / 'fixtures/hmrc-paye-2026-27-v1.1.zip'
S = '{http://schemas.openxmlformats.org/spreadsheetml/2006/main}'
R = '{http://schemas.openxmlformats.org/officeDocument/2006/relationships}'
URL = 'https://assets.publishing.service.gov.uk/media/696f9b5f2b64f0e8c32e33a4/Tax-test-data-examples-2026-27-v1-1.zip'

def minor(raw):
    value = Decimal(raw) * 100
    rounded = value.quantize(Decimal(1), rounding=ROUND_HALF_EVEN)
    # XLSX cached numbers contain binary floating residues; only normalize a
    # residue far below a penny. A substantive fractional penny requires review.
    if not value.is_finite() or abs(value-rounded) > Decimal('0.000001'):
        raise ValueError('Substantive fractional-penny source value requires review')
    return str(int(rounded))

def extract():
    cases, workbooks = [], []
    with zipfile.ZipFile(SOURCE) as outer:
        change_name = next(n for n in outer.namelist() if n.endswith('.txt'))
        changes = outer.read(change_name).decode('utf-8')
        for name in sorted(n for n in outer.namelist() if n.endswith('.xlsx')):
            region = 'scotland' if 'Scottish' in name else 'wales' if 'Welsh' in name else 'rest_of_uk'
            data = outer.read(name)
            workbooks.append({'path':name, 'region':region, 'sha256':hashlib.sha256(data).hexdigest()})
            with zipfile.ZipFile(io.BytesIO(data)) as book:
                strings = [''.join(si.itertext()) for si in ET.fromstring(book.read('xl/sharedStrings.xml')).findall(S+'si')]
                rels = {r.attrib['Id']:r.attrib['Target'] for r in ET.fromstring(book.read('xl/_rels/workbook.xml.rels'))}
                for sheet in ET.fromstring(book.read('xl/workbook.xml')).find(S+'sheets'):
                    title=sheet.attrib['name']; target=rels[sheet.attrib[R+'id']]
                    target=target.lstrip('/') if target.startswith('/') else 'xl/'+target
                    prior=None
                    for row in ET.fromstring(book.read(target)).find(S+'sheetData'):
                        cells={}
                        for cell in row:
                            column=''.join(c for c in cell.attrib['r'] if c.isalpha())
                            if column not in 'ABCDEFGH' or len(column)!=1: continue
                            value=cell.find(S+'v')
                            if value is not None: cells[column]=strings[int(value.text)] if cell.get('t')=='s' else value.text
                        if not cells.get('D') or not cells.get('F') or cells.get('A','').lower().replace('-','_')!=title.lower().replace('-','_'): continue
                        period=Decimal(cells['F'])
                        if period!=int(period) or not 1<=period<=53: raise ValueError('Invalid period')
                        case_id=f"hmrc-paye-2026-27-{region}-{title}-row-{row.attrib['r']}"
                        cases.append({'id':case_id,'sourceWorkbook':name,'sourceSheet':title,'sourceRow':int(row.attrib['r']),
                          'sequenceId':f'{region}/{title}','previousExampleId':prior,
                          'input':{'taxYear':'2026-27','region':region,'frequency':'monthly' if 'mthly' in title or 'monthly' in title else 'weekly',
                            'period':int(period),'taxCode':cells['D'],'week1Month1':cells.get('E') or None,
                            'grossPayMinor':minor(cells['B']),'taxablePayToDateMinor':minor(cells['C'])},
                          'expected':{'taxDueMinor':minor(cells['G']),'taxDueToDateMinor':minor(cells['H'])},
                          'sourceNumericLexemes':{k:cells[k] for k in ['B','C','G','H']}})
                        prior=case_id
    if len(workbooks)!=3 or len(cases)!=168: raise ValueError('Unexpected source corpus')
    return {'version':1,'taxYear':'2026-27','status':'reference_fixtures_only_not_engine_qualification',
      'source':{'publisher':'HM Revenue & Customs','version':'1.1','page':'https://www.gov.uk/government/publications/software-developers-payroll-test-data-2026-to-2027',
        'url':URL,'sha256':hashlib.sha256(SOURCE.read_bytes()).hexdigest(),'retrievedAt':'2026-10-31',
        'licence':'Open Government Licence v3.0','licenceUrl':'https://www.nationalarchives.gov.uk/doc/open-government-licence/version/3/',
        'workbooks':workbooks,'publishedChanges':changes},
      'limitations':['Reference cells only; no native PAYE engine qualification.',
        'Cumulative examples are ordered sequences, not independent employee inputs; previous examples and official guidance must be respected.',
        'Cached XLSX numeric residues below 0.000001 pence are normalized to integer pence; original numeric lexemes retained.',
        'Eligibility, statutory rules, rounding algorithm, prior employment and all earnings periods require separate qualification; no other-year carry-forward.'],
      'cases':cases}

if __name__=='__main__': print(json.dumps(extract(),indent=2))
