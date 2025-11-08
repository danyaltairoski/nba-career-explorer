const svg = d3.select("#court");
let courtScales = drawCourt(svg);
let scaleX = courtScales.scaleX;
let scaleY = courtScales.scaleY;
let shotsLayer = courtScales.shotsLayer;

const DEFAULT_PALETTE = { made: "#4da6ff", missed: "#ff5c8a" };
const TEAM_COLOR_PALETTES = {
  LAL: { made: "#FDB927", missed: "#552583" },
  GSW: { made: "#FFC72C", missed: "#1D428A" },
  CLE: { made: "#FFB81C", missed: "#6F263D" },
  MIA: { made: "#F9A01B", missed: "#98002E" },
  OKC: { made: "#F04E23", missed: "#007AC1" },
  SEA: { made: "#C5A214", missed: "#00543C" },
  BKN: { made: "#4bbfb5ff" , missed: "#707070ff" },
  PHX: { made: "#E56020", missed: "#1D1160" },
  HOU: { made: "#7a5959ff", missed: "#e83111ff" }
};

const PLAYER_FALLBACK_COLORS = {
  kobe: TEAM_COLOR_PALETTES.LAL,
  curry: TEAM_COLOR_PALETTES.GSW,
  kd: TEAM_COLOR_PALETTES.OKC,
  lebron: TEAM_COLOR_PALETTES.CLE
};

const DOT_FINAL_RADIUS = 2.4;
const SEASON_INTERVAL_MS = 1500;

let currentShots = [];
let seasonBuckets = [];
let animationHandle = null;
let seasonShotMap = new Map();

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

  courtScales = drawCourt(svg); // re-render image so shotsLayer resets
  scaleX = courtScales.scaleX;
  scaleY = courtScales.scaleY;
  shotsLayer = courtScales.shotsLayer;

  d3.csv(`data/shots_${playerKey}.csv`, parseShotRow)
    .then(rows => {
      currentShots = rows || [];

      seasonBuckets = d3.groups(currentShots, d => d.season)
        .map(([season, shots]) => ({ season, shots }))
        .sort((a, b) => d3.ascending(a.season, b.season));
      seasonShotMap = new Map(seasonBuckets.map(entry => [entry.season, entry]));

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
    playoffs: String(datum.PLAYOFFS) === "1",
    mvp: String(datum.MVP) === "1",
    champion: String(datum.Champion) === "1"
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
    highlightSeasonCard(season);
    index += 1;
  }, SEASON_INTERVAL_MS);
}

function plotSeasonShots(season, shots, palette = DEFAULT_PALETTE) {
  shotsLayer.selectAll(".seasonShots").remove();

  const layer = shotsLayer.append("g")
    .attr("class", "seasonShots")
    .attr("data-season", season)
    .attr("opacity", 0);

  const shotsGroup = layer.selectAll("g.shot")
    .data(shots)
    .enter()
    .append("g")
    .attr("class", "shot")
    .attr("transform", d => `translate(${scaleX(d.x)}, ${scaleY(d.y)})`)
    .attr("opacity", 0);

  shotsGroup
    .transition()
    .duration(250)
    .attr("opacity", 1);

  shotsGroup.each(function (d) {
    const shot = d3.select(this);
    if (d.made) {
      shot.append("circle")
        .attr("r", 0)
        .attr("fill", "none")
        .attr("stroke", palette.made)
        .attr("stroke-width", 1.8)
        .transition()
        .duration(550)
        .attr("r", DOT_FINAL_RADIUS * 1.8);
    } else {
      const size = DOT_FINAL_RADIUS * 1.2;
      shot.append("line")
        .attr("x1", 0)
        .attr("x2", 0)
        .attr("y1", 0)
        .attr("y2", 0)
        .attr("stroke", palette.missed)
        .attr("stroke-width", 1.6)
        .transition()
        .duration(550)
        .attr("x1", -size)
        .attr("x2", size)
        .attr("y1", -size)
        .attr("y2", size);

      shot.append("line")
        .attr("x1", 0)
        .attr("x2", 0)
        .attr("y1", 0)
        .attr("y2", 0)
        .attr("stroke", palette.missed)
        .attr("stroke-width", 1.6)
        .transition()
        .duration(550)
        .attr("x1", -size)
        .attr("x2", size)
        .attr("y1", size)
        .attr("y2", -size);
    }
  });

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

function showSeasonShots(season) {
  const entry = seasonShotMap.get(season);
  if (!entry) return;
  const palette = getColorPalette(entry.shots[0]);
  plotSeasonShots(season, entry.shots, palette);
  highlightSeasonCard(season);
}
window.showSeasonShots = showSeasonShots;

function highlightSeasonCard(season) {
  d3.selectAll(".seasonCard")
    .classed("active", function () {
      return d3.select(this).attr("data-season") === season;
    });
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
