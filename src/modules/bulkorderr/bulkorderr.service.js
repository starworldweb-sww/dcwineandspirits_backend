import { randomInt } from "crypto";
import { DateTime } from "luxon";
import { transporter as defaultTransporter } from "../../config/nodemiller.js";
import { buildBulkOrderXlsx, bulkOrderFileName } from "../../middleware/bulkorderhelper.js";
import { prisma } from '../../../lib/prisma.js';
// NOTE: apne project ke hisaab se path check kar lena
import { hashPassword, generateSalt } from "../customer/customer.service.js";

const MAX_ROWS = 1000;
const BRAND = "DC Wine & Spirits";
const BRAND_COLOR = "#7a1f2b"; 
const SUPPORT_EMAIL = "contact@dcwineandspirits.com";
const ORDER_PREFIX = "DC";

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

/* ----------------------- auto-register (naya account) ---------------------- */

// Confusing characters (0/O, 1/l/I) hata diye hain taaki user password sahi type kar sake
const PASSWORD_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";

// Random password banata hai (12 characters, crypto se secure)
const generateRandomPassword = (length = 12) => {
  let password = "";
  for (let i = 0; i < length; i++) {
    password += PASSWORD_CHARS[randomInt(0, PASSWORD_CHARS.length)];
  }
  // Kam se kam ek letter aur ek number ho, warna dobara banao
  if (!/[A-Za-z]/.test(password) || !/[0-9]/.test(password)) {
    return generateRandomPassword(length);
  }
  return password;
};

// "Rahul Kumar Singh" -> { firstname: "Rahul", lastname: "Kumar Singh" }
// DB mein firstname/lastname 32 chars ke hain, isliye slice(0, 32)
const splitFullName = (fullName) => {
  const parts = String(fullName ?? "").trim().split(/\s+/);
  const firstname = (parts.shift() || "Customer").slice(0, 32);
  const lastname = parts.join(" ").slice(0, 32);
  return { firstname, lastname };
};

/**
 * Agar email se account nahi hai to naya account banata hai.
 *
 * CHANGE 1: ab ye hamesha ek object return karta hai (customerId bhi milta hai)
 *
 * Return:
 *   { customerId, newAccount }
 *   - customerId : customer ki id (pehle se tha ya abhi bana), skip hua to null
 *   - newAccount : { email, password } agar naya account bana, warna null
 *
 * Error throw kar sakta hai, isliye caller ise alag try/catch mein chalaye.
 */
const createCustomerIfNew = async (customer, ip) => {
  // Step 1: email ko wahi format do jo login/register mein use hota hai
  const email = customer.email.toLowerCase().trim();

  // Step 2: oc_customer.email sirf 96 chars ka hai, lamba ho to skip
  if (email.length > 96) return { customerId: null, newAccount: null };

  // Step 3: account pehle se hai to uski id return karo (naya account nahi banega)
  const existingCustomer = await prisma.oc_customer.findFirst({
    where: { email },
    select: { customer_id: true },
  });
  if (existingCustomer) {
    return { customerId: existingCustomer.customer_id, newAccount: null };
  }

  // Step 4: random password banao aur hash karo (DB mein sirf hash jaayega)
  const plainPassword = generateRandomPassword();
  const salt = generateSalt();
  const hashedPassword = hashPassword(plainPassword, salt);
  const { firstname, lastname } = splitFullName(customer.name);

  // Step 5: customer row banao (values wahi hain jo registerCustomer mein hain)
  const newCustomer = await prisma.oc_customer.create({
    data: {
      customer_group_id: 1,
      store_id: 0,
      language_id: 1,
      firstname,
      lastname,
      email,
      telephone: customer.mobile || "",
      fax: "",
      password: hashedPassword,
      salt,
      custom_field: "",
      ip: ip || "0.0.0.0",
      newsletter: false,
      status: true,
      safe: false,
      token: "",
      code: "",
      date_added: new Date(),
      image: "",
    },
  });

  // Step 6: activity log (registerCustomer jaisa hi)
  const newYorkTime = DateTime.now()
    .setZone("America/New_York")
    .toFormat("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'");

  await prisma.oc_customer_activity.create({
    data: {
      customer_id: newCustomer.customer_id || 0,
      key: "register new customer",
      data: JSON.stringify({
        customer_id: newCustomer.customer_id,
        name: `${newCustomer.firstname} ${newCustomer.lastname}`,
      }),
      ip: ip || "0.0.0.0",
      date_added: newYorkTime,
    },
  });

  // Step 7: customerId aur naya account dono return karo
  return {
    customerId: newCustomer.customer_id,
    newAccount: { email, password: plainPassword },
  };
};

/* ----------------------------- customer email ----------------------------- */

