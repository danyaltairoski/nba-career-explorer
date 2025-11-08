/************************************************************
 * COURT CONFIG
 ************************************************************/
const COURT_WIDTH = 900;
const COURT_HEIGHT = 550;
const COURT_PADDING = { top: 25, right: 80, bottom: 35, left: 80 };

const SHOT_DOMAIN_X = [-25, 25];       // feet
const SHOT_DOMAIN_Y = [0, 47];         // feet (baseline → halfcourt)

const COURT = {
  laneWidth: 16,
  laneHeight: 19,
  hoopY: 4.75,
  hoopRadius: 0.75,
  restricted: 4,
  freeThrowRadius: 8,

  threePointRadius: 23.75,
  cornerThreeX: 22,
};


/************************************************************
 * MAIN COURT DRAW FUNCTION
 ************************************************************/
function drawCourt(svg) {
  svg.selectAll("*").remove();
  svg.attr("viewBox", `0 0 ${COURT_WIDTH} ${COURT_HEIGHT}`);

  const court = svg.append("g").attr("id", "court");
  const shotsLayer = svg.append("g")
    .attr("id", "shotsLayer")
    .attr("pointer-events", "none");

  /**************** SCALES ****************/
  const scaleX = d3.scaleLinear()
    .domain(SHOT_DOMAIN_X)
    .range([COURT_PADDING.left, COURT_WIDTH - COURT_PADDING.right]);

  const scaleY = d3.scaleLinear()
    .domain(SHOT_DOMAIN_Y)
    .range([COURT_HEIGHT - COURT_PADDING.bottom, COURT_PADDING.top]);

  const x = v => scaleX(v);
  const y = v => scaleY(v);
  const r = v => Math.abs(scaleX(v) - scaleX(0));  // convert feet radius → px
  const h = (min, max) => Math.abs(scaleY(max) - scaleY(min));
  const w = (min, max) => Math.abs(scaleX(max) - scaleX(min));


  /**************** COURT SURFACE ****************/
  court.append("rect")
    .attr("x", x(SHOT_DOMAIN_X[0]))
    .attr("y", y(SHOT_DOMAIN_Y[1]))
    .attr("width", w(...SHOT_DOMAIN_X))
    .attr("height", h(...SHOT_DOMAIN_Y))
    .attr("rx", 28)
    .attr("fill", "#f8f1e7")
    .attr("stroke", "#d0b990")
    .attr("stroke-width", 2.2);


  /**************** PAINT / LANE ****************/
  court.append("rect")
    .attr("x", x(-COURT.laneWidth / 2))
    .attr("y", y(COURT.laneHeight))
    .attr("width", w(-COURT.laneWidth / 2, COURT.laneWidth / 2))
    .attr("height", h(COURT.laneHeight, 0))
    .attr("fill", "#f3dfc0")
    .attr("stroke", "#d0b990")
    .attr("stroke-width", 2);


  /**************** FREE THROW CIRCLE ****************/
  drawArc(court, x(0), y(COURT.laneHeight), r(COURT.freeThrowRadius),
          Math.PI / 2, -Math.PI / 2, "#d0b990", 2);
  drawArc(court, x(0), y(COURT.laneHeight), r(COURT.freeThrowRadius),
          -Math.PI / 2, Math.PI / 2, "#d0b990", 2, "6,6");


  /**************** HOOP + BACKBOARD ****************/
  court.append("circle")
    .attr("cx", x(0))
    .attr("cy", y(COURT.hoopY))
    .attr("r", r(COURT.hoopRadius))
    .attr("fill", "none")
    .attr("stroke", "#c45a00")
    .attr("stroke-width", 3);

  // backboard 
  court.append("line")
    .attr("x1", x(-3))
    .attr("x2", x(3))
    .attr("y1", y(COURT.hoopY-1.4))
    .attr("y2", y(COURT.hoopY-1.4))
    .attr("stroke", "#4c4c4c")
    .attr("stroke-width", 4);


  /**************** RESTRICTED AREA ****************/
  drawArc(court, x(0), y(COURT.hoopY), r(COURT.restricted),
          Math.PI / 2, -Math.PI / 2, "#d0b990", 2);


  /**************** THREE POINT LINE ****************/
  drawThreePointLine(court, x, y, r);

  return { scaleX, scaleY, shotsLayer };
}


/************************************************************
 * THREE POINT LINE 
 ************************************************************/
function drawThreePointLine(group, x, y, r) {
  const cornerY_feet =
    COURT.hoopY + Math.sqrt((COURT.threePointRadius ** 2) - (COURT.cornerThreeX ** 2));

  const cornerY_px = y(cornerY_feet);

  const stroke = "#d0b990";

  // straight lines in corners
  group.append("line")
    .attr("x1", x(-COURT.cornerThreeX))
    .attr("x2", x(-COURT.cornerThreeX))
    .attr("y1", y(0))
    .attr("y2", cornerY_px)
    .attr("stroke", stroke)
    .attr("stroke-width", 2);

  group.append("line")
    .attr("x1", x(COURT.cornerThreeX))
    .attr("x2", x(COURT.cornerThreeX))
    .attr("y1", y(0))
    .attr("y2", cornerY_px)
    .attr("stroke", stroke)
    .attr("stroke-width", 2);

  // arc between them
  const theta = Math.acos(COURT.cornerThreeX / COURT.threePointRadius);
  drawArc(group, x(0), y(COURT.hoopY), r(COURT.threePointRadius),
          Math.PI + theta, Math.PI * 2 - theta, stroke, 2);
}


/************************************************************
 * ARC HELPERS
 ************************************************************/
function drawArc(container, cx, cy, radius, startAngle, endAngle, stroke, strokeWidth, dash) {
  const arc = d3.arc()
    .innerRadius(radius)
    .outerRadius(radius)
    .startAngle(startAngle)
    .endAngle(endAngle);

  const el = container.append("path")
    .attr("d", arc())
    .attr("transform", `translate(${cx}, ${cy})`)
    .attr("fill", "none")
    .attr("stroke", stroke)
    .attr("stroke-width", strokeWidth);

  if (dash) el.attr("stroke-dasharray", dash);
}
