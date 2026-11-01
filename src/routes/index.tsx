import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { ExternalLink, Search } from "lucide-react";
import { previewPathPrefix } from "@/lib/preview-path-prefix";
import { POINT_TASKS, TASK_GROUPS, taskLink, type PointTask, type TaskGroup } from "@/lib/arc-tasks";
import { BowlGlow } from "@/components/bowl-glow";

export const Route = createFileRoute("/")({ component: Home });

type Badge = { name: string; count: number };

type Member = {
  rank: number;
  name: string;
  headline: string;
  location: string;
  company: string;
  avatar: string | null;
  points: number;
  tier: string | null;
  profile: string;
  badges: Badge[];
};

type Board = {
  fetchedAt: string;
  members: Member[];
  cap: number;
};

type HouseEvent = {
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

type EventFeed = { fetchedAt: string; events: HouseEvent[] };

const TIERS = ["Architect Tier 5", "Architect Tier 4", "Architect Tier 3", "Architect Tier 2", "Architect Tier 1"] as const;

function tierLabel(tier: string | null): string {
  if (!tier) return "Member";
  return tier.replace(/^Architect\s+/i, "");
}

function initials(name: string): string {
  const parts = name.split(/\s+/).filter(Boolean);
  const letters = parts.slice(0, 2).map((part) => part[0]?.toUpperCase() ?? "");
  return letters.join("") || "A";
}

const COUNTRY_FLAGS: [string, string][] = [
  ["United Arab Emirates", "AE"],
  ["United Kingdom", "GB"],
  ["United States", "US"],
  ["South Africa", "ZA"],
  ["North Macedonia", "MK"],
  ["Sri Lanka", "LK"],
  ["New Zealand", "NZ"],
  ["Saudi Arabia", "SA"],
  ["Korea, South", "KR"],
  ["Korea, North", "KP"],
  ["Gambia, The", "GM"],
  ["Congo (Kinshasa)", "CD"],
  ["Congo (Brazzaville)", "CG"],
  ["Nigeria", "NG"],
  ["Vietnam", "VN"],
  ["India", "IN"],
  ["Turkey", "TR"],
  ["Bangladesh", "BD"],
  ["Indonesia", "ID"],
  ["China", "CN"],
  ["Brazil", "BR"],
  ["Ukraine", "UA"],
  ["Pakistan", "PK"],
  ["Singapore", "SG"],
  ["Germany", "DE"],
  ["Japan", "JP"],
  ["Russia", "RU"],
  ["Thailand", "TH"],
  ["France", "FR"],
  ["Kenya", "KE"],
  ["Netherlands", "NL"],
  ["Philippines", "PH"],
  ["Spain", "ES"],
  ["Argentina", "AR"],
  ["Algeria", "DZ"],
  ["Poland", "PL"],
  ["Portugal", "PT"],
  ["Azerbaijan", "AZ"],
  ["Egypt", "EG"],
  ["Belgium", "BE"],
  ["Australia", "AU"],
  ["Ethiopia", "ET"],
  ["Ghana", "GH"],
  ["Romania", "RO"],
  ["Italy", "IT"],
  ["Malaysia", "MY"],
  ["Kazakhstan", "KZ"],
  ["Lithuania", "LT"],
  ["Canada", "CA"],
  ["Moldova", "MD"],
  ["Mexico", "MX"],
  ["Taiwan", "TW"],
  ["Colombia", "CO"],
  ["Nepal", "NP"],
  ["Switzerland", "CH"],
  ["Uganda", "UG"],
  ["Finland", "FI"],
  ["Rwanda", "RW"],
  ["Bulgaria", "BG"],
  ["Chile", "CL"],
  ["Burundi", "BI"],
  ["Tajikistan", "TJ"],
  ["Kiribati", "KI"],
  ["Tanzania", "TZ"],
  ["Guatemala", "GT"],
  ["Armenia", "AM"],
  ["Morocco", "MA"],
  ["Belarus", "BY"],
  ["Hungary", "HU"],
  ["Cyprus", "CY"],
  ["Georgia", "GE"],
  ["Aruba", "AW"],
  ["Bolivia", "BO"],
  ["Monaco", "MC"],
  ["Laos", "LA"],
  ["Czechia", "CZ"],
  ["Estonia", "EE"],
  ["Guinea", "GN"],
  ["Venezuela", "VE"],
  ["Serbia", "RS"],
  ["Croatia", "HR"],
  ["Ecuador", "EC"],
  ["Yemen", "YE"],
  ["Burma", "MM"],
  ["Mozambique", "MZ"],
  ["Iraq", "IQ"],
  ["Cameroon", "CM"],
  ["Liberia", "LR"],
  ["Austria", "AT"],
  ["Eritrea", "ER"],
  ["Sudan", "SD"],
  ["Latvia", "LV"],
  ["Ireland", "IE"],
  ["Mongolia", "MN"],
];

function countryFlag(iso: string): string {
  return [...iso.toUpperCase()].map((char) => String.fromCodePoint(127397 + char.charCodeAt(0))).join("");
}

function placeWithFlag(value: string): string {
  const text = value.trim();
  if (!text) return text;
  const match = COUNTRY_FLAGS.find(([name]) => text === name || text.endsWith(`, ${name}`));
  if (!match) return text;
  const [name, iso] = match;
  const rest = text === name ? "" : text.slice(0, -(name.length + 2)).trim();
  return rest ? `${rest} ${countryFlag(iso)}` : countryFlag(iso);
}

function countryCode(value: string): string {
  const text = value.trim();
  if (!text) return "";
  const match = COUNTRY_FLAGS.find(([name]) => text === name || text.endsWith(`, ${name}`));
  return match ? match[1] : "";
}

function CountryFlag({ code }: { code: string }) {
  const [failed, setFailed] = useState(false);
  if (!code) return null;
  if (failed) {
    return <span className="shrink-0 text-base leading-none">{countryFlag(code)}</span>;
  }
  return (
    <img
      src={`https://flagcdn.com/24x18/${code.toLowerCase()}.png`}
      alt=""
      width={20}
      height={15}
      loading="lazy"
      className="h-[15px] w-5 shrink-0 rounded-[3px] object-cover"
      onError={() => setFailed(true)}
    />
  );
}

type Section = "board" | "points" | "badges" | "events";

const SECTIONS: { id: Section; label: string }[] = [
  { id: "board", label: "Leaderboard" },
  { id: "points", label: "Earn points" },
  { id: "badges", label: "Earn badges" },
  { id: "events", label: "Events" },
];

function apiUrl(path: string): string {
  if (typeof window === "undefined") return path;
  const prefix = previewPathPrefix(window.location.hostname, window.location.pathname);
  return `${prefix ?? ""}${path}`;
}

function formatWhen(iso: string): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "";
  const mins = Math.max(0, Math.round((Date.now() - then) / 60000));
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.round(mins / 60);
  return `${hours}h ago`;
}

