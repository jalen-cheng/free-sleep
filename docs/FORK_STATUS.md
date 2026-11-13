# Fork status

What this fork (`jalen-cheng/free-sleep`) changes from upstream Free Sleep, how it compares with
Eight Sleep's own app, and what is left to do. The fork targets a Pod 5.

Everything listed as done is merged to `main`. None of it has run on a Pod yet; it was checked
with unit tests and the demo UI only.

- [Changes by pull request](#changes-by-pull-request)
- [Compared with the Eight Sleep app](#compared-with-the-eight-sleep-app)
- [Checklist for the first day on the Pod](#checklist-for-the-first-day-on-the-pod)
- [Later](#later)

## Changes by pull request

### Before pull requests were used (merged straight to `main`)

| Branch | What changed |
|---|---|
| `firewall-persistence` | The internet block is saved and restored at boot by `free-sleep-firewall.service`. Sentry is blocked unless `ALLOW_SENTRY=true`. Updates lift the block only until the next reboot or re-block. |
| `update-source` | `install.sh` and `update.sh` read the repo and branch from `/etc/free-sleep/update_source.conf`, so updates come from this fork. |
| `updater-lockout` | `scripts/updater_lockout.sh enable\|disable` masks Eight Sleep's updater units and blocks its update hosts. Adds `ALLOW_TAILSCALE=true` to the firewall. |
| `tap-polling-fixes` | Faster tap polling on Pod 4/5, quiet status logs, several gestures handled per poll, unexpected socket messages logged. |
| `tap-alarm-actions` | A tap can dismiss or snooze a vibrating alarm, or toggle power when no alarm is going off. |
| `tap-settings-ui` | Tap gestures section on the Settings page. |
| `ios-shortcuts-docs` | `docs/IOS_SHORTCUTS.md`: control the Pod from Apple Shortcuts. |

### Pull requests

| PR | Type | What changed |
|---|---|---|
| [#1](https://github.com/jalen-cheng/free-sleep/pull/1) | Fixes | Firewall allows DHCP and link-local IPv6. Lockout undo only unmasks what it masked. +/- buttons stay within 55-110°F. Power button waits for the Pod's state. Tap steps shown in °C when set to Celsius. |
| [#2](https://github.com/jalen-cheng/free-sleep/pull/2) | Feature | Temperature controls respond at once instead of locking after each change. Step size, dial range and the matching Eight Sleep level are labelled. Schedule enabled switch and Save moved to the bottom. |
| [#3](https://github.com/jalen-cheng/free-sleep/pull/3) | Feature | Link button beside the side picker: temperature, power and schedule changes apply to both sides. |
| [#4](https://github.com/jalen-cheng/free-sleep/pull/4) | Build | Rebuilt app bundle for #1 to #3. |
| [#5](https://github.com/jalen-cheng/free-sleep/pull/5) | Feature | Tap settings reduced to one set of controls for both sides: a temperature step, what the third gesture does during an alarm, and what it does otherwise. Fixes labels breaking mid-word. |
| [#6](https://github.com/jalen-cheng/free-sleep/pull/6) | Feature | Level (-10 to +10) as a display unit next to °F and °C, everywhere a temperature is shown or picked. Fixes the schedule chart axis in °C. |
| [#7](https://github.com/jalen-cheng/free-sleep/pull/7) | Tooling | `collect_temperature_calibration.py`, which measures the real temperature at each level. First version of this file. |

## Compared with the Eight Sleep app

The Eight Sleep column is from memory and public material, not from testing the current app.

| Area | Eight Sleep app | This fork |
|---|---|---|
| Temperature | Level -10 to +10, no units | °F, °C or level. The °F figures are an even spread over 55-110°F until calibrated. |
| Automatic adjustment | Autopilot changes temperature overnight | None. Fixed times and temperatures per day. |
| Schedules | Bedtime, night and wake phases | Per-day power on/off, any number of timed changes, copy to other days. |
| Both sides together | Per account | Link button for temperature, power and schedules. |
| Alarm | Vibration and thermal, snooze in app | Vibration with an alarm temperature. Snooze only from the bed, no snooze button in the app. |
| Side buttons (Pod 5) | + warms, - cools, middle is configurable | Code handles Pod 4 style tap counts only. How Pod 5 buttons are reported is unverified. |
| Sleep data | Stages, score, snoring | Time in bed, heart rate, HRV, breathing, movement. |
| Base and speakers | Elevation, snore mitigation, audio | Not supported. |
| Remote access | Anywhere, through Eight Sleep's cloud | Home network only. Tailscale is planned, not built. |
| Internet | Always connected, automatic firmware updates | Blocked at the firewall, updater disabled. |
| Automation | None | Local REST API, Apple Shortcuts guide. |

## Checklist for the first day on the Pod

In order. Stop and note the output if a step does not behave as described.

### Before opening it
- [ ] Pod 5 is already set up in the Eight Sleep app (required before install).
- [ ] Tools from [INSTALLATION.md](../INSTALLATION.md#tools-required) are on hand.
- [ ] Note the current firmware version shown in the Eight Sleep app.

### Install
- [ ] Follow [INSTALLATION.md](../INSTALLATION.md) steps 1 to 12 as written (board access, root access, disable software updates, Wi-Fi).
- [ ] Step 13, install from this fork: set `FREE_SLEEP_REPO=jalen-cheng/free-sleep` and `FREE_SLEEP_BRANCH=main` first, as the note in that step describes.
- [ ] Steps 14 to 18: open the UI at the Pod's address, reboot once and confirm the UI comes back, set up SSH.
- [ ] Reconnect the cover and confirm a temperature change is felt on each side.

### Buttons (do this before blocking the internet, while nothing else is changing)
- [ ] Run `/home/dac/venv/bin/python /home/dac/free-sleep/scripts/probe_nats_taps.py`.
- [ ] Press +, -, and the middle button once each, on each side, a few seconds apart. Note what prints for each.
- [ ] In a second session, compare `curl -s localhost:3000/api/deviceStatus` before and after each press: do `doubleTap`, `tripleTap` or `quadTap` change?
- [ ] Try a long press and a double press of the middle button and note any difference.

### Internet block
- [ ] With the firewall still open, list what Eight Sleep's software connects to: `ss -tunp`.
- [ ] Step 19: `sh /home/dac/free-sleep/scripts/block_internet_access.sh`.
- [ ] `sh /home/dac/free-sleep/scripts/updater_lockout.sh enable`.
- [ ] Reboot, then check:
  - [ ] the UI still loads from another device
  - [ ] `systemctl status free-sleep-firewall` is active
  - [ ] `curl -m 5 https://example.com` fails
  - [ ] `timedatectl` shows the clock synchronized
  - [ ] `systemctl status iptables ip6tables` shows no other unit loading different rules

### Controls
- [ ] Temperature: +/- and the dial change the bed; the number shown matches after a few seconds.
- [ ] Link sides: linking matches the other side; a change reaches both.
- [ ] Schedule: save one that powers on a few minutes ahead and confirm it fires.
- [ ] Alarm: set one a few minutes ahead. Check that the app's Dismiss stops it, whether it stops both sides, and whether turning the side off stops it.
- [ ] Settings: switch between °F, °C and Level and confirm the dial and schedules follow.

### Running cost
- [ ] After an hour: `top` for CPU use by the Free Sleep server, and the size of the logs.

### Updates
- [ ] `fs-update` over SSH completes and the UI comes back.
- [ ] `cat /etc/free-sleep/update_source.conf` still names this fork.
- [ ] `curl -m 5 https://example.com` still fails afterwards.

### Calibration (needs the bed empty for about two hours)
- [ ] `cd /home/dac/free-sleep/biometrics/temperature_calibration && /home/dac/venv/bin/python collect_temperature_calibration.py`
- [ ] Keep `/persistent/free-sleep-data/temperature_calibration.json`.

### For remote access later (read-only checks)
- [ ] `uname -m` (processor type) and `df -h /persistent` (free space).
- [ ] `ls /dev/net/tun` (tunnel device).
- [ ] `iptables -m owner --help | tail -5` (per-program firewall rules).

## Later

### Depends on what the Pod shows
- [ ] **Buttons.** Rename the tap settings to the Pod 5 buttons, or read the buttons from wherever the firmware reports them.
- [ ] **Calibration.** Confirm the sensor unit (assumed hundredths of a degree Celsius), choose which sensor defines "the temperature", and replace the even 55-110°F spread in `loadDeviceStatus.ts` and `updateDeviceStatus.ts` with the measured curve, stored per Pod.
- [ ] **Remote access.** If the read-only checks pass, run Tailscale on the Pod behind a "Remote access" switch, with only Tailscale's own traffic allowed out.

### Known gaps
- [ ] No snooze button or "snoozed" indicator in the app.
- [ ] A press just after an alarm stops vibrating toggles power; a short grace period would avoid it.
- [ ] Optionally let any press stop a vibrating alarm.
- [ ] In Level, tap steps are stored as whole °F (3, 6 or 8), so many presses in a row can drift by a level.
- [ ] The app's Update button compares against upstream's version, not the fork's. Use `fs-update` over SSH.
- [ ] Node tests (`tests/*.test.mjs`) do not run in CI, and no CI runs on the fork.
- [ ] Hardware differences between Pod 3, 4 and 5 are checked ad hoc; one capabilities table per model would replace those checks.
- [ ] Not started, by choice: an iOS app wrapper.
