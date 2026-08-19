import crypto from "crypto";
import { prisma } from "../../../lib/prisma.js";
// import { mergeGuestWishlistService } from '../wishlish/wishlist.service.js';
// import { mergeGuestCartService } from '../cart/cart.service.js';
import { DateTime } from "luxon";
import { transporter } from "../../config/nodemiller.js";
import { generateToken } from "../../utils/generateToken.js";
import { getNewsletterWelcomeTemplate } from "../../utils/getNewsletterWelcomeTemplate.js";
import { mergeGuestWishlistService } from "../wishlish/wishlist.service.js";
import { mergeGuestCartService } from "../cart/cart.service.js";

export const sha1 = (str) => {
  return crypto.createHash("sha1").update(str).digest("hex");
};

export const hashPassword = (password, salt) => {
  const step1 = sha1(password);
  const step2 = sha1(salt + step1);
  const step3 = sha1(salt + step2);
  return step3;
};

export const generateSalt = (length = 9) => {
  return crypto.randomBytes(16).toString("hex").substring(0, length);
};

// export const socialLoginCustomer = async (data, ip, cookies = {}) => {
//   const { firstname, lastname, email, oauth_provider, oauth_id } = data;
//   let customer = await prisma.oc_customer.findFirst({
//     where: { email: email.toLowerCase().trim() }
//   });

//   if (!customer) {
//     // Create new customer if not exists
//     customer = await prisma.oc_customer.create({
//       data: {
//         customer_group_id: 1,
//         store_id: 0,
//         language_id: 1,
//         firstname: firstname ? firstname.trim() : 'User',
//         lastname: lastname ? lastname.trim() : '',
//         email: email.toLowerCase().trim(),
//         telephone: '',
//         fax: '',
//         password: null, // No password for social login
//         salt: null,
//         custom_field: '',
//         ip: ip || '0.0.0.0',
//         newsletter: false,
//         status: true,
//         safe: false,
//         token: '',
//         code: '',
//         date_added: new Date(),
//         oauth_provider,
//         oauth_id
//       }
//     });
//   } else {
//     // Update existing customer with oauth info if not present
//     if (!customer.oauth_provider) {
//       customer = await prisma.oc_customer.update({
//         where: { customer_id: customer.customer_id },
//         data: {
//           oauth_provider,
//           oauth_id
//         }
//       });
//     }
//   }

//   if (!customer.status) {
//     throw new Error('Your account is disabled. Contact support.');
//   }

//   await prisma.oc_customer_ip.create({
//     data: {
//       customer_id: customer.customer_id,
//       ip: ip || '0.0.0.0',
//       date_added: new Date()
//     }
//   });

//   // Merge Guest Cart
//   const guestSessionId = cookies?.guest_session || '';
//   if (guestSessionId) {
//     await mergeGuestCartService({
//       sessionId: guestSessionId,
//       customerId: customer.customer_id,
//     });
//   }

//   // Merge Guest Wishlist
//   const guestWishlistCookie = cookies?.guest_wishlist || '';
//   const guestProductIds = guestWishlistCookie
//     ? guestWishlistCookie.split(',').map(Number).filter(Boolean)
//     : [];

//   if (guestProductIds.length > 0) {
//     await mergeGuestWishlistService({
//       customerId: customer.customer_id,
//       guestProductIds,
//     });
//   }

//   const token = generateToken({
//     customer_id: customer.customer_id,
//     email: customer.email,
//     customer_group_id: customer.customer_group_id
//   });

//   return {
//     token,
//     customer: {
//       customer_id: customer.customer_id,
//       firstname: customer.firstname,
//       lastname: customer.lastname,
//       email: customer.email,
//       telephone: customer.telephone
//     }
//   };
// }

