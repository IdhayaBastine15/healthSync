from app.core.security import CurrentUser, hash_password, verify_password


class TestPasswordHashing:
    def test_hash_and_verify_roundtrip(self):
        hashed = hash_password("correct-horse-battery-staple")
        assert verify_password("correct-horse-battery-staple", hashed)

    def test_wrong_password_fails(self):
        hashed = hash_password("correct-horse-battery-staple")
        assert not verify_password("wrong-password", hashed)


class TestRBAC:
    def test_doctor_can_read_patient(self):
        user = CurrentUser(user_id="u1", roles=["DOCTOR"], jti="j1")
        assert user.has_permission("PATIENT_READ")

    def test_nurse_cannot_write_patient(self):
        user = CurrentUser(user_id="u1", roles=["NURSE"], jti="j1")
        assert not user.has_permission("PATIENT_WRITE")

    def test_lab_tech_cannot_read_patient_record(self):
        user = CurrentUser(user_id="u1", roles=["LAB_TECH"], jti="j1")
        assert not user.has_permission("PATIENT_READ")

    def test_dpo_can_run_gdpr_report(self):
        user = CurrentUser(user_id="u1", roles=["DATA_PROTECTION_OFFICER"], jti="j1")
        assert user.has_permission("GDPR_REPORT")

    def test_admin_has_user_manage(self):
        user = CurrentUser(user_id="u1", roles=["ADMIN"], jti="j1")
        assert user.has_permission("USER_MANAGE")

    def test_unknown_role_has_no_permissions(self):
        user = CurrentUser(user_id="u1", roles=["INTERN"], jti="j1")
        assert not user.has_permission("PATIENT_READ")