const detailRow = (label, value) =>
  value
    ? `<tr>
        <td style="padding:8px 0;color:#6b7280;font-size:14px;width:140px;vertical-align:top;">${esc(label)}</td>
        <td style="padding:8px 0;color:#111827;font-size:14px;font-weight:600;">${esc(value)}</td>
      </tr>`
    : "";

// Naya account bana ho tabhi ye box email mein dikhta hai
const accountBoxHtml = (newAccount) => {
  if (!newAccount) return "";
  const loginUrl = "https://www.dcwineandspirits.com";
  return `
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#fffbeb;border:1px solid #f3e3b3;border-radius:6px;margin:0 0 24px;">
                <tr>
                  <td style="padding:16px 20px;">
                    <p style="margin:0 0 8px;color:#111827;font-size:14px;font-weight:700;">Your account has been created</p>
                    <p style="margin:0 0 12px;color:#374151;font-size:14px;line-height:1.7;">
                      We have created an account for you so you can track your orders. Use the details below to log in.
                    </p>
                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                      ${detailRow("Email", newAccount.email)}
<tr>
  <td style="padding:8px 0;color:#6b7280;font-size:14px;width:140px;vertical-align:top;">Temporary Password</td>
  <td style="padding:8px 0;"><span style="display:inline-block;font-family:Consolas,Menlo,monospace;font-size:15px;font-weight:700;color:#111827;background:#ffffff;border:1px dashed #d1d5db;border-radius:4px;padding:4px 8px;letter-spacing:1px;">${esc(newAccount.password)}</span></td>
</tr>                    </table>
                    <p style="margin:12px 0 0;color:#374151;font-size:13px;line-height:1.7;">
                      For your security, please change this password after logging in.
                      <a href="${esc(loginUrl)}" style="color:${BRAND_COLOR};text-decoration:none;font-weight:600;">Log in to your account</a>
                    </p>
                  </td>
                </tr>
              </table>`;
};

const customerEmailHtml = ({ orderNo, customer, rows, instructions, newAccount }) => `
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

              ${accountBoxHtml(newAccount)}

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

const customerEmailText = ({ orderNo, customer, rows, instructions, newAccount }) =>
  [
    `Dear ${customer.name},`,
    "",
    `Thank you for choosing ${BRAND}. We have received your bulk order request and our team will review it shortly.`,
    "A copy of the submitted Bulk Order Form is attached for your records.",
    "",
    `Order Reference: ${orderNo}`,
    `Total Recipients: ${rows.length}`,
    newAccount
      ? `\nYour account has been created:\nEmail: ${newAccount.email}\nTemporary Password: ${newAccount.password}\nPlease change this password after logging in.`
      : null,
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

/* ----------------------- register (account) email ------------------------ */

// Sirf naya account banne par customer ko jaane wali mail
const registerEmailHtml = ({ customer, newAccount }) => `
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
              <p style="margin:4px 0 0;color:#f3d9dc;font-size:13px;">Account Created</p>
            </td>
          </tr>
          <tr>
            <td style="padding:32px;">
              <p style="margin:0 0 16px;color:#111827;font-size:16px;">Dear ${esc(customer.name)},</p>
              ${accountBoxHtml(newAccount)}
              <p style="margin:0;color:#374151;font-size:14px;line-height:1.7;">
                Warm regards,<br />
                <strong>Team ${BRAND}</strong><br />
                <a href="mailto:${SUPPORT_EMAIL}" style="color:${BRAND_COLOR};text-decoration:none;">${SUPPORT_EMAIL}</a>
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

const registerEmailText = ({ customer, newAccount }) =>
  [
    `Dear ${customer.name},`,
    "",
    "Your account has been created.",
    `Email: ${newAccount.email}`,
    `Temporary Password: ${newAccount.password}`,
    "Please change this password after logging in.",
    "",
    "Warm regards,",
    `Team ${BRAND}`,
    SUPPORT_EMAIL,
  ].join("\n");



// ============================================================
//  Bulk order ko DB mein store karne wala function (sirf DB, email nahi)
//
//  Tables:
//    - bulk_orders_table  -> 1 row  (customer ki info)
//    - bulk_order_item    -> N rows (har recipient ki row)
//
//  Order number DB ke auto-increment id se banta hai: DC-1100, DC-1101, ...
// ============================================================

/**
 * Bulk order DB mein save karta hai.
 *
 * @param {Object} payload  - cleaned data (+ customerId)
 * @returns {Promise<{ bulkOrderId: number, orderNo: string }>}
 * @throws {Error} - DB save fail hone par
 */
