class MapController < ApplicationController
  def index
    @churches_count = Church.count rescue 0
    @total_churches_count = @churches_count
  end

  def locations
    # Seleciona apenas igrejas com coordenadas válidas
    churches = Church.where.not(latitude: nil).where.not(longitude: nil)

    # Aplica filtros caso enviados por parâmetros de URL
    churches = churches.where(estado: params[:estado]) if params[:estado].present?
    churches = churches.where(porte: params[:porte]) if params[:porte].present?

    if params[:validada].present?
      is_validada = ActiveModel::Type::Boolean.new.cast(params[:validada])
      if Church.column_names.include?('validada')
        churches = churches.where(validada: is_validada)
      elsif Church.column_names.include?('status')
        status_val = is_validada ? ['VALIDADO', 'VALIDADA'] : ['PENDENTE']
        churches = churches.where(status: status_val)
      end
    end

    if params[:query].present?
      searchable_columns = %w[nome desc_igreja codigo_totvs municipio estado endereco bairro cep porte]
        .select { |column| Church.column_names.include?(column) }

      if searchable_columns.any?
        query = "%#{Church.sanitize_sql_like(params[:query].to_s.strip)}%"
        conditions = searchable_columns.map do |column|
          "#{Church.connection.quote_column_name(column)} ILIKE :query"
        end
        churches = churches.where(conditions.join(" OR "), query: query)
      end
    end

    render json: churches.map(&:as_map_json)
  rescue => e
    Rails.logger.error("Erro ao buscar localizacoes: #{e.message}")
    render json: []
  end
end
