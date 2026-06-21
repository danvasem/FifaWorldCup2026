export const MATCH_STATUS = {
  COMPLETED: 0,
  SCHEDULED: 1,
  LIVE: 3,
};

const hasScore = (value) => Number.isFinite(value);

const getLocalizedText = (entries, fallback = "") => {
  if (!Array.isArray(entries)) {
    return fallback;
  }

  const english = entries.find((entry) => entry.Locale?.toLowerCase().startsWith("en"));
  return english?.Description || entries[0]?.Description || fallback;
};

const toScore = (value) => {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  const numericValue = Number(value);
  return Number.isFinite(numericValue) ? numericValue : null;
};

// Maps FIFA/IOC 3-letter country codes to ISO 3166-1 alpha-2 codes for flagcdn.com
const FIFA_TO_ISO2 = {
  ALG: "dz", ARG: "ar", AUS: "au", AUT: "at", BEL: "be", BIH: "ba",
  BRA: "br", CAN: "ca", CIV: "ci", COD: "cd", COL: "co", CPV: "cv",
  CRO: "hr", CUW: "cw", CZE: "cz", ECU: "ec", EGY: "eg", ENG: "gb-eng",
  ESP: "es", FRA: "fr", GER: "de", GHA: "gh", HAI: "ht", IRN: "ir",
  IRQ: "iq", JOR: "jo", JPN: "jp", KOR: "kr", KSA: "sa", MAR: "ma",
  MEX: "mx", NED: "nl", NOR: "no", NZL: "nz", PAN: "pa", PAR: "py",
  POR: "pt", QAT: "qa", RSA: "za", SCO: "gb-sct", SEN: "sn", SUI: "ch",
  SWE: "se", TUN: "tn", TUR: "tr", URU: "uy", USA: "us", UZB: "uz",
};

const normalizeFlagUrl = (fifaCode) => {
  if (!fifaCode) return "";
  const iso2 = FIFA_TO_ISO2[fifaCode];
  if (!iso2) return "";
  return `https://flagcdn.com/w40/${iso2}.png`;
};

const normalizeTeam = (team, fallback) => ({
  name: team?.ShortClubName || getLocalizedText(team?.TeamName, fallback),
  code: team?.Abbreviation || "",
  flagUrl: normalizeFlagUrl(team?.Abbreviation),
  idTeam: team?.IdTeam || "",
});

export function normalizeMatch(match) {
  if (!match?.IdMatch || !match.Date) {
    return null;
  }

  const homeGoals = toScore(match.HomeTeamScore ?? match.Home?.Score);
  const awayGoals = toScore(match.AwayTeamScore ?? match.Away?.Score);
  const hasFinalScore = hasScore(homeGoals) && hasScore(awayGoals);
  const status = Number(match.MatchStatus);
  const isCompleted = status === MATCH_STATUS.COMPLETED && hasFinalScore;

  return {
    id: match.IdMatch,
    matchNumber: Number(match.MatchNumber) || 0,
    stage: getLocalizedText(match.StageName),
    group: getLocalizedText(match.GroupName),
    kickoffUtc: match.Date,
    venueLocalKickoff: match.LocalDate || "",
    status,
    isCompleted,
    matchTime: match.MatchTime || "",
    home: normalizeTeam(match.Home, match.PlaceHolderA || "Home"),
    away: normalizeTeam(match.Away, match.PlaceHolderB || "Away"),
    score: {
      home: homeGoals,
      away: awayGoals,
      homePenalty: toScore(match.HomeTeamPenaltyScore),
      awayPenalty: toScore(match.AwayTeamPenaltyScore),
    },
    city: getLocalizedText(match.Stadium?.CityName),
    stadium: getLocalizedText(match.Stadium?.Name),
  };
}

export function splitMatches(matches, now = new Date()) {
  const nowTime = now.getTime();

  const completed = matches
    .filter((match) => match.status !== MATCH_STATUS.LIVE)
    .filter((match) => match.isCompleted || Date.parse(match.kickoffUtc) < nowTime)
    .filter((match) => hasScore(match.score.home) && hasScore(match.score.away))
    .sort((a, b) => Date.parse(b.kickoffUtc) - Date.parse(a.kickoffUtc))
    .slice(0, 5);

  const completedIds = new Set(completed.map((match) => match.id));

  const upcoming = matches
    .filter((match) => !completedIds.has(match.id))
    .filter((match) => !match.isCompleted && Date.parse(match.kickoffUtc) >= nowTime)
    .sort((a, b) => Date.parse(a.kickoffUtc) - Date.parse(b.kickoffUtc))
    .slice(0, 5);

  return {
    completed,
    upcoming,
  };
}

