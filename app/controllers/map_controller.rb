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
      q = "%#{params[:query]}%"
      if Church.column_names.include?('nome')
        churches = churches.where("nome ILIKE ? OR codigo_totvs ILIKE ? OR municipio ILIKE ?", q, q, q)
      elsif Church.column_names.include?('desc_igreja')
        churches = churches.where("desc_igreja ILIKE ? OR codigo_totvs ILIKE ? OR municipio ILIKE ?", q, q, q)
      end
    end

    render json: churches.map(&:as_map_json)
  rescue => e
    Rails.logger.error("Erro ao buscar localizacoes: #{e.message}")
    render json: []
  end
end
