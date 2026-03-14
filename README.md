# POI Radius Explorer

An interactive static web application that lets you click any point on an OpenStreetMap-based map (or search by place name) and instantly discover the most important cities, towns, airports, ports, and dams within a 100 km radius.

## Features

- **Click-to-explore**: Click anywhere on the map to analyse the surrounding 100 km area.
- **Place search**: Search for a location by name using Nominatim geocoding.
- **Nearby settlements**: Ranked list of up to 50 cities, towns, and villages — sorted by population when available, otherwise by place-type heuristic and distance.
- **Nearby infrastructure**: Categorised results for airports (civil, military, heliports), ports/harbours, and dams/reservoirs.
- **Natural-language summary**: A concise overview of findings at the top of the results panel.
- **Interactive map**: Markers for all results, colour-coded by category. Click a sidebar item to fly to it on the map; click a map marker to highlight it in the sidebar.
- **100 km radius circle**: Visual overlay showing the analysis boundary.
- **Fully static**: No backend, no database, no API keys — runs entirely in the browser.

## Technologies

| Purpose | Technology |
|---|---|
| Map | [Leaflet](https://leafletjs.com/) + OpenStreetMap tiles |
| Geocoding | [Nominatim](https://nominatim.openstreetmap.org/) |
| Spatial data | [Overpass API](https://overpass-api.de/) |
| Distance math | Haversine formula (custom implementation) |
| UI | Vanilla HTML / CSS / ES modules |

## Running locally

1. Clone this repository:
   ```bash
   git clone https://github.com/<your-username>/poibul.git
   cd poibul
   ```
2. Serve the files with any static server:
   ```bash
   # Python
   python3 -m http.server 8000

   # Node (npx)
   npx serve .

   # Or simply open index.html in your browser
   # (some browsers may block ES module imports from file:// — use a server if so)
   ```
3. Open `http://localhost:8000` in your browser.

## Deploying on GitHub Pages

1. Create a new repository on GitHub (e.g. `poibul`).
2. Push the project files:
   ```bash
   git init
   git add .
   git commit -m "Initial commit"
   git branch -M main
   git remote add origin https://github.com/<your-username>/poibul.git
   git push -u origin main
   ```
3. Go to **Settings → Pages** in your repository.
4. Under **Source**, select **Deploy from a branch**.
5. Choose the **main** branch and **/ (root)** folder.
6. Click **Save**. Your site will be live at `https://<your-username>.github.io/poibul/` within a minute or two.

No build step is required — the project is pure static HTML/CSS/JS.

## Project structure

```
poibul/
├── index.html          # Main HTML page
├── style.css           # All styling
├── app.js              # Entry point, wires modules together
├── js/
│   ├── api.js          # Nominatim + Overpass API layer, caching, processing
│   ├── map.js          # Leaflet map, markers, circle, legend
│   ├── queries.js      # Overpass query builders
│   ├── ui.js           # Sidebar rendering and event handling
│   └── utils.js        # Haversine, scoring, deduplication, parsing
├── assets/
│   └── icons/          # (reserved for custom icons)
└── README.md
```

## Known limitations

- **Population data**: OpenStreetMap population tags are incomplete in many regions. When population is unavailable, the app falls back to a heuristic ranking based on place type (city > town > village) and distance.
- **Military airports**: Coverage depends entirely on how OSM contributors have tagged military facilities. Many military air bases are not publicly mapped or are tagged inconsistently.
- **Dams and reservoirs**: Mapping conventions for water infrastructure vary significantly across countries. Some dams appear as nodes, others as ways or relations, and naming may be inconsistent.
- **Ports**: Smaller harbours and fishing ports may not be present in OSM, or may be tagged differently in different regions.
- **Overpass API rate limits**: The Overpass API is a shared public resource. Heavy use may result in temporary throttling (HTTP 429). The app caches results per selected point to minimise repeated requests.
- **Nominatim usage policy**: Nominatim requests are subject to the [Nominatim usage policy](https://operations.osmfoundation.org/policies/nominatim/). The app triggers searches only on explicit user action (button click / Enter key), not on every keystroke.

## License

This project uses publicly available OpenStreetMap data and APIs. Map data is © OpenStreetMap contributors, licensed under the [Open Data Commons Open Database License (ODbL)](https://opendatacommons.org/licenses/odbl/).
