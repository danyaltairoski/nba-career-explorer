const TROPHY_ICONS = {
  mvp: "👑",
  champion: "🏆"
};

const TEAM_LOGO_FILES = {
  LAL: "lakers_logo.png",
  CLE: "cavaliers_logo.png",
  GSW: "warriors_logo.png",
  MIA: "heat_logo.png",
  OKC: "thunder_logo.png",
  SEA: "supersonics_logo.png",
  BKN: "nets_logo.png",
  PHX: "suns_logo.png",
  HOU: "rockets_logo.png"
};

function addSeasonBar(season, shots, palette = null) {
  const made = shots.filter(s => s.made).length;
  const total = shots.length;
  const missed = total - made;
  const pct = total ? Math.round((made / total) * 100) : 0;

  const madePercent = total ? (made / total) * 100 : 0;
  const missedPercent = 100 - madePercent;
  const madeColor = palette?.made || getComputedStyleColor("--made-color", "#ffd700");
  const missedColor = palette?.missed || getComputedStyleColor("--missed-color", "#8c52ff");
  const isMvpSeason = shots.some(s => s.mvp);
  const isChampionSeason = shots.some(s => s.champion);

  const trophyIcons = [
    isMvpSeason ? TROPHY_ICONS.mvp : "",
    isChampionSeason ? TROPHY_ICONS.champion : ""
  ].filter(Boolean).join(" ");

  const indicators = [
    isMvpSeason ? `<span class="badge mvp">MVP ${TROPHY_ICONS.mvp}</span>` : "",
    isChampionSeason ? `<span class="badge champ">CHAMP ${TROPHY_ICONS.champion}</span>` : ""
  ].filter(Boolean).join("");

  const teamCode = shots[0]?.team;
  const teamLogoFile = TEAM_LOGO_FILES[teamCode];
  const teamLogo = teamLogoFile
    ? `images/logos/${teamLogoFile}`
    : `images/logos/${(teamCode || "default").toLowerCase()}_logo.png`;

  const container = d3.select("#seasonBars");

  const card = container
    .append("div")
    .attr("class", `seasonCard ${isChampionSeason ? "isChampion" : ""} ${isMvpSeason ? "isMvp" : ""}`.trim())
    .attr("data-season", season)
    .html(`
      <div class="seasonTitle">
        <div class="titleLeft">
          ${teamLogo ? `<img src="${teamLogo}" alt="${shots[0]?.team || ""} logo" class="teamLogo" />` : ""}
          <span>${season} ${trophyIcons}</span>
        </div>
        <span>${pct}% FG</span>
      </div>
      <div class="bar">
        <div class="made" style="width:${madePercent}%; background:${madeColor};"></div>
        <div class="missed" style="width:${missedPercent}%; background:${missedColor};"></div>
      </div>
      <div class="seasonMeta">
        ${made} makes • ${missed} misses (${total} shots)
        <div class="seasonBadges">${indicators}</div>
      </div>
    `);

  if (isMvpSeason && isChampionSeason) {
    card.classed("isChampion", true).classed("isDouble", true);
  }

  card.on("click", () => {
    if (window && typeof window.showSeasonShots === "function") {
      window.showSeasonShots(season);
    }
  });

  scrollTimelineToBottom();
}

function scrollTimelineToBottom() {
  const panel = document.querySelector(".timeline-panel");
  if (!panel) return;

  try {
    panel.scrollTo({ top: panel.scrollHeight, behavior: "smooth" });
  } catch (_) {
    panel.scrollTop = panel.scrollHeight;
  }
}

function getComputedStyleColor(variable, fallback) {
  try {
    const root = document.documentElement;
    const value = getComputedStyle(root).getPropertyValue(variable);
    return value?.trim() || fallback;
  } catch (_) {
    return fallback;
  }
}
