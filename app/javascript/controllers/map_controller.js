import { Controller } from "@hotwired/stimulus"

export default class extends Controller {
  static targets = [ "mapContainer", "filterModal", "filterToggle", "porteFilter", "estadoFilter", "validadaFilter", "searchInput", "clearSearch" ]

  connect() {
    this.markerRequestId = 0
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
          const porte = marker.options.porte || ""
          counts.set(porte, (counts.get(porte) || 0) + 1)
        })
        const porte = [...counts].sort((a, b) => b[1] - a[1])[0]?.[0]
        const color = this.porteColor(porte)
        const count = cluster.getChildCount()
        const size = count < 10 ? 38 : count < 100 ? 44 : 52
        return L.divIcon({ html: `<span style="display:flex;align-items:center;justify-content:center;background:${color};color:#fff;font-weight:800;border:3px solid #fff;border-radius:50%;width:${size}px;height:${size}px;box-shadow:0 2px 8px #0008">${count}</span>`, className: "church-marker-cluster", iconSize: [size, size] })
      }
    })
    this.map.addLayer(this.markerCluster)

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

      // Clear existing markers
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
          const marker = L.marker([lat, lng], { icon: this.createCustomPin(this.porteColor(porte)) })
          marker.options.porte = porte
          marker.bindPopup(() => {
            const content = document.createElement("div")
            const addPopupLine = (label, value, strong = false) => {
              const line = document.createElement("div")
              line.textContent = `${label}: ${value || "—"}`
              if (strong) {
                const title = document.createElement("strong")
                title.textContent = line.textContent
                line.replaceChildren(title)
              }
              content.appendChild(line)
            }
            addPopupLine("Código TOTVS", loc.codigo_totvs || loc.totvs_code, true)
            addPopupLine("Nome da Igreja", loc.nome || loc.desc_igreja || loc.name || "Igreja IPDA")
            addPopupLine("Porte", loc.porte || "---")
            addPopupLine("Município/UF", [loc.municipio, loc.estado].filter(Boolean).join("/"))
            addPopupLine("Endereço", loc.endereco)
            return content
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

  clearFilters() {
    if (this.hasPorteFilterTarget) this.porteFilterTarget.value = ""
    if (this.hasEstadoFilterTarget) this.estadoFilterTarget.value = ""
    if (this.hasValidadaFilterTarget) this.validadaFilterTarget.value = ""
    if (this.hasSearchInputTarget) this.searchInputTarget.value = ""
    if (this.hasClearSearchTarget) this.clearSearchTarget.classList.add("hidden")
    if (this.hasFilterModalTarget) this.filterModalTarget.classList.add("hidden")
    if (this.hasFilterToggleTarget) this.filterToggleTarget.setAttribute("aria-expanded", "false")
    this.loadMarkers("", { resetView: true })
  }

  clearSearch() {
    if (this.hasSearchInputTarget) this.searchInputTarget.value = ""
    if (this.hasClearSearchTarget) this.clearSearchTarget.classList.add("hidden")
    clearTimeout(this.searchTimeout)
    this.loadMarkers("", { resetView: true })
  }

  search() {
    const query = this.hasSearchInputTarget ? this.searchInputTarget.value.trim() : ""
    if (this.hasClearSearchTarget) this.clearSearchTarget.classList.toggle("hidden", query.length === 0)
    clearTimeout(this.searchTimeout)
    if (!query) {
      this.loadMarkers("", { resetView: true })
    } else {
      this.searchTimeout = setTimeout(() => this.applyFilters(), 250)
    }
  }
}
