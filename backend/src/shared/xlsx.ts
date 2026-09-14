import AdmZip from "adm-zip";

/**
 * Una planilla de Excel (.xlsx), armada a mano.
 *
 * Un .xlsx es un zip con unos pocos XML adentro, y para una tabla con encabezado no hace
 * falta más que eso. Se evita así una librería entera para un solo botón; el zip ya lo
 * trae el proyecto por la importación de calendarios.
 *
 * Las fechas van como texto ("14/09/2026") y no como fechas de Excel: una fecha de Excel
 * es un número de días que depende del huso, y el que abre la planilla quiere leer el día.
 */

export type Cell = string | number | null | undefined;

export interface SheetColumn {
  header: string;
  /** Ancho en caracteres. */
  width?: number;
  /** Se escribe con signo pesos y separador de miles. */
  money?: boolean;
}

export interface Sheet {
  name: string;
  columns: SheetColumn[];
  rows: Cell[][];
}

const MAIN = "http://schemas.openxmlformats.org/spreadsheetml/2006/main";
const REL = "http://schemas.openxmlformats.org/officeDocument/2006/relationships";
const PKG = "http://schemas.openxmlformats.org/package/2006/relationships";
const HEAD = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>';

/** Estilos: 0 común, 1 encabezado, 2 plata. */
const STYLES = `${HEAD}
<styleSheet xmlns="${MAIN}">
<numFmts count="1"><numFmt numFmtId="164" formatCode="&quot;$&quot; #,##0"/></numFmts>
<fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font></fonts>
<fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FFE8F1EC"/><bgColor indexed="64"/></patternFill></fill></fills>
<borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>
<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>
<cellXfs count="3"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1"/><xf numFmtId="164" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/></cellXfs>
<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>
</styleSheet>`;

function escapeXml(value: string): string {
  return value
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** 0 → A, 25 → Z, 26 → AA. */
function columnName(index: number): string {
  let name = "";
  let n = index + 1;
  while (n > 0) {
    const rest = (n - 1) % 26;
    name = String.fromCharCode(65 + rest) + name;
    n = Math.floor((n - 1) / 26);
  }
  return name;
}

/** Excel no acepta estos caracteres en el nombre de una hoja, ni más de 31 letras. */
function sheetName(name: string): string {
  return name.replace(/[[\]:*?/\\]/g, " ").slice(0, 31) || "Hoja";
}

function cell(ref: string, value: Cell, style: number): string {
  if (value === null || value === undefined || value === "") return "";
  if (typeof value === "number" && Number.isFinite(value)) {
    return `<c r="${ref}"${style ? ` s="${style}"` : ""}><v>${value}</v></c>`;
  }
  return `<c r="${ref}" t="inlineStr"${style === 1 ? ' s="1"' : ""}><is><t xml:space="preserve">${escapeXml(String(value))}</t></is></c>`;
}

function worksheet(sheet: Sheet): string {
  const cols = sheet.columns
    .map((column, index) => `<col min="${index + 1}" max="${index + 1}" width="${column.width ?? 14}" customWidth="1"/>`)
    .join("");

  const header = `<row r="1">${sheet.columns.map((column, index) => cell(`${columnName(index)}1`, column.header, 1)).join("")}</row>`;

  const rows = sheet.rows
    .map((row, rowIndex) => {
      const r = rowIndex + 2;
      const cells = row
        .map((value, index) => cell(`${columnName(index)}${r}`, value, sheet.columns[index]?.money ? 2 : 0))
        .join("");
      return `<row r="${r}">${cells}</row>`;
    })
    .join("");

  // El encabezado queda fijo al bajar: con cuarenta profesionales, a la décima fila ya no
  // se sabe qué columna es la plata.
  return `${HEAD}
<worksheet xmlns="${MAIN}" xmlns:r="${REL}"><sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews><cols>${cols}</cols><sheetData>${header}${rows}</sheetData></worksheet>`;
}

export function buildXlsx(sheets: Sheet[]): Buffer {
  const zip = new AdmZip();
  const add = (path: string, content: string) => zip.addFile(path, Buffer.from(content, "utf8"));

  add(
    "[Content_Types].xml",
    `${HEAD}
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>${sheets
      .map(
        (_, index) =>
          `<Override PartName="/xl/worksheets/sheet${index + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`
      )
      .join("")}</Types>`
  );

  add(
    "_rels/.rels",
    `${HEAD}
<Relationships xmlns="${PKG}"><Relationship Id="rId1" Type="${REL}/officeDocument" Target="xl/workbook.xml"/></Relationships>`
  );

  add(
    "xl/workbook.xml",
    `${HEAD}
<workbook xmlns="${MAIN}" xmlns:r="${REL}"><sheets>${sheets
      .map((sheet, index) => `<sheet name="${escapeXml(sheetName(sheet.name))}" sheetId="${index + 1}" r:id="rId${index + 1}"/>`)
      .join("")}</sheets></workbook>`
  );

  add(
    "xl/_rels/workbook.xml.rels",
    `${HEAD}
<Relationships xmlns="${PKG}">${sheets
      .map((_, index) => `<Relationship Id="rId${index + 1}" Type="${REL}/worksheet" Target="worksheets/sheet${index + 1}.xml"/>`)
      .join("")}<Relationship Id="rId${sheets.length + 1}" Type="${REL}/styles" Target="styles.xml"/></Relationships>`
  );

  add("xl/styles.xml", STYLES);
  sheets.forEach((sheet, index) => add(`xl/worksheets/sheet${index + 1}.xml`, worksheet(sheet)));

  return zip.toBuffer();
}
