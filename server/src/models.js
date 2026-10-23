import mongoose from 'mongoose';

export const STATUSES = ['ready', 'sent', 'replied', 'blocked'];
export const CATEGORIES = ['aggregator', 'direct-provider', 'live-casino', 'originals-crash', 'platform'];
export const COMMERCIAL_FIELDS = [
  'setupFee', 'monthlyMinimum', 'revenueShare', 'gameRoyalties', 'prepayment',
  'sandbox', 'integration', 'markets', 'licenceEligibility', 'contractExit',
];

const userSchema = new mongoose.Schema(
  {
    username: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true },
    // Bumped on password change so older tokens stop working.
    tokenVersion: { type: Number, default: 0 },
  },
  { timestamps: true },
);

const text = { type: String, default: '', trim: true };
const list = { type: [String], default: [] };
// Set by the mail sender (mail.js) on every row it emails.
const mailFields = {
  emailCount: { type: Number, default: 0 },
  lastEmailAt: { type: Date, default: null },
  lastEmailSubject: { type: String, default: '' },
  lastEmailError: { type: String, default: '' },
};

const providerSchema = new mongoose.Schema(
  {
    slug: { type: String, required: true, unique: true },
    name: { type: String, required: true, trim: true },
    aliases: list,
    categories: { type: [{ type: String, enum: CATEGORIES }], default: [] },
    description: text,
    website: text,
    linkedin: text,
    contactPage: text,
    isCasinoProvider: text,
    providerCount: text,
    gameCount: text,
    liveContent: text,
    headquarters: text,
    pricing: text,
    contact: text,
    shortlistRank: { type: Number, default: null },
    // 1 = most popular; the list is sorted by it
    order: { type: Number, default: null, index: true },
    emails: list,
    phones: list,
    urls: list,
    notes: list,
    commercial: Object.fromEntries(COMMERCIAL_FIELDS.map((f) => [f, text])),
    evidence: { type: mongoose.Schema.Types.Mixed, default: {} },
    sources: list,
    status: { type: String, enum: STATUSES, default: 'ready', index: true },
    content: { type: String, default: '', maxlength: 200000 },
    ...mailFields,
  },
  { timestamps: true, minimize: false },
);
providerSchema.index({ name: 1 });

export const QUALITIES = ['perfect', 'normal'];

const personSchema = new mongoose.Schema(
  {
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    phone: text,
    country: { ...text, index: true },
    // ISO code (NL) or calling code (93), as the export gives it
    countryCode: text,
    // perfect = human-looking email and a plausible phone (from the export's perfect.csv)
    quality: { type: String, enum: QUALITIES, default: 'normal', index: true },
    status: { type: String, enum: STATUSES, default: 'ready', index: true },
    content: { type: String, default: '', maxlength: 200000 },
    ...mailFields,
  },
  { timestamps: true },
);

export const LICENSE_CATEGORIES = ['licensing-agent', 'law-firm', 'consultancy', 'corporate-services', 'regulator'];

// Companies that help get a gambling licence (and the regulators themselves).
const licenseSchema = new mongoose.Schema(
  {
    slug: { type: String, required: true, unique: true },
    name: { type: String, required: true, trim: true },
    aliases: list,
    category: { type: String, enum: [...LICENSE_CATEGORIES, ''], default: '' },
    jurisdictions: { ...list, index: true },
    services: list,
    website: text,
    linkedin: text,
    contactPage: text,
    emails: list,
    phones: list,
    headquarters: text,
    pricing: text,
    timeline: text,
    notes: list,
    urls: list,
    sources: list,
    order: { type: Number, default: null, index: true },
    status: { type: String, enum: STATUSES, default: 'ready', index: true },
    content: { type: String, default: '', maxlength: 200000 },
    ...mailFields,
  },
  { timestamps: true },
);

export const PLATFORMS = ['kick', 'twitch'];

// Casino, slots and poker streamers found live on Kick and Twitch.
const streamerSchema = new mongoose.Schema(
  {
    // platform + username, e.g. kick-roshtein
    slug: { type: String, required: true, unique: true },
    platform: { type: String, enum: PLATFORMS, required: true, index: true },
    username: { type: String, required: true, lowercase: true, trim: true },
    displayName: text,
    category: { ...text, index: true },
    language: { ...text, index: true },
    country: text,
    followers: { type: Number, default: null, index: true },
    // viewers the last time the stream was seen live
    viewers: { type: Number, default: null },
    verified: { type: Boolean, default: false },
    bio: text,
    lastTitle: text,
    lastLiveAt: { type: Date, default: null },
    emails: list,
    socials: list,
    notes: list,
    sources: list,
    status: { type: String, enum: STATUSES, default: 'ready', index: true },
    content: { type: String, default: '', maxlength: 200000 },
    ...mailFields,
  },
  { timestamps: true },
);
streamerSchema.index({ username: 1 });

export const DEFAULT_DAILY_MAIL_LIMIT = 100;

// App-wide settings, one document per key (only "mail" for now).
const settingSchema = new mongoose.Schema(
  {
    key: { type: String, required: true, unique: true },
    // most emails (recipient addresses) sent per UTC day; 0 stops sending
    dailyLimit: { type: Number, default: DEFAULT_DAILY_MAIL_LIMIT, min: 0, max: 100000 },
  },
  { timestamps: true },
);

// Emails sent on one UTC day (YYYY-MM-DD), checked against the daily limit.
const mailDaySchema = new mongoose.Schema({
  day: { type: String, required: true, unique: true },
  sent: { type: Number, default: 0 },
});

export const Setting = mongoose.model('Setting', settingSchema);
export const MailDay = mongoose.model('MailDay', mailDaySchema);
export const User = mongoose.model('User', userSchema);
export const Streamer = mongoose.model('Streamer', streamerSchema);
export const License = mongoose.model('License', licenseSchema);
export const Person = mongoose.model('Person', personSchema);
export const Provider = mongoose.model('Provider', providerSchema);

export function slugify(name) {
  return String(name).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}
