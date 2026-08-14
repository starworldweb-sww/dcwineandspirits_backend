
import { DateTime } from "luxon";
import { prisma } from "../../../lib/prisma.js";
import { ORDER_STATUS } from "../../utils/orderStatus.js";
import { registerCustomer } from "../customer/customer.service.js";
import { createAddressServices } from "../customer Address/customerAddress.service.js";
import Stripe from 'stripe';
import { transporter } from "../../config/nodemiller.js";
import { generateOrderConfirmationEmail } from "../../utils/orderConfrmationemail.js";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

// ─── Constants ────────────────────────────────────────────────
const MAX_META_VALUE_LEN = 500;
const STORE_NAME = process.env.STORE_NAME ?? "";
const STORE_URL = process.env.STORE_URL ?? "";

// ─── Helpers ──────────────────────────────────────────────────

const isValidEmail = (email) =>
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email || ""));

const formatMoney = (cents, currency = "usd") => {
  const amount = ((cents ?? 0) / 100).toFixed(2);
  return currency === "usd" ? `$${amount}` : `${currency.toUpperCase()} ${amount}`;
};

const buildTotals = (products, shippingCost = 0) => {
  const subTotal = products.reduce(
    (sum, p) => sum + parseFloat(p.price) * parseInt(p.quantity),
    0
  );
  const totals = [
    { code: "sub_total", title: "Sub-Total", value: subTotal, sort_order: 1 },
  ];
  if (shippingCost > 0) {
    totals.push({ code: "shipping", title: "Flat Shipping Rate", value: shippingCost, sort_order: 3 });
  }
  totals.push({ code: "total", title: "Total", value: subTotal + shippingCost, sort_order: 9 });
  return { totals, grandTotal: subTotal + shippingCost };
};

const buildStripeMetadata = ({ orderId, firstname, lastname, email, telephone, customer_id, ip, products = [], store_name = "", comment = "" }) => {
  const customerInfo = [`${firstname || ""} ${lastname || ""}`.trim(), email || "", telephone || "", `customer_id: ${customer_id || 0}`]
    .filter(Boolean).join(", ");

  const productsStr = products
    .map((p) => {
      const opts = (p.option ?? p.options ?? []).map((o) => `${o.option_name}: ${o.value}`).join(" | ");
      return `${p.name} x${p.quantity}${opts ? ` (${opts})` : ""}`;
    })
    .join(", ");

  const meta = {
    "Customer Info": customerInfo.slice(0, MAX_META_VALUE_LEN),
    "IP Address": (ip || "").slice(0, MAX_META_VALUE_LEN),
    order_id: String(orderId),
    Products: productsStr.slice(0, MAX_META_VALUE_LEN),
    Store: (store_name || STORE_NAME).slice(0, MAX_META_VALUE_LEN),
    time: String(Math.floor(Date.now() / 1000)),
  };
  if (comment) meta["Order Comment"] = String(comment).slice(0, MAX_META_VALUE_LEN);
  return meta;
};

// ─── Transaction detail comment (HTML — mirrors Stripe charge detail panel + refund button) ──
const escapeHtml = (str) =>
  String(str ?? "").replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  }[c]));

// ─── Design tokens ──────────────────────────────────────────
const COLORS = {
  label: "#6b7280",
  value: "#111827",
  border: "#e5e7eb",
  headBg: "#f9fafb",
  green: "#16a34a", greenBg: "#dcfce7",
  red: "#dc2626", redBg: "#fee2e2",
  amber: "#d97706", amberBg: "#fef3c7",
  gray: "#6b7280", grayBg: "#f3f4f6",
  link: "#2563eb",
};

const wrap = (inner) =>
  `<table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;max-width:520px;border:1px solid ${COLORS.border};border-radius:8px;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;font-size:13px;color:${COLORS.value};border-collapse:separate;overflow:hidden;">${inner}</table>`;

const sectionHead = (title) =>
  `<tr><td colspan="2" style="background:${COLORS.headBg};padding:8px 14px;font-weight:700;font-size:11px;letter-spacing:.04em;text-transform:uppercase;color:${COLORS.label};border-bottom:1px solid ${COLORS.border};border-top:1px solid ${COLORS.border};">${title}</td></tr>`;

