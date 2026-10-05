ARG RUBY_VERSION=3.2.3
FROM ruby:$RUBY_VERSION-slim as base

WORKDIR /rails

# Pacotes de execução e compilação
RUN apt-get update -qq && \
    apt-get install --no-install-recommends -y build-essential libpq-dev git curl libvips && \
    rm -rf /var/lib/apt/lists /var/cache/apt/archives

# Estágio de Build
FROM base as build

# Garanta o Bundler correto
RUN gem install bundler -v 2.5.11

COPY Gemfile Gemfile.lock ./

RUN bundle config set --local deployment 'true' && \
    bundle config set --local without 'development test' && \
    bundle install

COPY . .

# Precompilação de assets
RUN chmod +x bin/*
RUN SECRET_KEY_BASE_DUMMY=1 ./bin/rails assets:precompile

# Estágio Final
FROM base

COPY --from=build /usr/local/bundle /usr/local/bundle
COPY --from=build /rails /rails

EXPOSE 3000
CMD ["./bin/rails", "server", "-b", "0.0.0.0"]
