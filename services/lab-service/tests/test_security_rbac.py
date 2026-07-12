from app.core.security import CurrentUser


class TestRBAC:
    def test_lab_tech_can_file_result(self):
        user = CurrentUser(user_id="u1", roles=["LAB_TECH"], jti="j1")
        assert user.has_permission("RESULT_FILE")

    def test_nurse_cannot_file_result(self):
        user = CurrentUser(user_id="u1", roles=["NURSE"], jti="j1")
        assert not user.has_permission("RESULT_FILE")

    def test_doctor_can_read_result(self):
        user = CurrentUser(user_id="u1", roles=["DOCTOR"], jti="j1")
        assert user.has_permission("RESULT_READ")

    def test_lab_tech_can_read_result(self):
        user = CurrentUser(user_id="u1", roles=["LAB_TECH"], jti="j1")
        assert user.has_permission("RESULT_READ")

    def test_nurse_can_acknowledge_result(self):
        user = CurrentUser(user_id="u1", roles=["NURSE"], jti="j1")
        assert user.has_permission("RESULT_ACKNOWLEDGE")

    def test_lab_tech_cannot_acknowledge_result(self):
        user = CurrentUser(user_id="u1", roles=["LAB_TECH"], jti="j1")
        assert not user.has_permission("RESULT_ACKNOWLEDGE")

    def test_unknown_role_has_no_permissions(self):
        user = CurrentUser(user_id="u1", roles=["INTERN"], jti="j1")
        assert not user.has_permission("RESULT_READ")
