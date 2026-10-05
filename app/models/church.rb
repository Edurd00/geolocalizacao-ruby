class Church < ApplicationRecord
  self.table_name = 'igrejas'

  REGIAO_GEOGRAFICA_MAPPING = {
    'Sudeste - SP' => ['SP'],
    'Sudeste - MG' => ['MG'],
    'Sudeste - ES e RJ' => ['ES', 'RJ'],
    'Sul' => ['PR', 'RS', 'SC'],
    'Norte' => ['AC', 'AM', 'RO', 'PA', 'AP', 'RR', 'TO'],
    'Nordeste' => ['AL', 'BA', 'CE', 'RN', 'PE', 'PI', 'MA', 'PB', 'SE'],
    'Centro-Oeste' => ['MT', 'DF', 'GO', 'MS']
  }.freeze

  PORTE_LEVELS = ['ESTADUAL', 'SETORIAL', 'CENTRAL', 'REGIONAL', 'LOCAL', 'CASA DE ORAÇÃO', 'ALDEIA INDIGENA'].freeze

  # Safe getter for name supporting both 'nome' and 'desc_igreja' columns
  def nome
    if has_attribute?(:nome) && self[:nome].present?
      self[:nome]
    elsif has_attribute?(:desc_igreja)
      self[:desc_igreja]
    elsif respond_to?(:desc_igreja)
      desc_igreja
    else
      nil
    end
  end

  # Getter for validada boolean field based on status column or validada attribute
  def validada
    if has_attribute?(:validada)
      self[:validada]
    elsif respond_to?(:status) && status.to_s.strip.length > 0
      status.to_s.strip.upcase.start_with?('VALIDAD')
    else
      false
    end
  end

  # Setter for validada boolean field
  def validada=(value)
    boolean_value = ActiveModel::Type::Boolean.new.cast(value)
    if has_attribute?(:validada)
      self[:validada] = boolean_value
    elsif respond_to?(:status=)
      self.status = boolean_value ? 'VALIDADO' : 'PENDENTE'
    end
  end

  # Calculates porte/hierarchical level
  def calculated_porte
    if respond_to?(:porte) && porte.present?
      return porte.upcase.strip
    end

    n = (nome || '').upcase
    if n.include?('ESTADUAL')
      'ESTADUAL'
    elsif n.include?('SETORIAL')
      'SETORIAL'
    elsif n.include?('CENTRAL')
      'CENTRAL'
    elsif n.include?('REGIONAL')
      'REGIONAL'
    elsif n.include?('ORAÇÃO') || n.include?('ORACAO')
      'CASA DE ORAÇÃO'
    elsif n.include?('ALDEIA') || n.include?('INDIGENA') || n.include?('INDÍGENA')
      'ALDEIA INDIGENA'
    else
      'LOCAL'
    end
  end

  # Scopes
  scope :by_state, ->(uf) {
    return all if uf.blank? || uf.to_s.upcase == 'ALL'
    where(estado: uf.to_s.upcase)
  }

  scope :by_region, ->(region_name) {
    ufs = REGIAO_GEOGRAFICA_MAPPING[region_name]
    return all if ufs.nil?
    where(estado: ufs)
  }

  scope :by_porte, ->(level) {
    return all if level.blank? || level.to_s.upcase == 'ALL'
    target = level.to_s.upcase
    where("UPPER(porte) = ?", target)
  }

  # Class methods for grouping and counting
  def self.grouped_by_region
    result = {}
    REGIAO_GEOGRAFICA_MAPPING.each do |region_name, ufs|
      result[region_name] = where(estado: ufs)
    end
    result
  end

  def self.grouped_by_state
    where.not(estado: [nil, '']).group(:estado).count
  end

  def self.grouped_by_porte
    all.group_by(&:calculated_porte)
  end

  def self.regional_counts(region_name = nil)
    base_scope = region_name.present? ? by_region(region_name) : all
    base_scope.group_by(&:calculated_porte).transform_values(&:count)
  end

  # Formats church data for map consumption
  def as_map_json
    {
      id: respond_to?(:id) ? id : nil,
      codigo_totvs: respond_to?(:codigo_totvs) ? codigo_totvs : nil,
      nome: nome,
      porte: calculated_porte,
      endereco: respond_to?(:endereco) ? endereco : nil,
      bairro: respond_to?(:bairro) ? bairro : nil,
      municipio: respond_to?(:municipio) ? municipio : nil,
      estado: respond_to?(:estado) ? estado : nil,
      cep: respond_to?(:cep) ? cep : nil,
      latitude: respond_to?(:latitude) ? latitude : nil,
      longitude: respond_to?(:longitude) ? longitude : nil,
      validada: validada,
      link_google_maps: respond_to?(:link_google_maps) ? link_google_maps : nil
    }
  end
end
