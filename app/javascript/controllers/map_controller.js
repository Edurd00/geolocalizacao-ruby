import { Controller } from "@hotwired/stimulus"

export default class extends Controller {
  static targets = [ "mapContainer", "filterModal", "porteFilter", "validadaFilter", "searchInput" ]

  connect() {
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
    this.markerCluster = L.markerClusterGroup()
    this.map.addLayer(this.markerCluster)

    setTimeout(() => {
      if (this.map) {
        this.map.invalidateSize()
      }
    }, 250)
  }

  async loadMarkers(params = "") {
    try {
      const response = await fetch(`/map/locations${params}`, { headers: { Accept: "application/json" } })
      if (!response.ok) throw new Error(`Falha ao carregar locais (${response.status})`)
      const locations = await response.json()

      // Clear existing markers
      if (this.markerCluster) {
        this.markerCluster.clearLayers()
      }

      const bounds = L.latLngBounds()
      const markers = []

      // Helper to map porte to color
      const porteColorMap = {
        'ESTADUAL': '#3b82f6',
        'SETORIAL': '#f59e0b',
        'CENTRAL': '#f97316',
        'REGIONAL': '#10b981',
        'LOCAL': '#a855f7',
        'CASA DE ORAÇÃO': '#ec4899',
        'ALDEIA INDÍGENA': '#22d3ee'
      }

      const createIcon = (porte) => {
        const color = porteColorMap[porte?.toUpperCase()] || '#6b7280' // fallback neutral
        const html = `<div style="background-color:${color}; width:20px; height:20px; border-radius:50%; border:2px solid white;"></div>`
        return L.divIcon({ html, className: '' })
      }

      locations.forEach(loc => {
        const lat = parseFloat(loc.latitude)
        const lng = parseFloat(loc.longitude)
        if (!isNaN(lat) && !isNaN(lng) && lat !== 0 && lng !== 0) {
          bounds.extend([lat, lng])
          const icon = createIcon(loc.porte)
          const marker = L.marker([lat, lng], { icon })

          const nome = loc.nome || loc.desc_igreja || loc.name || 'Igreja IPDA'
          const totvs = loc.codigo_totvs || loc.totvs_code || '-'
          const porte = loc.porte || '---'
          const municipio = loc.municipio || ''
          const estado = loc.estado || ''
          const endereco = loc.endereco || ''

          const popupContent = `<b>${totvs}</b><br/>${nome}<br/>Porte: ${porte}<br/>${municipio}/${estado}<br/>${endereco}`
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
    const query = this.hasSearchInputTarget ? this.searchInputTarget.value : ""
    const paramsObj = {}
    if (porte) paramsObj.porte = porte
    if (validada) paramsObj.validada = validada
    if (query) paramsObj.query = query

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
