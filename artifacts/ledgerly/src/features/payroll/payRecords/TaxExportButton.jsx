import { CsvDownloadButton } from './CsvDownloadButton';
import { canExportTax, requestTaxDownload } from './taxExport.mjs';

export function TaxExportButton(props) {
  return <CsvDownloadButton {...props} allowed={canExportTax(props.role)} requestDownload={requestTaxDownload} />;
}
