require 'json'

json_path = Rails.root.join('backup_igrejas_completo.json')

if File.exist?(json_path)
  file_content = File.read(json_path)
  data = JSON.parse(file_content) rescue []

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

  puts "Seeding completed successfully. Total churches in database: #{Igreja.count}"
else
  puts "backup_igrejas_completo.json not found at #{json_path}"
end
