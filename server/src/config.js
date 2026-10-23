function required(name) {
  const value = process.env[name];
  if (!value) {
    console.error(`Missing env var ${name} (see .env.example)`);
    process.exit(1);
  }
  return value;
}

export const config = {
  mongoUri: required('MONGO_URI'),
  jwtSecret: required('JWT_SECRET'),
  apiPort: Number(process.env.API_PORT || 4200),
  webPort: Number(process.env.WEB_PORT || 4201),
  mail: {
    // Resend API key (re_...); empty = sending is off
    resendKey: process.env.RESEND_API_KEY || '',
    // "Name <address>" on a domain verified in Resend; onboarding@resend.dev only reaches the account owner
    from: (process.env.RESEND_FROM || '').trim(),
    replyTo: (process.env.MAIL_REPLY_TO || '').trim(),
    // pause between two emails, so the mail provider does not flag the account
    delayMs: Number(process.env.MAIL_DELAY_MS || 3000),
    dryRun: process.env.MAIL_DRY_RUN === 'true',
  },
};
