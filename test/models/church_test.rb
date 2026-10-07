require "test_helper"

class ChurchTest < ActiveSupport::TestCase
  test "parent and subordinate associations" do
    sede = Church.create!(
      codigo_totvs: 'TEST001',
      nome: 'Sede Teste',
      porte: 'ESTADUAL',
      latitude: -23.5500,
      longitude: -46.6300
    )

    filial = Church.create!(
      codigo_totvs: 'TEST002',
      nome: 'Filial Teste',
      porte: 'LOCAL',
      latitude: -23.5600,
      longitude: -46.6400,
      parent_church: sede
    )

    assert_equal sede, filial.parent_church
    assert_includes sede.subordinate_churches, filial
  end

  test "as_map_json structure including parent and subordinates" do
    sede = Church.create!(
      codigo_totvs: 'HEAD001',
      nome: 'Sede Central',
      porte: 'CENTRAL',
      latitude: -23.5000,
      longitude: -46.6000
    )

    filial = Church.create!(
      codigo_totvs: 'SUB001',
      nome: 'Filial Subordinada',
      porte: 'LOCAL',
      latitude: -23.5100,
      longitude: -46.6100,
      parent_church: sede
    )

    json_sede = sede.as_map_json
    assert_equal 'HEAD001', json_sede[:totvs_code]
    assert_equal 1, json_sede[:subordinates_count]
    assert_equal 1, json_sede[:subordinates].size
    assert_equal 'SUB001', json_sede[:subordinates].first[:totvs_code]

    json_filial = filial.as_map_json
    assert_not_nil json_filial[:parent_church]
    assert_equal 'HEAD001', json_filial[:parent_church][:totvs_code]
  end
end
