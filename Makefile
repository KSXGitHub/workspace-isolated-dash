PROJECT = workspace-isolated-dash

UUID = `jq -r .uuid < src/metadata.json`

CP = rsync -aP

install: clean
	mkdir -p "$(HOME)/.local/share/gnome-shell/extensions/$(UUID)/"
	$(CP) $(PROJECT)/ "$(HOME)/.local/share/gnome-shell/extensions/$(UUID)/"

uninstall:
	rm -rf "$(HOME)/.local/share/gnome-shell/extensions/$(UUID)/"

clean:
	find . -type f -name '*~' -delete

.PHONY: install uninstall clean
