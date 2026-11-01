import nonceFactory from "./gradual-nonce.js";

const TENANT_ID = "688b1c42d1f8bff20fcac7a4";
const TOP_HASH = "2d82f2deed463451967903b5af2934902b3e637c971dd10e4364c91b19079dee";
const PAGE = 100;
const MAX_SKIP = 2000;
const TTL_MS = 10 * 60 * 1000;

export type HouseBadge = { name: string; count: number };

export type HouseMember = {
  rank: number;
  name: string;
  headline: string;
  location: string;
  company: string;
  avatar: string | null;
  points: number;
  tier: string | null;
  profile: string;
  badges: HouseBadge[];
};

export type HouseBoard = {
  fetchedAt: string;
  members: HouseMember[];
  cap: number;
};

type NonceExports = {
  addNonceHeader?: (req: {
    url: string;
    method: string;
    headers: Record<string, string>;
  }) => { headers: Record<string, string> };
};

const nonceExports: NonceExports = {};
nonceFactory({ exports: nonceExports }, nonceExports, () => {
  throw new Error("nonce signer has no dependencies");
});

type RawBadge = { name?: string | null } | null;
type RawUserStat = {
  count?: number | null;
  countType?: string | null;
  countSource?: RawBadge;
};
type RawUser = {
  displayName?: string | null;
  headline?: string | null;
  pictureUrl?: string | null;
  nanoId?: string | null;
  userId?: string | null;
  displayLocation?: string | null;
  position?: string | null;
  company?: { name?: string | null } | null;
  profileBadge?: { name?: string | null } | null;
  totalContributionPoints?: number | null;
  contributionStatistics?: RawUserStat[] | null;
};
type RawRow = {
  point?: number | null;
  userId?: string | null;
  tenantUser?: RawUser | null;
};

type CacheSlot = { at: number; board: HouseBoard };
const globalRef = globalThis as typeof globalThis & {
  __arcHouseBoard?: CacheSlot;
  __arcHouseFlight?: Promise<HouseBoard>;
};

function sign(url: string): Record<string, string> {
  const signHeader = nonceExports.addNonceHeader;
  if (!signHeader) throw new Error("Arc House signer unavailable");
  const headers: Record<string, string> = {
    "x-client": "Gradual - v4.36.0",
    accept: "application/json",
    "content-type": "application/json",
    "x-locale": "en",
    "x-session-id": crypto.randomUUID(),
    "x-request-id": crypto.randomUUID(),
    origin: "https://community.arc.io",
    referer: "https://community.arc.io/pages/community-contributors",
    "user-agent": "Mozilla/5.0",
  };
  return signHeader({ url, method: "GET", headers }).headers;
}

async function fetchPage(skip: number): Promise<RawRow[]> {
  const qs = new URLSearchParams({
    operationName: "GetTopContributionStatistics",
    variables: JSON.stringify({ tenantId: TENANT_ID, skip, limit: PAGE }),
    extensions: JSON.stringify({
      persistedQuery: { version: 1, sha256Hash: TOP_HASH },
    }),
  });
  const url = `https://community.arc.io/api/graphql?${qs.toString()}`;
  let lastError = "Arc House did not respond";
  for (let attempt = 0; attempt < 3; attempt++) {
    const res = await fetch(url, { headers: sign(url) });
    const text = await res.text();
    if (!res.ok) {
      lastError = `Arc House returned ${res.status}`;
      continue;
    }
    const json = JSON.parse(text) as {
      errors?: { message?: string }[];
      data?: { contributionStatistics?: RawRow[] };
    };
    if (json.errors?.length) {
      lastError = json.errors[0]?.message || "Arc House query failed";
      if (lastError.includes("maximum offset")) return [];
      continue;
    }
    return json.data?.contributionStatistics ?? [];
  }
  throw new Error(lastError);
}

function badgesOf(user: RawUser): HouseBadge[] {
  const rows = user.contributionStatistics ?? [];
  const out: HouseBadge[] = [];
  for (const row of rows) {
    if (row.countType !== "Badge") continue;
    const name = row.countSource?.name?.trim();
    const count = row.count ?? 0;
    if (!name || count <= 0) continue;
    if (/^architect tier/i.test(name)) continue;
    out.push({ name, count });
  }
  out.sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
  return out;
}

function toMember(row: RawRow): HouseMember | null {
  const user = row.tenantUser;
  if (!user) return null;
  const name = user.displayName?.trim() || "Arc member";
  const points = row.point ?? user.totalContributionPoints ?? 0;
  const nano = user.nanoId?.trim();
  const id = user.userId?.trim();
  const profile = nano
    ? `https://community.arc.io/home/users/${nano}`
    : id
      ? `https://community.arc.io/home/users/${id}`
      : "https://community.arc.io/pages/community-contributors";
  return {
    rank: 0,
    name,
    headline: user.headline?.trim() || user.position?.trim() || "",
    location: user.displayLocation?.trim() || "",
    company: user.company?.name?.trim() || "",
    avatar: user.pictureUrl?.trim() || null,
    points,
    tier: user.profileBadge?.name?.trim() || null,
    profile,
    badges: badgesOf(user),
  };
}

async function loadBoard(): Promise<HouseBoard> {
  const skips: number[] = [];
  for (let skip = 0; skip <= MAX_SKIP; skip += PAGE) skips.push(skip);
  const pages: RawRow[][] = [];
  let cursor = 0;
  const workers = Array.from({ length: 6 }, async () => {
    while (cursor < skips.length) {
      const index = cursor++;
      const skip = skips[index];
      if (skip === undefined) return;
      pages[index] = await fetchPage(skip);
    }
  });
  await Promise.all(workers);

  const seen = new Set<string>();
  const members: HouseMember[] = [];
  for (const page of pages) {
    for (const row of page ?? []) {
      const member = toMember(row);
      if (!member) continue;
      const key = row.userId || row.tenantUser?.userId || member.profile;
      if (seen.has(key)) continue;
      seen.add(key);
      members.push(member);
    }
  }
  members.sort((a, b) => b.points - a.points || a.name.localeCompare(b.name));
  members.forEach((member, index) => {
    member.rank = index + 1;
  });
  return {
    fetchedAt: new Date().toISOString(),
    members,
    cap: MAX_SKIP + PAGE,
  };
}

export async function getBoard(fresh = false): Promise<HouseBoard> {
  const cached = globalRef.__arcHouseBoard;
  if (!fresh && cached && Date.now() - cached.at < TTL_MS) return cached.board;
  if (!fresh && globalRef.__arcHouseFlight) return globalRef.__arcHouseFlight;

  const flight = loadBoard()
    .then((board) => {
      globalRef.__arcHouseBoard = { at: Date.now(), board };
      globalRef.__arcHouseFlight = undefined;
      return board;
    })
    .catch((error) => {
      globalRef.__arcHouseFlight = undefined;
      throw error;
    });
  globalRef.__arcHouseFlight = flight;
  return flight;
}
