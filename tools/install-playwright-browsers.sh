#!/usr/bin/env bash
# Copyright 2026 Automate the Cloud Inc.
# SPDX-License-Identifier: Apache-2.0
#
# Installs Playwright's browsers and their system packages in CI.
#
# The runner's Ubuntu mirror has been slow enough to use up a whole job, so:
#
# - each try gets 8 minutes;
# - the system packages are installed as root, so that when time runs out,
#   apt-get itself is stopped and does not keep holding apt's lock against
#   the next try (a limit on the normal user cannot stop a root apt-get);
# - after a stopped try, apt finishes or undoes what it had half installed,
#   and the next try puts the first mirror in the runner's list last;
# - up to three tries for the packages, then three for the browsers.
#
# Usage: install-playwright-browsers.sh PATH-TO-PLAYWRIGHT
# where PATH-TO-PLAYWRIGHT is the package's node_modules/.bin/playwright.

set -uo pipefail

playwright=$(realpath "${1:?usage: install-playwright-browsers.sh PATH-TO-PLAYWRIGHT}")
browsers=(chromium firefox webkit)
mirrors=${APT_MIRRORS_FILE:-/etc/apt/apt-mirrors.txt} # override only to test this script
limit=${PLAYWRIGHT_INSTALL_LIMIT:-480} # seconds per try; lower only to test this script

# Moves the first mirror last. Mirrors carry explicit priorities
# ("priority:1"), so they are renumbered in the new order.
next_mirror() {
  if [ -f "$mirrors" ] && [ "$(wc -l <"$mirrors")" -gt 1 ]; then
    { tail -n +2 "$mirrors"; head -n 1 "$mirrors"; } |
      awk '{ sub(/priority:[0-9]+/, "priority:" NR); print }' |
      sudo tee "$mirrors.new" >/dev/null &&
      sudo mv "$mirrors.new" "$mirrors"
    echo "Next try uses these mirrors, in order: $(cut -f1 "$mirrors" | tr '\n' ' ')"
  fi
}

recover() {
  sudo pkill -x apt-get || true
  sudo dpkg --configure -a || true
}

for try in 1 2 3; do
  if sudo env "PATH=$PATH" timeout --kill-after=15 "$limit" "$playwright" install-deps "${browsers[@]}"; then
    packages=done
    break
  fi
  echo "System packages: try $try failed or took over $limit seconds."
  recover
  next_mirror
done
[ "${packages:-}" = done ] || exit 1

for try in 1 2 3; do
  timeout --kill-after=15 "$limit" "$playwright" install "${browsers[@]}" && exit 0
  echo "Browsers: try $try failed or took over $limit seconds."
done
exit 1
