# Builder: install, run and test.
#
#   make install   one-time setup: Rust wasm target, wasm-bindgen, npm packages
#   make start     build the kernel and start the dev server in the background
#   make stop      stop the background dev server
#   make status    show whether it is running, and where
#   make dev       run the dev server in the foreground (Ctrl+C to stop)
#   make test      kernel and app tests
#
# Override the address with HOST and PORT, e.g. `make start PORT=8080`.

WASM_BINDGEN_VERSION := 0.2.129
HOST ?= localhost
PORT ?= 5173

RUN_DIR := .run
PID_FILE := $(RUN_DIR)/dev.pid
LOG_FILE := $(RUN_DIR)/dev.log
VITE := node_modules/.bin/vite

.DEFAULT_GOAL := help
.PHONY: help install check kernel start stop restart status logs dev test build clean

help: ## List the targets
	@grep -E '^[a-z-]+:.*## ' $(MAKEFILE_LIST) | awk 'BEGIN {FS = ":.*## "} {printf "  make %-9s %s\n", $$1, $$2}'

install: ## One-time setup of the toolchain and packages
	@command -v cargo >/dev/null || { echo "Rust is missing. Install it from https://rustup.rs"; exit 1; }
	@command -v npm >/dev/null || { echo "Node.js is missing. Install Node 20 or newer."; exit 1; }
	rustup target add wasm32-unknown-unknown
	@if [ "$$(wasm-bindgen --version 2>/dev/null)" != "wasm-bindgen $(WASM_BINDGEN_VERSION)" ]; then \
		echo "Installing wasm-bindgen-cli $(WASM_BINDGEN_VERSION) (takes a few minutes)"; \
		cargo install wasm-bindgen-cli --version $(WASM_BINDGEN_VERSION) --locked; \
	else echo "wasm-bindgen $(WASM_BINDGEN_VERSION) already installed"; fi
	npm ci
	@echo "Done. Run 'make start'."

check: ## Verify the toolchain is ready
	@command -v cargo >/dev/null || { echo "cargo not found: run 'make install'"; exit 1; }
	@rustup target list --installed | grep -q wasm32-unknown-unknown || { echo "wasm32 target missing: run 'make install'"; exit 1; }
	@[ "$$(wasm-bindgen --version 2>/dev/null)" = "wasm-bindgen $(WASM_BINDGEN_VERSION)" ] || { echo "wasm-bindgen $(WASM_BINDGEN_VERSION) missing: run 'make install'"; exit 1; }
	@[ -x $(VITE) ] || { echo "npm packages missing: run 'make install'"; exit 1; }

kernel: check ## Build the Rust kernel to WebAssembly
	node scripts/build-kernel.mjs

start: kernel ## Build the kernel and start the dev server in the background
	@mkdir -p $(RUN_DIR)
	@if [ -f $(PID_FILE) ] && kill -0 $$(cat $(PID_FILE)) 2>/dev/null; then \
		echo "Already running (pid $$(cat $(PID_FILE))). Use 'make restart' to rebuild and restart."; exit 0; fi; \
	nohup $(VITE) --host $(HOST) --port $(PORT) --strictPort > $(LOG_FILE) 2>&1 & echo $$! > $(PID_FILE); \
	for i in $$(seq 1 75); do \
		if ! kill -0 $$(cat $(PID_FILE)) 2>/dev/null; then \
			echo "The dev server exited (is port $(PORT) in use?). Last lines of $(LOG_FILE):"; \
			tail -n 20 $(LOG_FILE); rm -f $(PID_FILE); exit 1; fi; \
		if grep -q "ready in" $(LOG_FILE); then \
			url=$$(grep -o 'http://[^ ]*' $(LOG_FILE) | head -n 1); \
			echo "Builder is running at $${url:-http://$(HOST):$(PORT)/} (pid $$(cat $(PID_FILE)), log $(LOG_FILE))"; exit 0; fi; \
		sleep 0.2; \
	done; \
	echo "Started (pid $$(cat $(PID_FILE))) but it has not reported ready after 15 s; see $(LOG_FILE)"

stop: ## Stop the background dev server
	@if [ ! -f $(PID_FILE) ]; then echo "Not running."; exit 0; fi; \
	pid=$$(cat $(PID_FILE)); \
	if kill -0 $$pid 2>/dev/null; then \
		kill $$pid; \
		for i in $$(seq 1 25); do kill -0 $$pid 2>/dev/null || break; sleep 0.2; done; \
		if kill -0 $$pid 2>/dev/null; then kill -9 $$pid; fi; \
		echo "Stopped (pid $$pid)."; \
	else echo "Not running (removed a stale pid file)."; fi; \
	rm -f $(PID_FILE)

restart: stop start ## Rebuild the kernel and restart the dev server

status: ## Show whether the dev server is running
	@if [ -f $(PID_FILE) ] && kill -0 $$(cat $(PID_FILE)) 2>/dev/null; then \
		echo "Running at http://$(HOST):$(PORT)/ (pid $$(cat $(PID_FILE)), log $(LOG_FILE))"; \
	else echo "Not running."; fi

logs: ## Follow the dev server log
	@tail -f $(LOG_FILE)

dev: kernel ## Run the dev server in the foreground
	$(VITE) --host $(HOST) --port $(PORT)

test: kernel ## Run kernel, app and survey tests
	cargo test --workspace
	npm run typecheck
	npm test
	uv run --project survey pytest survey/tests

build: kernel ## Production build into dist/
	npm run typecheck
	$(VITE) build

clean: stop ## Remove build output (keeps installed packages)
	cargo clean
	rm -rf dist app/src/kernel/pkg $(RUN_DIR)
