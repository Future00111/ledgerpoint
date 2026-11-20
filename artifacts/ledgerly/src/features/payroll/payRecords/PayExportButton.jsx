import { CsvDownloadButton } from './CsvDownloadButton';
import { canExportPay, requestPayDownload } from './payExport.mjs';

export function PayExportButton(props) {
  return <CsvDownloadButton {...props} allowed={canExportPay(props.role)} requestDownload={requestPayDownload} />;
}
