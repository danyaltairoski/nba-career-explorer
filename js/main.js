const svg = d3.select("#court");
let courtScales = drawCourt(svg);
let scaleX = courtScales.scaleX;
let scaleY = courtScales.scaleY;
let shotsLayer = courtScales.shotsLayer;

const DEFAULT_PALETTE = { made: "#4da6ff", missed: "#ff5c8a" };
const HOOP_Y = 4.75;
const SHOT_TYPE_THRESHOLDS = {
  rim: 8,
  three: 22
};
const TEAM_COLOR_PALETTES = {
  LAL: { made: "#FDB927", missed: "#552583" },
  GSW: { made: "#FFC72C", missed: "#1D428A" },
  CLE: { made: "#FFB81C", missed: "#6F263D" },
  MIA: { made: "#F9A01B", missed: "#98002E" },
  OKC: { made: "#F04E23", missed: "#007AC1" },
  SEA: { made: "#C5A214", missed: "#00543C" },
  BKN: { made: "#58595cff", missed: "#b0aaaaff" },
  PHX: { made: "#E56020", missed: "#1D1160" },
  HOU: { made: "#CE1141", missed: "#C4CED4" }
};

const PLAYER_FALLBACK_COLORS = {
  kobe: TEAM_COLOR_PALETTES.LAL,
  curry: TEAM_COLOR_PALETTES.GSW,
  kd: TEAM_COLOR_PALETTES.OKC,
  lebron: TEAM_COLOR_PALETTES.CLE
};

const DATA_ROOTS = ["data", "data_new"];
const HIGHLIGHT_DESC_KEYS = ["HIGHLIGHT_DESC", "Highlight_desc", "highlight_desc", " Highlight_desc"];
const HIGHLIGHT_MEDIA_KEYS = [
  "HIGHLIGHT_MEDIA",
  "Highlight_media",
  "highlight_media",
  " Highlight_media",
  "Highlight_gif",
  "highlight_gif",
  " Highlight_gif"
];

const DOT_FINAL_RADIUS = 2.4;
const SEASON_INTERVAL_MS = 1200;

let currentShots = [];
let seasonBuckets = [];
let animationHandle = null;
let seasonShotMap = new Map();
const playerShotsCache = new Map();

const playerSelect = document.getElementById("playerSelect");
let currentPlayerKey = playerSelect.value;
const playerImage = document.getElementById("playerImage");
const playButton = document.getElementById("playBtn");
const tooltipEl = d3.select("#shotTooltip");
const tooltipSeasonEl = tooltipEl.empty() ? null : tooltipEl.select(".tooltipSeason");
const tooltipTextEl = tooltipEl.empty() ? null : tooltipEl.select(".tooltipText");
const tooltipMediaEl = tooltipEl.empty() ? null : tooltipEl.select(".tooltipMedia");

const TEAM_NAME_TO_CODE = {
  "golden state warriors": "GSW",
  "los angeles lakers": "LAL",
  "cleveland cavaliers": "CLE",
  "miami heat": "MIA",
  "oklahoma city thunder": "OKC",
  "seattle supersonics": "SEA",
  "brooklyn nets": "BKN",
  "phoenix suns": "PHX"
};

const PLAYER_SEASON_ACHIEVEMENTS = {
  kobe: {
    mvps: new Set(["2007-08"]),
    championships: new Set(["1999-00", "2000-01", "2001-02", "2008-09", "2009-10"])
  },
  lebron: {
    mvps: new Set(["2008-09", "2009-10", "2011-12", "2012-13"]),
    championships: new Set(["2011-12", "2012-13", "2015-16", "2019-20"])
  },
  curry: {
    mvps: new Set(["2014-15", "2015-16"]),
    championships: new Set(["2014-15", "2016-17", "2017-18", "2021-22"])
  },
  kd: {
    mvps: new Set(["2013-14"]),
    championships: new Set(["2016-17", "2017-18"])
  }
};

