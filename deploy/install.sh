#!/usr/bin/env bash
# Sets Oche Arcade to start by itself, using this folder, the current user and their Node.
#   deploy/install.sh [--port 8090] [--board-url http://localhost:3180]
#   deploy/install.sh --uninstall
#   deploy/install.sh --dry-run     prints the service definition without changing anything
set -euo pipefail

SERVICE=oche-arcade
LAUNCHD_LABEL=com.ochearcade.server
MIN_NODE_MAJOR=18

port=8090
board_url=http://localhost:3180
dry_run=false
uninstall=false
platform=$(uname -s)

fail() {
  echo "Error: $1" >&2
  exit 1
}

need_value() {
  [[ $# -ge 2 ]] || fail "$1 needs a value"
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --port) need_value "$@"; port=$2; shift 2 ;;
    --board-url) need_value "$@"; board_url=$2; shift 2 ;;
    --platform) need_value "$@"; platform=$2; shift 2 ;;
    --dry-run) dry_run=true; shift ;;
    --uninstall) uninstall=true; shift ;;
    -h|--help) sed -n '2,5p' "$0" | sed 's/^# \{0,1\}//'; exit 0 ;;
    *) fail "unknown option: $1" ;;
  esac
done

[[ $port =~ ^[0-9]+$ ]] && (( port >= 1 && port <= 65535 )) || fail "--port must be a number from 1 to 65535"
[[ $board_url =~ ^https?://[^[:space:]\"\'\<\>\&]+$ ]] || fail "--board-url must look like http://localhost:3180"

app_dir=$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)
# Under sudo, the service should still run as the person who asked for it.
run_user=${SUDO_USER:-$(id -un)}

find_node() {
  local node major
  node=$(command -v node) || fail "Node isn't installed, or isn't on your PATH. Install Node $MIN_NODE_MAJOR or newer."
  major=$("$node" -p 'process.versions.node.split(".")[0]')
  (( major >= MIN_NODE_MAJOR )) || fail "Node $MIN_NODE_MAJOR or newer is needed, but $node is version $major."
  echo "$node"
}

as_root() {
  if [[ $(id -u) -eq 0 ]]; then "$@"; else sudo "$@"; fi
}

systemd_unit() {
  cat <<UNIT
[Unit]
Description=Oche Arcade darts games
After=network-online.target
Wants=network-online.target

[Service]
User=$run_user
WorkingDirectory=$app_dir
ExecStart="$1" server.js
Environment=PORT=$port
Environment=BOARD_URL=$board_url
Restart=always
RestartSec=3

[Install]
WantedBy=multi-user.target
UNIT
}

xml_escape() {
  local text=${1//&/&amp;}
  text=${text//</&lt;}
  echo "${text//>/&gt;}"
}

launchd_plist() {
  cat <<PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>$LAUNCHD_LABEL</string>
  <key>ProgramArguments</key>
  <array>
    <string>$(xml_escape "$1")</string>
    <string>server.js</string>
  </array>
  <key>WorkingDirectory</key>
  <string>$(xml_escape "$app_dir")</string>
  <key>EnvironmentVariables</key>
  <dict>
    <key>PORT</key>
    <string>$port</string>
    <key>BOARD_URL</key>
    <string>$board_url</string>
  </dict>
  <key>RunAtLoad</key>
  <true/>
  <key>KeepAlive</key>
  <true/>
</dict>
</plist>
PLIST
}

install_linux() {
  command -v systemctl >/dev/null || fail "this installer needs systemd. You can still run the app with: npm start"
  local unit=/etc/systemd/system/$SERVICE.service
  systemd_unit "$1" | as_root tee "$unit" >/dev/null
  as_root systemctl daemon-reload
  as_root systemctl enable "$SERVICE"
  as_root systemctl restart "$SERVICE"
  echo "Installed. It now starts on boot, running as $run_user from $app_dir."
  echo "Logs: journalctl -u $SERVICE -f"
}

uninstall_linux() {
  as_root systemctl disable --now "$SERVICE" 2>/dev/null || true
  as_root rm -f "/etc/systemd/system/$SERVICE.service"
  as_root systemctl daemon-reload
  echo "Removed. Your files in $app_dir haven't been touched."
}

plist_path() {
  echo "$HOME/Library/LaunchAgents/$LAUNCHD_LABEL.plist"
}

install_macos() {
  local plist
  plist=$(plist_path)
  mkdir -p "$(dirname "$plist")"
  launchctl bootout "gui/$(id -u)/$LAUNCHD_LABEL" 2>/dev/null || true
  launchd_plist "$1" >"$plist"
  launchctl bootstrap "gui/$(id -u)" "$plist"
  echo "Installed. It now starts when $run_user logs in, running from $app_dir."
}

uninstall_macos() {
  launchctl bootout "gui/$(id -u)/$LAUNCHD_LABEL" 2>/dev/null || true
  rm -f "$(plist_path)"
  echo "Removed. Your files in $app_dir haven't been touched."
}

case "$platform" in
  Linux|linux) target=linux ;;
  Darwin|macos) target=macos ;;
  *) fail "no installer for $platform yet. You can still run the app with: npm start" ;;
esac

if $uninstall; then
  "uninstall_$target"
  exit 0
fi

node_path=$(find_node)

if $dry_run; then
  case "$target" in
    linux) systemd_unit "$node_path" ;;
    macos) launchd_plist "$node_path" ;;
  esac
  exit 0
fi

"install_$target" "$node_path"
echo "Open http://<this-machine's-address>:$port in a browser on the same network."
