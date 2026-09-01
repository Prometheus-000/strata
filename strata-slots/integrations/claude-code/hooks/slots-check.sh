#!/usr/bin/env sh
# PostToolUse: after Claude edits a view surface or declaration, keep identity
# stamped and surface anything that stopped resolving.
#
# Silent on success. A hook that speaks every time is a hook people turn off.
set -e

INPUT=$(cat)
FILE=$(printf '%s' "$INPUT" | sed -n 's/.*"file_path"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p')
case "$FILE" in
  *.view.ts|*.tsx) ;;
  *) exit 0 ;;
esac

# Only act in a project that actually uses slots.
if [ ! -f slots.config.json ] && [ -z "$(find . -maxdepth 4 -name '*.view.ts' -not -path './node_modules/*' 2>/dev/null | head -1)" ]; then
  exit 0
fi

# Resolution order: the project's own install, then PATH, then the path
# `slots init` recorded. A hook that silently cannot find its binary is a hook
# that reports "nothing wrong" forever, which is worse than not being installed.
for CANDIDATE in "./node_modules/.bin/slots" "$(command -v slots 2>/dev/null)" "__SLOTS_BIN__"; do
  if [ -n "$CANDIDATE" ] && [ -x "$CANDIDATE" ]; then SLOTS="$CANDIDATE"; break; fi
done
if [ -z "${SLOTS:-}" ]; then
  printf 'slots: cannot find the `slots` binary — structural checks are not running.\n'
  printf '  fix with: npx slots init\n'
  exit 0
fi

# Stamp any new <Feature>. Unstamped features do not render, and the edit that
# added one is the moment to catch it.
# A non-zero exit here means it *found* something, not that it broke. Reporting
# it as a crash would teach everyone to ignore the line.
if ID_OUT=$("$SLOTS" id 2>&1); then
  ASSIGNED=$(printf '%s' "$ID_OUT" | grep -c '^  + ' || true)
  [ "$ASSIGNED" -gt 0 ] &&
    printf 'slots: stamped %s new feature id(s). Do not edit fid by hand.\n' "$ASSIGNED"
else
  printf 'slots: this edit left the view grammar inconsistent —\n'
  printf '%s\n' "$ID_OUT" | sed -n 's/^  ! /  /p'
  exit 0
fi

# Report only what is genuinely broken. Behavioural costs belong to the
# designer and are not this hook's business.
LINT=$("$SLOTS" lint 2>&1) || exit 0
DANGLING=$(printf '%s' "$LINT" | sed -n 's/.*· \([0-9]*\) dangling.*/\1/p')
DRIFT=$(printf '%s' "$LINT" | sed -n 's/.*dangling · \([0-9]*\) drifted.*/\1/p')
if [ "${DANGLING:-0}" -gt 0 ] || [ "${DRIFT:-0}" -gt 0 ]; then
  printf 'slots lint: %s assignment(s) no longer resolve, %s record(s) drifted.\n' "${DANGLING:-0}" "${DRIFT:-0}"
  printf '%s\n' "$LINT" | sed -n '/ASSIGNMENTS THAT NO LONGER RESOLVE/,/^$/p'
fi
exit 0
