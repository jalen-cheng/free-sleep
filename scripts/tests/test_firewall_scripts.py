"""Exercise the WAN firewall scripts with temporary paths and fake Pod commands."""

import os
from pathlib import Path
import subprocess
import tempfile
import unittest


scripts_path = Path(__file__).resolve().parents[1]

FAKE_COMMAND = '''#!/bin/sh
printf '%s %s\\n' "$(basename "$0")" "$*" >> "$FIREWALL_LOG"
# Drain the rules piped into the restore commands
cat > /dev/null
'''


class FirewallScriptTests(unittest.TestCase):
    def setUp(self):
        self.directory = tempfile.TemporaryDirectory()
        self.addCleanup(self.directory.cleanup)
        self.folder = Path(self.directory.name)
        self.commands = self.folder / 'commands'
        self.commands.mkdir()
        self.log = self.folder / 'commands.log'
        self.rules_folder = self.folder / 'iptables'
        self.config = self.folder / 'free-sleep/firewall.conf'
        self.units = self.folder / 'units'
        self.units.mkdir()
        for name in ('iptables', 'ip6tables', 'iptables-restore', 'ip6tables-restore', 'systemctl'):
            command = self.commands / name
            command.write_text(FAKE_COMMAND)
            command.chmod(0o755)
        self.environment = dict(os.environ, PATH=str(self.commands) + ':' + os.environ['PATH'],
                                FIREWALL_LOG=str(self.log), FIREWALL_RULES_DIR=str(self.rules_folder),
                                FIREWALL_CONFIG=str(self.config), SYSTEMD_UNIT_DIR=str(self.units),
                                TIMESYNCD_CONFIG=str(self.folder / 'timesyncd.conf'))
        self.environment.pop('ALLOW_SENTRY', None)
        self.environment.pop('ALLOW_TAILSCALE', None)

    def run_script(self, name, *arguments, **extra_environment):
        return subprocess.run(['sh', str(scripts_path / name), *arguments], check=True, text=True,
                              capture_output=True, stdin=subprocess.DEVNULL, env=dict(self.environment, **extra_environment))

    def read_rules(self, name='iptables.rules'):
        return (self.rules_folder / name).read_text().splitlines()

    def test_block_is_idempotent_and_persists(self):
        self.run_script('block_internet_access.sh')
        first_rules = self.read_rules()
        self.run_script('block_internet_access.sh')
        self.assertEqual(self.read_rules(), first_rules)
        self.assertEqual(len(first_rules), len(set(first_rules)))
        self.assertEqual(first_rules[-3:], ['-A INPUT -j DROP', '-A OUTPUT -j DROP', 'COMMIT'])
        self.assertEqual(self.read_rules('ip6tables.rules')[-3:], ['-A INPUT -j DROP', '-A OUTPUT -j DROP', 'COMMIT'])
        unit = (self.units / 'free-sleep-firewall.service').read_text()
        self.assertIn(f'ConditionPathExists={self.rules_folder}/iptables.rules', unit)
        self.assertIn(f"{self.commands}/iptables-restore < {self.rules_folder}/iptables.rules", unit)
        self.assertIn('Before=network-pre.target', unit)
        self.assertIn('systemctl enable free-sleep-firewall.service', self.log.read_text())

    def test_sentry_is_blocked_unless_opted_in_and_choice_is_remembered(self):
        sentry_rule = '-A OUTPUT -d 35.186.247.156 -j ACCEPT'
        self.run_script('block_internet_access.sh')
        self.assertNotIn(sentry_rule, self.read_rules())
        self.run_script('block_internet_access.sh', ALLOW_SENTRY='true')
        self.assertIn(sentry_rule, self.read_rules())
        # The re-block after an update passes no options and must keep the saved choice
        self.run_script('block_internet_access.sh')
        self.assertIn(sentry_rule, self.read_rules())
        self.run_script('block_internet_access.sh', ALLOW_SENTRY='false')
        self.assertNotIn(sentry_rule, self.read_rules())

    def test_tailscale_range_is_opt_in(self):
        tailscale_rule = '-A OUTPUT -d 100.64.0.0/10 -j ACCEPT'
        self.run_script('block_internet_access.sh')
        self.assertNotIn(tailscale_rule, self.read_rules())
        self.run_script('block_internet_access.sh', ALLOW_TAILSCALE='true')
        self.assertIn(tailscale_rule, self.read_rules())
        self.assertLess(self.read_rules().index(tailscale_rule), self.read_rules().index('-A OUTPUT -j DROP'))

    def test_updater_lockout_skips_missing_units_and_is_reversible(self):
        hosts = self.folder / 'hosts'
        hosts.write_text('127.0.0.1 localhost\n')
        systemctl = self.commands / 'systemctl'
        # Only swupdate.service exists on this fake Pod
        systemctl.write_text('''#!/bin/sh
printf 'systemctl %s\\n' "$*" >> "$FIREWALL_LOG"
if [ "$1" = "list-unit-files" ] && [ "$2" = "swupdate.service" ]; then
  echo "swupdate.service enabled"
fi
''')
        result = self.run_script('updater_lockout.sh', 'enable', HOSTS_FILE=str(hosts))
        self.run_script('updater_lockout.sh', 'enable', HOSTS_FILE=str(hosts))
        log = self.log.read_text()
        self.assertIn('systemctl mask --now swupdate.service', log)
        self.assertNotIn('mask --now defibrillator.service', log)
        self.assertIn("unit 'defibrillator.service' not found", result.stderr)
        self.assertEqual(hosts.read_text().count('update-api.8slp.net'), 1)
        self.assertIn('0.0.0.0 raw-api-upload.8slp.net', hosts.read_text())

        self.run_script('updater_lockout.sh', 'disable', HOSTS_FILE=str(hosts))
        self.assertIn('systemctl unmask swupdate.service', self.log.read_text())
        self.assertEqual(hosts.read_text(), '127.0.0.1 localhost\n')

    def test_print_rules_changes_nothing(self):
        result = self.run_script('block_internet_access.sh', '--print-rules')
        self.assertIn('-A OUTPUT -j DROP', result.stdout)
        self.assertFalse(self.rules_folder.exists())
        self.assertFalse(self.log.exists())

    def test_temporary_unblock_keeps_boot_persistence(self):
        self.run_script('block_internet_access.sh')
        self.log.unlink()
        self.run_script('unblock_internet_access.sh', '--temporary')
        log = self.log.read_text()
        self.assertIn('iptables -F', log)
        self.assertIn('ip6tables -F', log)
        self.assertNotIn('systemctl disable', log)
        self.assertTrue((self.rules_folder / 'iptables.rules').exists())

    def test_unblock_removes_saved_rules_and_disables_restore(self):
        self.run_script('block_internet_access.sh')
        self.run_script('unblock_internet_access.sh')
        self.assertIn('systemctl disable free-sleep-firewall.service', self.log.read_text())
        self.assertFalse((self.rules_folder / 'iptables.rules').exists())
        self.assertFalse((self.rules_folder / 'ip6tables.rules').exists())


if __name__ == '__main__':
    unittest.main()