function Home() {
  const [board, setBoard] = useState<Board | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [tier, setTier] = useState<string>("all");
  const [badge, setBadge] = useState<string>("all");
  const [visible, setVisible] = useState(40);
  const [section, setSection] = useState<Section>("board");
  const [events, setEvents] = useState<EventFeed | null>(null);
  const [eventsError, setEventsError] = useState<string | null>(null);
  const [eventsLoading, setEventsLoading] = useState(false);
  const [eventFilter, setEventFilter] = useState<"upcoming" | "past" | "nigeria">("upcoming");

  async function loadEvents(fresh = false) {
    setEventsLoading(true);
    setEventsError(null);
    try {
      const res = await fetch(apiUrl(fresh ? "/api/events?fresh=1" : "/api/events"));
      const json = (await res.json()) as EventFeed & { error?: string };
      if (!res.ok || json.error) throw new Error(json.error || "Could not load events");
      setEvents(json);
    } catch (err) {
      setEventsError(err instanceof Error ? err.message : "Could not load events");
    } finally {
      setEventsLoading(false);
    }
  }

  async function load(fresh = false) {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(apiUrl(fresh ? "/api/leaderboard?fresh=1" : "/api/leaderboard"));
      const json = (await res.json()) as Board & { error?: string };
      if (!res.ok || json.error) throw new Error(json.error || "Could not load the board");
      setBoard(json);
      setVisible(40);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load the board");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = "https://fonts.googleapis.com/css2?family=Inter+Tight:wght@400;500;600&display=swap";
    document.head.appendChild(link);
    return () => {
      link.remove();
    };
  }, []);

  useEffect(() => {
    void load(false);
  }, []);

  useEffect(() => {
    if ((section === "events" || section === "points") && !events && !eventsLoading && !eventsError) void loadEvents(false);
  }, [section, events, eventsLoading, eventsError]);

  const badgeOptions = useMemo(() => {
    const counts = new Map<string, number>();
    for (const member of board?.members ?? []) {
      for (const item of member.badges) {
        counts.set(item.name, (counts.get(item.name) ?? 0) + 1);
      }
    }
    return [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).slice(0, 18);
  }, [board]);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return (board?.members ?? []).filter((member) => {
      if (tier === "none" && member.tier) return false;
      if (tier !== "all" && tier !== "none" && member.tier !== tier) return false;
      if (badge !== "all" && !member.badges.some((item) => item.name === badge)) return false;
      if (!needle) return true;
      const hay = [member.name, member.headline, member.location, member.company, member.tier ?? "", ...member.badges.map((item) => item.name)]
        .join(" ")
        .toLowerCase();
      return hay.includes(needle);
    });
  }, [board, query, tier, badge]);

  const badgeCatalog = useMemo(() => {
    const map = new Map<string, { holders: number; awards: number }>();
    for (const member of board?.members ?? []) {
      for (const item of member.badges) {
        const row = map.get(item.name) ?? { holders: 0, awards: 0 };
        row.holders += 1;
        row.awards += item.count;
        map.set(item.name, row);
      }
    }
    return [...map.entries()].sort((a, b) => b[1].holders - a[1].holders || a[0].localeCompare(b[0]));
  }, [board]);
  const shown = filtered.slice(0, visible);
  const leader = board?.members[0];
  const totalPoints = board?.members.reduce((sum, member) => sum + member.points, 0) ?? 0;

  return (
    <>
      <BowlGlow />
      <header className="hd-nav">
        <a className="hd-brand" href="https://community.arc.io/pages/community-contributors" target="_blank" rel="noreferrer">
          <BrandMark />
          Arc room
        </a>
        <nav className="hd-links" aria-label="Sections">
          {SECTIONS.map((item) => (
            <button key={item.id} type="button" className={section === item.id ? "on" : ""} onClick={() => setSection(item.id)}>
              {item.label}
            </button>
          ))}
        </nav>
        <div className="hd-right">
          <button
            type="button"
            className="hd-btn"
            disabled={section === "events" ? eventsLoading : loading}
            onClick={() => {
              if (section === "events") void loadEvents(true);
              else void load(true);
            }}
          >
            Refresh
            <span className="dot" aria-hidden="true">
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                <path d="M4.5 2.5 8 6l-3.5 3.5" stroke="#0b1d3a" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </span>
          </button>
        </div>
      </header>
      <main className="hd-main">
        <RevealHeadline />
        <p className="hd-trust">Public members, from the highest score to the lowest.</p>

      {section === "board" ? (
      <>

      <section className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3">
        <Stat label="Ranked" value={board ? board.members.length.toLocaleString() : "—"} />
        <Stat label="Top score" value={leader ? leader.points.toLocaleString() : "—"} hint={leader?.name} />
        <Stat label="Points on board" value={board ? totalPoints.toLocaleString() : "—"} className="col-span-2 sm:col-span-1" />
      </section>

      <section className="mt-6 flex flex-col gap-3">
        <label className="flex h-12 items-center gap-3 rounded-lg border border-line bg-panel px-3">
          <Search className="size-4 shrink-0 text-muted" aria-hidden="true" />
          <input
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setVisible(40);
            }}
            placeholder="Search name, city, company, badge"
            className="w-full bg-transparent text-sm text-fg outline-none placeholder:text-muted"
          />
        </label>
        <div className="flex gap-2 overflow-x-auto pb-1">
          <FilterChip active={tier === "all"} onClick={() => { setTier("all"); setVisible(40); }}>
            All tiers
          </FilterChip>
          {TIERS.map((name) => (
            <FilterChip
              key={name}
              active={tier === name}
              onClick={() => { setTier(name); setVisible(40); }}
            >
              {tierLabel(name)}
            </FilterChip>
          ))}
          <FilterChip active={tier === "none"} onClick={() => { setTier("none"); setVisible(40); }}>
            No tier
          </FilterChip>
        </div>
        {badgeOptions.length > 0 ? (
          <div className="flex gap-2 overflow-x-auto pb-1">
            <FilterChip active={badge === "all"} onClick={() => { setBadge("all"); setVisible(40); }}>
              All badges
            </FilterChip>
            {badgeOptions.map(([name]) => (
              <FilterChip
                key={name}
                active={badge === name}
                onClick={() => { setBadge(badge === name ? "all" : name); setVisible(40); }}
              >
                {name}
              </FilterChip>
            ))}
          </div>
        ) : null}
      </section>

      <section className="mt-4 flex items-center justify-between text-xs text-muted">
        <p>
          {board ? `${filtered.length.toLocaleString()} showing` : "Loading the public board…"}
          {board ? ` · updated ${formatWhen(board.fetchedAt)}` : ""}
        </p>
        <p className="font-mono">highest → lowest</p>
      </section>

      {error ? (
        <div className="mt-6 rounded-lg border border-line bg-panel px-4 py-6 text-sm text-fg">
          <p>{error}</p>
          <button type="button" onClick={() => void load(true)} className="mt-3 h-11 rounded-lg bg-accent px-4 font-semibold text-accent-ink">
            Try again
          </button>
        </div>
      ) : null}

      {!board && loading ? <SkeletonList /> : null}

      {board ? (
        <ol className="mt-3 flex flex-col gap-2">
          {shown.map((member) => (
            <li key={`${member.rank}-${member.profile}`}>
              <MemberRow member={member} />
            </li>
          ))}
        </ol>
      ) : null}

      {board && shown.length === 0 ? (
        <p className="mt-8 text-center text-sm text-muted">No one matches that filter.</p>
      ) : null}

      {board && visible < filtered.length ? (
        <button
          type="button"
          onClick={() => setVisible((count) => count + 40)}
          className="mx-auto mt-4 h-11 rounded-lg border border-line bg-panel px-5 text-sm text-fg"
        >
          Show more
        </button>
      ) : null}

      {board && filtered.length > 0 && visible >= filtered.length ? (
        <p className="mt-6 pb-8 text-center text-xs leading-relaxed text-muted">
          End of the public board. Profiles open on Arc House.
        </p>
      ) : null}
      </>
      ) : null}

      {section === "points" ? <EarnPoints events={events?.events ?? []} /> : null}
      {section === "badges" ? <EarnBadges catalog={badgeCatalog} loading={!board && loading} /> : null}
      {section === "events" ? (
        <EventsPanel
          feed={events}
          loading={eventsLoading}
          error={eventsError}
          filter={eventFilter}
          onFilter={setEventFilter}
          onRetry={() => void loadEvents(true)}
        />
      ) : null}
      <p className="pb-10 pt-8 text-center text-sm text-muted">
        Built by{" "}
        <a className="font-medium text-accent" href="https://x.com/ix_wilson" target="_blank" rel="noreferrer">
          ix_wilson
        </a>
      </p>
    </main>
    </>
  );
}

