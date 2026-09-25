import { jsPDF } from 'jspdf';

function formatCurrency(a) {
  return new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' }).format(a || 0);
}

function downloadFile(content, filename, mimeType) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function exportCSV(report) {
  if (!report) return;
  let csv = report.title + '\n\n';
  if (report.summaryCards) {
    for (const card of report.summaryCards) {
      csv += card.label + ',' + formatCurrency(card.value) + '\n';
    }
    csv += '\n';
  }
  for (const section of report.sections) {
    csv += section.name + '\n';
    csv += section.columns.map(c => '"' + c + '"').join(',') + '\n';
    for (const row of section.rows) {
      csv += row.cells.map(c => '"' + String(c).replace(/"/g, '""') + '"').join(',') + '\n';
    }
    if (section.totalCells) {
      csv += section.totalCells.map(c => '"' + c + '"').join(',') + '\n';
    } else if (section.totalLabel) {
      csv += '"' + section.totalLabel + '","' + formatCurrency(section.totalValue) + '"\n';
    }
    csv += '\n';
  }
  downloadFile(csv, report.title + '.csv', 'text/csv');
}

export function exportExcel(report) {
  if (!report) return;
  const maxCols = Math.max(...report.sections.map(s => s.columns.length));
  let html = '<html><head><meta charset="utf-8"></head><body><table border="1">';
  html += '<tr><th colspan="' + maxCols + '" style="font-size:16px;text-align:center">' + report.title + '</th></tr>';
  if (report.summaryCards) {
    html += '<tr>';
    for (const card of report.summaryCards) {
      html += '<td><b>' + card.label + '</b></td>';
    }
    html += '</tr><tr>';
    for (const card of report.summaryCards) {
      html += '<td>' + formatCurrency(card.value) + '</td>';
    }
    html += '</tr>';
  }
  for (const section of report.sections) {
    html += '<tr><th colspan="' + section.columns.length + '" style="background:#e0e0e0;text-align:left">' + section.name + '</th></tr>';
    html += '<tr>' + section.columns.map(c => '<th>' + c + '</th>').join('') + '</tr>';
    for (const row of section.rows) {
      html += '<tr>' + row.cells.map(c => '<td>' + c + '</td>').join('') + '</tr>';
    }
    if (section.totalCells) {
      html += '<tr>' + section.totalCells.map(c => '<td><b>' + c + '</b></td>').join('') + '</tr>';
    } else if (section.totalLabel) {
      html += '<tr><td><b>' + section.totalLabel + '</b></td><td><b>' + formatCurrency(section.totalValue) + '</b></td></tr>';
    }
  }
  html += '</table></body></html>';
  downloadFile(html, report.title + '.xls', 'application/vnd.ms-excel');
}

export function exportPDF(report) {
  if (!report) return;
  const doc = new jsPDF();
  let y = 20;

  doc.setFontSize(18);
  doc.text(report.title, 14, y);
  y += 10;

  if (report.summaryCards) {
    doc.setFontSize(10);
    for (const card of report.summaryCards) {
      doc.text(card.label + ': ' + formatCurrency(card.value), 14, y);
      y += 6;
    }
    y += 4;
  }

  for (const section of report.sections) {
    if (y > 250) { doc.addPage(); y = 20; }
    doc.setFontSize(13);
    doc.text(section.name, 14, y);
    y += 7;

    doc.setFontSize(9);
    doc.text(section.columns.join('   |   '), 14, y);
    y += 5;

    for (const row of section.rows) {
      if (y > 270) { doc.addPage(); y = 20; }
      doc.text(row.cells.join('   |   '), 14, y);
      y += 5;
    }

    if (section.totalCells) {
      doc.text(section.totalCells.join('   |   '), 14, y);
      y += 5;
    } else if (section.totalLabel) {
      doc.text(section.totalLabel + ': ' + formatCurrency(section.totalValue), 14, y);
      y += 7;
    }
    y += 3;
  }

  doc.save(report.title + '.pdf');
}