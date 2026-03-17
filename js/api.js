/**
 * API layer: Nominatim geocoding + Overpass spatial queries.
 * Includes caching, error handling, and rate-conscious behaviour.
 */

import { settlementsQuery, airportsQuery, portsQuery, damsQuery } from './queries.js';
import {
  haversineKm, round, parsePopulation, deduplicateByNameAndProximity,
  scoreSettlement, normaliseName, capitalise,
} from './utils.js';

const NOMINATIM_URL = 'https://nominatim.openstreetmap.org/search';
const OVERPASS_URL = 'https://overpass-api.de/api/interpreter';

const DEFAULT_RADIUS_KM = 100;
const MAX_SETTLEMENTS = 50;

/* ── In-memory cache ── */
const cache = {
  nominatim: new Map(), // query string → results
  overpass: new Map(),   // "lat,lon" → { settlements, airports, ports, dams }
};

/* ─────────── Nominatim ─────────── */

export async function searchPlace(query) {
  const q = query.trim();
  if (!q) return [];
  if (cache.nominatim.has(q)) return cache.nominatim.get(q);

  const url = `${NOMINATIM_URL}?q=${encodeURIComponent(q)}&format=json&addressdetails=1&limit=6`;
  const res = await fetch(url, {
    headers: { 'Accept': 'application/json' },
  });
  if (!res.ok) throw new Error(`Nominatim error: ${res.status}`);
  const data = await res.json();
  const results = data.map(d => ({
    displayName: d.display_name,
    lat: parseFloat(d.lat),
    lon: parseFloat(d.lon),
    type: d.type,
    osmType: d.osm_type,
  }));
  cache.nominatim.set(q, results);
  return results;
}

/* ─────────── Overpass ─────────── */

const OVERPASS_ENDPOINTS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
];

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

/**
 * Run an Overpass query with retry + exponential backoff on 429/5xx.
 * Tries alternate endpoints on repeated failures.
 */
async function runOverpass(query) {
  const maxRetries = 4;
  const baseDelay = 1500; // ms

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    // Alternate endpoints on retries
    const url = OVERPASS_ENDPOINTS[attempt % OVERPASS_ENDPOINTS.length];
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: 'data=' + encodeURIComponent(query),
      });
      if (res.ok) return res.json();
      if (res.status === 429 || res.status >= 500) {
        // Rate limited or server error — wait and retry
        const delay = baseDelay * Math.pow(2, attempt);
        await sleep(delay);
        continue;
      }
      throw new Error(`Overpass error: ${res.status}`);
    } catch (err) {
      if (attempt === maxRetries - 1) throw err;
      // Network error — wait and retry
      await sleep(baseDelay * Math.pow(2, attempt));
    }
  }
  throw new Error('Overpass: all retries exhausted');
}

/**
 * Extract lat/lon from an Overpass element (handles node, way, relation with center).
 */
function elementLatLon(el) {
  if (el.type === 'node') return { lat: el.lat, lon: el.lon };
  if (el.center) return { lat: el.center.lat, lon: el.center.lon };
  return null;
}

/* ─────────── Settlements ─────────── */

function processSettlements(elements, originLat, originLon, radiusKm) {
  const items = [];
  for (const el of elements) {
    const pos = elementLatLon(el);
    if (!pos) continue;
    const tags = el.tags || {};
    const name = tags.name || tags['name:en'] || '';
    if (!name) continue;
    const placeType = tags.place || 'unknown';
    const population = parsePopulation(tags.population);
    const distanceKm = round(haversineKm(originLat, originLon, pos.lat, pos.lon), 1);
    if (distanceKm > radiusKm) continue;
    items.push({
      id: el.type + '/' + el.id,
      name,
      placeType,
      population,
      distanceKm,
      lat: pos.lat,
      lon: pos.lon,
      capital: tags.capital || null,
      adminLevel: tags.admin_level || null,
      tags,
    });
  }
  // deduplicate
  const deduped = deduplicateByNameAndProximity(items, 5);
  // score and sort
  deduped.forEach(s => { s.score = scoreSettlement(s); });
  deduped.sort((a, b) => b.score - a.score);
  return deduped.slice(0, MAX_SETTLEMENTS);
}

/* ─────────── Infrastructure helpers ─────────── */

function processAirports(elements, originLat, originLon, radiusKm) {
  const items = [];
  for (const el of elements) {
    const pos = elementLatLon(el);
    if (!pos) continue;
    const tags = el.tags || {};
    const name = tags.name || tags['name:en'] || tags.icao || tags.iata || 'Unnamed';
    const distanceKm = round(haversineKm(originLat, originLon, pos.lat, pos.lon), 1);
    if (distanceKm > radiusKm) continue;

    let subtype = 'Airport';
    if (tags.military === 'airfield' || tags.landuse === 'military') subtype = 'Military airfield';
    else if (tags.aeroway === 'heliport') subtype = 'Heliport';
    else if (tags.type === 'military' || (tags.name && /military|air base|hava üssü/i.test(tags.name))) subtype = 'Military airport';

    const iata = tags.iata || null;
    const icao = tags.icao || null;

    items.push({
      id: el.type + '/' + el.id,
      name, subtype, distanceKm,
      lat: pos.lat, lon: pos.lon,
      iata, icao, category: 'airport', tags,
    });
  }
  return deduplicateByNameAndProximity(items, 3).sort((a, b) => a.distanceKm - b.distanceKm);
}

