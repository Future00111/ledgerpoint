import unittest
from import_hmrc_director_fixtures import extract, SOURCE

class DirectorReferences(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.pack = extract()

    def test_source_digest_rejects_changed_bytes(self):
        with self.assertRaisesRegex(ValueError, 'digest'):
            extract(SOURCE.read_bytes()+b'changed')

    def test_counts_year_and_boundary(self):
        p = self.pack
        self.assertEqual(len(p['cases']), 110)
        self.assertEqual(p['taxYear'], '2026-27')
        self.assertEqual(p['effectiveFrom'], '2026-04-06')
        self.assertEqual(p['effectiveTo'], '2027-04-05')
        self.assertIsNone(p['independentReview'])
        self.assertEqual(p['status'], 'reference_fixtures_only_not_engine_qualification')
        self.assertEqual(sum(c['expected'] is None for c in p['cases']),2)

    def test_annual_and_reconciliation_are_not_weekly(self):
        by = {(c['sourceSheet'][0], c['stage']): c for c in self.pack['cases']}
        for sheet, employee, employer in [('3','305060','705000'),('4','281592','23940')]:
            self.assertEqual(by[(sheet,'annual_method_total')]['expected'],
                             {'employeeNiMinor': employee, 'employerNiMinor': employer,
                              'totalNiMinor': str(int(employee)+int(employer))})
        self.assertEqual(by[('1','year_end_reconciliation')]['expected']['employeeNiMinor'],'5894')
        self.assertEqual(by[('2','year_end_reconciliation')]['expected']['employerNiMinor'],'675')
        self.assertNotEqual(by[('1','weekly_employee_basis')]['id'],by[('1','year_end_reconciliation')]['id'])

    def test_source_lineage_and_reproducibility(self):
        self.assertEqual(self.pack, extract())
        self.assertEqual(len({c['id'] for c in self.pack['cases']}),110)
        for c in self.pack['cases']:
            self.assertEqual(c['sourceLexemes']['C'],str(c['input']['period']))
            if c['expected'] is None:
                self.assertEqual(c['sourceIssues'],['official_instruction_not_numeric_result'])
                self.assertEqual(c['input']['period'],52)
                continue
            self.assertEqual(int(c['expected']['employeeNiMinor'])+int(c['expected']['employerNiMinor']),
                             int(c['expected']['totalNiMinor']))

if __name__ == '__main__':
    unittest.main()
