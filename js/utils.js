/**
 * Utility functions for distance, deduplication, scoring, and parsing.
 */

const DEG_TO_RAD = Math.PI / 180;
const EARTH_RADIUS_KM = 6371;

/**
 * Haversine distance between two lat/lon points in kilometres.
 */
export function haversineKm(lat1, lon1, lat2, lon2) {
  const dLat = (lat2 - lat1) * DEG_TO_RAD;
  const dLon = (lon2 - lon1) * DEG_TO_RAD;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * DEG_TO_RAD) * Math.cos(lat2 * DEG_TO_RAD) * Math.sin(dLon / 2) ** 2;
  return EARTH_RADIUS_KM * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/**
 * Round to n decimal places.
 */
export function round(val, decimals = 1) {
  const f = 10 ** decimals;
  return Math.round(val * f) / f;
}

/**
 * Parse a population string to integer, handling commas, spaces, etc.
 * Returns null if not parseable.
 */
export function parsePopulation(raw) {
  if (raw == null) return null;
  const cleaned = String(raw).replace(/[\s,.']/g, '');
  const n = parseInt(cleaned, 10);
  return Number.isFinite(n) && n > 0 ? n : null;
}

/**
 * Normalise a name for deduplication (lowercase, trim, collapse whitespace).
 */
export function normaliseName(name) {
  if (!name) return '';
  return name.trim().toLowerCase().replace(/\s+/g, ' ');
}

/**
 * Deduplicate an array of features by normalised name + proximity.
 * Keeps the entry with the richest metadata (population tag, more tags, etc.).
 */
export function deduplicateByNameAndProximity(items, proximityKm = 5) {
  const kept = [];
  for (const item of items) {
    const norm = normaliseName(item.name);
    if (!norm) { kept.push(item); continue; }
    const dup = kept.find(
      k => normaliseName(k.name) === norm && haversineKm(k.lat, k.lon, item.lat, item.lon) < proximityKm
    );
    if (dup) {
      // keep the one with richer data
      if ((item.population ?? 0) > (dup.population ?? 0) || Object.keys(item.tags || {}).length > Object.keys(dup.tags || {}).length) {
        const idx = kept.indexOf(dup);
        kept[idx] = item;
      }
    } else {
      kept.push(item);
    }
  }
  return kept;
}

/**
 * Place type weights for scoring.
 */
const PLACE_WEIGHTS = {
  city: 500,
  town: 300,
  village: 150,
  suburb: 100,
  municipality: 400,
  hamlet: 50,
  quarter: 80,
  neighbourhood: 60,
  borough: 350,
};

/**
 * Score a settlement for ranking.
 * Population dominates if available; otherwise heuristic by type + distance.
 */
export function scoreSettlement(item) {
  const baseWeight = PLACE_WEIGHTS[item.placeType] || 50;
  const pop = item.population;
  const dist = item.distanceKm ?? 100;

  if (pop != null && pop > 0) {
    // population-based: large population → high score, add base weight as tiebreaker
    return pop + baseWeight - dist * 0.5;
  }
  // heuristic: type weight minus distance penalty
  return baseWeight - dist * 0.8;
}

/**
 * Format a number with thousand separators.
 */
export function formatNumber(n) {
  if (n == null) return '—';
  return n.toLocaleString('en-US');
}

/**
 * Capitalise first letter.
 */
export function capitalise(s) {
  if (!s) return '';
  return s.charAt(0).toUpperCase() + s.slice(1);
}