export function formatBrowserDateTime(isoDate, locale = "en-US") {
  if (!isoDate) {
    return "Time TBD";
  }

  return new Intl.DateTimeFormat(locale, {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short",
  }).format(new Date(isoDate));
}

export function formatVenueDateTime(localDate, locale = "en-US") {
  if (!localDate) {
    return "Venue time TBD";
  }

  const normalizedLocalDate = localDate.endsWith("Z") ? localDate.slice(0, -1) : localDate;

  return new Intl.DateTimeFormat(locale, {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(normalizedLocalDate));
}

export function formatScore(match) {
  const { home, away, homePenalty, awayPenalty } = match.score;

  if (!hasScore(home) || !hasScore(away)) {
    return "-";
  }

  if (hasScore(homePenalty) && hasScore(awayPenalty) && (homePenalty > 0 || awayPenalty > 0)) {
    return `${home}-${away} (${homePenalty}-${awayPenalty} pens)`;
  }

  return `${home}-${away}`;
}

const GOAL_EVENT_TYPE = 0;
const PENALTY_GOAL_EVENT_TYPE = 41;
const OWN_GOAL_EVENT_TYPE = 34;

const extractPlayerName = (description) => {
  // "Julian QUINONES (Mexico) scores!!" → "Julian QUINONES"
  const match = description.match(/^(.+?)\s*\(/);
  return match ? match[1].trim() : description;
};

export function parseGoalsFromTimeline(events, homeTeamId, awayTeamId) {
  const home = [];
  const away = [];

  for (const event of events) {
    const isGoal = event.Type === GOAL_EVENT_TYPE || event.Type === PENALTY_GOAL_EVENT_TYPE;
    const isOwnGoal = event.Type === OWN_GOAL_EVENT_TYPE;
    if (!isGoal && !isOwnGoal) continue;

    const desc = event.EventDescription?.[0]?.Description || "";
    const player = extractPlayerName(desc);
    const minute = event.MatchMinute || "";
    const label = isOwnGoal ? `${player} (OG)` : event.Type === PENALTY_GOAL_EVENT_TYPE ? `${player} (P)` : player;

    if (isOwnGoal) {
      // Own goal: IdTeam is the team that scored it — credit goes to the opponent
      if (event.IdTeam === homeTeamId) {
        away.push({ player: label, minute });
      } else if (event.IdTeam === awayTeamId) {
        home.push({ player: label, minute });
      }
    } else {
      if (event.IdTeam === homeTeamId) {
        home.push({ player: label, minute });
      } else if (event.IdTeam === awayTeamId) {
        away.push({ player: label, minute });
      }
    }
  }

  return { home, away };
}

const MATCH_RESULT_COMPLETED = 4;

const deriveForm = (matchResults, idTeam) =>
  matchResults
    .filter((mr) => mr.Result === MATCH_RESULT_COMPLETED && mr.HomeTeamScore !== null)
    .sort((a, b) => new Date(a.StartTime) - new Date(b.StartTime))
    .slice(-5)
    .map((mr) => {
      const isHome = mr.HomeTeamId === idTeam;
      const scored = isHome ? mr.HomeTeamScore : mr.AwayTeamScore;
      const conceded = isHome ? mr.AwayTeamScore : mr.HomeTeamScore;
      if (scored > conceded) return "W";
      if (scored < conceded) return "L";
      return "D";
    });

export function normalizeStandings(results) {
  const groups = new Map();

  for (const entry of results) {
    const groupName = entry.Group?.[0]?.Description || "Unknown";

    const team = {
      id: entry.IdTeam,
      name: entry.Team?.ShortClubName || entry.Team?.Name?.[0]?.Description || "",
      code: entry.Team?.Abbreviation || "",
      flagUrl: normalizeFlagUrl(entry.Team?.Abbreviation),
      position: entry.Position,
      played: entry.Played || 0,
      won: entry.Won || 0,
      drawn: entry.Drawn || 0,
      lost: entry.Lost || 0,
      goalsFor: entry.For || 0,
      goalsAgainst: entry.Against || 0,
      goalDiff: entry.GoalsDiference ?? 0,
      points: entry.Points || 0,
      form: deriveForm(entry.MatchResults || [], entry.IdTeam),
    };

    if (!groups.has(groupName)) groups.set(groupName, []);
    groups.get(groupName).push(team);
  }

  // Sort teams within each group by position, groups by name
  for (const teams of groups.values()) {
    teams.sort((a, b) => a.position - b.position);
  }

  return new Map([...groups.entries()].sort((a, b) => a[0].localeCompare(b[0])));
}
