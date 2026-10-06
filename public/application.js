(() => {
  const byId = (id) => document.getElementById(id);
  const validPoint = (lat, lng) => Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180 && !(lat === 0 && lng === 0);
  const porteColor = (porte) => {
    const normalized = (porte || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase().trim();
    return ({ ESTADUAL: "#3b82f6", SETORIAL: "#eab308", CENTRAL: "#f97316", REGIONAL: "#22c55e", LOCAL: "#64748b", "CASA DE ORACAO": "#ec4899", "ALDEIA INDIGENA": "#06b6d4" })[normalized] || "#64748b";
  };
  const customPin = (color) => L.divIcon({
    html: `<div style="width:32px;height:40px;filter:drop-shadow(0 2px 3px #0008)"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 36" width="32" height="40" fill="${color}"><path d="M12 0C5.37 0 0 5.37 0 12c0 9 12 24 12 24s12-15 12-24c0-6.63-5.37-12-12-12z" stroke="#ffffff" stroke-width="2"/><circle cx="12" cy="12" r="5" fill="#ffffff"/><circle cx="12" cy="12" r="3" fill="${color}"/></svg></div>`,
    className: "custom-pin-icon", iconSize: [32, 40], iconAnchor: [16, 40], popupAnchor: [0, -36]
  });

  function initMap() {
    const element = byId("map");
    if (!element || !window.L) return;
    const map = L.map(element, { center: [-14.235, -51.925], zoom: 4 });
    const satellite = L.tileLayer("https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}", {
      maxZoom: 19,
      attribution: "Tiles &copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AERO, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community"
    });
    const labels = L.tileLayer("https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}", { maxZoom: 19 });
    const roads = L.tileLayer("https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Transportation/MapServer/tile/{z}/{y}/{x}", { maxZoom: 19 });
    const satelliteHybrid = L.layerGroup([satellite, labels, roads]);
    const osm = L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
    });
    satelliteHybrid.addTo(map);
    L.control.layers({ "Satélite (com Ruas e Divisas)": satelliteHybrid, "Mapa Vetorial (OSM)": osm }, null, { position: "topright" }).addTo(map);

    const group = L.markerClusterGroup ? L.markerClusterGroup({
      chunkedLoading: false,
      showCoverageOnHover: false,
      animate: false,
      animateAddingMarkers: false,
      removeOutsideVisibleBounds: true,
      iconCreateFunction: (cluster) => {
        const counts = new Map();
        cluster.getAllChildMarkers().forEach((marker) => counts.set(marker.options.porte, (counts.get(marker.options.porte) || 0) + 1));
        const porte = [...counts].sort((a, b) => b[1] - a[1])[0]?.[0];
        const count = cluster.getChildCount();
        const size = count < 10 ? 38 : count < 100 ? 44 : 52;
        return L.divIcon({ html: `<span style="display:flex;align-items:center;justify-content:center;border:3px solid #fff;border-radius:50%;color:#fff;font-weight:800;background:${porteColor(porte)};width:${size}px;height:${size}px;box-shadow:0 2px 8px #0008">${count}</span>`, className: "church-marker-cluster", iconSize: [size, size] });
      }
    }) : L.featureGroup();
    group.addTo(map);

    let markerRequestId = 0;
    async function loadMarkers(resetView = false) {
      const requestId = ++markerRequestId;
      const params = new URLSearchParams();
      const porte = document.querySelector('[data-map-target="porteFilter"]')?.value;
      const estado = document.querySelector('[data-map-target="estadoFilter"]')?.value;
      const validada = document.querySelector('[data-map-target="validadaFilter"]')?.value;
      const query = document.querySelector('[data-map-target="searchInput"]')?.value.trim();
      if (porte) params.set("porte", porte);
      if (estado) params.set("estado", estado);
      if (validada) params.set("validada", validada);
      if (query?.length >= 2) params.set("query", query);
      try {
        const response = await fetch(`/map/locations${params.size ? `?${params}` : ""}`, { headers: { Accept: "application/json" } });
        if (!response.ok) throw new Error("Não foi possível carregar os pontos do mapa.");
        const churches = await response.json();
        if (requestId !== markerRequestId) return;
        group.clearLayers();
        const bounds = [];
        const iconCache = new Map();
        let index = 0;
        const processBatch = () => {
          if (requestId !== markerRequestId) return;
          const markers = [];
          const batchEnd = Math.min(index + 400, churches.length);
          for (; index < batchEnd; index += 1) {
            const church = churches[index];
            const lat = Number(church.latitude), lng = Number(church.longitude);
            if (!validPoint(lat, lng)) continue;
            bounds.push([lat, lng]);
            const porte = (church.porte || "LOCAL").toUpperCase().trim();
            const color = porteColor(porte);
            if (!iconCache.has(color)) iconCache.set(color, customPin(color));
            const marker = L.marker([lat, lng], { icon: iconCache.get(color), porte });
            marker.bindPopup(() => {
              const content = document.createElement("div");
              const addLine = (label, value, strong = false) => {
                const line = document.createElement("div");
                line.textContent = `${label}: ${value || "—"}`;
                if (strong) {
                  const title = document.createElement("strong");
                  title.textContent = line.textContent;
                  line.replaceChildren(title);
                }
                content.appendChild(line);
              };
              addLine("Código TOTVS", church.codigo_totvs, true);
              addLine("Nome da Igreja", church.nome || "Igreja IPDA");
              addLine("Porte", porte);
              addLine("Município/UF", [church.municipio, church.estado].filter(Boolean).join("/"));
              addLine("Endereço", [church.endereco, church.bairro].filter(Boolean).join(", "));
              return content;
            });
            markers.push(marker);
          }
          if (typeof group.addLayers === "function") group.addLayers(markers);
          else markers.forEach((marker) => group.addLayer(marker));
          if (index < churches.length) {
            window.setTimeout(processBatch, 0);
          } else if (resetView) {
            map.flyTo([-14.235, -51.9253], 4);
          } else if (bounds.length === 1) {
            map.flyTo(bounds[0], 16);
            group.eachLayer((marker) => marker.getLatLng().equals(bounds[0]) && marker.openPopup());
          } else if (bounds.length) {
            map.fitBounds(bounds, { padding: [30, 30], maxZoom: 13 });
          }
        };
        processBatch();
      } catch (error) {
        console.error(error);
      }
    }

    document.querySelectorAll('[data-action~="change->map#applyFilters"]').forEach((input) => input.addEventListener("change", () => {
      clearTimeout(searchTimeout);
      loadMarkers();
    }));
    const filterToggle = document.querySelector('[data-map-target="filterToggle"]');
    const filterModal = document.querySelector('[data-map-target="filterModal"]');
    const setFiltersOpen = (open) => {
      filterModal?.classList.toggle("hidden", !open);
      filterToggle?.setAttribute("aria-expanded", String(open));
    };
    filterToggle?.addEventListener("click", () => setFiltersOpen(filterModal?.classList.contains("hidden")));
    document.addEventListener("click", (event) => {
      if (!filterModal?.classList.contains("hidden") && !filterModal.contains(event.target) && !filterToggle?.contains(event.target)) setFiltersOpen(false);
    });
    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape") setFiltersOpen(false);
    });
    document.querySelector('[data-action~="click->map#clearFilters"]')?.addEventListener("click", () => {
      clearTimeout(searchTimeout);
      document.querySelectorAll('[data-map-target="porteFilter"], [data-map-target="estadoFilter"], [data-map-target="validadaFilter"], [data-map-target="searchInput"]').forEach((input) => { input.value = ""; });
      document.querySelector('[data-map-target="clearSearch"]')?.classList.add("hidden");
      setFiltersOpen(false);
      loadMarkers(true);
    });
    const searchInput = document.querySelector('[data-map-target="searchInput"]');
    const clearSearch = document.querySelector('[data-map-target="clearSearch"]');
    clearSearch?.addEventListener("click", () => {
      if (searchInput) searchInput.value = "";
      clearSearch.classList.add("hidden");
      clearTimeout(searchTimeout);
      loadMarkers(true);
    });
    let searchTimeout;
    searchInput?.addEventListener("input", () => {
      const query = searchInput.value.trim();
      clearSearch?.classList.toggle("hidden", query.length === 0);
      clearTimeout(searchTimeout);
      if (!query) {
        loadMarkers(true);
      } else {
        searchTimeout = setTimeout(() => loadMarkers(), 250);
      }
    });
    window.addEventListener("resize", () => map.invalidateSize());
    setTimeout(() => map.invalidateSize(), 250);
    loadMarkers();
  }

  function initValidationMap() {
    const element = document.querySelector('[data-validation-target="map"]');
    if (!element || !window.L) return;
    const latInput = document.querySelector('[data-validation-target="latInput"]');
    const lngInput = document.querySelector('[data-validation-target="lngInput"]');
    const initialLat = Number(element.closest("[data-validation-lat-value]")?.dataset.validationLatValue);
    const initialLng = Number(element.closest("[data-validation-lng-value]")?.dataset.validationLngValue);
    const center = validPoint(initialLat, initialLng) ? [initialLat, initialLng] : [-14.235, -51.925];
    const map = L.map(element).setView(center, 16);
    L.tileLayer("https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}", { maxZoom: 19, attribution: "Tiles &copy; Esri" }).addTo(map);
    const marker = L.marker(center, { draggable: true }).addTo(map);
    const syncInputs = ([lat, lng]) => { if (latInput) latInput.value = lat.toFixed(6); if (lngInput) lngInput.value = lng.toFixed(6); };
    marker.on("dragend", (event) => { const point = event.target.getLatLng(); syncInputs([point.lat, point.lng]); });

    const link = document.querySelector('[data-validation-target="linkInput"]');
    link?.addEventListener("change", async () => {
      if (!link.value.trim()) return;
      try {
        const response = await fetch("/validacao/extract_coords", { method: "POST", headers: { "Content-Type": "application/json", "X-CSRF-Token": document.querySelector('meta[name="csrf-token"]')?.content || "" }, body: JSON.stringify({ url: link.value }) });
        const result = await response.json();
        if (!response.ok || !result.success) throw new Error(result.error || "Não foi possível encontrar coordenadas nesse link.");
        const point = [Number(result.latitude), Number(result.longitude)];
        if (!validPoint(...point)) throw new Error("As coordenadas encontradas são inválidas.");
        syncInputs(point); marker.setLatLng(point); map.flyTo(point, 17);
      } catch (error) { window.alert(error.message); }
    });
  }

  document.addEventListener("DOMContentLoaded", () => { initMap(); initValidationMap(); });
})();
