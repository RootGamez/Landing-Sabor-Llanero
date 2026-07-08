# Sabor Llanero — Makefile raíz
#
# Orquesta las 3 apps del monorepo (api, web, cms) para desarrollo local y
# despliegue a Cloudflare. Recursos reales de la cuenta:
#   D1 -> sabor-llanero | R2 -> sabor-llanero | Worker -> sabor-llanero-api
#
# Uso rápido:
#   make help            -> lista todos los comandos
#   make init            -> deja TODO listo para desarrollar (deps + env + DB local con seed)
#   make api / web / cms -> levanta cada app por separado
#   make dev             -> levanta las 3 apps juntas
#
# Despliegue a producción (una sola vez, en orden):
#   make secrets -> db-migrate-remote -> db-seed-remote
#   -> create-owner-remote EMAIL=.. PASSWORD=.. NAME=.. -> deploy-api

# En Windows, make usa cmd.exe por defecto sin importar desde qué terminal se
# invoque (PowerShell, cmd o Git Bash). Forzamos el bash real de Git for Windows
# para que las recetas (cp, test, trap, etc.) funcionen igual en todos lados.
ifeq ($(OS),Windows_NT)
	SHELL := C:/Program Files/Git/bin/bash.exe
else
	SHELL := /bin/bash
endif
.ONESHELL:
.SHELLFLAGS := -eu -o pipefail -c
MAKEFLAGS += --no-print-directory

API_DIR := apps/api
WEB_DIR := apps/web
CMS_DIR := apps/cms
D1_NAME := sabor-llanero

.DEFAULT_GOAL := help

.PHONY: help init install env \
	api web cms dev \
	db-migrate-local db-seed-local create-owner \
	typecheck lint build build-web clean \
	cf-login secrets db-migrate-remote db-seed-remote create-owner-remote deploy-api