const row = (label, valueHtml) => `
  <tr>
    <td style="padding:7px 14px;color:${COLORS.label};width:150px;vertical-align:top;white-space:nowrap;">${label}</td>
    <td style="padding:7px 14px;vertical-align:top;">${valueHtml}</td>
  </tr>`;

const badge = (text, color, bg) =>
  `<span style="display:inline-block;padding:2px 9px;border-radius:99px;font-size:11px;font-weight:600;color:${color};background:${bg};">${text}</span>`;

const checkBadge = (status) => {
  if (status === "pass") return badge("Passed", COLORS.green, COLORS.greenBg);
  if (status === "fail") return badge("Failed", COLORS.red, COLORS.redBg);
  if (status === "unavailable") return badge("Unavailable", COLORS.gray, COLORS.grayBg);
  return badge("Not checked", COLORS.gray, COLORS.grayBg);
};

const riskBadge = (level) => {
  const map = {
    normal: [COLORS.green, COLORS.greenBg, "Normal"],
    elevated: [COLORS.amber, COLORS.amberBg, "Elevated"],
    highest: [COLORS.red, COLORS.redBg, "Highest"],
  };
  const [color, bg, text] = map[level] ?? [COLORS.gray, COLORS.grayBg, level ?? "Unknown"];
  return badge(text, color, bg);
};

// ─── Main builder ───────────────────────────────────────────
const buildTransactionComment = (pi) => {
  const charge = pi?.latest_charge;

  if (!charge) {
    return `
<div style="max-width:520px;border:1px solid #e5e7eb;border-radius:8px;font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif;font-size:13px;color:#111827;overflow:hidden;">
  <div style="background:#f9fafb;padding:10px 14px;font-weight:700;border-bottom:1px solid #e5e7eb;">
    PAYMENT
  </div>

  <div style="padding:12px 14px;">
    <div><strong style="display:inline-block;width:140px;">Status</strong>${badge("Authorized & Captured", COLORS.green, COLORS.greenBg)}</div>
    <div style="margin-top:8px;">
      <strong style="display:inline-block;width:140px;">Payment ID</strong>
      <span style="font-family:monospace;">${escapeHtml(pi.id)}</span>
    </div>
  </div>
</div>`;
  }

  const card = charge.payment_method_details?.card ?? {};
  const checks = card.checks ?? {};
  const billing = charge.billing_details ?? {};
  const addr = billing.address ?? {};
  const fee = charge.balance_transaction?.fee;

  const feeStr =
    fee != null
      ? `<span style="color:#6b7280;"> (Fee ${formatMoney(fee, charge.currency)})</span>`
      : "";

  const billingHtml = [
    billing.name,
    addr.line1,
    addr.line2,
    [addr.city, addr.state, addr.postal_code].filter(Boolean).join(", "),
    addr.country,
  ]
    .filter(Boolean)
    .join("<br>");

  const cardType = card.brand
    ? card.brand.charAt(0).toUpperCase() + card.brand.slice(1)
    : "N/A";

  const threeDSecure = card.three_d_secure
    ? badge(card.three_d_secure.result ?? "Checked", COLORS.green, COLORS.greenBg)
    : badge("Not checked", COLORS.gray, COLORS.grayBg);

  return `
<div style="max-width:520px;border:1px solid #e5e7eb;border-radius:8px;font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif;font-size:13px;color:#111827;overflow:hidden;">

  <div style="background:#f9fafb;padding:10px 14px;font-weight:700;border-bottom:1px solid #e5e7eb;">
    PAYMENT
  </div>

  <div style="padding:12px 14px;line-height:1.8;">
    <div>
      <strong style="display:inline-block;width:140px;">Payment ID</strong>
      <a target="_blank"
         href="https://dashboard.stripe.com/payments/${charge.payment_intent ?? pi.id}"
         style="color:#2563eb;text-decoration:none;font-family:monospace;">
         ${escapeHtml(pi.id)}
      </a>
    </div>

    <div>
      <strong style="display:inline-block;width:140px;">Amount</strong>
      <strong>${formatMoney(charge.amount, charge.currency)}</strong>${feeStr}
    </div>

    <div>
      <strong style="display:inline-block;width:140px;">Captured</strong>
      ${charge.captured
      ? badge("Yes", COLORS.green, COLORS.greenBg)
      : badge("No", COLORS.red, COLORS.redBg)}
    </div>
  </div>

  <div style="background:#f9fafb;padding:10px 14px;font-weight:700;border-top:1px solid #e5e7eb;border-bottom:1px solid #e5e7eb;">
    BILLING DETAILS
  </div>

  <div style="padding:12px 14px;">
    ${billingHtml}
  </div>

  <div style="background:#f9fafb;padding:10px 14px;font-weight:700;border-top:1px solid #e5e7eb;border-bottom:1px solid #e5e7eb;">
    CARD
  </div>

  <div style="padding:12px 14px;line-height:1.8;">
    <div><strong style="display:inline-block;width:140px;">Type</strong>${cardType} •••• ${card.last4 ?? "----"}</div>
    <div><strong style="display:inline-block;width:140px;">Expiry</strong>${String(card.exp_month).padStart(2, "0")} / ${card.exp_year}</div>
    <div><strong style="display:inline-block;width:140px;">Origin</strong>${card.country ?? "N/A"}</div>
  </div>

  <div style="background:#f9fafb;padding:10px 14px;font-weight:700;border-top:1px solid #e5e7eb;border-bottom:1px solid #e5e7eb;">
    SECURITY CHECKS
  </div>

  <div style="padding:12px 14px;line-height:1.8;">
    <div><strong style="display:inline-block;width:140px;">CVC</strong>${checkBadge(checks.cvc_check)}</div>
    <div><strong style="display:inline-block;width:140px;">Street</strong>${checkBadge(checks.address_line1_check)}</div>
    <div><strong style="display:inline-block;width:140px;">Postcode</strong>${checkBadge(checks.address_postal_code_check)}</div>
    <div><strong style="display:inline-block;width:140px;">3D Secure</strong>${threeDSecure}</div>
    <div><strong style="display:inline-block;width:140px;">Risk Level</strong>${riskBadge(charge.outcome?.risk_level)}</div>
  </div>

</div>`.replace(/\n\s*/g, "");
};
const STRIPE_PI_EXPAND = [
  "latest_charge",
  "latest_charge.balance_transaction",
  "latest_charge.payment_method_details",
];

