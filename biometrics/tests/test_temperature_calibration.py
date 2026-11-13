"""Tests for the temperature calibration calculations; run with unittest discover -s biometrics/tests."""

from pathlib import Path
import sys
import unittest

calibration_path = Path(__file__).resolve().parents[1] / 'temperature_calibration'
sys.path.insert(0, str(calibration_path))

from calibration_math import (
    fit_line,
    level_to_assumed_temp_f,
    parse_levels,
    raw_to_fahrenheit,
    summarize_readings,
)


class TemperatureCalibrationMathTest(unittest.TestCase):
    def test_assumed_temperature_matches_the_servers_mapping(self):
        self.assertEqual(level_to_assumed_temp_f(-100), 55)
        self.assertEqual(level_to_assumed_temp_f(0), 82.5)
        self.assertEqual(level_to_assumed_temp_f(100), 110)

    def test_raw_readings_are_hundredths_of_a_degree_celsius(self):
        self.assertAlmostEqual(raw_to_fahrenheit(2000), 68.0)
        self.assertAlmostEqual(raw_to_fahrenheit(0), 32.0)

    def test_summary_reports_mean_and_spread(self):
        summary = summarize_readings([1900, 2000, 2100])
        self.assertEqual(summary['samples'], 3)
        self.assertEqual(summary['raw_mean'], 2000)
        self.assertEqual(summary['mean_f'], 68.0)
        self.assertGreater(summary['spread_f'], 0)

    def test_summary_of_no_readings_is_none(self):
        self.assertIsNone(summarize_readings([]))

    def test_fit_recovers_a_straight_line(self):
        levels = [-80, -40, 0, 40, 80]
        temps_f = [level_to_assumed_temp_f(level) for level in levels]
        fit = fit_line(levels, temps_f)
        self.assertAlmostEqual(fit['degrees_f_per_level'], 0.275)
        self.assertAlmostEqual(fit['temp_f_at_level_0'], 82.5)
        self.assertAlmostEqual(fit['r_squared'], 1.0)

    def test_fit_reports_a_poor_line(self):
        fit = fit_line([-80, -40, 0, 40, 80], [60, 61, 80, 99, 100])
        self.assertLess(fit['r_squared'], 0.99)

    def test_fit_needs_two_different_levels(self):
        self.assertIsNone(fit_line([0], [80]))
        self.assertIsNone(fit_line([10, 10], [80, 81]))

    def test_levels_are_parsed_and_checked(self):
        self.assertEqual(parse_levels('-80, 0,80'), [-80, 0, 80])
        with self.assertRaises(ValueError):
            parse_levels('0,120')
        with self.assertRaises(ValueError):
            parse_levels('40,40')


if __name__ == '__main__':
    unittest.main()
