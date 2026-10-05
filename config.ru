# Rack entry point used by Puma and Rails in production.
require_relative "config/environment"

run Rails.application
Rails.application.load_server
