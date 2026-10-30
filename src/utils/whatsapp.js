
import "dotenv/config";
import twilio from "twilio";
import { getActiveRecipients } from "../modules/notification/notification.service.js";

const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);

const clean = (v) =>
  String(v ?? "-").replace(/[\r\n\t]+/g, " ").replace(/ {2,}/g, " ").trim() || "-";

export async function sendOrderWhatsApp({
  orderId,
  productName,
  productCode = "",
  location,
  price,
  delivery,
  store = "",
}) {
  try {
    const recipients = await getActiveRecipients(store);

    if (!recipients.length) {
      console.log("WhatsApp skipped: no numbers added in admin panel");
      return;
    }

    const contentVariables = JSON.stringify({
      1: clean(orderId),      
      2: clean(productName),  
      3: clean(productCode),  
      4: clean(location),     
      5: clean(price),       
      6: clean(delivery),    
    });

    const results = await Promise.allSettled(
      recipients.map((to) =>
        client.messages.create({
          from: process.env.TWILIO_WA_FROM,
          to,
          contentSid: process.env.TWILIO_CONTENT_SID,
          contentVariables,
        })
      )
    );

    results.forEach((r, i) => {
      if (r.status === "fulfilled") console.log("WhatsApp queued:", recipients[i], r.value.sid);
      else console.error("WhatsApp failed:", recipients[i], r.reason?.code, r.reason?.message);
    });
  } catch (err) {
    console.error("WhatsApp error:", err.message);
  }
}