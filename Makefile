NODE ?= node
NPM ?= npm
CXX ?= c++
CXXFLAGS ?= -std=c++20 -Wall -Wextra -pedantic -Iruntime -Iexamples

BUILD_DIR := build
EXAMPLE_JS := examples/housekeeping.js
EXAMPLE_CPP := $(BUILD_DIR)/housekeeping.cpp
EXAMPLE_BIN := $(BUILD_DIR)/housekeeping
RUNNER_CPP := examples/runner.cpp

.PHONY: all install test check transpile-example compile-example run-example smoke clean dump-ir dump-ast docs

all: smoke

install:
	$(NPM) ci

test:
	$(NPM) test

check:
	$(NODE) ./src/cli.js $(EXAMPLE_JS) --check

$(BUILD_DIR):
	mkdir -p $(BUILD_DIR)

$(EXAMPLE_CPP): $(EXAMPLE_JS) src/*.js package.json | $(BUILD_DIR)
	$(NODE) ./src/cli.js $(EXAMPLE_JS) --out $(EXAMPLE_CPP)

transpile-example: $(EXAMPLE_CPP)

compile-example: $(EXAMPLE_BIN)

$(EXAMPLE_BIN): $(EXAMPLE_CPP) $(RUNNER_CPP) runtime/satellite_os.hpp examples/drivers/eps.hpp
	$(CXX) $(CXXFLAGS) $(EXAMPLE_CPP) $(RUNNER_CPP) -o $(EXAMPLE_BIN)

run-example: $(EXAMPLE_BIN)
	./$(EXAMPLE_BIN)

smoke: test compile-example check

dump-ir:
	$(NODE) ./src/cli.js $(EXAMPLE_JS) --dump-ir

dump-ast:
	$(NODE) ./src/cli.js $(EXAMPLE_JS) --dump-ast

docs:
	docmgr doctor --ticket SATELLITE-JS-CPP-TRANSPILER --stale-after 30

clean:
	rm -rf $(BUILD_DIR)
