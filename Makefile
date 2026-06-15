NODE ?= node
NPM ?= npm
CXX ?= c++
CXXFLAGS ?= -std=c++20 -Wall -Wextra -pedantic -Iruntime -Iexamples -Iexamples/demos

BUILD_DIR := build
DEMO_BUILD_DIR := $(BUILD_DIR)/demos
EXAMPLE_JS := examples/housekeeping.js
EXAMPLE_CPP := $(BUILD_DIR)/housekeeping.cpp
EXAMPLE_BIN := $(BUILD_DIR)/housekeeping
RUNNER_CPP := examples/runner.cpp
DEMO_RUNNER_CPP := examples/demo_runner.cpp
DEMO_JS := $(sort $(wildcard examples/demos/*.js))

.PHONY: all install test check transpile-example compile-example run-example \
	demos-check demos-transpile demos-compile demos-run demos-validate \
	smoke clean dump-ir dump-ast docs

all: smoke

install:
	$(NPM) ci

test:
	$(NPM) test

check:
	$(NODE) ./src/cli.js $(EXAMPLE_JS) --check

$(BUILD_DIR):
	mkdir -p $(BUILD_DIR)

$(DEMO_BUILD_DIR):
	mkdir -p $(DEMO_BUILD_DIR)

$(EXAMPLE_CPP): $(EXAMPLE_JS) src/*.js package.json | $(BUILD_DIR)
	$(NODE) ./src/cli.js $(EXAMPLE_JS) --out $(EXAMPLE_CPP)

transpile-example: $(EXAMPLE_CPP)

compile-example: $(EXAMPLE_BIN)

$(EXAMPLE_BIN): $(EXAMPLE_CPP) $(RUNNER_CPP) runtime/satellite_os.hpp examples/drivers/eps.hpp
	$(CXX) $(CXXFLAGS) $(EXAMPLE_CPP) $(RUNNER_CPP) -o $(EXAMPLE_BIN)

run-example: $(EXAMPLE_BIN)
	./$(EXAMPLE_BIN) housekeeping

demos-check:
	@set -e; for f in $(DEMO_JS); do \
		echo "[check] $$f"; \
		$(NODE) ./src/cli.js "$$f" --check; \
	done

demos-transpile: | $(DEMO_BUILD_DIR)
	@set -e; for f in $(DEMO_JS); do \
		base=$$(basename "$$f" .js); \
		echo "[transpile] $$f -> $(DEMO_BUILD_DIR)/$$base.cpp"; \
		$(NODE) ./src/cli.js "$$f" --source-comments --out "$(DEMO_BUILD_DIR)/$$base.cpp"; \
	done

demos-compile: demos-transpile
	@set -e; for cpp in $(DEMO_BUILD_DIR)/*.cpp; do \
		base=$$(basename "$$cpp" .cpp); \
		echo "[compile] $$cpp -> $(DEMO_BUILD_DIR)/$$base"; \
		$(CXX) $(CXXFLAGS) "$$cpp" $(DEMO_RUNNER_CPP) -o "$(DEMO_BUILD_DIR)/$$base"; \
	done

demos-run: demos-compile
	@set -e; for bin in $(DEMO_BUILD_DIR)/[0-9][0-9]-*; do \
		if [ -x "$$bin" ] && [ ! -d "$$bin" ]; then \
			base=$$(basename "$$bin"); \
			echo "[run] $$base"; \
			"$$bin" "$$base"; \
		fi; \
	done

demos-validate: demos-check demos-run

smoke: test compile-example check demos-validate

dump-ir:
	$(NODE) ./src/cli.js $(EXAMPLE_JS) --dump-ir

dump-ast:
	$(NODE) ./src/cli.js $(EXAMPLE_JS) --dump-ast

docs:
	docmgr doctor --ticket SATELLITE-JS-CPP-TRANSPILER --stale-after 30

clean:
	rm -rf $(BUILD_DIR)
