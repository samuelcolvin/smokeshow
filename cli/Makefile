.DEFAULT_GOAL := all
sources = smokeshow tests

.PHONY: .uv
.uv:
	@uv --version || echo 'Please install uv: https://docs.astral.sh/uv/getting-started/installation/'

.PHONY: .pre-commit
.pre-commit:
	@pre-commit -V || echo 'Please install pre-commit: https://pre-commit.com/'

.PHONY: install
install: .uv .pre-commit
	uv sync --frozen

.PHONY: format
format:
	uv run ruff format
	uv run ruff check --fix --fix-only

.PHONY: lint
lint:
	uv run ruff format --check
	uv run ruff check

.PHONY: typecheck
typecheck:
	pyright --version
	pyright smokeshow

.PHONY: test
test:
	uv run coverage run -m pytest

.PHONY: test-live
test-live:
	uv run pytest tests/test_live.py --cf-auth-client --cf-wrangler-dir ..

.PHONY: testcov
testcov: test
	@echo "building coverage html"
	@uv run coverage html

.PHONY: all
all: lint typecheck testcov