export const loginCustomer = async (data, ip, cookies = {}) => {
  const { email, password } = data;

  // const newYorkTime = DateTime.now().setZone("America/New_York").toJSDate();
  const newYorkTime = DateTime.now()
    .setZone("America/New_York")
    .toFormat("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'");
  const customer = await prisma.oc_customer.findFirst({
    where: { email: email.toLowerCase().trim() },
    select: {
      customer_id: true,
      firstname: true,
      lastname: true,
      email: true,
      telephone: true,
      password: true,
      salt: true,
      status: true,
      customer_group_id: true,
    },
  });

  if (!customer) throw new Error("Invalid email or password");
  if (!customer.status)
    throw new Error("Your account is disabled. Contact support.");

  const hashedInput = hashPassword(password, customer.salt);
  if (hashedInput !== customer.password)
    throw new Error("Invalid email or password");

  await prisma.oc_customer_ip.create({
    data: {
      customer_id: customer.customer_id,
      ip: ip || "0.0.0.0",
      date_added: new Date(),
    },
  });

  await prisma.oc_customer_activity.create({
    data: {
      customer_id: customer.customer_id || 0,
      key: "login",
      data: JSON.stringify({
        customer_id: customer?.customer_id,
        name: `${customer?.firstname} ${customer?.lastname}`,
      }),
      ip: ip,
      date_added: newYorkTime,
    },
  });

    const guestSessionId = cookies?.guest_session || '';
    if (guestSessionId) {
      await mergeGuestCartService({
        sessionId: guestSessionId,
        customerId: customer.customer_id,
      });
    }

  const guestWishlistCookie = cookies?.guest_wishlist || "";
  const guestProductIds = guestWishlistCookie
    ? guestWishlistCookie.split(",").map(Number).filter(Boolean)
    : [];

    if (guestProductIds.length > 0) {
      await mergeGuestWishlistService({
        customerId: customer.customer_id,
        guestProductIds,
      });
    }

  const token = generateToken({
    customer_id: customer.customer_id,
    email: customer.email,
    customer_group_id: customer.customer_group_id,
  });

  return {
    token,
    customer: {
      customer_id: customer.customer_id,
      firstname: customer.firstname,
      lastname: customer.lastname,
      email: customer.email,
      telephone: customer.telephone,
    },
  };
};

