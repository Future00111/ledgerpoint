// Disposable Chromium assertion shared by the payroll and personal-tax journeys.
const fetchBlob = window.fetch.bind(window);
export async function verifyCsvDownload(button, filename, expected, wait) {
  // Read the blob at the browser's download boundary, before the object URL is revoked.
  let download;
  const click = HTMLAnchorElement.prototype.click;
  HTMLAnchorElement.prototype.click = function () {
    if (!this.href.startsWith('blob:') || this.download !== filename) throw Error('Unexpected attachment');
    download = fetchBlob(this.href).then(response => response.text());
  };
  try {
    button.click();
    await wait(() => Boolean(download), 'CSV attachment');
    if (await download !== expected) throw Error('CSV contents');
  } finally { HTMLAnchorElement.prototype.click = click; }
}
