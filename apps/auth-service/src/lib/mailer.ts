import nodemailer from 'nodemailer';
import path from 'path';
import fs from 'fs';

function reloadEnv() {
  try {
    const candidates = [
      path.resolve(process.cwd(), '.env'),
      path.resolve(process.cwd(), '../../.env'),
      '/home/ray/Projects/PayRoll/.env',
    ];
    for (const c of candidates) {
      if (fs.existsSync(c)) {
        process.loadEnvFile?.(c);
        break;
      }
    }
  } catch (_) {}
}

export function getTransporter() {
  reloadEnv();
  const user = process.env.GMAIL_USER;
  const pass = process.env.GMAIL_APP_PASSWORD;

  if (!user || !pass) {
    return null;
  }

  return nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: user.trim(),
      pass: pass.trim().replace(/\s+/g, ''), // buang spasi jika ada
    },
  });
}

export async function sendResetPasswordEmail(to: string, resetLink: string, employeeName: string) {
  reloadEnv();
  const gmailUser = process.env.GMAIL_USER;
  const sender = gmailUser ? `"PayrollPro" <${gmailUser.trim()}>` : '"PayrollPro" <noreply@payrollpro.com>';

  // Selalu tampilkan link di console terminal agar mudah dites secara lokal
  console.log(`\n======================================================`);
  console.log(`[AUTH-SERVICE] 🔑 Tautan Reset Password untuk: ${to} (${employeeName})`);
  console.log(`[AUTH-SERVICE] 🔗 ${resetLink}`);
  console.log(`======================================================\n`);

  const transporter = getTransporter();

  if (!transporter) {
    console.warn(
      `[AUTH-SERVICE] ⚠️ Email TIDAK terkirim ke Gmail karena GMAIL_USER atau GMAIL_APP_PASSWORD belum diisi di file .env root!\n` +
      `Silakan tambahkan di .env:\n` +
      `GMAIL_USER=emailanda@gmail.com\n` +
      `GMAIL_APP_PASSWORD=abcdefghijklmnop\n`
    );
    return;
  }

  try {
    const info = await transporter.sendMail({
      from: sender,
      to,
      subject: 'Reset Password Akun PayrollPro',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 8px;">
          <h2 style="color: #1e293b; margin-top: 0;">PayrollPro — Reset Password</h2>
          <p>Halo <strong>${employeeName}</strong>,</p>
          <p>Kami menerima permintaan reset password untuk akun Anda. Klik tombol di bawah ini untuk membuat password baru:</p>
          <p style="margin: 24px 0;">
            <a href="${resetLink}" style="background-color: #2563eb; color: #ffffff; padding: 12px 24px; border-radius: 6px; text-decoration: none; font-weight: bold; display: inline-block;">
              Reset Password
            </a>
          </p>
          <p style="color: #64748b; font-size: 13px;">
            Link ini berlaku selama <strong>30 menit</strong>. Jika Anda tidak meminta perubahan ini, abaikan email ini — password Anda tetap aman.
          </p>
          <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 20px 0;" />
          <p style="color: #94a3b8; font-size: 11px;">
            Jika tombol di atas tidak dapat diklik, salin dan tempel tautan berikut ke browser Anda:<br />
            <a href="${resetLink}" style="color: #2563eb;">${resetLink}</a>
          </p>
        </div>
      `,
    });
    console.log(`[AUTH-SERVICE] ✅ Email reset password berhasil terkirim ke ${to} (Message ID: ${info.messageId})`);
    return info;
  } catch (error) {
    console.error(`[AUTH-SERVICE] ❌ Gagal mengirim email via Gmail SMTP ke ${to}:`, error);
  }
}
