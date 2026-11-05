"use client";

export function ExportCsvButton() {
  function exportTables() {
    const tables = Array.from(document.querySelectorAll<HTMLElement>('.report-section'));
    const blocks = tables.map(section => {
      const title = section.querySelector('h2')?.textContent?.trim() || 'Report';
      const table = section.querySelector('table');
      if (!table) return '';
      const rows = Array.from(table.querySelectorAll('tr')).map(row =>
        Array.from(row.querySelectorAll('th,td')).map(cell => {
          const value = (cell.textContent || '').replace(/\s+/g, ' ').trim();
          return '"' + value.replace(/"/g, '""') + '"';
        }).join(',')
      );
      return ['"' + title.replace(/"/g, '""') + '"', ...rows].join('\r\n');
    }).filter(Boolean);
    if (!blocks.length) return;
    const csv = '\uFEFF' + blocks.join('\r\n\r\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'rundingan-report-center-' + new Date().toISOString().slice(0, 10) + '.csv';
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }
  return <button type="button" onClick={exportTables}>Ekspor CSV</button>;
}
