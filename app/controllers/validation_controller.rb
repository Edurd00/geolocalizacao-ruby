class ValidationController < ApplicationController
  before_action :set_church, only: [:update]

  def show
    @church = find_next_pending_church
  end

  def update
    latitude = Float(params[:latitude] || params.dig(:church, :latitude), exception: false)
    longitude = Float(params[:longitude] || params.dig(:church, :longitude), exception: false)

    unless latitude && longitude && latitude.between?(-90, 90) && longitude.between?(-180, 180) && !(latitude.zero? && longitude.zero?)
      @church.errors.add(:base, "Informe latitude e longitude válidas.")
      return render :show, status: :unprocessable_entity
    end

    unless @church.respond_to?(:latitude=) && @church.respond_to?(:longitude=)
      @church.errors.add(:base, "A tabela de igrejas ainda não possui campos de coordenadas.")
      return render :show, status: :unprocessable_entity
    end

    @church.latitude = latitude
    @church.longitude = longitude
    if @church.respond_to?(:status=)
      @church.status = "VALIDADO"
    elsif @church.respond_to?(:validada=)
      @church.validada = true
    end

    if @church.save
      redirect_to validation_path, notice: "Coordenadas salvas e igreja validada."
    else
      render :show, status: :unprocessable_entity
    end
  end

  def extract_coords
    input_text = params[:url] || params[:text] || params[:link] || ''
    result = ExtractCoordinatesService.new(input_text).call

    render json: result, status: result[:success] ? :ok : :unprocessable_entity
  rescue StandardError => e
    Rails.logger.error("Coordinate extraction failed: #{e.class}")
    render json: { success: false, error: "Não foi possível processar o link informado." }, status: :service_unavailable
  end

  private

  def set_church
    @church = Church.find(params[:id])
  end

  def find_next_pending_church
    if Church.column_names.include?('status')
      Church.where("LOWER(status) NOT LIKE 'validad%' AND UPPER(status) NOT IN ('VALIDADO', 'VALIDADA')").first
    elsif Church.column_names.include?('validada')
      Church.where(validada: [false, nil]).first
    else
      Church.first
    end
  rescue StandardError
    nil
  end
end
