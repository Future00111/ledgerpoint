/** Internal browser mechanics: callers validate content and use a fixed filename before entry. */
export function downloadCsv(csv, filename, environment = globalThis) {
  const blob = new environment.Blob([csv], { type: 'text/csv;charset=utf-8' });
  const url = environment.URL.createObjectURL(blob);
  let link;
  try {
    link = environment.document.createElement('a');
    link.href = url; link.download = filename; link.hidden = true;
    environment.document.body.appendChild(link); link.click();
  } finally {
    try { link?.remove(); }
    finally {
      // Allow the click to consume its URL; always release the in-memory file afterwards.
      environment.setTimeout(() => environment.URL.revokeObjectURL(url), 0);
    }
  }
}
