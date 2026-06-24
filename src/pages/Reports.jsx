import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useCompany } from '@/lib/useCompany';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ArrowLeft, FileText, FileSpreadsheet, FileDown } from 'lucide-react';
import ReportSelector from '@/components/reports/ReportSelector';
import DrillDownDialog from '@/components/reports/DrillDownDialog';
import { calculateReport } from '@/lib/reportCalculations';
import { exportCSV, exportExcel, exportPDF } from '@/lib/reportExports';

function formatCurrency(a) {
  return new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' }).format(a || 0);
}

export default function Reports() {
  const { activeCompany } = useCompany();
  const [selectedReport, setSelectedReport] = useState(null);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [report, setReport] = useState(null);
  const [drillDown, setDrillDown] = useState(null);

  useEffect(() => {
    if (activeCompany) loadData();
  }, [activeCompany]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [journals, accounts, invoices, bills, bankTxns] = await Promise.all([
        base44.entities.JournalEntry.filter({ company_id: activeCompany.id }),
        base44.entities.ChartOfAccount.filter({ company_id: activeCompany.id }),
        base44.entities.SalesInvoice.filter({ company_id: activeCompany.id }),
        base44.entities.PurchaseBill.filter({ company_id: activeCompany.id }),
        base44.entities.BankTransaction.filter({ company_id: activeCompany.id }),
      ]);
      setData({ journals, accounts, invoices, bills, bankTxns });
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  useEffect(() => {
    if (selectedReport && data) {
      setReport(calculateReport(selectedReport, data, dateFrom, dateTo));
    } else {
      setReport(null);
    }
  }, [selectedReport, data, dateFrom, dateTo]);

  if (!activeCompany) return <p className="text-muted-foreground text-center py-12">Please select a company first.</p>;

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Reports</h1>
        <p className="text-muted-foreground text-sm mt-1">Generate financial reports with drill-down and export.</p>
      </div>

      {!selectedReport ? (
        loading ? (
          <div className="flex justify-center py-12"><div className="w-8 h-8 border-4 border-primary/20 border-t-primary rounded-full animate-spin" /></div>
        ) : (
          <ReportSelector selected={selectedReport} onSelect={setSelectedReport} />
        )
      ) : (
        <>
          <div className="flex flex-col sm:flex-row sm:items-end gap-3">
            <div className="flex-1 grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">From Date</Label>
                <Input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} />
              </div>
              <div>
                <Label className="text-xs">To Date</Label>
                <Input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} />
              </div>
            </div>
            <div className="flex gap-2 flex-wrap">
              <Button variant="outline" size="sm" className="gap-2" onClick={() => exportPDF(report)} disabled={!report}><FileDown className="w-4 h-4" />PDF</Button>
              <Button variant="outline" size="sm" className="gap-2" onClick={() => exportExcel(report)} disabled={!report}><FileSpreadsheet className="w-4 h-4" />Excel</Button>
              <Button variant="outline" size="sm" className="gap-2" onClick={() => exportCSV(report)} disabled={!report}><FileText className="w-4 h-4" />CSV</Button>
              <Button variant="ghost" size="sm" className="gap-2" onClick={() => setSelectedReport(null)}><ArrowLeft className="w-4 h-4" />Back</Button>
            </div>
          </div>

          {report && (
            <>
              {report.summaryCards && (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {report.summaryCards.map((card, i) => (
                    <Card key={i} className="border-0 shadow-sm">
                      <CardContent className="p-3 text-center">
                        <p className="text-xs text-muted-foreground">{card.label}</p>
                        <p className="text-lg font-semibold mt-1">{formatCurrency(card.value)}</p>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}

              {report.sections.map((section, si) => (
                <Card key={si} className="border-0 shadow-sm">
                  <CardContent className="p-4">
                    <h3 className="font-semibold mb-3">{section.name}</h3>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b">
                            {section.columns.map((c, ci) => <th key={ci} className="text-left py-2 px-2 font-medium whitespace-nowrap">{c}</th>)}
                          </tr>
                        </thead>
                        <tbody>
                          {section.rows.map((row, ri) => (
                            <tr
                              key={ri}
                              className={`border-b ${row.drillDown ? 'cursor-pointer hover:bg-muted' : ''}`}
                              onClick={() => row.drillDown && setDrillDown(row.drillDown)}
                            >
                              {row.cells.map((cell, ci) => <td key={ci} className="py-2 px-2 whitespace-nowrap">{cell}</td>)}
                            </tr>
                          ))}
                          {section.totalCells && (
                            <tr className="font-semibold border-t-2">
                              {section.totalCells.map((c, ci) => <td key={ci} className="py-2 px-2 whitespace-nowrap">{c}</td>)}
                            </tr>
                          )}
                          {!section.totalCells && section.totalLabel && (
                            <tr className="font-semibold border-t-2">
                              <td className="py-2 px-2">{section.totalLabel}</td>
                              <td className="py-2 px-2 text-right" colSpan={section.columns.length - 1}>{formatCurrency(section.totalValue)}</td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </>
          )}
        </>
      )}

      <DrillDownDialog open={!!drillDown} onOpenChange={(v) => !v && setDrillDown(null)} drillDown={drillDown} />
    </div>
  );
}