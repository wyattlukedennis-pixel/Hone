import { Resend } from "resend";
import { config } from "../config.js";

let client: Resend | null = null;

function getClient(): Resend | null {
  if (client) return client;
  const key = config.email.resendApiKey;
  if (!key) return null;
  client = new Resend(key);
  return client;
}

export async function sendPasswordResetEmail(to: string, code: string) {
  const resend = getClient();
  if (!resend) {
    console.log(`[email] No RESEND_API_KEY — password reset code for ${to}: ${code}`);
    return;
  }

  console.log(`[email] Sending password reset to ${to} from ${config.email.fromAddress}`);

  try {
    const result = await resend.emails.send({
      from: config.email.fromAddress,
      to,
      subject: "Hone — Reset your password",
      html: `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 420px; margin: 0 auto; padding: 32px 20px;">
          <h2 style="color: #1a1a1a; font-size: 22px; margin-bottom: 8px;">Reset your password</h2>
          <p style="color: #666; font-size: 15px; line-height: 1.5;">Enter this code in the app to set a new password:</p>
          <div style="background: #f5f0eb; border-radius: 12px; padding: 20px; text-align: center; margin: 20px 0;">
            <span style="font-size: 32px; font-weight: 800; letter-spacing: 6px; color: #1a1a1a;">${code}</span>
          </div>
          <p style="color: #999; font-size: 13px;">This code expires in 15 minutes. If you didn't request this, you can ignore this email.</p>
        </div>
      `
    });
    console.log(`[email] Sent successfully:`, JSON.stringify(result));
  } catch (error) {
    console.error(`[email] Failed to send:`, error);
  }
}
