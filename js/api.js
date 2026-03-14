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

const RADIUS_KM = 100;
const RADIUS_M = RADIUS_KM * 1000;
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

async function runOverpass(query) {
  const res = await fetch(OVERPASS_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: 'data=' + encodeURIComponent(query),
  });
  if (!res.ok) throw new Error(`Overpass error: ${res.status}`);
  return res.json();
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

function processSettlements(elements, originLat, originLon) {
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
    if (distanceKm > RADIUS_KM) continue;
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

function processAirports(elements, originLat, originLon) {
  const items = [];
  for (const el of elements) {
    const pos = elementLatLon(el);
    if (!pos) continue;
    const tags = el.tags || {};
    const name = tags.name || tags['name:en'] || tags.icao || tags.iata || 'Unnamed';
    const distanceKm = round(haversineKm(originLat, originLon, pos.lat, pos.lon), 1);
    if (distanceKm > RADIUS_KM) continue;

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

function processPorts(elements, originLat, originLon) {
  const items = [];
  for (const el of elements) {
    const pos = elementLatLon(el);
    if (!pos) continue;
    const tags = el.tags || {};
    const name = tags.name || tags['name:en'] || 'Unnamed';
    const distanceKm = round(haversineKm(originLat, originLon, pos.lat, pos.lon), 1);
    if (distanceKm > RADIUS_KM) continue;

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

function processDams(elements, originLat, originLon) {
  const items = [];
  for (const el of elements) {
    const pos = elementLatLon(el);
    if (!pos) continue;
    const tags = el.tags || {};
    const name = tags.name || tags['name:en'] || 'Unnamed';
    const distanceKm = round(haversineKm(originLat, originLon, pos.lat, pos.lon), 1);
    if (distanceKm > RADIUS_KM) continue;

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
 */
export async function analysePoint(lat, lon) {
  const key = `${round(lat, 5)},${round(lon, 5)}`;
  if (cache.overpass.has(key)) return cache.overpass.get(key);

  const errors = [];

  // Run all queries in parallel; partial results on failure
  const [settlementsRes, airportsRes, portsRes, damsRes] = await Promise.allSettled([
    runOverpass(settlementsQuery(lat, lon, RADIUS_M)),
    runOverpass(airportsQuery(lat, lon, RADIUS_M)),
    runOverpass(portsQuery(lat, lon, RADIUS_M)),
    runOverpass(damsQuery(lat, lon, RADIUS_M)),
  ]);

  const settlements = settlementsRes.status === 'fulfilled'
    ? processSettlements(settlementsRes.value.elements || [], lat, lon)
    : (errors.push('Settlements query failed: ' + settlementsRes.reason?.message), []);

  const airports = airportsRes.status === 'fulfilled'
    ? processAirports(airportsRes.value.elements || [], lat, lon)
    : (errors.push('Airports query failed: ' + airportsRes.reason?.message), []);

  const ports = portsRes.status === 'fulfilled'
    ? processPorts(portsRes.value.elements || [], lat, lon)
    : (errors.push('Ports query failed: ' + portsRes.reason?.message), []);

  const dams = damsRes.status === 'fulfilled'
    ? processDams(damsRes.value.elements || [], lat, lon)
    : (errors.push('Dams query failed: ' + damsRes.reason?.message), []);

  const result = { settlements, airports, ports, dams, errors };
  cache.overpass.set(key, result);
  return result;
}

/**
 * Generate a natural-language summary.
 */
export function generateSummary(data) {
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

  return `Within 100 km of the selected point, ${parts.join('. ')}.`;
}
