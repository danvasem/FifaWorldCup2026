import { CalendarDays, MapPin, Radio, RefreshCw, Trophy } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import {
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
  const liveMatch = useMemo(() => matches.find((m) => m.status === MATCH_STATUS.LIVE) ?? null, [matches]);
  const formattedRefreshedAt = refreshedAt ? formatBrowserDateTime(refreshedAt) : "Not refreshed yet";

  // Poll every 30s while a match is live
  useEffect(() => {
    if (!liveMatch) return;
    const interval = setInterval(() => loadMatches({ silent: true }), 30_000);
    return () => clearInterval(interval);
  }, [liveMatch]);

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

      {liveMatch && <LiveBanner match={liveMatch} />}

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

      <div className="match-columns">
        <MatchSection
          title="Last 5 Results"
          description="Completed matches, newest first."
          matches={completed}
          emptyMessage={status === "loading" ? "Loading results..." : "No completed matches available yet."}
          variant="results"
        />
        <MatchSection
          title="Next 5 Matches"
          description="Scheduled matches, soonest first."
          matches={upcoming}
          emptyMessage={status === "loading" ? "Loading fixtures..." : "No upcoming matches available."}
          variant="schedule"
        />
      </div>
    </main>
  );
}

function LiveBanner({ match }) {
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
      <div className="live-meta">{match.city} · {match.stadium}</div>
    </section>
  );
}

function MatchSection({ title, description, matches, emptyMessage, variant }) {
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
          matches.map((match) => <MatchRow key={match.id} match={match} variant={variant} />)
        ) : (
          <div className="empty-state">{emptyMessage}</div>
        )}
      </div>
    </section>
  );
}

function MatchRow({ match, variant }) {
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
