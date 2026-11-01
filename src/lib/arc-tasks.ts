export type TaskGroup = "Events" | "Content" | "Forum" | "Community" | "Other";

export type PointTask = {
  id: string;
  group: TaskGroup;
  name: string;
  detail: string;
  points: number | null;
  cap: string | null;
};

export type TaskLink = { href: string; label: string };

const ARC = "https://community.arc.io";

const TASK_LINKS: Record<string, TaskLink> = {
  "event-organizer": {
    href: `${ARC}/public/blogs/seeking-additional-arc-house-chapter-leads-2026-10-19`,
    label: "Chapter leads",
  },
  "meetup-organizer": {
    href: `${ARC}/pages/regional-chapters`,
    label: "Regional chapters",
  },
  "event-speaker": {
    href: `${ARC}/public/events/arc-x-catena-building-financial-infrastructure-for-ai-agents`,
    label: "Arc x Catena",
  },
  "virtual-chapter": {
    href: `${ARC}/public/clubs/korea/events/korea-member-check-in-or-regional-updates-and-live-demos-qpvn05mnjb`,
    label: "Korea member check-in",
  },
  roundtable: {
    href: `${ARC}/public/events/arc-x-catena-building-financial-infrastructure-for-ai-agents`,
    label: "Arc x Catena",
  },
  "in-person": {
    href: `${ARC}/public/events/ethglobal-mumbai-g23qyrr90e`,
    label: "ETHGlobal Mumbai",
  },
  "online-event": {
    href: `${ARC}/public/events/arc-x-catena-building-financial-infrastructure-for-ai-agents`,
    label: "Arc x Catena",
  },
  author: {
    href: `${ARC}/public/blogs/guest-post-beyond-the-first-transaction-building-pulsar-on-arc-2026-10-20`,
    label: "Guest post on Arc",
  },
  "video-speaker": {
    href: `${ARC}/public/videos/arc-mainnet-launch-event-community-and-developer-pre-show-2026-09-19`,
    label: "Mainnet launch pre-show",
  },
  "watch-video": {
    href: `${ARC}/public/videos/gateway-now-supports-eurc-and-cirbtc-2026-10-28`,
    label: "Gateway video",
  },
  "read-content": {
    href: `${ARC}/public/blogs/how-crossmint-makes-stablecoin-apps-and-the-agentic-economy-easier-to-build-on-arc-2026-10-20`,
    label: "Crossmint on Arc",
  },
  "accepted-answer": {
    href: `${ARC}/home/forum/boards/circle-products-and-developer-toolings-0iw`,
    label: "Circle products forum",
  },
  "publish-post": {
    href: `${ARC}/home/forum/boards/ecosystem-showcase-and-launches-pdq`,
    label: "Ecosystem showcase",
  },
  comment: {
    href: `${ARC}/home/forum/boards/member-lounge-la1`,
    label: "Member lounge",
  },
  onboarding: { href: `${ARC}/home`, label: "Your Arc House profile" },
  "join-club": { href: `${ARC}/public/clubs`, label: "Clubs" },
  "daily-active": { href: `${ARC}/home`, label: "Arc House home" },
  grant: {
    href: `${ARC}/home/resources/circle-developer-grants-questions-and-answers`,
    label: "Circle Developer Grants",
  },
  "technical-beta": {
    href: `${ARC}/home/forum/boards/circle-products-and-developer-toolings-0iw`,
    label: "Developer tooling forum",
  },
  training: { href: `${ARC}/public/courses`, label: "Courses" },
  "studio-user": { href: `${ARC}/home/clubs/arc-studio-dofua`, label: "Arc Studio club" },
  "beta-testers": {
    href: `${ARC}/home/forum/boards/circle-products-and-developer-toolings-0iw`,
    label: "Product feedback forum",
  },
  course: { href: `${ARC}/public/courses`, label: "Courses" },
  bounty: { href: `${ARC}/home/clubs/arc-hackathons`, label: "Arc hackathons" },
  challenge: { href: `${ARC}/home/clubs/arc-hackathons`, label: "Arc hackathons" },
  hackathon: {
    href: `${ARC}/public/events/ethglobal-mumbai-g23qyrr90e`,
    label: "ETHGlobal Mumbai",
  },
  survey: {
    href: `${ARC}/public/blogs/arc-house-usage-survey-oct-26`,
    label: "Arc House usage survey",
  },
  "id-verified": { href: `${ARC}/home`, label: "Your Arc House profile" },
  "tier-2": { href: `${ARC}/pages/community-contributors`, label: "Contributors" },
  "tier-1": { href: `${ARC}/pages/community-contributors`, label: "Contributors" },
  alliance: { href: `${ARC}/home/clubs/architects`, label: "Architects" },
};

