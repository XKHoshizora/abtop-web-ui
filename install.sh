#!/bin/sh
# abtop-web-ui installer — downloads the prebuilt binary for this platform.
#   curl --proto '=https' --tlsv1.2 -LsSf \
#     https://raw.githubusercontent.com/XKHoshizora/abtop-web-ui/master/install.sh | sh
#
# Override the install dir with ABTOP_WEB_UI_BIN (default ~/.local/bin).
set -eu

REPO="XKHoshizora/abtop-web-ui"
BIN_DIR="${ABTOP_WEB_UI_BIN:-$HOME/.local/bin}"

os=$(uname -s)
arch=$(uname -m)
case "$os" in
  Linux)
    case "$arch" in
      x86_64) target="x86_64-unknown-linux-gnu" ;;
      aarch64 | arm64) target="aarch64-unknown-linux-gnu" ;;
      *) echo "unsupported architecture: $arch" >&2; exit 1 ;;
    esac ;;
  Darwin)
    case "$arch" in
      x86_64) target="x86_64-apple-darwin" ;;
      arm64) target="aarch64-apple-darwin" ;;
      *) echo "unsupported architecture: $arch" >&2; exit 1 ;;
    esac ;;
  *)
    echo "unsupported OS: $os (Linux and macOS only; on Windows build from source)" >&2
    exit 1 ;;
esac

url="https://github.com/$REPO/releases/latest/download/abtop-web-ui-$target.tar.gz"
tmp=$(mktemp -d)
trap 'rm -rf "$tmp"' EXIT

echo "Downloading $url"
curl --proto '=https' --tlsv1.2 -fLsS "$url" -o "$tmp/pkg.tar.gz"
tar -xzf "$tmp/pkg.tar.gz" -C "$tmp"

mkdir -p "$BIN_DIR"
install -m 0755 "$tmp/abtop-web-ui" "$BIN_DIR/abtop-web-ui"
echo "Installed abtop-web-ui to $BIN_DIR/abtop-web-ui"

case ":$PATH:" in
  *":$BIN_DIR:"*) ;;
  *) echo "Note: add $BIN_DIR to your PATH to run 'abtop-web-ui' directly." ;;
esac

echo ""
echo "Next:"
echo "  abtop-web-ui --open                 # run locally"
echo "  abtop-web-ui deploy                 # install as a systemd service (asks local vs public)"
