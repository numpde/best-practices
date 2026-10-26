PORT ?= 8000

.PHONY: check serve
check:
	node tools/check.mjs

serve:
	python3 -m http.server --bind 127.0.0.1 --directory docs $(PORT)
