#!/usr/bin/env bash
set -euo pipefail

replace_mode=0
if [ "$#" -eq 3 ] && { [ "$1" = "--update" ] || [ "$1" = "--repair" ]; }; then
  replace_mode=1
  shift
fi
if [ "$#" -ne 2 ] || [ "$1" != "--management-id" ] || ! [[ "$2" =~ ^[a-f0-9]{48}$ ]]; then
  printf '%s\n' "This packaged installer requires [--update|--repair] --management-id <48 lowercase hex>." >&2
  exit 64
fi

readonly management_id="$2"
readonly prefix="$HOME/.aihub-auggie"
readonly node_version="22.23.2"
readonly node_url="https://nodejs.org/dist/v22.23.2/node-v22.23.2-linux-x64.tar.xz"
readonly node_size="31058332"
readonly node_sha256="d60acfe00a2932254bb0ad20e01b0d74397a0875595de719654b214f4b03f307"
readonly auggie_version="0.34.0"
readonly auggie_url="https://registry.npmjs.org/@augmentcode/auggie/-/auggie-0.34.0.tgz"
readonly auggie_size="4024392"
readonly auggie_sha512="cabcd3fbdd912e457b9626eadc4033c2eeb8b5ac53e506725d14e3b9994f3bb29b6082a56028a4fed6e8b7fd8faccc0e4077fd904c632d29cd90a5f99bc3ac86"

if [ "$replace_mode" -eq 0 ] && { [ -e "$prefix" ] || [ -L "$prefix" ]; }; then
  printf 'Refusing existing managed prefix: %s\n' "$prefix" >&2
  exit 65
fi
if [ "$replace_mode" -eq 1 ]; then
  [ -d "$prefix" ] && [ ! -L "$prefix" ]
  [ -f "$prefix/.aihub-owner" ] && [ ! -L "$prefix/.aihub-owner" ]
  [ "$(cat -- "$prefix/.aihub-owner")" = "$management_id" ]
fi

umask 077
staging="$(mktemp -d "$HOME/.aihub-auggie.stage.XXXXXX")"
backup=""
previous_moved=0
success=0
cleanup() {
  status=$?
  if [ "$replace_mode" -eq 1 ] && [ "$success" -ne 1 ] && [ "$previous_moved" -eq 1 ] && [ -e "$backup" ]; then
    rm -rf -- "$prefix"
    mv --no-target-directory "$backup" "$prefix" || true
  fi
  if [ -n "${staging:-}" ] && { [ -e "$staging" ] || [ -L "$staging" ]; }; then
    rm -rf -- "$staging"
  fi
  exit "$status"
}
trap cleanup EXIT

readonly node_dir="$staging/tools/node-v$node_version"
readonly node_link="$staging/tools/node"
readonly bin_dir="$staging/bin"
readonly downloads="$staging/.downloads"
readonly node_archive="$downloads/node.tar.xz"
readonly auggie_archive="$downloads/auggie.tgz"
readonly marker="$staging/.aihub-owner"

mkdir -p "$node_dir" "$bin_dir" "$downloads" "$staging/cache/npm"

curl --fail --location --proto '=https' --proto-redir '=https' --tlsv1.2 \
  --max-filesize 33554432 --output "$node_archive" "$node_url"
[ "$(wc -c < "$node_archive")" -eq "$node_size" ]
printf '%s  %s\n' "$node_sha256" "$node_archive" | sha256sum --check --status

curl --fail --location --proto '=https' --proto-redir '=https' --tlsv1.2 \
  --max-filesize 8388608 --output "$auggie_archive" "$auggie_url"
[ "$(wc -c < "$auggie_archive")" -eq "$auggie_size" ]
printf '%s  %s\n' "$auggie_sha512" "$auggie_archive" | sha512sum --check --status

tar -xJf "$node_archive" --strip-components=1 -C "$node_dir"
[ "$("$node_dir/bin/node" --version)" = "v$node_version" ]
ln -s "node-v$node_version" "$node_link"

"$node_dir/bin/node" "$node_dir/lib/node_modules/npm/bin/npm-cli.js" \
  install --global --prefix "$node_dir" --ignore-scripts --omit=optional \
  --offline --cache "$staging/cache/npm" --no-audit --no-fund \
  --no-update-notifier "$auggie_archive"

set -o noclobber
cat > "$bin_dir/auggie" <<'EOF'
#!/usr/bin/env sh
export AUGMENT_DISABLE_AUTO_UPDATE=1
export PATH="$HOME/.aihub-auggie/tools/node/bin:$PATH"
if [ "$#" -eq 1 ] && [ "$1" = "--version" ]; then
  installed_version="$("$HOME/.aihub-auggie/tools/node-v22.23.2/bin/auggie" --version)" || exit $?
  case "$installed_version" in
    "0.34.0"|"0.34.0 "*) printf '%s\n' "0.34.0" ;;
    *) printf 'Unexpected Auggie version: %s\n' "$installed_version" >&2; exit 66 ;;
  esac
  exit 0
fi
exec "$HOME/.aihub-auggie/tools/node-v22.23.2/bin/auggie" "$@"
EOF
printf '%s\n' "$management_id" > "$marker"
set +o noclobber
chmod 700 "$bin_dir/auggie"
chmod 600 "$marker"

[ "$("$node_dir/bin/auggie" --version)" = "$auggie_version" ]
rm -rf -- "$downloads" "$staging/cache"

if [ "$replace_mode" -eq 1 ]; then
  backup="$(mktemp -d "$HOME/.aihub-auggie.backup.XXXXXX")"
  rmdir -- "$backup"
  mv --no-target-directory "$prefix" "$backup"
  previous_moved=1
  mv --no-target-directory "$staging" "$prefix"
else
  mv --no-clobber --no-target-directory "$staging" "$prefix"
fi
if [ -e "$staging" ] || [ -L "$staging" ]; then
  printf 'Managed prefix appeared during installation: %s\n' "$prefix" >&2
  exit 67
fi
staging=""

[ -d "$prefix" ] && [ ! -L "$prefix" ]
[ -f "$prefix/.aihub-owner" ] && [ ! -L "$prefix/.aihub-owner" ]
[ "$(cat -- "$prefix/.aihub-owner")" = "$management_id" ]
[ -f "$prefix/bin/auggie" ] && [ -x "$prefix/bin/auggie" ] && [ ! -L "$prefix/bin/auggie" ]
[ "$("$prefix/bin/auggie" --version)" = "$auggie_version" ]
success=1
if [ -n "$backup" ] && [ -e "$backup" ]; then
  rm -rf -- "$backup" || true
fi