type LiveEvent = { title: string; href: string; place: string; upcoming: boolean };

const LIVE_EVENT: Record<string, "online" | "in-person" | "hackathon" | "next"> = {
  "event-speaker": "next",
  "virtual-chapter": "online",
  roundtable: "next",
  "in-person": "in-person",
  "online-event": "online",
  hackathon: "hackathon",
};

function pickEvent(kind: "online" | "in-person" | "hackathon" | "next", events: LiveEvent[]): LiveEvent | undefined {
  const upcoming = events.filter((event) => event.upcoming && event.href);
  const pool = upcoming.length > 0 ? upcoming : events.filter((event) => event.href);
  if (kind === "hackathon") {
    return pool.find((event) => /hackathon|ethglobal/i.test(event.title)) ?? pool[0];
  }
  if (kind === "in-person") {
    return pool.find((event) => event.place && !/online|virtual|zoom/i.test(event.place)) ?? pool[0];
  }
  if (kind === "online") {
    return pool.find((event) => /online|virtual|zoom|check-in/i.test(`${event.place} ${event.title}`)) ?? pool[0];
  }
  return pool[0];
}

export function taskLink(id: string, events: LiveEvent[] = []): TaskLink {
  const live = LIVE_EVENT[id];
  if (live) {
    const event = pickEvent(live, events);
    if (event) return { href: event.href, label: event.title };
  }
  return TASK_LINKS[id] ?? { href: `${ARC}/public/events`, label: "Arc House" };
}

export const TASK_GROUPS: TaskGroup[] = ["Events", "Content", "Forum", "Community", "Other"];

