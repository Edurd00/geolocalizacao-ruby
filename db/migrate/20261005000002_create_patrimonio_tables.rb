class CreatePatrimonioTables < ActiveRecord::Migration[8.0]
  def change
    create_table :patrimonio_submissoes do |t|
      t.string :codigo_totvs, null: false
      t.string :nome_responsavel
      t.string :telefone_responsavel
      t.string :cargo_responsavel, default: 'Dirigente Local'
      t.integer :ano_referencia, default: -> { 'EXTRACT(YEAR FROM CURRENT_DATE)' }
      t.datetime :data_envio, default: -> { 'CURRENT_TIMESTAMP' }
      t.text :observacoes

      t.timestamps
    end

    add_index :patrimonio_submissoes, :codigo_totvs

    create_table :patrimonio_itens do |t|
      t.integer :submissao_id, null: false
      t.string :item_nome, null: false
      t.integer :quantidade, default: 1
      t.string :possui, default: 'Sim'
      t.string :conservacao, default: 'BOM'
      t.text :observacao

      t.timestamps
    end

    add_index :patrimonio_itens, :submissao_id
  end
end
