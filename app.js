/**
 * POI Radius Explorer – main entry point.
 * Wires together map, UI, and API modules.
 */

import { searchPlace, analysePoint, generateSummary } from './js/api.js';
import { initMap, setSelection, clearSelection, resetView, addResultMarkers, panToResult, openPopupForId, setMarkerClickHandler } from './js/map.js';
import {
  cacheDom, bindEvents, showSearchResults, hideSearchResults,
  showSelectionInfo, showLoading, hideLoading, showError, hideError,
  renderResults, clearAll, setItemClickHandler, highlightItem,
} from './js/ui.js';

/* ── State ── */
let currentLat = null;
let currentLon = null;
let isQuerying = false;

/* ── Boot ── */
document.addEventListener('DOMContentLoaded', () => {
  cacheDom();

  initMap('map', handleMapClick);

  bindEvents({
    onSearch: handleSearch,
    onClear: handleClear,
    onSearchSelect: handleSearchSelect,
  });

  setItemClickHandler((id, lat, lon) => {
    panToResult(lat, lon);
    openPopupForId(id);
  });

  setMarkerClickHandler((itemId) => {
    highlightItem(itemId);
  });
});

/* ── Handlers ── */

async function handleMapClick(lat, lon) {
  if (isQuerying) return;
  await selectPoint(lat, lon);
}

async function handleSearch(query) {
  const q = query.trim();
  if (!q) return;
  hideError();
  try {
    const results = await searchPlace(q);
    showSearchResults(results);
  } catch (err) {
    showError('Search failed: ' + err.message);
  }
}

async function handleSearchSelect(result) {
  hideSearchResults();
  await selectPoint(result.lat, result.lon);
}

function handleClear() {
  currentLat = null;
  currentLon = null;
  resetView();
  clearAll();
}

/* ── Core workflow ── */

async function selectPoint(lat, lon) {
  // Avoid re-querying the same point
  if (currentLat != null && Math.abs(lat - currentLat) < 0.0001 && Math.abs(lon - currentLon) < 0.0001) return;

  currentLat = lat;
  currentLon = lon;
  isQuerying = true;

  // UI updates
  clearAll();
  showSelectionInfo(lat, lon);
  setSelection(lat, lon);
  showLoading();
  hideError();

  try {
    const data = await analysePoint(lat, lon);
    const summary = generateSummary(data);
    renderResults(data, summary);
    addResultMarkers(data);
  } catch (err) {
    hideLoading();
    showError('Analysis failed: ' + err.message);
  } finally {
    isQuerying = false;
  }
}
