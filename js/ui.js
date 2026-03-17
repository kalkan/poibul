/**
 * UI module: sidebar rendering, event binding, and state management.
 */

import { formatNumber, capitalise } from './utils.js';

/* ── DOM refs ── */
const $ = id => document.getElementById(id);

const els = {};

export function cacheDom() {
  els.searchInput = $('search-input');
  els.searchBtn = $('search-btn');
  els.searchResults = $('search-results');
  els.selectionInfo = $('selection-info');
  els.selLat = $('sel-lat');
  els.selLon = $('sel-lon');
  els.clearBtn = $('clear-btn');
  els.loading = $('loading');
  els.errorMsg = $('error-msg');
  els.summarySection = $('summary-section');
  els.summaryText = $('summary-text');
  els.settlementsSection = $('settlements-section');
  els.settlementsCount = $('settlements-count');
  els.settlementsList = $('settlements-list');
  els.infrastructureSection = $('infrastructure-section');
  els.airportsCount = $('airports-count');
  els.airportsList = $('airports-list');
  els.portsCount = $('ports-count');
  els.portsList = $('ports-list');
  els.damsCount = $('dams-count');
  els.damsList = $('dams-list');
  els.dataNotes = $('data-notes');
  els.emptyState = $('empty-state');
  els.radiusInput = $('radius-input');
}

export function getRadiusKm() {
  const val = parseInt(els.radiusInput.value, 10);
  if (isNaN(val) || val < 10) return 10;
  if (val > 500) return 500;
  return val;
}

/* ── Show/hide helpers ── */
function show(el) { el.classList.remove('hidden'); }
function hide(el) { el.classList.add('hidden'); }

/* ── Event binding ── */

export function bindEvents({ onSearch, onClear, onSearchSelect }) {
  els.searchBtn.addEventListener('click', () => onSearch(els.searchInput.value));
  els.searchInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') onSearch(els.searchInput.value);
  });
  els.clearBtn.addEventListener('click', onClear);

  // Store callback for search result selection
  els._onSearchSelect = onSearchSelect;
}

/* ── Search results dropdown ── */

export function showSearchResults(results) {
  if (!results.length) {
    els.searchResults.innerHTML = '<div class="search-result-item" style="cursor:default;color:#94a3b8;">No results found</div>';
    show(els.searchResults);
    return;
  }
  els.searchResults.innerHTML = results.map((r, i) =>
    `<div class="search-result-item" data-idx="${i}">${truncate(r.displayName, 80)}</div>`
  ).join('');
  show(els.searchResults);

  els.searchResults.querySelectorAll('.search-result-item[data-idx]').forEach(item => {
    item.addEventListener('click', () => {
      const idx = parseInt(item.dataset.idx);
      hide(els.searchResults);
      if (els._onSearchSelect) els._onSearchSelect(results[idx]);
    });
  });
}

export function hideSearchResults() {
  hide(els.searchResults);
}

/* ── Selection info ── */

export function showSelectionInfo(lat, lon) {
  els.selLat.textContent = lat.toFixed(4);
  els.selLon.textContent = lon.toFixed(4);
  show(els.selectionInfo);
  hide(els.emptyState);
}

/* ── Loading ── */
export function showLoading(msg) {
  const span = els.loading.querySelector('span');
  if (span) span.textContent = msg || 'Querying nearby features…';
  show(els.loading);
}
export function updateLoadingMsg(msg) {
  const span = els.loading.querySelector('span');
  if (span) span.textContent = msg;
}
export function hideLoading() { hide(els.loading); }

/* ── Error ── */
export function showError(msg) {
  els.errorMsg.textContent = msg;
  show(els.errorMsg);
}
export function hideError() { hide(els.errorMsg); }

/* ── Render results ── */

let itemClickHandler = null;

export function setItemClickHandler(handler) {
  itemClickHandler = handler;
}

