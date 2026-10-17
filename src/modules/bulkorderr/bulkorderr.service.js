import { randomInt } from "crypto";
// CHANGE 1: nodemailer import hata diya, project ka shared transporter import kiya
import { transporter as defaultTransporter } from "../../config/nodemiller.js";
import { buildBulkOrderXlsx, bulkOrderFileName } from "../../middleware/bulkorderhelper.js";

const MAX_ROWS = 1000;

// CHANGE 2: yahan se nodemailer.createTransport({...}) wala block hata diya

/* ------------------------------- validation ------------------------------- */

const str = (v, max) => String(v ?? "").replace(/\r/g, "").trim().slice(0, max);
// one-line fields (name, email, company): line breaks become spaces
const line = (v, max) => str(v, max).replace(/\s*\n\s*/g, " ");
const digits = (v) => String(v ?? "").replace(/\D/g, "");
const phone10 = (v) => {
  let d = digits(v);
  if (d.length === 11 && d.startsWith("1")) d = d.slice(1);
  return d;
};
const EMAIL_RE = /^\S+@\S+\.\S+$/;

const fail = (message) => ({ error: message });

// The frontend checks too, but anyone can call this endpoint, so check again.
// Returns { payload } (cleaned copy) or { error }.
const cleanPayload = (body) => {
  const c = body?.customer || {};
  const customer = {
    name: line(c.name, 100),
    email: line(c.email, 150),
    mobile: phone10(c.mobile),
    company: line(c.company, 150),
    billing: str(c.billing, 400),
  };
  if (!customer.name) return fail("Name is required");
  if (!EMAIL_RE.test(customer.email)) return fail("Enter a valid email");
  if (customer.mobile.length < 10) return fail("Enter a valid mobile number (min. 10 digits)");
  if (!customer.billing) return fail("Billing address is required");


  const rawRows = Array.isArray(body?.rows) ? body.rows : [];
  if (rawRows.length === 0) return fail("Add at least one recipient");
  if (rawRows.length > MAX_ROWS) return fail(`Maximum ${MAX_ROWS} recipients per bulk order`);

  const rows = [];
  for (let i = 0; i < rawRows.length; i++) {
    const r = rawRows[i];
    const row = {
      srNo: i + 1,
      recipient: line(r?.recipient, 100),
      address: str(r?.address, 300),
      mobile: r?.mobile ? phone10(r.mobile) : "",
      product: str(r?.product, 200),
      message: str(r?.message, 500),
      remarks: str(r?.remarks, 300),
    };
    if (!row.recipient || !row.address || !row.product)
      return fail(`Row ${i + 1}: recipient, address and product are required`);
    if (row.mobile && row.mobile.length !== 10)
      return fail(`Row ${i + 1}: mobile must be 10 digits`);
    rows.push(row);
  }

  return { payload: { customer, rows, instructions: str(body?.instructions, 2000) } };
};

/* --------------------------------- helpers -------------------------------- */

// No database, so the number is date + random digits, e.g. BO-20261017-4821
const makeOrderNo = () => {
  const d = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  return `BO-${d}-${randomInt(1000, 10000)}`;
};

// Header values must be a single line
const oneLine = (v) => String(v).replace(/[\r\n]+/g, " ");

/* --------------------------------- service -------------------------------- */

// CHANGE 3: default ab shared transporter hai (parameter sirf tests ke liye hai)
export const bulkOrderrService = async (body, transporter = defaultTransporter) => {
  const checked = cleanPayload(body);
  if (checked.error) {
    return { success: false, status: 400, message: checked.error };
  }

  const { customer, rows, instructions } = checked.payload;
  const orderNo = makeOrderNo();

  try {
    const xlsx = await buildBulkOrderXlsx(checked.payload);
    const count = `${rows.length} recipient${rows.length > 1 ? "s" : ""}`;

    const text = [
      `New bulk order ${orderNo}`,
      "",
      `Name: ${customer.name}`,
      `E-Mail: ${customer.email}`,
      `Mobile: ${customer.mobile}`,
      customer.company ? `Company: ${customer.company}` : null,
      `Recipients: ${rows.length}`,
      instructions ? `\nInstructions:\n${instructions}` : null,
      "",
      "The filled Bulk Order Form is attached.",
    ]
      .filter((l) => l !== null)
      .join("\n");

    await transporter.sendMail({
      // CHANGE 4: hardcoded from (contact module jaisa), MAIL_FROM / SMTP_USER ki zaroorat nahi
      from: "DC Wine & Spirits <contact@dcwineandspirits.com>",
      to: process.env.BULK_ORDER_TO || "contact@dcwineandspirits.com",
      replyTo: oneLine(`${customer.name} <${customer.email}>`),
      subject: oneLine(`Bulk order ${orderNo} - ${customer.name} (${count})`),
      text,
      attachments: [
        {
          filename: bulkOrderFileName(orderNo),
          content: xlsx,
          contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        },
      ],
    });

    return { success: true, message: "Bulk order sent successfully", orderNo };
  } catch (error) {
    console.error("Bulk order email error:", error);
    return {
      success: false,
      status: 500,
      message: "Could not send the bulk order. Please try again.",
    };
  }
};