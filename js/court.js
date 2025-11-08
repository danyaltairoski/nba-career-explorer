/************************************************************
 * COURT IMAGE + COORDINATE MAPPING
 ************************************************************/
const COURT_IMAGE = "images/half_court.png"; // make sure this exists
const COURT_PIXEL_WIDTH = 993;
const COURT_PIXEL_HEIGHT = 768;

const SHOT_DOMAIN_X = [-25, 25];  // feet
const SHOT_DOMAIN_Y = [0, 47];

const COURT_SVG_WIDTH = 900;
const COURT_SVG_HEIGHT = COURT_SVG_WIDTH / (COURT_PIXEL_WIDTH / COURT_PIXEL_HEIGHT);

const COURT_PADDING = { top: 20, right: 20, bottom: 20, left: 20 };

/************************************************************
 * DRAW COURT USING IMAGE
 ************************************************************/
function drawCourt(svg) {
  svg.selectAll("*").remove();

  const availableWidth = COURT_SVG_WIDTH - COURT_PADDING.left - COURT_PADDING.right;
  const scaleFactor = availableWidth / COURT_PIXEL_WIDTH;
  const scaledHeight = COURT_PIXEL_HEIGHT * scaleFactor;

  svg.attr("viewBox", `0 0 ${COURT_SVG_WIDTH} ${scaledHeight + COURT_PADDING.top + COURT_PADDING.bottom}`);

  const courtGroup = svg.append("g")
    .attr("transform", `translate(${COURT_PADDING.left}, ${COURT_PADDING.top})`);

  courtGroup.append("image")
    .attr("href", COURT_IMAGE)
    .attr("width", COURT_PIXEL_WIDTH * scaleFactor)
    .attr("height", COURT_PIXEL_HEIGHT * scaleFactor)
    .attr("preserveAspectRatio", "xMidYMid meet")
    .attr("opacity", 0.92);

  const shotsLayer = svg.append("g")
    .attr("id", "shotsLayer")
    .attr("transform", `translate(${COURT_PADDING.left}, ${COURT_PADDING.top})`);

  const scaleX = d3.scaleLinear()
    .domain(SHOT_DOMAIN_X)
    .range([0, COURT_PIXEL_WIDTH * scaleFactor]);

  // y coordinates go baseline (0) at bottom of image
  const scaleY = d3.scaleLinear()
    .domain(SHOT_DOMAIN_Y)
    .range([COURT_PIXEL_HEIGHT * scaleFactor, 0]);

  return { scaleX, scaleY, shotsLayer };
}
