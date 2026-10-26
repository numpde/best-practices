PORT ?= 8000

.PHONY: check check-browser serve
check:
	node tools/check.mjs

check-browser:
	node tools/check-browser.mjs $(BROWSER_ARGS)

serve:
	python3 -m http.server --bind 127.0.0.1 --directory docs $(PORT)
