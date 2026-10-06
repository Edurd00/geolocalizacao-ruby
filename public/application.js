(() => {
  const byId = (id) => document.getElementById(id);
  const validPoint = (lat, lng) => Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180 && !(lat === 0 && lng === 0);

  function initMap() {
    const element = byId("map");
    if (!element || !window.L) return;
    const map = L.map(element, { center: [-14.235, -51.925], zoom: 4 });

    setTimeout(() => {
      map.invalidateSize();
    }, 200);

    const osm = L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 19, attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors' });
    const satellite = L.tileLayer("https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}", { maxZoom: 19, attribution: "Tiles &copy; Esri" });
    satellite.addTo(map);
    L.control.layers({ "Satélite Esri": satellite, OpenStreetMap: osm }).addTo(map);

    fetch("/map/locations", { headers: { Accept: "application/json" } })
      .then((response) => { if (!response.ok) throw new Error("Não foi possível carregar os pontos do mapa."); return response.json(); })
      .then((churches) => {
        const group = L.markerClusterGroup ? L.markerClusterGroup({ chunkedLoading: true, showCoverageOnHover: false }) : L.featureGroup();
        const bounds = [];
        churches.forEach((church) => {
          const lat = Number(church.latitude), lng = Number(church.longitude);
          if (!validPoint(lat, lng)) return;
          bounds.push([lat, lng]);
          const marker = L.marker([lat, lng]);
          const title = document.createElement("strong");
          title.textContent = church.nome || "Igreja IPDA";
          const details = document.createElement("div");
          details.textContent = [church.codigo_totvs ? `TOTVS: ${church.codigo_totvs}` : "", church.endereco, church.bairro, church.municipio, church.estado].filter(Boolean).join(" · ");
          const content = document.createElement("div");
          content.append(title, document.createElement("br"), details);
          marker.bindPopup(content);
          group.addLayer(marker);
        });
        group.addTo(map);
        if (bounds.length) map.fitBounds(bounds, { padding: [30, 30], maxZoom: 13 });
      })
      .catch((error) => {
        const notice = document.createElement("p");
        notice.className = "map-error";
        notice.textContent = error.message;
        element.appendChild(notice);
      });
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
