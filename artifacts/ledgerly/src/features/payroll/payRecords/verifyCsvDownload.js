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

// Hold an authorised response after the server has committed its export receipt.
export async function verifyLateCsvAfterSwitch(button, switchWorkspace, wait) {
  const fetch = window.fetch, click = HTMLAnchorElement.prototype.click;
  let release, consumed = false, downloads = 0;
  window.fetch = async (url, options) => {
    const response = await fetch(url, options);
    if (!String(url).endsWith('/export.csv') || response.status !== 200) return response;
    const body = await response.text();
    return {status:response.status, headers:response.headers, async text() {
      await new Promise(resolve => { release = resolve; });
      consumed = true;
      return body;
    }};
  };
  HTMLAnchorElement.prototype.click = () => { downloads++; };
  try {
    button.click();
    await wait(() => release, 'authorised CSV received');
    await switchWorkspace();
    release();
    await wait(() => consumed, 'late CSV consumed');
    await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    if (downloads) throw Error('Previous workspace CSV downloaded after switch');
  } finally {
    release?.();
    window.fetch = fetch;
    HTMLAnchorElement.prototype.click = click;
  }
}
