#!/bin/sh
# Shared paths and helpers for the WAN firewall scripts. Source this file, do not execute it.

FIREWALL_RULES_DIR="${FIREWALL_RULES_DIR:-/etc/iptables}"
FIREWALL_RULES_V4="$FIREWALL_RULES_DIR/iptables.rules"
FIREWALL_RULES_V6="$FIREWALL_RULES_DIR/ip6tables.rules"
# Root-owned on purpose: these scripts run as root and must not trust files the dac user can edit.
FIREWALL_CONFIG="${FIREWALL_CONFIG:-/etc/free-sleep/firewall.conf}"
FIREWALL_SERVICE_NAME="free-sleep-firewall.service"
FIREWALL_SERVICE_FILE="${SYSTEMD_UNIT_DIR:-/etc/systemd/system}/$FIREWALL_SERVICE_NAME"
TIMESYNCD_CONFIG="${TIMESYNCD_CONFIG:-/etc/systemd/timesyncd.conf}"

# Prints a true/false option. The environment wins, then the saved config, then the default.
# The saved config is what lets the re-block after an update keep the choices made at setup.
resolve_firewall_option() {
  option_name="$1"
  default_value="$2"
  eval "option_value=\${$option_name:-}"
  if [ -z "$option_value" ] && [ -f "$FIREWALL_CONFIG" ]; then
    option_value=$(grep -E "^$option_name=(true|false)\$" "$FIREWALL_CONFIG" | tail -n 1 | cut -d= -f2)
  fi
  if [ "$option_value" != "true" ] && [ "$option_value" != "false" ]; then
    option_value="$default_value"
  fi
  echo "$option_value"
}

# Saves one option to the config, replacing any earlier value.
save_firewall_option() {
  option_name="$1"
  option_value="$2"
  mkdir -p "$(dirname "$FIREWALL_CONFIG")"
  touch "$FIREWALL_CONFIG"
  remaining_options=$(grep -v "^$option_name=" "$FIREWALL_CONFIG" || true)
  {
    [ -n "$remaining_options" ] && echo "$remaining_options"
    echo "$option_name=$option_value"
  } > "$FIREWALL_CONFIG"
  chmod 644 "$FIREWALL_CONFIG"
}
