# Fork status

What this fork (`jalen-cheng/free-sleep`) changes from upstream Free Sleep, how it compares with
Eight Sleep's own app, and what is left to do. The fork targets a Pod 5.

Everything listed as done is merged to `main`. None of it has run on a Pod yet; it was checked
with unit tests and the demo UI only.

- [Changes by pull request](#changes-by-pull-request)
- [Compared with the Eight Sleep app](#compared-with-the-eight-sleep-app)
- [Checklist for the first day on the Pod](#checklist-for-the-first-day-on-the-pod)
- [Upstream issues that touch this fork](#upstream-issues-that-touch-this-fork)
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
The full walkthrough, with every command and what to expect, is in [POD5_FIRST_DAY.md](POD5_FIRST_DAY.md).

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

## Upstream issues that touch this fork

From the upstream issue tracker and open pull requests, checked 2026-11-13.

| Upstream | What it says | Effect here |
|---|---|---|
| [#66](https://github.com/throwaway31265/free-sleep/issues/66) | A Pod 5 with a March 2025 bootloader shows no autoboot prompt, so the serial install cannot start. Open, unanswered. | May block the install entirely. The walkthrough says what to look for. |
| [#54](https://github.com/throwaway31265/free-sleep/issues/54) | On a Pod 3, the dismiss command does not stop an alarm that is already vibrating. Sending a new one-second alarm does. Untested on Pod 4/5. | Dismiss from the app and from the bed both use that command. If the Pod 5 behaves the same, dismiss and snooze need the one-second-alarm method instead. |
| [#53](https://github.com/throwaway31265/free-sleep/issues/53) | Old `.RAW` sensor files fill `/persistent` within days on a Pod 3 and stop Free Sleep from starting. | Unknown on Pod 5, which stores sensor data differently. Free space is on the checklist. |
| [PR 51](https://github.com/throwaway31265/free-sleep/pull/51), [PR 60](https://github.com/throwaway31265/free-sleep/pull/60) | With the block on, the clock stopped syncing on a network whose DNS servers were public addresses, because DNS was blocked. | Fixed here the same way: DNS is allowed to any resolver. This fork's rules already cover the other findings in PR 60 (IPv6 neighbor discovery, and removing Sentry rules when it is switched back off). |
| [#62](https://github.com/throwaway31265/free-sleep/issues/62), [#63](https://github.com/throwaway31265/free-sleep/issues/63) | On some Pod 4s the installer cannot find the firmware socket path and the server silently uses the Pod 3 path. | Not changed here. If the UI stays greyed out with the cover connected, check `fs-debug` for the socket path. |

### From the project's Discord and other Pod 5 owners

Searched 2026-11-13. These are other people's reports, not verified here.

| Finding | Source | Effect here |
|---|---|---|
| **Newer Pod 5 units cannot be rooted this way.** Several owners report no autoboot prompt. One bought in June could interrupt the boot; the view in the server is that newer units ship with it disabled and older ones have not been patched so far. | #support, #general, Sept to Nov 2026 | Same blocker as upstream #66. Whether yours is affected depends on when it was made. |
| **Pod 5 buttons do nothing under Free Sleep.** An owner on current `main` gets the haptic click from + and - but no temperature change. | #support, 1 Nov 2026 | The tap features in this fork will not respond to the Pod 5's + and - buttons as they stand. |
| **Pod 5 buttons show up in the firmware's log, not in the tap counters.** Another owner's fork reads `journalctl -u frank` for lines such as `[TTC] processing [button] side left { button: top, type: short` (top is +, bottom is -, plus middle) and `[buttons] middle button held for <N>ms`. | [seanpasino/free-sleep](https://github.com/seanpasino/free-sleep), branch `seanpasino/personal`, `server/src/8sleep/buttonMonitor.ts` | This is how to read the buttons, including how long the middle one was held. Needs a new reader in this fork. |
| **The dismiss command takes a side.** A related project sends `ALARM_CLEAR` with `0` (left) or `1` (right). Free Sleep sends the word `empty`, which may be why upstream #54 sees no effect. | [sleepypod/core docs/hardware/alarms.md](https://github.com/sleepypod/core/blob/6cf0c24fa793b0cda78d4ab5c299cff4dbfd926a/docs/hardware/alarms.md) | A likely fix for dismiss. To be tried on the Pod. |
| **The firmware stops a vibrating alarm by itself on any tap**, and that tap can be missing from the status counters. | same document | Dismiss-by-tap may already work without Free Sleep; snooze-by-tap may never see the tap. |
| **On some Pod 4 firmware the tap fields hold the time of the last tap, not a count.** | same document | This fork would read one tap as three (it caps a jump at three). Needs handling before Pod 4 use. |
| **A fresh Pod 5 install can show 55° and never change temperature** until a firmware component is updated. | #support, 1 Nov 2026 ("look up '55'") | If the bed does not respond after install, search the Discord's #support for `55`. |
| **Tailscale on the Pod works, but the firewall has to be opened for it by hand**, with long lists of addresses. | #support, #general, Mar to Apr 2026 | Matches the plan to allow Tailscale by program instead of by address. |

## Later

### Depends on what the Pod shows
- [ ] **Buttons.** Add a reader for the Pod 5 button lines in the firmware log (see the table above), mapped onto the existing settings: + and - step the temperature, the middle button handles the alarm, and a long hold of the middle button toggles power.
- [ ] **Dismiss.** If sending `ALARM_CLEAR` with a side stops a vibrating alarm, switch dismiss and snooze to it.
- [ ] **Pod 4 tap fields.** Treat a large jump in a tap field as one tap, for firmware that reports a time instead of a count.
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
