class OrganizacaoController < ApplicationController
  def index
    @churches_table_ready = Church.table_exists? rescue false
    @total_churches_count = Church.count rescue 0
    @selected_region = params[:region].presence || 'Sudeste - SP'
    @selected_state = params[:state].presence || 'ALL'
    @search_query = params[:search].presence

    @regions = Church::REGIAO_GEOGRAFICA_MAPPING.keys
    @states = Church.where.not(estado: [nil, '']).distinct.pluck(:estado).sort rescue []

    # Scoped churches based on region and state
    churches_scope = Church.by_region(@selected_region)
    churches_scope = churches_scope.by_state(@selected_state) if @selected_state != 'ALL'

    if @search_query.present?
      q = "%#{@search_query.strip.downcase}%"
      if Church.column_names.include?('desc_igreja')
        churches_scope = churches_scope.where(
          "LOWER(desc_igreja) LIKE :q OR LOWER(codigo_totvs) LIKE :q OR LOWER(municipio) LIKE :q",
          q: q
        )
      elsif Church.column_names.include?('nome')
        churches_scope = churches_scope.where(
          "LOWER(nome) LIKE :q OR LOWER(codigo_totvs) LIKE :q OR LOWER(municipio) LIKE :q",
          q: q
        )
      end
    end

    @churches = churches_scope.order(:nome).to_a rescue []

    # Regional counters by hierarchical level (porte)
    @regional_counts = Church.regional_counts(@selected_region) rescue {}
    @churches_by_porte = @churches.group_by(&:calculated_porte)
  rescue StandardError => e
    Rails.logger.error("Error in OrganizacaoController#index: #{e.message}")
    @total_churches_count = 0
    @churches_table_ready = false
    @regions = Church::REGIAO_GEOGRAFICA_MAPPING.keys
    @states = []
    @churches = []
    @regional_counts = {}
    @churches_by_porte = {}
  end
end
