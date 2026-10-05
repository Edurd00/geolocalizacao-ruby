import { Controller } from "@hotwired/stimulus"

export default class extends Controller {
  static values = {
    type: { type: String, default: "bar" },
    labels: Array,
    data: Array,
    colors: Array,
    title: String
  }

  connect() {
    this.ensureChartLoaded().then(() => {
      this.renderChart()
    })
  }

  disconnect() {
    if (this.chart) {
      this.chart.destroy()
    }
  }

  ensureChartLoaded() {
    if (window.Chart) {
      return Promise.resolve()
    }

    return new Promise((resolve, reject) => {
      const script = document.createElement("script")
      script.src = "https://cdn.jsdelivr.net/npm/chart.js"
      script.onload = () => resolve()
      script.onerror = () => reject(new Error("Falha ao carregar Chart.js via CDN"))
      document.head.appendChild(script)
    })
  }

  renderChart() {
    if (!window.Chart || !this.element) return

    const ctx = this.element.getContext ? this.element.getContext("2d") : this.element
    const chartType = this.typeValue || "bar"
    const labels = this.labelsValue || []
    const dataValues = this.dataValue || []
    const backgroundColors = this.colorsValue || [
      "#4F46E5", "#3B82F6", "#EAB308", "#F97316", "#22C55E", "#06B6D4", "#EC4899", "#6B7280"
    ]

    const config = {
      type: chartType,
      data: {
        labels: labels,
        datasets: [{
          label: this.titleValue || "Total",
          data: dataValues,
          backgroundColor: backgroundColors,
          borderColor: "rgba(15, 23, 42, 0.8)",
          borderWidth: 2,
          borderRadius: chartType === "bar" ? 6 : 0
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            display: chartType !== "bar",
            position: "bottom",
            labels: {
              color: "#94a3b8",
              font: { family: "sans-serif", size: 11, weight: "bold" }
            }
          },
          tooltip: {
            backgroundColor: "#0f172a",
            titleColor: "#ffffff",
            bodyColor: "#f8fafc",
            borderColor: "#334155",
            borderWidth: 1,
            padding: 10,
            cornerRadius: 8
          }
        },
        scales: chartType === "bar" ? {
          x: {
            ticks: { color: "#94a3b8", font: { weight: "bold", size: 10 } },
            grid: { color: "rgba(51, 65, 85, 0.2)" }
          },
          y: {
            ticks: { color: "#94a3b8", font: { size: 10 } },
            grid: { color: "rgba(51, 65, 85, 0.2)" }
          }
        } : {}
      }
    }

    if (this.chart) {
      this.chart.destroy()
    }

    this.chart = new window.Chart(ctx, config)
  }
}
