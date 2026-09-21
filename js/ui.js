/**
 * GeoSpot Studio - UI & Event Controller
 * Controls modals, sidebars, drawer, geocoder, image upload, form binding, export/import
 */

class UIManager {
  constructor() {
    this.currentSpotId = null;
    this.isPickingMode = false;
  }

  init() {
    this.bindGlobalEvents();
    this.bindFormEvents();
    this.bindFilterEvents();
    this.bindGeocoder();
    this.bindExportImport();
    this.bindRatingStars();
    this.updateStats();
    this.renderSpotsList();
  }

  /* Global Navigation & Controls */
  bindGlobalEvents() {
    // Theme Switcher
    const themeBtn = document.getElementById('theme-toggle-btn');
    themeBtn.addEventListener('click', () => {
      document.body.classList.toggle('light-theme');
      document.body.classList.toggle('dark-theme');
      const isDark = document.body.classList.contains('dark-theme');
      themeBtn.innerHTML = isDark ? '<i class="fa-solid fa-moon"></i>' : '<i class="fa-solid fa-sun"></i>';
      this.showToast(isDark ? 'ダークテーマに変更しました' : 'ライトテーマに変更しました', 'info');
    });

    // Sidebar Toggle
    const sidebar = document.getElementById('sidebar');
    const toggleSidebarBtn = document.getElementById('toggle-sidebar-btn');
    toggleSidebarBtn.addEventListener('click', () => {
      sidebar.classList.toggle('collapsed');
      setTimeout(() => mapManager.map.invalidateSize(), 300);
    });

    // Open Registration Modal
    const addSpotBtn = document.getElementById('add-spot-btn');
    if (addSpotBtn) {
      addSpotBtn.addEventListener('click', () => {
        const center = mapManager.map.getCenter();
        this.openSpotModal(null, center.lat, center.lng);
      });
    }

    // Modal Close
    document.getElementById('modal-close-btn').addEventListener('click', () => this.closeSpotModal());
    document.getElementById('modal-cancel-btn').addEventListener('click', () => this.closeSpotModal());

    // Locate GPS button
    document.getElementById('locate-btn').addEventListener('click', () => {
      if (navigator.geolocation) {
        this.showToast('現在地を取得中...', 'info');
        navigator.geolocation.getCurrentPosition(
          (pos) => {
            const { latitude, longitude } = pos.coords;
            mapManager.flyToLocation(latitude, longitude, 15);
            this.showToast('現在地に移動しました', 'success');
          },
          (err) => {
            this.showToast('現在地を取得できませんでした: ' + err.message, 'error');
          }
        );
      } else {
        this.showToast('お使いのブラウザはGPS位置情報非対応です', 'error');
      }
    });

    // Layer Menu Dropdown
    const layerMenuBtn = document.getElementById('layer-menu-btn');
    const layerMenuDropdown = document.getElementById('layer-menu-dropdown');
    layerMenuBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      layerMenuDropdown.classList.toggle('hidden');
    });

    document.addEventListener('click', () => {
      layerMenuDropdown.classList.add('hidden');
    });

    document.querySelectorAll('input[name="basemap"]').forEach(radio => {
      radio.addEventListener('change', (e) => {
        mapManager.switchTileLayer(e.target.value);
        layerMenuDropdown.classList.add('hidden');
      });
    });

    // Map Click Callback for Quick Pinning
    mapManager.onMapClick = (lat, lng) => {
      // Update coordinates badge
      document.getElementById('coords-text').textContent = `${lat.toFixed(5)}, ${lng.toFixed(5)}`;

      if (this.isPickingMode) {
        document.getElementById('spot-lat').value = lat.toFixed(6);
        document.getElementById('spot-lng').value = lng.toFixed(6);
        mapManager.showPickerMarker(lat, lng, (newLat, newLng) => {
          document.getElementById('spot-lat').value = newLat.toFixed(6);
          document.getElementById('spot-lng').value = newLng.toFixed(6);
        });
        this.showToast('ピン位置を変更しました', 'info');
      } else {
        this.openSpotModal(null, lat, lng);
      }
    };

    // Pick Pin Mode Button in Modal
    document.getElementById('pick-on-map-btn').addEventListener('click', () => {
      this.isPickingMode = true;
      const lat = parseFloat(document.getElementById('spot-lat').value) || mapManager.defaultCenter[0];
      const lng = parseFloat(document.getElementById('spot-lng').value) || mapManager.defaultCenter[1];

      mapManager.showPickerMarker(lat, lng, (newLat, newLng) => {
        document.getElementById('spot-lat').value = newLat.toFixed(6);
        document.getElementById('spot-lng').value = newLng.toFixed(6);
      });

      document.getElementById('spot-modal').classList.add('hidden');
      this.showToast('地図上をクリックまたはピンをドラッグして位置を調整し、再度登録ボタンを押してください。', 'info');
    });

    // Detail Drawer Close
    document.getElementById('detail-close-btn').addEventListener('click', () => {
      this.closeDetailDrawer();
    });

    // Clear All Data
    document.getElementById('clear-data-btn').addEventListener('click', () => {
      if (confirm('登録されているすべてのスポットを削除しますか？この操作は取り消せません。')) {
        store.clearAllData();
        this.refreshAll();
        this.showToast('全データを削除しました', 'error');
      }
    });
  }

  /* Form & Star Rating */
  bindRatingStars() {
    const starsContainer = document.getElementById('rating-stars');
    const stars = starsContainer.querySelectorAll('i');
    const ratingInput = document.getElementById('spot-rating');

    stars.forEach(star => {
      star.addEventListener('click', () => {
        const rating = parseInt(star.getAttribute('data-rating'));
        ratingInput.value = rating;
        stars.forEach((s, idx) => {
          s.classList.toggle('active', idx < rating);
        });
      });
    });

    // Image Input & Preview
    const fileInput = document.getElementById('spot-image-file');
    const urlInput = document.getElementById('spot-image-url');
    const previewContainer = document.getElementById('image-preview-container');
    const previewImg = document.getElementById('image-preview');
    const removeImgBtn = document.getElementById('remove-image-btn');

    fileInput.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = (event) => {
          previewImg.src = event.target.result;
          previewContainer.classList.remove('hidden');
        };
        reader.readAsDataURL(file);
      }
    });

    urlInput.addEventListener('input', (e) => {
      if (e.target.value) {
        previewImg.src = e.target.value;
        previewContainer.classList.remove('hidden');
      }
    });

    removeImgBtn.addEventListener('click', () => {
      fileInput.value = '';
      urlInput.value = '';
      previewImg.src = '';
      previewContainer.classList.add('hidden');
    });
  }

  bindFormEvents() {
    const form = document.getElementById('spot-form');
    form.addEventListener('submit', (e) => {
      e.preventDefault();

      const spotId = document.getElementById('spot-id').value;
      const lat = parseFloat(document.getElementById('spot-lat').value);
      const lng = parseFloat(document.getElementById('spot-lng').value);
      const name = document.getElementById('spot-name').value.trim();
      const status = document.getElementById('spot-status').value;
      const rating = parseInt(document.getElementById('spot-rating').value) || 3;
      const address = document.getElementById('spot-address').value.trim();
      const notes = document.getElementById('spot-notes').value.trim();
      const imageUrl = document.getElementById('image-preview').src || '';
      const tagsStr = document.getElementById('spot-tags').value.trim();
      const tags = tagsStr ? tagsStr.split(',').map(t => t.trim()).filter(Boolean) : [];

      if (isNaN(lat) || isNaN(lng)) {
        this.showToast('有効な緯度・経度を入力してください', 'error');
        return;
      }

      if (!name) {
        this.showToast('スポット名を入力してください', 'error');
        return;
      }

      const spotData = {
        id: spotId || null,
        name,
        lat,
        lng,
        category,
        status,
        rating,
        address,
        notes,
        imageUrl: imageUrl.startsWith('data:') || imageUrl.startsWith('http') ? imageUrl : '',
        tags
      };

      store.saveSpot(spotData);
      this.closeSpotModal();
      this.refreshAll();
      mapManager.flyToLocation(lat, lng, 15);
      this.showToast(spotId ? 'スポット情報を更新しました' : '新規スポットを登録しました', 'success');
    });
  }

  openSpotModal(spot = null, defaultLat = null, defaultLng = null) {
    this.isPickingMode = true; // allow pin adjustment
    const modal = document.getElementById('spot-modal');
    const modalTitle = document.getElementById('modal-title');
    const previewContainer = document.getElementById('image-preview-container');
    const previewImg = document.getElementById('image-preview');

    if (spot) {
      modalTitle.innerHTML = '<i class="fa-solid fa-pen-to-square"></i> スポットの編集';
      document.getElementById('spot-id').value = spot.id;
      document.getElementById('spot-lat').value = spot.lat;
      document.getElementById('spot-lng').value = spot.lng;
      document.getElementById('spot-name').value = spot.name || '';
      document.getElementById('spot-status').value = spot.status || 'visited';
      document.getElementById('spot-rating').value = spot.rating || 4;
      document.getElementById('spot-address').value = spot.address || '';
      document.getElementById('spot-notes').value = spot.notes || '';
      document.getElementById('spot-tags').value = spot.tags ? spot.tags.join(', ') : '';

      if (spot.imageUrl) {
        previewImg.src = spot.imageUrl;
        previewContainer.classList.remove('hidden');
      } else {
        previewImg.src = '';
        previewContainer.classList.add('hidden');
      }

      // Update rating stars active state
      const stars = document.getElementById('rating-stars').querySelectorAll('i');
      stars.forEach((s, idx) => s.classList.toggle('active', idx < (spot.rating || 4)));
    } else {
      modalTitle.innerHTML = '<i class="fa-solid fa-map-pin"></i> スポットデータの登録';
      document.getElementById('spot-form').reset();
      document.getElementById('spot-id').value = '';
      document.getElementById('spot-lat').value = (defaultLat || mapManager.defaultCenter[0]).toFixed(6);
      document.getElementById('spot-lng').value = (defaultLng || mapManager.defaultCenter[1]).toFixed(6);
      document.getElementById('spot-rating').value = 4;
      previewImg.src = '';
      previewContainer.classList.add('hidden');

      const stars = document.getElementById('rating-stars').querySelectorAll('i');
      stars.forEach((s, idx) => s.classList.toggle('active', idx < 4));
    }

    modal.classList.remove('hidden');
  }

  closeSpotModal() {
    document.getElementById('spot-modal').classList.add('hidden');
    mapManager.removePickerMarker();
    this.isPickingMode = false;
  }

  /* Filter & List Binding */
  bindFilterEvents() {
    const filterKeyword = document.getElementById('filter-keyword');
    const filterStatus = document.getElementById('filter-status');
    const sortSelect = document.getElementById('sort-select');

    const updateFilter = () => {
      this.renderSpotsList();
    };

    if (filterKeyword) filterKeyword.addEventListener('input', updateFilter);
    if (filterStatus) filterStatus.addEventListener('change', updateFilter);
    if (sortSelect) sortSelect.addEventListener('change', updateFilter);
  }

  getCurrentFilteredSpots() {
    const keyword = document.getElementById('filter-keyword').value;
    const status = document.getElementById('filter-status').value;
    const sortBy = document.getElementById('sort-select').value;
    return store.getFilteredSpots({ keyword, category: 'all', status, sortBy });
  }

  renderSpotsList() {
    const spots = this.getCurrentFilteredSpots();
    const listContainer = document.getElementById('spots-list');
    document.getElementById('spots-count').textContent = spots.length;

    // Render map markers with filtered spots
    mapManager.renderSpots(spots);

    if (spots.length === 0) {
      listContainer.innerHTML = `
        <div class="empty-state">
          <i class="fa-solid fa-location-dot empty-icon"></i>
          <p>該当するスポットがありません</p>
          <small>検索条件を変更するか、新規登録を行ってください。</small>
        </div>
      `;
      return;
    }

    listContainer.innerHTML = spots.map(spot => {
      const starsHtml = '★'.repeat(spot.rating || 0) + '☆'.repeat(5 - (spot.rating || 0));

      return `
        <div class="spot-card cat-gourmet" onclick="appUI.onSpotCardClick('${spot.id}')">
          <div class="spot-card-top">
            <div class="spot-card-title">${this.escapeHtml(spot.name)}</div>
          </div>
          ${spot.address ? `<div class="spot-card-address"><i class="fa-solid fa-location-pin"></i> ${this.escapeHtml(spot.address)}</div>` : ''}
          <div class="spot-card-sub">
            <div class="spot-card-rating">${starsHtml}</div>
            <div class="spot-card-status">${this.getStatusLabel(spot.status)}</div>
          </div>
        </div>
      `;
    }).join('');
  }

  onSpotCardClick(id) {
    const spot = store.getSpotById(id);
    if (spot) {
      mapManager.flyToLocation(spot.lat, spot.lng, 15);
      this.showDetailDrawer(spot.id);
    }
  }

  /* Detail Drawer Controller */
  showDetailDrawer(id) {
    const spot = store.getSpotById(id);
    if (!spot) return;

    this.currentSpotId = id;
    const drawer = document.getElementById('detail-drawer');

    // Bind Spot Data
    document.getElementById('detail-title').textContent = spot.name;
    document.getElementById('detail-rating-stars').textContent = '★'.repeat(spot.rating || 0) + '☆'.repeat(5 - (spot.rating || 0));
    document.getElementById('detail-status-badge').textContent = this.getStatusLabel(spot.status);
    document.getElementById('detail-coords-text').textContent = `${parseFloat(spot.lat).toFixed(6)}, ${parseFloat(spot.lng).toFixed(6)}`;
    document.getElementById('detail-address').textContent = spot.address || '（未登録）';
    document.getElementById('detail-date').textContent = spot.createdAt ? new Date(spot.createdAt).toLocaleString('ja-JP') : '-';
    document.getElementById('detail-notes').textContent = spot.notes || 'メモはありません。';

    // Image Box
    const imgBox = document.getElementById('detail-image-box');
    const imgEl = document.getElementById('detail-image');
    if (spot.imageUrl) {
      imgEl.src = spot.imageUrl;
      imgBox.classList.remove('hidden');
    } else {
      imgBox.classList.add('hidden');
    }

    // Tags List
    const tagsContainer = document.getElementById('detail-tags-list');
    if (spot.tags && spot.tags.length > 0) {
      tagsContainer.innerHTML = spot.tags.map(t => `<span class="tag-badge"># ${this.escapeHtml(t)}</span>`).join('');
      document.getElementById('detail-tags-section').classList.remove('hidden');
    } else {
      document.getElementById('detail-tags-section').classList.add('hidden');
    }

    // Google Maps Link
    document.getElementById('nav-google-btn').href = `https://www.google.com/maps/dir/?api=1&destination=${spot.lat},${spot.lng}`;

    // Copy Coords Action
    document.getElementById('copy-coords-btn').onclick = () => {
      navigator.clipboard.writeText(`${spot.lat}, ${spot.lng}`);
      this.showToast('座標をクリップボードにコピーしました', 'success');
    };

    // Edit Button
    document.getElementById('edit-spot-btn').onclick = () => {
      this.closeDetailDrawer();
      this.openSpotModal(spot);
    };

    // Delete Button
    document.getElementById('delete-spot-btn').onclick = () => {
      if (confirm(`「${spot.name}」を削除しますか？`)) {
        store.deleteSpot(spot.id);
        this.closeDetailDrawer();
        this.refreshAll();
        this.showToast('スポットを削除しました', 'info');
      }
    };

    drawer.classList.remove('hidden');
  }

  closeDetailDrawer() {
    document.getElementById('detail-drawer').classList.add('hidden');
    this.currentSpotId = null;
  }

  /* Geocoder Address Search (Nominatim API) */
  bindGeocoder() {
    const input = document.getElementById('geocoder-input');
    const btn = document.getElementById('geocoder-btn');
    const resultsContainer = document.getElementById('geocoder-results');

    const searchAddress = async () => {
      const query = input.value.trim();
      if (!query) return;

      this.showToast('場所を検索中...', 'info');
      try {
        const response = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=5&accept-language=ja`);
        const results = await response.json();

        if (!results || results.length === 0) {
          resultsContainer.innerHTML = `<div class="geocoder-item">「${this.escapeHtml(query)}」は見つかりませんでした。</div>`;
          resultsContainer.classList.remove('hidden');
          return;
        }

        resultsContainer.innerHTML = results.map(item => `
          <div class="geocoder-item" onclick="appUI.selectGeocoderItem(${item.lat}, ${item.lon}, '${this.escapeHtml(item.display_name.replace(/'/g, "\\'"))}')">
            <i class="fa-solid fa-location-dot"></i>
            <div>${this.escapeHtml(item.display_name)}</div>
          </div>
        `).join('');

        resultsContainer.classList.remove('hidden');
      } catch (err) {
        console.error('Geocoder error:', err);
        this.showToast('位置検索中にエラーが発生しました', 'error');
      }
    };

    btn.addEventListener('click', searchAddress);
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') searchAddress();
    });

    document.addEventListener('click', (e) => {
      if (!e.target.closest('.search-bar-container')) {
        resultsContainer.classList.add('hidden');
      }
    });
  }

  selectGeocoderItem(lat, lng, displayName) {
    const resultsContainer = document.getElementById('geocoder-results');
    resultsContainer.classList.add('hidden');
    mapManager.flyToLocation(lat, lng, 16);
    this.showToast(`「${displayName.split(',')[0]}」に移動しました`, 'success');
  }

  /* Data Import & Export Binding */
  bindExportImport() {
    const exportBtn = document.getElementById('export-data-btn');
    const exportModal = document.getElementById('export-modal');
    const exportCloseBtn = document.getElementById('export-close-btn');

    exportBtn.addEventListener('click', () => exportModal.classList.remove('hidden'));
    exportCloseBtn.addEventListener('click', () => exportModal.classList.add('hidden'));

    document.getElementById('export-geojson-btn').addEventListener('click', () => {
      const geojsonStr = store.toGeoJSON();
      this.downloadFile(geojsonStr, `geospot_data_${Date.now()}.geojson`, 'application/json');
      exportModal.classList.add('hidden');
      this.showToast('GeoJSONファイルを出力しました', 'success');
    });

    document.getElementById('export-csv-btn').addEventListener('click', () => {
      const csvStr = store.toCSV();
      this.downloadFile(csvStr, `geospot_data_${Date.now()}.csv`, 'text/csv;charset=utf-8;');
      exportModal.classList.add('hidden');
      this.showToast('CSVファイルを出力しました', 'success');
    });

    document.getElementById('export-json-btn').addEventListener('click', () => {
      const jsonStr = store.toJSONBackup();
      this.downloadFile(jsonStr, `geospot_backup_${Date.now()}.json`, 'application/json');
      exportModal.classList.add('hidden');
      this.showToast('JSONバックアップを出力しました', 'success');
    });

    // File Import Listener
    const importInput = document.getElementById('import-file');
    importInput.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = (event) => {
        try {
          const count = store.importFromJSON(event.target.result);
          this.refreshAll();
          mapManager.fitAllSpots(store.getAllSpots());
          this.showToast(`${count}件のスポットを正常にインポートしました`, 'success');
        } catch (err) {
          this.showToast(`インポートに失敗しました: ${err.message}`, 'error');
        }
        importInput.value = '';
      };
      reader.readAsText(file);
    });
  }

  downloadFile(content, fileName, mimeType) {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  updateStats() {
    const stats = store.getStats();
    document.getElementById('stat-total').textContent = stats.total;
    document.getElementById('stat-visited').textContent = stats.visited;
    document.getElementById('stat-wishlist').textContent = stats.wishlist;
  }

  refreshAll() {
    this.updateStats();
    this.renderSpotsList();
  }

  getStatusLabel(statusKey) {
    const labels = {
      visited: '訪問済み',
      wishlist: '行きたい',
      favorite: 'お気に入り'
    };
    return labels[statusKey] || statusKey;
  }

  showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;

    let icon = 'fa-circle-info';
    if (type === 'success') icon = 'fa-circle-check';
    if (type === 'error') icon = 'fa-circle-exclamation';

    toast.innerHTML = `<i class="fa-solid ${icon}"></i> <span>${this.escapeHtml(message)}</span>`;
    container.appendChild(toast);

    setTimeout(() => {
      toast.style.animation = 'toastOut 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards';
      setTimeout(() => toast.remove(), 300);
    }, 3200);
  }

  escapeHtml(str) {
    return (str || '').replace(/[&<>"']/g, m => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    })[m]);
  }
}

const appUI = new UIManager();
