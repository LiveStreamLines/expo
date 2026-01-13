# Google Maps Migration Guide

## Steps to Complete Migration

1. **Get a Google Maps API Key:**
   - Go to https://console.cloud.google.com/
   - Create a new project or select existing one
   - Enable "Maps JavaScript API"
   - Create credentials (API Key)
   - Replace `YOUR_API_KEY` in `index.html` with your actual API key

2. **Install TypeScript types (optional but recommended):**
   ```bash
   npm install --save-dev @types/google.maps
   ```

3. **Update the component:**
   The component has been partially updated. You need to:
   - Replace all Leaflet map initialization with Google Maps
   - Convert markers to Google Maps markers
   - Update map theme switching to use Google Maps map types

## Key Differences:

- Leaflet uses `L.map()` → Google Maps uses `new google.maps.Map()`
- Leaflet markers use `L.marker()` → Google Maps uses `new google.maps.Marker()`
- Leaflet uses tile layers → Google Maps uses map types (roadmap, satellite, hybrid, terrain)
- Leaflet bounds use `fitBounds()` → Google Maps uses `fitBounds()` with LatLngBounds

## Current Status:
- ✅ Google Maps script added to index.html
- ✅ Type declarations updated
- ⚠️ Map initialization methods need conversion
- ⚠️ Marker creation methods need conversion
- ⚠️ Map theme switching needs conversion
