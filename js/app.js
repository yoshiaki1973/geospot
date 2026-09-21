/**
 * GeoSpot Studio - Application Main Entry Point
 * Bootstraps Map, Data Store, and UI components
 */

document.addEventListener('DOMContentLoaded', () => {
  console.log('GeoSpot Studio Initializing...');

  // 1. Initialize Map
  mapManager.init('map');

  // 2. Initialize UI Manager
  appUI.init();

  // 3. Render initial spots on map & fit view if spots exist
  const spots = store.getAllSpots();
  if (spots.length > 0) {
    mapManager.fitAllSpots(spots);
  }

  console.log('GeoSpot Studio Ready!');
});
