from app.core.security import CurrentUser


class TestRBAC:
    def test_admin_can_read_audit(self):
        user = CurrentUser(user_id="u1", roles=["ADMIN"], jti="j1")
        assert user.has_permission("AUDIT_READ")

    def test_dpo_can_read_audit(self):
        user = CurrentUser(user_id="u1", roles=["DATA_PROTECTION_OFFICER"], jti="j1")
        assert user.has_permission("AUDIT_READ")

    def test_doctor_cannot_read_audit(self):
        user = CurrentUser(user_id="u1", roles=["DOCTOR"], jti="j1")
        assert not user.has_permission("AUDIT_READ")

    def test_only_dpo_can_run_gdpr_report(self):
        dpo = CurrentUser(user_id="u1", roles=["DATA_PROTECTION_OFFICER"], jti="j1")
        admin = CurrentUser(user_id="u2", roles=["ADMIN"], jti="j2")
        assert dpo.has_permission("GDPR_REPORT")
        assert not admin.has_permission("GDPR_REPORT")
