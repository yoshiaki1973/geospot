/**
 * GeoSpot Studio - Data Store Module
 * Handles LocalStorage CRUD, imports, exports, filtering and sorting
 */

class SpotStore {
  constructor() {
    this.STORAGE_KEY = 'geospot_studio_data_v1';
    this.spots = [];
    this.init();
  }

  init() {
    // Strictly load Curry spots only as requested by the user
    this.spots = [...CURRY_SPOTS];
    this.saveToStorage();
  }

  saveToStorage() {
    localStorage.setItem(this.STORAGE_KEY, JSON.stringify(this.spots));
  }

  getAllSpots() {
    return [...this.spots];
  }

  getSpotById(id) {
    return this.spots.find(spot => spot.id === id);
  }

  saveSpot(spotData) {
    if (spotData.id) {
      // Update existing spot
      const index = this.spots.findIndex(s => s.id === spotData.id);
      if (index !== -1) {
        this.spots[index] = {
          ...this.spots[index],
          ...spotData,
          updatedAt: new Date().toISOString()
        };
      }
    } else {
      // Create new spot
      const newSpot = {
        ...spotData,
        id: 'spot_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5),
        createdAt: new Date().toISOString()
      };
      this.spots.unshift(newSpot);
      spotData.id = newSpot.id;
    }
    this.saveToStorage();
    return spotData;
  }

  deleteSpot(id) {
    this.spots = this.spots.filter(spot => spot.id !== id);
    this.saveToStorage();
  }

  clearAllData() {
    this.spots = [];
    this.saveToStorage();
  }

  loadSampleData() {
    this.spots = [...SAMPLE_SPOTS];
    this.saveToStorage();
    return this.spots;
  }

  /* Filtering & Searching */
  getFilteredSpots({ keyword = '', category = 'all', status = 'all', sortBy = 'newest' } = {}) {
    let result = [...this.spots];

    // Filter by Keyword
    if (keyword.trim()) {
      const q = keyword.toLowerCase().trim();
      result = result.filter(spot => {
        const titleMatch = spot.name && spot.name.toLowerCase().includes(q);
        const notesMatch = spot.notes && spot.notes.toLowerCase().includes(q);
        const addressMatch = spot.address && spot.address.toLowerCase().includes(q);
        const tagsMatch = spot.tags && spot.tags.some(t => t.toLowerCase().includes(q));
        return titleMatch || notesMatch || addressMatch || tagsMatch;
      });
    }

    // Filter by Category
    if (category !== 'all') {
      result = result.filter(spot => spot.category === category);
    }

    // Filter by Status
    if (status !== 'all') {
      result = result.filter(spot => spot.status === status);
    }

    // Sort
    result.sort((a, b) => {
      if (sortBy === 'newest') {
        return new Date(b.createdAt || 0) - new Date(a.createdAt || 0);
      } else if (sortBy === 'oldest') {
        return new Date(a.createdAt || 0) - new Date(b.createdAt || 0);
      } else if (sortBy === 'rating') {
        return (b.rating || 0) - (a.rating || 0);
      } else if (sortBy === 'title') {
        return (a.name || '').localeCompare(b.name || '', 'ja');
      }
      return 0;
    });

    return result;
  }

  /* Summary Statistics */
  getStats() {
    const total = this.spots.length;
    const visited = this.spots.filter(s => s.status === 'visited').length;
    const wishlist = this.spots.filter(s => s.status === 'wishlist').length;
    const favorite = this.spots.filter(s => s.status === 'favorite').length;
    return { total, visited, wishlist, favorite };
  }

  /* Export Methods */
  toGeoJSON() {
    const features = this.spots.map(spot => ({
      type: "Feature",
      geometry: {
        type: "Point",
        coordinates: [parseFloat(spot.lng), parseFloat(spot.lat)]
      },
      properties: {
        id: spot.id,
        name: spot.name,
        category: spot.category,
        status: spot.status,
        rating: spot.rating,
        address: spot.address,
        notes: spot.notes,
        imageUrl: spot.imageUrl,
        tags: spot.tags,
        createdAt: spot.createdAt
      }
    }));

    return JSON.stringify({
      type: "FeatureCollection",
      features: features
    }, null, 2);
  }

  toCSV() {
    const headers = ["id", "name", "lat", "lng", "category", "status", "rating", "address", "notes", "tags", "createdAt"];
    const rows = this.spots.map(spot => {
      return [
        spot.id,
        `"${(spot.name || '').replace(/"/g, '""')}"`,
        spot.lat,
        spot.lng,
        spot.category || '',
        spot.status || '',
        spot.rating || 0,
        `"${(spot.address || '').replace(/"/g, '""')}"`,
        `"${(spot.notes || '').replace(/"/g, '""')}"`,
        `"${(spot.tags ? spot.tags.join(',') : '').replace(/"/g, '""')}"`,
        spot.createdAt || ''
      ].join(',');
    });

    return [headers.join(','), ...rows].join('\n');
  }

  toJSONBackup() {
    return JSON.stringify(this.spots, null, 2);
  }

  /* Import Method */
  importFromJSON(jsonString) {
    try {
      const parsed = JSON.parse(jsonString);
      let newSpots = [];

      if (parsed.type === "FeatureCollection" && Array.isArray(parsed.features)) {
        // GeoJSON format
        newSpots = parsed.features.map(f => ({
          id: f.properties.id || 'spot_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5),
          name: f.properties.name || '無題スポット',
          lng: f.geometry.coordinates[0],
          lat: f.geometry.coordinates[1],
          category: f.properties.category || 'other',
          status: f.properties.status || 'visited',
          rating: f.properties.rating || 3,
          address: f.properties.address || '',
          notes: f.properties.notes || '',
          imageUrl: f.properties.imageUrl || '',
          tags: f.properties.tags || [],
          createdAt: f.properties.createdAt || new Date().toISOString()
        }));
      } else if (Array.isArray(parsed)) {
        // Raw array format
        newSpots = parsed.map(s => ({
          ...s,
          id: s.id || 'spot_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5),
          lat: parseFloat(s.lat),
          lng: parseFloat(s.lng)
        }));
      } else {
        throw new Error('サポートされていないデータ構造です。');
      }

      if (newSpots.length === 0) {
        throw new Error('インポート対象の有効なスポットが見つかりませんでした。');
      }

      // Merge or overwrite (Overwrite duplicates by ID)
      const spotMap = new Map();
      this.spots.forEach(s => spotMap.set(s.id, s));
      newSpots.forEach(s => spotMap.set(s.id, s));

      this.spots = Array.from(spotMap.values());
      this.saveToStorage();
      return newSpots.length;
    } catch (err) {
      console.error('Import error:', err);
      throw err;
    }
  }
}

const store = new SpotStore();
