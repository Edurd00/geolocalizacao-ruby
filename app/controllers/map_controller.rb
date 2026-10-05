class MapController < ApplicationController
  def index
    @total_churches_count = Church.count
  rescue ActiveRecord::ActiveRecordError => e
    Rails.logger.error("Unable to count churches: #{e.class}")
    @total_churches_count = nil
  end

  def locations
    churches = Church.all

    # Filter valid non-zero latitude/longitude coordinates if columns are present
    if Church.column_names.include?('latitude') && Church.column_names.include?('longitude')
      churches = churches.where.not(latitude: [nil, 0], longitude: [nil, 0])
    end

    render json: churches.map(&:as_map_json)
  rescue ActiveRecord::ActiveRecordError => e
    Rails.logger.error("Unable to load map locations: #{e.class}")
    render json: { error: "Não foi possível carregar os pontos do mapa." }, status: :service_unavailable
  end
end
