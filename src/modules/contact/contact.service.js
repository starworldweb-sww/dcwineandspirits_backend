import { transporter } from "../../config/nodemiller.js";

const FONT_STACK = "'Helvetica Neue', Helvetica, Arial, sans-serif";
const COLOR_MAROON = "#98022e";
const COLOR_LIGHT = "#eeeeee";
const COLOR_WHITE = "#ffffff";
export const contactServices = async (data) => {

    const contact_data = await transporter.sendMail({
        from: `${data?.email} <${data?.email}>`,
        to: "contact@dcwineandspirits.com",
        subject: ` New Contact Form Submission from ${data?.email}`,
        html: `
        <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 620px; margin: 0 auto; background-color: #f4f4f4; padding: 30px;">
            
            <!-- Card Wrapper -->
            <div style="background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.08);">
                
                <!-- Header Banner -->
                <div style="background: linear-gradient(135deg, #080808, #202020); padding: 30px 35px;">
                    <h1 style="margin: 0; color: #ffffff; font-size: 22px; font-weight: 700; letter-spacing: 0.5px;">
                         DC Wine & Spirits
                    </h1>
                    <p style="margin: 6px 0 0; color: rgba(255,255,255,0.85); font-size: 14px;">
                        New Contact Form Submission
                    </p>
                </div>

                <!-- Body -->
                <div style="padding: 30px 35px;">

                    <p style="margin: 0 0 24px; color: #555; font-size: 15px;">
                        You have received a new message from the contact form. Details are below:
                    </p>

                    <div style="display: flex; align-items: center; background: #f5f5f5; border-left: 4px solid #555555; border-radius: 8px; padding: 14px 18px; margin-bottom: 14px;">
    <span style="font-size: 20px; margin-right: 14px;">👤</span>
    <div>
        <p style="margin: 0; font-size: 11px; text-transform: uppercase; letter-spacing: 1px; color: #999; font-weight: 800;">Name</p>
        <p style="margin: 4px 0 0; font-size: 15px; color: #333; font-weight: 500;">${data?.name}</p>
    </div>
</div>
                    <!-- Info Card: Email -->
<div style="display: flex; align-items: center; background: #f5f5f5; border-left: 4px solid #555555; border-radius: 8px; padding: 14px 18px; margin-bottom: 14px;">
    <span style="font-size: 20px; margin-right: 14px;">✉️</span>
    <div>
        <p style="margin: 0; font-size: 11px; text-transform: uppercase; letter-spacing: 1px; color: #999; font-weight: 800;">Email Address</p>
        <p style="margin: 4px 0 0; font-size: 15px; color: #333; font-weight: 500;">${data?.email}</p>
    </div>
</div>

<!-- Info Card: Mobile -->
<div style="display: flex; align-items: center; background: #f5f5f5; border-left: 4px solid #555555; border-radius: 8px; padding: 14px 18px; margin-bottom: 14px;">
    <span style="font-size: 20px; margin-right: 14px;">📱</span>
    <div>
        <p style="margin: 0; font-size: 11px; text-transform: uppercase; letter-spacing: 1px; color: #999; font-weight: 800;">Mobile Number</p>
        <p style="margin: 4px 0 0; font-size: 15px; color: #333; font-weight: 500;">${data?.phone}</p>
    </div>
</div>

<!-- Message Box -->
<div style="background: #f5f5f5; border: 1px solid #dddddd; border-left: 4px solid #555555; border-radius: 8px; padding: 18px 20px; margin-top: 6px;">
    <p style="margin: 0 0 10px; font-size: 11px; text-transform: uppercase; letter-spacing: 1px; color: #999; font-weight: 800;">💬 Message</p>
    <p style="margin: 0; font-size: 15px; color: #444; line-height: 1.7; white-space: pre-wrap;">${data?.message}</p>
</div>

                    <!-- CTA Button -->
                    <div style="text-align: center; margin-top: 28px;">
                        <a href="mailto:${data?.email}" 
                           style="display: inline-block; background: linear-gradient(135deg, #000000, #2d2d2d); color: #ffffff; text-decoration: none; padding: 13px 32px; border-radius: 50px; font-size: 15px; font-weight: 600; letter-spacing: 0.5px;">
                            Reply to ${data?.email}
                        </a>
                    </div>

                </div>

                <!-- Footer -->
                <div style="background: #f0f0f0; padding: 16px 35px; text-align: center; border-top: 1px solid #e0e0e0;">
                    <p style="margin: 0; font-size: 12px; color: #aaa;">
                        This email was sent from the contact form at 
                        <a href="https://dcwineandspirits.com/" style="color: #7b2d8b; text-decoration: none;">wineandchampagnegifts.com</a>
                    </p>
                </div>

            </div>
        </div>
    `,
        text: `
New Contact Form Submission - DC Wine & Spirits
=====================================================
Email:   ${data?.email}
Mobile:  ${data?.phone}
Message: ${data?.message}
=====================================================
Reply at: ${data?.email}
    `.trim()
    });

    return contact_data;
}




