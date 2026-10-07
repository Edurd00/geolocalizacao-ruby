# This file is auto-generated from the current state of the database. Instead
# of editing this file, please use the migrations feature of Active Record to
# incrementally modify your database, and then regenerate this schema definition.
#
# This file is the source Rails uses to define your schema when running `bin/rails
# db:schema:load`. When creating a new database, `bin/rails db:schema:load` tends to
# be faster and is potentially less error prone than running all of your
# migrations from scratch. Old migrations may fail to apply correctly if those
# migrations use external dependencies or application code.
#
# It's strongly recommended that you check this file into your version control system.

ActiveRecord::Schema[8.0].define(version: 2026_10_05_000003) do
  # These are extensions that must be enabled in order to support this database
  enable_extension "pg_catalog.plpgsql"

  create_table "igrejas", force: :cascade do |t|
    t.string "codigo_totvs"
    t.string "nome"
    t.string "porte"
    t.string "endereco"
    t.string "bairro"
    t.string "municipio"
    t.string "estado"
    t.string "cep"
    t.float "latitude"
    t.float "longitude"
    t.boolean "validada", default: false
    t.text "link_google_maps"
    t.text "observacao"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.bigint "parent_id"
    t.index ["parent_id"], name: "index_igrejas_on_parent_id"
  end

  create_table "patrimonio_itens", force: :cascade do |t|
    t.integer "submissao_id", null: false
    t.string "item_nome", null: false
    t.integer "quantidade", default: 1
    t.string "possui", default: "Sim"
    t.string "conservacao", default: "BOM"
    t.text "observacao"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["submissao_id"], name: "index_patrimonio_itens_on_submissao_id"
  end

  create_table "patrimonio_submissoes", force: :cascade do |t|
    t.string "codigo_totvs", null: false
    t.string "nome_responsavel"
    t.string "telefone_responsavel"
    t.string "cargo_responsavel", default: "Dirigente Local"
    t.integer "ano_referencia", default: -> { "EXTRACT(year FROM CURRENT_DATE)" }
    t.datetime "data_envio", default: -> { "CURRENT_TIMESTAMP" }
    t.text "observacoes"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["codigo_totvs"], name: "index_patrimonio_submissoes_on_codigo_totvs"
  end
end
