class ColigacoesController < ApplicationController
  def index
    @total_churches_count = Church.count rescue 0
    @search_query = params[:query].presence || params[:search].presence
    @selected_state = params[:state].presence || 'ALL'

    @states = Church.where.not(estado: [nil, '']).distinct.pluck(:estado).sort rescue []

    scope = Church.all
    scope = scope.by_state(@selected_state) if @selected_state != 'ALL'

    if @search_query.present?
      q = "%#{@search_query.strip.downcase}%"
      if Church.column_names.include?('desc_igreja')
        scope = scope.where("LOWER(desc_igreja) LIKE :q OR LOWER(codigo_totvs) LIKE :q OR LOWER(municipio) LIKE :q", q: q)
      elsif Church.column_names.include?('nome')
        scope = scope.where("LOWER(nome) LIKE :q OR LOWER(codigo_totvs) LIKE :q OR LOWER(municipio) LIKE :q", q: q)
      end
    end

    @churches = scope.order(:nome) rescue []
  end
end
