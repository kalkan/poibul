/**
 * Map module: Leaflet map, markers, circle, and layer management.
 */

// Default: centre on Türkiye
const DEFAULT_CENTER = [39.0, 35.0];
const DEFAULT_ZOOM = 6;

let map = null;
let selectionMarker = null;
let radiusCircle = null;
let resultLayerGroup = null;

// Callback when user clicks the map
let onMapClick = null;
// Callback when a result marker is clicked
let onMarkerClick = null;

/* ── Marker icon factories ── */
function svgIcon(svgContent, cssClass, size = 26) {
  return L.divIcon({
    className: '',
    html: `<div class="${cssClass}" style="width:${size}px;height:${size}px;display:flex;align-items:center;justify-content:center">${svgContent}</div>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  });
}

const SVG_SETTLEMENT = '<svg width="12" height="12" viewBox="0 0 24 24" fill="white" stroke="white" stroke-width="1"><circle cx="12" cy="12" r="4"/></svg>';
const SVG_AIRPORT = '<svg width="14" height="14" viewBox="0 0 24 24" fill="white" stroke="white" stroke-width="2" stroke-linecap="round"><path d="M17.8 19.2L16 11l3.5-3.5C21 6 21.5 4 21 3c-1-.5-3 0-4.5 1.5L13 8 4.8 6.2c-.5-.1-.9.1-1.1.5l-.3.5c-.2.5-.1 1 .3 1.3L9 12l-2 3H4l-1 1 3 2 2 3 1-1v-3l3-2 3.5 5.3c.3.4.8.5 1.3.3l.5-.2c.4-.3.6-.7.5-1.2z"/></svg>';
const SVG_PORT = '<svg width="14" height="14" viewBox="0 0 24 24" fill="white" stroke="white" stroke-width="2" stroke-linecap="round"><path d="M2 20a7 7 0 0 0 10 0 7 7 0 0 0 10 0"/><path d="M12 4v12"/><path d="M12 4a4 4 0 0 1 4 4H8a4 4 0 0 1 4-4z"/></svg>';
const SVG_DAM = '<svg width="13" height="13" viewBox="0 0 24 24" fill="white" stroke="white" stroke-width="2" stroke-linecap="round"><path d="M12 2.7l.6.6c3 3 6.4 4.8 6.4 9.7a7 7 0 0 1-14 0c0-4.9 3.4-6.7 6.4-9.7z"/></svg>';

const ICONS = {
  settlement: svgIcon(SVG_SETTLEMENT, 'marker-settlement'),
  airport: svgIcon(SVG_AIRPORT, 'marker-airport', 28),
  port: svgIcon(SVG_PORT, 'marker-port', 28),
  dam: svgIcon(SVG_DAM, 'marker-dam', 28),
};

/* ── Init ── */

export function initMap(containerId, clickHandler) {
  map = L.map(containerId, { zoomControl: true }).setView(DEFAULT_CENTER, DEFAULT_ZOOM);

  // Base layers
  const osmLayer = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    maxZoom: 19,
  });

  const satelliteLayer = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
    attribution: '&copy; <a href="https://www.esri.com/">Esri</a>, Maxar, Earthstar Geographics',
    maxZoom: 19,
  });

  // Default layer
  osmLayer.addTo(map);

  // Layer control
  const baseLayers = {
    'OpenStreetMap': osmLayer,
    'Satellite': satelliteLayer,
  };
  L.control.layers(baseLayers, null, { position: 'topright' }).addTo(map);

  resultLayerGroup = L.layerGroup().addTo(map);
  onMapClick = clickHandler;

  map.on('click', (e) => {
    if (onMapClick) onMapClick(e.latlng.lat, e.latlng.lng);
  });

  // Add legend
  addLegend();

  return map;
}

/* ── Legend ── */
function addLegend() {
  const legend = L.control({ position: 'bottomright' });
  legend.onAdd = () => {
    const div = L.DomUtil.create('div', 'map-legend');
    div.innerHTML = `
      <div class="legend-title">Legend</div>
      <div class="legend-item"><span class="legend-dot" style="background:#2563eb"></span> Settlement</div>
      <div class="legend-item"><span class="legend-dot" style="background:#ea580c"></span> Airport</div>
      <div class="legend-item"><span class="legend-dot" style="background:#0d9488"></span> Port</div>
      <div class="legend-item"><span class="legend-dot" style="background:#7c3aed"></span> Dam / Reservoir</div>
    `;
    return div;
  };
  legend.addTo(map);
}

/* ── Selection marker + circle ── */

export function setSelection(lat, lon, radiusKm = 100) {
  clearSelection();

  selectionMarker = L.marker([lat, lon]).addTo(map)
    .bindPopup(`<strong>Selected point</strong><br>${lat.toFixed(4)}, ${lon.toFixed(4)}`);

  radiusCircle = L.circle([lat, lon], {
    radius: radiusKm * 1000,
    color: '#2563eb',
    fillColor: '#2563eb',
    fillOpacity: 0.06,
    weight: 2,
    dashArray: '6 4',
  }).addTo(map);

  map.fitBounds(radiusCircle.getBounds(), { padding: [30, 30] });
}

export function clearSelection() {
  if (selectionMarker) { map.removeLayer(selectionMarker); selectionMarker = null; }
  if (radiusCircle) { map.removeLayer(radiusCircle); radiusCircle = null; }
  clearResults();
}

export function clearResults() {
  if (resultLayerGroup) resultLayerGroup.clearLayers();
}

/* ── Result markers ── */

export function setMarkerClickHandler(handler) {
  onMarkerClick = handler;
}

export function addResultMarkers(data) {
  clearResults();

  // settlements – show top 20 on map to avoid clutter
  const topSettlements = data.settlements.slice(0, 20);
  for (const s of topSettlements) {
    const m = L.marker([s.lat, s.lon], { icon: ICONS.settlement })
      .bindPopup(popupContent(s.name, s.placeType, s.distanceKm, s.population, null, s.lat, s.lon));
    m.itemId = s.id;
    m.on('click', () => { if (onMarkerClick) onMarkerClick(s.id); });
    resultLayerGroup.addLayer(m);
  }

  for (const a of data.airports) {
    const codes = [a.iata, a.icao].filter(Boolean).join(' / ');
    const m = L.marker([a.lat, a.lon], { icon: ICONS.airport })
      .bindPopup(popupContent(a.name, a.subtype, a.distanceKm, null, codes, a.lat, a.lon));
    m.itemId = a.id;
    m.on('click', () => { if (onMarkerClick) onMarkerClick(a.id); });
    resultLayerGroup.addLayer(m);
  }

  for (const p of data.ports) {
    const m = L.marker([p.lat, p.lon], { icon: ICONS.port })
      .bindPopup(popupContent(p.name, p.subtype, p.distanceKm, null, null, p.lat, p.lon));
    m.itemId = p.id;
    m.on('click', () => { if (onMarkerClick) onMarkerClick(p.id); });
    resultLayerGroup.addLayer(m);
  }

  for (const d of data.dams) {
    const m = L.marker([d.lat, d.lon], { icon: ICONS.dam })
      .bindPopup(popupContent(d.name, d.subtype, d.distanceKm, null, null, d.lat, d.lon));
    m.itemId = d.id;
    m.on('click', () => { if (onMarkerClick) onMarkerClick(d.id); });
    resultLayerGroup.addLayer(m);
  }
}

function popupContent(name, type, distKm, population, extra, lat, lon) {
  let html = `<strong>${name}</strong><br><em>${type}</em><br>${distKm} km away`;
  if (population) html += `<br>Pop: ${population.toLocaleString()}`;
  if (extra) html += `<br>${extra}`;
  if (lat != null && lon != null) html += `<br><span style="font-size:0.8em;color:#64748b;">${lat.toFixed(4)}, ${lon.toFixed(4)}</span>`;
  return html;
}

/* ── Pan to a specific result ── */

export function panToResult(lat, lon) {
  map.flyTo([lat, lon], 11, { duration: 0.8 });
}

/**
 * Open popup on a specific result marker by item id.
 */
export function openPopupForId(itemId) {
  if (!resultLayerGroup) return;
  resultLayerGroup.eachLayer(layer => {
    if (layer.itemId === itemId) {
      layer.openPopup();
    }
  });
}

/* ── Reset map to default ── */
export function resetView() {
  clearSelection();
  map.setView(DEFAULT_CENTER, DEFAULT_ZOOM);
}
