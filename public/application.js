(() => {
  const byId = (id) => document.getElementById(id);
  const validPoint = (lat, lng) => Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180 && !(lat === 0 && lng === 0);
  const porteColor = (porte) => {
    const normalized = (porte || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase().trim();
    return ({ ESTADUAL: "#3b82f6", SETORIAL: "#eab308", CENTRAL: "#f97316", REGIONAL: "#22c55e", LOCAL: "#64748b", "CASA DE ORACAO": "#ec4899", "ALDEIA INDIGENA": "#06b6d4" })[normalized] || "#64748b";
  };
  const regionColors = {
    SP: "#f59e0b", MG: "#ea580c", ES: "#dc2626", RJ: "#dc2626",
    PR: "#2563eb", SC: "#2563eb", RS: "#2563eb",
    AM: "#059669", PA: "#059669", AC: "#059669", RO: "#059669", RR: "#059669", AP: "#059669", TO: "#059669",
    MA: "#9333ea", PI: "#9333ea", CE: "#9333ea", RN: "#9333ea", PB: "#9333ea", PE: "#9333ea", AL: "#9333ea", SE: "#9333ea", BA: "#9333ea",
    MT: "#0891b2", MS: "#0891b2", GO: "#0891b2", DF: "#0891b2"
  };
  const customPin = (color) => L.divIcon({
    html: `<div style="width:32px;height:40px;filter:drop-shadow(0 2px 3px #0008)"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 36" width="32" height="40" fill="${color}"><path d="M12 0C5.37 0 0 5.37 0 12c0 9 12 24 12 24s12-15 12-24c0-6.63-5.37-12-12-12z" stroke="#ffffff" stroke-width="2"/><circle cx="12" cy="12" r="5" fill="#ffffff"/><circle cx="12" cy="12" r="3" fill="${color}"/></svg></div>`,
    className: "custom-pin-icon", iconSize: [32, 40], iconAnchor: [16, 40], popupAnchor: [0, -36]
  });

  const showMapToast = (message) => {
    let toast = byId("map-toast");
    if (!toast) {
      toast = document.createElement("div");
      toast.id = "map-toast";
      toast.className = "fixed top-20 left-1/2 z-[2200] -translate-x-1/2 rounded-xl border border-slate-700 bg-slate-900/95 px-4 py-2.5 text-xs font-semibold text-white shadow-2xl";
      document.body.appendChild(toast);
    }
    toast.textContent = message;
    clearTimeout(toast.hideTimeout);
    toast.hideTimeout = window.setTimeout(() => toast.remove(), 3500);
  };

  const routeCoordinates = async (from, to, layer, color, map) => {
    const start = [Number(from.latitude), Number(from.longitude)];
    const end = [Number(to.latitude), Number(to.longitude)];
    if (![...start, ...end].every(Number.isFinite) || !validPoint(...start) || !validPoint(...end)) return false;
    layer.clearLayers();
    let latLngs = [start, end];
    try {
      const url = `https://router.project-osrm.org/route/v1/driving/${start[1]},${start[0]};${end[1]},${end[0]}?overview=full&geometries=geojson`;
      const response = await fetch(url);
      const result = await response.json();
      const coordinates = result.routes?.[0]?.geometry?.coordinates;
      if (response.ok && coordinates?.length) latLngs = coordinates.map(([lng, lat]) => [lat, lng]);
    } catch (error) {
      console.warn("OSRM indisponível; exibindo conexão direta.", error);
    }
    const route = L.polyline(latLngs, { color, weight: 5, opacity: 0.9, dashArray: latLngs.length === 2 ? "10, 6" : null }).addTo(layer);
    map.fitBounds(route.getBounds(), { padding: [60, 60], maxZoom: 15 });
    return true;
  };

  const createChurchPopup = (church, map, meshLayer, routeLayer, routeState) => {
    const card = document.createElement("section");
    card.className = "church-card-modal w-80 max-w-[80vw] rounded-xl border border-slate-700 bg-slate-900 p-4 text-xs text-slate-100 shadow-2xl";
    card.innerHTML = `<header class="mb-3 border-b border-slate-800 pb-3"><h3 data-name class="text-sm font-extrabold text-white"></h3><div class="mt-2 flex flex-wrap gap-1.5"><span class="rounded bg-slate-800 px-2 py-1 text-[10px] font-semibold text-slate-300">TOTVS: <b data-code></b></span><span data-porte class="rounded px-2 py-1 text-[10px] font-bold text-white"></span><span data-status class="rounded px-2 py-1 text-[10px] font-bold"></span></div></header><nav class="mb-3 flex gap-1 border-b border-slate-800 text-[10px] font-bold"><button type="button" data-tab="general" class="church-tab border-b-2 border-indigo-400 px-2 py-2 text-indigo-300">Geral</button><button type="button" data-tab="leadership" class="church-tab border-b-2 border-transparent px-2 py-2 text-slate-400">Liderança</button><button type="button" data-tab="assets" class="church-tab border-b-2 border-transparent px-2 py-2 text-slate-400">Patrimônio</button><button type="button" data-tab="history" class="church-tab border-b-2 border-transparent px-2 py-2 text-slate-400">Histórico</button></nav><div class="min-h-24 text-[11px] text-slate-300"><div data-panel="general"><span class="font-bold uppercase text-[9px] text-slate-500">Endereço</span><p data-address class="mt-1 text-slate-100"></p><span class="mt-3 block font-bold uppercase text-[9px] text-slate-500">Coligada a</span><p data-parent class="mt-1 text-slate-100"></p><p data-subordinates class="mt-2 text-indigo-300"></p></div><div data-panel="leadership" class="hidden"><p class="font-bold text-slate-100">Liderança</p><p class="mt-2 text-slate-400">Não há dados de dirigentes no cadastro do mapa.</p></div><div data-panel="assets" class="hidden"><p class="font-bold text-slate-100">Patrimônio vinculado</p><p data-assets class="mt-2 text-slate-400"></p><ul data-asset-items class="mt-2 list-inside list-disc text-slate-400"></ul></div><div data-panel="history" class="hidden"><p class="font-bold text-slate-100">Histórico</p><p class="mt-2 text-slate-400">Não há histórico de atualização disponível.</p></div></div><div class="mt-3 grid grid-cols-2 gap-1.5 border-t border-slate-800 pt-3"><button type="button" data-action="parent-route" class="rounded-lg bg-indigo-700 px-2 py-2 text-[10px] font-bold text-white">🚒 Rota Superior</button><button type="button" data-action="set-origin" class="rounded-lg bg-slate-800 px-2 py-2 text-[10px] font-bold text-white">📍 Definir Origem</button><button type="button" data-action="compare" class="rounded-lg bg-slate-800 px-2 py-2 text-[10px] font-bold text-white">📐 Comparar Rotas</button><button type="button" data-action="mesh" class="rounded-lg bg-slate-800 px-2 py-2 text-[10px] font-bold text-white">🔗 Ver Malha</button><button type="button" data-action="clear" class="rounded-lg bg-slate-800 px-2 py-2 text-[10px] font-bold text-slate-200">Limpar linhas</button><a data-action="google" target="_blank" rel="noopener noreferrer" class="rounded-lg bg-emerald-800 px-2 py-2 text-center text-[10px] font-bold text-white">🗺️ Google Maps</a></div>`;
    const parent = church.parent_church;
    card.querySelector("[data-name]").textContent = church.name || church.nome || "Igreja IPDA";
    card.querySelector("[data-code]").textContent = church.totvs_code || church.codigo_totvs || "—";
    card.querySelector("[data-porte]").textContent = church.porte || "LOCAL";
    card.querySelector("[data-porte]").style.backgroundColor = porteColor(church.porte);
    const status = card.querySelector("[data-status]");
    status.textContent = church.validada ? "VALIDADA" : "PENDENTE";
    status.className += church.validada ? " bg-emerald-500/20 text-emerald-300" : " bg-amber-500/20 text-amber-300";
    card.querySelector("[data-address]").textContent = [church.endereco, church.bairro, [church.municipio, church.estado].filter(Boolean).join(" - "), church.cep ? `CEP ${church.cep}` : null].filter(Boolean).join(", ") || "Endereço não informado";
    card.querySelector("[data-parent]").textContent = parent ? `${parent.name || parent.nome} · ${parent.porte || "SEDE"} · TOTVS ${parent.totvs_code || parent.codigo_totvs || "—"}` : "Sede principal, sem superior vinculado";
    card.querySelector("[data-subordinates]").textContent = `Filiais subordinadas: ${church.subordinates_count || church.subordinates?.length || 0}`;
    const summary = church.asset_summary;
    card.querySelector("[data-assets]").textContent = summary ? `Ano ${summary.year || "—"} · ${summary.item_count || 0} itens` : "Resumo patrimonial indisponível no mapa.";
    (summary?.items || []).slice(0, 5).forEach((item) => { const row = document.createElement("li"); row.textContent = `${item.name} · ${item.quantity || 0} · ${item.conservation || "—"}`; card.querySelector("[data-asset-items]").appendChild(row); });
    card.querySelector('[data-action="google"]').href = `https://www.google.com/maps?q=${encodeURIComponent(`${church.latitude},${church.longitude}`)}`;
    card.querySelectorAll(".church-tab").forEach((tab) => tab.addEventListener("click", () => {
      card.querySelectorAll(".church-tab").forEach((button) => {
        button.classList.toggle("border-indigo-400", button === tab); button.classList.toggle("border-transparent", button !== tab);
        button.classList.toggle("text-indigo-300", button === tab); button.classList.toggle("text-slate-400", button !== tab);
      });
      card.querySelectorAll("[data-panel]").forEach((panel) => panel.classList.toggle("hidden", panel.dataset.panel !== tab.dataset.tab));
    }));
    card.querySelector('[data-action="parent-route"]').addEventListener("click", async () => {
      if (!parent?.latitude || !parent?.longitude) return showMapToast("Esta igreja não possui superior com coordenadas.");
      const found = await routeCoordinates(church, parent, routeLayer, "#6366f1", map);
      if (!found) showMapToast("Não foi possível calcular a rota para a sede.");
    });
    card.querySelector('[data-action="set-origin"]').addEventListener("click", (event) => {
      routeState.origin = church;
      event.currentTarget.textContent = "✓ Origem definida";
      showMapToast(`Origem definida: ${church.name || church.nome || "igreja"}`);
    });
    card.querySelector('[data-action="compare"]').addEventListener("click", async () => {
      if (!routeState.origin) return showMapToast("Defina uma origem antes de comparar as rotas.");
      if (String(routeState.origin.id) === String(church.id)) return showMapToast("Escolha outra igreja como destino.");
      const found = await routeCoordinates(routeState.origin, church, routeLayer, "#10b981", map);
      if (!found) showMapToast("Não foi possível comparar estas rotas.");
    });
    card.querySelector('[data-action="mesh"]').addEventListener("click", (event) => {
      meshLayer.clearLayers();
      const base = [Number(church.latitude), Number(church.longitude)], lines = [];
      if (parent?.latitude != null && parent?.longitude != null && validPoint(Number(parent.latitude), Number(parent.longitude))) lines.push({ point: [Number(parent.latitude), Number(parent.longitude)], color: "#38bdf8" });
      (church.subordinates || []).forEach((child) => { if (child.latitude != null && child.longitude != null && validPoint(Number(child.latitude), Number(child.longitude))) lines.push({ point: [Number(child.latitude), Number(child.longitude)], color: "#eab308" }); });
      lines.forEach(({ point, color }) => L.polyline([base, point], { color, weight: 3, dashArray: "8, 8", opacity: 0.85 }).addTo(meshLayer));
      if (lines.length) map.fitBounds(L.latLngBounds([base, ...lines.map(({ point }) => point)]), { padding: [50, 50], maxZoom: 13 });
      event.currentTarget.textContent = lines.length ? "🔗 Malha exibida" : "Sem vínculos na malha";
    });
    card.querySelector('[data-action="clear"]').addEventListener("click", () => { meshLayer.clearLayers(); routeLayer.clearLayers(); showMapToast("Linhas removidas do mapa."); });
    return card;
  };

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
        cluster.getAllChildMarkers().forEach((marker) => {
          const state = (marker.options.state || "SP").toUpperCase().trim();
          counts.set(state, (counts.get(state) || 0) + 1);
        });
        const state = [...counts].sort((a, b) => b[1] - a[1])[0]?.[0] || "SP";
        const count = cluster.getChildCount();
        const color = regionColors[state] || "#f59e0b";
        return L.divIcon({ html: `<div style="background-color:${color};width:48px;height:48px;display:flex;align-items:center;justify-content:center;border:4px solid #fff;border-radius:50%;color:#fff;font-weight:800;font-size:14px;box-shadow:0 2px 8px #0008">${count}</div>`, className: "custom-cluster-icon", iconSize: [48, 48] });
      }
    }) : L.featureGroup();
    group.addTo(map);
    const meshLayerGroup = L.layerGroup().addTo(map);
    const routeLayerGroup = L.layerGroup().addTo(map);
    const routeState = { origin: null };
    const mapStatus = document.createElement("div");
    mapStatus.className = "absolute left-4 top-20 z-[1100] hidden max-w-sm rounded-xl border px-4 py-3 text-xs font-semibold shadow-xl";
    mapStatus.setAttribute("role", "status");
    mapStatus.setAttribute("aria-live", "polite");
    element.appendChild(mapStatus);
    const setMapStatus = (message, isError = false) => {
      mapStatus.textContent = message;
      mapStatus.classList.toggle("hidden", !message);
      mapStatus.classList.toggle("border-amber-500/40", !isError);
      mapStatus.classList.toggle("bg-slate-900/95", !isError);
      mapStatus.classList.toggle("text-slate-100", !isError);
      mapStatus.classList.toggle("border-red-500/50", isError);
      mapStatus.classList.toggle("bg-red-950/95", isError);
      mapStatus.classList.toggle("text-red-100", isError);
    };

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
        if (!Array.isArray(churches)) throw new Error(churches.error || "A resposta do mapa veio em formato inválido.");
        if (requestId !== markerRequestId) return;
        group.clearLayers();
        setMapStatus("");
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
            const marker = L.marker([lat, lng], { icon: iconCache.get(color), porte, state: (church.estado || "SP").toUpperCase().trim() });
            marker.bindPopup(() => createChurchPopup(church, map, meshLayerGroup, routeLayerGroup, routeState), { className: "dark-custom-popup", maxWidth: 420 });
            markers.push(marker);
          }
          if (typeof group.addLayers === "function") group.addLayers(markers);
          else markers.forEach((marker) => group.addLayer(marker));
          if (index < churches.length) {
            window.setTimeout(processBatch, 0);
          } else if (resetView) {
            map.flyTo([-14.235, -51.9253], 4);
            if (!bounds.length) setMapStatus(churches.length ? "Os registros chegaram, mas não há coordenadas válidas para exibir." : "A API respondeu, mas não encontrou igrejas com coordenadas para o mapa.");
          } else if (bounds.length === 1) {
            setMapStatus("");
            map.flyTo(bounds[0], 16);
            group.eachLayer((marker) => marker.getLatLng().equals(bounds[0]) && marker.openPopup());
          } else if (bounds.length) {
            setMapStatus("");
            map.fitBounds(bounds, { padding: [30, 30], maxZoom: 13 });
          } else {
            setMapStatus(churches.length ? "Os registros chegaram, mas não há coordenadas válidas para exibir." : "A API respondeu, mas não encontrou igrejas com coordenadas para o mapa.");
          }
        };
        processBatch();
      } catch (error) {
        console.error(error);
        setMapStatus(error.message || "Falha ao carregar os dados do mapa.", true);
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
