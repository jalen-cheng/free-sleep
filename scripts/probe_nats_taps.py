"""Debug probe: print what the Pod's local NATS server publishes while you tap the bed.

Run on the Pod and tap each side (double, triple, quad) while it is running:
    /home/dac/venv/bin/python /home/dac/free-sleep/scripts/probe_nats_taps.py

The high-rate sensor subjects are hidden so a tap subject (if one exists) stands out.
Pass --all to print them too, and --duration SECONDS to stop automatically.
"""

import argparse
import asyncio
from datetime import datetime

NATS_URL = 'nats://127.0.0.1:4222'
# Continuous sensor streams, far too chatty to spot a tap in
HIGH_RATE_SUBJECTS = ('raw.sens.piezo', 'raw.sens.capsense', 'raw.sens.bedtemp', 'raw.frz.temp')
PAYLOAD_PREVIEW_BYTES = 120


def is_high_rate(subject):
    """True for a high-rate sensor subject or anything published beneath it."""
    return any(subject == prefix or subject.startswith(prefix + '.') for prefix in HIGH_RATE_SUBJECTS)


async def probe(show_all, duration_seconds):
    import nats  # Imported here so --help works on Pods without nats-py

    connection = await nats.connect(NATS_URL)
    hidden_counts = {}

    async def handle_message(message):
        if not show_all and is_high_rate(message.subject):
            hidden_counts[message.subject] = hidden_counts.get(message.subject, 0) + 1
            return
        timestamp = datetime.now().strftime('%H:%M:%S.%f')[:-3]
        preview = message.data[:PAYLOAD_PREVIEW_BYTES]
        print(f'{timestamp} | {message.subject} | {len(message.data)} bytes | {preview!r}', flush=True)

    await connection.subscribe('>', cb=handle_message)
    print(f'Listening on {NATS_URL}. Tap the bed now. Ctrl+C to stop.', flush=True)
    try:
        await asyncio.sleep(duration_seconds if duration_seconds else float('inf'))
    except asyncio.CancelledError:
        pass
    finally:
        await connection.close()
        for subject, count in sorted(hidden_counts.items()):
            print(f'hidden: {subject} x{count}')


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument('--all', action='store_true', help='also print the high-rate sensor subjects')
    parser.add_argument('--duration', type=float, default=0, help='stop after this many seconds (default: run until Ctrl+C)')
    arguments = parser.parse_args()
    try:
        asyncio.run(probe(arguments.all, arguments.duration))
    except KeyboardInterrupt:
        pass


if __name__ == '__main__':
    main()
