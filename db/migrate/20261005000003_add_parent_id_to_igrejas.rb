class AddParentIdToIgrejas < ActiveRecord::Migration[8.0]
  def change
    add_column :igrejas, :parent_id, :bigint, null: true
    add_index :igrejas, :parent_id
  end
end