export function renderResults(data, summary) {
  hideLoading();

  // Summary
  els.summaryText.textContent = summary;
  show(els.summarySection);

  // Settlements
  if (data.settlements.length > 0) {
    els.settlementsCount.textContent = data.settlements.length;
    els.settlementsList.innerHTML = data.settlements.map(s => settlementCard(s)).join('');
    show(els.settlementsSection);
  } else {
    els.settlementsCount.textContent = '0';
    els.settlementsList.innerHTML = '<div class="no-results">No settlements found in this radius.</div>';
    show(els.settlementsSection);
  }

  // Airports
  els.airportsCount.textContent = data.airports.length;
  els.airportsList.innerHTML = data.airports.length
    ? data.airports.map(a => infraCard(a, 'airport')).join('')
    : '<div class="no-results">No airports found.</div>';

  // Ports
  els.portsCount.textContent = data.ports.length;
  els.portsList.innerHTML = data.ports.length
    ? data.ports.map(p => infraCard(p, 'port')).join('')
    : '<div class="no-results">No ports or harbours found.</div>';

  // Dams
  els.damsCount.textContent = data.dams.length;
  els.damsList.innerHTML = data.dams.length
    ? data.dams.map(d => infraCard(d, 'dam')).join('')
    : '<div class="no-results">No dams or reservoirs found.</div>';

  show(els.infrastructureSection);
  show(els.dataNotes);

  // Bind click handlers
  document.querySelectorAll('.result-item[data-id]').forEach(el => {
    el.addEventListener('click', () => {
      if (itemClickHandler) {
        const lat = parseFloat(el.dataset.lat);
        const lon = parseFloat(el.dataset.lon);
        const id = el.dataset.id;
        // highlight
        document.querySelectorAll('.result-item.active').forEach(a => a.classList.remove('active'));
        el.classList.add('active');
        itemClickHandler(id, lat, lon);
      }
    });
  });

  // Show partial errors if any
  if (data.errors && data.errors.length > 0) {
    showError('Some queries had issues: ' + data.errors.join('; '));
  }
}

/* ── Highlight sidebar item by id ── */
export function highlightItem(itemId) {
  document.querySelectorAll('.result-item.active').forEach(a => a.classList.remove('active'));
  const el = document.querySelector(`.result-item[data-id="${itemId}"]`);
  if (el) {
    el.classList.add('active');
    el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }
}

/* ── Clear all results ── */

export function clearAll() {
  hide(els.selectionInfo);
  hide(els.loading);
  hide(els.errorMsg);
  hide(els.summarySection);
  hide(els.settlementsSection);
  hide(els.infrastructureSection);
  hide(els.dataNotes);
  show(els.emptyState);
  els.settlementsList.innerHTML = '';
  els.airportsList.innerHTML = '';
  els.portsList.innerHTML = '';
  els.damsList.innerHTML = '';
  hide(els.searchResults);
}

/* ── Card builders ── */

function settlementCard(s) {
  const popStr = s.population != null ? `Pop: ${formatNumber(s.population)}` : 'Pop: unknown';
  const coords = `${s.lat.toFixed(4)}, ${s.lon.toFixed(4)}`;
  return `<div class="result-item" data-id="${s.id}" data-lat="${s.lat}" data-lon="${s.lon}">
    <div class="name">${escHtml(s.name)}</div>
    <div class="meta">${capitalise(s.placeType)} &middot; ${s.distanceKm} km &middot; ${popStr}</div>
    <div class="meta coords">${coords}</div>
  </div>`;
}

function infraCard(item, type) {
  let extra = '';
  if (type === 'airport') {
    const codes = [item.iata, item.icao].filter(Boolean).join(' / ');
    if (codes) extra = ` &middot; ${codes}`;
  }
  const coords = `${item.lat.toFixed(4)}, ${item.lon.toFixed(4)}`;
  return `<div class="result-item" data-id="${item.id}" data-lat="${item.lat}" data-lon="${item.lon}">
    <div class="name">${escHtml(item.name)}</div>
    <div class="meta">${item.subtype} &middot; ${item.distanceKm} km${extra}</div>
    <div class="meta coords">${coords}</div>
  </div>`;
}

/* ── Helpers ── */

function truncate(str, len) {
  return str.length > len ? str.slice(0, len) + '…' : str;
}

function escHtml(s) {
  const d = document.createElement('div');
  d.textContent = s;
  return d.innerHTML;
}
