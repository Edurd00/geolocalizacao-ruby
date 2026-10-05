ARG RUBY_VERSION=3.2.3
FROM ruby:$RUBY_VERSION-slim as base

WORKDIR /rails

# Dependências do sistema (build essencial, PostgreSQL e Node.js para assets)
RUN apt-get update -qq && \
    apt-get install --no-install-recommends -y \
      build-essential \
      libpq-dev \
      git \
      curl \
      libvips \
      nodejs && \
    rm -rf /var/lib/apt/lists /var/cache/apt/archives

# Estágio de Build
FROM base as build

# Configuração do Bundler
RUN gem install bundler -v 2.5.11

COPY Gemfile Gemfile.lock ./

RUN bundle config set --local deployment 'true' && \
    bundle config set --local without 'development test' && \
    bundle install

COPY . .

# Cria diretórios necessários para compilação de assets
RUN mkdir -p app/assets/builds public/assets
RUN chmod +x bin/*

# Garante que o tailwind precompile/build execute sem quebrar
RUN SECRET_KEY_BASE_DUMMY=1 ./bin/rails tailwindcss:build || true
RUN SECRET_KEY_BASE_DUMMY=1 ./bin/rails assets:precompile

# Estágio Final
FROM base

COPY --from=build /usr/local/bundle /usr/local/bundle
COPY --from=build /rails /rails

EXPOSE 3000
CMD ["./bin/rails", "server", "-b", "0.0.0.0"]
