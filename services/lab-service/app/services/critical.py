CRITICAL_THRESHOLDS = {
    "potassium":   {"low": 2.5, "high": 6.5, "unit": "mmol/L"},
    "sodium":      {"low": 120, "high": 160, "unit": "mmol/L"},
    "haemoglobin": {"low": 5.0, "high": None, "unit": "g/dL"},
    "troponin":    {"low": None, "high": 0.4, "unit": "ng/mL"},
    "glucose":     {"low": 2.0, "high": 30.0, "unit": "mmol/L"},
    "creatinine":  {"low": None, "high": 500, "unit": "umol/L"},
}


def is_critical(test_code: str, value: float) -> bool:
    thresholds = CRITICAL_THRESHOLDS.get(test_code)
    if not thresholds:
        return False
    if thresholds["low"] is not None and value < thresholds["low"]:
        return True
    if thresholds["high"] is not None and value > thresholds["high"]:
        return True
    return False


def interpret(test_code: str, value: float, reference_low: float | None, reference_high: float | None) -> str:
    if is_critical(test_code, value):
        thresholds = CRITICAL_THRESHOLDS[test_code]
        if thresholds["low"] is not None and value < thresholds["low"]:
            return "critical-low"
        return "critical-high"
    if reference_low is not None and value < reference_low:
        return "low"
    if reference_high is not None and value > reference_high:
        return "high"
    return "normal"
