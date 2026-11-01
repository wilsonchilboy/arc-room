import { createFileRoute } from "@tanstack/react-router";
import { getEvents } from "@/lib/arc-events.server";

export const Route = createFileRoute("/api/events")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const fresh = new URL(request.url).searchParams.get("fresh") === "1";
        try {
          const feed = await getEvents(fresh);
          return new Response(JSON.stringify(feed), {
            headers: {
              "content-type": "application/json; charset=utf-8",
              "cache-control": "no-store",
            },
          });
        } catch (error) {
          const message = error instanceof Error ? error.message : "Could not load Arc events";
          return new Response(JSON.stringify({ error: message }), {
            status: 502,
            headers: { "content-type": "application/json; charset=utf-8" },
          });
        }
      },
    },
  },
});
