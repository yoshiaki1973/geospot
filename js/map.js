/**
 * GeoSpot Studio - Map Management Module
 * Leaflet map setup, custom markers, basemaps, clustering, heatmap, click events
 */

class MapManager {
  constructor() {
    this.map = null;
    this.tileLayers = {};
    this.currentTileLayer = null;
    this.markersGroup = null;
    this.heatmapLayer = null;
    this.isHeatmapActive = false;
    this.pickerMarker = null;

    // Default Tokyo center
    this.defaultCenter = [35.6812, 139.7671];
    this.defaultZoom = 12;

    this.onSpotClick = null; // Callback when a spot marker is clicked
    this.onMapClick = null;  // Callback when map canvas is clicked
  }

  init(containerId) {
    // Initialize Leaflet Map
    this.map = L.map(containerId, {
      center: this.defaultCenter,
      zoom: this.defaultZoom,
      zoomControl: false // Move zoom control or rely on custom floating UI
    });

    // Add Zoom Control to bottom-right
    L.control.zoom({ position: 'bottomright' }).addTo(this.map);

    // Define Tile Layers (100% Free, No API Key Required)
    this.tileLayers = {
      dark: L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Base/MapServer/tile/{z}/{y}/{x}', {
        maxZoom: 16,
        attribution: 'Tiles &copy; Esri &mdash; Esri, DeLorme, NAVTEQ'
      }),
      light: L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Base/MapServer/tile/{z}/{y}/{x}', {
        maxZoom: 16,
        attribution: 'Tiles &copy; Esri &mdash; Esri, DeLorme, NAVTEQ'
      }),
      osm: L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
      }),
      satellite: L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
        maxZoom: 18,
        attribution: '&copy; Esri, DigitalGlobe, GeoEye, Earthstar Geographics'
      })
    };

    // Set default basemap (OpenStreetMap / Esri Dark)
    this.currentTileLayer = this.tileLayers.osm;
    this.currentTileLayer.addTo(this.map);

    // Initialize MarkerCluster Group
    this.markersGroup = L.markerClusterGroup({
      showCoverageOnHover: false,
      maxClusterRadius: 40,
      iconCreateFunction: (cluster) => {
        const count = cluster.getChildCount();
        return L.divIcon({
          html: `<div class="cluster-badge">${count}</div>`,
          className: 'custom-cluster-icon',
          iconSize: L.point(40, 40)
        });
      }
    });
    this.map.addLayer(this.markersGroup);

    // Bind Map Events
    this.map.on('click', (e) => {
      if (this.onMapClick) {
        this.onMapClick(e.latlng.lat, e.latlng.lng);
      }
    });

    // Invalidate size on window resize
    window.addEventListener('resize', () => {
      this.map.invalidateSize();
    });
  }

  switchTileLayer(layerKey) {
    if (this.tileLayers[layerKey]) {
      this.map.removeLayer(this.currentTileLayer);
      this.currentTileLayer = this.tileLayers[layerKey];
      this.currentTileLayer.addTo(this.map);
    }
  }

  getCategoryIcon(category) {
    switch (category) {
      case 'gourmet': return 'fa-utensils';
      case 'sightseeing': return 'fa-camera-retro';
      case 'business': return 'fa-briefcase';
      case 'infrastructure': return 'fa-wrench';
      case 'personal': return 'fa-heart';
      default: return 'fa-location-dot';
    }
  }

  renderSpots(spots) {
    this.markersGroup.clearLayers();

    spots.forEach(spot => {
      const lat = parseFloat(spot.lat);
      const lng = parseFloat(spot.lng);
      if (isNaN(lat) || isNaN(lng)) return;

      const iconClass = this.getCategoryIcon(spot.category);
      const categoryClass = `pin-${spot.category || 'other'}`;

      // Create Custom HTML Div Icon
      const customIcon = L.divIcon({
        className: 'custom-pin-wrapper',
        html: `<div class="custom-pin ${categoryClass}"><i class="fa-solid ${iconClass}"></i></div>`,
        iconSize: [38, 38],
        iconAnchor: [19, 38],
        popupAnchor: [0, -38]
      });

      const marker = L.marker([lat, lng], { icon: customIcon });

      // Create Popup Content
      const statusText = this.getStatusLabel(spot.status);
      const popupHtml = `
        <div class="popup-card">
          ${spot.imageUrl ? `<img src="${spot.imageUrl}" class="popup-thumb" alt="spot">` : ''}
          <div class="popup-title">${this.escapeHtml(spot.name)}</div>
          <div class="popup-sub-row">
            <div class="popup-rating">${'★'.repeat(spot.rating || 0)}${'☆'.repeat(5 - (spot.rating || 0))}</div>
            <span class="popup-status-badge">${statusText}</span>
          </div>
        </div>
      `;

      marker.bindPopup(popupHtml);

      // Hover Mouseover / Mouseout Popup Behavior
      let hoverTimer = null;
      marker.on('mouseover', function () {
        if (hoverTimer) clearTimeout(hoverTimer);
        this.openPopup();
      });

      marker.on('mouseout', function () {
        hoverTimer = setTimeout(() => {
          this.closePopup();
        }, 300);
      });

      marker.on('click', (e) => {
        L.DomEvent.stopPropagation(e);
        mapManager.flyToLocation(spot.lat, spot.lng, 15);
        appUI.openSpotModal(spot);
        if (this.onSpotClick) {
          this.onSpotClick(spot.id);
        }
      });

      this.markersGroup.addLayer(marker);
    });

    if (this.isHeatmapActive) {
      this.updateHeatmap(spots);
    }
  }

  toggleHeatmap(spots) {
    this.isHeatmapActive = !this.isHeatmapActive;

    if (this.isHeatmapActive) {
      this.map.removeLayer(this.markersGroup);
      this.updateHeatmap(spots);
    } else {
      if (this.heatmapLayer) {
        this.map.removeLayer(this.heatmapLayer);
      }
      this.map.addLayer(this.markersGroup);
    }
    return this.isHeatmapActive;
  }

  updateHeatmap(spots) {
    if (this.heatmapLayer) {
      this.map.removeLayer(this.heatmapLayer);
    }

    const heatPoints = spots
      .map(s => [parseFloat(s.lat), parseFloat(s.lng), 0.8])
      .filter(p => !isNaN(p[0]) && !isNaN(p[1]));

    if (window.L.heatLayer) {
      this.heatmapLayer = L.heatLayer(heatPoints, {
        radius: 25,
        blur: 15,
        maxZoom: 15,
        gradient: { 0.4: '#3b82f6', 0.65: '#10b981', 1.0: '#ef4444' }
      });
      this.heatmapLayer.addTo(this.map);
    }
  }

  flyToLocation(lat, lng, zoom = 15) {
    this.map.flyTo([lat, lng], zoom, {
      duration: 1.2,
      easeLinearity: 0.25
    });
  }

  fitAllSpots(spots) {
    if (spots.length === 0) return;
    const bounds = L.latLngBounds(spots.map(s => [parseFloat(s.lat), parseFloat(s.lng)]));
    this.map.fitBounds(bounds, { padding: [50, 50] });
  }

  /* Temporary Draggable Picker Pin for Form Precision */
  showPickerMarker(lat, lng, onDragEndCallback) {
    if (this.pickerMarker) {
      this.map.removeLayer(this.pickerMarker);
    }

    const pickerIcon = L.divIcon({
      className: 'custom-pin-wrapper pick-pin-pulse',
      html: `<div class="custom-pin pin-gourmet" style="background: var(--accent-primary);"><i class="fa-solid fa-crosshairs"></i></div>`,
      iconSize: [40, 40],
      iconAnchor: [20, 40]
    });

    this.pickerMarker = L.marker([lat, lng], {
      icon: pickerIcon,
      draggable: true
    }).addTo(this.map);

    this.pickerMarker.on('dragend', (e) => {
      const position = e.target.getLatLng();
      if (onDragEndCallback) {
        onDragEndCallback(position.lat, position.lng);
      }
    });

    this.flyToLocation(lat, lng, 16);
  }

  removePickerMarker() {
    if (this.pickerMarker) {
      this.map.removeLayer(this.pickerMarker);
      this.pickerMarker = null;
    }
  }

  getCategoryName(catKey) {
    const names = {
      gourmet: 'グルメ・カフェ',
      sightseeing: '観光・撮影',
      business: 'ビジネス・作業',
      infrastructure: '点検・インフラ',
      personal: 'プライベート',
      other: 'その他'
    };
    return names[catKey] || 'その他';
  }

  getStatusLabel(statusKey) {
    const labels = {
      visited: '訪問済み',
      wishlist: '行きたい',
      favorite: 'お気に入り'
    };
    return labels[statusKey] || statusKey || '';
  }

  escapeHtml(str) {
    return (str || '').replace(/[&<>"']/g, m => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    })[m]);
  }
}

const mapManager = new MapManager();
