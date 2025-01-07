.DEFAULT_GOAL := all

.PHONY: install
install:
	make -C cli install
	pre-commit install

.PHONY: format-js
format-js:
	npm run format

.PHONY: format
format: format-js
	make -C cli format

.PHONY: lint-js
lint-js:
	npm run lint

.PHONY: lint
lint: lint-js
	make -C cli lint

.PHONY: all
all: lint
