class Asset < ApplicationRecord
  self.table_name = 'patrimonio_submissoes'

  has_many :items, class_name: 'AssetItem', foreign_key: :submissao_id, dependent: :destroy
  belongs_to :church, class_name: 'Church', foreign_key: :codigo_totvs, primary_key: :codigo_totvs, optional: true

  accepts_nested_attributes_for :items, allow_destroy: true

  validates :codigo_totvs, presence: true

  scope :for_year, ->(year = Time.current.year) { where(ano_referencia: year) }
  scope :recent, -> { order(created_at: :desc) }
end
