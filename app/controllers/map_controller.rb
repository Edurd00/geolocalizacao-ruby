class MapController < ApplicationController
  def index
    @churches_count = Church.count rescue 0
    @total_churches_count = @churches_count
  end

  def locations
    churches = Church.where.not(latitude: nil).where.not(longitude: nil)
    churches = churches.includes(:parent_church, :subordinate_churches) if Church.column_names.include?('parent_id')

    estado = params[:estado].to_s.strip
    porte = params[:porte].to_s.strip
    churches = churches.where(estado: estado) if estado.present?
    churches = churches.where(porte: porte) if porte.present?

    validada = params[:validada].to_s.strip.downcase
    if %w[true false].include?(validada)
      if Church.column_names.include?('validada')
        churches = churches.where(validada: validada == 'true')
      elsif Church.column_names.include?('status')
        values = validada == 'true' ? %w[VALIDADO VALIDADA] : ['PENDENTE']
        churches = churches.where(status: values)
      end
    end

    query_text = params[:query].to_s.strip
    if query_text.present?
      searchable_columns = %w[nome desc_igreja codigo_totvs municipio estado endereco bairro cep porte]
        .select { |column| Church.column_names.include?(column) }

      if searchable_columns.any?
        query = "%#{Church.sanitize_sql_like(query_text)}%"
        conditions = searchable_columns.map do |column|
          "#{Church.connection.quote_column_name(column)} ILIKE :query"
        end
        churches = churches.where(conditions.join(' OR '), query: query)
      end
    end

    render json: churches.map(&:as_map_json), content_type: 'application/json'
  rescue StandardError => e
    Rails.logger.error("Erro no MapController#locations: #{e.message}")
    Rails.logger.error(e.backtrace.first(10).join("\n"))
    render json: { error: 'Não foi possível carregar as igrejas do mapa.' }, status: :internal_server_error, content_type: 'application/json'
  end
end
