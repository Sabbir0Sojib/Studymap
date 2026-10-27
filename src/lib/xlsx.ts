// The first sheet of an Excel workbook (.xlsx) as CSV text, so field data kept in Excel opens like a CSV file.
// An .xlsx is a zip of XML files: the sheet holds the cells, a shared list holds the text they point to.
import { unzip } from 'but-unzip';
import Papa from 'papaparse';

const text = async (item: { read: () => Promise<Uint8Array> | Uint8Array }) => new TextDecoder().decode(await item.read());

/** "AB12" -> column index 27 (A = 0). */
function colIndex(ref: string): number {
  let n = 0;
  for (const ch of ref.replace(/\d+$/, '')) n = n * 26 + (ch.charCodeAt(0) - 64);
  return n - 1;
}

export async function xlsxToCsv(buf: ArrayBuffer): Promise<{ csv: string; sheet: string; sheets: number }> {
  const items = unzip(new Uint8Array(buf));
  const byName = new Map(items.map((i) => [i.filename.replace(/^\//, ''), i]));
  const xml = (s: string) => new DOMParser().parseFromString(s, 'application/xml');
  // the first sheet in the workbook's own order (not always sheet1.xml)
  const wb = byName.get('xl/workbook.xml');
  const rels = byName.get('xl/_rels/workbook.xml.rels');
  if (!wb) throw new Error('This is not an Excel workbook.');
  const wbDoc = xml(await text(wb));
  const sheets = [...wbDoc.getElementsByTagName('sheet')];
  const first = sheets[0];
  let path = 'xl/worksheets/sheet1.xml';
  if (first && rels) {
    const rid = first.getAttribute('r:id') ?? first.getAttributeNS('http://schemas.openxmlformats.org/officeDocument/2006/relationships', 'id');
    const rel = [...xml(await text(rels)).getElementsByTagName('Relationship')].find((r) => r.getAttribute('Id') === rid);
    const target = rel?.getAttribute('Target');
    if (target) path = target.startsWith('/') ? target.slice(1) : `xl/${target.replace(/^\.\//, '')}`;
  }
  const sheetItem = byName.get(path);
  if (!sheetItem) throw new Error('The workbook has no sheet with data.');
  const shared: string[] = [];
  const ss = byName.get('xl/sharedStrings.xml');
  if (ss) for (const si of xml(await text(ss)).getElementsByTagName('si')) shared.push([...si.getElementsByTagName('t')].map((t) => t.textContent ?? '').join(''));
  const rows: string[][] = [];
  for (const row of xml(await text(sheetItem)).getElementsByTagName('row')) {
    const out: string[] = [];
    for (const c of row.getElementsByTagName('c')) {
      const ref = c.getAttribute('r');
      const i = ref ? colIndex(ref) : out.length;
      const t = c.getAttribute('t');
      const v = c.getElementsByTagName('v')[0]?.textContent ?? '';
      const val = t === 's' ? shared[Number(v)] ?? '' : t === 'inlineStr' ? [...c.getElementsByTagName('t')].map((x) => x.textContent ?? '').join('') : t === 'b' ? (v === '1' ? 'TRUE' : 'FALSE') : v;
      while (out.length < i) out.push('');
      out[i] = val;
    }
    if (out.some((x) => x.trim())) rows.push(out);
  }
  if (!rows.length) throw new Error('The first sheet of this workbook is empty.');
  const width = Math.max(...rows.map((r) => r.length));
  for (const r of rows) while (r.length < width) r.push('');
  return { csv: Papa.unparse(rows), sheet: first?.getAttribute('name') ?? 'Sheet1', sheets: sheets.length };
}
