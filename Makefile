.DEFAULT_GOAL := all
isort = isort tests
black = black -S -l 120 --target-version py37 tests

.PHONY: install
install:
	python3 -m pip install -U setuptools pip wheel
	pip install -U -r tests/requirements-linting.txt
	pip install -U -r tests/requirements-testing.txt

.PHONY: format
format:
	$(isort)
	$(black)

.PHONY: lint
lint:
	flake8 tests
	$(isort) --check-only --df
	$(black) --check --diff

.PHONY: test
test:
	pytest

.PHONY: all
all: lint test