// ─── Post-payment registration (webhook uses this too) ────────
export const handlePostPaymentRegistration = async (orderId, checkoutType, registerData, addressData, ip) => {
  if (checkoutType !== "register" || !registerData) return;
  const { email, password, firstname, lastname, telephone } = registerData;

  let customerDetails = await prisma.oc_customer.findFirst({
    where: { email: registerData.email?.toLowerCase().trim() },
  });

  if (!customerDetails) {
    await registerCustomer(registerData, ip);
    customerDetails = await prisma.oc_customer.findFirst({
      where: { email: registerData.email?.toLowerCase().trim() },
    });
  }

  if (customerDetails) {
    // Run order update + address creation in parallel
    await Promise.all([
      prisma.oc_order.update({
        where: { order_id: orderId },
        data: { customer_id: customerDetails.customer_id },
      }),
      addressData?.country_id && addressData?.zone_id
        ? createAddressServices(customerDetails.customer_id, addressData).catch((e) =>
          console.log("Failed to create address after payment:", e.message)
        )
        : Promise.resolve(),
    ]);
  }

  return customerDetails;
};

// ─── Build order products inside a transaction ────────────────
const insertOrderProducts = async (tx, order_id, products) => {
  // Create all products in parallel (each with its options)
  await Promise.all(
    products.map(async (product) => {
      const orderProduct = await tx.oc_order_product.create({
        data: {
          order_id,
          product_id: parseInt(product.product_id),
          name: product.name,
          model: product.model,
          quantity: parseInt(product.quantity),
          price: parseFloat(product.price),
          total: parseFloat(product.total ?? product.price * product.quantity),
          tax: parseFloat(product.tax ?? 0),
          reward: parseInt(product.reward ?? 0),
        },
      });

      const optionList = product.option ?? product.options ?? [];
      if (optionList.length > 0) {
        await tx.oc_order_option.createMany({
          data: optionList.map((option) => ({
            order_id,
            order_product_id: orderProduct.order_product_id,
            product_option_id: parseInt(option.option_id),
            product_option_value_id: parseInt(option.option_value_id ?? 0),
            name: option.option_name,
            value: String(option.value),
            type: option.type,
          })),
        });
      }
    })
  );
};

