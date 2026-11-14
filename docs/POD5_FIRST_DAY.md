# Pod 5: first day walkthrough

A step-by-step for installing this fork on a Pod 5 and running the checks that can only be done
on the Pod. It expands [INSTALLATION.md](../INSTALLATION.md) and the checklist in
[FORK_STATUS.md](FORK_STATUS.md); where they disagree, INSTALLATION.md wins for the install itself.

Plan for about two hours of hands-on time, plus a two-hour calibration run that needs the bed empty.

**Keep a notes file open.** Several steps say "record". Those answers decide what gets built next,
so paste the actual output rather than a summary.

## What is and is not known for Pod 5

- The repo has teardown photos for Pod 3 and Pod 4 only. The Pod 4 ones
  ([docs/pod_4_teardown](pod_4_teardown), [written steps](pod_4_teardown/instructions.md)) are the
  closest guide. **Take photos as you open the Pod 5**, especially of the board and where the
  tag-connect footprint is. They are worth adding to this repo.
- The install commands are the same for Pod 4 and Pod 5 according to INSTALLATION.md.
- How the Pod 5's three side buttons are reported is unknown. Part 4 finds out.
- **A newer Pod 5 bootloader may block the install.** Upstream
  [issue #66](https://github.com/throwaway31265/free-sleep/issues/66) (open, no answer yet)
  reports a Pod 5 whose bootloader, built in March 2025, never shows the
  `Hit any key to stop autoboot` prompt, so root access cannot be gained this way. Part 2 step 4
  says what to look for and what to do if yours is the same.

## Part 0: before you start

1. **The Pod is set up in the Eight Sleep app.** This is required for Pod 5 before installing.
2. **Record the firmware version** shown in the Eight Sleep app.
3. **Tools on the desk:** Torx set, TC2070-IDC tag-connect cable, FTDI FT232RL adapter, Dupont
   wires, a towel, your Mac.
4. **Install the serial terminal** on the Mac:
   ```bash
   brew install minicom
   ```
5. **Have ready:** your Wi-Fi name and password (the main network, not a guest network), two new
   passwords for the Pod's `root` and `rewt` users, and your SSH public key:
   ```bash
   cat ~/.ssh/id_ed25519.pub
   ```
   If that file does not exist, create a key first with `ssh-keygen -t ed25519`.
6. **Wire the cable to the FTDI adapter now**, following the photos in [docs/jtag](jtag). Only
   three wires are used: ground, transmit and receive. Leave the adapter unplugged from the Mac.

## Part 1: open the hub

1. Turn the Pod off in the Eight Sleep app and **unplug it from the wall**.
2. Disconnect the cover's hose and move the hub to a table with a towel on it. Keep it upright;
   it has water in it.
3. Follow the [Pod 4 written steps](pod_4_teardown/instructions.md): four Torx screws under the
   rubber feet, lift the hub off the base holding both side panels, then slide each side panel
   and the front grille down about half an inch and off.
4. Find the control board and the tag-connect footprint: a small grid of bare gold pads with
   alignment holes beside it. On the Pod 4 it is here: [photo](pod_4_teardown/2_circuit_board.png).
5. **Photograph the board** before connecting anything.

If the Pod 5 does not come apart the way the Pod 4 steps describe, stop forcing it and look for
hidden screws. Nothing here needs more force than a firm slide.

## Part 2: get root access (INSTALLATION.md steps 2 to 10)

The Pod stays unplugged until step 4.

1. Press the tag-connect cable onto the footprint. It only fits one way; the alignment pins hold it.
2. Plug the FTDI adapter into the Mac and find it:
   ```bash
   ls /dev/tty.usbserial-*
   ```
3. Start the terminal, using the name you just saw:
   ```bash
   minicom -b 921600 -o -D /dev/tty.usbserial-XXXXXXXX
   ```
4. **Plug the Pod's power in** and watch the terminal. When `Hit any key to stop autoboot`
   appears, press Ctrl+C at once. You have a couple of seconds. If you miss it, unplug the Pod,
   wait ten seconds, and try again.
   - **The boot log scrolls past with no `Hit any key` line, and it reaches `eight-pod login:`.**
     Your bootloader is the kind described in upstream issue #66. Do not keep power-cycling.
     Record the `U-Boot 20xx.xx ... (date)` line and the `Welcome to Eight Layer` line from the
     log, try holding Ctrl+C from before the power goes in once more, and if it still does not
     stop, close the Pod up: the rest of this walkthrough cannot be done until there is a way in.
     The Pod is unchanged and still works with the Eight Sleep app.
   - Nothing printed at all: transmit and receive are probably swapped. Unplug the Pod, swap
     those two wires, retry.
   - Garbage characters: the speed is wrong. It must be 921600.
5. At the boot prompt:
   ```
   printenv current_slot
   ```
   It must print `current_slot=a`. **If it prints anything else, stop.** INSTALLATION.md says to
   reset the firmware and try again, and to open an issue if it is still not `a`.
6. With `current_slot=a`:
   ```
   setenv bootargs "root=PARTLABEL=rootfs_a rootwait init=/bin/bash"
   run bootcmd
   ```
7. You now have a bare shell. Mount the file system, exactly as in INSTALLATION.md step 6:
   ```
   mount -t proc proc /proc
   mount -t sysfs sysfs /sys
   mount -t devtmpfs devtmpfs /dev
   mount -t tmpfs tmpfs /run
   mount -o remount,rw /
   ```
8. Set both passwords, then save and reboot. **Do not interrupt the boot this time.**
   ```
   passwd root
   passwd rewt
   sync
   reboot -f
   ```
9. Wait for the login prompt and log in as `root`.

## Part 3: install this fork (INSTALLATION.md steps 11 to 18)

1. **Disable Eight Sleep's software updates.** Some lines will say a service does not exist;
   that is expected.
   ```
   systemctl disable --now swupdate-progress swupdate defibrillator eight-kernel telegraf vector frankenfirmware dac swupdate.socket
   systemctl mask swupdate-progress swupdate defibrillator eight-kernel telegraf vector frankenfirmware dac swupdate.socket
   ```
   Do this before joining Wi-Fi, so the Pod cannot update itself in between.
2. **Join Wi-Fi.** Replace `WIFI_NAME` (twice) and `PASSWORD`:
   ```
   nmcli connection add type wifi con-name WIFI_NAME ifname wlan0 ssid WIFI_NAME wifi-sec.key-mgmt wpa-psk wifi-sec.psk "PASSWORD" ipv4.method auto ipv6.method auto
   sed -i 's/uuid=.*/uuid=700a7a76-2105-4f46-b1b4-c9f3c791c440/' /persistent/system-connections/*.nmconnection
   nmcli connection reload
   ```
3. **Install from this fork.** The first line is what makes every later update come from the fork too.
   ```
   export FREE_SLEEP_REPO=jalen-cheng/free-sleep FREE_SLEEP_BRANCH=main
   /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/$FREE_SLEEP_REPO/$FREE_SLEEP_BRANCH/scripts/install.sh)"
   ```
   Then confirm it stuck:
   ```
   cat /etc/free-sleep/update_source.conf
   ```
4. **Get the Pod's address** and record it:
   ```
   nmcli -g ip4.address device show wlan0
   ```
5. **Open the UI** from your phone or Mac at `http://<pod-ip>:3000`. It will look greyed out
   until the cover is connected. Go to Settings and **set your time zone** now; schedules depend on it.
6. **Set up SSH** and paste your public key when asked:
   ```
   sh /home/dac/free-sleep/scripts/setup_ssh.sh
   ```
   From the Mac, check it works before closing the serial session:
   ```bash
   ssh root@<pod-ip> -p 8822
   ```
7. **Reboot test.** Unplug the Pod's power, plug it back in, wait up to four minutes, and confirm
   the UI loads again.
8. **Leave the hub open and the serial cable attached** until Part 5 is done. If the firewall
   step ever locks you out of the network, the serial cable is the way back in.
9. Reconnect the cover's hose. The UI should stop being greyed out.
10. **Feel test.** Set one side to the highest temperature and the other to the lowest. After
    ten minutes the two sides should feel clearly different.

Use SSH from here on. Everything below is typed in an SSH session on the Pod unless it says "on the Mac".

## Part 4: the button check

Do this before blocking the internet, so only one thing is changing at a time.

1. Session one, start the probe:
   ```
   /home/dac/venv/bin/python /home/dac/free-sleep/scripts/probe_nats_taps.py
   ```
2. Session two, save a baseline of everything the firmware reports:
   ```
   curl -s localhost:3000/api/deviceStatus/raw > /tmp/status_0.txt; cat /tmp/status_0.txt
   ```
   Look for `doubleTap`, `tripleTap` and `quadTap` lines. Those are the only inputs the code reads today.
3. Press **left +** once. Wait five seconds. Record:
   - anything new the probe printed (the subject name and the preview)
   - what changed in the status since the baseline:
     ```
     curl -s localhost:3000/api/deviceStatus/raw > /tmp/status_1.txt; diff /tmp/status_0.txt /tmp/status_1.txt
     ```
     Use a new file number for each press and diff against the previous one. Temperature and
     timer lines change on their own; anything else that changes is the button.
4. Repeat for **left -**, **left middle**, **right +**, **right -**, **right middle**. One press each, five seconds apart.
5. Then on one side: a **double press** of the middle button, and a **press and hold** for two seconds. Record both.
6. Stop the probe with Ctrl+C. It prints how many high-rate messages it hid; record that too.

What the result means:

| What you see | Meaning |
|---|---|
| `doubleTap`, `tripleTap` or `quadTap` goes up by one per press, a different one per button | The buttons already work. The settings only need renaming. |
| Some other status line changes, or the probe prints a new line per press | The buttons are reported elsewhere. Needs new code to read them. |
| Neither changes | Free Sleep currently sees nothing from the buttons. Keep the status files and stop here. |
| Hold or double press looks different from a single press | Holds can be given their own action. |

Also check whether the buttons changed the temperature on their own, with no Free Sleep action,
by watching the dial in the UI while you press + and -.

## Part 5: block the internet

1. See what Eight Sleep's software is talking to while the firewall is still open. Record the output.
   ```
   ss -tunp
   ```
2. Preview the rules, then apply them:
   ```
   sh /home/dac/free-sleep/scripts/block_internet_access.sh --print-rules
   sh /home/dac/free-sleep/scripts/block_internet_access.sh
   ```
3. Add the updater lockout:
   ```
   sh /home/dac/free-sleep/scripts/updater_lockout.sh enable
   ```
   Record any "not found" warnings; the unit names were only confirmed on a Pod 3.
4. **Before rebooting**, confirm the UI and SSH still work from another device.
5. Reboot (`reboot`), wait four minutes, reconnect over SSH, then run each of these and record the result:
   ```
   systemctl status free-sleep-firewall --no-pager
   iptables -L OUTPUT -n | tail -3
   ping -c1 8.8.8.8
   curl -m 5 https://example.com
   timedatectl
   systemctl status iptables ip6tables --no-pager
   ```
   Expected: the service is active, the last rule is `DROP`, the ping and the curl both fail,
   the clock says synchronized, and no other unit is loading firewall rules.

**If the Pod does not come back on the network after the reboot:** log in over the serial cable and run
```
sh /home/dac/free-sleep/scripts/unblock_internet_access.sh
```
then record `iptables -S` and `journalctl -u free-sleep-firewall --no-pager | tail -30` before trying again.

Once this part passes, the serial cable can come off and the hub can be closed. Reassemble in
reverse; the front grille's tabs must sit in the slots of the top and bottom panels.

## Part 6: controls

From the UI on your phone.

1. **Temperature.** Press + five times quickly. The number should follow each press, and the
   bed should settle on that value a few seconds later.
2. **Link.** Press the link button beside the side picker. The other side should change to match.
   Change the temperature once more and confirm both sides follow. Unlink.
3. **Units.** In Settings, switch the temperature format between Fahrenheit, Celsius and Level.
   The dial and the schedule page should follow each time.
4. **Schedule.** Create a schedule for today that powers on three minutes from now, save it,
   turn the side off, and wait. Record whether it turned on at the right minute.
5. **Alarm.** Set an alarm for three minutes from now. When it vibrates:
   - Does the Dismiss button in the app stop it, or does the bed keep vibrating after the dialog closes?
     Upstream [issue #54](https://github.com/throwaway31265/free-sleep/issues/54) found that on a
     Pod 3 the dismiss command does nothing to an alarm that is already vibrating. If yours keeps
     vibrating, try this while it is going and record whether it stops within a few seconds
     (use the side that is vibrating):
     ```
     curl -s -X POST localhost:3000/api/alarm -H 'Content-Type: application/json' -d '{"side":"left","vibrationIntensity":1,"vibrationPattern":"double","duration":1}'
     ```
   - Run it again with alarms on both sides: does dismissing one side stop the other?
   - Run it once more: does turning the side off stop the vibration?
6. **Alarm from the bed.** Only if Part 4 showed the buttons reach Free Sleep: press the button
   that mapped to the third counter while the alarm vibrates.

## Part 7: running cost and updates

1. After the Pod has been up for an hour:
   ```
   top -b -n 1 | head -15
   du -sh /persistent/free-sleep-data/logs
   ```
   Record the CPU share of the `node` process and the log size.
2. Check free space now and again the next day. Upstream
   [issue #53](https://github.com/throwaway31265/free-sleep/issues/53) found old sensor capture
   files filling this partition within days on a Pod 3, which stops Free Sleep from starting.
   ```
   df -h /persistent
   ls /persistent/*.RAW 2>/dev/null | wc -l
   ```
3. Run an update and confirm the block survives it:
   ```
   fs-update
   cat /etc/free-sleep/update_source.conf
   curl -m 5 https://example.com
   ```
   Expected: the update finishes, the file still names this fork, and the curl fails.

## Part 8: calibration

Needs both sides free for about two hours, bedding as you normally sleep, and no schedule due to fire.

```
cd /home/dac/free-sleep/biometrics/temperature_calibration && /home/dac/venv/bin/python collect_temperature_calibration.py
```

It prints one line per side for each of five levels and restores your settings at the end.
Ctrl+C stops it early and keeps what it has measured. Copy the result off the Pod, on the Mac:

```bash
scp -P 8822 root@<pod-ip>:/persistent/free-sleep-data/temperature_calibration.json .
```

If it reports "no water temperature records", record that and the output of
`ls /persistent/*.RAW | head` and `ss -ltnp | grep 4222`.

## Part 9: read-only checks for remote access

These change nothing. Record all four outputs.

```
uname -m
df -h /persistent
ls -l /dev/net/tun
iptables -m owner --help | tail -5
```

## What to bring back

- Photos of the open Pod 5 and its board.
- The firmware version from Part 0.
- The button table from Part 4: for each of the eight presses, what the probe printed and the status diff. Copy `/tmp/status_*.txt` off the Pod.
- The `ss -tunp` output from Part 5 and the six post-reboot results.
- Answers to the alarm questions in Part 6.
- CPU share and log size from Part 7.
- `temperature_calibration.json` from Part 8.
- The four outputs from Part 9.
