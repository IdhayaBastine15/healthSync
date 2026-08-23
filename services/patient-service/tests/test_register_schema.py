import pytest
from pydantic import ValidationError

from app.schemas.patient import RegisterRequest


def _base_kwargs(**overrides):
    kwargs = dict(
        email="new@healthsync.ie",
        password="password123",
        given_name="Ada",
        family_name="Byrne",
        roles=["NURSE"],
    )
    kwargs.update(overrides)
    return kwargs


class TestRegisterRequestRoles:
    def test_accepts_known_roles(self):
        req = RegisterRequest(**_base_kwargs(roles=["DOCTOR", "ADMIN"]))
        assert req.roles == ["DOCTOR", "ADMIN"]

    def test_rejects_unknown_role(self):
        with pytest.raises(ValidationError, match="Unknown role"):
            RegisterRequest(**_base_kwargs(roles=["SUPERUSER"]))

    def test_rejects_empty_roles(self):
        with pytest.raises(ValidationError):
            RegisterRequest(**_base_kwargs(roles=[]))

    def test_rejects_short_password(self):
        with pytest.raises(ValidationError):
            RegisterRequest(**_base_kwargs(password="short"))
