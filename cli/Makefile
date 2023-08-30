.DEFAULT_GOAL := all
sources = smokeshow tests

.PHONY: format
format:
	ruff --fix-only $(sources)
	black $(sources)

.PHONY: lint
lint:
	ruff $(sources)
	black $(sources) --check --diff

.PHONY: mypy
mypy:
	mypy --version
	mypy smokeshow

.PHONY: test
test:
	coverage run -m pytest

.PHONY: test-live
test-live:
	pytest tests/test_live.py --cf-auth-client --cf-wrangler-dir ..

.PHONY: testcov
testcov: test
	@echo "building coverage html"
	@coverage html

.PHONY: all
all: lint mypy testcov

.PHONY: clean
clean:
	rm -rf `find . -name __pycache__`
	rm -f `find . -type f -name '*.py[co]' `
	rm -f `find . -type f -name '*~' `
	rm -f `find . -type f -name '.*~' `
	rm -rf .cache
	rm -rf .pytest_cache
	rm -rf .mypy_cache
	rm -rf htmlcov
	rm -rf *.egg-info
	rm -f .coverage
	rm -f .coverage.*
	rm -rf build
	rm -rf dist
	rm -rf site