help: ## Muestra esta ayuda
	grep -E '^[a-zA-Z_-]+:.*?## ' $(MAKEFILE_LIST) | sort | awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-24s\033[0m %s\n", $$1, $$2}'

init: install env db-migrate-local db-seed-local ## Inicializa todo: deps + .env/.dev.vars + migraciones y seed en D1 local
	echo ""
	echo "Listo para desarrollar. Siguientes pasos:"
	echo "  make create-owner EMAIL=tu@email.com PASSWORD=algo NAME=\"Tu Nombre\"   (usuario del CMS)"
	echo "  make dev   -> api (:8787) + web (:3000) + cms (:5174)"

install: ## Instala todas las dependencias del monorepo (pnpm)
	pnpm install

env: ## Crea los .env / .dev.vars locales a partir de los .example (si no existen)
	test -f $(API_DIR)/.dev.vars || cp $(API_DIR)/.dev.vars.example $(API_DIR)/.dev.vars
	test -f $(WEB_DIR)/.env || cp $(WEB_DIR)/.env.example $(WEB_DIR)/.env
	test -f $(CMS_DIR)/.env || cp $(CMS_DIR)/.env.example $(CMS_DIR)/.env
	echo "Env listos. Revisá $(API_DIR)/.dev.vars y poné un JWT_SECRET real (no el de ejemplo)."

## --- Desarrollo local: un comando por app, hace todo lo necesario ---

api: env db-migrate-local ## Levanta la API completa (migraciones + wrangler dev en :8787)
	cd $(API_DIR) && pnpm dev

web: env ## Levanta la landing (next dev en :3000)
	cd $(WEB_DIR) && pnpm dev

cms: env ## Levanta el panel de administración (vite dev en :5174)
	cd $(CMS_DIR) && pnpm dev

dev: env db-migrate-local ## Levanta api + web + cms juntos (Ctrl+C corta las 3)
	echo "Iniciando api (:8787), web (:3000) y cms (:5174)... Ctrl+C para cortar todo."
	trap 'kill 0' EXIT INT TERM
	(cd $(API_DIR) && pnpm dev) &
	(cd $(WEB_DIR) && pnpm dev) &
	(cd $(CMS_DIR) && pnpm dev) &
	wait

## --- Base de datos local (D1 vía Miniflare) ---

db-migrate-local: ## Aplica las migraciones de D1 en local (idempotente)
	cd $(API_DIR) && pnpm wrangler d1 migrations apply $(D1_NAME) --local

db-seed-local: ## Carga el seed (tamaños, categorías, whatsapp_config) en D1 local
	cd $(API_DIR) && pnpm wrangler d1 execute $(D1_NAME) --local --file=./seed.sql

create-owner: ## Crea el usuario owner en D1 local. Uso: make create-owner EMAIL=x PASSWORD=y NAME="Z"
	test -n "$(EMAIL)" && test -n "$(PASSWORD)" && test -n "$(NAME)" || { echo 'Uso: make create-owner EMAIL=owner@x.com PASSWORD=algo NAME="Nombre"'; exit 1; }
	cd $(API_DIR)
	SQL=$$(pnpm exec tsx scripts/create-owner.ts "$(EMAIL)" "$(PASSWORD)" "$(NAME)" | tail -1)
	pnpm wrangler d1 execute $(D1_NAME) --local --command "$$SQL"
	echo "Owner creado en local: $(EMAIL)"

## --- Calidad ---

typecheck: ## Corre tsc --noEmit en todos los paquetes
	pnpm typecheck

lint: ## Corre eslint en todo el repo
	pnpm lint

build: ## Compila todas las apps del monorepo (web -> out/, cms -> dist/)
	pnpm build

build-web: ## Compila solo la landing para producción (apps/web/out)
	cd $(WEB_DIR) && pnpm build

clean: ## Borra node_modules, dist, out, .next y .wrangler de todo el monorepo
	find . -name node_modules -type d -prune -exec rm -rf {} +
	find . -name dist -type d -prune -exec rm -rf {} +
	find . -name out -type d -prune -exec rm -rf {} +
	find . -name .next -type d -prune -exec rm -rf {} +
	find . -name .wrangler -type d -prune -exec rm -rf {} +
	echo "Limpio. Corré 'make init' de nuevo antes de levantar algo."

## --- Despliegue a Cloudflare (producción) ---
## El D1 y el R2 ya existen en la cuenta ("sabor-llanero"); apps/api/wrangler.toml
## ya apunta a ellos con el database_id real.

cf-login: ## Inicia sesión en tu cuenta de Cloudflare (abre el navegador)
	cd $(API_DIR) && pnpm wrangler login

secrets: ## Configura el JWT_SECRET de producción (prompt interactivo)
	cd $(API_DIR) && pnpm wrangler secret put JWT_SECRET --env production

db-migrate-remote: ## Aplica las migraciones en la base D1 real de Cloudflare
	cd $(API_DIR) && pnpm wrangler d1 migrations apply $(D1_NAME) --env production --remote

db-seed-remote: ## Carga el seed en la base D1 real (idempotente, solo hace falta la primera vez)
	cd $(API_DIR) && pnpm wrangler d1 execute $(D1_NAME) --env production --remote --file=./seed.sql

create-owner-remote: ## Crea el owner en producción. Uso: make create-owner-remote EMAIL=x PASSWORD=y NAME="Z"
	test -n "$(EMAIL)" && test -n "$(PASSWORD)" && test -n "$(NAME)" || { echo 'Uso: make create-owner-remote EMAIL=owner@x.com PASSWORD=algo NAME="Nombre"'; exit 1; }
	cd $(API_DIR)
	SQL=$$(pnpm exec tsx scripts/create-owner.ts "$(EMAIL)" "$(PASSWORD)" "$(NAME)" | tail -1)
	pnpm wrangler d1 execute $(D1_NAME) --env production --remote --command "$$SQL"
	echo "Owner creado en producción: $(EMAIL)"

deploy-api: ## Despliega el Worker sabor-llanero-api a Cloudflare
	cd $(API_DIR) && pnpm run deploy
