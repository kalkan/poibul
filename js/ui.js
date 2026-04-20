/**
 * UI module: sidebar rendering, event binding, state management,
 * dark mode, collapsible sections, filtering, and export.
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
  els.statCards = $('stat-cards');
  els.statSettlements = $('stat-settlements');
  els.statAirports = $('stat-airports');
  els.statPorts = $('stat-ports');
  els.statDams = $('stat-dams');
  els.summarySection = $('summary-section');
  els.summaryText = $('summary-text');
  els.settlementsSection = $('settlements-section');
  els.settlementsCount = $('settlements-count');
  els.settlementsList = $('settlements-list');
  els.settlementFilter = $('settlement-filter');
  els.infrastructureSection = $('infrastructure-section');
  els.airportsCount = $('airports-count');
  els.airportsList = $('airports-list');
  els.portsCount = $('ports-count');
  els.portsList = $('ports-list');
  els.damsCount = $('dams-count');
  els.damsList = $('dams-list');
  els.exportSection = $('export-section');
  els.exportCsv = $('export-csv');
  els.exportJson = $('export-json');
  els.dataNotes = $('data-notes');
  els.emptyState = $('empty-state');
  els.radiusInput = $('radius-input');
  els.darkToggle = $('dark-toggle');
  els.iconSun = $('icon-sun');
  els.iconMoon = $('icon-moon');
  els.sidebarToggle = $('sidebar-toggle');
  els.sidebarClose = $('sidebar-close');
  els.sidebar = $('sidebar');
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

/* ── Dark mode ── */

function initDarkMode() {
  const saved = localStorage.getItem('poi-theme');
  if (saved === 'dark' || (!saved && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
    document.documentElement.setAttribute('data-theme', 'dark');
    els.iconSun.classList.add('hidden');
    els.iconMoon.classList.remove('hidden');
  }
  els.darkToggle.addEventListener('click', () => {
    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    if (isDark) {
      document.documentElement.removeAttribute('data-theme');
      localStorage.setItem('poi-theme', 'light');
      els.iconSun.classList.remove('hidden');
      els.iconMoon.classList.add('hidden');
    } else {
      document.documentElement.setAttribute('data-theme', 'dark');
      localStorage.setItem('poi-theme', 'dark');
      els.iconSun.classList.add('hidden');
      els.iconMoon.classList.remove('hidden');
    }
  });
}

/* ── Mobile sidebar ── */

function initMobileSidebar() {
  els.sidebarToggle.addEventListener('click', () => {
    els.sidebar.classList.add('open');
  });
  els.sidebarClose.addEventListener('click', () => {
    els.sidebar.classList.remove('open');
  });
}

/* ── Collapsible sections ── */

function initCollapsibles() {
  document.querySelectorAll('.section-header[data-toggle]').forEach(header => {
    header.addEventListener('click', () => {
      const section = header.closest('.collapsible');
      section.classList.toggle('collapsed');
    });
  });
}

/* ── Settlement filter ── */

let allSettlements = [];

function initSettlementFilter() {
  els.settlementFilter.addEventListener('input', () => {
    const q = els.settlementFilter.value.trim().toLowerCase();
    const filtered = q
      ? allSettlements.filter(s => s.name.toLowerCase().includes(q))
      : allSettlements;
    els.settlementsList.innerHTML = filtered.length
      ? filtered.map(s => settlementCard(s)).join('')
      : '<div class="no-results">No matches.</div>';
    bindResultClicks();
  });
}

/* ── Export ── */

let currentData = null;

function initExport() {
  els.exportCsv.addEventListener('click', () => exportCSV());
  els.exportJson.addEventListener('click', () => exportJSON());
}

function exportCSV() {
  if (!currentData) return;
  const rows = [['Category', 'Name', 'Type', 'Distance_km', 'Population', 'Lat', 'Lon']];
  for (const s of currentData.settlements) {
    rows.push(['Settlement', s.name, s.placeType, s.distanceKm, s.population ?? '', s.lat, s.lon]);
  }
  for (const a of currentData.airports) {
    rows.push(['Airport', a.name, a.subtype, a.distanceKm, '', a.lat, a.lon]);
  }
  for (const p of currentData.ports) {
    rows.push(['Port', p.name, p.subtype, p.distanceKm, '', p.lat, p.lon]);
  }
  for (const d of currentData.dams) {
    rows.push(['Dam', d.name, d.subtype, d.distanceKm, '', d.lat, d.lon]);
  }
  const csv = rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
  downloadFile(csv, 'poi-results.csv', 'text/csv');
}

function exportJSON() {
  if (!currentData) return;
  const { settlements, airports, ports, dams } = currentData;
  const json = JSON.stringify({ settlements, airports, ports, dams }, null, 2);
  downloadFile(json, 'poi-results.json', 'application/json');
}

function downloadFile(content, filename, mimeType) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

/* ── Event binding ── */

export function bindEvents({ onSearch, onClear, onSearchSelect }) {
  els.searchBtn.addEventListener('click', () => onSearch(els.searchInput.value));
  els.searchInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') onSearch(els.searchInput.value);
  });
  els.clearBtn.addEventListener('click', onClear);
  els._onSearchSelect = onSearchSelect;

  initDarkMode();
  initMobileSidebar();
  initCollapsibles();
  initSettlementFilter();
  initExport();
}

/* ── Search results dropdown ── */

export function showSearchResults(results) {
  if (!results.length) {
    els.searchResults.innerHTML = '<div class="search-result-item" style="cursor:default;color:var(--text-muted);">No results found</div>';
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

export function hideSearchResults() { hide(els.searchResults); }

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
  if (span) span.textContent = msg || 'Querying nearby features...';
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

export function setItemClickHandler(handler) { itemClickHandler = handler; }

export function renderResults(data, summary) {
  hideLoading();
  currentData = data;

  // Stat cards
  els.statSettlements.textContent = data.settlements.length;
  els.statAirports.textContent = data.airports.length;
  els.statPorts.textContent = data.ports.length;
  els.statDams.textContent = data.dams.length;
  show(els.statCards);

  // Summary
  els.summaryText.textContent = summary;
  show(els.summarySection);

  // Settlements
  allSettlements = data.settlements;
  els.settlementFilter.value = '';
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
  show(els.exportSection);
  show(els.dataNotes);

  bindResultClicks();

  if (data.errors && data.errors.length > 0) {
    showError('Some queries had issues: ' + data.errors.join('; '));
  }
}

function bindResultClicks() {
  document.querySelectorAll('.result-item[data-id]').forEach(el => {
    el.addEventListener('click', () => {
      if (itemClickHandler) {
        const lat = parseFloat(el.dataset.lat);
        const lon = parseFloat(el.dataset.lon);
        const id = el.dataset.id;
        document.querySelectorAll('.result-item.active').forEach(a => a.classList.remove('active'));
        el.classList.add('active');
        itemClickHandler(id, lat, lon);
      }
    });
  });
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
  hide(els.statCards);
  hide(els.summarySection);
  hide(els.settlementsSection);
  hide(els.infrastructureSection);
  hide(els.exportSection);
  hide(els.dataNotes);
  show(els.emptyState);
  els.settlementsList.innerHTML = '';
  els.airportsList.innerHTML = '';
  els.portsList.innerHTML = '';
  els.damsList.innerHTML = '';
  hide(els.searchResults);
  allSettlements = [];
  currentData = null;
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
  return str.length > len ? str.slice(0, len) + '...' : str;
}

function escHtml(s) {
  const d = document.createElement('div');
  d.textContent = s;
  return d.innerHTML;
}
