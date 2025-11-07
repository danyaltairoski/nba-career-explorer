function addSeasonBar(season, shots, palette = null) {
  const made = shots.filter(s => s.made).length;
  const total = shots.length;
  const missed = total - made;
  const pct = total ? Math.round((made / total) * 100) : 0;

  const madePercent = total ? (made / total) * 100 : 0;
  const missedPercent = 100 - madePercent;
  const madeColor = palette?.made || getComputedStyleColor("--made-color", "#ffd700");
  const missedColor = palette?.missed || getComputedStyleColor("--missed-color", "#8c52ff");

  const container = d3.select("#seasonBars");

  container
    .append("div")
    .attr("class", "seasonCard")
    .html(`
      <div class="seasonTitle">
        <span>${season}</span>
        <span>${pct}% FG</span>
      </div>
      <div class="bar">
        <div class="made" style="width:${madePercent}%; background:${madeColor};"></div>
        <div class="missed" style="width:${missedPercent}%; background:${missedColor};"></div>
      </div>
      <div class="seasonMeta">${made} makes • ${missed} misses (${total} shots)</div>
    `);

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
