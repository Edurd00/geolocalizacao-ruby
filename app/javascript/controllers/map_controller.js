import { Controller } from "@hotwired/stimulus"

export default class extends Controller {
  static targets = [ "mapContainer", "filterModal", "porteFilter", "validadaFilter", "searchInput" ]

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
    const esriSat = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', { maxZoom: 19 })
    const osmLayer = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19 })

    const mapElement = this.hasMapContainerTarget ? this.mapContainerTarget : this.element

    this.map = L.map(mapElement, {
      center: [-14.2350, -51.9253],
      zoom: 4,
      layers: [esriSat]
    })

    L.control.layers({ "Satélite Esri": esriSat, "Mapa (OSM)": osmLayer }).addTo(this.map)
    this.markerCluster = L.markerClusterGroup({
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

  porteColor(porte) {
    const normalizedPorte = (porte || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase().trim()
    const colors = { ESTADUAL: "#3b82f6", SETORIAL: "#f59e0b", CENTRAL: "#f97316", REGIONAL: "#10b981", LOCAL: "#a855f7", "CASA DE ORACAO": "#ec4899", "ALDEIA INDIGENA": "#22d3ee" }
    return colors[normalizedPorte] || "#6b7280"
  }

  async loadMarkers(params = "") {
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

      const createIcon = (porte) => {
        const color = this.porteColor(porte)
        const html = `<span style="display:block;background-color:${color};width:20px;height:20px;border-radius:50%;border:2px solid white;box-shadow:0 1px 4px #0009"></span>`
        return L.divIcon({ html, className: "church-marker-icon", iconSize: [24, 24], iconAnchor: [12, 12], popupAnchor: [0, -12] })
      }

      locations.forEach(loc => {
        const lat = parseFloat(loc.latitude)
        const lng = parseFloat(loc.longitude)
        if (!isNaN(lat) && !isNaN(lng) && lat !== 0 && lng !== 0) {
          bounds.extend([lat, lng])
          const icon = createIcon(loc.porte)
          const marker = L.marker([lat, lng], { icon })
          marker.options.porte = loc.porte

          const nome = loc.nome || loc.desc_igreja || loc.name || 'Igreja IPDA'
          const totvs = loc.codigo_totvs || loc.totvs_code || '-'
          const porte = loc.porte || '---'
          const municipio = loc.municipio || ''
          const estado = loc.estado || ''
          const endereco = loc.endereco || ''

          const popupContent = document.createElement("div")
          const addPopupLine = (label, value, strong = false) => {
            const line = document.createElement("div")
            if (strong) {
              const title = document.createElement("strong")
              title.textContent = `${label}: ${value}`
              line.appendChild(title)
            } else {
              line.textContent = `${label}: ${value}`
            }
            popupContent.appendChild(line)
          }
          addPopupLine("Código TOTVS", totvs, true)
          addPopupLine("Nome da Igreja", nome)
          addPopupLine("Porte", porte)
          addPopupLine("Município/UF", [municipio, estado].filter(Boolean).join("/"))
          addPopupLine("Endereço", endereco)
          marker.bindPopup(popupContent)
          this.markerCluster.addLayer(marker)
          markers.push(marker)
        }
      })

      if (bounds.isValid()) {
        if (markers.length === 1) {
          const center = bounds.getCenter()
          this.map.flyTo([center.lat, center.lng], 16)
          setTimeout(() => {
            markers[0].openPopup()
          }, 500)
        } else {
          this.map.fitBounds(bounds, { padding: [50, 50] })
        }
      }
    } catch (e) {
      console.error("Erro ao carregar locais:", e)
    }
  }

  toggleFilters() {
    if (this.hasFilterModalTarget) {
      this.filterModalTarget.classList.toggle("hidden")
    }
  }

  applyFilters() {
    const porte = this.hasPorteFilterTarget ? this.porteFilterTarget.value : ""
    const validada = this.hasValidadaFilterTarget ? this.validadaFilterTarget.value : ""
    const query = this.hasSearchInputTarget ? this.searchInputTarget.value.trim() : ""
    const paramsObj = {}
    if (porte) paramsObj.porte = porte
    if (validada) paramsObj.validada = validada
    if (query.length >= 2) paramsObj.query = query

    const queryString = new URLSearchParams(paramsObj).toString()
    this.loadMarkers(queryString ? `?${queryString}` : "")
  }

  clearFilters() {
    if (this.hasPorteFilterTarget) this.porteFilterTarget.value = ""
    if (this.hasValidadaFilterTarget) this.validadaFilterTarget.value = ""
    if (this.hasSearchInputTarget) this.searchInputTarget.value = ""
    this.loadMarkers()
  }

  search() {
    clearTimeout(this.searchTimeout)
    this.searchTimeout = setTimeout(() => this.applyFilters(), 400)
  }
}
