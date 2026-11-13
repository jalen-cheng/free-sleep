#!/bin/bash
# Removes the WAN block.
#
# Usage:
#   sh unblock_internet_access.sh               Unblock and stay unblocked after a reboot
#   sh unblock_internet_access.sh --temporary   Unblock until the next reboot or re-block.
#                                               Used by update.sh, so an interrupted update
#                                               still comes back up blocked.

SCRIPT_DIR=$(cd "$(dirname "$0")" && pwd)
. "$SCRIPT_DIR/firewall_common.sh"

TEMPORARY=false
if [ "${1:-}" = "--temporary" ]; then
  TEMPORARY=true
fi

echo "Unblocking internet access..."

# Flushes the filter and nat tables for one of iptables / ip6tables.
# The nat table is missing on some kernels, so failures there are ignored.
flush_firewall_tables() {
  firewall_command="$1"
  if ! command -v "$firewall_command" > /dev/null 2>&1; then
    return 0
  fi
  "$firewall_command" -F
  "$firewall_command" -X
  "$firewall_command" -t nat -F 2>/dev/null || true
  "$firewall_command" -t nat -X 2>/dev/null || true
}

flush_firewall_tables iptables
flush_firewall_tables ip6tables

if [ "$TEMPORARY" = "true" ]; then
  echo "Unblocked internet access until the next reboot or re-block."
  exit 0
fi

# Otherwise the saved rules would quietly block the internet again on the next boot
if [ -f "$FIREWALL_SERVICE_FILE" ]; then
  systemctl disable "$FIREWALL_SERVICE_NAME" || true
fi
rm -f "$FIREWALL_RULES_V4" "$FIREWALL_RULES_V6"

echo "Unblocked internet access!"
