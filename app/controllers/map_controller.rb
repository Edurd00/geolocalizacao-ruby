class MapController < ApplicationController
  def index
    @churches_count = Church.count rescue 0
    @total_churches_count = @churches_count
  end

  def locations
    # Seleciona apenas igrejas com coordenadas válidas
    churches = Church.where.not(latitude: nil).where.not(longitude: nil)

    estado = params[:estado].to_s.strip
    porte = params[:porte].to_s.strip
    churches = churches.where(estado: estado) unless estado.empty?
    churches = churches.where(porte: porte) unless porte.empty?

    validada = params[:validada].to_s.strip.downcase
    if %w[true false].include?(validada)
      is_validada = validada == 'true'
      if Church.column_names.include?('validada')
        churches = churches.where(validada: is_validada)
      elsif Church.column_names.include?('status')
        status_val = is_validada ? ['VALIDADO', 'VALIDADA'] : ['PENDENTE']
        churches = churches.where(status: status_val)
      end
    end

    query_text = params[:query].to_s.strip
    unless query_text.empty?
      searchable_columns = %w[nome desc_igreja codigo_totvs municipio estado endereco bairro cep porte]
        .select { |column| Church.column_names.include?(column) }

      if searchable_columns.any?
        query = "%#{Church.sanitize_sql_like(query_text)}%"
        conditions = searchable_columns.map do |column|
          "#{Church.connection.quote_column_name(column)} ILIKE :query"
        end
        churches = churches.where(conditions.join(" OR "), query: query)
      end
    end

    render json: churches.map(&:as_map_json), content_type: 'application/json'
  rescue StandardError => e
    Rails.logger.error("Erro ao buscar localizacoes: #{e.message}")
    render json: [], status: :internal_server_error, content_type: 'application/json'
  end
end
