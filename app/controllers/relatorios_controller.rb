class RelatoriosController < ApplicationController
  def index
    @total_churches_count = Church.count rescue 0
    @selected_region = params[:region].presence || 'ALL'
    @selected_state = params[:state].presence || 'ALL'

    @regions = Church::REGIAO_GEOGRAFICA_MAPPING.keys
    @states = Church.where.not(estado: [nil, '']).distinct.pluck(:estado).sort rescue []

    # Scoped churches based on region/state
    scope = Church.all
    scope = scope.by_region(@selected_region) if @selected_region != 'ALL'
    scope = scope.by_state(@selected_state) if @selected_state != 'ALL'

    @metrics = {
      total_igrejas: scope.count,
      validadas: scope.where("LOWER(status) LIKE 'validad%' OR UPPER(status) IN ('VALIDADO', 'VALIDADA')").count,
      pendentes: scope.where("LOWER(status) NOT LIKE 'validad%' AND UPPER(status) NOT IN ('VALIDADO', 'VALIDADA')").count
    }
    @metrics[:pct_validadas] = @metrics[:total_igrejas] > 0 ? ((@metrics[:validadas].to_f / @metrics[:total_igrejas]) * 100).round(1) : 0.0

    @validated_vs_pending = {
      "VALIDADO" => @metrics[:validadas],
      "PENDENTE" => @metrics[:pendentes]
    }

    @state_distribution = scope.where.not(estado: [nil, '']).group(:estado).order("count_all DESC").limit(10).count rescue {}

    porte_counts = Hash.new(0)
    scope.find_each do |c|
      porte_counts[c.calculated_porte] += 1
    end
    @porte_distribution = porte_counts

    respond_to do |format|
      format.html
      format.json do
        render json: {
          metrics: @metrics,
          validated_vs_pending: @validated_vs_pending,
          state_distribution: @state_distribution,
          porte_distribution: @porte_distribution
        }
      end
    end
  end
end
