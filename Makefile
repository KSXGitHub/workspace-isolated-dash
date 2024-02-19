PROJECT = workspace-isolated-dash

UUID = `jq -r .uuid < src/metadata.json`

CP = rsync -aP

deps:
	pnpm install --frozen-lockfile

tsc: deps
	pnpm exec tsc

assets:
	mkdir -p dist/
	$(CP) src/metadata.json dist/metadata.json
	$(CP) src/COPYING dist/COPYING

build: tsc assets

install: clean build
	mkdir -p "$(HOME)/.local/share/gnome-shell/extensions/$(UUID)/"
	$(CP) dist/ "$(HOME)/.local/share/gnome-shell/extensions/$(UUID)/"

uninstall:
	rm -rf "$(HOME)/.local/share/gnome-shell/extensions/$(UUID)/"

clean:
	find . -type f -name '*~' -delete

.PHONY: deps tsc assets build install uninstall clean
