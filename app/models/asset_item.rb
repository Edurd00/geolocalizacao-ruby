class AssetItem < ApplicationRecord
  self.table_name = 'patrimonio_itens'

  belongs_to :asset, class_name: 'Asset', foreign_key: :submissao_id, optional: true

  validates :item_nome, presence: true

  scope :possui, -> { where(possui: ['Sim', 'SIM', true]) }
end