function Stat({ label, value, hint, className = "" }: { label: string; value: string; hint?: string; className?: string }) {
  return (
    <div className={`rounded-lg border border-line bg-panel px-4 py-3 ${className}`}>
      <p className="text-xs text-muted">{label}</p>
      <p className="mt-1 font-mono text-3xl text-fg">{value}</p>
      {hint ? <p className="mt-1 truncate text-xs text-muted">{hint}</p> : null}
    </div>
  );
}

function FilterChip({ active, onClick, children }: { active: boolean; onClick: () => void; children: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`h-10 shrink-0 rounded-full border px-3 text-xs ${
        active ? "border-accent bg-accent text-accent-ink" : "border-line bg-panel text-fg"
      }`}
    >
      {children}
    </button>
  );
}

function MemberRow({ member }: { member: Member }) {
  const top = member.rank <= 3;
  return (
    <a
      href={member.profile}
      target="_blank"
      rel="noreferrer"
      aria-label={`${member.name} on Arc House`}
      onClick={(event) => {
        if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) return;
        event.preventDefault();
        const opened = window.open(member.profile, "_blank", "noopener,noreferrer");
        if (!opened) window.location.assign(member.profile);
      }}
      className="flex cursor-pointer items-start gap-3 rounded-lg border border-line bg-panel px-3 py-3 transition-colors hover:bg-panel-2"
    >
      <span className={`mt-1 w-10 shrink-0 font-mono text-sm ${top ? "text-accent" : "text-muted"}`}>
        {member.rank}
      </span>
      <Avatar name={member.name} src={member.avatar} />
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="flex min-w-0 items-center gap-2 text-base font-semibold text-fg">
              <span className="truncate">{member.name}</span>
              <CountryFlag code={countryCode(member.location)} />
            </p>
            <p className="truncate text-xs text-muted">{member.headline || "Arc House member"}</p>
          </div>
          <div className="shrink-0 text-right">
            <p className="font-mono text-base text-accent">{member.points.toLocaleString()}</p>
            <p className="text-xs text-muted">pts</p>
          </div>
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          {member.tier ? (
            <span className="rounded-full border border-accent px-2 py-0.5 text-xs text-accent">{tierLabel(member.tier)}</span>
          ) : null}
          {member.badges.slice(0, 4).map((item) => (
            <span key={item.name} className="rounded-full bg-panel-2 px-2 py-0.5 text-xs text-fg">
              {item.name}
              {item.count > 1 ? ` ×${item.count}` : ""}
            </span>
          ))}
          {member.badges.length > 4 ? (
            <span className="text-xs text-muted">+{member.badges.length - 4}</span>
          ) : null}
        </div>
      </div>
    </a>
  );
}