const PLAYER_DATA_MANIFEST = {
  kobe: {
    dataFiles: ["shots_kobe.csv"],
    defaultTeam: "LAL"
  },
  lebron: {
    dataFiles: ["shots_lebron.csv"],
    defaultTeam: "CLE"
  },
  curry: {
    dataFiles: ["shots_curry.csv"],
    defaultTeam: "GSW"
  },
  kd: {
    dataFiles: ["shots_kd.csv"],
    defaultTeam: "OKC"
  }
};

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
  showTimelineMessage("Loading shots...");

  courtScales = drawCourt(svg); // re-render image so shotsLayer resets
  scaleX = courtScales.scaleX;
  scaleY = courtScales.scaleY;
  shotsLayer = courtScales.shotsLayer;

  const manifest = PLAYER_DATA_MANIFEST[playerKey];
  if (!manifest) {
    console.warn(`No data manifest found for player "${playerKey}".`);
    showTimelineMessage("No shot data available for this player.");
    return;
  }

  const parseForPlayer = datum => parseShotRow(datum, playerKey);

  if (playerShotsCache.has(playerKey)) {
    hydrateSeasonData(playerShotsCache.get(playerKey));
    return;
  }

  const dataFiles = manifest.dataFiles && manifest.dataFiles.length
    ? manifest.dataFiles
    : buildLegacySeasonFileList(manifest);

  if (!dataFiles || !dataFiles.length) {
    console.warn(`No data files configured for player "${playerKey}".`);
    showTimelineMessage("No shot data available for this player.");
    return;
  }

  const loadPromises = dataFiles.map(relativePath => loadSeasonCsv(relativePath, parseForPlayer));

  Promise.all(loadPromises)
    .then(chunks => {
      const combined = [];
      chunks.forEach(chunk => {
        if (Array.isArray(chunk) && chunk.length) {
          combined.push(...chunk);
        }
      });

      const combinedShots = combined.filter(Boolean);
      playerShotsCache.set(playerKey, combinedShots);
      hydrateSeasonData(combinedShots);
    })
    .catch(error => {
      console.error("Unable to load shots:", error);
      showTimelineMessage("Unable to load this player's shots.");
    });
}

function parseShotRow(datum, playerKey) {
  if (!datum) return undefined;
  const shot = ("X" in datum || "Y" in datum)
    ? parseLegacyShotRow(datum)
    : parseModernShotRow(datum, playerKey);

  if (!shot) return undefined;

  const achievements = PLAYER_SEASON_ACHIEVEMENTS[playerKey];
  if (achievements) {
    if (typeof shot.mvp === "undefined") {
      shot.mvp = achievements.mvps?.has(shot.season) || false;
    }
    if (typeof shot.champion === "undefined") {
      shot.champion = achievements.championships?.has(shot.season) || false;
    }
  }

  return shot;
}

function readShotStringField(datum, keys) {
  if (!datum || !Array.isArray(keys)) return "";
  for (const key of keys) {
    if (!key) continue;
    if (Object.prototype.hasOwnProperty.call(datum, key)) {
      const value = datum[key];
      if (value == null) continue;
      const trimmed = String(value).trim();
      if (trimmed) return trimmed;
    }
  }
  return "";
}

function parseLegacyShotRow(datum) {
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

  const highlightDesc = readShotStringField(datum, HIGHLIGHT_DESC_KEYS);
  const highlightMedia = readShotStringField(datum, HIGHLIGHT_MEDIA_KEYS);

  return {
    player: datum.PLAYER,
    season: datum.SEASON,
    team: datum.TEAM,
    x,
    y,
    made,
    playoffs: String(datum.PLAYOFFS) === "1",
    mvp: String(datum.MVP) === "1",
    champion: String(datum.Champion) === "1",
    highlightDesc,
    highlightMedia,
    hasHighlight: Boolean(highlightDesc || highlightMedia)
  };
}

