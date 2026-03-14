/**
 * Overpass query builders.
 * Each function returns a query string for the Overpass API.
 */

const OVERPASS_TIMEOUT = 30; // seconds

/**
 * Build an Overpass "around" query for settlements.
 */
export function settlementsQuery(lat, lon, radiusM = 100000) {
  return `
[out:json][timeout:${OVERPASS_TIMEOUT}];
(
  node["place"~"city|town|village|suburb|hamlet|municipality|quarter|borough"](around:${radiusM},${lat},${lon});
  way["place"~"city|town|village|suburb|municipality|borough"](around:${radiusM},${lat},${lon});
  relation["place"~"city|town|village|suburb|municipality|borough"](around:${radiusM},${lat},${lon});
);
out center tags;
`;
}

/**
 * Build an Overpass query for airports / airfields / military air facilities.
 */
export function airportsQuery(lat, lon, radiusM = 100000) {
  return `
[out:json][timeout:${OVERPASS_TIMEOUT}];
(
  node["aeroway"="aerodrome"](around:${radiusM},${lat},${lon});
  way["aeroway"="aerodrome"](around:${radiusM},${lat},${lon});
  relation["aeroway"="aerodrome"](around:${radiusM},${lat},${lon});
  node["aeroway"="heliport"](around:${radiusM},${lat},${lon});
  way["aeroway"="heliport"](around:${radiusM},${lat},${lon});
  node["military"="airfield"](around:${radiusM},${lat},${lon});
  way["military"="airfield"](around:${radiusM},${lat},${lon});
  relation["military"="airfield"](around:${radiusM},${lat},${lon});
);
out center tags;
`;
}

/**
 * Build an Overpass query for ports / harbours.
 */
export function portsQuery(lat, lon, radiusM = 100000) {
  return `
[out:json][timeout:${OVERPASS_TIMEOUT}];
(
  node["harbour"="yes"](around:${radiusM},${lat},${lon});
  way["harbour"="yes"](around:${radiusM},${lat},${lon});
  relation["harbour"="yes"](around:${radiusM},${lat},${lon});
  node["landuse"="port"](around:${radiusM},${lat},${lon});
  way["landuse"="port"](around:${radiusM},${lat},${lon});
  relation["landuse"="port"](around:${radiusM},${lat},${lon});
  node["industrial"="port"](around:${radiusM},${lat},${lon});
  way["industrial"="port"](around:${radiusM},${lat},${lon});
  node["amenity"="ferry_terminal"](around:${radiusM},${lat},${lon});
  way["amenity"="ferry_terminal"](around:${radiusM},${lat},${lon});
);
out center tags;
`;
}

/**
 * Build an Overpass query for dams / reservoirs.
 */
export function damsQuery(lat, lon, radiusM = 100000) {
  return `
[out:json][timeout:${OVERPASS_TIMEOUT}];
(
  node["waterway"="dam"](around:${radiusM},${lat},${lon});
  way["waterway"="dam"](around:${radiusM},${lat},${lon});
  relation["waterway"="dam"](around:${radiusM},${lat},${lon});
  way["water"="reservoir"](around:${radiusM},${lat},${lon});
  relation["water"="reservoir"](around:${radiusM},${lat},${lon});
  node["man_made"="reservoir_covered"](around:${radiusM},${lat},${lon});
  way["man_made"="reservoir_covered"](around:${radiusM},${lat},${lon});
);
out center tags;
`;
}
