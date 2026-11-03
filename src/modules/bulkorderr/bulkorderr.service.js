import { randomInt } from "crypto";
import { transporter as defaultTransporter } from "../../config/nodemiller.js";
import { buildBulkOrderXlsx, bulkOrderFileName } from "../../middleware/bulkorderhelper.js";
import { prisma } from '../../../lib/prisma.js';

const MAX_ROWS = 1000;
const BRAND = "DC Wine & Spirits";
const BRAND_COLOR = "#7a1f2b"; 
const SUPPORT_EMAIL = "contact@dcwineandspirits.com";

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
      model: line(r?.model, 100),
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

// Order number is date + random digits, e.g. BO-20261017-4821
const makeOrderNo = () => {
  const d = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  return `BO-${d}-${randomInt(1000, 10000)}`;
};

// Header values must be a single line
const oneLine = (v) => String(v).replace(/[\r\n]+/g, " ");

// Escape user input before putting it in HTML
const esc = (v) =>
  String(v ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

/* ----------------------------- customer email ----------------------------- */

const detailRow = (label, value) =>
  value
    ? `<tr>
        <td style="padding:8px 0;color:#6b7280;font-size:14px;width:140px;vertical-align:top;">${esc(label)}</td>
        <td style="padding:8px 0;color:#111827;font-size:14px;font-weight:600;">${esc(value)}</td>
      </tr>`
    : "";

const customerEmailHtml = ({ orderNo, customer, rows, instructions }) => `
<!DOCTYPE html>
<html lang="en">
<body style="margin:0;padding:0;background:#f4f4f5;font-family:Arial,Helvetica,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;padding:24px 12px;">
    <tr>
      <td align="center">
        <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#ffffff;border-radius:8px;overflow:hidden;">
          <tr>
            <td style="background:${BRAND_COLOR};padding:24px 32px;">
              <h1 style="margin:0;color:#ffffff;font-size:22px;font-weight:700;">${BRAND}</h1>
              <p style="margin:4px 0 0;color:#f3d9dc;font-size:13px;">Bulk Order Confirmation</p>
            </td>
          </tr>
          <tr>
            <td style="padding:32px;">
              <p style="margin:0 0 16px;color:#111827;font-size:16px;">Dear ${esc(customer.name)},</p>
              <p style="margin:0 0 16px;color:#374151;font-size:14px;line-height:1.7;">
                Thank you for choosing ${BRAND}. We have received your bulk order request and our team
                will review it shortly. A copy of the submitted Bulk Order Form is attached to this email for your records.
              </p>

              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#faf5f5;border:1px solid #eadada;border-radius:6px;margin:24px 0;">
                <tr>
                  <td style="padding:16px 20px;">
                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                      ${detailRow("Order Reference", orderNo)}
                      ${detailRow("Name", customer.name)}
                      ${detailRow("Email", customer.email)}
                      ${detailRow("Mobile", customer.mobile)}
                      ${detailRow("Company", customer.company)}
                      ${detailRow("Total Recipients", String(rows.length))}
                    </table>
                  </td>
                </tr>
              </table>

              ${
                instructions
                  ? `<p style="margin:0 0 6px;color:#111827;font-size:14px;font-weight:700;">Your Instructions</p>
                     <p style="margin:0 0 24px;color:#374151;font-size:14px;line-height:1.7;white-space:pre-line;">${esc(instructions)}</p>`
                  : ""
              }

              <p style="margin:0 0 8px;color:#111827;font-size:14px;font-weight:700;">What happens next?</p>
              <ol style="margin:0 0 24px;padding-left:20px;color:#374151;font-size:14px;line-height:1.8;">
                <li>Our team will verify the recipient details and product availability.</li>
                <li>We will contact you to confirm pricing, delivery timelines and payment.</li>
                <li>Once confirmed, your order will be processed and dispatched.</li>
              </ol>

              <p style="margin:0 0 24px;color:#374151;font-size:14px;line-height:1.7;">
                If you notice any error in the attached form, please reply to this email quoting your order reference
                <strong>${esc(orderNo)}</strong> and we will be glad to assist you.
              </p>

              <p style="margin:0;color:#374151;font-size:14px;line-height:1.7;">
                Warm regards,<br />
                <strong>Team ${BRAND}</strong><br />
                <a href="mailto:${SUPPORT_EMAIL}" style="color:${BRAND_COLOR};text-decoration:none;">${SUPPORT_EMAIL}</a>
              </p>
            </td>
          </tr>
          <tr>
            <td style="background:#f9fafb;padding:16px 32px;border-top:1px solid #e5e7eb;">
              <p style="margin:0;color:#9ca3af;font-size:12px;line-height:1.6;text-align:center;">
                This is an automated confirmation of your bulk order request. Please do not share your order details with unauthorised persons.<br />
                &copy; ${new Date().getFullYear()} ${BRAND}. All rights reserved.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

const customerEmailText = ({ orderNo, customer, rows, instructions }) =>
  [
    `Dear ${customer.name},`,
    "",
    `Thank you for choosing ${BRAND}. We have received your bulk order request and our team will review it shortly.`,
    "A copy of the submitted Bulk Order Form is attached for your records.",
    "",
    `Order Reference: ${orderNo}`,
    `Total Recipients: ${rows.length}`,
    instructions ? `\nYour Instructions:\n${instructions}` : null,
    "",
    "What happens next?",
    "1. Our team will verify the recipient details and product availability.",
    "2. We will contact you to confirm pricing, delivery timelines and payment.",
    "3. Once confirmed, your order will be processed and dispatched.",
    "",
    `If you notice any error, please reply to this email quoting ${orderNo}.`,
    "",
    "Warm regards,",
    `Team ${BRAND}`,
    SUPPORT_EMAIL,
  ]
    .filter((l) => l !== null)
    .join("\n");

/* --------------------------------- database -------------------------------- */

// ============================================================
//  Bulk order ko DB mein store karne wala function (sirf DB, email nahi)
//
//  Tables:
//    - bulk_orders_table  -> 1 row  (customer ki info)
//    - bulk_order_item    -> N rows (har recipient ki row)
//
//  Dono ek hi query (transaction) mein save hote hain:
//  ya sab save hoga ya kuch nahi.
// ============================================================

/**
 * Bulk order DB mein save karta hai.
 *
 * @param {Object} payload  - cleaned data, is shape mein:
 *   {
 *     customer: { name, email, mobile, company, billing },
 *     rows: [{ srNo, recipient, address, mobile, product, model, message, remarks }]
 *   }
 * @param {string} [sourceFile] - Excel file ka naam / order ref (optional)
 * @returns {Promise<{ bulkOrderId: number }>} - naye order ka id
 */
export const saveBulkOrder = async ({ customer, rows }, sourceFile = null) => {
  return prisma.bulkOrder.create({
    data: {
      // 1) Customer ki info -> bulk_orders_table
      customerName: customer.name,
      email: customer.email,
      mobileNo: customer.mobile,
      companyName: customer.company || null, // khaali ho to null
      billingAddress: customer.billing,
      sourceFile, // optional
      // status DB ka default "pending" hi rahega

      // 2) Saari recipient rows -> bulk_order_item
      items: {
        createMany: {
          data: rows.map((row, index) => ({
            srNo: row.srNo ?? index + 1,
            recipientName: row.recipient,
            shippingAddress: row.address,
            mobileNo: row.mobile || null,
            productInput: row.product,
            modelNo: row.model ? row.model.slice(0, 64) : null, // DB column 64 chars ka hai
            message: row.message || null,
            remarks: row.remarks || null,
          })),
        },
      },
    },
    select: { bulkOrderId: true },
  });
};

/* --------------------------------- service -------------------------------- */

// Default is the shared transporter (the parameter is only for tests)
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

    // ✨ NEW: DB mein save karo (email se pehle, taaki email fail ho tab bhi order record rahe)
    // Save fail hua to email nahi jayegi aur customer ko error milega.
    try {
      const saved = await saveBulkOrder(checked.payload, bulkOrderFileName(orderNo));
      console.log("Bulk order saved, id:", saved.bulkOrderId);
    } catch (dbError) {
      console.error("Bulk order DB save error:", dbError);
      return {
        success: false,
        status: 500,
        message: "Could not save the bulk order. Please try again.",
      };
    }

    // Same file is attached to both the shop mail and the customer mail
    const attachments = [
      {
        filename: bulkOrderFileName(orderNo),
        content: xlsx,
        contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      },
    ];

    const text = [
      `New Online bulk order ${orderNo}`,
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

    // 1) Mail to the shop
    await transporter.sendMail({
      from: `${BRAND} <${SUPPORT_EMAIL}>`,
      to: process.env.BULK_ORDER_TO || SUPPORT_EMAIL,
      replyTo: oneLine(`${customer.name} <${customer.email}>`),
      subject: oneLine(`Bulk order ${orderNo} - ${customer.name} (${count})`),
      text,
      attachments,
    });

    // 2) Confirmation copy to the customer. A failure here must not fail the
    // order, because the shop has already received it.
    try {
      await transporter.sendMail({
        from: `${BRAND} <${SUPPORT_EMAIL}>`,
        to: oneLine(customer.email),
        replyTo: SUPPORT_EMAIL,
        subject: oneLine(`Your Bulk Order ${orderNo} has been received - ${BRAND}`),
        text: customerEmailText({ orderNo, customer, rows, instructions }),
        html: customerEmailHtml({ orderNo, customer, rows, instructions }),
        attachments,
      });
    } catch (err) {
      console.error("Bulk order customer confirmation error:", err);
    }

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