class ColigacoesController < ApplicationController
  def index
    @search_query = params[:query].presence || params[:search].presence
    @selected_state = params[:state].presence || 'ALL'
    @churches_table_ready = false
    @total_churches_count = 0
    @states = []
    @churches = []

    return unless Church.table_exists?

    @churches_table_ready = true
    @total_churches_count = Church.count
    @states = Church.where.not(estado: [nil, '']).distinct.pluck(:estado).sort

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

    @churches = scope.order(:nome).to_a
  rescue StandardError => e
    Rails.logger.error("Erro ao carregar coligações: #{e.class}: #{e.message}")
    @churches_table_ready = false
    @total_churches_count = 0
    @states ||= []
    @churches = []
  end
end
