class CreateIgrejas < ActiveRecord::Migration[8.0]
  def change
    create_table :igrejas do |t|
      t.string :codigo_totvs
      t.string :nome
      t.string :porte
      t.string :endereco
      t.string :bairro
      t.string :municipio
      t.string :estado
      t.string :cep
      t.float :latitude
      t.float :longitude
      t.boolean :validada, default: false
      t.text :link_google_maps
      t.text :observacao

      t.timestamps
    end
  end
end
