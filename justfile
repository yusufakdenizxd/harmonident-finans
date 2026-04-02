default:
    @just --list

run:
    uv run python app.py

build-macos:
	uv pip install pyinstaller
	uv run pyinstaller --onefile --windowed --name "HarmoniFinans" --clean app.py

build-windows:
	@echo "Use GitHub Actions to build Windows exe"
	@echo "Go to: https://github.com/$(git remote get-url origin | sed 's/.*github\.com[/:]\([^.]*\).*/\1/' | sed 's/.*://')/actions/workflows/build.yml"
	@echo "Or push to main and create a tag v* to trigger build"

build-all: build-macos build-windows
