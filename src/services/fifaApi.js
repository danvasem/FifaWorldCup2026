import { normalizeMatch } from "../utils/matches";

export const FIFA_MATCHES_URL =
  "https://api.fifa.com/api/v3/calendar/matches?language=en&count=200&idCompetition=17&idSeason=285023";

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
