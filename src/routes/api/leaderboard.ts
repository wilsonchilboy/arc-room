import { createFileRoute } from "@tanstack/react-router";
import { getBoard } from "@/lib/arc-house.server";

export const Route = createFileRoute("/api/leaderboard")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const fresh = new URL(request.url).searchParams.get("fresh") === "1";
        try {
          const board = await getBoard(fresh);
          return new Response(JSON.stringify(board), {
            headers: {
              "content-type": "application/json; charset=utf-8",
              "cache-control": "no-store",
            },
          });
        } catch (error) {
          const message = error instanceof Error ? error.message : "Could not load Arc House";
          return new Response(JSON.stringify({ error: message }), {
            status: 502,
            headers: { "content-type": "application/json; charset=utf-8" },
          });
        }
      },
    },
  },
});
