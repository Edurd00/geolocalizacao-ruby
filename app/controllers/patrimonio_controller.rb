class PatrimonioController < ApplicationController
  before_action :set_church, only: [:show, :update]

  # DEFAULT STANDARD ITEMS LIST
  DEFAULT_ITEMS = [
    { nome: 'Bancos da Nave', categoria: 'Mobiliário e Estrutura' },
    { nome: 'Cadeiras do Presbitério / Altar', categoria: 'Mobiliário e Estrutura' },
    { nome: 'Bebedouro ou Filtro de Água', categoria: 'Mobiliário e Estrutura' },
    { nome: 'Armário', categoria: 'Mobiliário e Estrutura' },
    { nome: 'Mesa da Santa Ceia', categoria: 'Mobiliário e Estrutura' },
    { nome: 'Cofre Boca de Lobo', categoria: 'Mobiliário e Estrutura' },
    { nome: 'Púlpito do Altar', categoria: 'Mobiliário e Estrutura' },
    { nome: 'Ar Condicionado', categoria: 'Eletrônicos e Climatização' },
    { nome: 'Ventiladores (Teto / Parede)', categoria: 'Eletrônicos e Climatização' },
    { nome: 'Computador / Notebook', categoria: 'Eletrônicos e Climatização' },
    { nome: 'Impressora', categoria: 'Eletrônicos e Climatização' },
    { nome: 'Projetor (Data Show)', categoria: 'Eletrônicos e Climatização' },
    { nome: 'Tela de Projetor / Telão', categoria: 'Eletrônicos e Climatização' },
    { nome: 'Microfones (Com / Sem Fio)', categoria: 'Som e Instrumentos' },
    { nome: 'Caixas de Som (Ativas / Passivas)', categoria: 'Som e Instrumentos' },
    { nome: 'Mesa de Som', categoria: 'Som e Instrumentos' },
    { nome: 'Teclado Musical / Piano Digital', categoria: 'Som e Instrumentos' },
    { nome: 'Geladeira / Frigobar', categoria: 'Cozinha e Segurança' },
    { nome: 'Fogão', categoria: 'Cozinha e Segurança' },
    { nome: 'Extintores de Incêndio', categoria: 'Cozinha e Segurança' }
  ].freeze

  def index
    @query = params[:query].presence || params[:search].presence
    @total_churches_count = 0
    @patrimonio_tables_ready = false
    @churches = []

    return unless Church.table_exists?

    @total_churches_count = Church.count
    @patrimonio_tables_ready = Asset.table_exists? && AssetItem.table_exists?
    scope = Church.all

    if @query.present?
      q = "%#{Church.sanitize_sql_like(@query.strip.downcase)}%"
      searchable_columns = %w[nome desc_igreja codigo_totvs municipio].select { |column| Church.column_names.include?(column) }
      if searchable_columns.any?
        conditions = searchable_columns.map { |column| "LOWER(#{Church.connection.quote_column_name(column)}) LIKE :q" }
        scope = scope.where(conditions.join(" OR "), q: q)
      end
    end

    @churches = scope.order(:nome).limit(50).to_a
  rescue StandardError => e
    Rails.logger.error("Erro ao carregar módulo de patrimônio: #{e.class}: #{e.message}")
    @patrimonio_tables_ready = false
    @churches = []
  end

  def show
    unless patrimonio_tables_ready?
      redirect_to patrimonio_index_path, alert: 'As tabelas de patrimônio ainda não estão disponíveis. Execute as migrations do banco.'
      return
    end

    @total_churches_count = Church.count rescue 0
    @asset = Asset.find_or_initialize_by(codigo_totvs: @church.codigo_totvs, ano_referencia: Time.current.year)

    if @asset.new_record? || @asset.items.empty?
      DEFAULT_ITEMS.each do |item_data|
        @asset.items.build(item_nome: item_data[:nome], quantidade: 1, possui: 'Não', conservacao: 'BOM')
      end
    end
  end

  def update
    unless patrimonio_tables_ready?
      redirect_to patrimonio_index_path, alert: 'As tabelas de patrimônio ainda não estão disponíveis. Execute as migrations do banco.'
      return
    end

    @asset = Asset.find_or_initialize_by(codigo_totvs: @church.codigo_totvs, ano_referencia: Time.current.year)
    @asset.assign_attributes(asset_params)
    @asset.data_envio = Time.current

    # Process items parameter from form if provided
    if params[:items].is_a?(Hash) || params[:items].is_a?(Array)
      items_data = params[:items].is_a?(Hash) ? params[:items].values : params[:items]
      @asset.items.destroy_all if @asset.persisted?

      items_data.each do |item_attr|
        next if item_attr[:item_nome].blank?
        possui_val = ActiveModel::Type::Boolean.new.cast(item_attr[:possui]) ? 'Sim' : (item_attr[:possui].presence || 'Não')
        @asset.items.build(
          item_nome: item_attr[:item_nome],
          quantidade: item_attr[:quantidade].to_i.positive? ? item_attr[:quantidade].to_i : 1,
          possui: possui_val,
          conservacao: item_attr[:conservacao].presence || 'BOM',
          observacao: item_attr[:observacao]
        )
      end
    end

    success = @asset.save

    respond_to do |format|
      if success
        format.turbo_stream
        format.html { redirect_to patrimonio_path(@church.codigo_totvs || @church.id), notice: 'Declaração de patrimônio atualizada com sucesso!' }
      else
        format.turbo_stream
        format.html { render :show, status: :unprocessable_entity }
      end
    end
  end

  private

  def patrimonio_tables_ready?
    Church.table_exists? && Asset.table_exists? && AssetItem.table_exists?
  rescue StandardError
    false
  end

  def set_church
    @church = Church.find_by(codigo_totvs: params[:id]) || Church.find_by(id: params[:id])
    unless @church
      redirect_to patrimonio_index_path, alert: 'Igreja não encontrada.'
    end
  rescue StandardError => e
    Rails.logger.error("Erro ao localizar igreja para patrimônio: #{e.class}: #{e.message}")
    redirect_to patrimonio_index_path, alert: 'A tabela de igrejas ainda não está disponível.'
  end

  def asset_params
    params.require(:asset).permit(:nome_responsavel, :telefone_responsavel, :cargo_responsavel, :observacoes, :ano_referencia)
  rescue ActionController::ParameterMissing
    params.permit(:nome_responsavel, :telefone_responsavel, :cargo_responsavel, :observacoes, :ano_referencia)
  end
end
