ARG RUBY_VERSION=3.2.3
FROM ruby:${RUBY_VERSION}-slim AS base

WORKDIR /rails

RUN groupadd --system rails && \
    useradd --system --gid rails --create-home --shell /usr/sbin/nologin rails

# Pacotes de execução e compilação
RUN apt-get update -qq && \
    apt-get install --no-install-recommends -y libpq5 libvips && \
    rm -rf /var/lib/apt/lists /var/cache/apt/archives

# Estágio de Build
FROM base AS build

RUN apt-get update -qq && \
    apt-get install --no-install-recommends -y build-essential libpq-dev && \
    rm -rf /var/lib/apt/lists /var/cache/apt/archives

# Garanta o Bundler correto
RUN gem install bundler -v 2.5.11

COPY Gemfile Gemfile.lock ./

RUN bundle config set --local deployment 'true' && \
    bundle config set --local without 'development test' && \
    bundle install

COPY . .
RUN chmod +x bin/* entrypoint.sh || chmod +x bin/*

# Estágio Final
FROM base

COPY --from=build /usr/local/bundle /usr/local/bundle
COPY --from=build --chown=rails:rails /rails /rails

RUN chmod +x /rails/entrypoint.sh

# Garante que os diretórios de execução existam e tenham permissão total de escrita para o usuário rails
RUN mkdir -p /rails/tmp/pids /rails/tmp/cache /rails/tmp/sockets /rails/db /rails/log && \
    chown -R rails:rails /rails/tmp /rails/db /rails/log && \
    chmod -R 775 /rails/tmp /rails/db /rails/log

ENV RAILS_ENV=production \
    RAILS_LOG_TO_STDOUT=true \
    RAILS_SERVE_STATIC_FILES=true

USER rails:rails

ENTRYPOINT ["/rails/entrypoint.sh"]
EXPOSE 3000
CMD ["./bin/rails", "server", "-b", "0.0.0.0"]
