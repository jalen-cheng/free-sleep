#!/bin/bash

# Optional: Exit immediately on error
set -e

# Name of the backup folder with a timestamp
print_json_if_exists() {
  local file_path="$1"
  local label="$2"

  if [ -f "$file_path" ]; then
    python3 -m json.tool "$file_path" \
      | sed 's/^/      /' \
      | sed $'s/^/\033[0;90m/' \
      | sed $'s/$/\033[0m/'
  else
    echo "File not found: $file_path ❌"
  fi
}
print_json_if_exists "/home/dac/free-sleep/server/src/serverInfo.json" "Server info"

BACKUP_PATH="/home/dac/free-sleep-backup"
APP_DIR="/home/dac/free-sleep"

# Keep biometrics stopped through the downloaded installer, including older installers.
services_to_restore=""
restore_services() {
  for service_name in $services_to_restore; do
    systemctl start "$service_name" || true
  done
}
trap restore_services EXIT
for service_name in free-sleep-stream free-sleep; do
  if systemctl is-active --quiet "$service_name"; then
    services_to_restore="$service_name $services_to_restore"
    systemctl stop "$service_name"
  fi
done

if [ -f /persistent/free-sleep-data/free-sleep.db ]; then
  python3 "$APP_DIR/scripts/sqlite_maintenance.py" backup \
    /persistent/free-sleep-data/free-sleep.db \
    /persistent/free-sleep-data/free-sleep-copy.db --checkpoint
fi

systemctl disable free-sleep

# Unblock internet first. Temporary: the saved rules stay, so a reboot mid-update comes back blocked.
sh /home/dac/free-sleep/scripts/unblock_internet_access.sh --temporary

# If a free-sleep folder exists, back it up
if [ -d /home/dac/free-sleep ]; then
  echo "Backing up current free-sleep to $BACKUP_PATH"
  mv /home/dac/free-sleep $BACKUP_PATH
fi

# Update from the source saved by install.sh, so a fork is not replaced by upstream on update
UPDATE_SOURCE_CONFIG="/etc/free-sleep/update_source.conf"
read_saved_update_source() {
  if [ -f "$UPDATE_SOURCE_CONFIG" ]; then
    grep -E "^$1=[A-Za-z0-9._/-]+\$" "$UPDATE_SOURCE_CONFIG" | tail -n 1 | cut -d= -f2 || true
  fi
}
FREE_SLEEP_REPO="${FREE_SLEEP_REPO:-$(read_saved_update_source FREE_SLEEP_REPO)}"
FREE_SLEEP_REPO="${FREE_SLEEP_REPO:-throwaway31265/free-sleep}"
FREE_SLEEP_BRANCH="${FREE_SLEEP_BRANCH:-$(read_saved_update_source FREE_SLEEP_BRANCH)}"
FREE_SLEEP_BRANCH="${FREE_SLEEP_BRANCH:-main}"
export FREE_SLEEP_REPO FREE_SLEEP_BRANCH
INSTALLER_URL="https://raw.githubusercontent.com/$FREE_SLEEP_REPO/$FREE_SLEEP_BRANCH/scripts/install.sh"

echo "Attempting to reinstall free-sleep from $FREE_SLEEP_REPO ($FREE_SLEEP_BRANCH)..."
update_succeeded=false
# Check the download separately: running an empty script after a failed curl exits successfully.
if installer_source=$(curl -fsSL "$INSTALLER_URL") \
  && [ -n "$installer_source" ] \
  && /bin/bash -c "$installer_source" \
  && [ -d "$APP_DIR" ]; then
  echo "Reinstall successful."
  update_succeeded=true
  rm -rf "$BACKUP_PATH"
else
  echo "Reinstall failed. Restoring from backup..."
  rm -rf /home/dac/free-sleep
  mv "$BACKUP_PATH" /home/dac/free-sleep
fi

systemctl enable free-sleep || true
systemctl start free-sleep || true

# Block internet access again. Options chosen earlier (e.g. ALLOW_SENTRY) are read from the saved config.
sh /home/dac/free-sleep/scripts/block_internet_access.sh
if [ "$update_succeeded" != true ]; then
  echo "Update failed; the previous installation was restored." >&2
  exit 1
fi
echo -e "\033[0;32mUpdate completed successfully!\033[0m"
echo -e "\033[0;32mRestart your pod with 'reboot -h now'\033[0m"
