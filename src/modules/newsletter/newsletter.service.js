import { prisma } from "../../../lib/prisma.js";
import { transporter } from "../../config/nodemiller.js";

const getNewsletterWelcomeTemplate = (email) => {
    return `
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>Welcome to Our Newsletter</title>
    </head>
    <body style="margin:0; padding:0; background-color:#f4f4f7; font-family: Arial, Helvetica, sans-serif;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f4f7; padding: 30px 0;">
            <tr>
                <td align="center">
                    <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="background-color:#ffffff; border-radius:8px; overflow:hidden; box-shadow: 0 2px 6px rgba(0,0,0,0.08);">
                        
                        <!-- Header -->
                        <tr>
                            <td style="background-color:#1a1a2e; padding: 24px; text-align:center;">
                                <h1 style="color:#ffffff; margin:0; font-size:22px;">Welcome Aboard! 🎉</h1>
                            </td>
                        </tr>

                        <!-- Body -->
                        <tr>
                            <td style="padding: 32px;">
                                <p style="font-size:16px; color:#333333; margin-top:0;">
                                    Hi there,
                                </p>
                                <p style="font-size:16px; color:#333333; line-height:1.6;">
                                    Thank you for subscribing to our newsletter! You'll now be the first to know about
                                    our latest updates, exclusive offers, and new arrivals.
                                </p>

                                <p style="font-size:16px; color:#333333; line-height:1.6;">
                                    As a thank-you gift, here's <strong>$10 off</strong> your first order:
                                </p>

                                <!-- Coupon Box -->
                                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin: 24px 0;">
                                    <tr>
                                        <td align="center">
                                            <div style="border: 2px dashed #ff6b35; border-radius: 8px; padding: 18px 30px; display:inline-block; background-color:#fff8f5;">
                                                <p style="margin:0; font-size:13px; color:#888888; letter-spacing:1px; text-transform:uppercase;">
                                                    Your Coupon Code
                                                </p>
                                                <p style="margin:6px 0 0; font-size:28px; font-weight:bold; color:#ff6b35; letter-spacing:2px;">
                                                    WCG10
                                                </p>
                                            </div>
                                        </td>
                                    </tr>
                                </table>

                                <p style="font-size:14px; color:#666666; line-height:1; text-align:center;">
Get <strong>$10 off</strong> your first purchase when you use this code at checkout.   </p>

<p style="font-size:14px; color:#666666; line-height:1; text-align:center;">
  <strong>This coupon can be applied only on product subtotal of $99 or more.</strong>
</p>
                                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top: 28px;">
                                    <tr>
                                        <td align="center">
                                            <a href="https://www.dcwineandspirits.com/" 
                                               style="background-color:#ff6b35; color:#ffffff; text-decoration:none; padding: 14px 32px; border-radius: 6px; font-size:16px; font-weight:bold; display:inline-block;">
                                                Start Shopping
                                            </a>
                                        </td>
                                    </tr>
                                </table>
                            </td>
                        </tr>

                        <!-- Footer -->
                        <tr>
                            <td style="background-color:#f4f4f7; padding: 20px; text-align:center;">
                                <p style="font-size:12px; color:#999999; margin:0;">
                                    You're receiving this email because you subscribed with ${email}.
                                </p>
                                <p style="font-size:12px; color:#999999; margin:6px 0 0;">
                                    &copy; ${new Date().getFullYear()} DC Wine & Spirits. All rights reserved.
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

export const newsletterService = async (email, ip) => {
    try {
        const existingEmail = await prisma.oc_journal3_newsletter.findFirst({
            where: {
                email: email
            }
        });

        if (existingEmail) {
            return {
                success: false,
                message: "You have already subscribed to our newsletter."
            };
        }

        const data = await prisma.oc_journal3_newsletter.create({
            data: {
                name: "",
                email: email,
                ip: ip,
                store_id: 0
            }
        });

        await transporter.sendMail({
            from: `" Wine & champagne gifts "${process.env.MAIL_FROM_NAME}" <${process.env.MAIL_FROM}>`,
            to: email,
            subject: "Welcome! Here's your $10 coupon 🎁",
            html: getNewsletterWelcomeTemplate(email)
        });

        return {
            success: true,
            message: "Thank you for subscribing! You'll now receive our latest updates, offers, and $10 off your first order.",
            data
        };

    } catch (error) {
        console.error("Newsletter subscription error:", error);
        return {
            success: false,
            message: "Something went wrong. Please try again later."
        };
    }
};