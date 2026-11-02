import path from "path";
import ExcelJS from "exceljs";

// Put your original Excel form here (the same file you uploaded to me)
const TEMPLATE_PATH = path.join(process.cwd(), "templates", "bulk-order-form.xlsx");

// Cell map of bulk-order-form.xlsx
const FIRST_ROW = 10; // Sr. No. 1 is on row 10
const TEMPLATE_ROWS = 15; // template has printed Sr. No. 1..15 (rows 10..24)
const LAST_TEMPLATE_ROW = FIRST_ROW + TEMPLATE_ROWS - 1; // row 24
const MAX_ROWS = 100;

// Footer of the template (blank row 25, "Instructions" rows 26..27)
const FOOTER_START = LAST_TEMPLATE_ROW + 1; // row 25
const FOOTER_END = FOOTER_START + 2; // row 27
const COLS = 7; // A..G (Sr. No., Recipient, Address, Mobile, Product, Message, Remarks)

// Excel stores phone numbers as text here so leading zeros / long numbers are not mangled
const text = (v) => String(v ?? "");

// "Product Name - (ModelNo)"; if there is no model, just the product name
const productWithModel = (product, model) => {
  const p = text(product).trim();
  const m = text(model).trim();
  return m ? `${p} - (${m})` : p;
};

// Rough row height for wrapped text (template rows are 15.75 high, so long text would be cut off)
const heightFor = (cells) => {
  const lines = Math.max(
    1,
    ...cells.map(([value, charsPerLine]) =>
      text(value)
        .split("\n")
        .reduce((sum, part) => sum + Math.max(1, Math.ceil(part.length / charsPerLine)), 0),
    ),
  );
  return Math.max(15.75, lines * 15);
};

// If there are more than 15 recipients, the Instructions block is moved down
// and the new rows get the same formatting as row 24. Returns the extra row count.
function makeRoomForRows(ws, count) {
  const extra = Math.max(0, count - TEMPLATE_ROWS);
  if (extra === 0) return 0;

  // 1. Save footer style + value + height in memory (before shifting)
  const footer = [];
  for (let r = FOOTER_START; r <= FOOTER_END; r++) {
    const cells = [];
    for (let c = 1; c <= COLS; c++) {
      const cell = ws.getCell(r, c);
      cells.push({
        value: cell.isMerged ? cell.master.value : cell.value,
        style: JSON.parse(JSON.stringify(cell.style || {})),
      });
    }
    footer.push({ height: ws.getRow(r).height, cells });
  }
  const rowStyle = [];
  for (let c = 1; c <= COLS; c++) {
    rowStyle.push(JSON.parse(JSON.stringify(ws.getCell(LAST_TEMPLATE_ROW, c).style || {})));
  }
  const rowHeight = ws.getRow(LAST_TEMPLATE_ROW).height;

  // 2. Remove the old footer merges (C..G)
  ws.unMergeCells(`A${FOOTER_START + 1}:B${FOOTER_END}`);
  ws.unMergeCells(`C${FOOTER_START + 1}:G${FOOTER_END}`);

  // 3. Clear the old footer rows
  for (let r = FOOTER_START; r <= FOOTER_END; r++) {
    for (let c = 1; c <= COLS; c++) ws.getCell(r, c).value = null;
  }

  // 4. New recipient rows (25 .. 24+extra): same formatting as row 24 + printed Sr. No.
  for (let k = 1; k <= extra; k++) {
    const r = LAST_TEMPLATE_ROW + k;
    for (let c = 1; c <= COLS; c++) ws.getCell(r, c).style = rowStyle[c - 1];
    ws.getCell(r, 1).value = TEMPLATE_ROWS + k;
    ws.getRow(r).height = rowHeight;
  }

  // 5. Put the footer further down (shifted by extra rows) and merge again
  footer.forEach((f, i) => {
    const r = FOOTER_START + extra + i;
    f.cells.forEach((cell, ci) => {
      const target = ws.getCell(r, ci + 1);
      target.style = cell.style;
      target.value = cell.value;
    });
    ws.getRow(r).height = f.height;
  });
  ws.mergeCells(`A${FOOTER_START + extra + 1}:B${FOOTER_END + extra}`);
  ws.mergeCells(`C${FOOTER_START + extra + 1}:G${FOOTER_END + extra}`);

  return extra;
}

/**
 * payload = { customer: {name,email,mobile,company,billing}, rows: [...], instructions }
 * (exactly what BulkOrderForm sends). Returns a Buffer with the filled .xlsx.
 */
export async function buildBulkOrderXlsx(payload) {
  const { customer, rows, instructions } = payload;

  if (!rows?.length) throw new Error("No recipient rows.");
  if (rows.length > MAX_ROWS) throw new Error(`Maximum ${MAX_ROWS} recipients per bulk order.`);

  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(TEMPLATE_PATH); // keeps the logo image, merged cells, colours and widths
  const ws = wb.worksheets[0];

  // Make room first (for more than 15 rows), then fill the data
  const extra = makeRoomForRows(ws, rows.length);

  // 1. Customer block (values go in the merged C:F cells, so write to column C)
  ws.getCell("C3").value = text(customer.name);
  ws.getCell("C4").value = text(customer.email);
  ws.getCell("C5").value = text(customer.mobile);
  ws.getCell("C6").value = text(customer.company);
  ws.getCell("C7").value = text(customer.billing);
  ws.getCell("C7").alignment = { wrapText: true, vertical: "top" };

  // 2. Recipient rows. Column A already holds the printed Sr. No., so we leave it alone.
  rows.forEach((r, i) => {
    const n = FIRST_ROW + i;
    const product = productWithModel(r.product, r.model);

    const set = (col, value) => {
      const cell = ws.getCell(`${col}${n}`);
      cell.value = text(value);
      cell.alignment = { wrapText: true, vertical: "top" };
    };
    set("B", r.recipient);
    set("C", r.address);
    set("D", r.mobile);
    set("E", product); // Product Name - (ModelNo)
    set("F", r.message);
    set("G", r.remarks);

    // chars per line ~ column width in the template
    ws.getRow(n).height = heightFor([
      [r.recipient, 17],
      [r.address, 25],
      [product, 28],
      [r.message, 36],
      [r.remarks, 19],
    ]);
  });

  // 3. Instructions (merged block at the bottom, shifted down when extra rows were added)
  if (instructions) {
    const cell = ws.getCell(`C${FOOTER_START + 1 + extra}`);
    cell.value = text(instructions);
    cell.alignment = { wrapText: true, vertical: "top" };
  }

  return Buffer.from(await wb.xlsx.writeBuffer());
}

export const bulkOrderFileName = (orderNo) =>
  `bulk-order-${String(orderNo).replace(/[^\w-]/g, "")}.xlsx`;