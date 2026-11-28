/**
 * Formats one runner's line on race-results.html.
 *
 * A result can carry an `official` section, added by mhr-processor's race
 * lookup job when it found and verified the runner in the race's official
 * results. Then the official time and places are shown, with a link to the
 * results page; otherwise the line is what the coach's email said.
 *
 * Loaded by race-results.html with a plain <script> tag and required by the
 * tests, so it must stay free of browser- or Node-only APIs.
 */

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function safeUrl(url) {
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'https:' || parsed.protocol === 'http:' ? parsed.href : null;
  } catch (e) {
    return null;
  }
}

function formatResultLine(result) {
  let html = escapeHtml(result.runner || '');
  const official = result.official;

  if (!official) {
    if (result.placement) html += ` – ${escapeHtml(result.placement)}`;
    if (result.division) html += ` ${escapeHtml(result.division)}`;
    if (result.time) html += ` – ${escapeHtml(result.time)}`;
    return html;
  }

  const parts = [];
  const time = official.chip_time || official.gun_time;
  if (time) parts.push(escapeHtml(time));
  if (official.age_group_place) {
    const group = official.age_group ? ` ${escapeHtml(official.age_group)}` : ' age group';
    parts.push(`${escapeHtml(official.age_group_place)}${group}`);
  }
  if (official.overall_place) parts.push(`${escapeHtml(official.overall_place)} overall`);
  if (parts.length) html += ` – ${parts.join(' · ')}`;

  const url = official.results_url && safeUrl(official.results_url);
  if (url) {
    html += ` <a class="official-result" href="${escapeHtml(url)}" target="_blank" rel="noopener"` +
      ` title="Verified against the official results">✓ official</a>`;
  }
  return html;
}

if (typeof module !== 'undefined') {
  module.exports = { escapeHtml, safeUrl, formatResultLine };
}
