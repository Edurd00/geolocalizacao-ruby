Rails.application.routes.draw do
  root "map#index"

  get "map/locations", to: "map#locations"

  get "validation", to: "validation#show"
  patch "validation/:id", to: "validation#update", as: :update_validation
  post "validation/extract_coords", to: "validation#extract_coords"

  get "organizacao", to: "organizacao#index"

  get "patrimonio", to: "patrimonio#index", as: :patrimonio_index
  get "patrimonio/:id", to: "patrimonio#show", as: :patrimonio
  patch "patrimonio/:id", to: "patrimonio#update", as: :update_patrimonio

  get "coligacoes", to: "coligacoes#index"
  get "relatorios", to: "relatorios#index"
end
