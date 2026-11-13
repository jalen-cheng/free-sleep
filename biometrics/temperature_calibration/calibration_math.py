"""Pure calculations for temperature calibration. No Pod access, so it can be unit tested anywhere."""

from statistics import mean, pstdev
from typing import Dict, List, Optional

# Free Sleep's current assumption: Pod levels -100..100 map evenly onto 55..110°F
MIN_LEVEL = -100
MAX_LEVEL = 100
NEUTRAL_TEMP_F = 82.5
DEGREES_F_PER_LEVEL = 27.5 / 100

# Sensor readings look like hundredths of a degree Celsius (e.g. 1975 for a 19.75°C room).
# That unit is inferred from sample records, not documented, so raw values are kept in the output.
RAW_UNITS_PER_DEGREE_C = 100


def level_to_assumed_temp_f(level: float) -> float:
    """The °F that Free Sleep currently shows for a Pod level."""
    return NEUTRAL_TEMP_F + level * DEGREES_F_PER_LEVEL


def raw_to_fahrenheit(raw_value: float) -> float:
    """Converts a raw sensor reading to °F, assuming hundredths of a degree Celsius."""
    return raw_value / RAW_UNITS_PER_DEGREE_C * 9 / 5 + 32


def summarize_readings(raw_values: List[float]) -> Optional[Dict[str, float]]:
    """Mean and spread of one sensor over a sampling window. A large spread means the
    temperature was still moving, so that point should not be trusted."""
    if not raw_values:
        return None
    return {
        'samples': len(raw_values),
        'raw_mean': round(mean(raw_values), 1),
        'mean_f': round(raw_to_fahrenheit(mean(raw_values)), 2),
        'spread_f': round(pstdev(raw_values) / RAW_UNITS_PER_DEGREE_C * 9 / 5, 2),
    }


def fit_line(levels: List[float], temps_f: List[float]) -> Optional[Dict[str, float]]:
    """Least-squares line through measured temperature against level.
    Returns the slope (°F per level), the intercept (°F at level 0) and r squared, which is
    close to 1 when a straight line describes the Pod well."""
    if len(levels) != len(temps_f) or len(levels) < 2:
        return None
    level_mean = mean(levels)
    temp_mean = mean(temps_f)
    level_variance = sum((level - level_mean) ** 2 for level in levels)
    if level_variance == 0:
        return None
    covariance = sum((level - level_mean) * (temp - temp_mean) for level, temp in zip(levels, temps_f))
    slope = covariance / level_variance
    intercept = temp_mean - slope * level_mean
    total_variance = sum((temp - temp_mean) ** 2 for temp in temps_f)
    residual = sum((temp - (intercept + slope * level)) ** 2 for level, temp in zip(levels, temps_f))
    r_squared = 1.0 if total_variance == 0 else 1 - residual / total_variance
    return {
        'degrees_f_per_level': round(slope, 4),
        'temp_f_at_level_0': round(intercept, 2),
        'r_squared': round(r_squared, 4),
    }


def parse_levels(text: str) -> List[int]:
    """Parses a comma separated list of Pod levels, e.g. "-80,-40,0,40,80"."""
    levels = [int(part) for part in text.split(',') if part.strip()]
    for level in levels:
        if level < MIN_LEVEL or level > MAX_LEVEL:
            raise ValueError(f'Level {level} is outside {MIN_LEVEL}..{MAX_LEVEL}')
    if len(set(levels)) < 2:
        raise ValueError('At least two different levels are needed to fit a line')
    return levels
