.DEFAULT_GOAL := all

.PHONY: install
install:
	pip install -U pip pip-tools pre-commit
	pip install -U -r requirements/cli.txt
	pre-commit install

.PHONY: format
format:
	make -C cli format
	yarn format

.PHONY: lint
lint:
	make -C cli lint
	yarn lint

.PHONY: all
all: lint
