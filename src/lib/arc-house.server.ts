import nonceFactory from "./gradual-nonce.js";

const TENANT_ID = "688b1c42d1f8bff20fcac7a4";
const TOP_HASH = "2d82f2deed463451967903b5af2934902b3e637c971dd10e4364c91b19079dee";
const PAGE = 100;
const MAX_SKIP = 2000;
const RANK_API = "https://house-rank.vercel.app/api/members";
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
  team: string[];
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
  __arcHouseBoardV5?: CacheSlot;
  __arcHouseFlightV5?: Promise<HouseBoard>;
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
    out.push({ name, count });
  }
  out.sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
  return out;
}

function tierOf(user: RawUser, badges: HouseBadge[]): string | null {
  const profile = user.profileBadge?.name?.trim();
  if (profile) return profile;
  const fromBadge = badges.find((badge) => /architect|tier/i.test(badge.name));
  return fromBadge?.name ?? null;
}

function decodeText(value: string): string {
  const amp = "&" + "amp;";
  const lt = "&" + "lt;";
  const gt = "&" + "gt;";
  const quot = "&" + "quot;";
  const apos = "&" + "apos;";
  const num = "&" + "#39;";
  let text = value;
  for (let guard = 0; guard < 4; guard++) {
    if (!text.includes(amp) && !text.includes(lt) && !text.includes(gt) && !text.includes(quot) && !text.includes(apos) && !text.includes(num)) break;
    text = text.split(amp).join("&").split(lt).join("<").split(gt).join(">").split(quot).join('"').split(num).join("'").split(apos).join("'");
  }
  return text.trim();
}

function nameKeys(name: string): string[] {
  const fold = (value: string) =>
    value
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, " ")
      .trim();
  const keys = new Set<string>();
  const full = fold(name);
  if (full) keys.add(full);
  const nick = name.match(/\(([^)]+)\)/);
  if (nick?.[1]) {
    const folded = fold(nick[1]);
    if (folded) keys.add(folded);
  }
  const base = fold(name.replace(/\([^)]*\)/g, " "));
  if (base) keys.add(base);
  return [...keys];
}

async function loadTeamRoles(): Promise<Map<string, string[]>> {
  const map = new Map<string, string[]>();
  try {
    const res = await fetch("https://community.arc.io/pages/community-contributors", {
      headers: { "user-agent": "Mozilla/5.0", accept: "text/html" },
    });
    if (!res.ok) return map;
    const html = await res.text();
    const names = [...html.matchAll(/class="ahc-name">([^<]+)/g)].map((match) => decodeText(match[1] ?? ""));
    const roles = [...html.matchAll(/class="ahc-role">([^<]+)/g)].map((match) => decodeText(match[1] ?? ""));
    names.forEach((name, index) => {
      const role = roles[index];
      if (!name || !role) return;
      for (const key of nameKeys(name)) {
        const list = map.get(key) ?? [];
        if (!list.includes(role)) list.push(role);
        map.set(key, list);
      }
    });
  } catch {
    return map;
  }
  return map;
}

function teamRolesFor(name: string, teams: Map<string, string[]>): string[] {
  const roles = new Set<string>();
  for (const key of nameKeys(name)) {
    for (const role of teams.get(key) ?? []) roles.add(role);
  }
  return [...roles];
}

function toMember(row: RawRow, teams: Map<string, string[]>): HouseMember | null {
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
  const badges = badgesOf(user);
  return {
    rank: 0,
    name,
    headline: user.headline?.trim() || user.position?.trim() || "",
    location: user.displayLocation?.trim() || "",
    company: user.company?.name?.trim() || "",
    avatar: user.pictureUrl?.trim() || null,
    points,
    tier: tierOf(user, badges),
    team: teamRolesFor(name, teams),
    profile,
    badges,
  };
}

type RankRow = {
  userId?: string;
  name?: string;
  headline?: string;
  position?: string;
  pictureUrl?: string | null;
  location?: string;
  company?: string | null;
  points?: number;
  badge?: string | null;
  profileBadge?: { name?: string | null } | null;
};