// CHANGE 2: customerId ab parameter mein aata hai (default null)
export const saveBulkOrder = async ({ customer, rows, instructions, customerId = null }) => {
  let saved;
  try {
    saved = await prisma.bulkOrder.create({
      data: {
        customerId: customerId || null,
        customerName: customer.name,
        email: customer.email,
        mobileNo: customer.mobile,
        companyName: customer.company || null, 
        billingAddress: customer.billing,
        instruction: instructions || null, 
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
  } catch (error) {
    // Asli Prisma error "cause" mein rehta hai (logs ke liye)
    throw new Error("Failed to save bulk order to the database.", { cause: error });
  }

  // Check karo ki order ID sach mein mila ya nahi
  if (!saved?.bulkOrderId) {
    throw new Error("Bulk order was not saved: no order ID was returned by the database.");
  }

  // DC-1100, DC-1101, ...
  const orderNo = `${ORDER_PREFIX}-${saved.bulkOrderId}`;

  try {
    await prisma.bulkOrder.update({
      where: { bulkOrderId: saved.bulkOrderId },
      data: { sourceFile: bulkOrderFileName(orderNo) },
    });
  } catch (error) {
    throw new Error("Failed to save bulk order reference.", { cause: error });
  }

  return { bulkOrderId: saved.bulkOrderId, orderNo };
};

/* --------------------------------- service -------------------------------- */

// Default is the shared transporter (the parameter is only for tests)
// ip: request ka IP (controller se req.ip pass karo), nahi diya to "0.0.0.0"
export const bulkOrderrService = async (body, transporter = defaultTransporter, ip = "0.0.0.0") => {
  const checked = cleanPayload(body);
  if (checked.error) {
    return { success: false, status: 400, message: checked.error };
  }

  const { customer, rows, instructions } = checked.payload;
  let orderNo;

  try {
    const count = `${rows.length} recipient${rows.length > 1 ? "s" : ""}`;

    // CHANGE 3 - Step 1: Pehle customer banao / dhundo
    // (fail ho jaaye to bhi order rukna nahi chahiye)
    let newAccount = null;
    let customerId = null;
    try {
      const result = await createCustomerIfNew(customer, ip);
      customerId = result?.customerId ?? null;
      newAccount = result?.newAccount ?? null;
    } catch (registerError) {
      console.error("Bulk order auto-register error:", registerError);
    }

    // CHANGE 3 - Step 2: Ab order save karo, customerId ke saath
    try {
      const saved = await saveBulkOrder({ ...checked.payload, customerId });
      orderNo = saved.orderNo;
      console.log("Bulk order saved:", saved.bulkOrderId, orderNo);
    } catch (dbError) {
      console.error("Bulk order DB save error:", dbError, "Cause:", dbError.cause);
      return {
        success: false,
        status: 500,
        message: "Could not save the bulk order. Please try again.",
      };
    }

    try {
      const xlsx = await buildBulkOrderXlsx(checked.payload);

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
        newAccount ? "Account: a new customer account was created for this email." : null,
        instructions ? `\nInstructions:\n${instructions}` : null,
        "",
        "The filled Bulk Order Form is attached.",
      ]
        .filter((l) => l !== null)
        .join("\n");

      try {
        await transporter.sendMail({
          from: `${BRAND} <${SUPPORT_EMAIL}>`,
          to: process.env.BULK_ORDER_TO || SUPPORT_EMAIL,
          replyTo: oneLine(`${customer.name} <${customer.email}>`),
          subject: oneLine(`Bulk order ${orderNo} - ${customer.name} (${count})`),
          text,
          attachments,
        });
      } catch (err) {
        console.error("Bulk order shop mail error:", err);
      }

      try {
        await transporter.sendMail({
          from: `${BRAND} <${SUPPORT_EMAIL}>`,
          to: oneLine(customer.email),
          replyTo: SUPPORT_EMAIL,
          subject: oneLine(`Your Bulk Order ${orderNo} has been received - ${BRAND}`),
          text: customerEmailText({ orderNo, customer, rows, instructions, newAccount }),
          html: customerEmailHtml({ orderNo, customer, rows, instructions, newAccount }),
          attachments,
        });
      } catch (err) {
        console.error("Bulk order customer confirmation error:", err);
      }

      if (newAccount) {
        try {
          await transporter.sendMail({
            from: `${BRAND} <${SUPPORT_EMAIL}>`,
            to: oneLine(customer.email),
            replyTo: SUPPORT_EMAIL,
            subject: oneLine(`Your account has been created - ${BRAND}`),
            text: registerEmailText({ customer, newAccount }),
            html: registerEmailHtml({ customer, newAccount }),
          });
        } catch (err) {
          console.error("Bulk order register email error:", err);
        }
      }
    } catch (emailError) {
      console.error("Bulk order email/xlsx error:", emailError);
    }

    return { success: true, message: "Bulk order received successfully", orderNo };
  } catch (error) {
    console.error("Bulk order error:", error);
    return {
      success: false,
      status: 500,
      message: "Could not process the bulk order. Please try again.",
    };
  }
};