/**
 * COURT.JS
 * Fully proportional NBA half-court drawing based on real SportVU tracking coordinates.
 * Uses same X/Y space as your shot data (X = -25→25, Y = 0→47 feet).
 */

const COURT_WIDTH = 900;
const COURT_HEIGHT = 550;
const COURT_PADDING = 40;

// Real NBA dimensions in FEET
const COURT = {
  laneWidth: 16,          // free throw lane width
  laneHeight: 19,         // distance from baseline to FT line
  hoopY: 4.75,            // basket distance from baseline
  hoopRadius: 0.75,       // 9-inch radius
  restrictedRadius: 4,    // restricted area radius
  freeThrowRadius: 8,     // FT circle radius
  threePointRadius: 23.75,
  cornerThreeX: 22
};


export function drawCourt(svg) {
  svg.selectAll("*").remove();
  svg.attr("viewBox", `0 0 ${COURT_WIDTH} ${COURT_HEIGHT}`);

  const court = svg.append("g").attr("id", "courtGroup");

  // Scales that MATCH YOUR SHOT DATA
  const x = d3.scaleLinear()
    .domain([-25, 25]) // same X coordinate domain as shot dataset
    .range([COURT_PADDING, COURT_WIDTH - COURT_PADDING]);

  const y = d3.scaleLinear()
    .domain([0, 47])  // same Y coordinate domain as shot dataset
    .range([COURT_HEIGHT - COURT_PADDING, COURT_PADDING]);

  const pxRadius = v => Math.abs(x(v) - x(0)); // converts feet → px
  const stroke = "#d0b990";


  /**************** COURT FLOOR ****************/
  court.append("rect")
    .attr("x", x(-25))
    .attr("y", y(47))
    .attr("width", x(25) - x(-25))
    .attr("height", y(0) - y(47))
    .attr("rx", 26)
    .attr("fill", "#f8f1e7")
    .attr("stroke", stroke)
    .attr("stroke-width", 2.2);


  /**************** PAINT / LANE ****************/
  court.append("rect")
    .attr("x", x(-COURT.laneWidth / 2))
    .attr("y", y(COURT.laneHeight))
    .attr("width", x(COURT.laneWidth / 2) - x(-COURT.laneWidth / 2))
    .attr("height", y(0) - y(COURT.laneHeight))
    .attr("fill", "#f3dfc0")
    .attr("stroke", stroke)
    .attr("stroke-width", 2);


  /**************** HOOP + BACKBOARD ****************/
  court.append("circle")
    .attr("cx", x(0))
    .attr("cy", y(COURT.hoopY))
    .attr("r", pxRadius(COURT.hoopRadius))
    .attr("fill", "none")
    .attr("stroke", "#c45a00")
    .attr("stroke-width", 3);

  // backboard (3 ft wide, sits behind hoop)
  court.append("line")
    .attr("x1", x(-3))
    .attr("x2", x(3))
    .attr("y1", y(COURT.hoopY + 0.5))
    .attr("y2", y(COURT.hoopY + 0.5))
    .attr("stroke", "#404040")
    .attr("stroke-width", 4);


  /**************** RESTRICTED AREA ****************/
  arc(court, {
    cx: x(0),
    cy: y(COURT.hoopY),
    r: pxRadius(COURT.restrictedRadius),
    start: Math.PI / 2,
    end: -Math.PI / 2,
    stroke,
    width: 2
  });


  /**************** FREE THROW CIRCLE ****************/
  arc(court, {
    cx: x(0),
    cy: y(COURT.laneHeight),
    r: pxRadius(COURT.freeThrowRadius),
    start: Math.PI / 2,
    end: -Math.PI / 2,
    stroke,
    width: 2
  });

  arc(court, {
    cx: x(0),
    cy: y(COURT.laneHeight),
    r: pxRadius(COURT.freeThrowRadius),
    start: -Math.PI / 2,
    end: Math.PI / 2,
    stroke,
    width: 2,
    dash: "6,6"
  });


  /**************** THREE POINT LINE (CLEAN AND PROPORTIONAL) ****************/
  drawThreePointLine(court, x, y, pxRadius);


  /**************** HALF COURT LINE ****************/
  court.append("line")
    .attr("x1", x(-25))
    .attr("x2", x(25))
    .attr("y1", y(47))
    .attr("y2", y(47))
    .attr("stroke", stroke)
    .attr("stroke-width", 1.6);
}


/**
 * Draws the EXACT NBA 3-pt line based on geometry (no hacky rotation)
 */
function drawThreePointLine(group, x, y, pxRadius) {
  const cornerHeight = COURT.hoopY +
    Math.sqrt((COURT.threePointRadius ** 2) - (COURT.cornerThreeX ** 2));

  const stroke = "#d0b990";

  // corner straight lines
  group.append("line")
    .attr("x1", x(-COURT.cornerThreeX))
    .attr("x2", x(-COURT.cornerThreeX))
    .attr("y1", y(0))
    .attr("y2", y(cornerHeight))
    .attr("stroke", stroke)
    .attr("stroke-width", 2);

  group.append("line")
    .attr("x1", x(COURT.cornerThreeX))
    .attr("x2", x(COURT.cornerThreeX))
    .attr("y1", y(0))
    .attr("y2", y(cornerHeight))
    .attr("stroke", stroke)
    .attr("stroke-width", 2);

  const theta = Math.acos(
    COURT.cornerThreeX / COURT.threePointRadius
  );

  // arc between corners
  arc(group, {
    cx: x(0),
    cy: y(COURT.hoopY),
    r: pxRadius(COURT.threePointRadius),
    start: Math.PI + theta,
    end: 2 * Math.PI - theta,
    stroke,
    width: 2
  });
}


/**
 * Arc helper
 */
function arc(group, { cx, cy, r, start, end, stroke, width, dash }) {
  const path = d3.arc()
    .innerRadius(r)
    .outerRadius(r)
    .startAngle(start)
    .endAngle(end);

  const el = group.append("path")
    .attr("d", path())
    .attr("transform", `translate(${cx}, ${cy})`)
    .attr("fill", "none")
    .attr("stroke", stroke)
    .attr("stroke-width", width);

  if (dash) el.attr("stroke-dasharray", dash);
}