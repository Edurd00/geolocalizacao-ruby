(() => {
  const byId = (id) => document.getElementById(id);
  const validPoint = (lat, lng) => Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180 && !(lat === 0 && lng === 0);
  const porteColor = (porte) => {
    const normalized = (porte || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase().trim();
    return ({ ESTADUAL: "#3b82f6", SETORIAL: "#f59e0b", CENTRAL: "#f97316", REGIONAL: "#10b981", LOCAL: "#a855f7", "CASA DE ORACAO": "#ec4899", "ALDEIA INDIGENA": "#22d3ee" })[normalized] || "#6b7280";
  };

  function initMap() {
    const element = byId("map");
    if (!element || !window.L) return;
    const map = L.map(element, { center: [-14.235, -51.925], zoom: 4 });
    const osm = L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 19, attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors' });
    const satellite = L.tileLayer("https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}", { maxZoom: 19, attribution: "Tiles &copy; Esri" });
    satellite.addTo(map);
    L.control.layers({ "Satélite Esri": satellite, OpenStreetMap: osm }).addTo(map);

    const group = L.markerClusterGroup ? L.markerClusterGroup({
      chunkedLoading: true,
      showCoverageOnHover: false,
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
    async function loadMarkers() {
      const requestId = ++markerRequestId;
      const params = new URLSearchParams();
      const porte = document.querySelector('[data-map-target="porteFilter"]')?.value;
      const validada = document.querySelector('[data-map-target="validadaFilter"]')?.value;
      const query = document.querySelector('[data-map-target="searchInput"]')?.value.trim();
      if (porte) params.set("porte", porte);
      if (validada) params.set("validada", validada);
      if (query?.length >= 2) params.set("query", query);
      try {
        const response = await fetch(`/map/locations${params.size ? `?${params}` : ""}`, { headers: { Accept: "application/json" } });
        if (!response.ok) throw new Error("Não foi possível carregar os pontos do mapa.");
        const churches = await response.json();
        if (requestId !== markerRequestId) return;
        group.clearLayers();
        const bounds = [];
        churches.forEach((church) => {
          const lat = Number(church.latitude), lng = Number(church.longitude);
          if (!validPoint(lat, lng)) return;
          bounds.push([lat, lng]);
          const porte = church.porte || "";
          const marker = L.marker([lat, lng], {
            icon: L.divIcon({ html: `<span style="display:block;background:${porteColor(porte)};width:20px;height:20px;border-radius:50%;border:2px solid white;box-shadow:0 1px 4px #0009"></span>`, className: "church-marker-icon", iconSize: [24, 24], iconAnchor: [12, 12], popupAnchor: [0, -12] }),
            porte
          });
          const title = document.createElement("strong");
          title.textContent = church.nome || "Igreja IPDA";
          const content = document.createElement("div");
          const addLine = (label, value) => {
            const line = document.createElement("div");
            line.textContent = `${label}: ${value || "—"}`;
            content.appendChild(line);
          };
          const codeLine = document.createElement("div");
          title.textContent = `Código TOTVS: ${church.codigo_totvs || "—"}`;
          codeLine.appendChild(title);
          content.append(codeLine);
          addLine("Nome da Igreja", church.nome || "Igreja IPDA");
          addLine("Porte", porte || "—");
          addLine("Município/UF", [church.municipio, church.estado].filter(Boolean).join("/") || "—");
          addLine("Endereço", [church.endereco, church.bairro].filter(Boolean).join(", ") || "—");
          marker.bindPopup(content);
          group.addLayer(marker);
        });
        if (bounds.length === 1) {
          map.flyTo(bounds[0], 16);
          group.eachLayer((marker) => marker.getLatLng().equals(bounds[0]) && marker.openPopup());
        } else if (bounds.length) {
          map.fitBounds(bounds, { padding: [30, 30], maxZoom: 13 });
        }
      } catch (error) {
        console.error(error);
      }
    }

    document.querySelectorAll('[data-action~="change->map#applyFilters"]').forEach((input) => input.addEventListener("change", loadMarkers));
    document.querySelector('[data-action~="click->map#toggleFilters"]')?.addEventListener("click", () => document.querySelector('[data-map-target="filterModal"]')?.classList.toggle("hidden"));
    document.querySelector('[data-action~="click->map#clearFilters"]')?.addEventListener("click", () => {
      document.querySelectorAll('[data-map-target="porteFilter"], [data-map-target="validadaFilter"], [data-map-target="searchInput"]').forEach((input) => { input.value = ""; });
      loadMarkers();
    });
    let searchTimeout;
    document.querySelector('[data-map-target="searchInput"]')?.addEventListener("input", () => {
      clearTimeout(searchTimeout);
      searchTimeout = setTimeout(loadMarkers, 400);
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
        const response = await fetch("/validation/extract_coords", { method: "POST", headers: { "Content-Type": "application/json", "X-CSRF-Token": document.querySelector('meta[name="csrf-token"]')?.content || "" }, body: JSON.stringify({ url: link.value }) });
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
