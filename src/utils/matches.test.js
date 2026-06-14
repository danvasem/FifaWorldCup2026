import { describe, expect, it } from "vitest";
import {
  formatBrowserDateTime,
  formatScore,
  formatVenueDateTime,
  normalizeMatch,
  splitMatches,
} from "./matches";

const makeMatch = ({
  id,
  date,
  localDate = date,
  status,
  homeScore,
  awayScore,
  home = "Home",
  away = "Away",
}) =>
  normalizeMatch({
    IdMatch: id,
    IdCompetition: "17",
    IdSeason: "285023",
    Date: date,
    LocalDate: localDate,
    MatchStatus: status,
    MatchNumber: Number(id),
    HomeTeamScore: homeScore,
    AwayTeamScore: awayScore,
    Home: {
      ShortClubName: home,
      Abbreviation: home.slice(0, 3).toUpperCase(),
    },
    Away: {
      ShortClubName: away,
      Abbreviation: away.slice(0, 3).toUpperCase(),
    },
    Stadium: {
      CityName: [{ Locale: "en-GB", Description: "Mexico City" }],
      Name: [{ Locale: "en-GB", Description: "Mexico City Stadium" }],
    },
  });

describe("match normalization", () => {
  it("keeps required match display fields", () => {
    const match = makeMatch({
      id: "1",
      date: "2026-06-11T19:00:00Z",
      localDate: "2026-06-11T13:00:00Z",
      status: 0,
      homeScore: 2,
      awayScore: 0,
      home: "Mexico",
      away: "South Africa",
    });

    expect(match.home.name).toBe("Mexico");
    expect(match.away.name).toBe("South Africa");
    expect(match.city).toBe("Mexico City");
    expect(match.stadium).toBe("Mexico City Stadium");
    expect(formatScore(match)).toBe("2-0");
  });
});

describe("match splitting", () => {
  it("returns last five completed and next five scheduled matches", () => {
    const matches = [
      makeMatch({ id: "1", date: "2026-06-11T19:00:00Z", status: 0, homeScore: 2, awayScore: 0 }),
      makeMatch({ id: "2", date: "2026-06-12T02:00:00Z", status: 0, homeScore: 2, awayScore: 1 }),
      makeMatch({ id: "3", date: "2026-06-12T19:00:00Z", status: 0, homeScore: 1, awayScore: 1 }),
      makeMatch({ id: "4", date: "2026-06-13T01:00:00Z", status: 0, homeScore: 4, awayScore: 1 }),
      makeMatch({ id: "5", date: "2026-06-13T19:00:00Z", status: 0, homeScore: 1, awayScore: 1 }),
      makeMatch({ id: "6", date: "2026-06-14T17:00:00Z", status: 1, homeScore: null, awayScore: null }),
      makeMatch({ id: "7", date: "2026-06-14T20:00:00Z", status: 1, homeScore: null, awayScore: null }),
      makeMatch({ id: "8", date: "2026-06-14T23:00:00Z", status: 1, homeScore: null, awayScore: null }),
      makeMatch({ id: "9", date: "2026-06-15T02:00:00Z", status: 1, homeScore: null, awayScore: null }),
      makeMatch({ id: "10", date: "2026-06-15T16:00:00Z", status: 1, homeScore: null, awayScore: null }),
      makeMatch({ id: "11", date: "2026-06-15T19:00:00Z", status: 1, homeScore: null, awayScore: null }),
    ];

    const { completed, upcoming } = splitMatches(matches, new Date("2026-06-14T12:00:00Z"));

    expect(completed).toHaveLength(5);
    expect(upcoming).toHaveLength(5);
    expect(completed[0].id).toBe("5");
    expect(upcoming[0].id).toBe("6");
  });
});

describe("date formatting", () => {
  it("formats browser-local UTC kickoffs", () => {
    const formatted = formatBrowserDateTime("2026-06-11T19:00:00Z", "en-US");

    expect(formatted).toContain("Jun");
    expect(formatted).toMatch(/UTC|GMT|AM|PM/);
  });

  it("formats venue local time without applying the trailing Z shift", () => {
    const formatted = formatVenueDateTime("2026-06-11T13:00:00Z", "en-US");

    expect(formatted).toContain("1:00 PM");
  });
});
