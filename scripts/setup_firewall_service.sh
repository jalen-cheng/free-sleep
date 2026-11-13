#!/bin/bash
# Installs a systemd unit that reloads the saved WAN block rules before the network comes up.
# Without it the rules written by block_internet_access.sh are lost on every reboot.
set -eu

SCRIPT_DIR=$(cd "$(dirname "$0")" && pwd)
. "$SCRIPT_DIR/firewall_common.sh"

IPTABLES_RESTORE=$(command -v iptables-restore) || {
  echo "iptables-restore not found, cannot persist the firewall rules" >&2
  exit 1
}
# IPv6 is optional: the unit skips it when the tool or the rules file is missing
IP6TABLES_RESTORE=$(command -v ip6tables-restore || true)

echo "Creating systemd service file at $FIREWALL_SERVICE_FILE..."
cat > "$FIREWALL_SERVICE_FILE" <<EOF
[Unit]
Description=Restore Free Sleep WAN block firewall rules
DefaultDependencies=no
After=local-fs.target
Before=network-pre.target
Wants=network-pre.target
ConditionPathExists=$FIREWALL_RULES_V4

[Service]
Type=oneshot
RemainAfterExit=yes
ExecStart=/bin/sh -c '$IPTABLES_RESTORE < $FIREWALL_RULES_V4'
EOF

if [ -n "$IP6TABLES_RESTORE" ]; then
  cat >> "$FIREWALL_SERVICE_FILE" <<EOF
ExecStart=/bin/sh -c 'if [ -f $FIREWALL_RULES_V6 ]; then $IP6TABLES_RESTORE < $FIREWALL_RULES_V6; fi'
EOF
fi

cat >> "$FIREWALL_SERVICE_FILE" <<EOF

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload
systemctl enable "$FIREWALL_SERVICE_NAME"
echo "Firewall rules will be restored on boot by $FIREWALL_SERVICE_NAME"
