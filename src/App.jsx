import { CalendarDays, MapPin, Radio, RefreshCw, Trophy } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import {
  fetchGroupStandings,
  fetchMatchTimeline,
  fetchWorldCupMatches,
  FIFA_MATCHES_URL,
  readCachedMatches,
  writeCachedMatches,
} from "./services/fifaApi";
import {
  formatBrowserDateTime,
  formatScore,
  formatVenueDateTime,
  MATCH_STATUS,
  normalizeStandings,
  parseGoalsFromTimeline,
  splitMatches,
} from "./utils/matches";

const STATUS_COPY = {
  loading: "Loading FIFA match data",
  ready: "Live FIFA data",
  cached: "Cached FIFA data",
  error: "Data unavailable",
};

function App() {
  const [matches, setMatches] = useState([]);
  const [status, setStatus] = useState("loading");
  const [errorMessage, setErrorMessage] = useState("");
  const [refreshedAt, setRefreshedAt] = useState("");
  const [activeTab, setActiveTab] = useState("results");
  const [timelines, setTimelines] = useState({});
  const [groups, setGroups] = useState(new Map());

  const loadMatches = async ({ silent = false } = {}) => {
    if (!silent) {
      setStatus("loading");
      setErrorMessage("");
    }

    try {
      const freshMatches = await fetchWorldCupMatches();
      const loadedAt = new Date().toISOString();

      setMatches(freshMatches);
      setRefreshedAt(loadedAt);
      setStatus("ready");
      setErrorMessage("");
      writeCachedMatches(freshMatches, loadedAt);
    } catch (error) {
      const cached = readCachedMatches();

      if (cached) {
        setMatches(cached.matches);
        setRefreshedAt(cached.refreshedAt);
        setStatus("cached");
        setErrorMessage(error.message);
        return;
      }

      setMatches([]);
      setRefreshedAt("");
      setStatus("error");
      setErrorMessage(error.message);
    }
  };

  useEffect(() => {
    const cached = readCachedMatches();

    if (cached) {
      setMatches(cached.matches);
      setRefreshedAt(cached.refreshedAt);
      setStatus("cached");
      loadMatches({ silent: true });
      return;
    }

    loadMatches();
  }, []);

  const { completed, upcoming } = useMemo(() => splitMatches(matches), [matches]);
  const liveMatches = useMemo(() => matches.filter((m) => m.status === MATCH_STATUS.LIVE), [matches]);
  const formattedRefreshedAt = refreshedAt ? formatBrowserDateTime(refreshedAt) : "Not refreshed yet";

  // Poll every 30s while any match is live
  useEffect(() => {
    if (!liveMatches.length) return;
    const interval = setInterval(() => loadMatches({ silent: true }), 30_000);
    return () => clearInterval(interval);
  }, [liveMatches.length]);

  // Fetch goal timelines for completed + live matches (skip already-loaded ones)
  useEffect(() => {
    const relevant = [...completed, ...liveMatches];
    if (!relevant.length) return;
    const missing = relevant.filter((m) => !timelines[m.id]);
    if (!missing.length) return;

    Promise.all(
      missing.map(async (match) => {
        try {
          const events = await fetchMatchTimeline(match.id);
          const goals = parseGoalsFromTimeline(events, match.home.idTeam, match.away.idTeam);
          return [match.id, goals];
        } catch {
          return [match.id, { home: [], away: [] }];
        }
      })
    ).then((entries) => {
      setTimelines((prev) => ({ ...prev, ...Object.fromEntries(entries) }));
    });
  }, [completed, liveMatches]);

  // Fetch group standings once on mount
  useEffect(() => {
    fetchGroupStandings()
      .then((results) => setGroups(normalizeStandings(results)))
      .catch(() => {});
  }, []);

  return (
    <main className="shell">
      <header className="page-header">
        <div className="header-copy">
          <div className="eyebrow">
            <Trophy size={18} aria-hidden="true" />
            FIFA World Cup 2026
          </div>
          <h1>World Cup 2026</h1>
          <p>Results and upcoming fixtures from FIFA's public match calendar.</p>
        </div>

        <div className="header-actions">
          <div className={`source-status source-status--${status}`}>
            <span aria-hidden="true" />
            {STATUS_COPY[status]}
          </div>
          <button
            className="refresh-button"
            type="button"
            onClick={() => loadMatches()}
            disabled={status === "loading"}
            aria-label="Refresh FIFA match data"
            title="Refresh FIFA match data"
          >
            <RefreshCw size={18} aria-hidden="true" />
            <span>{status === "loading" ? "Refreshing" : "Refresh"}</span>
          </button>
        </div>
      </header>

      {liveMatches.map((m) => (
        <LiveBanner key={m.id} match={m} goals={timelines[m.id]} />
      ))}

      <section className="summary-strip" aria-label="Data summary">
        <div>
          <span className="summary-label">Matches loaded</span>
          <strong>{matches.length}</strong>
        </div>
        <div>
          <span className="summary-label">Last refreshed</span>
          <strong>{formattedRefreshedAt}</strong>
        </div>
        <a href={FIFA_MATCHES_URL} target="_blank" rel="noreferrer">
          FIFA API source
        </a>
      </section>

      {errorMessage ? (
        <section className={`notice notice--${status}`} role={status === "error" ? "alert" : "status"}>
          {status === "cached"
            ? `Showing cached results because the live request failed: ${errorMessage}`
            : `Could not load FIFA match data: ${errorMessage}`}
        </section>
      ) : null}

      {/* Desktop-only top tab bar */}
      <div className="desktop-tabs" role="tablist" aria-label="Main sections">
        <button
          role="tab"
          aria-selected={activeTab !== "qualification"}
          className={`desktop-tab-btn${activeTab !== "qualification" ? " desktop-tab-btn--active" : ""}`}
          onClick={() => setActiveTab((t) => (t === "qualification" ? "results" : t))}
        >
          Results
        </button>
        <button
          role="tab"
          aria-selected={activeTab === "qualification"}
          className={`desktop-tab-btn${activeTab === "qualification" ? " desktop-tab-btn--active" : ""}`}
          onClick={() => setActiveTab("qualification")}
        >
          Qualification
        </button>
      </div>

      {/* Mobile-only tab bar — always visible, lives outside match-columns */}
      <div className="tab-bar" role="tablist" aria-label="Match sections">
        <button
          role="tab"
          aria-selected={activeTab === "results"}
          className={`tab-btn${activeTab === "results" ? " tab-btn--active" : ""}`}
          onClick={() => setActiveTab("results")}
        >
          Last 5 Results
        </button>
        <button
          role="tab"
          aria-selected={activeTab === "schedule"}
          className={`tab-btn${activeTab === "schedule" ? " tab-btn--active" : ""}`}
          onClick={() => setActiveTab("schedule")}
        >
          Next 5 Matches
        </button>
        <button
          role="tab"
          aria-selected={activeTab === "qualification"}
          className={`tab-btn${activeTab === "qualification" ? " tab-btn--active" : ""}`}
          onClick={() => setActiveTab("qualification")}
        >
          Qualification
        </button>
      </div>

      <div
        className={`match-columns${activeTab === "qualification" ? " section-hidden" : ""}`}
        data-active-tab={activeTab}
      >
        <MatchSection
          title="Last 5 Results"
          description="Completed matches, newest first."
          matches={completed}
          timelines={timelines}
          emptyMessage={status === "loading" ? "Loading results..." : "No completed matches available yet."}
          variant="results"
        />
        <MatchSection
          title="Next 5 Matches"
          description="Scheduled matches, soonest first."
          matches={upcoming}
          timelines={{}}
          emptyMessage={status === "loading" ? "Loading fixtures..." : "No upcoming matches available."}
          variant="schedule"
        />
      </div>

      {groups.size > 0 && (
        <div className={activeTab !== "qualification" ? "section-hidden" : ""}>
          <GroupStandings groups={groups} />
        </div>
      )}
    </main>
  );
}

