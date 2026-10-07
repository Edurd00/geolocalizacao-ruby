require 'json'

json_path = Rails.root.join('backup_igrejas_completo.json')

if File.exist?(json_path)
  file_content = File.read(json_path)
  data = JSON.parse(file_content) rescue []

  if data.any?
    puts "Populating 'igrejas' table from backup_igrejas_completo.json (#{data.size} records found)..."

    data.each do |entry|
      next unless entry.is_a?(Hash)

      codigo_totvs = entry['codigo_totvs']
      nome = entry['nome'].presence || entry['desc_igreja'].presence || entry['nome_igreja'].presence
      porte = entry['porte']
      endereco = entry['endereco']
      bairro = entry['bairro']
      municipio = entry['municipio']
      estado = entry['estado']
      cep = entry['cep']
      latitude = entry['latitude'].present? ? entry['latitude'].to_f : nil
      longitude = entry['longitude'].present? ? entry['longitude'].to_f : nil
      validada = if entry.key?('validada')
                   ActiveModel::Type::Boolean.new.cast(entry['validada'])
                 elsif entry['status'].present?
                   entry['status'].to_s.strip.upcase.start_with?('VALIDAD')
                 else
                   false
                 end
      link_google_maps = entry['link_google_maps']
      observacao = entry['observacao'].presence || entry['observacoes'].presence

      church = if codigo_totvs.present?
                 Igreja.find_or_initialize_by(codigo_totvs: codigo_totvs.to_s)
               else
                 Igreja.find_or_initialize_by(nome: nome, municipio: municipio, estado: estado)
               end

      church.assign_attributes(
        codigo_totvs: codigo_totvs,
        nome: nome,
        porte: porte,
        endereco: endereco,
        bairro: bairro,
        municipio: municipio,
        estado: estado,
        cep: cep,
        latitude: latitude,
        longitude: longitude,
        validada: validada,
        link_google_maps: link_google_maps,
        observacao: observacao
      )

      church.save!
    end
  end
end

if Church.count == 0
  puts "Seeding sample IPDA churches with hierarchy..."

  sede_mundial = Church.create!(
    codigo_totvs: '1001',
    nome: 'Sede Mundial - Deus é Amor',
    porte: 'ESTADUAL',
    endereco: 'Av. do Estado, 4567',
    bairro: 'Baixada do Glicério',
    municipio: 'São Paulo',
    estado: 'SP',
    cep: '01515-001',
    latitude: -23.5558,
    longitude: -46.6263,
    validada: true,
    link_google_maps: 'https://www.google.com/maps?q=-23.5558,-46.6263'
  )

  setor_santo_amaro = Church.create!(
    codigo_totvs: '1002',
    nome: 'IPDA Setorial Santo Amaro',
    porte: 'SETORIAL',
    endereco: 'Av. Santo Amaro, 1200',
    bairro: 'Santo Amaro',
    municipio: 'São Paulo',
    estado: 'SP',
    cep: '04701-000',
    latitude: -23.6300,
    longitude: -46.6950,
    validada: true,
    parent_church: sede_mundial
  )

  setor_campinas = Church.create!(
    codigo_totvs: '1003',
    nome: 'IPDA Central Campinas',
    porte: 'CENTRAL',
    endereco: 'Rua Francisco Glicério, 850',
    bairro: 'Centro',
    municipio: 'Campinas',
    estado: 'SP',
    cep: '13012-000',
    latitude: -22.9056,
    longitude: -47.0608,
    validada: true,
    parent_church: sede_mundial
  )

  Church.create!(
    codigo_totvs: '1004',
    nome: 'IPDA Local Socorro',
    porte: 'LOCAL',
    endereco: 'Rua Socorro, 120',
    bairro: 'Socorro',
    municipio: 'São Paulo',
    estado: 'SP',
    cep: '04760-000',
    latitude: -23.6620,
    longitude: -46.7080,
    validada: true,
    parent_church: setor_santo_amaro
  )

  Church.create!(
    codigo_totvs: '1005',
    nome: 'IPDA Casa de Oração Interlagos',
    porte: 'CASA DE ORAÇÃO',
    endereco: 'Av. Interlagos, 3400',
    bairro: 'Interlagos',
    municipio: 'São Paulo',
    estado: 'SP',
    cep: '04660-007',
    latitude: -23.6820,
    longitude: -46.6890,
    validada: false,
    parent_church: setor_santo_amaro
  )
end

puts "Seeding completed successfully. Total churches in database: #{Church.count}"
