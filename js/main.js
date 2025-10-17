// NBA Career Explorer — D3 v7 implementation
// Expects data/nba_career.csv with columns: player,season,team,pts,ast,reb

(function () {
  const svg = d3.select("#chart");
  const tooltip = d3.select("#tooltip");
  const statSelect = d3.select("#statSelect");
  const playerControls = d3.select("#playerControls");
  const resetBtn = d3.select("#resetBtn");

  const margin = { top: 28, right: 120, bottom: 48, left: 56 };
  let width = 960;
  let height = 520;

  const g = svg.append("g");
  const xAxisG = g.append("g").attr("class", "axis x");
  const yAxisG = g.append("g").attr("class", "axis y");
  const linesG = g.append("g").attr("class", "lines");
  const legendG = g.append("g").attr("class", "legend");

  let data = [];
  let players = [];
  let selectedPlayers = new Set();
  let currentStat = "pts";

  // Color palette tied to player names for stability
  const fixedPalette = [
    "#FDB927", 
    "#1D428A", 
    "#F58426", 
    "#34D399",
    "#60A5FA",
    "#F59E0B",
    "#F43F5E",
    "#A78BFA",
  ];
  const color = d3.scaleOrdinal().range(fixedPalette);

  // Load & prepare data
  d3.csv("data/nba_career.csv").then((raw) => {
    data = raw
      .map((d) => ({
        player: d.player,
        season: +String(d.season).slice(0, 4),
        team: d.team,
        pts: +d.pts,
        ast: +d.ast,
        reb: +d.trb,
      }))
      .filter((d) => d.season && (d.pts || d.ast || d.reb));

    players = Array.from(new Set(data.map((d) => d.player))).sort();
    color.domain(players);

    // Default: turn on first three players if present
    players.slice(0, 3).forEach((p) => selectedPlayers.add(p));

    buildPlayerCheckboxes();
    resize();

    // Event listeners
    statSelect.on("change", () => {
      currentStat = statSelect.node().value;
      render();
    });

    resetBtn.on("click", () => {
      selectedPlayers = new Set(players.slice(0, 3));
      playerControls
        .selectAll('input[type="checkbox"]')
        .property("checked", (d) => selectedPlayers.has(d));
      currentStat = "pts";
      statSelect.property("value", "pts");
      render();
    });

    window.addEventListener("resize", resize);
  });

  function buildPlayerCheckboxes() {
    playerControls.html("");
    playerControls.append("span").attr("class", "label").text("Players");

    const rows = playerControls
      .selectAll("label.checkbox")
      .data(players)
      .join("label")
      .attr("class", "checkbox");

    rows
      .append("input")
      .attr("type", "checkbox")
      .attr("value", (d) => d)
      .property("checked", (d) => selectedPlayers.has(d))
      .on("change", (event, d) => {
        if (event.target.checked) selectedPlayers.add(d);
        else selectedPlayers.delete(d);
        render();
      });

    rows
      .append("span")
      .text((d) => d)
      .style("color", (d) => color(d));
  }

  function resize() {
    const rect = svg.node().getBoundingClientRect();
    width = rect.width || 960;
    height = parseInt(svg.style("height")) || 520;
    svg.attr("viewBox", `0 0 ${width} ${height}`);
    g.attr("transform", `translate(${margin.left},${margin.top})`);
    render();
  }

  function render() {
    if (!data.length) return;

    const innerW = width - margin.left - margin.right;
    const innerH = height - margin.top - margin.bottom;

    const filtered = data.filter((d) => selectedPlayers.has(d.player));

    const x = d3
      .scaleLinear()
      .domain(d3.extent(filtered, (d) => d.season))
      .range([0, innerW]);

    const y = d3
      .scaleLinear()
      .domain([0, d3.max(filtered, (d) => d[currentStat]) || 1])
      .nice()
      .range([innerH, 0]);

    xAxisG
      .attr('transform', `translate(0,${innerH})`)
      .transition().duration(500)
      .call(d3.axisBottom(x).tickFormat(d3.format('d')));

    // Add X-axis label
    xAxisG.selectAll('.axis-label').remove(); // remove previous label if re-rendering
    xAxisG.append('text')
      .attr('class', 'axis-label')
      .attr('x', innerW / 2)
      .attr('y', 40) // distance below axis line
      .attr('fill', '#ccc')
      .attr('text-anchor', 'middle')
      .text('Year');

    yAxisG.transition().duration(500).call(d3.axisLeft(y));

    const series = d3
      .groups(filtered, (d) => d.player)
      .map(([key, values]) => ({
        key,
        values: values.sort((a, b) => a.season - b.season),
      }));

    const lineGen = d3
      .line()
      .defined((d) => Number.isFinite(d[currentStat]))
      .x((d) => x(d.season))
      .y((d) => y(d[currentStat]));

    const lines = linesG.selectAll(".line").data(series, (d) => d.key);

    lines
      .enter()
      .append("path")
      .attr("class", "line")
      .attr("stroke", (d) => color(d.key))
      .attr("d", (d) => lineGen(d.values))
      .attr("opacity", 0)
      .transition()
      .duration(700)
      .attr("opacity", 1);

    lines
      .transition()
      .duration(700)
      .attr("stroke", (d) => color(d.key))
      .attr("d", (d) => lineGen(d.values));

    lines.exit().transition().duration(400).attr("opacity", 0).remove();

    const endpoints = series.map((s) => ({
      key: s.key,
      datum: s.values[s.values.length - 1],
    }));

    const dots = linesG.selectAll(".endpoint").data(endpoints, (d) => d.key);

    dots
      .enter()
      .append("circle")
      .attr("class", "endpoint")
      .attr("r", 4)
      .attr("fill", (d) => color(d.key))
      .attr("cx", (d) => x(d.datum.season))
      .attr("cy", (d) => y(d.datum[currentStat]))
      .on("mouseenter", (event, d) => showTooltip(event, d.datum, d.key))
      .on("mouseleave", hideTooltip);

    dots
      .transition()
      .duration(700)
      .attr("fill", (d) => color(d.key))
      .attr("cx", (d) => x(d.datum.season))
      .attr("cy", (d) => y(d.datum[currentStat]));

    dots.exit().remove();

    drawLegend(series.map((s) => s.key));

    svg.select("#title").remove();
    svg
      .append("title")
      .attr("id", "title")
      .text(`NBA Career Explorer — ${labelForStat(currentStat)}`);

    svg
      .on("mousemove", (event) => {
        const [mx, my] = d3.pointer(event, g.node());
        const near = nearestPoint(series, mx, my, x, y, currentStat);
        if (near) showTooltip(event, near.datum, near.key);
        else hideTooltip();
      })
      .on("mouseleave", hideTooltip);

    const focusDot = g.append("circle")
  .attr("class", "focus-dot")
  .attr("r", 5)
  .style("fill", "white")
  .style("stroke", "black")
  .style("pointer-events", "none")
  .style("opacity", 0);

  function showTooltip(event, d, key) {
    const pageX = event.pageX, pageY = event.pageY;
    tooltip
      .style("left", `${pageX + 12}px`)
      .style("top", `${pageY - 28}px`)
      .style("opacity", 1)
      .html(`
        <div><strong>${key}</strong></div>
        <div>Season: ${d.season}</div>
        <div>${labelForStat(currentStat)}: ${d[currentStat].toFixed(1)}</div>
        <div class="muted">Team: ${d.team || '—'}</div>
      `);

    linesG.selectAll(".line").classed("dimmed", l => l.key !== key);

    focusDot
      .attr("cx", x(d.season))
      .attr("cy", y(d[currentStat]))
      .attr("stroke", color(key))
      .style("opacity", 1);
  }

  function hideTooltip() {
    tooltip.style("opacity", 0);
    linesG.selectAll(".line").classed("dimmed", false);
    focusDot.style("opacity", 0);
  }
  }

  function drawLegend(visibleKeys) {
    const entries = visibleKeys.map((k,i) => ({ key: k, color: d3.color(color(k)) }));

    const legendX = width - margin.right - 100;  // adjust left and right
    const legendY = 350;                         // adjust vertical offset if needed

    legendG.attr('transform', `translate(${legendX}, ${legendY})`);

    const rows = legendG.selectAll('g.item')
      .data(entries, d => d.key)
      .join(
        enter => {
          const g = enter.append('g').attr('class','item');
          g.append('rect')
            .attr('class','swatch')
            .attr('rx',3)
            .attr('ry',3)
            .attr('width', 14)
            .attr('height', 14)
            .attr('y', -10)
            .attr('fill', d => d.color);
          g.append('text')
            .attr('x', 20)
            .attr('y', 2)
            .text(d => d.key);
          return g;
        }
      )
      .attr('transform', (d,i) => `translate(0, ${i * 20})`);
  }

  function labelForStat(stat) {
    return stat === "pts" ? "Points" : stat === "ast" ? "Assists" : "Rebounds";
  }

  function nearestPoint(series, mx, my, x, y, stat) {
    let nearest = null;
    let minDist = Infinity;

    for (const s of series) {
      for (const d of s.values) {
        if (!Number.isFinite(d[stat])) continue;
        const dx = x(d.season);
        const dy = y(d[stat]);
        const dist = Math.hypot(mx - dx, my - dy);
        if (dist < minDist) {
          minDist = dist;
          nearest = { key: s.key, datum: d, dist };
        }
      }
    }

    // Optional: limit sensitivity radius (e.g., only trigger within 40px)
    return nearest && nearest.dist < 40 ? nearest : null;
  }
})();