// ─── Main placeOrderService ────────────────────────────────────
export const placeOrderService = async (orderData) => {
  const {
    invoice_prefix = "INV-2022-00", store_id = 0, store_name = "", store_url = "",
    customer_id = 0, customer_group_id = 1,
    firstname, lastname, email, telephone, custom_field = {},
    payment_firstname, payment_lastname, payment_company = "",
    payment_address_1, payment_address_2 = "", payment_city,
    payment_postcode = "", payment_zone, payment_zone_id,
    payment_country, payment_country_id,
    payment_address_format = "", payment_custom_field = {},
    payment_method, payment_code,
    shipping_firstname = "", shipping_lastname = "", shipping_company = "",
    shipping_address_1 = "", shipping_address_2 = "", shipping_city = "",
    shipping_postcode = "", shipping_zone = "", shipping_zone_id = 0,
    shipping_country = "", shipping_country_id = 0,
    shipping_address_format = "", shipping_custom_field = {},
    shipping_method = "", shipping_code = "",
    products = [], totals = null, comment = "",
    affiliate_id = 0, commission = 0, marketing_id = 0, tracking = "",
    language_id = 1, currency_id = 1, currency_code = "USD", currency_value = 1.0,
    ip = "", forwarded_ip = "", user_agent = "", accept_language = "",
    shipping_cost = 0,
    missing_order_id = null,
    checkoutType = null, registerData = null, addressData = null,
    stripe_payment_intent_id = null, stripe_client_secret = null,
    coupon_id = "",
    discountAmount = 0,

  } = orderData;

  console.log("Ip",ip)

  const finalFirstname = firstname || payment_firstname;
  const finalLastname = lastname || payment_lastname;
  const finalEmail = email || "";
  const finalTelephone = telephone || "";

  // const newYorkTime = DateTime.now().setZone("America/New_York").toJSDate();
  const newYorkTime = DateTime.now()
    .setZone("America/New_York")
    .toFormat("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'");
  const checkoutData = { checkoutType, registerData, addressData, ip };
  const customFieldString = JSON.stringify({ ...custom_field, checkoutData });

  const { totals: builtTotals, grandTotal } = totals
    ? { totals, grandTotal: totals.find((t) => t.code === "total")?.value ?? 0 }
    : buildTotals(products, shipping_cost);
  
  const orderFields = {
    customer_id, customer_group_id,
    firstname: finalFirstname, lastname: finalLastname,
    email: finalEmail, telephone: finalTelephone,
    custom_field: customFieldString,
    payment_firstname, payment_lastname, payment_company,
    payment_address_1, payment_address_2, payment_city, payment_postcode,
    payment_zone, payment_zone_id, payment_country, payment_country_id,
    payment_address_format,
    payment_custom_field: JSON.stringify(payment_custom_field),
    payment_method, payment_code,
    shipping_firstname, shipping_lastname, shipping_company,
    shipping_address_1, shipping_address_2, shipping_city, shipping_postcode,
    shipping_zone, shipping_zone_id, shipping_country, shipping_country_id,
    shipping_address_format,
    shipping_custom_field: JSON.stringify(shipping_custom_field),
    shipping_method, shipping_code,
    comment, total: grandTotal, order_status_id: 0,
    language_id, currency_id, currency_code, currency_value, ip,
    store_name: store_name || STORE_NAME,
    store_url: store_url || STORE_URL,
    date_modified: newYorkTime,
  };
  
  const metaArgs = {
    firstname: finalFirstname, lastname: finalLastname,
    email: finalEmail, telephone: finalTelephone,
    customer_id, ip, products, store_name, comment,
  };

  // ═══════════════════════════════════════════════════════════
  // CASE 1: UPDATE existing missing order
  // ═══════════════════════════════════════════════════════════
  if (missing_order_id && stripe_payment_intent_id && stripe_client_secret) {
    const parsedOrderId = parseInt(missing_order_id);

    const existingOrder = await prisma.oc_order.findUnique({
      where: { order_id: parsedOrderId },
      select: { order_id: true, order_status_id: true },
    });

    if (existingOrder?.order_status_id === 0) {
      const [result] = await Promise.all([
        prisma.$transaction(async (tx) => {
          await tx.oc_order.update({ where: { order_id: parsedOrderId }, data: orderFields });

          const oldProducts = await tx.oc_order_product.findMany({
            where: { order_id: parsedOrderId },
            select: { order_product_id: true },
          });
          const oldIds = oldProducts.map((p) => p.order_product_id);

          await Promise.all([
            oldIds.length
              ? tx.oc_order_option.deleteMany({ where: { order_id: parsedOrderId, order_product_id: { in: oldIds } } })
              : Promise.resolve(),
            tx.oc_order_product.deleteMany({ where: { order_id: parsedOrderId } }),
            tx.oc_order_total.deleteMany({ where: { order_id: parsedOrderId } }),
          ]);

          await Promise.all([
            insertOrderProducts(tx, parsedOrderId, products),
            tx.oc_order_total.createMany({
              data: builtTotals.map((t) => ({
                order_id: parsedOrderId,
                code: t.code,
                title: t.title,
                value: parseFloat(t.value),
                sort_order: parseInt(t.sort_order),
              })),
            }),
          ]);

          return { order_id: parsedOrderId, total: grandTotal };
        }),
      ]);


      try {
        const pi = await stripe.paymentIntents.retrieve(stripe_payment_intent_id, {
          expand: STRIPE_PI_EXPAND,
        });

        const updateData = {
          description: `${STORE_NAME}: Order #${parsedOrderId}`,
          metadata: buildStripeMetadata({ orderId: parsedOrderId, ...metaArgs }),
          receipt_email: isValidEmail(finalEmail) ? finalEmail : undefined
        };
        if (pi.status !== "succeeded") {
          updateData.amount = Math.round(grandTotal * 100);
        }

        await stripe.paymentIntents.update(stripe_payment_intent_id, updateData);

        result.stripe_client_secret = pi.client_secret;
        result.stripe_payment_intent_id = pi.id;

        if (pi.status === "succeeded") {
          const postPaymentTasks = [
            prisma.oc_order.update({
              where: { order_id: result.order_id },
              data: { order_status_id: ORDER_STATUS.PROCESSED, date_modified: newYorkTime },
            }),
            // Row 1: customer-facing "order successful" notification
            prisma.oc_order_history.create({
              data: {
                order_id: result.order_id,
                order_status_id: ORDER_STATUS.PROCESSED,
                notify: true,
                comment: "The card transaction was authorized and subsequently captured (i.e., completed).",
                date_added: newYorkTime,
              },
            }),
            // Row 2: admin-only transaction detail (HTML + refund button) — no customer notification
            prisma.oc_order_history.create({
              data: {
                order_id: result.order_id,
                order_status_id: ORDER_STATUS.PROCESSED,
                notify: false,
                comment: buildTransactionComment(pi),
                date_added: newYorkTime,
              },
            }),
            prisma.oc_customer_activity.create({
              data: {
                customer_id: customer_id || 0,
                key: checkoutType == "login" ? "order_account" : checkoutType == "guest" ? "order_guest" : "register",
                data: JSON.stringify({
                  "name": `${firstname} ${lastname}`,
                  "order_id": result?.order_id,
                }),
                ip: ip,
                date_added: newYorkTime
              }
            }),
          ];


          if (coupon_id) {
            postPaymentTasks.push(
              prisma.oc_coupon_history.create({
                data: {
                  coupon_id: Number(coupon_id),
                  order_id: result.order_id,
                  customer_id: customer_id || 0,
                  amount: discountAmount,
                  date_added: newYorkTime
                }
              })
            );
          }

          await Promise.all(postPaymentTasks);

          await Promise.all([
            _sendConfirmationEmails({
              result,
              ...buildEmailArgs(orderData, products, builtTotals, newYorkTime),
            }),

            (async () => {
              const customerDetails = await handlePostPaymentRegistration(
                parseInt(result.order_id),
                checkoutType,
                registerData,
                addressData,
                ip
              );

              if (customerDetails && stripe_payment_intent_id) {
                const metadataPayload = buildStripeMetadata({
                  orderId: parsedOrderId,
                  firstname: finalFirstname,
                  lastname: finalLastname,
                  email: finalEmail,
                  telephone: finalTelephone,
                  customer_id: customerDetails.customer_id,
                  ip,
                  products,
                  store_name,
                  comment,
                });

                await stripe.paymentIntents.update(stripe_payment_intent_id, {
                  metadata: metadataPayload,
                });
              }
            })(),
          ]).catch((e) =>
            console.error("Post-payment tasks failed:", e.message)
          );
        }
      } catch (e) {
        console.error("Stripe update (missing order) failed:", e.message);
      }

      return result;
    }
  }

  // ═══════════════════════════════════════════════════════════
  // CASE 2: CREATE new order
  // ═══════════════════════════════════════════════════════════
  const result = await prisma.$transaction(async (tx) => {
    const order = await tx.oc_order.create({
      data: {
        invoice_no: 0, invoice_prefix, store_id, fax: "",
        hprmp_repetition: 0, hprmp_active: false, hprmp_last_send: null,
        affiliate_id, commission, marketing_id, tracking,
        forwarded_ip, user_agent, accept_language,
        date_added: newYorkTime,
        ...orderFields,
      },
    });



    await Promise.all([
      insertOrderProducts(tx, order.order_id, products),
      tx.oc_order_total.createMany({
        data: builtTotals.map((t) => ({
          order_id: order.order_id,
          code: t.code,
          title: t.title,
          value: parseFloat(t.value),
          sort_order: parseInt(t.sort_order),
        })),
      }),
    ]);



    return { order_id: order.order_id, total: grandTotal };
  });

  // ── Stripe: update existing PI (fire and forget) ──
  // ── Stripe: update existing PI (ab AWAIT karo) ──
  if (stripe_payment_intent_id) {
    try {
      const pi = await stripe.paymentIntents.retrieve(stripe_payment_intent_id);
      const updateData = {
        description: `${STORE_NAME}: Order #${result.order_id}`,
        metadata: buildStripeMetadata({ orderId: result.order_id, ...metaArgs }),
      };
      if (pi.status !== "succeeded") updateData.amount = Math.round(grandTotal * 100);
      const updatedPi = await stripe.paymentIntents.update(stripe_payment_intent_id, updateData);

      result.stripe_client_secret = updatedPi.client_secret;
      result.stripe_payment_intent_id = updatedPi.id;
    } catch (e) {
      console.error("Stripe update (existing PI) failed:", e.message);
    }
  } else if (payment_code !== "cod") {
    try {
      const pi = await stripe.paymentIntents.create({
        amount: Math.round(grandTotal * 100),
        currency: "usd",
        receipt_email: isValidEmail(finalEmail) ? finalEmail : undefined,
        description: `${STORE_NAME}: Order #${result.order_id}`,
        metadata: buildStripeMetadata({ orderId: result.order_id, ...metaArgs }),
        automatic_payment_methods: { enabled: true },
      });

      result.stripe_client_secret = pi.client_secret;
      result.stripe_payment_intent_id = pi.id;

      // Save PI id to order — fire and forget
      const existingCustomField = (() => {
        try { return JSON.parse(customFieldString); } catch { return {}; }
      })();
      prisma.oc_order.update({
        where: { order_id: result.order_id },
        data: {
          custom_field: JSON.stringify({
            ...existingCustomField,
            stripe_payment_intent_id: pi.id,
          }),
        },
      }).catch((e) => console.error("DB update for PI id failed:", e.message));

    } catch (e) {
      console.error("Stripe PI creation failed:", e.message);
    }
  }

  return result;
};

