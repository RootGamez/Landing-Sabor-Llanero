# Sabor Llanero — Makefile raíz
#
# Orquesta el monorepo (hoy: apps/web; en fases siguientes: apps/api y apps/cms,
# ver docs/BLUEPRINT.md). Pensado para correr desde una terminal simple sin
# herramientas de escritorio adicionales.
#
# Uso rápido:
#   make help    -> lista todos los comandos
#   make install -> instala dependencias
#   make web     -> levanta la landing en modo dev (:3000)
#   make build-web -> genera apps/web/out (export estático)

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

WEB_DIR := apps/web
# API_DIR := apps/api   # fase 3 (ver docs/BLUEPRINT.md §6)
# CMS_DIR := apps/cms   # fase 4 (ver docs/BLUEPRINT.md §6)

.DEFAULT_GOAL := help

.PHONY: help install web build-web typecheck clean

help: ## Muestra esta ayuda
	grep -E '^[a-zA-Z_-]+:.*?## ' $(MAKEFILE_LIST) | sort | awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-24s\033[0m %s\n", $$1, $$2}'

install: ## Instala todas las dependencias del monorepo (pnpm)
	pnpm install

## --- Desarrollo local ---

web: ## Levanta la landing (next dev en :3000)
	cd $(WEB_DIR) && pnpm dev

# api: ## Levanta la API completa (fase 3)
# 	cd $(API_DIR) && pnpm dev

# cms: ## Levanta el panel de administración (fase 4)
# 	cd $(CMS_DIR) && pnpm dev

# dev: ## Levanta web + api + cms juntos (fase 4)

## --- Calidad ---

typecheck: ## Corre tsc --noEmit (vía build) en todos los paquetes
	pnpm typecheck

build: ## Compila todas las apps del monorepo
	pnpm build

build-web: ## Compila la landing para producción (apps/web/out)
	cd $(WEB_DIR) && pnpm build

clean: ## Borra node_modules, .next, out y .wrangler de todo el monorepo
	find . -name node_modules -type d -prune -exec rm -rf {} +
	find . -name .next -type d -prune -exec rm -rf {} +
	find . -name out -type d -prune -exec rm -rf {} +
	find . -name .wrangler -type d -prune -exec rm -rf {} +
	echo "Limpio. Corré 'make install' de nuevo antes de levantar algo."