function fromRank(row: RankRow, teams: Map<string, string[]>): HouseMember | null {
  const name = row.name?.trim();
  const userId = row.userId?.trim();
  if (!name || !userId) return null;
  const tierName = row.profileBadge?.name?.trim() || "";
  const badgeName = row.badge?.trim() || "";
  const badges: HouseBadge[] = [];
  if (badgeName && badgeName.toLowerCase() !== "none") badges.push({ name: badgeName, count: 1 });
  return {
    rank: 0,
    name,
    headline: row.headline?.trim() || row.position?.trim() || "",
    location: row.location?.trim() || "",
    company: row.company?.trim() || "",
    avatar: row.pictureUrl?.trim() || null,
    points: row.points ?? 0,
    tier: tierName && tierName.toLowerCase() !== "none" ? tierName : tierOf({ profileBadge: null }, badges),
    team: teamRolesFor(name, teams),
    profile: `https://community.arc.io/home/users/${userId}`,
    badges,
  };
}

async function fetchRankPage(offset: number): Promise<{ total: number; members: RankRow[] }> {
  const url = `${RANK_API}?q=&tier=all&offset=${offset}&limit=100`;
  const res = await fetch(url, { headers: { accept: "application/json", "user-agent": "Mozilla/5.0" } });
  if (!res.ok) throw new Error(`Member directory returned ${res.status}`);
  const json = (await res.json()) as { total?: number; members?: RankRow[] };
  return { total: json.total ?? 0, members: json.members ?? [] };
}

async function loadRankDirectory(): Promise<RankRow[]> {
  try {
    const first = await fetchRankPage(0);
    const rows = [...first.members];
    const offsets: number[] = [];
    for (let offset = PAGE; offset < first.total; offset += PAGE) offsets.push(offset);
    const pages: RankRow[][] = [];
    let cursor = 0;
    await Promise.all(
      Array.from({ length: 8 }, async () => {
        while (cursor < offsets.length) {
          const index = cursor++;
          const offset = offsets[index];
          if (offset === undefined) return;
          pages[index] = (await fetchRankPage(offset)).members;
        }
      }),
    );
    for (const page of pages) rows.push(...(page ?? []));
    return rows;
  } catch {
    return [];
  }
}

async function loadBoard(): Promise<HouseBoard> {
  const skips: number[] = [];
  for (let skip = 0; skip <= MAX_SKIP; skip += PAGE) skips.push(skip);
  const pages: RawRow[][] = [];
  let cursor = 0;
  const directoryPromise = loadRankDirectory();
  const teamsPromise = loadTeamRoles();
  const workers = Array.from({ length: 6 }, async () => {
    while (cursor < skips.length) {
      const index = cursor++;
      const skip = skips[index];
      if (skip === undefined) return;
      pages[index] = await fetchPage(skip);
    }
  });
  const [teams, directory] = await Promise.all([teamsPromise, directoryPromise, Promise.all(workers)]).then(
    ([teamMap, rows]) => [teamMap, rows] as const,
  );

  const seen = new Set<string>();
  const members: HouseMember[] = [];
  for (const page of pages) {
    for (const row of page ?? []) {
      const member = toMember(row, teams);
      if (!member) continue;
      const key = row.userId || row.tenantUser?.userId || member.profile;
      if (seen.has(key)) continue;
      seen.add(key);
      members.push(member);
    }
  }
  for (const row of directory) {
    const key = row.userId?.trim();
    if (!key || seen.has(key)) continue;
    const member = fromRank(row, teams);
    if (!member) continue;
    seen.add(key);
    members.push(member);
  }
  members.sort((a, b) => b.points - a.points || a.name.localeCompare(b.name));
  members.forEach((member, index) => {
    member.rank = index + 1;
  });
  return {
    fetchedAt: new Date().toISOString(),
    members,
    cap: members.length,
  };
}

export async function getBoard(fresh = false): Promise<HouseBoard> {
  const cached = globalRef.__arcHouseBoardV5;
  if (!fresh && cached && Date.now() - cached.at < TTL_MS) return cached.board;
  if (!fresh && globalRef.__arcHouseFlightV5) return globalRef.__arcHouseFlightV5;

  const flight = loadBoard()
    .then((board) => {
      globalRef.__arcHouseBoardV5 = { at: Date.now(), board };
      globalRef.__arcHouseFlightV5 = undefined;
      return board;
    })
    .catch((error) => {
      globalRef.__arcHouseFlightV5 = undefined;
      throw error;
    });
  globalRef.__arcHouseFlightV5 = flight;
  return flight;
}
