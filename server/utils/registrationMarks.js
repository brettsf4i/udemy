const { mmToPx } = require('./projectionServer');

/**
 * Generate SVG registration mark elements.
 * 4 circles at corners, 3mm diameter, inset 8mm from edges.
 * stroke="#000000" stroke-width="0.5" fill="none"
 *
 * @param {number} widthPx - SVG width in pixels
 * @param {number} heightPx - SVG height in pixels
 * @returns {string} SVG string containing 4 circle elements
 */
function generateRegistrationMarks(widthPx, heightPx) {
  const diameterPx = mmToPx(3);
  const radiusPx = diameterPx / 2;
  const insetPx = mmToPx(8);

  const positions = [
    { cx: insetPx, cy: insetPx },                           // top-left
    { cx: widthPx - insetPx, cy: insetPx },                 // top-right
    { cx: insetPx, cy: heightPx - insetPx },                // bottom-left
    { cx: widthPx - insetPx, cy: heightPx - insetPx },      // bottom-right
  ];

  const circles = positions.map(
    ({ cx, cy }) =>
      `  <circle cx="${cx.toFixed(2)}" cy="${cy.toFixed(2)}" r="${radiusPx.toFixed(2)}" stroke="#000000" stroke-width="0.5" fill="none"/>`
  );

  return `<g id="registration-marks">\n${circles.join('\n')}\n</g>`;
}

module.exports = {
  generateRegistrationMarks,
};
