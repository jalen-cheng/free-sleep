# Fork status

Tracks what this fork has changed from upstream Free Sleep and what is still open.
The fork targets a Pod 5. Nothing below has run on a Pod yet unless it says so.

## Done

### Merged to `main`
- **Firewall survives reboots.** Rules are saved and restored by `free-sleep-firewall.service` before networking starts. Sentry is blocked unless `ALLOW_SENTRY=true`; `ALLOW_TAILSCALE=true` allows the Tailscale address range.
- **Updates keep the block.** `update.sh` unblocks only until the next reboot or re-block.
- **Updates come from the fork.** `install.sh` and `update.sh` read the repo and branch from `/etc/free-sleep/update_source.conf`.
- **Updater lockout.** `scripts/updater_lockout.sh enable|disable` masks Eight Sleep's updater units and blocks its update hosts.
- **Tap polling.** Faster polling on Pod 4/5, quiet status logs, several gestures handled per poll.
- **Alarm taps.** A tap can dismiss or snooze a vibrating alarm, or toggle power when no alarm is going off.
- **Apple Shortcuts guide.** `docs/IOS_SHORTCUTS.md`.

### In open pull requests (merge in this order)
1. **Fixes.** Firewall allows DHCP; lockout undo only unmasks what it masked; +/- buttons stay in range; power button waits for the Pod's state.
2. **Temperature controls.** Instant +/- and dial response, step and range labels, schedule switch moved to the bottom.
3. **Link sides.** One button to control both sides for temperature, power and schedules.
4. **Rebuild app bundle.**
5. **Simpler tap settings.** One set of controls for both sides.
6. **Level unit.** Temperatures can be shown as °F, °C or Eight Sleep's -10 to +10 level, everywhere.
7. **Temperature calibration script and this list.**

## To do

### First session on the Pod
- [ ] **Buttons.** Pod 5 has three physical buttons per side (+, -, middle); the code only knows Pod 4 style double/triple/quad tap counters. Press each button once while watching the raw status and `scripts/probe_nats_taps.py`, and record what changes.
- [ ] **Firewall.** After a reboot: `systemctl status free-sleep-firewall`, `iptables -S`, the web UI still loads, and `curl -m 5 https://example.com` fails.
- [ ] **Firewall conflicts.** `systemctl status iptables ip6tables` shows no other unit restoring different rules.
- [ ] **Clock.** `timedatectl` shows the clock synchronized with the block on.
- [ ] **Update source.** `cat /etc/free-sleep/update_source.conf` still names the fork after an update.
- [ ] **Polling cost.** CPU use and log growth with the 500 ms poll.
- [ ] **Alarm.** Dismiss and snooze from the bed while an alarm vibrates; whether `ALARM_CLEAR` stops both sides; whether power-off stops a vibrating alarm.
- [ ] **What Eight Sleep's software connects to.** With the firewall open, list destinations (`ss -tunp`, `tcpdump`).

### Temperature calibration
- [ ] Run `biometrics/temperature_calibration/collect_temperature_calibration.py` with the bed empty (about two hours).
- [ ] Confirm the sensor unit (assumed: hundredths of a degree Celsius).
- [ ] Decide which sensor defines "the temperature" (water at the hub, or the cover surface).
- [ ] Replace the even 55-110°F spread in `loadDeviceStatus.ts` and `updateDeviceStatus.ts` with the measured curve.

### After the button check
- [ ] Rename the tap settings to the Pod 5 buttons, or read the buttons from wherever the firmware reports them.
- [ ] Optionally let any press stop a vibrating alarm.

### Remote access
- [ ] Check on the Pod: kernel support for per-program firewall rules (`xt_owner`), the tunnel device, CPU architecture, and free space.
- [ ] If those pass, run Tailscale on the Pod behind a "Remote access" switch, with only Tailscale's own traffic allowed out.

### Known gaps
- [ ] No snooze button or "snoozed" indicator in the app.
- [ ] A press just after an alarm stops vibrating toggles power; a short grace period would avoid it.
- [ ] In Level, tap steps are stored as whole °F (3, 6 or 8), so many presses in a row can drift by a level.
- [ ] The app's Update button compares against upstream's version, not the fork's. Use `fs-update` over SSH.
- [ ] Node tests (`tests/*.test.mjs`) do not run in CI.
- [ ] Hardware differences between Pod 3, 4 and 5 are checked ad hoc; a single capabilities table per model would replace those checks.
- [ ] Not started, by choice: an iOS app wrapper.
