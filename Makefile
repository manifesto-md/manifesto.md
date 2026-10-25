.PHONY: install build dev check deploy
install: ; npm ci
build: ; npm run build
dev: ; npm run dev
check: build ; test -f dist/index.html && test -f dist/badge/aop.json && node -e "const c=JSON.parse(require('fs').readFileSync('dist/index.json','utf8')); console.log(c.count, 'entries')"
deploy: build ; npx wrangler deploy