function Avatar({ name, src }: { name: string; src: string | null }) {
  const [broken, setBroken] = useState(false);
  if (!src || broken) {
    return (
      <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-panel-2 font-mono text-xs text-accent">
        {initials(name)}
      </span>
    );
  }
  return (
    <img
      src={src}
      alt=""
      width={44}
      height={44}
      className="size-11 shrink-0 rounded-full object-cover"
      onError={() => setBroken(true)}
    />
  );
}

function SkeletonList() {
  return (
    <div className="mt-3 flex flex-col gap-2" aria-hidden="true">
      {Array.from({ length: 8 }, (_, index) => (
        <div key={index} className="h-20 rounded-lg border border-line bg-panel" />
      ))}
    </div>
  );
}

function BrandMark() {
  const [src, setSrc] = useState("/arc-logo.png");
  useEffect(() => {
    setSrc(apiUrl("/arc-logo.png"));
  }, []);
  return <img src={src} alt="" width={40} height={40} className="hd-logo" />;
}

function paintLetter(node: HTMLElement, t: number, highlight: boolean) {
  const ghost = [255, 255, 255];
  const accent = [63, 124, 255];
  const navy = [11, 29, 58];
  const final = highlight ? [91, 124, 240] : navy;
  let opacity = 0;
  let blur = 8;
  let color = ghost;
  if (t <= 0) {
    opacity = 0;
  } else if (t < 0.35) {
    const u = t / 0.35;
    opacity = u;
    blur = 8 - u * 6.5;
  } else if (t < 0.7) {
    const u = (t - 0.35) / 0.35;
    opacity = 1;
    blur = 1.5 * (1 - u);
    color = mixRgb(ghost, accent, u);
  } else {
    const u = Math.min(1, (t - 0.7) / 0.3);
    opacity = 1;
    blur = 0;
    color = mixRgb(accent, final, u);
  }
  node.style.opacity = String(opacity);
  node.style.color = `rgb(${color[0]}, ${color[1]}, ${color[2]})`;
  node.style.filter = blur > 0.05 ? `blur(${blur}px)` : "none";
}