// ─── Email helper (avoids repeating args) ─────────────────────
const buildEmailArgs = (orderData, products, builtTotals, newYorkTime) => ({
  firstname: orderData.firstname,
  lastname: orderData.lastname,
  email: orderData.email,
  telephone: orderData.telephone,
  newYorkTime,
  products,
  builtTotals,
  shipping_firstname: orderData.shipping_firstname,
  shipping_lastname: orderData.shipping_lastname,
  shipping_address_1: orderData.shipping_address_1,
  shipping_address_2: orderData.shipping_address_2,
  shipping_city: orderData.shipping_city,
  shipping_zone: orderData.shipping_zone,
  shipping_postcode: orderData.shipping_postcode,
  shipping_country: orderData.shipping_country,
  shipping_method: orderData.shipping_method,
  payment_method: orderData.payment_method,
  payment_firstname: orderData.payment_firstname,
  payment_lastname: orderData.payment_lastname,
  payment_address_1: orderData.payment_address_1,
  payment_city: orderData.payment_city,
  payment_zone: orderData.payment_zone,
  payment_country: orderData.payment_country,
  comment: orderData.comment,
});

// ─── Confirmation emails ───────────────────────────────────────
export const _sendConfirmationEmails = async ({
  result, firstname, lastname, email, newYorkTime, telephone,
  products, builtTotals,
  shipping_firstname, shipping_lastname,
  shipping_address_1, shipping_address_2,
  shipping_city, shipping_zone, shipping_postcode, shipping_country, shipping_method,
  payment_method, payment_firstname, payment_lastname,
  payment_address_1, payment_city, payment_zone, payment_country, comment,
}) => {
  if (!email) return;

  const emailPayload = {
    order_id: result.order_id,
    firstname, lastname, email,
    date_added: newYorkTime,
    products, totals: builtTotals,
    telephone,
    shipping_firstname, shipping_lastname,
    shipping_address_1, shipping_address_2,
    shipping_city, shipping_zone, shipping_postcode, shipping_country, shipping_method,
    payment_method, payment_firstname, payment_lastname,
    payment_address_1, payment_city, payment_zone, payment_country, comment,
  };
  const adminEmail = process.env.MAIL_ADMIN || "contact@wineandchampagnegifts.com";
  try {
    await transporter.sendMail({
      from: `"${process.env.MAIL_FROM_NAME}" <${process.env.MAIL_FROM}>`,
      to: email,
      subject: `Order Confirmed #${result.order_id} — Wine & Champagne Gifts`,
      html: generateOrderConfirmationEmail(emailPayload),
    });

    // await transporter.sendMail({
    //   from: `"${process.env.MAIL_FROM_NAME}" <${process.env.MAIL_FROM}>`,
    //   to: adminEmail,
    //   subject: `New Order #${result.order_id} — Wine & Champagne Gifts`,
    //   html: generateOrderConfirmationEmail(emailPayload),
    // });
  } catch (err) {
    console.error("Failed to send confirmation email:", err.message);
  }
};

