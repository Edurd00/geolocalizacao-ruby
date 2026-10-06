class RelatoriosController < ApplicationController
  def index
    initialize_report_data

    begin
      if Church.table_exists?
        @report_tables_ready = true
        @total_churches_count = Church.count
        @states = Church.where.not(estado: [nil, ""]).distinct.pluck(:estado).sort

        scope = Church.all
        scope = scope.by_region(@selected_region) unless @selected_region == "ALL"
        scope = scope.by_state(@selected_state) unless @selected_state == "ALL"

        total = scope.count
        validated = if Church.column_names.include?("status")
          scope.where("LOWER(status) LIKE 'validad%' OR UPPER(status) IN ('VALIDADO', 'VALIDADA')").count
        elsif Church.column_names.include?("validada")
          scope.where(validada: true).count
        else
          0
        end

        @metrics = {
          total_igrejas: total,
          validadas: validated,
          pendentes: total - validated,
          pct_validadas: total.positive? ? ((validated.to_f / total) * 100).round(1) : 0.0
        }
        @validated_vs_pending = { "VALIDADO" => validated, "PENDENTE" => total - validated }
        @state_distribution = scope.where.not(estado: [nil, ""]).group(:estado).count
          .sort_by { |_state, count| -count }.first(10).to_h

        porte_counts = Hash.new(0)
        scope.find_each { |church| porte_counts[church.calculated_porte] += 1 }
        @porte_distribution = porte_counts
      end
    rescue StandardError => e
      Rails.logger.error("Erro ao carregar relatórios BI: #{e.class}: #{e.message}")
      @report_tables_ready = false
    end

    respond_to do |format|
      format.html
      format.json { render json: report_payload }
    end
  end

  private

  def initialize_report_data
    @total_churches_count = 0
    @report_tables_ready = false
    @selected_region = params[:region].presence || "ALL"
    @selected_state = params[:state].presence || "ALL"
    @regions = Church::REGIAO_GEOGRAFICA_MAPPING.keys
    @states = []
    @metrics = { total_igrejas: 0, validadas: 0, pendentes: 0, pct_validadas: 0.0 }
    @validated_vs_pending = { "VALIDADO" => 0, "PENDENTE" => 0 }
    @state_distribution = {}
    @porte_distribution = {}
  end

  def report_payload
    {
      metrics: @metrics,
      validated_vs_pending: @validated_vs_pending,
      state_distribution: @state_distribution,
      porte_distribution: @porte_distribution
    }
  end
end
