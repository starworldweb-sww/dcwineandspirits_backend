export const getNewsletterWelcomeTemplate = (email) => {
    return `
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>Welcome to Our Newsletter</title>
        <link href="https://fonts.googleapis.com/css2?family=Hind+Madurai:wght@400;500;600;700&display=swap" rel="stylesheet" />
        <style>
            @media only screen and (max-width: 620px) {
                .email-wrapper { padding: 24px 12px !important; }
                .email-container { width:100% !important; max-width:100% !important; border-radius:0 !important; }
                .email-header, .email-body, .email-footer { padding-left:24px !important; padding-right:24px !important; }
                .email-title { font-size:22px !important; }
            }
        </style>
    </head>
    <body style="margin:0; padding:0; background-color:#f0ece7; font-family:'Hind Madurai', Arial, Helvetica, sans-serif;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f0ece7; padding: 48px 0;" class="email-wrapper">
            <tr>
                <td align="center">
                    <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="background-color:#ffffff; border-radius:10px; overflow:hidden; box-shadow: 0 6px 24px rgba(26,26,26,0.08); width:600px; max-width:600px;" class="email-container">

                        <!-- Header -->
                        <tr>
                            <td align="center" style="background-color:#1a1a1a; padding: 34px 40px 34px;" class="email-header">
                                <img src="https://www.dcwineandspirits.com/image/catalog/logo/fav-icon.png" alt="DC Wine & Spirits" width="64" style="display:block;margin:0 auto;max-width:64px;height:auto;border-radius:8px;" />
                                <p style="margin:16px 0 0; font-family:'Hind Madurai', Arial, sans-serif; font-size:13px; letter-spacing:2px; color:#ffffff; font-weight:600;">
                                    DC WINE &amp; SPIRITS
                                </p>
                                <p style="margin:6px 0 0; font-family:'Hind Madurai', Arial, sans-serif; font-size:11px; letter-spacing:3px; text-transform:uppercase; color:#c9a35a;">
                                    Build Your Relationships
                                </p>
                            </td>
                        </tr>

                        <!-- Accent bar -->
                        <tr>
                            <td style="background:linear-gradient(90deg,#c9a35a,#98022e,#c9a35a); height:3px; line-height:3px; font-size:0;">&nbsp;</td>
                        </tr>

                        <!-- Title -->
                        <tr>
                            <td align="center" style="padding: 38px 40px 8px;" class="email-header">
                                <h1 style="margin:0; font-family:'Hind Madurai', Arial, sans-serif; font-size:27px; font-weight:600; color:#1a1a1a; letter-spacing:0.3px;" class="email-title">
                                    Welcome Aboard
                                </h1>
                            </td>
                        </tr>

                        <!-- Body -->
                        <tr>
                            <td style="padding: 14px 48px 8px;" class="email-body">
                                <p style="font-size:15px; color:#4a4a4a; margin:0 0 18px; line-height:1.8; text-align:center;">
                                    Hi there,
                                </p>
                                <p style="font-size:15px; color:#4a4a4a; line-height:1.8; margin:0 0 18px; text-align:center;">
                                    Thank you for subscribing to the DC Wine &amp; Spirits newsletter. You will now be
                                    the first to know about our latest updates, exclusive offers, and new arrivals.
                                </p>

                                <p style="font-size:15px; color:#4a4a4a; line-height:1.8; margin:0 0 30px; text-align:center;">
                                    As a thank-you gift, here is <strong style="color:#1a1a1a;">$10 off</strong> your first order.
                                </p>

                                <!-- Coupon Box -->
                                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#faf6f1; border:1px solid #ecdfd0; border-radius:8px; margin-bottom: 22px;">
                                    <tr>
                                        <td align="center" style="padding: 28px 20px;">
                                            <p style="margin:0; font-size:11px; color:#98022e; letter-spacing:2px; text-transform:uppercase; font-weight:600;">
                                                Your Coupon Code
                                            </p>
                                            <p style="margin:12px 0 0; font-size:28px; font-weight:700; color:#1a1a1a; letter-spacing:3px; font-family:'Hind Madurai', Arial, sans-serif;">
                                                WELCOME10
                                            </p>
                                        </td>
                                    </tr>
                                </table>

                                <p style="font-size:13px; color:#7a7a7a; line-height:1.6; text-align:center; margin: 0 0 6px;">
                                    Use this code at checkout to get $10 off your first purchase.
                                </p>

                                <p style="font-size:13px; color:#7a7a7a; line-height:1.6; text-align:center; margin: 0 0 32px;">
                                    Valid on orders with a product subtotal of $99 or more.
                                </p>

                                <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                                    <tr>
                                        <td align="center" style="padding-bottom: 36px;">
                                            <a href="https://www.dcwineandspirits.com"
                                               style="background-color:#98022e; color:#ffffff; text-decoration:none; padding: 16px 44px; border-radius: 6px; font-size:14px; font-weight:600; letter-spacing:1px; text-transform:uppercase; display:inline-block;">
                                                Start Shopping
                                            </a>
                                        </td>
                                    </tr>
                                </table>
                            </td>
                        </tr>

                        <!-- Footer -->
                        <tr>
                            <td style="background-color:#1a1a1a; padding: 30px 40px; text-align:center;" class="email-footer">
                                <p style="font-size:12px; color:#999999; margin:0 0 8px;">
                                    You're receiving this email because you subscribed with ${email}.
                                </p>
                                <p style="font-size:11px; color:#777777; margin:0;">
                                    &copy; ${new Date().getFullYear()} DC Wine &amp; Spirits. All rights reserved.
                                </p>
                            </td>
                        </tr>

                    </table>
                </td>
            </tr>
        </table>
    </body>
    </html>
    `;
};