"""
Measures what temperature the Pod actually reaches at each level, to check (and later replace)
Free Sleep's assumption that levels -100..100 map evenly onto 55..110°F.

For each level it sets both sides, waits for the water to settle, then averages the Pod's own
temperature sensors over a short window. Results are printed and saved as JSON.

Before running:
- Nobody in the bed (body heat changes the surface sensors), covers as you normally sleep.
- Free Sleep must be running. Schedules are not paused: run it when none will fire.
- It takes about (settle + sample minutes) per level; the defaults take roughly two hours.

Usage (on the Pod):
    cd /home/dac/free-sleep/biometrics/temperature_calibration && \
    /home/dac/venv/bin/python collect_temperature_calibration.py

Options:
    --levels=-80,-40,0,40,80   Pod levels to measure (-100..100)
    --settle-minutes=20        Time to wait at each level before measuring
    --sample-minutes=3         How long to average the sensors for
    --output=PATH              Where to save the results
"""
import json
import os
import platform
import sys
import time
import urllib.request
from argparse import ArgumentParser
from datetime import datetime, timedelta, timezone

sys.path.append(os.getcwd())
FOLDER_PATH = './'
DEFAULT_OUTPUT = './temperature_calibration.json'
if platform.system().lower() == 'linux':
    FOLDER_PATH = '/persistent/'
    DEFAULT_OUTPUT = '/persistent/free-sleep-data/temperature_calibration.json'
    sys.path.append('/home/dac/free-sleep/biometrics/')
    sys.path.append('/home/dac/free-sleep/biometrics/temperature_calibration/')

from calibration_math import fit_line, level_to_assumed_temp_f, parse_levels, summarize_readings

DEVICE_STATUS_URL = 'http://127.0.0.1:3000/api/deviceStatus'
SIDES = ('left', 'right')
SECONDS_PER_MINUTE = 60
# Sensors on each side of the cover, as named in the bedTemp records
BED_SENSOR_KEYS = ('side', 'out', 'cen', 'in')


def get_device_status() -> dict:
    with urllib.request.urlopen(DEVICE_STATUS_URL, timeout=30) as response:
        return json.loads(response.read())


def post_device_status(payload: dict):
    request = urllib.request.Request(
        DEVICE_STATUS_URL,
        data=json.dumps(payload).encode(),
        headers={'Content-Type': 'application/json'},
        method='POST',
    )
    with urllib.request.urlopen(request, timeout=60):
        pass


def set_level(level: int):
    """Turns both sides on at one level. The API takes °F and converts back to a level, and it
    accepts fractions, so sending the assumed °F for the level lands on exactly that level."""
    side_status = {'isOn': True, 'targetTemperatureF': level_to_assumed_temp_f(level)}
    post_device_status({side: side_status for side in SIDES})


def restore_device_status(original_status: dict):
    """Puts each side back to the power state and target it had before calibration."""
    payload = {}
    for side in SIDES:
        payload[side] = {'isOn': original_status[side]['isOn']}
        if original_status[side]['isOn']:
            payload[side]['targetTemperatureF'] = original_status[side]['targetTemperatureF']
    post_device_status(payload)


def read_sensor_window(start_time: datetime, end_time: datetime) -> dict:
    """Loads the Pod's temperature records for a time window (RAW files or NATS, whichever the Pod uses)."""
    # Imported here so --help works without the biometrics dependencies
    from load_raw_files import load_raw_files
    return load_raw_files(FOLDER_PATH, start_time, end_time, 'left', raw_data_types=['bedTemp', 'frzTemp'])


def summarize_window(sensor_data: dict) -> dict:
    """Averages every temperature sensor over the window, per side plus the shared ones."""
    water_records = sensor_data.get('freeze_temps', [])
    bed_records = sensor_data.get('bed_temps', [])
    summary = {
        'ambient_hub': summarize_readings([record['amb'] for record in water_records if 'amb' in record]),
        'heatsink': summarize_readings([record['hs'] for record in water_records if 'hs' in record]),
        'ambient_cover': summarize_readings([record['amb'] for record in bed_records if 'amb' in record]),
    }
    for side in SIDES:
        side_summary = {'water': summarize_readings([record[side] for record in water_records if side in record])}
        for sensor_key in BED_SENSOR_KEYS:
            readings = [record[side][sensor_key] for record in bed_records if sensor_key in record.get(side, {})]
            side_summary[f'bed_{sensor_key}'] = summarize_readings(readings)
        summary[side] = side_summary
    return summary


def measure_level(level: int, settle_minutes: float, sample_minutes: float) -> dict:
    """Holds one level until it settles, then measures it."""
    print(f'Level {level}: setting, then waiting {settle_minutes:g} min to settle...', flush=True)
    set_level(level)
    time.sleep(settle_minutes * SECONDS_PER_MINUTE)
    window_start = datetime.now(timezone.utc)
    time.sleep(sample_minutes * SECONDS_PER_MINUTE)
    window_end = datetime.now(timezone.utc)
    device_status = get_device_status()
    point = {
        'level': level,
        'assumed_temp_f': round(level_to_assumed_temp_f(level), 2),
        'window_start': window_start.isoformat(),
        'window_end': window_end.isoformat(),
        # What the firmware itself says each side has reached, on the same -100..100 scale
        'reported_level': {side: device_status[side]['currentTemperatureLevel'] for side in SIDES},
        'sensors': summarize_window(read_sensor_window(window_start - timedelta(seconds=5), window_end)),
    }
    for side in SIDES:
        water = point['sensors'][side]['water']
        if water:
            print(f'  {side}: water {water["mean_f"]}°F (±{water["spread_f"]}), assumed {point["assumed_temp_f"]}°F', flush=True)
        else:
            print(f'  {side}: no water temperature records in the window', flush=True)
    return point


def fit_results(points: list) -> dict:
    """Fits measured water temperature against level, for each side."""
    fits = {}
    for side in SIDES:
        measured = [(point['level'], point['sensors'][side]['water']) for point in points]
        usable = [(level, water['mean_f']) for level, water in measured if water]
        fits[side] = fit_line([level for level, _ in usable], [temp_f for _, temp_f in usable])
    return fits


def main():
    parser = ArgumentParser(description=__doc__)
    parser.add_argument('--levels', default='-80,-40,0,40,80')
    parser.add_argument('--settle-minutes', type=float, default=20)
    parser.add_argument('--sample-minutes', type=float, default=3)
    parser.add_argument('--output', default=DEFAULT_OUTPUT)
    arguments = parser.parse_args()
    levels = parse_levels(arguments.levels)

    original_status = get_device_status()
    points = []
    try:
        for level in levels:
            points.append(measure_level(level, arguments.settle_minutes, arguments.sample_minutes))
    except KeyboardInterrupt:
        print('Stopped early, keeping the levels measured so far.', flush=True)
    finally:
        print('Restoring the previous power and temperature...', flush=True)
        restore_device_status(original_status)

    results = {
        'created_at': datetime.now(timezone.utc).isoformat(),
        'cover_version': original_status.get('coverVersion'),
        'hub_version': original_status.get('hubVersion'),
        'settle_minutes': arguments.settle_minutes,
        'sample_minutes': arguments.sample_minutes,
        'points': points,
        'water_fit': fit_results(points),
    }
    with open(arguments.output, 'w') as output_file:
        json.dump(results, output_file, indent=2)
    print(f'Saved {len(points)} levels to {arguments.output}')
    print(json.dumps(results['water_fit'], indent=2))
    print('Free Sleep currently assumes 0.275°F per level and 82.5°F at level 0.')


if __name__ == '__main__':
    main()
