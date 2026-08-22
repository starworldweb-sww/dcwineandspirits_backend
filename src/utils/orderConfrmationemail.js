export const generateOrderConfirmationEmail = ({
  order_id,
  firstname,
  lastname,
  email,
  date_added,
  products = [],
  shipping_firstname,
  shipping_lastname,
  shipping_address_1,
  shipping_address_2,
  shipping_city,
  shipping_zone,
  shipping_postcode,
  shipping_country,
  shipping_method,
  payment_method,
  payment_firstname,
  payment_lastname,
  telephone,
  payment_address_1,
  payment_city,
  payment_zone,
  payment_country,
  totals = [],
  comment = "",
  shipping_custom_field
}) => {



  const fmt = (n) => `$${Number(n).toFixed(2)}`;
  const totalRows = totals
    .filter(t => t.code !== "total")
    .sort((a, b) => a.sort_order - b.sort_order)
    .map(t => `
    <tr style="background:#f9f9f9;">
      <td colspan="3" style="padding:10px 18px;text-align:right;font-family:Arial,sans-serif;font-size:11px;color:#666;border-top:1px solid #e8e8e8;">
        ${t.title}
      </td>
      <td style="padding:10px 18px;text-align:right;font-family:Georgia,serif;font-size:12px;color:#333;border-top:1px solid #e8e8e8;">
        ${fmt(t.value)}
      </td>
    </tr>
  `).join("");

  const grandTotalItem = totals.find(t => t.code === "total");

  const extractPhoneFromCustomField = (cf) => {
    if (!cf) return "";
    let parsed = cf;
    if (typeof cf === "string") {
      try { parsed = JSON.parse(cf); } catch (_) { parsed = {}; }
    }
    if (!parsed || typeof parsed !== "object") return "";
    return String(parsed["1"] || parsed[1] || "").trim();
  };

  const shippingPhone = extractPhoneFromCustomField(shipping_custom_field);

  const orderDate = new Date(date_added).toLocaleDateString("en-US", {
    year: "numeric", month: "long", day: "numeric",
  });

  const productRows = products.map((p) => {
    const itemOptions = p?.option || p?.options || [];
    const unitPrice = Number(p.price || 0);
    const itemTotal = Number(p.total || (unitPrice * Number(p.quantity || 0)));
   
    const optionsHtml = itemOptions.map(opt => {
      const optionName =
        (opt.option_name || opt.name || 'Option') ===
          'Choose a Greeting Card : $4.99 (Standard Greeting Card is Free)'
          ? 'Choose a Greeting Card'
          : (opt.option_name || opt.name || 'Option');

      return `
    <div style="margin-top:4px;padding:3px 10px;background:#f5f5f5;border-left:2px solid #8a1932;font-size:11px;color:#555;line-height:1.5;">
      <strong style="text-transform:uppercase;font-size:10px;letter-spacing:0.5px;color:#222;">
        ${optionName}:
      </strong>&nbsp;
      ${opt.type === 'file'
          ? `<a target="_blank" style="color:#0373fc;font-style:italic;" href="${opt?.image_url}">${opt?.value}</a>`
          : `<span style="color:#444;font-style:italic;">${opt.value}</span>`
        }
    </div>
  `;
    }).join("");

    return `
    <tr>
      <td style="padding:16px 18px;border-bottom:1px solid #e8e8e8;vertical-align:top;">
        <span style="display:block;font-family:'Georgia',serif;font-weight:700;font-size:14px;color:#111;line-height:1.4;">${p.name}</span>
        <span style="display:block;font-family:Arial,sans-serif;font-size:11px;color:#888;margin-top:3px;letter-spacing:0.3px;">Model: ${p.model}</span>
        ${optionsHtml}
      </td>
      <td style="padding:16px 18px;border-bottom:1px solid #e8e8e8;text-align:center;vertical-align:top;font-family:'Georgia',serif;font-size:14px;color:#333;white-space:nowrap;">${p.quantity}</td>
      <td style="padding:16px 18px;border-bottom:1px solid #e8e8e8;text-align:right;vertical-align:top;font-family:'Georgia',serif;font-size:14px;color:#333;white-space:nowrap;">${fmt(unitPrice)}</td>
      <td style="padding:16px 10px;border-bottom:1px solid #e8e8e8;text-align:right;vertical-align:top;font-family:'Georgia',serif;font-size:14px;font-weight:700;color:#8a1932;white-space:nowrap;">${fmt(itemTotal)}</td>
    </tr>`;
  }).join("");



  const commentBlock = comment ? `
  <tr>
    <td style="padding:0 28px 24px;background:#fff;">
      <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #ddd;border-radius:4px;overflow:hidden;">
        <tr>
          <td style="background:#8a1932;padding:12px 18px;border-bottom:1px solid #6d1427;">
            <span style="font-family:Arial,sans-serif;font-size:9px;letter-spacing:2.5px;color:#fff;text-transform:uppercase;font-weight:700;">Order Note / Gift Message</span>
          </td>
        </tr>
        <tr>
          <td style="background:#fafafa;padding:18px 20px;font-family:'Georgia',serif;font-size:13px;color:#333;line-height:1.7;font-style:italic;">
            &#8220;${comment}&#8221;
          </td>
        </tr>
      </table>
    </td>
  </tr>` : "";

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1.0"/>
  <title>Order Confirmed — DC Wine &amp; Spirits</title>
  <style>
    body, .bg { background-color:#f0f0f0 !important; }
    u + .bg   { background-color:#f0f0f0 !important; }
    div[style*="margin: 16px 0"] { margin:0 !important; }
    @media only screen and (max-width:640px) {
      .col-half { width:100% !important; display:block !important; }
      .col-half + .col-half { margin-top:12px !important; }
    }
  </style>
</head>
<body class="bg" style="margin:0;padding:0;background-color:#f0f0f0 !important;">

<table class="bg" role="presentation" width="100%" cellpadding="0" cellspacing="0"
  style="background:#f0f0f0 !important;padding:48px 16px;">
  <tr>
    <td align="center">
      <table role="presentation" width="600" cellpadding="0" cellspacing="0"
        style="max-width:600px;width:100%;border-radius:2px;overflow:hidden;
               box-shadow:0 8px 40px rgba(0,0,0,0.18);border:1px solid #ccc;">

        <!-- ════ TOP STRIPE ════ -->
        <tr>
          <td style="background:#8a1932;height:5px;padding:0;font-size:0;line-height:0;">
            <div style="height:5px;background:repeating-linear-gradient(90deg,#fff 0px,#fff 8px,#8a1932 8px,#8a1932 16px);"></div>
          </td>
        </tr>

        <!-- ════ HEADER ════ -->
        <tr>
          <td style="background:#ffffff;padding:44px 40px 36px;text-align:center;border-bottom:1px solid #eee;">

            <!-- Logo -->
            <img
              src="https://www.dcwineandspirits.com/image/cache/catalog/logo/dc-wine_logo-360x90.png"
              alt="DC Wine &amp; Spirits"
              width="180"
              style="display:block;margin:0 auto 28px;max-width:220px;height:auto;border:0;"
            />

            <!-- Thin maroon rule -->
            <div style="width:60px;height:1px;background:#8a1932;margin:0 auto 24px;"></div>

            <!-- Badge -->
            <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 auto 22px;">
              <tr>
                <td style="border:1px solid #8a1932;border-radius:2px;padding:8px 24px;">
                  <span style="font-family:Arial,sans-serif;font-size:9px;font-weight:700;letter-spacing:4px;color:#8a1932;text-transform:uppercase;">Order Confirmed</span>
                </td>
              </tr>
            </table>

            <p style="margin:0;font-family:'Georgia',serif;font-size:16px;color:#444;line-height:1.7;">
              Thank you, <strong style="color:#111;">${firstname} ${lastname}</strong>.<br/>
              Your order has been received and is being processed.
            </p>
          </td>
        </tr>

        <!-- ════ ORDER META BAR ════ -->
        <tr>
          <td style="background:#8a1932;padding:0;">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
              <tr>
                <td style="padding:20px;border-right:1px solid #a53a52;text-align:center;width:33.3%;">
                  <span style="display:block;font-family:Arial,sans-serif;font-size:8px;letter-spacing:3px;color:#e8c3cd;text-transform:uppercase;margin-bottom:8px;">Order No.</span>
                  <span style="font-family:'Georgia',serif;font-size:18px;font-weight:700;color:#fff;letter-spacing:1px;">#${order_id}</span>
                </td>
                <td style="padding:20px;border-right:1px solid #a53a52;text-align:center;width:33.3%;">
                  <span style="display:block;font-family:Arial,sans-serif;font-size:8px;letter-spacing:3px;color:#e8c3cd;text-transform:uppercase;margin-bottom:8px;">Date</span>
                  <span style="font-family:'Georgia',serif;font-size:13px;color:#f5dde3;">${orderDate}</span>
                </td>
                <td style="padding:20px;text-align:center;width:33.3%;">
                  <span style="display:block;font-family:Arial,sans-serif;font-size:8px;letter-spacing:3px;color:#e8c3cd;text-transform:uppercase;margin-bottom:8px;">Status</span>
                  <span style="font-family:Arial,sans-serif;font-size:11px;font-weight:700;letter-spacing:2px;color:#fff;background:#6d1427;padding:4px 12px;border-radius:2px;">Processed</span>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- ════ BODY ════ -->
        <tr>
          <td style="background:#fff;padding:0;">

            <!-- ── Customer Info ── -->
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
              <tr>
                <td style="padding:32px 28px 0;">
                  <!-- Section label -->
                  <table role="presentation" cellpadding="0" cellspacing="0" style="margin-bottom:12px;">
                    <tr>
                      <td style="padding-right:10px;vertical-align:middle;">
                        <div style="width:16px;height:2px;background:#8a1932;"></div>
                      </td>
                      <td>
                        <span style="font-family:Arial,sans-serif;font-size:8px;letter-spacing:3px;color:#8a1932;text-transform:uppercase;font-weight:700;">Customer Information</span>
                      </td>
                    </tr>
                  </table>
                  <table role="presentation" width="100%" cellpadding="0" cellspacing="0"
                    style="border:1px solid #e0e0e0;">
                    <tr>
                      <td style="padding:16px 18px;border-right:1px solid #e0e0e0;width:50%;background:#fafafa;">
                        <span style="display:block;font-family:Arial,sans-serif;font-size:8px;letter-spacing:2px;color:#888;text-transform:uppercase;margin-bottom:6px;">Full Name</span>
                        <span style="font-family:'Georgia',serif;font-size:15px;color:#111;font-weight:700;">${firstname} ${lastname}</span>
                      </td>
                      <td style="padding:16px 18px;width:50%;background:#fafafa;">
                        <span style="display:block;font-family:Arial,sans-serif;font-size:8px;letter-spacing:2px;color:#888;text-transform:uppercase;margin-bottom:6px;">Email Address</span>
                        <span style="font-family:Arial,sans-serif;font-size:13px;color:#111;">${email}</span>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
            </table>

            <!-- ── Shipping + Payment ── -->
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
              <tr>
                <td style="padding:24px 28px 0;">
                  <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                    <tr valign="top">

                      <!-- Payment -->
                      <td class="col-half" style="width:50%;padding-left:8px;">
                        <table role="presentation" cellpadding="0" cellspacing="0" style="margin-bottom:10px;">
                          <tr>
                            <td style="padding-right:8px;vertical-align:middle;">
                              <div style="width:16px;height:2px;background:#8a1932;"></div>
                            </td>
                            <td>
                              <span style="font-family:Arial,sans-serif;font-size:8px;letter-spacing:3px;color:#8a1932;text-transform:uppercase;font-weight:700;">Payment</span>
                            </td>
                          </tr>
                        </table>
                        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e0e0e0;">
                          <tr>
                           <td style="padding:16px 18px;background:#fafafa;">
  <p style="margin:0 0 4px;font-family:'Georgia',serif;font-size:14px;font-weight:700;color:#111;">${payment_firstname} ${payment_lastname}</p>
  <p style="margin:0 0 2px;font-family:Arial,sans-serif;font-size:12px;color:#666;line-height:1.7;">${payment_address_1}</p>
  <p style="margin:0 0 2px;font-family:Arial,sans-serif;font-size:12px;color:#666;">${payment_city}, ${payment_zone}</p>
   <p style="margin:0 0 2px;font-family:Arial,sans-serif;font-size:12px;color:#666;">${payment_country}</p>
  ${telephone ? `<p style="margin:0 0 14px;font-family:Arial,sans-serif;font-size:12px;color:#666;">📞 ${telephone}</p>` : `<div style="margin-bottom:14px;"></div>`}
  <div style="height:1px;background:#e8e8e8;margin-bottom:10px;"></div>
                              <span style="font-family:Arial,sans-serif;font-size:8px;letter-spacing:2px;color:#888;text-transform:uppercase;display:block;margin-bottom:4px;">Method</span>
                              <span style="font-family:'Georgia',serif;font-size:13px;color:#111;font-weight:600;">${payment_method}</span>
                            </td>
                          </tr>
                        </table>
                      </td>



                      <!-- Shipping -->
                      <td class="col-half" style="width:50%;padding-right:8px;">
                        <table role="presentation" cellpadding="0" cellspacing="0" style="margin-bottom:10px;">
                          <tr>
                            <td style="padding-right:8px;vertical-align:middle;">
                              <div style="width:16px;height:2px;background:#8a1932;"></div>
                            </td>
                            <td>
                              <span style="font-family:Arial,sans-serif;font-size:8px;letter-spacing:3px;color:#8a1932;text-transform:uppercase;font-weight:700;">Shipping</span>
                            </td>
                          </tr>
                        </table>
                        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e0e0e0;">
                          <tr>
                            <td style="padding:16px 18px;background:#fafafa;">
  <p style="margin:0 0 4px;font-family:'Georgia',serif;font-size:14px;font-weight:700;color:#111;">${shipping_firstname} ${shipping_lastname}</p>
  <p style="margin:0 0 2px;font-family:Arial,sans-serif;font-size:12px;color:#666;line-height:1.7;">${shipping_address_1}${shipping_address_2 ? ", " + shipping_address_2 : ""}</p>
  <p style="margin:0 0 2px;font-family:Arial,sans-serif;font-size:12px;color:#666;">${shipping_city}, ${shipping_zone} ${shipping_postcode}</p>
  <p style="margin:0 0 2px;font-family:Arial,sans-serif;font-size:12px;color:#666;">${shipping_country}</p>
  ${shippingPhone ? `<p style="margin:0 0 2px;font-family:Arial,sans-serif;font-size:12px;color:#666;">📞 ${shippingPhone}</p>` : ""}
  <div style="height:1px;background:#e8e8e8;margin-bottom:10px;"></div>
                              <span style="font-family:Arial,sans-serif;font-size:8px;letter-spacing:2px;color:#888;text-transform:uppercase;display:block;margin-bottom:4px;">Method</span>
                              <span style="font-family:'Georgia',serif;font-size:13px;color:#111;font-weight:600;">${shipping_method}</span>
                            </td>
                          </tr>
                        </table>
                      </td>

                     

                    </tr>
                  </table>
                </td>
              </tr>
            </table>

            <!-- ── Order Items ── -->
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
              <tr>
                <td style="padding:28px 28px 0;">
                  <table role="presentation" cellpadding="0" cellspacing="0" style="margin-bottom:12px;">
                    <tr>
                      <td style="padding-right:10px;vertical-align:middle;">
                        <div style="width:16px;height:2px;background:#8a1932;"></div>
                      </td>
                      <td>
                        <span style="font-family:Arial,sans-serif;font-size:8px;letter-spacing:3px;color:#8a1932;text-transform:uppercase;font-weight:700;">Order Items</span>
                      </td>
                    </tr>
                  </table>

                  <!-- Product table -->
                  <table role="presentation" width="100%" cellpadding="0" cellspacing="0"
                    style="table-layout:fixed;border:1px solid #e0e0e0;border-bottom:none;">
                    <colgroup>
                      <col style="width:auto;"/>
                      <col style="width:38px;"/>
                      <col style="width:70px;"/>
                      <col style="width:74px;"/>
                    </colgroup>
                    <thead>
                      <tr style="background:#8a1932;">
                        <th style="padding:12px 16px;text-align:left;font-family:Arial,sans-serif;font-size:8px;letter-spacing:3px;color:#fff;text-transform:uppercase;font-weight:700;border-right:1px solid #a53a52;">Product</th>
                        <th style="padding:12px 10px;text-align:center;font-family:Arial,sans-serif;font-size:8px;letter-spacing:3px;color:#fff;text-transform:uppercase;font-weight:700;border-right:1px solid #a53a52;">Qty</th>
                        <th style="padding:12px 10px;text-align:right;font-family:Arial,sans-serif;font-size:8px;letter-spacing:3px;color:#fff;text-transform:uppercase;font-weight:700;border-right:1px solid #a53a52;">Unit</th>
                        <th style="padding:12px 16px 12px 10px;text-align:right;font-family:Arial,sans-serif;font-size:8px;letter-spacing:3px;color:#fff;text-transform:uppercase;font-weight:700;">Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      ${productRows}
                    </tbody>
                  </table>

                  <!-- Totals -->
                 <table role="presentation" width="100%" cellpadding="0" cellspacing="0"
  style="border:1px solid #e0e0e0;border-top:none;">

  ${totalRows}

  <!-- Grand Total -->
  <tr style="background:#8a1932;">
    <td colspan="3" style="padding:18px 20px;text-align:right;font-family:Arial,sans-serif;font-size:9px;font-weight:700;letter-spacing:4px;color:#fff;text-transform:uppercase;border-top:2px solid #6d1427;">
     ${grandTotalItem?.title || "Grand Total"}
    </td>
    <td style="padding:18px 20px;text-align:right;font-family:Georgia,serif;font-size:22px;font-weight:700;color:#fff;border-top:2px solid #6d1427;">
      ${fmt(grandTotalItem?.value ?? 0)}
    </td>
  </tr>
</table>

                </td>
              </tr>
            </table>

            ${commentBlock}
           

          </td>
        </tr>

        <!-- ════ FOOTER ════ -->
        <tr>
          <td style="background:#ffffff;padding:0;">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
              <tr>
                <td style="padding:36px 40px;text-align:center;">

                  <img src="https://www.dcwineandspirits.com/image/cache/catalog/logo/dc-wine_logo-360x90.png"
                    alt="DC Wine &amp; Spirits"
                    width="150"
                    style="display:block;margin:0 auto 20px;max-width:180px;height:auto;border:0;filter:brightness(0) invert(1);opacity:0.9;"
                  />

                  <div style="width:40px;height:1px;background:#8a1932;margin:0 auto 20px;"></div>

                  <p style="margin:0 0 8px;font-family:Arial,sans-serif;font-size:10px;letter-spacing:2px;color:#1f1f1f;text-transform:uppercase;">
                    Questions about your order?
                  </p>
                  <p style="margin:0 0 4px;font-family:'Georgia',serif;font-size:13px;color:#aaa;">
                    <a href="mailto:contact@dcwineandspirits.com"
                      style="color:#fff;text-decoration:none;border-bottom:1px solid #1f1f1f;">
                      contact@dcwineandspirits.com
                    </a>
                  </p>
                  <p style="margin:0 0 16px;font-family:Arial,sans-serif;font-size:12px;color:#1f1f1f;">
                    (202) 459-8489
                  </p>
                  <p style="margin:0 0 20px;">
                    <a href="https://www.dcwineandspirits.com"
                      style="font-family:Arial,sans-serif;font-size:10px;color:#1f1f1f;text-decoration:none;letter-spacing:2px;text-transform:uppercase;">
                      www.dcwineandspirits.com
                    </a>
                  </p>

                  <div style="width:40px;height:1px;background:#333;margin:0 auto 20px;"></div>

                  <p style="margin:0;font-family:Arial,sans-serif;font-size:10px;color:#1f1f1f;letter-spacing:1px;">
                    &copy; ${new Date().getFullYear()} DC Wine &amp; Spirits. All rights reserved.
                  </p>
                </td>
              </tr>
            </table>
            <!-- Bottom stripe -->
            <div style="height:5px;background:repeating-linear-gradient(90deg,#fff 0px,#fff 8px,#8a1932 8px,#8a1932 16px);"></div>
          </td>
        </tr>

      </table>
    </td>
  </tr>
</table>

</body>
</html>
  `.trim();
};