export const routePaths = {
  login: "/login",
  providers: "/providers",
  people: "/people",
  licenses: "/licenses",
  streamers: "/streamers",
  mailSettings: "/settings/mail",
};

export const STATUSES = ["ready", "sent", "replied", "blocked"];
export const STATUS_TONE = { ready: "neutral", sent: "info", replied: "success", blocked: "error" };
export const CATEGORIES = ["aggregator", "direct-provider", "live-casino", "originals-crash", "platform"];
export const LICENSE_CATEGORIES = ["licensing-agent", "law-firm", "consultancy", "corporate-services", "regulator"];
export const QUALITIES = ["perfect", "normal"];
export const PER_PAGE_OPTIONS = [10, 25, 50, 100];
export const DEFAULT_PER_PAGE = 25;
export const PLATFORMS = ["kick", "twitch"];
export const channelUrl = (s) => (s.platform === "kick" ? `https://kick.com/${s.username}` : `https://www.twitch.tv/${s.username}`);