export const registerCustomer = async (data, ip) => {
  const { firstname, lastname, email, telephone, password, newsletter } = data;
  const newYorkTime = DateTime.now()
    .setZone("America/New_York")
    .toFormat("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'");

  const existing = await prisma.oc_customer.findFirst({
    where: { email: email.toLowerCase().trim() },
  });

  if (existing) {
    throw new Error("Email already registered");
  }

  const salt = generateSalt();
  const hashedPassword = hashPassword(password, salt);

  if (newsletter) {
    const existingEmail = await prisma.oc_journal3_newsletter.findFirst({
      where: {
        email: email,
      },
    });

    if (existingEmail) {
      throw new Error("You have already subscribed to our newsletter.");
    }
    const data = await prisma.oc_journal3_newsletter.create({
      data: {
        name: "",
        email: email,
        ip: ip,
        store_id: 0,
      },
    });

    await transporter.sendMail({
      from: `"Dc Wine & Spirits"${process.env.MAIL_FROM_NAME}" <${process.env.MAIL_FROM}>`,
      to: email,
      subject: "Welcome! Here's your $10 coupon 🎁",
      html: getNewsletterWelcomeTemplate(email),
    });
  }

  const newCustomer = await prisma.oc_customer.create({
    data: {
      customer_group_id: 1,
      store_id: 0,
      language_id: 1,
      firstname: firstname.trim(),
      lastname: lastname.trim(),
      email: email.toLowerCase().trim(),
      telephone: telephone || "",
      fax: "",
      password: hashedPassword,
      salt,
      custom_field: "",
      ip: ip || "0.0.0.0",
      newsletter: Boolean(newsletter),
      status: true,
      safe: false,
      token: "",
      code: "",
      date_added: new Date(),
      image: "",
    },
  });

    await prisma.oc_customer_activity.create({
      data: {
        customer_id: newCustomer.customer_id || 0,
        key: "register new customer",
        data: JSON.stringify({
          "customer_id": newCustomer?.customer_id,
          "name": `${newCustomer?.firstname} ${newCustomer?.lastname}`,
        }),
        ip: ip,
        date_added: newYorkTime
      }
    })
await transporter.sendMail({
    from: `"${process.env.MAIL_FROM_NAME}" <${process.env.MAIL_FROM}>`,
    to: email,
    subject: 'Welcome to DC Wine & Spirits',
    html: `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>Welcome to DC Wine & Spirits</title>
  <link href="https://fonts.googleapis.com/css2?family=Hind+Madurai:wght@400;500;600;700&display=swap" rel="stylesheet" />
  <style>
    @media only screen and (max-width: 620px) {
      .email-wrapper { padding: 24px 12px !important; }
      .email-container { width:100% !important; max-width:100% !important; border-radius:0 !important; }
      .email-header, .email-body, .email-footer { padding-left:24px !important; padding-right:24px !important; }
      .email-title { font-size:22px !important; }
      .step-text { padding-left:12px !important; }
    }
  </style>
</head>
<body style="margin:0;padding:0;background-color:#f5f2f0;font-family:'Hind Madurai', Arial, sans-serif;">

  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f0ece7;padding:48px 0;" class="email-wrapper">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background-color:#ffffff;border-radius:10px;overflow:hidden;box-shadow:0 6px 24px rgba(26,26,26,0.08); width:600px; max-width:600px;" class="email-container">

          <!-- Header -->
          <tr>
            <td align="center" style="background-color:#1a1a1a;padding:34px 40px 34px;" class="email-header">
              <img src="https://www.dcwineandspirits.com/image/catalog/logo/fav-icon.png" alt="DC Wine & Spirits" width="64" style="display:block;margin:0 auto;max-width:64px;height:auto;border-radius:8px;" />
              <p style="margin:16px 0 0;font-family:'Hind Madurai', Arial, sans-serif;font-size:13px;letter-spacing:2px;color:#ffffff;font-weight:600;">
                DC WINE &amp; SPIRITS
              </p>
              <p style="margin:6px 0 0;font-family:'Hind Madurai', Arial, sans-serif;font-size:11px;letter-spacing:3px;text-transform:uppercase;color:#c9a35a;">
                Build Your Relationships
              </p>
            </td>
          </tr>

          <!-- Accent bar -->
          <tr>
            <td style="background:linear-gradient(90deg,#c9a35a,#98022e,#c9a35a);height:3px;line-height:3px;font-size:0;">&nbsp;</td>
          </tr>

          <!-- Title -->
          <tr>
            <td align="center" style="padding:38px 40px 8px;" class="email-header">
              <h1 style="margin:0;font-family:'Hind Madurai', Arial, sans-serif;font-size:27px;font-weight:600;color:#1a1a1a;letter-spacing:0.3px;" class="email-title">
                Welcome to the Family
              </h1>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding:14px 48px 8px;" class="email-body">

              <p style="margin:0 0 18px;font-size:15px;color:#4a4a4a;line-height:1.8;text-align:center;">
                Dear <strong style="color:#1a1a1a;">${firstname || 'Valued Customer'}</strong>,
              </p>

              <p style="margin:0 0 34px;font-size:15px;color:#4a4a4a;line-height:1.8;text-align:center;">
                Thank you for creating an account with DC Wine &amp; Spirits. We are delighted to have you
                with us, where every bottle tells a story and every gift creates a lasting memory.
              </p>

              <!-- Account Details Box -->
              <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#faf6f1;border:1px solid #ecdfd0;border-radius:8px;margin-bottom:38px;">
                <tr>
                  <td style="padding:24px 26px;">
                    <p style="margin:0 0 14px;font-size:11px;color:#98022e;letter-spacing:2px;text-transform:uppercase;font-weight:600;">
                      Your Account Details
                    </p>
                    <table width="100%" cellpadding="0" cellspacing="0">
                      <tr>
                        <td style="padding:6px 0;font-size:14px;color:#8c8c8c;width:70px;">Name</td>
                        <td style="padding:6px 0;font-size:14px;color:#1a1a1a;font-weight:600;">${firstname || ''} ${lastname || ''}</td>
                      </tr>
                      <tr>
                        <td style="padding:6px 0;font-size:14px;color:#8c8c8c;">Email</td>
                        <td style="padding:6px 0;font-size:14px;color:#1a1a1a;font-weight:600;">${email}</td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

              <!-- What You Can Do -->
              <h2 style="margin:0 0 24px;font-size:17px;color:#1a1a1a;font-weight:600;letter-spacing:0.2px;text-align:center;">
                What You Can Do With Your Account
              </h2>

              <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:22px;">
                <tr>
                  <td width="46" valign="top">
                    <table cellpadding="0" cellspacing="0"><tr><td width="34" height="34" align="center" valign="middle" style="background-color:#98022e;border-radius:50%;color:#ffffff;font-size:13px;font-weight:700;">01</td></tr></table>
                  </td>
                  <td style="padding-left:14px;padding-top:4px;" class="step-text">
                    <p style="margin:0 0 3px;font-size:15px;font-weight:600;color:#1a1a1a;">Track Your Orders</p>
                    <p style="margin:0;font-size:14px;color:#6b6b6b;line-height:1.7;">View order history and get real-time delivery updates.</p>
                  </td>
                </tr>
              </table>

              <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:22px;">
                <tr>
                  <td width="46" valign="top">
                    <table cellpadding="0" cellspacing="0"><tr><td width="34" height="34" align="center" valign="middle" style="background-color:#98022e;border-radius:50%;color:#ffffff;font-size:13px;font-weight:700;">02</td></tr></table>
                  </td>
                  <td style="padding-left:14px;padding-top:4px;" class="step-text">
                    <p style="margin:0 0 3px;font-size:15px;font-weight:600;color:#1a1a1a;">Curated Collections</p>
                    <p style="margin:0;font-size:14px;color:#6b6b6b;line-height:1.7;">Browse our handpicked selection of fine wines and spirits.</p>
                  </td>
                </tr>
              </table>

              <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:38px;">
                <tr>
                  <td width="46" valign="top">
                    <table cellpadding="0" cellspacing="0"><tr><td width="34" height="34" align="center" valign="middle" style="background-color:#98022e;border-radius:50%;color:#ffffff;font-size:13px;font-weight:700;">03</td></tr></table>
                  </td>
                  <td style="padding-left:14px;padding-top:4px;" class="step-text">
                    <p style="margin:0 0 3px;font-size:15px;font-weight:600;color:#1a1a1a;">Personalized Gifting</p>
                    <p style="margin:0;font-size:14px;color:#6b6b6b;line-height:1.7;">Add custom messages and greeting cards to make every gift special.</p>
                  </td>
                </tr>
              </table>

              <!-- CTA -->
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center" style="padding-bottom:36px;">
                    <a href="https://www.dcwineandspirits.com"
                      style="display:inline-block;background-color:#98022e;color:#ffffff;text-decoration:none;font-size:14px;font-weight:600;letter-spacing:1px;text-transform:uppercase;padding:16px 44px;border-radius:6px;">
                      Start Shopping
                    </a>
                  </td>
                </tr>
              </table>

              <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:26px;">
                <tr><td style="border-top:1px solid #ece6e0;"></td></tr>
              </table>

              <p style="margin:0;font-size:14px;color:#4a4a4a;line-height:1.8;text-align:center;">
                If you have any questions, our team is always happy to help.<br/>
                Warm regards,<br/>
                <strong style="color:#1a1a1a;">The DC Wine &amp; Spirits Team</strong>
              </p>

            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color:#1a1a1a;padding:30px 40px;text-align:center;" class="email-footer">
              <p style="margin:0 0 12px;">
                <a href="https://www.dcwineandspirits.com" style="color:#c9a35a;text-decoration:none;font-size:13px;letter-spacing:1px;">dcwineandspirits.com</a>
              </p>
              <p style="margin:0 0 14px;font-size:12px;color:#999999;">
                <a href="https://www.dcwineandspirits.com/contact" style="color:#999999;text-decoration:none;margin:0 8px;">Contact Us</a> |
                <a href="https://www.dcwineandspirits.com/privacy-policy" style="color:#999999;text-decoration:none;margin:0 8px;">Privacy Policy</a> |
                <a href="https://www.dcwineandspirits.com/account" style="color:#999999;text-decoration:none;margin:0 8px;">My Account</a>
              </p>
              <p style="margin:0;font-size:11px;color:#777777;line-height:1.7;">
                &copy; ${new Date().getFullYear()} DC Wine &amp; Spirits. All rights reserved.<br/>
                You're receiving this because you registered at dcwineandspirits.com
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>

</body>
</html>
  `,
  });

  const token = generateToken({
    customer_id: newCustomer.customer_id,
    email: newCustomer.email,
    customer_group_id: newCustomer.customer_group_id,
  });

  return {
    token,
    customer: {
      customer_id: newCustomer.customer_id,
      firstname: newCustomer.firstname,
      lastname: newCustomer.lastname,
      email: newCustomer.email,
    },
  };
};

