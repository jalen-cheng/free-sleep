# Control your Pod from iPhone with Apple Shortcuts

Free Sleep exposes a local REST API, so the Shortcuts app can control your Pod without opening a browser.
You do not need an Apple developer account. Shortcuts also work from the Home Screen, the Lock Screen,
Control Center, the Action button, Siri, and Automations (for example "when my Sleep Focus turns on").

Requirements:
- Your iPhone is on the same network as the Pod (or can otherwise reach its local IP).
- You know the Pod's IP address (step 14 of [INSTALLATION.md](../INSTALLATION.md)). Give it a fixed IP in your router so shortcuts keep working.

## Build a shortcut

1. Open **Shortcuts** and tap **+**.
2. Add the action **Get Contents of URL**.
3. Set the URL to `http://<pod-ip>:3000/api/deviceStatus`.
4. Tap the arrow to expand the action and set:
   - **Method**: `POST`
   - **Request Body**: `JSON`
5. Add the fields from one of the examples below. The side (`left` or `right`) is a **Dictionary** field;
   add the setting inside it with the type shown.
6. Name the shortcut and run it. The first run asks for permission to connect to devices on your local network; allow it.

A successful request returns an empty response (HTTP 204).

## Examples

All of these are `POST http://<pod-ip>:3000/api/deviceStatus`. Replace `left` with `right` for the other side.

| What it does | JSON body | Field type in Shortcuts |
| --- | --- | --- |
| Set the target temperature to 70°F | `{"left": {"targetTemperatureF": 70}}` | Number |
| Turn the side on | `{"left": {"isOn": true}}` | Boolean |
| Turn the side off | `{"left": {"isOn": false}}` | Boolean |
| Dismiss a vibrating alarm | `{"left": {"isAlarmVibrating": false}}` | Boolean |

Notes:
- `targetTemperatureF` is always Fahrenheit, from 55 to 110, whatever temperature format the app shows.
- Setting a temperature does not turn the side on. Send both in one request to do that:
  `{"left": {"isOn": true, "targetTemperatureF": 70}}`
- Turning a side on keeps it on for 12 hours unless a schedule turns it off earlier.
- You can change both sides in one request: `{"left": {"isOn": false}, "right": {"isOn": false}}`
- If one side is in away mode, changes to either side apply to both sides.

## Reading the current state

`GET http://<pod-ip>:3000/api/deviceStatus` returns the current state as JSON. In a shortcut, follow
**Get Contents of URL** with **Get Dictionary Value** (for example `left.isOn`) to branch on it,
such as a single "toggle my side" shortcut.

## Troubleshooting

- **The shortcut times out**: check that the phone is on the same network and that `http://<pod-ip>:3000` opens in Safari.
- **"Invalid request data" (HTTP 400)**: a field has the wrong type. Temperatures must be Number fields and
  `isOn` / `isAlarmVibrating` must be Boolean fields, not Text.
- **It stopped working after a while**: the Pod's IP address changed. Reserve an IP for it in your router.

See [server/API.md](../server/API.md) for the rest of the API.