function mixRgb(a: number[], b: number[], t: number) {
  return [Math.round(a[0] + (b[0] - a[0]) * t), Math.round(a[1] + (b[1] - a[1]) * t), Math.round(a[2] + (b[2] - a[2]) * t)];
}

function splitWord(text: string, highlight: boolean, key: string) {
  return (
    <span key={key} style={{ display: "inline-block", whiteSpace: "nowrap" }}>
      {[...text].map((char, index) => (
        <span key={`${key}-${index}`} data-ch="" data-hl={highlight ? "" : undefined} style={{ display: "inline-block" }}>
          {char}
        </span>
      ))}
    </span>
  );
}

function RevealHeadline() {
  const ref = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    const root = ref.current;
    if (!root) return;
    const nodes = [...root.querySelectorAll<HTMLElement>("[data-ch]")];
    const count = nodes.length || 1;
    const start = performance.now();
    let frame = 0;
    const tick = (now: number) => {
      const p = Math.min(1, (now - start) / 1250);
      nodes.forEach((node, index) => {
        const spread = 0.35;
        const t = Math.min(1, Math.max(0, (p * (1 + spread) - index / count) / spread));
        paintLetter(node, t, node.hasAttribute("data-hl"));
      });
      if (p < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, []);
  return (
    <h1 ref={ref} className="hd-h1">
      {splitWord("Arc", false, "a")}
      {" "}
      {splitWord("room", true, "b")}
    </h1>
  );
}

function SectionIntro({ title, children }: { title: string; children: string }) {
  return (
    <div className="mt-6">
      <h2 className="text-3xl font-medium tracking-tight text-fg">{title}</h2>
      <p className="mt-2 max-w-2xl text-base leading-relaxed text-muted">{children}</p>
    </div>
  );
}

function EarnPoints({ events }: { events: HouseEvent[] }) {
  return (
    <div className="pb-10">
      <SectionIntro title="Earn points">
        Each task opens the Arc House page where you earn it: a live event, a blog, a video, or the forum.
      </SectionIntro>
      <p className="mt-3 text-xs text-muted">
        <a className="text-accent" href="https://community.arc.io/public/contributors/contribution-rules" target="_blank" rel="noreferrer">
          Official rules
        </a>
      </p>
      <div className="mt-5 flex flex-col gap-6">
        {TASK_GROUPS.map((group) => (
          <TaskGroupBlock key={group} group={group} tasks={POINT_TASKS.filter((task) => task.group === group)} events={events} />
        ))}
      </div>
    </div>
  );
}

function TaskGroupBlock({ group, tasks, events }: { group: TaskGroup; tasks: PointTask[]; events: HouseEvent[] }) {
  const ordered = [...tasks].sort((a, b) => (b.points ?? -1) - (a.points ?? -1));
  return (
    <section>
      <h3 className="font-mono text-xs tracking-widest text-muted uppercase">{group}</h3>
      <ul className="mt-2 flex flex-col gap-2">
        {ordered.map((task) => {
          const link = taskLink(task.id, events);
          return (
            <li key={task.id}>
              <a
                href={link.href}
                target="_blank"
                rel="noreferrer"
                className="flex items-start justify-between gap-3 rounded-lg border border-line bg-panel px-3 py-3 hover:bg-panel-2"
              >
                <div className="min-w-0">
                  <p className="text-base font-semibold text-fg">{task.name}</p>
                  <p className="mt-1 text-sm leading-relaxed text-muted">{task.detail}</p>
                  <p className="mt-1 truncate text-sm text-accent">{link.label}</p>
                  {task.cap ? <p className="mt-1 text-xs text-muted">{task.cap}</p> : null}
                </div>
                <p className="shrink-0 text-right font-mono text-base text-accent">
                  {task.points === null ? "Badge" : task.points.toLocaleString()}
                  {task.points === null ? null : <span className="mt-1 block text-xs text-muted">pts</span>}
                </p>
              </a>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function EarnBadges({
  catalog,
  loading,
}: {
  catalog: [string, { holders: number; awards: number }][];
  loading: boolean;
}) {
  return (
    <div className="pb-10">
      <SectionIntro title="Earn badges">
        Contribution badges held by people on the public board. The tasks on Earn points are what unlock them. Architect tier badges sit on the profile separately.
      </SectionIntro>
      <h3 className="mt-6 font-mono text-xs tracking-widest text-muted uppercase">On the board</h3>
      {loading ? <SkeletonList /> : null}
      {!loading && catalog.length === 0 ? <p className="mt-3 text-sm text-muted">No badges on the public board yet.</p> : null}
      <ul className="mt-2 flex flex-col gap-2">
        {catalog.map(([name, stats]) => (
          <li key={name} className="flex items-center justify-between gap-3 rounded-lg border border-line bg-panel px-3 py-3">
            <p className="text-sm font-semibold text-fg">{name}</p>
            <p className="shrink-0 text-right text-xs text-muted">
              <span className="font-mono text-sm text-accent">{stats.holders.toLocaleString()}</span> holders
              {stats.awards > stats.holders ? ` · ${stats.awards.toLocaleString()} awarded` : ""}
            </p>
          </li>
        ))}
      </ul>
      <h3 className="mt-6 font-mono text-xs tracking-widest text-muted uppercase">Badge only</h3>
      <ul className="mt-2 flex flex-col gap-2">
        {POINT_TASKS.filter((task) => task.points === null).map((task) => (
          <li key={task.id} className="rounded-lg border border-line bg-panel px-3 py-3">
            <p className="text-sm font-semibold text-fg">{task.name}</p>
            <p className="mt-1 text-xs leading-relaxed text-muted">{task.detail}</p>
          </li>
        ))}
      </ul>
    </div>
  );
}

function EventsPanel({
  feed,
  loading,
  error,
  filter,
  onFilter,
  onRetry,
}: {
  feed: EventFeed | null;
  loading: boolean;
  error: string | null;
  filter: "upcoming" | "past" | "nigeria";
  onFilter: (filter: "upcoming" | "past" | "nigeria") => void;
  onRetry: () => void;
}) {
  const rows = (feed?.events ?? []).filter((event) => {
    if (filter === "nigeria") return /nigeria/i.test(`${event.club} ${event.place} ${event.title}`);
    if (filter === "past") return !event.upcoming;
    return event.upcoming;
  });
  return (
    <div className="pb-10">
      <SectionIntro title="Events">
        Meetups, webinars, and livestreams listed on Arc House. Showing up in person is worth more points than joining online.
      </SectionIntro>
      <div className="mt-4 flex gap-2 overflow-x-auto pb-1">
        <FilterChip active={filter === "upcoming"} onClick={() => onFilter("upcoming")}>
          Upcoming
        </FilterChip>
        <FilterChip active={filter === "nigeria"} onClick={() => onFilter("nigeria")}>
          Nigeria
        </FilterChip>
        <FilterChip active={filter === "past"} onClick={() => onFilter("past")}>
          Past
        </FilterChip>
      </div>
      {error ? (
        <div className="mt-4 rounded-lg border border-line bg-panel px-4 py-6 text-sm text-fg">
          <p>{error}</p>
          <button type="button" onClick={onRetry} className="mt-3 h-11 rounded-lg bg-accent px-4 font-semibold text-accent-ink">
            Try again
          </button>
        </div>
      ) : null}
      {loading && !feed ? <SkeletonList /> : null}
      {!loading && !error && rows.length === 0 ? <p className="mt-6 text-sm text-muted">Nothing in this list right now.</p> : null}
      <ul className="mt-3 flex flex-col gap-2">
        {rows.map((event) => (
          <li key={event.href}>
            <a href={event.href} target="_blank" rel="noreferrer" className="block rounded-lg border border-line bg-panel px-3 py-3 hover:bg-panel-2">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-xs text-accent">
                    {event.type}
                    {event.club ? ` · ${event.club}` : ""}
                  </p>
                  <p className="mt-1 text-sm font-semibold text-fg">{event.title}</p>
                </div>
                <ExternalLink className="mt-1 size-4 shrink-0 text-muted" aria-hidden="true" />
              </div>
              <p className="mt-2 text-xs text-muted">
                {[event.dateLabel, event.when, placeWithFlag(event.place)].filter(Boolean).join(" · ")}
              </p>
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}