export const bulkOrderServices = async (data) => {
  // data expected shape: { name, email, mobile_no, file }
  // `file` comes from multer memoryStorage — has originalname, buffer, mimetype
 
  // ================= EMAIL 1: to DC Wine & Spirits team =================
  const adminMail = await transporter.sendMail({
    from: `DC Wine & Spirits <contact@dcwineandspirits.com>`,
    replyTo: data?.email,
    to: "contact@dcwineandspirits.com",
    subject: `New Bulk Order Submission from ${data?.name}`,
    attachments: data?.file
      ? [
          {
            filename: data.file.originalname,
            content: data.file.buffer,
          },
        ]
      : [],
    html: `
        <div style="font-family: ${FONT_STACK}; max-width: 620px; margin: 0 auto; background-color: ${COLOR_LIGHT}; padding: 30px;">
            <div style="background-color: ${COLOR_WHITE}; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.08);">
 
                <!-- Header Banner -->
                <div style="background-color: ${COLOR_MAROON}; padding: 30px 35px;">
                    <h1 style="margin: 0; color: ${COLOR_WHITE}; font-size: 22px; font-weight: 700; letter-spacing: 0.5px;">
                        DC Wine &amp; Spirits
                    </h1>
                    <p style="margin: 6px 0 0; color: rgba(255,255,255,0.85); font-size: 14px;">
                        New Bulk Order Form Submission
                    </p>
                </div>
 
                <!-- Body -->
                <div style="padding: 30px 35px;">
 
                    <p style="margin: 0 0 24px; color: #555; font-size: 15px;">
                        A customer has submitted a bulk order form. Details are below:
                    </p>
 
                    <div style="background: ${COLOR_LIGHT}; border-left: 4px solid ${COLOR_MAROON}; border-radius: 8px; padding: 14px 18px; margin-bottom: 14px;">
                        <p style="margin: 0; font-size: 11px; text-transform: uppercase; letter-spacing: 1px; color: #999; font-weight: 700;">Name</p>
                        <p style="margin: 4px 0 0; font-size: 15px; color: #333; font-weight: 500;">${data?.name}</p>
                    </div>
 
                    <div style="background: ${COLOR_LIGHT}; border-left: 4px solid ${COLOR_MAROON}; border-radius: 8px; padding: 14px 18px; margin-bottom: 14px;">
                        <p style="margin: 0; font-size: 11px; text-transform: uppercase; letter-spacing: 1px; color: #999; font-weight: 700;">Email Address</p>
                        <p style="margin: 4px 0 0; font-size: 15px; color: #333; font-weight: 500;">${data?.email}</p>
                    </div>
 
                    <div style="background: ${COLOR_LIGHT}; border-left: 4px solid ${COLOR_MAROON}; border-radius: 8px; padding: 14px 18px; margin-bottom: 14px;">
                        <p style="margin: 0; font-size: 11px; text-transform: uppercase; letter-spacing: 1px; color: #999; font-weight: 700;">Mobile Number</p>
                        <p style="margin: 4px 0 0; font-size: 15px; color: #333; font-weight: 500;">${data?.mobile_no}</p>
                    </div>
 
                    <div style="background: ${COLOR_LIGHT}; border: 1px solid #dddddd; border-left: 4px solid ${COLOR_MAROON}; border-radius: 8px; padding: 18px 20px; margin-top: 6px;">
                        <p style="margin: 0 0 6px; font-size: 11px; text-transform: uppercase; letter-spacing: 1px; color: #999; font-weight: 700;">Attached File</p>
                        <p style="margin: 0; font-size: 15px; color: #444;">${data?.file?.originalname || "No file attached"}</p>
                    </div>
 
                    <!-- CTA Button -->
                    <div style="text-align: center; margin-top: 28px;">
                        <a href="mailto:${data?.email}"
                           style="display: inline-block; background-color: ${COLOR_MAROON}; color: ${COLOR_WHITE}; text-decoration: none; padding: 13px 32px; border-radius: 50px; font-size: 15px; font-weight: 600; letter-spacing: 0.5px;">
                            Reply to ${data?.name}
                        </a>
                    </div>
 
                </div>
 
                <!-- Footer -->
                <div style="background: ${COLOR_LIGHT}; padding: 16px 35px; text-align: center; border-top: 1px solid #e0e0e0;">
                    <p style="margin: 0; font-size: 12px; color: #aaa;">
                        This email was sent from the bulk order form at
                        <a href="https://dcwineandspirits.com/" style="color: ${COLOR_MAROON}; text-decoration: none;">dcwineandspirits.com</a>
                    </p>
                </div>
 
            </div>
        </div>
    `,
    text: `
New Bulk Order Submission - DC Wine & Spirits
=====================================================
Name:    ${data?.name}
Email:   ${data?.email}
Mobile:  ${data?.mobile_no}
File:    ${data?.file?.originalname || "No file attached"}
=====================================================
Reply at: ${data?.email}
    `.trim(),
  });
 
  // ================= EMAIL 2: confirmation to the user =================
  const userMail = await transporter.sendMail({
    from: `DC Wine & Spirits <contact@dcwineandspirits.com>`,
    to: data?.email,
    subject: `We've received your bulk order request`,
 
    html: `
        <div style="font-family: ${FONT_STACK}; max-width: 560px; margin: 0 auto; background-color: ${COLOR_LIGHT}; padding: 30px;">
            <div style="background-color: ${COLOR_WHITE}; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.08);">
 
                <!-- Header Banner -->
                <div style="background-color: ${COLOR_MAROON}; padding: 30px 35px;">
                    <h1 style="margin: 0; color: ${COLOR_WHITE}; font-size: 22px; font-weight: 700; letter-spacing: 0.5px;">
                        DC Wine &amp; Spirits
                    </h1>
                    <p style="margin: 6px 0 0; color: rgba(255,255,255,0.85); font-size: 14px;">
                        Bulk Order Request Received
                    </p>
                </div>
 
                <!-- Body -->
                <div style="padding: 30px 35px;">
                    <p style="margin: 0 0 16px; color: #333; font-size: 16px; font-weight: 600;">
                        Hi ${data?.name},
                    </p>
                    <p style="margin: 0 0 20px; color: #555; font-size: 15px; line-height: 1.6;">
                        Thank you for submitting your bulk order form. Our team has received your
                        request and will review it shortly. We'll get back to you at
                        <strong>${data?.email}</strong> or call you at <strong>${data?.mobile_no}</strong>
                        within 24 hours.
                    </p>
 
                    <div style="background: ${COLOR_LIGHT}; border-left: 4px solid ${COLOR_MAROON}; border-radius: 8px; padding: 16px 20px; margin-top: 10px;">
                        <p style="margin: 0; font-size: 13px; color: #666; line-height: 1.6;">
                            If you have any urgent questions in the meantime, feel free to reach us at
                            <a href="mailto:contact@dcwineandspirits.com" style="color: ${COLOR_MAROON}; text-decoration: none; font-weight: 600;">contact@dcwineandspirits.com</a>
                            or call <strong>(202) 459-8489</strong>.
                        </p>
                    </div>
                </div>
 
                <!-- Footer -->
                <div style="background: ${COLOR_LIGHT}; padding: 16px 35px; text-align: center; border-top: 1px solid #e0e0e0;">
                    <p style="margin: 0; font-size: 12px; color: #aaa;">
                        DC Wine &amp; Spirits ·
                        <a href="https://dcwineandspirits.com/" style="color: ${COLOR_MAROON}; text-decoration: none;">dcwineandspirits.com</a>
                    </p>
                </div>
 
            </div>
        </div>
    `,
    text: `
Hi ${data?.name},
 
Thank you for submitting your bulk order form. Our team has received your
request and will review it shortly. We'll get back to you at ${data?.email}
or call you at ${data?.mobile_no} within 24 hours.
 
Questions in the meantime? Reach us at contact@dcwineandspirits.com or
call (202) 459-8489.
 
— DC Wine & Spirits
    `.trim(),
  });
 
  return { adminMail, userMail };
};