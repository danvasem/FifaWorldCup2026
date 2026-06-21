import { normalizeMatch } from "../utils/matches";

export const FIFA_MATCHES_URL =
  "https://api.fifa.com/api/v3/calendar/matches?language=en&count=200&idCompetition=17&idSeason=285023";

export const FIFA_STANDINGS_URL =
  "https://api.fifa.com/api/v3/calendar/17/285023/289273/standing?language=en";

export const fifaTimelineUrl = (idMatch) =>
  `https://api.fifa.com/api/v3/timelines/${idMatch}/?language=en`;

export const CACHE_KEY = "world-cup-2026-match-cache";

export async function fetchWorldCupMatches() {
  const response = await fetch(FIFA_MATCHES_URL, {
    headers: {
      Accept: "application/json",
    },
  });

  if (!response.ok) {
    throw new Error(`FIFA API returned ${response.status}`);
  }

  const payload = await response.json();

  if (!Array.isArray(payload.Results)) {
    throw new Error("FIFA API response did not include a Results array");
  }

  return payload.Results.map(normalizeMatch).filter(Boolean);
}

export async function fetchMatchTimeline(idMatch) {
  const response = await fetch(fifaTimelineUrl(idMatch), {
    headers: { Accept: "application/json" },
  });

  if (!response.ok) {
    throw new Error(`Timeline fetch failed for match ${idMatch}`);
  }

  const payload = await response.json();
  return Array.isArray(payload.Event) ? payload.Event : [];
}

export async function fetchGroupStandings() {
  const response = await fetch(FIFA_STANDINGS_URL, {
    headers: { Accept: "application/json" },
  });

  if (!response.ok) {
    throw new Error(`Standings fetch failed: ${response.status}`);
  }

  const payload = await response.json();
  return Array.isArray(payload.Results) ? payload.Results : [];
}

export function readCachedMatches() {
  try {
    const cached = window.localStorage.getItem(CACHE_KEY);

    if (!cached) {
      return null;
    }

    const parsed = JSON.parse(cached);

    if (!Array.isArray(parsed.matches)) {
      return null;
    }

    return parsed;
  } catch {
    return null;
  }
}

export function writeCachedMatches(matches, refreshedAt) {
  try {
    window.localStorage.setItem(
      CACHE_KEY,
      JSON.stringify({
        matches,
        refreshedAt,
      }),
    );
  } catch {
    // Storage failures should not block live data from rendering.
  }
}
