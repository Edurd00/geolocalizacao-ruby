class MapController < ApplicationController
  def index
    @churches_count = Church.count rescue 0
    @total_churches_count = @churches_count
  end

  def locations
    churches = Church.includes(:parent_church, :subordinate_churches).where.not(latitude: nil, longitude: nil)

    churches = churches.where(estado: params[:estado]) if params[:estado].present?
    churches = churches.where(porte: params[:porte]) if params[:porte].present?
    churches = churches.where(validada: params[:validada] == 'true') if params[:validada].present?

    if params[:query].present?
      q = "%#{params[:query]}%"
      churches = churches.where("nome ILIKE ? OR codigo_totvs ILIKE ? OR municipio ILIKE ?", q, q, q)
    end

    render json: churches.map(&:as_map_json)
  rescue => e
    Rails.logger.error("Erro no MapController#locations: #{e.message}")
    render json: []
  end
end