// // ═══════════════════════════════════════════════════════════
// // REFUND
// // ═══════════════════════════════════════════════════════════
// /**
//  * Refund a Stripe charge tied to an order.
//  * @param {number|string} orderId - oc_order.order_id
//  * @param {object} [opts]
//  * @param {number} [opts.amount] - partial refund amount in dollars (omit for full refund)
//  * @param {string} [opts.reason] - "duplicate" | "fraudulent" | "requested_by_customer"
//  */
// export const refundOrderService = async (orderId, { amount = null, reason = null } = {}) => {
//   const order = await prisma.oc_order.findUnique({
//     where: { order_id: Number(orderId) },
//     select: { order_id: true, custom_field: true, total: true },
//   });
//   if (!order) throw new Error(`Order ${orderId} not found`);

//   let paymentIntentId;
//   try {
//     const custom = JSON.parse(order.custom_field || "{}");
//     paymentIntentId = custom.stripe_payment_intent_id;
//   } catch {
//     throw new Error("Could not read stripe_payment_intent_id from order");
//   }
//   if (!paymentIntentId) throw new Error("No Stripe payment intent found for this order");

//   const pi = await stripe.paymentIntents.retrieve(paymentIntentId, { expand: ["latest_charge"] });
//   const chargeId = pi.latest_charge?.id ?? (typeof pi.latest_charge === "string" ? pi.latest_charge : null);
//   if (!chargeId) throw new Error("No charge found on this payment intent to refund");

//   const refund = await stripe.refunds.create({
//     charge: chargeId,
//     ...(amount ? { amount: Math.round(amount * 100) } : {}), // omit = full refund
//     ...(reason ? { reason } : {}),
//   });

//   const newYorkTime = DateTime.now()
//     .setZone("America/New_York")
//     .toFormat("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'");

//   const isFullRefund = refund.amount === pi.amount;

//   await Promise.all([
//     prisma.oc_order.update({
//       where: { order_id: order.order_id },
//       data: {
//         order_status_id: isFullRefund ? ORDER_STATUS.REFUNDED : ORDER_STATUS.PROCESSED,
//         date_modified: newYorkTime,
//       },
//     }),
//     prisma.oc_order_history.create({
//       data: {
//         order_id: order.order_id,
//         order_status_id: isFullRefund ? ORDER_STATUS.REFUNDED : ORDER_STATUS.PROCESSED,
//         notify: true,
//         comment: `Refund issued: ${formatMoney(refund.amount, refund.currency)} — Refund ID: ${refund.id}${reason ? ` — Reason: ${reason}` : ""}`,
//         date_added: newYorkTime,
//       },
//     }),
//   ]);

//   return { refund_id: refund.id, amount: refund.amount / 100, status: refund.status };
// };