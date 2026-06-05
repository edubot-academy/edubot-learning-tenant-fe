const ALLOWED_LIVE_MEETING_HOSTS = [
  'zoom.us',
  'meet.google.com',
  'teams.microsoft.com',
  'msteams.link',
  'web.telegram.org',
  't.me',
  'wa.me',
];

const ALLOWED_LIVE_MEETING_PROTOCOLS = new Set(['https:']);

function isAllowedLiveMeetingHost(hostname: string) {
  const normalizedHost = hostname.toLowerCase();
  return ALLOWED_LIVE_MEETING_HOSTS.some((allowedHost) => (
    normalizedHost === allowedHost || normalizedHost.endsWith(`.${allowedHost}`)
  ));
}

export function getSafeLiveMeetingUrl(value?: string | null) {
  if (!value) return null;

  try {
    const url = new URL(value);
    if (!ALLOWED_LIVE_MEETING_PROTOCOLS.has(url.protocol)) return null;
    if (!isAllowedLiveMeetingHost(url.hostname)) return null;
    return url.toString();
  } catch {
    return null;
  }
}

export function getSafeLiveMeetingHref(...values: Array<string | null | undefined>) {
  for (const value of values) {
    const safeUrl = getSafeLiveMeetingUrl(value);
    if (safeUrl) return safeUrl;
  }

  return null;
}
