# GEO-VALIG IPDA

Sistema de geolocalização e gestão de dados das igrejas IPDA. A interface e os serviços estão em migração de Next.js/TypeScript para Ruby on Rails. O objetivo final é manter páginas, regras de negócio e acesso a dados em Rails, com Leaflet para mapas.

> **Estado da migração (outubro de 2026):** o Rails contém um mapa Leaflet básico e uma tela de validação de coordenadas. Os módulos de gestão, patrimônio, coligações, organização, relatórios e autenticação ainda estão implementados no Next.js; eles ainda não foram migrados. Neste momento, não remova `src/` nem `package.json`: o deploy Rails ainda não substitui todas as funções do sistema.

## Para quem está começando

- **Ruby** é a linguagem; **Rails** organiza a aplicação web em rotas, controllers, models e views.
- `config/routes.rb` liga URLs a controllers.
- `app/controllers/` recebe requisições e coordena as ações.
- `app/models/` representa dados do banco; `app/services/` contém operações isoladas, como extração de coordenadas.
- `app/views/` contém HTML gerado pelo Rails.
- `public/` contém arquivos estáticos entregues diretamente, incluindo os arquivos usados hoje pelo mapa Rails.
- `src/` contém a aplicação Next.js antiga e os módulos que ainda aguardam migração.

## Funcionalidades e estado

| Módulo | Estado no Rails | Implementação atual |
| --- | --- | --- |
| Mapa Leaflet e pontos de igrejas | Parcial | `MapController`, `Church` e `public/application.js` |
| Validação e extração de coordenadas | Parcial | `ValidationController` e `ExtractCoordinatesService` |
| Gestão de igrejas e contatos | A migrar | Next.js em `src/app/gestao` e `src/app/api/igrejas` |
| Patrimônio e BI | A migrar | Next.js em `src/app/gestao-patrimonio`, `src/app/patrimonio` e `src/app/api/patrimonio` |
| Coligações e hierarquia | A migrar | Next.js em `src/app/coligacoes` e `src/app/api/coligacoes` |
| Organização pública | A migrar | Next.js em `src/app/organizacao` |
| Relatórios | A migrar | Next.js em `src/app/relatorios` |
| Login e autorização | A migrar | Next.js em `src/app/login` e `src/app/api/auth` |

## Executar para desenvolvimento sem instalar Ruby

É necessário ter **Docker Desktop** com Docker Compose disponível. Ruby, Rails e PostgreSQL serão executados nos containers.

1. Crie um arquivo `.env` na raiz. Não envie esse arquivo para o Git:

   ```env
   DB_USERNAME=postgres
   DB_PASSWORD=troque-por-uma-senha-forte
   DB_NAME=geovalig_ipda_production
   SECRET_KEY_BASE=gere-um-segredo-aleatorio-longo
   ```

   Gere um segredo aleatório dentro de um container Ruby (não é necessário instalar Ruby no computador):

   ```sh
   docker run --rm ruby:3.2-alpine ruby -rsecurerandom -e "puts SecureRandom.hex(64)"
   ```

   Copie o valor impresso para `SECRET_KEY_BASE`. Nunca reutilize o texto de exemplo como segredo.

2. Inicie os serviços:

   ```sh
   docker compose up --build
   ```

3. Abra `http://localhost:3000`.

4. Para encerrar, pressione `Ctrl+C`; para executar em segundo plano, use `docker compose up --build -d`, e para parar use `docker compose down`.

O serviço PostgreSQL local criado pelo Compose começa vazio. O repositório ainda não inclui migrations ou seeds que criem e preencham a tabela `igrejas`; portanto, para ver dados reais no mapa, configure uma base de dados que tenha o esquema e os dados esperados. Faça backup antes de conectar qualquer ambiente com dados reais. Não use credenciais de produção em desenvolvimento.

## Deploy de teste

O deploy Rails requer uma imagem Docker com a mesma versão Ruby definida em `Gemfile` e `Dockerfile`, PostgreSQL acessível à aplicação e as variáveis `DATABASE_URL` (ou `DB_HOST`, `DB_PORT`, `DB_USERNAME`, `DB_PASSWORD`, `DB_NAME`) e `SECRET_KEY_BASE` configuradas no provedor. Configure também `RAILS_SERVE_STATIC_FILES=true` e `RAILS_LOG_TO_STDOUT=true`.

O processo Rails atual não executa migrations automaticamente. Como migrations/schema e seeds ainda não estão no repositório, prepare o banco de teste com o esquema compatível antes de iniciar a aplicação. Confirme os logs do serviço web e a rota `/map/locations` no ambiente de teste.

## Estrutura

```text
app/
  controllers/       # Controllers Rails atuais
  javascript/        # Controllers Stimulus em desenvolvimento; não são o bundle servido no momento
  models/            # Modelos Active Record
  services/          # Serviços Ruby
  views/             # Templates ERB Rails
config/              # Inicialização, ambiente, banco e rotas Rails
public/              # Arquivos estáticos servidos pelo Rails
src/                 # Aplicação Next.js ainda não migrada
verification/        # Verificações legadas; revisar/substituir durante a migração
Dockerfile           # Imagem da aplicação Rails
docker-compose.yml   # Rails e PostgreSQL para desenvolvimento/teste
Gemfile              # Dependências Ruby
```

## Convenções para contribuir

1. Migre um módulo por vez: documente suas telas, permissões, endpoints, regras e tabelas antes de substituir a versão Next.js.
2. Mantenha a lógica de negócio em services/models Rails; controllers devem validar a entrada e escolher a resposta HTTP.
3. Use migrations versionadas e seeds apenas para dados fictícios/reprodutíveis. Não inclua dados pessoais ou cópias do banco real.
4. Valide parâmetros, trate erros com respostas compreensíveis e não exponha mensagens internas, tokens ou dados pessoais nos logs.
5. Mantenha os mapas acessíveis em celular, teclado e leitores de tela; informe carregamento e erros de dados e valide as coordenadas.
6. Atualize esta tabela e as instruções quando um módulo for migrado. Remova o Next.js somente depois da paridade funcional e da confirmação dos usuários.

## Tecnologias

- Aplicação alvo: Ruby 3.2.3, Rails 8, PostgreSQL, Puma, Hotwire/Stimulus e Leaflet.
- Aplicação ainda existente durante a migração: Next.js 16, React 19 e TypeScript.

## Autoria

Projeto idealizado por Luiz Eduardo Rodrigues da Silva para apoiar a gestão geográfica e patrimonial da IPDA.
