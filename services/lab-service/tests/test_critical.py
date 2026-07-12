from app.services.critical import interpret, is_critical


class TestIsCritical:
    def test_low_potassium_is_critical(self):
        assert is_critical("potassium", 2.0)

    def test_high_potassium_is_critical(self):
        assert is_critical("potassium", 7.0)

    def test_normal_potassium_is_not_critical(self):
        assert not is_critical("potassium", 4.0)

    def test_high_troponin_is_critical(self):
        assert is_critical("troponin", 0.5)

    def test_low_troponin_has_no_low_threshold(self):
        assert not is_critical("troponin", 0.0)

    def test_low_haemoglobin_is_critical(self):
        assert is_critical("haemoglobin", 4.0)

    def test_high_haemoglobin_has_no_high_threshold(self):
        assert not is_critical("haemoglobin", 25.0)

    def test_unknown_test_code_is_never_critical(self):
        assert not is_critical("unobtainium", 999)


class TestInterpret:
    def test_critical_low_value(self):
        assert interpret("potassium", 2.0, 3.5, 5.0) == "critical-low"

    def test_critical_high_value(self):
        assert interpret("potassium", 7.0, 3.5, 5.0) == "critical-high"

    def test_low_but_not_critical(self):
        assert interpret("potassium", 3.0, 3.5, 5.0) == "low"

    def test_high_but_not_critical(self):
        assert interpret("potassium", 5.5, 3.5, 5.0) == "high"

    def test_normal_value(self):
        assert interpret("potassium", 4.0, 3.5, 5.0) == "normal"