export const getProfile = async (customer_id) => {
  const customer = await prisma.oc_customer.findUnique({
    where: { customer_id: Number(customer_id) },
    select: {
      customer_id: true,
      firstname: true,
      lastname: true,
      email: true,
      telephone: true,
      date_added: true,
      status: true,
    },
  });

  if (!customer) throw new Error("Customer not found");
  return customer;
};

export const changePasswordService = async (customer_id, { new_password }) => {
  const customer = await prisma.oc_customer.findUnique({
    where: { customer_id: Number(customer_id) },
    select: { password: true, salt: true },
  });

  if (!customer) {
    throw new Error("Customer not found");
  }

  const salt = generateSalt();
  const hashedNewPassword = hashPassword(new_password, salt);

  await prisma.oc_customer.update({
    where: { customer_id: Number(customer_id) },
    data: { password: hashedNewPassword, salt },
  });

  return { message: "Password changed successfully" };
};

export const forgotPasswordRequestService = async (email) => {
  const customer = await prisma.oc_customer.findFirst({
    where: { email: email.toLowerCase().trim() },
    select: {
      customer_id: true,
      firstname: true,
      email: true,
      status: true,
    },
  });

  if (!customer) throw new Error("No account found with this email");
  if (!customer.status)
    throw new Error("Your account is disabled. Contact support.");

  const resetCode = crypto.randomBytes(16).toString("hex");

  await prisma.oc_customer.update({
    where: { customer_id: customer.customer_id },
    data: { code: resetCode },
  });

  const resetLink = `${process.env.FRONTEND_URL}/account/reset?code=${resetCode}`;

  await transporter.sendMail({
    from: `"${process.env.MAIL_FROM_NAME}" <${process.env.MAIL_FROM}>`,
    to: customer.email,
    subject: "Reset Your Password - Wine & champagne gifts",
    html: `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Password Reset — Wine & champagne gifts</title>
</head>
<body style="margin:0;padding:0;background-color:#f0f0f0;font-family:Georgia,serif;">

<table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f0f0f0;padding:40px 0;">
  <tr><td align="center">

    <table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border:1px solid #d0d0d0;">

      <!-- TOP ACCENT BAR -->
      <tr>
        <td style="background:#111111;height:4px;font-size:0;line-height:0;">&nbsp;</td>
      </tr>

      <!-- HEADER -->
      <tr>
        <td style="background:#111111;padding:48px 48px 40px;text-align:center;">

          <!-- Brand -->
          <p style="margin:0 0 32px;font-family:Georgia,serif;font-size:11px;letter-spacing:6px;text-transform:uppercase;color:#888888;">
            ── &nbsp; Wine & champagne gifts &nbsp; ──
          </p>

          <!-- Lock icon box -->
          <table cellpadding="0" cellspacing="0" style="margin:0 auto 28px;">
            <tr>
              <td style="width:72px;height:72px;background:#ffffff;text-align:center;vertical-align:middle;font-size:32px;line-height:72px;">
                🔐
              </td>
            </tr>
          </table>

          <h1 style="margin:0 0 10px;font-family:Georgia,serif;font-size:30px;font-weight:400;color:#ffffff;letter-spacing:1px;">
            Password Reset
          </h1>
          <p style="margin:0;font-family:Arial,sans-serif;font-size:13px;color:#777777;letter-spacing:1px;">
            We received a request to reset your password
          </p>

        </td>
      </tr>

      <!-- THIN RULE -->
      <tr>
        <td style="background:#111111;padding:0 48px;">
          <table width="100%" cellpadding="0" cellspacing="0">
            <tr><td style="border-top:1px solid #333333;font-size:0;line-height:0;">&nbsp;</td></tr>
          </table>
        </td>
      </tr>

      <!-- BODY -->
      <tr>
        <td style="padding:48px 48px 40px;background:#ffffff;">

          <!-- Greeting -->
          <p style="margin:0 0 8px;font-family:Georgia,serif;font-size:18px;font-weight:400;color:#111111;">
            Hi <strong style="font-weight:700;">${customer?.firstname}</strong>,
          </p>
          <p style="margin:0 0 32px;font-family:Arial,sans-serif;font-size:14px;line-height:1.8;color:#555555;">
            Someone requested a password reset for your <strong style="color:#111111;">Wine and champagne gifts</strong> account. Click the button below to create a new password. This link expires in <strong style="color:#111111;">1 hour</strong>.
          </p>

          <!-- DIVIDER -->
          <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:32px;">
            <tr><td style="border-top:1px solid #eeeeee;font-size:0;line-height:0;">&nbsp;</td></tr>
          </table>

          <!-- CTA BUTTON -->
          <table cellpadding="0" cellspacing="0" style="margin:0 auto 32px;">
            <tr>
              <td style="background:#111111;text-align:center;">
                <a href=${resetLink}
                   style="display:inline-block;background:#111111;color:#ffffff;text-decoration:none;padding:18px 52px;font-family:Arial,sans-serif;font-size:12px;font-weight:700;letter-spacing:3px;text-transform:uppercase;">
                  Reset My Password
                </a>
              </td>
            </tr>
          </table>

          <!-- DIVIDER -->
          <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:28px;">
            <tr><td style="border-top:1px solid #eeeeee;font-size:0;line-height:0;">&nbsp;</td></tr>
          </table>

          <!-- WARNING BOX -->
          <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:28px;">
            <tr>
              <td style="border:1px solid #e0e0e0;border-left:3px solid #111111;padding:16px 20px;background:#f9f9f9;">
                <p style="margin:0;font-family:Arial,sans-serif;font-size:13px;color:#444444;line-height:1.6;">
                  <strong style="color:#111111;">Didn't request this?</strong><br>
                  You can safely ignore this email. Your password will remain unchanged and no action is needed.
                </p>
              </td>
            </tr>
          </table>

          <!-- FALLBACK LINK -->
          <p style="margin:0 0 8px;font-family:Arial,sans-serif;font-size:12px;color:#999999;letter-spacing:0.5px;">
            If the button doesn't work, copy and paste this link into your browser:
          </p>
          <table width="100%" cellpadding="0" cellspacing="0">
            <tr>
              <td style="background:#f5f5f5;border:1px solid #e8e8e8;padding:12px 16px;word-break:break-all;">
                <a href=${resetLink} style="font-family:Arial,sans-serif;font-size:12px;color:#111111;text-decoration:underline;">
                  ${resetLink}
                </a>
              </td>
            </tr>
          </table>

        </td>
      </tr>

      <!-- SECURITY NOTE BAR -->
      <tr>
        <td style="background:#f5f5f5;border-top:1px solid #e8e8e8;border-bottom:1px solid #e8e8e8;padding:16px 48px;">
          <table width="100%" cellpadding="0" cellspacing="0">
            <tr>
              <td style="width:20px;vertical-align:top;font-size:14px;padding-top:1px;">🔒</td>
              <td style="padding-left:10px;">
                <p style="margin:0;font-family:Arial,sans-serif;font-size:11px;color:#888888;line-height:1.6;letter-spacing:0.3px;">
                  This email was sent from a secure server. Wine & champagne gifts will never ask for your password via email. If you're unsure, contact our support team directly.
                </p>
              </td>
            </tr>
          </table>
        </td>
      </tr>

      <!-- FOOTER -->
      <tr>
        <td style="padding:32px 48px;text-align:center;background:#ffffff;">

          <!-- Brand mark -->
          <p style="margin:0 0 16px;font-family:Georgia,serif;font-size:13px;letter-spacing:4px;text-transform:uppercase;color:#111111;">
            Wine & champagne gifts
          </p>
          <p style="margin:0 0 16px;font-family:Georgia,serif;font-size:10px;letter-spacing:2px;text-transform:uppercase;color:#bbbbbb;">
            Premium Gifts Collection
          </p>

          <!-- Thin rule -->
          <table width="80" cellpadding="0" cellspacing="0" style="margin:0 auto 16px;">
            <tr><td style="border-top:1px solid #e0e0e0;font-size:0;">&nbsp;</td></tr>
          </table>

          <p style="margin:0 0 8px;font-family:Arial,sans-serif;font-size:11px;color:#aaaaaa;line-height:1.6;">
            © 2025 Wine & champagne gifts. All rights reserved.<br>
            This is an automated email — please do not reply.
          </p>
          <p style="margin:0;font-family:Arial,sans-serif;font-size:11px;">
            <a href="https://www.wineandchampagnegifts.com" style="color:#555555;text-decoration:none;letter-spacing:1px;">wineandchampagnegifts.com
            </a>
            &nbsp;·&nbsp;
            <a href="#" style="color:#555555;text-decoration:none;letter-spacing:1px;">Unsubscribe</a>
            &nbsp;·&nbsp;
            <a href="#" style="color:#555555;text-decoration:none;letter-spacing:1px;">Privacy Policy</a>
          </p>

        </td>
      </tr>

      <!-- BOTTOM ACCENT BAR -->
      <tr>
        <td style="background:#111111;height:4px;font-size:0;line-height:0;">&nbsp;</td>
      </tr>

    </table>
    <!-- end card -->

  </td></tr>
</table>

</body>
</html> `,
  });

  return { message: "Password reset link sent to your email" };
};

