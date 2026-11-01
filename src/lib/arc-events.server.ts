export type HouseEvent = {
  title: string;
  type: string;
  club: string;
  when: string;
  dateLabel: string;
  place: string;
  href: string;
  start: string | null;
  end: string | null;
  upcoming: boolean;
};

export type EventFeed = {
  fetchedAt: string;
  events: HouseEvent[];
};

const EVENTS_URL = "https://community.arc.io/public/events";
const TTL_MS = 10 * 60 * 1000;

type CacheSlot = { at: number; feed: EventFeed };
const globalRef = globalThis as typeof globalThis & {
  __arcHouseEvents?: CacheSlot;
  __arcHouseEventsFlight?: Promise<EventFeed>;
};

const MONTHS: Record<string, number> = {
  jan: 0,
  january: 0,
  feb: 1,
  february: 1,
  mar: 2,
  march: 2,
  apr: 3,
  april: 3,
  may: 4,
  jun: 5,
  june: 5,
  jul: 6,
  july: 6,
  aug: 7,
  august: 7,
  sep: 8,
  sept: 8,
  september: 8,
  oct: 9,
  october: 9,
  nov: 10,
  november: 10,
  dec: 11,
  december: 11,
};

function decode(value: string): string {
  let out = value;
  for (let pass = 0; pass < 3; pass++) {
    const next = out
      .replace(/\u0026amp;/g, "\u0026")
      .replace(/\u0026quot;/g, '"')
      .replace(/\u0026#x27;|\u0026apos;/g, "'")
      .replace(/\u0026lt;/g, "<")
      .replace(/\u0026gt;/g, ">")
      .replace(/\u0026#(\d+);/g, (_, digits: string) => String.fromCharCode(Number(digits)));
    if (next === out) break;
    out = next;
  }
  return out;
}

function iso(year: number, month: number, day: number): string | null {
  if (month < 0 || month > 11 || day < 1 || day > 31) return null;
  const date = new Date(Date.UTC(year, month, day));
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString().slice(0, 10);
}

function parseDateToken(token: string, fallbackYear: number | null): { iso: string; year: number } | null {
  const match = token
    .trim()
    .match(/^([A-Za-z]+)\.?\s+(\d{1,2})(?:,?\s*(\d{4}))?$/);
  if (!match) return null;
  const month = MONTHS[match[1].toLowerCase()];
  if (month === undefined) return null;
  const year = match[3] ? Number(match[3]) : fallbackYear;
  if (!year) return null;
  const day = iso(year, month, Number(match[2]));
  return day ? { iso: day, year } : null;
}

function parseRange(label: string): { start: string | null; end: string | null } {
  const cleaned = label.replace(/\s+/g, " ").trim();
  const parts = cleaned.split(/\s+[–—-]\s+/);
  const endYear = cleaned.match(/(\d{4})\s*$/)?.[1];
  const year = endYear ? Number(endYear) : null;
  const start = parseDateToken(parts[0] ?? "", year);
  const end = parts[1] ? parseDateToken(parts[1], year) : start;
  return { start: start?.iso ?? null, end: end?.iso ?? start?.iso ?? null };
}

function todayUtc(): string {
  return new Date().toISOString().slice(0, 10);
}

function parseEvents(html: string): HouseEvent[] {
  const today = todayUtc();
  const seen = new Set<string>();
  const events: HouseEvent[] = [];
  for (const card of html.split("tenant-event-card-link")) {
    if (!card.includes("DisplayEventTypeLabel")) continue;
    const href = /href="([^"?#]+)"/.exec(card)?.[1];
    if (!href || seen.has(href)) continue;
    const grab = (pattern: RegExp) => {
      const match = pattern.exec(card);
      if (!match) return "";
      return decode(match[1].replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim();
    };
    const type = grab(/DisplayEventTypeLabel[^>]*>(.*?)<\/div>/);
    const club = grab(/StyledClubName[^>]*>(.*?)<\/span>/);
    const title = grab(/id="event-name-[^"]+"[^>]*>(.*?)<\/div>/);
    if (!title || !type) continue;
    seen.add(href);
    const texts = [...card.matchAll(/>([^<]+)</g)]
      .map((match) => decode(match[1]).replace(/\s+/g, " ").trim())
      .filter((text) => text && text !== "·" && text !== "Register" && text !== "Album" && text !== "Replay");
    const rest = texts.filter((text) => text !== type && text !== club && text !== title);
    const when = rest[0] ?? "";
    const dateLabel = rest[1] ?? "";
    const place = rest[2] ?? (type === "Livestream" || type === "Webinar" ? "Online" : "");
    const range = parseRange(dateLabel);
    const end = range.end ?? range.start;
    events.push({
      title,
      type,
      club,
      when,
      dateLabel,
      place,
      href: `https://community.arc.io${href}`,
      start: range.start,
      end,
      upcoming: end ? end >= today : true,
    });
  }
  events.sort((a, b) => {
    if (a.upcoming !== b.upcoming) return a.upcoming ? -1 : 1;
    const left = a.start ?? "";
    const right = b.start ?? "";
    return a.upcoming ? left.localeCompare(right) : right.localeCompare(left);
  });
  return events;
}

async function loadEvents(): Promise<EventFeed> {
  const res = await fetch(EVENTS_URL, {
    headers: {
      accept: "text/html",
      "user-agent": "Mozilla/5.0",
    },
    signal: AbortSignal.timeout(20000),
  });
  if (!res.ok) throw new Error(`Arc events returned ${res.status}`);
  const html = await res.text();
  const events = parseEvents(html);
  if (events.length === 0) throw new Error("Arc events page had no listings");
  return { fetchedAt: new Date().toISOString(), events };
}

export async function getEvents(fresh = false): Promise<EventFeed> {
  const cached = globalRef.__arcHouseEvents;
  if (!fresh && cached && Date.now() - cached.at < TTL_MS) return cached.feed;
  if (!fresh && globalRef.__arcHouseEventsFlight) return globalRef.__arcHouseEventsFlight;
  const flight = loadEvents()
    .then((feed) => {
      globalRef.__arcHouseEvents = { at: Date.now(), feed };
      globalRef.__arcHouseEventsFlight = undefined;
      return feed;
    })
    .catch((error) => {
      globalRef.__arcHouseEventsFlight = undefined;
      throw error;
    });
  globalRef.__arcHouseEventsFlight = flight;
  return flight;
}