function processPorts(elements, originLat, originLon, radiusKm) {
  const items = [];
  for (const el of elements) {
    const pos = elementLatLon(el);
    if (!pos) continue;
    const tags = el.tags || {};
    const name = tags.name || tags['name:en'] || 'Unnamed';
    const distanceKm = round(haversineKm(originLat, originLon, pos.lat, pos.lon), 1);
    if (distanceKm > radiusKm) continue;

    let subtype = 'Harbour';
    if (tags.amenity === 'ferry_terminal') subtype = 'Ferry terminal';
    else if (tags.landuse === 'port' || tags.industrial === 'port') subtype = 'Port';

    items.push({
      id: el.type + '/' + el.id,
      name, subtype, distanceKm,
      lat: pos.lat, lon: pos.lon,
      category: 'port', tags,
    });
  }
  return deduplicateByNameAndProximity(items, 2).sort((a, b) => a.distanceKm - b.distanceKm);
}

function processDams(elements, originLat, originLon, radiusKm) {
  const items = [];
  for (const el of elements) {
    const pos = elementLatLon(el);
    if (!pos) continue;
    const tags = el.tags || {};
    const name = tags.name || tags['name:en'] || 'Unnamed';
    const distanceKm = round(haversineKm(originLat, originLon, pos.lat, pos.lon), 1);
    if (distanceKm > radiusKm) continue;

    let subtype = 'Dam';
    if (tags.water === 'reservoir') subtype = 'Reservoir';
    else if (tags.man_made === 'reservoir_covered') subtype = 'Covered reservoir';

    items.push({
      id: el.type + '/' + el.id,
      name, subtype, distanceKm,
      lat: pos.lat, lon: pos.lon,
      category: 'dam', tags,
    });
  }
  return deduplicateByNameAndProximity(items, 2).sort((a, b) => a.distanceKm - b.distanceKm);
}

/* ─────────── Main analysis entry point ─────────── */

/**
 * Analyse the 100 km radius around (lat, lon).
 * Returns { settlements, airports, ports, dams, errors }.
 * Optional onProgress callback receives status strings.
 */
export async function analysePoint(lat, lon, onProgress, radiusKm = DEFAULT_RADIUS_KM) {
  const radiusM = radiusKm * 1000;
  const key = `${round(lat, 5)},${round(lon, 5)},${radiusKm}`;
  if (cache.overpass.has(key)) return cache.overpass.get(key);

  const errors = [];

  // Run queries sequentially with small delays to avoid Overpass 429 rate limits.
  // Each query has its own retry logic with exponential backoff.
  const QUERY_DELAY = 1200; // ms between sequential queries

  async function safeQuery(queryFn, processFn, label) {
    try {
      const raw = await runOverpass(queryFn(lat, lon, radiusM));
      return processFn(raw.elements || [], lat, lon, radiusKm);
    } catch (err) {
      errors.push(`${label} query failed: ${err.message}`);
      return [];
    }
  }

  const notify = onProgress || (() => {});

  notify('Querying settlements (1/4)…');
  const settlements = await safeQuery(settlementsQuery, processSettlements, 'Settlements');
  await sleep(QUERY_DELAY);

  notify('Querying airports (2/4)…');
  const airports = await safeQuery(airportsQuery, processAirports, 'Airports');
  await sleep(QUERY_DELAY);

  notify('Querying ports (3/4)…');
  const ports = await safeQuery(portsQuery, processPorts, 'Ports');
  await sleep(QUERY_DELAY);

  notify('Querying dams & reservoirs (4/4)…');
  const dams = await safeQuery(damsQuery, processDams, 'Dams');

  const result = { settlements, airports, ports, dams, errors };
  cache.overpass.set(key, result);
  return result;
}

/**
 * Generate a natural-language summary.
 */
export function generateSummary(data, radiusKm = DEFAULT_RADIUS_KM) {
  const { settlements, airports, ports, dams } = data;
  const parts = [];

  if (settlements.length > 0) {
    const top = settlements.slice(0, 3).map(s => s.name);
    const joined = top.length <= 2 ? top.join(' and ') : top.slice(0, -1).join(', ') + ', and ' + top[top.length - 1];
    parts.push(`the most significant nearby settlements are ${joined} (out of ${settlements.length} found)`);
  } else {
    parts.push('no notable settlements were found');
  }

  const infraParts = [];
  if (airports.length > 0) infraParts.push(`${airports.length} airport${airports.length > 1 ? 's' : ''}`);
  if (ports.length > 0) infraParts.push(`${ports.length} port${ports.length > 1 ? 's' : ''}/harbour${ports.length > 1 ? 's' : ''}`);
  if (dams.length > 0) infraParts.push(`${dams.length} dam${dams.length > 1 ? 's' : ''}/reservoir${dams.length > 1 ? 's' : ''}`);

  if (infraParts.length > 0) {
    parts.push('the area also contains ' + infraParts.join(', '));
  } else {
    parts.push('no major infrastructure features were found');
  }

  return `Within ${radiusKm} km of the selected point, ${parts.join('. ')}.`;
}
