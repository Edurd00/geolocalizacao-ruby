require_relative "boot"
require "rails/all"

module GeovaligIpda
  class Application < Rails::Application
    config.load_defaults 8.0

    config.time_zone = "America/Sao_Paulo"
    config.i18n.default_locale = :"pt-BR"
  end
end
