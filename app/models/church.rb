class Church < ApplicationRecord
  self.table_name = 'igrejas'

  # Associação para a igreja superior/sede (Coligada a)
  belongs_to :parent_church, class_name: 'Church', foreign_key: 'parent_id', optional: true

  # Associação para as igrejas subordinadas que respondem a esta sede
  has_many :subordinate_churches, class_name: 'Church', foreign_key: 'parent_id'

  has_many :assets, class_name: 'Asset', foreign_key: :codigo_totvs, primary_key: :codigo_totvs

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
    map_attribute(:nome).presence || map_attribute(:desc_igreja).presence || map_attribute(:name)
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

  # Returns the latest asset submission
  def latest_asset
    assets.order(ano_referencia: :desc, created_at: :desc).first
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

  # Aggregation Queries for BI Reports
  def self.validated_vs_pending_counts
    if column_names.include?('status')
      validadas = where("LOWER(status) LIKE 'validad%' OR UPPER(status) IN ('VALIDADO', 'VALIDADA')").count
      pendentes = count - validadas
    elsif column_names.include?('validada')
      validadas = where(validada: true).count
      pendentes = count - validadas
    else
      validadas = 0
      pendentes = count
    end
    { "VALIDADO" => validadas, "PENDENTE" => pendentes }
  end

  def self.state_distribution
    where.not(estado: [nil, '']).group(:estado).order("count_all DESC").count
  end

  def self.porte_distribution
    counts = Hash.new(0)
    all.find_each do |church|
      counts[church.calculated_porte] += 1
    end
    counts
  end

  def self.summary_metrics
    total = count
    status_counts = validated_vs_pending_counts
    validadas = status_counts["VALIDADO"] || 0
    pendentes = status_counts["PENDENTE"] || 0
    pct = total > 0 ? ((validadas.to_f / total) * 100).round(1) : 0.0

    {
      total_igrejas: total,
      validadas: validadas,
      pendentes: pendentes,
      pct_validadas: pct
    }
  end

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
    codigo = map_attribute(:codigo_totvs) || map_attribute(:totvs_code)
    igreja_nome = nome

    parent = parent_church
    parent_data = if parent
      parent_code = parent.map_attribute(:codigo_totvs) || parent.map_attribute(:totvs_code)
      {
        id: parent.id,
        name: parent.nome,
        nome: parent.nome,
        porte: parent.calculated_porte,
        totvs_code: parent_code,
        codigo_totvs: parent_code,
        latitude: parent.latitude,
        longitude: parent.longitude
      }
    else
      nil
    end

    sub_list = subordinate_churches.map do |sub|
      sub_code = sub.map_attribute(:codigo_totvs) || sub.map_attribute(:totvs_code)
      {
        id: sub.id,
        name: sub.nome,
        nome: sub.nome,
        porte: sub.calculated_porte,
        totvs_code: sub_code,
        codigo_totvs: sub_code,
        latitude: sub.latitude,
        longitude: sub.longitude
      }
    end

    {
      id: map_attribute(:id),
      codigo_totvs: codigo,
      totvs_code: codigo,
      nome: igreja_nome,
      name: igreja_nome,
      porte: calculated_porte,
      endereco: map_attribute(:endereco),
      bairro: map_attribute(:bairro),
      municipio: map_attribute(:municipio),
      estado: map_attribute(:estado),
      cep: map_attribute(:cep),
      latitude: map_attribute(:latitude),
      longitude: map_attribute(:longitude),
      validada: validada,
      link_google_maps: map_attribute(:link_google_maps),
      parent_church: parent_data,
      subordinates_count: subordinate_churches.size,
      subordinates: sub_list
    }
  end

  protected

  def map_attribute(attribute)
    has_attribute?(attribute) ? self[attribute] : nil
  end
end
