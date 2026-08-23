from app.core.security import CurrentUser


class TestRBAC:
    def test_admin_can_read_analytics(self):
        user = CurrentUser(user_id="u1", roles=["ADMIN"], jti="j1")
        assert user.has_permission("ANALYTICS_READ")

    def test_consultant_can_read_analytics(self):
        user = CurrentUser(user_id="u1", roles=["CONSULTANT"], jti="j1")
        assert user.has_permission("ANALYTICS_READ")

    def test_nurse_cannot_read_analytics(self):
        user = CurrentUser(user_id="u1", roles=["NURSE"], jti="j1")
        assert not user.has_permission("ANALYTICS_READ")

    def test_lab_tech_cannot_read_analytics(self):
        user = CurrentUser(user_id="u1", roles=["LAB_TECH"], jti="j1")
        assert not user.has_permission("ANALYTICS_READ")
