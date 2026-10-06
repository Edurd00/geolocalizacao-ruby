import { Controller } from "@hotwired/stimulus"

export default class extends Controller {
  static targets = [ "mapContainer", "filterModal", "porteFilter", "validadaFilter", "searchInput" ]

  connect() {
    this.initMap()
    this.loadMarkers()
    window.addEventListener('resize', () => this.map && this.map.invalidateSize())
  }

  disconnect() {
    if (this.map) {
      this.map.remove()
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
      const response = await fetch(`/map/locations${params}`)
      const locations = await response.json()
      if (this.markerCluster) {
        this.markerCluster.clearLayers()
      }

      const bounds = L.latLngBounds()

      locations.forEach(loc => {
        const lat = parseFloat(loc.latitude)
        const lng = parseFloat(loc.longitude)
        if (!isNaN(lat) && !isNaN(lng) && lat !== 0 && lng !== 0) {
          bounds.extend([lat, lng])
          const marker = L.marker([lat, lng])
          const nome = loc.nome || loc.desc_igreja || loc.name || 'Igreja IPDA'
          const totvs = loc.codigo_totvs || loc.totvs_code || '-'
          marker.bindPopup(`<b>${totvs}</b><br>${nome}`)
          this.markerCluster.addLayer(marker)
        }
      })

      if (bounds.isValid()) {
        this.map.fitBounds(bounds, { padding: [50, 50] })
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
