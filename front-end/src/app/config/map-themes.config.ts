// Map Theme Configuration
// Supports both Leaflet (url-based) and Google Maps (mapTypeId-based)

export interface MapTheme {
  name: string;
  // For Leaflet (project-detail component)
  url?: string;
  attribution?: string;
  maxZoom?: number;
  // For Google Maps (projects component)
  mapTypeId?: string; // Will be converted to google.maps.MapTypeId when used
}

export const MAP_THEMES: { [key: string]: MapTheme } = {
  // Roadmap (default Google Maps style)
  osm: {
    name: 'Roadmap',
    url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    attribution: '© OpenStreetMap contributors',
    maxZoom: 19,
    mapTypeId: 'roadmap'
  },
  
  // Light theme - Roadmap
  light: {
    name: 'Light',
    url: 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png',
    attribution: '© OpenStreetMap contributors © CARTO',
    maxZoom: 19,
    mapTypeId: 'roadmap'
  },
  
  // Dark theme - Not directly supported, use roadmap with custom styling
  dark: {
    name: 'Dark',
    url: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
    attribution: '© OpenStreetMap contributors © CARTO',
    maxZoom: 19,
    mapTypeId: 'roadmap'
  },
  
  // Satellite/Imagery
  satellite: {
    name: 'Satellite',
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    attribution: '© Esri',
    maxZoom: 19,
    mapTypeId: 'satellite'
  }
};

// Default theme
export const DEFAULT_MAP_THEME = 'satellite';