function parseModernShotRow(datum, playerKey) {
  let x = parseFloat(datum.loc_x);
  let y = parseFloat(datum.loc_y);

  if (!Number.isFinite(x) || !Number.isFinite(y)) return undefined;

  if (y > 47) {
    y = 94 - y;
    x = -x;
  }

  const attemptedFlag = Number(datum.shot_attempted_flag ?? 1);
  if (Number.isFinite(attemptedFlag) && attemptedFlag === 0) return undefined;

  const madeFlag = (datum.shot_made_flag || "").toString().toLowerCase();
  const made = madeFlag === "made" || Number(datum.shot_made_numeric) === 1;
  const season = formatSeasonLabel(datum.season);
  const team = getTeamCodeFromName(datum.team_name, playerKey);

  return {
    player: datum.player_name || "",
    season,
    team,
    x,
    y,
    made,
    playoffs: false,
    highlightDesc: buildShotDescription(datum),
    highlightMedia: "",
    hasHighlight: false
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
    const hasHighlight = Boolean(d.hasHighlight);
    shot.classed("hasHighlight", hasHighlight);
    shot.style("pointer-events", "auto");

    if (hasHighlight) {
      const indicator = shot.insert("g", ":first-child")
        .attr("class", "highlightIndicator");

      indicator.append("circle")
        .attr("class", "highlightRing")
        .attr("r", DOT_FINAL_RADIUS * 5);

      indicator.append("circle")
        .attr("class", "highlightPulse")
        .attr("r", DOT_FINAL_RADIUS * 3.2);

      shot.insert("circle", ":first-child")
        .attr("class", "highlightHoverArea")
        .attr("r", DOT_FINAL_RADIUS * 4)
        .attr("fill", "transparent");
    }

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
      const drawLine = () => shot.append("line")
        .attr("x1", 0)
        .attr("x2", 0)
        .attr("y1", 0)
        .attr("y2", 0)
        .attr("stroke", palette.missed)
        .attr("stroke-width", 1.6)
        .transition()
        .duration(550);

      drawLine()
        .attr("x1", -size)
        .attr("x2", size)
        .attr("y1", -size)
        .attr("y2", size);

      drawLine()
        .attr("x1", -size)
        .attr("x2", size)
        .attr("y1", size)
        .attr("y2", -size);
    }

    if (hasHighlight) {
      shot.on("mouseenter", event => showShotTooltip(event, d))
        .on("mousemove", moveShotTooltip)
        .on("mouseleave", hideShotTooltip);
    } else {
      shot.on("mouseenter", null)
        .on("mousemove", null)
        .on("mouseleave", null);
    }
  });

  layer.transition()
    .duration(350)
    .attr("opacity", 1);

  if (typeof updateShotTypeViz === "function") {
    updateShotTypeViz(season, computeShotTypeCounts(shots));
  }
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
  if (typeof updateShotTypeViz === "function") {
    updateShotTypeViz(season, computeShotTypeCounts(entry.shots));
  }
}
window.showSeasonShots = showSeasonShots;

function highlightSeasonCard(season) {
  d3.selectAll(".seasonCard")
    .classed("active", function () {
      return d3.select(this).attr("data-season") === season;
    });
}

