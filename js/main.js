const svg = d3.select("#court");
const { scaleX, scaleY, shotsLayer } = drawCourt(svg);

const DEFAULT_PALETTE = { made: "#ffd700", missed: "#8c52ff" };
const TEAM_COLOR_PALETTES = {
  LAL: { made: "#FDB927", missed: "#552583" },
  GSW: { made: "#FFC72C", missed: "#1D428A" },
  CLE: { made: "#FFB81C", missed: "#6F263D" },
  MIA: { made: "#F9A01B", missed: "#98002E" },
  OKC: { made: "#F04E23", missed: "#007AC1" },
  SEA: { made: "#C5A214", missed: "#00543C" },
  BKN: { made: "#F1F2F4", missed: "#0C0C0C" },
  PHX: { made: "#E56020", missed: "#1D1160" }
};

const PLAYER_FALLBACK_COLORS = {
  kobe: TEAM_COLOR_PALETTES.LAL,
  curry: TEAM_COLOR_PALETTES.GSW,
  kd: TEAM_COLOR_PALETTES.OKC,
  lebron: TEAM_COLOR_PALETTES.CLE
};

const DOT_FINAL_RADIUS = 2.4;
const SEASON_INTERVAL_MS = 1200;

let currentShots = [];
let seasonBuckets = [];
let animationHandle = null;

const playerSelect = document.getElementById("playerSelect");
let currentPlayerKey = playerSelect.value;
const playerImage = document.getElementById("playerImage");
const playButton = document.getElementById("playBtn");

loadPlayerShots(playerSelect.value);

playButton.addEventListener("click", () => {
  if (!seasonBuckets.length) return;
  animatePlayerCareer();
});

playerSelect.addEventListener("change", event => {
  const playerKey = event.target.value;
  currentPlayerKey = playerKey;
  playerImage.setAttribute("src", `images/${playerKey}.jpg`);
  loadPlayerShots(playerKey);
});

function loadPlayerShots(playerKey) {
  stopAnimation();
  currentShots = [];
  seasonBuckets = [];
  resetVisualization();

  d3.csv(`data/shots_${playerKey}.csv`, parseShotRow)
    .then(rows => {
      currentShots = rows || [];

      seasonBuckets = d3.groups(currentShots, d => d.season)
        .map(([season, shots]) => ({ season, shots }))
        .sort((a, b) => d3.ascending(a.season, b.season));

      resetVisualization(true);
    })
    .catch(error => {
      console.error("Unable to load shots:", error);
      showTimelineMessage("Unable to load this player's shots.");
    });
}

function parseShotRow(datum) {
  let x = parseFloat(datum.X);
  let y = parseFloat(datum.Y);

  if (!Number.isFinite(x) || !Number.isFinite(y)) return undefined;

  // Mirror shots from the opposite half into the offensive half
  if (y > 47) {
    y = 94 - y;
    x = -x;
  }

  const madeValue = Number(datum.SHOT_MADE);
  const made = Number.isFinite(madeValue)
    ? madeValue === 1
    : String(datum.SHOT_MADE).toLowerCase() === "made";

  return {
    player: datum.PLAYER,
    season: datum.SEASON,
    team: datum.TEAM,
    x,
    y,
    made,
    playoffs: String(datum.PLAYOFFS) === "1"
  };
}

function animatePlayerCareer() {
  resetVisualization();

  let index = 0;
  animationHandle = d3.interval(() => {
    if (index >= seasonBuckets.length) {
      stopAnimation();
      return;
    }

    const { season, shots } = seasonBuckets[index];
    const palette = getColorPalette(shots[0]);
    plotSeasonShots(season, shots, palette);
    addSeasonBar(season, shots, palette);
    index += 1;
  }, SEASON_INTERVAL_MS);
}

function plotSeasonShots(season, shots, palette = DEFAULT_PALETTE) {
  shotsLayer.selectAll(".seasonShots").remove();

  const layer = shotsLayer.append("g")
    .attr("class", "seasonShots")
    .attr("data-season", season)
    .attr("opacity", 0);

  layer.selectAll("circle")
    .data(shots)
    .enter()
    .append("circle")
    .attr("cx", d => scaleX(d.x))
    .attr("cy", d => scaleY(d.y))
    .attr("r", 0)
    .attr("fill", d => d.made ? palette.made : palette.missed)
    .attr("stroke", d => d.playoffs ? "#ffffff" : "none")
    .attr("stroke-width", d => d.playoffs ? 1.2 : 0)
    .attr("opacity", 0.85)
    .transition()
    .duration(550)
    .attr("r", DOT_FINAL_RADIUS);

  layer.transition()
    .duration(350)
    .attr("opacity", 1);
}

function getColorPalette(shot) {
  if (shot && shot.team && TEAM_COLOR_PALETTES[shot.team]) {
    return TEAM_COLOR_PALETTES[shot.team];
  }

  if (PLAYER_FALLBACK_COLORS[currentPlayerKey]) {
    return PLAYER_FALLBACK_COLORS[currentPlayerKey];
  }

  return DEFAULT_PALETTE;
}

function resetVisualization(showHint = false) {
  stopAnimation();
  shotsLayer.selectAll(".seasonShots").remove();
  const seasonBars = d3.select("#seasonBars");
  seasonBars.selectAll("*").remove();

  if (showHint && seasonBuckets.length) {
    seasonBars.append("div")
      .attr("class", "seasonHint")
      .text("Press ▶ Play Career to reveal each season.");
  }
}

function showTimelineMessage(text) {
  const seasonBars = d3.select("#seasonBars");
  seasonBars.selectAll("*").remove();
  seasonBars.append("div")
    .attr("class", "seasonHint")
    .text(text);
}

function stopAnimation() {
  if (animationHandle) {
    animationHandle.stop();
    animationHandle = null;
  }
}
