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
  // encrypts the Resend API keys saved in the app; changing it makes the saved keys unreadable
  mailSecret: process.env.MAIL_SECRET || required('JWT_SECRET'),
  mail: {
    dryRun: process.env.MAIL_DRY_RUN === 'true',
    // Before Resend accounts were set in the app: read once, to create the first integration and sender.
    legacy: {
      resendKey: process.env.RESEND_API_KEY || '',
      from: (process.env.RESEND_FROM || '').trim(),
      replyTo: (process.env.MAIL_REPLY_TO || '').trim(),
      delayMs: process.env.MAIL_DELAY_MS ? Number(process.env.MAIL_DELAY_MS) : null,
    },
  },
};