export const POINT_TASKS: PointTask[] = [
  {
    id: "event-organizer",
    group: "Events",
    name: "Event Organizer",
    detail: "Organized an event within the community",
    points: 1000,
    cap: null,
  },
  {
    id: "meetup-organizer",
    group: "Events",
    name: "Arc Community Meetup Organizer",
    detail: "Organized an in-person meetup with the Arc team. Meetup Organizer badge required.",
    points: 1000,
    cap: null,
  },
  {
    id: "event-speaker",
    group: "Events",
    name: "Event Speaker",
    detail: "Participated as a speaker at an event",
    points: 500,
    cap: null,
  },
  {
    id: "virtual-chapter",
    group: "Events",
    name: "Arc Virtual Chapter Event",
    detail: "Organized a virtual chapter event in cooperation with the Arc team",
    points: 500,
    cap: null,
  },
  {
    id: "roundtable",
    group: "Events",
    name: "In-event Roundtable Host",
    detail: "Host of a roundtable inside a livestream or hybrid event",
    points: 300,
    cap: null,
  },
  {
    id: "in-person",
    group: "Events",
    name: "In-Person Event Participation",
    detail: "Participated in an event in person",
    points: 200,
    cap: null,
  },
  {
    id: "online-event",
    group: "Events",
    name: "Online Event Participation",
    detail: "Participated in an event online",
    points: 20,
    cap: null,
  },
  {
    id: "author",
    group: "Content",
    name: "Author",
    detail: "Authored original articles or other content for the community",
    points: 500,
    cap: null,
  },
  {
    id: "video-speaker",
    group: "Content",
    name: "Video Speaker",
    detail: "Speaker featured in a community video",
    points: 200,
    cap: null,
  },
  {
    id: "watch-video",
    group: "Content",
    name: "Watch a Video",
    detail: "Viewed video content",
    points: 4,
    cap: "Up to 4 times / 24 hrs",
  },
  {
    id: "read-content",
    group: "Content",
    name: "Read Content",
    detail: "Read an article or other content",
    points: 2,
    cap: "Up to 10 times / 24 hrs",
  },
  {
    id: "accepted-answer",
    group: "Forum",
    name: "Accepted Answer",
    detail: "Your comment is marked as the accepted answer",
    points: 30,
    cap: "Up to 1 time / 24 hrs",
  },
  {
    id: "publish-post",
    group: "Forum",
    name: "Publish a Post",
    detail: "Posted in the community forum",
    points: 10,
    cap: "Up to 2 times / 24 hrs",
  },
  {
    id: "comment",
    group: "Forum",
    name: "Comment / Reply",
    detail: "Commented and interacted with posts in the community forum",
    points: 5,
    cap: "Up to 2 times / 24 hrs",
  },
  {
    id: "onboarding",
    group: "Community",
    name: "Finish Onboarding",
    detail: "Completed the onboarding form and profile",
    points: 50,
    cap: null,
  },
  {
    id: "join-club",
    group: "Community",
    name: "Join a Club",
    detail: "Joined a small group or club within the community",
    points: 20,
    cap: null,
  },
  {
    id: "daily-active",
    group: "Community",
    name: "Daily Active",
    detail: "Recorded as an active visiting member, once per day",
    points: 1,
    cap: null,
  },
  {
    id: "grant",
    group: "Other",
    name: "Circle Grant Recipient",
    detail: "Recipient of a Circle Developer Grant",
    points: 2000,
    cap: null,
  },
  {
    id: "technical-beta",
    group: "Other",
    name: "Arc Technical Beta Testers",
    detail: "Approved feedback on Arc products. Verified Arc Developers only.",
    points: 300,
    cap: null,
  },
  {
    id: "training",
    group: "Other",
    name: "Training Graduate",
    detail: "Graduated from a bootcamp or training program run by Circle, Arc, or a partner",
    points: 300,
    cap: null,
  },
  {
    id: "studio-user",
    group: "Other",
    name: "Arc Studio User",
    detail: "Tried Arc Studio",
    points: 200,
    cap: null,
  },
  {
    id: "beta-testers",
    group: "Other",
    name: "Arc Beta Testers",
    detail: "Dedicated to providing feedback on products and services",
    points: 200,
    cap: null,
  },
  {
    id: "course",
    group: "Other",
    name: "Course Champion",
    detail: "Finished a course",
    points: 200,
    cap: null,
  },
  {
    id: "bounty",
    group: "Other",
    name: "Bounty Winner",
    detail: "Winner of an Arc Developer Bounty",
    points: 150,
    cap: null,
  },
  {
    id: "challenge",
    group: "Other",
    name: "Developer Challenge",
    detail: "Winner of a Developer Challenge",
    points: 100,
    cap: null,
  },
  {
    id: "hackathon",
    group: "Other",
    name: "Hackathon Participant",
    detail: "Participated in a hackathon",
    points: 100,
    cap: null,
  },
  {
    id: "survey",
    group: "Other",
    name: "Complete a survey",
    detail: "Finished a community survey",
    points: 50,
    cap: null,
  },
  {
    id: "id-verified",
    group: "Other",
    name: "ID Verified",
    detail: "Verified identity",
    points: 50,
    cap: null,
  },
  {
    id: "tier-2",
    group: "Other",
    name: "Tier 2 Architect",
    detail: "Profile badge for Architect Tier 2. No point value is listed.",
    points: null,
    cap: null,
  },
  {
    id: "tier-1",
    group: "Other",
    name: "Tier 1 Architect",
    detail: "Profile badge shown as T1 Architect. No point value is listed.",
    points: null,
    cap: null,
  },
  {
    id: "alliance",
    group: "Other",
    name: "Circle Alliance Affiliated",
    detail: "Employee of a Circle Alliance Program member. Badge only.",
    points: null,
    cap: null,
  },
];
