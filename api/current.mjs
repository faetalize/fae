//serves her in her current mood. vercel's cdn holds each render for 30 minutes, so there's no timer
//to miss a slot: she's only redrawn when someone asks for her and the last image has gone stale.
import { pickMood } from "../src/pick_mood.mjs";
import { render } from "../src/render.mjs";

export async function GET() {
  const { mood, total } = await pickMood(process.env.GITHUB_TOKEN);
  return new Response(render(mood, { count: String(total) }), {
    headers: {
      "Content-Type": "image/svg+xml",
      //stale-if-error keeps her last image up for a day if github's api fails.
      "Cache-Control": "public, max-age=0, s-maxage=1800, stale-while-revalidate=1800, stale-if-error=86400",
    },
  });
}