export const resetPasswordService = async (code, new_password, ip) => {
  const newYorkTime = DateTime.now()
    .setZone("America/New_York")
    .toFormat("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'");
  const customer = await prisma.oc_customer.findFirst({
    where: { code: code },
    select: {
      customer_id: true,
      code: true,
      firstname: true,
      lastname: true,
    },
  });

  if (!customer || !customer.code) {
    throw new Error("Invalid or expired reset link");
  }
  const newSalt = generateSalt();
  const newHashedPassword = hashPassword(new_password, newSalt);

  await prisma.oc_customer_activity.create({
    data: {
      customer_id: customer.customer_id || 0,
      key: "forgotten",
      data: JSON.stringify({
        customer_id: customer?.customer_id,
        name: `${customer?.firstname} ${customer?.lastname}`,
      }),
      ip: ip,
      date_added: newYorkTime,
    },
  });

  await prisma.oc_customer.update({
    where: { customer_id: customer.customer_id },
    data: {
      password: newHashedPassword,
      salt: newSalt,
      code: "",
    },
  });

  return { message: "Password reset successfully. Please login." };
};

export const accountInformationService = async (customer_id, data, ip) => {
  const { ...fields } = data;
  const newYorkTime = DateTime.now()
    .setZone("America/New_York")
    .toFormat("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'");
  if (!customer_id) throw new Error("customer_id is required");

  const customer = await prisma.oc_customer.findUnique({
    where: { customer_id: customer_id },
  });
  const [existing, emailExist] = await Promise.all([
    prisma.oc_customer.findFirst({
      where: { customer_id: Number(customer_id) },
    }),
    fields.email
      ? prisma.oc_customer.findFirst({
          where: {
            email: fields.email.toLowerCase().trim(),
            NOT: { customer_id },
          },
        })
      : null,
  ]);

  if (!existing) throw new Error("Customer not found");
  if (emailExist) throw new Error("Email already exists in another account");

  const updateData = Object.fromEntries(
    Object.entries(fields)
      .filter(
        ([key, val]) => String(val).trim() !== String(existing[key]).trim(),
      )
      .map(([key, val]) => [key, String(val).trim()]),
  );

  if (!Object.keys(updateData).length)
    return { message: "No changes detected" };

  await prisma.oc_customer_activity.create({
    data: {
      customer_id: customer.customer_id || 0,
      key: "account_edit",
      data: JSON.stringify({
        customer_id: customer?.customer_id,
        name: `${customer?.firstname} ${customer?.lastname}`,
      }),
      ip: ip,
      date_added: newYorkTime,
    },
  });

  return await prisma.oc_customer.update({
    where: { customer_id: Number(customer_id) },
    data: updateData,
  });
};
