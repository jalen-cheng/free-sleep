#!/bin/bash
# Optional extra lockdown on top of block_internet_access.sh: stops Eight Sleep's updater services
# and points the Eight Sleep cloud hosts at nowhere, so nothing phones home even while the
# firewall is temporarily open during a Free Sleep update.
#
# Usage:
#   sh updater_lockout.sh enable
#   sh updater_lockout.sh disable
set -eu

# Unit names were confirmed on Pod 3 only; units missing on this Pod are skipped with a warning.
UPDATER_UNITS="swupdate.service swupdate.socket swupdate-progress.service defibrillator.service"
BLOCKED_HOSTS="raw-api-upload.8slp.net update-api.8slp.net device-api.8slp.net"
HOSTS_FILE="${HOSTS_FILE:-/etc/hosts}"
HOSTS_MARKER="# free-sleep-updater-lockout"
# Units masked by this script. Units that were already masked (install step 11) are left out,
# so "disable" never re-enables an updater that was turned off before this script ran.
MASKED_UNITS_FILE="${MASKED_UNITS_FILE:-/etc/free-sleep/updater_lockout_units}"

# Succeeds when systemd has a unit file with exactly this name.
unit_exists() {
  systemctl list-unit-files "$1" 2>/dev/null | grep -q "^$1[[:space:]]"
}

# Removes only the lines this script added to the hosts file.
remove_hosts_entries() {
  remaining_hosts=$(grep -vF "$HOSTS_MARKER" "$HOSTS_FILE" || true)
  printf '%s\n' "$remaining_hosts" > "$HOSTS_FILE"
}

enable_lockout() {
  for unit_name in $UPDATER_UNITS; do
    if ! unit_exists "$unit_name"; then
      echo "WARNING: unit '$unit_name' not found on this Pod, skipping" >&2
    elif [ "$(systemctl is-enabled "$unit_name" 2>/dev/null || true)" = "masked" ]; then
      echo "$unit_name is already masked"
    else
      systemctl mask --now "$unit_name"
      mkdir -p "$(dirname "$MASKED_UNITS_FILE")"
      echo "$unit_name" >> "$MASKED_UNITS_FILE"
      echo "Masked $unit_name"
    fi
  done

  remove_hosts_entries
  for blocked_host in $BLOCKED_HOSTS; do
    echo "0.0.0.0 $blocked_host $HOSTS_MARKER" >> "$HOSTS_FILE"
  done
  echo "Updater lockout enabled. Undo with: sh scripts/updater_lockout.sh disable"
}

disable_lockout() {
  if [ -f "$MASKED_UNITS_FILE" ]; then
    while read -r unit_name; do
      [ -n "$unit_name" ] || continue
      systemctl unmask "$unit_name"
      echo "Unmasked $unit_name (not started; start it or reboot if you want it running)"
    done < "$MASKED_UNITS_FILE"
    rm -f "$MASKED_UNITS_FILE"
  fi
  remove_hosts_entries
  echo "Updater lockout disabled. Units that were masked before the lockout stay masked."
}

case "${1:-}" in
  enable) enable_lockout ;;
  disable) disable_lockout ;;
  *)
    echo "Usage: sh updater_lockout.sh enable|disable" >&2
    exit 1
    ;;
esac
