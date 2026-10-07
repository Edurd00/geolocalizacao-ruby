import { Controller } from "@hotwired/stimulus"

export default class extends Controller {
  static targets = [ "mapContainer", "filterModal", "filterToggle", "porteFilter", "estadoFilter", "validadaFilter", "searchInput", "clearSearch", "clearSearchBtn" ]

  connect() {
    this.markerRequestId = 0
    this.activeMeshChurchId = null
    this.originLocation = null
    this.initMap()
    this.loadMarkers()
    this.handleResize = () => this.map && this.map.invalidateSize()
    window.addEventListener('resize', this.handleResize)
    this.invalidateTimeout = setTimeout(() => this.map?.invalidateSize(), 250)
  }

  disconnect() {
    window.removeEventListener('resize', this.handleResize)
    clearTimeout(this.searchTimeout)
    clearTimeout(this.invalidateTimeout)
    clearTimeout(this.toastTimeout)
    if (this.map) {
      this.map.remove()
      this.map = null
    }
  }

  initMap() {
    const esriSat = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
      maxZoom: 19,
      attribution: 'Tiles &copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AERO, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community'
    })
    const esriLabels = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}', { maxZoom: 19 })
    const esriRoads = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Transportation/MapServer/tile/{z}/{y}/{x}', { maxZoom: 19 })
    const satelliteHybrid = L.layerGroup([esriSat, esriLabels, esriRoads])
    const osmLayer = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; OpenStreetMap contributors'
    })

    const mapElement = this.hasMapContainerTarget ? this.mapContainerTarget : this.element

    this.map = L.map(mapElement, {
      center: [-14.2350, -51.9253],
      zoom: 4,
      layers: [satelliteHybrid]
    })

    L.control.layers({ "Satélite (com Ruas e Divisas)": satelliteHybrid, "Mapa Vetorial (OSM)": osmLayer }, null, { position: 'topright' }).addTo(this.map)

    this.markerCluster = L.markerClusterGroup({
      chunkedLoading: false,
      animate: false,
      animateAddingMarkers: false,
      removeOutsideVisibleBounds: true,
      iconCreateFunction: (cluster) => {
        const counts = new Map()
        cluster.getAllChildMarkers().forEach((marker) => {
          const state = (marker.options.state || "SP").toUpperCase().trim()
          counts.set(state, (counts.get(state) || 0) + 1)
        })
        const state = [...counts].sort((a, b) => b[1] - a[1])[0]?.[0] || "SP"
        const color = this.RegionColors[state] || "#f59e0b"
        const count = cluster.getChildCount()
        return L.divIcon({ html: `<div style="background-color:${color}" class="flex h-12 w-12 items-center justify-center rounded-full border-4 border-white text-sm font-extrabold text-white shadow-xl drop-shadow-lg">${count}</div>`, className: "custom-cluster-icon", iconSize: [48, 48] })
      }
    })
    this.map.addLayer(this.markerCluster)

    // Camadas para Malha e Rotas
    this.meshLayerGroup = L.layerGroup().addTo(this.map)
    this.routeLayerGroup = L.layerGroup().addTo(this.map)

    setTimeout(() => {
      if (this.map) {
        this.map.invalidateSize()
      }
    }, 250)
  }

  get PorteColors() {
    return {
      ESTADUAL: "#3b82f6",
      SETORIAL: "#eab308",
      CENTRAL: "#f97316",
      REGIONAL: "#22c55e",
      LOCAL: "#64748b",
      "CASA DE ORAÇÃO": "#ec4899",
      "ALDEIA INDÍGENA": "#06b6d4"
    }
  }

  get RegionColors() {
    return {
      SP: "#f59e0b", MG: "#ea580c", ES: "#dc2626", RJ: "#dc2626",
      PR: "#2563eb", SC: "#2563eb", RS: "#2563eb",
      AM: "#059669", PA: "#059669", AC: "#059669", RO: "#059669", RR: "#059669", AP: "#059669", TO: "#059669",
      MA: "#9333ea", PI: "#9333ea", CE: "#9333ea", RN: "#9333ea", PB: "#9333ea", PE: "#9333ea", AL: "#9333ea", SE: "#9333ea", BA: "#9333ea",
      MT: "#0891b2", MS: "#0891b2", GO: "#0891b2", DF: "#0891b2"
    }
  }

  porteColor(porte) {
    const normalized = (porte || "LOCAL").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase().trim()
    const entry = Object.entries(this.PorteColors).find(([name]) => name.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase() === normalized)
    return entry?.[1] || "#64748b"
  }

  createCustomPin(color) {
    this.pinIconCache ||= new Map()
    if (this.pinIconCache.has(color)) return this.pinIconCache.get(color)
    const svgHtml = `<div style="width:32px;height:40px;filter:drop-shadow(0 2px 3px #0008)"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 36" width="32" height="40" fill="${color}"><path d="M12 0C5.37 0 0 5.37 0 12c0 9 12 24 12 24s12-15 12-24c0-6.63-5.37-12-12-12z" stroke="#ffffff" stroke-width="2"/><circle cx="12" cy="12" r="5" fill="#ffffff"/><circle cx="12" cy="12" r="3" fill="${color}"/></svg></div>`
    const icon = L.divIcon({ html: svgHtml, className: "custom-pin-icon", iconSize: [32, 40], iconAnchor: [16, 40], popupAnchor: [0, -36] })
    this.pinIconCache.set(color, icon)
    return icon
  }

  async loadMarkers(params = "", { resetView = false } = {}) {
    const requestId = ++this.markerRequestId
    try {
      const response = await fetch(`/map/locations${params}`, { headers: { Accept: "application/json" } })
      if (!response.ok) throw new Error(`Falha ao carregar locais (${response.status})`)
      const locations = await response.json()
      if (requestId !== this.markerRequestId) return

      if (this.markerCluster) {
        this.markerCluster.clearLayers()
      }

      const bounds = L.latLngBounds()
      const markers = []
      let index = 0
      const processBatch = () => {
        if (requestId !== this.markerRequestId || !this.map) return
        const batch = []
        const batchEnd = Math.min(index + 400, locations.length)
        for (; index < batchEnd; index += 1) {
          const loc = locations[index]
          const lat = parseFloat(loc.latitude)
          const lng = parseFloat(loc.longitude)
          if (isNaN(lat) || isNaN(lng) || lat === 0 || lng === 0) continue

          bounds.extend([lat, lng])
          const porte = (loc.porte || "LOCAL").toUpperCase().trim()
          const state = (loc.estado || "SP").toUpperCase().trim()
          const marker = L.marker([lat, lng], { icon: this.createCustomPin(this.porteColor(porte)), state })
          marker.options.porte = porte

          marker.bindPopup(() => this.createChurchModalContent(loc), {
            className: "dark-custom-popup",
            maxWidth: 420
          })

          batch.push(marker)
          markers.push(marker)
        }
        this.markerCluster.addLayers(batch)

        if (index < locations.length) {
          window.setTimeout(processBatch, 0)
        } else if (resetView) {
          this.map.flyTo([-14.2350, -51.9253], 4)
        } else if (bounds.isValid()) {
          if (markers.length === 1) {
            const center = bounds.getCenter()
            this.map.flyTo([center.lat, center.lng], 16)
            window.setTimeout(() => markers[0].openPopup(), 500)
          } else {
            this.map.fitBounds(bounds, { padding: [50, 50] })
          }
        }
      }
      processBatch()
    } catch (e) {
      console.error("Erro ao carregar locais:", e)
    }
  }

  createChurchModalContent(loc) {
    const container = document.createElement("div")
    container.className = "church-card-modal w-80 sm:w-96 p-4 rounded-xl bg-slate-900 text-slate-100 border border-slate-800 shadow-2xl font-sans text-xs select-none"

    const name = loc.name || loc.nome || "Igreja IPDA"
    const totvsCode = loc.totvs_code || loc.codigo_totvs || "N/A"
    const porte = loc.porte || "LOCAL"
    const porteColor = this.porteColor(porte)
    const parent = loc.parent_church
    const subCount = loc.subordinates_count || (loc.subordinates ? loc.subordinates.length : 0)

    const fullAddress = [
      loc.endereco,
      loc.bairro,
      [loc.municipio, loc.estado].filter(Boolean).join(" - "),
      loc.cep ? `CEP ${loc.cep}` : null
    ].filter(Boolean).join(", ") || "Endereço não informado"

    const parentInfo = parent
      ? `${parent.name || parent.nome} (${parent.porte || 'SEDE'}) [TOTVS: ${parent.totvs_code || parent.codigo_totvs || '—'}]`
      : "Sede Principal / Matriz (Sem Superior)"

    const isMeshActive = this.activeMeshChurchId === loc.id

    container.innerHTML = `
      <!-- Cabeçalho -->
      <div class="flex items-start justify-between gap-2 border-b border-slate-800 pb-3 mb-3">
        <div class="flex-1 min-w-0">
          <h3 class="font-extrabold text-sm text-white truncate leading-snug">${name}</h3>
          <div class="flex flex-wrap items-center gap-1.5 mt-1.5">
            <span class="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold bg-slate-800 text-slate-300 border border-slate-700">
              TOTVS: ${totvsCode}
            </span>
            <span class="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold text-white shadow-xs" style="background-color: ${porteColor}">
              ${porte}
            </span>
            ${loc.validada ? '<span class="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">VALIDADA</span>' : '<span class="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold bg-amber-500/20 text-amber-400 border border-amber-500/30">PENDENTE</span>'}
          </div>
        </div>
      </div>

      <!-- Navegação em Abas -->
      <div class="flex border-b border-slate-800 mb-3 text-[11px] font-medium text-slate-400 gap-1">
        <button type="button" class="modal-tab-btn active px-2.5 py-1.5 border-b-2 border-indigo-500 text-indigo-400 font-bold transition-colors" data-tab="geral">Geral</button>
        <button type="button" class="modal-tab-btn px-2.5 py-1.5 border-b-2 border-transparent hover:text-slate-200 transition-colors" data-tab="lideranca">Liderança</button>
        <button type="button" class="modal-tab-btn px-2.5 py-1.5 border-b-2 border-transparent hover:text-slate-200 transition-colors" data-tab="patrimonio">Patrimônio</button>
        <button type="button" class="modal-tab-btn px-2.5 py-1.5 border-b-2 border-transparent hover:text-slate-200 transition-colors" data-tab="historico">Histórico</button>
      </div>

      <!-- Conteúdo das Abas -->
      <div class="modal-tab-content min-h-[90px] mb-3 text-[11px] text-slate-300">
        <!-- Aba Geral -->
        <div class="modal-pane pane-geral space-y-2">
          <div>
            <span class="text-slate-500 font-semibold uppercase text-[10px] block">Endereço Completo</span>
            <p class="text-slate-200 leading-snug">${fullAddress}</p>
          </div>
          <div>
            <span class="text-slate-500 font-semibold uppercase text-[10px] block">Coligada a</span>
            <p class="text-slate-200 font-medium">${parentInfo}</p>
          </div>
          ${subCount > 0 ? `
          <div>
            <span class="text-slate-500 font-semibold uppercase text-[10px] block">Filiais Subordinadas</span>
            <p class="text-indigo-400 font-medium">${subCount} igreja(s) respondem a esta sede</p>
          </div>` : ''}
        </div>

        <!-- Aba Liderança -->
        <div class="modal-pane pane-lideranca hidden space-y-2">
          <div>
            <span class="text-slate-500 font-semibold uppercase text-[10px] block">Pastor / Dirigente Responsável</span>
            <p class="text-slate-200 font-medium">Pr. Responsável - Convenção ${loc.estado || 'Geral'}</p>
          </div>
          <div>
            <span class="text-slate-500 font-semibold uppercase text-[10px] block">Supervisão Regional</span>
            <p class="text-slate-300">Coordenadoria IPDA - Região ${loc.estado || 'SP'}</p>
          </div>
        </div>

        <!-- Aba Patrimônio -->
        <div class="modal-pane pane-patrimonio hidden space-y-2">
          <div>
            <span class="text-slate-500 font-semibold uppercase text-[10px] block">Resumo do Patrimônio</span>
            <div class="bg-slate-950 p-2 rounded border border-slate-800 flex justify-between items-center mt-1">
              <span>Inventário Registrado</span>
              <span class="font-bold text-indigo-400">Ativo / Regular</span>
            </div>
          </div>
          <div>
            <span class="text-slate-500 font-semibold uppercase text-[10px] block">Situação Imobiliária</span>
            <span class="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">Imóvel Cadastrado</span>
          </div>
        </div>

        <!-- Aba Histórico -->
        <div class="modal-pane pane-historico hidden space-y-2">
          <div>
            <span class="text-slate-500 font-semibold uppercase text-[10px] block">Histórico de Atualizações</span>
            <p class="text-slate-300">Cadastro de localização georreferenciada e validação de malha territorial.</p>
          </div>
          <div>
            <span class="text-slate-500 font-semibold uppercase text-[10px] block">Status de Auditoria</span>
            <p class="${loc.validada ? 'text-emerald-400' : 'text-amber-400'} font-medium">
              ${loc.validada ? 'Auditado e Validado' : 'Aguardando Validação Regional'}
            </p>
          </div>
        </div>
      </div>

      <!-- Grid de Botões de Ação -->
      <div class="grid grid-cols-2 gap-1.5 pt-2 border-t border-slate-800 text-[11px]">
        <button type="button" class="btn-action btn-rota-superior flex items-center justify-center gap-1.5 py-1.5 px-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded border border-slate-700 transition font-medium">
          <span>🚒</span> Rota Superior
        </button>
        <button type="button" class="btn-action btn-definir-origem flex items-center justify-center gap-1.5 py-1.5 px-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded border border-slate-700 transition font-medium">
          <span>📍</span> Definir Origem
        </button>
        <button type="button" class="btn-action btn-comparar-rotas flex items-center justify-center gap-1.5 py-1.5 px-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded border border-slate-700 transition font-medium">
          <span>📐</span> Comparar Rotas
        </button>
        <button type="button" class="btn-action btn-ver-malha flex items-center justify-center gap-1.5 py-1.5 px-2 ${isMeshActive ? 'bg-red-950/80 hover:bg-red-900 text-red-300 border-red-800/60' : 'bg-indigo-950/80 hover:bg-indigo-900 text-indigo-300 border-indigo-700/60'} rounded border transition font-semibold">
          <span>${isMeshActive ? '❌' : '🔗'}</span> ${isMeshActive ? 'Limpar Malha' : 'Ver Malha'}
        </button>
        <button type="button" class="btn-action btn-gmaps col-span-2 flex items-center justify-center gap-1.5 py-1.5 px-2 bg-emerald-950/80 hover:bg-emerald-900 text-emerald-300 rounded border border-emerald-800/60 transition font-semibold">
          <span>🗺️</span> Abrir no Google Maps
        </button>
      </div>
    `

    // Tab Event Listeners
    const tabBtns = container.querySelectorAll(".modal-tab-btn")
    const tabPanes = container.querySelectorAll(".modal-pane")
    tabBtns.forEach(btn => {
      btn.addEventListener("click", (e) => {
        e.preventDefault()
        const selectedTab = btn.getAttribute("data-tab")
        tabBtns.forEach(b => {
          b.classList.remove("active", "border-indigo-500", "text-indigo-400", "font-bold")
          b.classList.add("border-transparent", "text-slate-400")
        })
        btn.classList.add("active", "border-indigo-500", "text-indigo-400", "font-bold")
        btn.classList.remove("border-transparent", "text-slate-400")

        tabPanes.forEach(pane => {
          if (pane.classList.contains(`pane-${selectedTab}`)) {
            pane.classList.remove("hidden")
          } else {
            pane.classList.add("hidden")
          }
        })
      })
    })

    // Action Buttons Event Listeners
    const btnRotaSuperior = container.querySelector(".btn-rota-superior")
    if (btnRotaSuperior) {
      btnRotaSuperior.addEventListener("click", (e) => {
        e.preventDefault()
        this.handleRotaSuperior(loc)
      })
    }

    const btnDefinirOrigem = container.querySelector(".btn-definir-origem")
    if (btnDefinirOrigem) {
      btnDefinirOrigem.addEventListener("click", (e) => {
        e.preventDefault()
        this.handleDefinirOrigem(loc)
      })
    }

    const btnCompararRotas = container.querySelector(".btn-comparar-rotas")
    if (btnCompararRotas) {
      btnCompararRotas.addEventListener("click", (e) => {
        e.preventDefault()
        this.handleCompararRotas(loc)
      })
    }

    const btnVerMalha = container.querySelector(".btn-ver-malha")
    if (btnVerMalha) {
      btnVerMalha.addEventListener("click", (e) => {
        e.preventDefault()
        this.handleVerMalha(loc, btnVerMalha)
      })
    }

    const btnGmaps = container.querySelector(".btn-gmaps")
    if (btnGmaps) {
      btnGmaps.addEventListener("click", (e) => {
        e.preventDefault()
        const lat = loc.latitude
        const lng = loc.longitude
        window.open(`https://www.google.com/maps?q=${lat},${lng}`, "_blank")
      })
    }

    return container
  }

  handleVerMalha(loc, btnElement) {
    if (this.activeMeshChurchId === loc.id) {
      this.clearMesh()
      if (btnElement) {
        btnElement.innerHTML = `<span>🔗</span> Ver Malha`
        btnElement.classList.remove("bg-red-950/80", "text-red-300", "border-red-800/60")
        btnElement.classList.add("bg-indigo-950/80", "text-indigo-300", "border-indigo-700/60")
      }
      return
    }

    this.clearMesh()
    this.activeMeshChurchId = loc.id

    if (btnElement) {
      btnElement.innerHTML = `<span>❌</span> Limpar Malha`
      btnElement.classList.remove("bg-indigo-950/80", "text-indigo-300", "border-indigo-700/60")
      btnElement.classList.add("bg-red-950/80", "text-red-300", "border-red-800/60")
    }

    const bounds = L.latLngBounds()
    const currentLat = parseFloat(loc.latitude)
    const currentLng = parseFloat(loc.longitude)

    if (isNaN(currentLat) || isNaN(currentLng)) return
    bounds.extend([currentLat, currentLng])

    // 1. Linha de Subida (Sede/Superior)
    const parent = loc.parent_church
    if (parent && parent.latitude && parent.longitude) {
      const parentLat = parseFloat(parent.latitude)
      const parentLng = parseFloat(parent.longitude)
      if (!isNaN(parentLat) && !isNaN(parentLng)) {
        bounds.extend([parentLat, parentLng])
        L.polyline([[currentLat, currentLng], [parentLat, parentLng]], {
          color: "#38bdf8",
          weight: 3,
          dashArray: "8, 8",
          opacity: 0.8
        }).addTo(this.meshLayerGroup)
      }
    }

    // 2. Linhas de Descida (Filiais/Subordinadas)
    if (loc.subordinates && Array.isArray(loc.subordinates)) {
      loc.subordinates.forEach(sub => {
        const subLat = parseFloat(sub.latitude)
        const subLng = parseFloat(sub.longitude)
        if (!isNaN(subLat) && !isNaN(subLng)) {
          bounds.extend([subLat, subLng])
          L.polyline([[currentLat, currentLng], [subLat, subLng]], {
            color: "#eab308",
            weight: 2,
            dashArray: "6, 6",
            opacity: 0.8
          }).addTo(this.meshLayerGroup)
        }
      })
    }

    if (bounds.isValid() && this.map) {
      this.map.fitBounds(bounds, { padding: [60, 60] })
    }
  }

  clearMesh() {
    this.activeMeshChurchId = null
    if (this.meshLayerGroup) {
      this.meshLayerGroup.clearLayers()
    }
  }

  async handleRotaSuperior(loc) {
    const parent = loc.parent_church
    if (!parent || !parent.latitude || !parent.longitude) {
      this.showToast("Esta igreja não possui igreja sede/superior vinculada.")
      return
    }

    const startLat = parseFloat(loc.latitude)
    const startLng = parseFloat(loc.longitude)
    const endLat = parseFloat(parent.latitude)
    const endLng = parseFloat(parent.longitude)

    if (isNaN(startLat) || isNaN(startLng) || isNaN(endLat) || isNaN(endLng)) return

    if (this.routeLayerGroup) {
      this.routeLayerGroup.clearLayers()
    }

    this.showToast(`Calculando rota até a sede (${parent.name || parent.nome})...`)

    try {
      const osrmUrl = `https://router.project-osrm.org/route/v1/driving/${startLng},${startLat};${endLng},${endLat}?overview=full&geometries=geojson`
      const res = await fetch(osrmUrl)
      if (res.ok) {
        const data = await res.json()
        if (data.routes && data.routes[0] && data.routes[0].geometry) {
          const coordinates = data.routes[0].geometry.coordinates.map(coord => [coord[1], coord[0]])
          const routePolyline = L.polyline(coordinates, {
            color: "#6366f1",
            weight: 5,
            opacity: 0.9
          }).addTo(this.routeLayerGroup)

          const bounds = routePolyline.getBounds()
          if (bounds.isValid() && this.map) {
            this.map.fitBounds(bounds, { padding: [60, 60] })
          }

          const distKm = (data.routes[0].distance / 1000).toFixed(1)
          const durationMin = Math.round(data.routes[0].duration / 60)
          this.showToast(`Rota até ${parent.name || parent.nome}: ${distKm} km (~${durationMin} min)`)
          return
        }
      }
    } catch (err) {
      console.warn("Erro no OSRM, usando linha direta:", err)
    }

    // Fallback: Linha direta se OSRM indisponível
    const fallbackPolyline = L.polyline([[startLat, startLng], [endLat, endLng]], {
      color: "#6366f1",
      weight: 4,
      dashArray: "10, 5",
      opacity: 0.9
    }).addTo(this.routeLayerGroup)

    const bounds = fallbackPolyline.getBounds()
    if (bounds.isValid() && this.map) {
      this.map.fitBounds(bounds, { padding: [60, 60] })
    }
  }

  handleDefinirOrigem(loc) {
    this.originLocation = loc
    this.showToast(`Origem definida: ${loc.name || loc.nome}`)
  }

  handleCompararRotas(loc) {
    if (!this.originLocation) {
      this.showToast("Por favor, defina uma igreja como Origem primeiro.")
      return
    }
    this.showToast(`Comparando rotas de [${this.originLocation.name || this.originLocation.nome}] até [${loc.name || loc.nome}]`)
    this.drawRouteBetween(this.originLocation, loc)
  }

  async drawRouteBetween(origin, destination) {
    if (!origin || !destination) return
    const startLat = parseFloat(origin.latitude)
    const startLng = parseFloat(origin.longitude)
    const endLat = parseFloat(destination.latitude)
    const endLng = parseFloat(destination.longitude)

    if (isNaN(startLat) || isNaN(startLng) || isNaN(endLat) || isNaN(endLng)) return

    if (this.routeLayerGroup) {
      this.routeLayerGroup.clearLayers()
    }

    try {
      const osrmUrl = `https://router.project-osrm.org/route/v1/driving/${startLng},${startLat};${endLng},${endLat}?overview=full&geometries=geojson`
      const res = await fetch(osrmUrl)
      if (res.ok) {
        const data = await res.json()
        if (data.routes && data.routes[0] && data.routes[0].geometry) {
          const coordinates = data.routes[0].geometry.coordinates.map(coord => [coord[1], coord[0]])
          const routePolyline = L.polyline(coordinates, {
            color: "#10b981",
            weight: 5,
            opacity: 0.9
          }).addTo(this.routeLayerGroup)

          const bounds = routePolyline.getBounds()
          if (bounds.isValid() && this.map) {
            this.map.fitBounds(bounds, { padding: [60, 60] })
          }

          const distKm = (data.routes[0].distance / 1000).toFixed(1)
          const durationMin = Math.round(data.routes[0].duration / 60)
          this.showToast(`Trajeto [${origin.name || origin.nome}] ➔ [${destination.name || destination.nome}]: ${distKm} km (~${durationMin} min)`)
          return
        }
      }
    } catch (e) {
      console.warn("Erro OSRM:", e)
    }

    const fallbackPolyline = L.polyline([[startLat, startLng], [endLat, endLng]], {
      color: "#10b981",
      weight: 4,
      opacity: 0.8
    }).addTo(this.routeLayerGroup)
    this.map.fitBounds(fallbackPolyline.getBounds(), { padding: [60, 60] })
  }

  showToast(message) {
    let toast = document.getElementById("map-toast")
    if (!toast) {
      toast = document.createElement("div")
      toast.id = "map-toast"
      toast.className = "fixed top-20 left-1/2 -translate-x-1/2 z-[2000] bg-slate-900/95 text-white text-xs font-semibold px-4 py-2.5 rounded-xl border border-slate-700 shadow-2xl transition-all duration-300 opacity-0 pointer-events-none"
      document.body.appendChild(toast)
    }
    toast.textContent = message
    toast.classList.remove("opacity-0", "pointer-events-none")
    toast.classList.add("opacity-100")

    clearTimeout(this.toastTimeout)
    this.toastTimeout = setTimeout(() => {
      toast.classList.add("opacity-0", "pointer-events-none")
      toast.classList.remove("opacity-100")
    }, 3500)
  }

  toggleFilters() {
    if (this.hasFilterModalTarget) {
      const open = this.filterModalTarget.classList.contains("hidden")
      this.filterModalTarget.classList.toggle("hidden", !open)
      if (this.hasFilterToggleTarget) this.filterToggleTarget.setAttribute("aria-expanded", String(open))
    }
  }

  applyFilters() {
    const porte = this.hasPorteFilterTarget ? this.porteFilterTarget.value : ""
    const estado = this.hasEstadoFilterTarget ? this.estadoFilterTarget.value : ""
    const validada = this.hasValidadaFilterTarget ? this.validadaFilterTarget.value : ""
    const query = this.hasSearchInputTarget ? this.searchInputTarget.value.trim() : ""
    const paramsObj = {}
    if (porte) paramsObj.porte = porte
    if (estado) paramsObj.estado = estado
    if (validada) paramsObj.validada = validada
    if (query.length >= 2) paramsObj.query = query

    const queryString = new URLSearchParams(paramsObj).toString()
    this.loadMarkers(queryString ? `?${queryString}` : "")
  }

  get clearSearchBtnElement() {
    if (this.hasClearSearchBtnTarget) return this.clearSearchBtnTarget
    if (this.hasClearSearchTarget) return this.clearSearchTarget
    return null
  }

  clearFilters() {
    if (this.hasPorteFilterTarget) this.porteFilterTarget.value = ""
    if (this.hasEstadoFilterTarget) this.estadoFilterTarget.value = ""
    if (this.hasValidadaFilterTarget) this.validadaFilterTarget.value = ""
    if (this.hasSearchInputTarget) this.searchInputTarget.value = ""
    if (this.clearSearchBtnElement) this.clearSearchBtnElement.classList.add("hidden")
    if (this.hasFilterModalTarget) this.filterModalTarget.classList.add("hidden")
    if (this.hasFilterToggleTarget) this.filterToggleTarget.setAttribute("aria-expanded", "false")
    this.loadMarkers("", { resetView: true })
  }

  clearSearch() {
    if (this.hasSearchInputTarget) this.searchInputTarget.value = ""
    if (this.clearSearchBtnElement) this.clearSearchBtnElement.classList.add("hidden")
    clearTimeout(this.searchTimeout)
    this.applyFilters()
    if (this.map) {
      this.map.flyTo([-14.2350, -51.9253], 4)
    }
  }

  search() {
    const query = this.hasSearchInputTarget ? this.searchInputTarget.value.trim() : ""
    if (this.clearSearchBtnElement) this.clearSearchBtnElement.classList.toggle("hidden", query.length === 0)
    clearTimeout(this.searchTimeout)
    if (!query) {
      this.loadMarkers("", { resetView: true })
    } else {
      this.searchTimeout = setTimeout(() => this.applyFilters(), 250)
    }
  }
}