function computeShotTypeCounts(shots) {
  const counts = { rim: 0, mid: 0, three: 0 };
  shots.forEach(shot => {
    const dx = shot.x;
    const dy = shot.y - HOOP_Y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    if (distance <= SHOT_TYPE_THRESHOLDS.rim) {
      counts.rim += 1;
    } else if (distance >= SHOT_TYPE_THRESHOLDS.three) {
      counts.three += 1;
    } else {
      counts.mid += 1;
    }
  });
  return counts;
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

  if (typeof resetShotTypeViz === "function") {
    resetShotTypeViz();
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

function showShotTooltip(event, shot) {
  if (tooltipEl.empty()) return;
  tooltipEl.classed("hidden", false);
  positionTooltip(event);
  if (tooltipSeasonEl) {
    tooltipSeasonEl.text(`${shot.player || "Player"} • ${shot.season || ""}`);
  }
  if (tooltipTextEl) {
    const fallback = `Shot at (${Number(shot.x).toFixed(1)}, ${Number(shot.y).toFixed(1)})`;
    tooltipTextEl.text((shot.highlightDesc || fallback).trim());
  }
  if (tooltipMediaEl) {
    tooltipMediaEl.html("");
    const media = (shot.highlightMedia || "").trim();

    if (media) {
      if (/\.(mp4|webm)$/i.test(media)) {
        tooltipMediaEl.append("video")
          .attr("src", media)
          .attr("autoplay", true)
          .attr("loop", true)
          .attr("muted", true)
          .attr("playsinline", true)
          .attr("controls", true);
      } else {
        tooltipMediaEl.append("img")
          .attr("src", media)
          .attr("alt", shot.highlightDesc || "Highlight media");
      }
    }
  }
}

function hideShotTooltip() {
  if (tooltipEl.empty()) return;
  tooltipEl.classed("hidden", true);
  if (tooltipMediaEl) tooltipMediaEl.html("");
}

function moveShotTooltip(event) {
  if (tooltipEl.empty() || tooltipEl.classed("hidden")) return;
  positionTooltip(event);
}

function positionTooltip(event) {
  if (tooltipEl.empty()) return;
  const padding = 16;
  const tooltipWidth = tooltipEl.node().offsetWidth || 240;
  const tooltipHeight = tooltipEl.node().offsetHeight || 140;
  let x = event.clientX + 18;
  let y = event.clientY + 18;

  const maxX = window.innerWidth - tooltipWidth - padding;
  const maxY = window.innerHeight - tooltipHeight - padding;

  if (x > maxX) x = event.clientX - tooltipWidth - 18;
  if (y > maxY) y = event.clientY - tooltipHeight - 18;

  tooltipEl
    .style("transform", `translate(${Math.max(padding, x)}px, ${Math.max(padding, y)}px)`);
}

function makeSeasonRange(startYear, endYear) {
  const seasons = [];
  for (let year = startYear; year <= endYear; year += 1) {
    seasons.push(String(year));
  }
  return seasons;
}

function buildLegacySeasonFileList(manifest) {
  if (
    !manifest
    || !manifest.folder
    || !manifest.filePrefix
    || !Array.isArray(manifest.seasons)
    || !manifest.seasons.length
  ) {
    return null;
  }
  return manifest.seasons.map(season => `${manifest.folder}/${manifest.filePrefix}${season}.csv`);
}

function formatSeasonLabel(rawSeason) {
  if (!rawSeason && rawSeason !== 0) return "";
  const seasonStr = String(rawSeason).trim();
  if (/^\d{4}-\d{2}$/.test(seasonStr)) return seasonStr;
  if (/^\d{4}-\d{4}$/.test(seasonStr)) {
    return `${seasonStr.slice(0, 4)}-${seasonStr.slice(-2)}`;
  }

  const startYear = Number(seasonStr);
  if (!Number.isFinite(startYear)) return seasonStr;
  const endSuffix = String(startYear + 1).slice(-2).padStart(2, "0");
  return `${startYear}-${endSuffix}`;
}

function seasonSortValue(season) {
  if (!season) return Infinity;
  const match = /^(\d{4})/.exec(season);
  return match ? Number(match[1]) : Infinity;
}

function getTeamCodeFromName(teamName, playerKey) {
  if (!teamName && teamName !== 0) {
    return PLAYER_DATA_MANIFEST[playerKey]?.defaultTeam || "";
  }
  const normalized = String(teamName).trim().toLowerCase();
  if (TEAM_NAME_TO_CODE[normalized]) return TEAM_NAME_TO_CODE[normalized];
  return PLAYER_DATA_MANIFEST[playerKey]?.defaultTeam || normalized.slice(0, 3).toUpperCase();
}

function buildShotDescription(datum) {
  const primary = (datum.action_type || datum.event_type || "").trim();
  const zone = (datum.shot_zone_basic || datum.shot_type || "").trim();
  const distanceValue = Number(datum.shot_distance);
  const distance = Number.isFinite(distanceValue) && distanceValue > 0
    ? `${distanceValue} ft`
    : "";

  return [primary, zone, distance].filter(Boolean).join(" • ");
}

function hydrateSeasonData(shots) {
  currentShots = shots || [];

  if (!currentShots.length) {
    showTimelineMessage("No shot data available for this player.");
    return;
  }

  seasonBuckets = d3.groups(currentShots, d => d.season)
    .map(([season, seasonShots]) => ({ season, shots: seasonShots }))
    .sort((a, b) => d3.ascending(seasonSortValue(a.season), seasonSortValue(b.season)));
  seasonShotMap = new Map(seasonBuckets.map(entry => [entry.season, entry]));

  resetVisualization(true);
}

function loadSeasonCsv(relativePath, parseRow) {
  const tryLoad = index => {
    if (index >= DATA_ROOTS.length) {
      console.warn(`Skipping ${relativePath}: file not found in ${DATA_ROOTS.join(", ")}`);
      return Promise.resolve([]);
    }

    const root = DATA_ROOTS[index];
    const fullPath = `${root}/${relativePath}`;
    return d3.csv(fullPath, parseRow)
      .then(rows => rows || [])
      .catch(error => {
        if (index === DATA_ROOTS.length - 1) {
          console.warn(`Skipping ${fullPath}:`, error);
          return [];
        }
        return tryLoad(index + 1);
      });
  };

  return tryLoad(0);
}