function GroupStandings({ groups }) {
  return (
    <section className="groups-section" aria-label="Group standings">
      <h2 className="groups-title">Group Standings</h2>
      <div className="groups-grid">
        {[...groups.entries()].map(([groupName, teams]) => (
          <GroupTable key={groupName} groupName={groupName} teams={teams} />
        ))}
      </div>
    </section>
  );
}

const FORM_LABEL = { W: "Win", D: "Draw", L: "Loss" };

function GroupTable({ groupName, teams }) {
  return (
    <div className="group-table">
      <h3 className="group-name">{groupName}</h3>
      <table>
        <colgroup>
          <col className="col-pos" />
          <col className="col-team" />
          <col className="col-stat" />
          <col className="col-stat" />
          <col className="col-stat" />
          <col className="col-stat" />
          <col className="col-stat" />
          <col className="col-stat" />
          <col className="col-stat" />
          <col className="col-pts" />
          <col className="col-form" />
        </colgroup>
        <thead>
          <tr>
            <th className="col-pos">#</th>
            <th className="col-team">Team</th>
            <th title="Played">P</th>
            <th title="Won">W</th>
            <th title="Drawn">D</th>
            <th title="Lost">L</th>
            <th title="Goals For">GF</th>
            <th title="Goals Against">GA</th>
            <th title="Goal Difference">GD</th>
            <th className="col-pts" title="Points">Pts</th>
            <th className="col-form">Form</th>
          </tr>
        </thead>
        <tbody>
          {teams.map((team) => (
            <tr key={team.id}>
              <td className="col-pos">{team.position}</td>
              <td className="col-team">
                <div className="team-cell">
                  {team.flagUrl && <img src={team.flagUrl} alt="" loading="lazy" />}
                  <span>{team.name}</span>
                </div>
              </td>
              <td>{team.played}</td>
              <td>{team.won}</td>
              <td>{team.drawn}</td>
              <td>{team.lost}</td>
              <td>{team.goalsFor}</td>
              <td>{team.goalsAgainst}</td>
              <td>{team.goalDiff > 0 ? `+${team.goalDiff}` : team.goalDiff}</td>
              <td className="col-pts">{team.points}</td>
              <td className="col-form">
                <span className="form-dots">
                  {team.form.map((result, i) => (
                    <span
                      key={i}
                      className={`form-dot form-dot--${result.toLowerCase()}`}
                      aria-label={FORM_LABEL[result]}
                      title={FORM_LABEL[result]}
                    />
                  ))}
                  {Array.from({ length: Math.max(0, 3 - team.form.length) }).map((_, i) => (
                    <span key={`empty-${i}`} className="form-dot form-dot--empty" />
                  ))}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function LiveBanner({ match, goals }) {
  return (
    <section className="live-banner" aria-label="Match in progress">
      <div className="live-badge">
        <Radio size={14} aria-hidden="true" />
        LIVE
      </div>
      <div className="live-teams">
        <div className="live-team">
          {match.home.flagUrl && <img src={match.home.flagUrl} alt="" loading="lazy" />}
          <span>{match.home.name}</span>
        </div>
        <div className="live-score-block">
          <span className="live-score">{match.score.home ?? 0} – {match.score.away ?? 0}</span>
          {match.matchTime && <span className="live-time">{match.matchTime}</span>}
        </div>
        <div className="live-team live-team--right">
          {match.away.flagUrl && <img src={match.away.flagUrl} alt="" loading="lazy" />}
          <span>{match.away.name}</span>
        </div>
      </div>

      {goals && (goals.home.length > 0 || goals.away.length > 0) && (
        <div className="live-goals">
          <ul className="live-goals-list live-goals-list--home">
            {goals.home.map((g, i) => (
              <li key={i}>⚽ <span className="live-goal-player">{g.player}</span> <span className="live-goal-minute">{g.minute}</span></li>
            ))}
          </ul>
          <ul className="live-goals-list live-goals-list--away">
            {goals.away.map((g, i) => (
              <li key={i}><span className="live-goal-minute">{g.minute}</span> <span className="live-goal-player">{g.player}</span> ⚽</li>
            ))}
          </ul>
        </div>
      )}

      <div className="live-meta">{match.city} · {match.stadium}</div>
    </section>
  );
}

function MatchSection({ title, description, matches, timelines, emptyMessage, variant }) {
  return (
    <section className="match-section" aria-labelledby={`${variant}-title`}>
      <div className="section-heading">
        <div>
          <h2 id={`${variant}-title`}>{title}</h2>
          <p>{description}</p>
        </div>
        <span>{matches.length}/5</span>
      </div>

      <div className="match-list">
        {matches.length ? (
          matches.map((match) => (
            <MatchRow key={match.id} match={match} goals={timelines[match.id]} variant={variant} />
          ))
        ) : (
          <div className="empty-state">{emptyMessage}</div>
        )}
      </div>
    </section>
  );
}

function MatchRow({ match, goals, variant }) {
  return (
    <article className={`match-row match-row--${variant}`}>
      <div className="match-main">
        <Team team={match.home} align="left" />
        <div className="score-block" aria-label={`${match.home.name} versus ${match.away.name}`}>
          <span className="score">{formatScore(match)}</span>
          <span className="stage">{match.group || match.stage || `Match ${match.matchNumber}`}</span>
        </div>
        <Team team={match.away} align="right" />
      </div>

      {goals && (goals.home.length > 0 || goals.away.length > 0) && (
        <div className="goals-row">
          <ul className="goals-list goals-list--home">
            {goals.home.map((g, i) => (
              <li key={i}>⚽ <span className="goal-player">{g.player}</span> <span className="goal-minute">{g.minute}</span></li>
            ))}
          </ul>
          <ul className="goals-list goals-list--away">
            {goals.away.map((g, i) => (
              <li key={i}><span className="goal-minute">{g.minute}</span> <span className="goal-player">{g.player}</span> ⚽</li>
            ))}
          </ul>
        </div>
      )}

      <div className="match-meta">
        <span>
          <CalendarDays size={16} aria-hidden="true" />
          <strong>{formatBrowserDateTime(match.kickoffUtc)}</strong>
          <em>Venue: {formatVenueDateTime(match.venueLocalKickoff)}</em>
        </span>
        <span>
          <MapPin size={16} aria-hidden="true" />
          <strong>{match.city || "City TBD"}</strong>
          <em>{match.stadium || "Stadium TBD"}</em>
        </span>
      </div>
    </article>
  );
}

function Team({ team, align }) {
  return (
    <div className={`team team--${align}`}>
      {team.flagUrl ? <img src={team.flagUrl} alt="" loading="lazy" /> : <span className="flag-placeholder" />}
      <div>
        <strong>{team.name}</strong>
        {team.code ? <span>{team.code}</span> : null}
      </div>
    </div>
  );
}

export default App;
