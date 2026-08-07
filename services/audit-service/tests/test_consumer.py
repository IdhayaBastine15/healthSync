from app.services.consumer import envelope_to_audit_row


class TestEnvelopeToAuditRow:
    def test_audit_event_logged_passes_through_action(self):
        envelope = {"user_id": "u1", "action": "LOGIN", "resource_type": "auth", "outcome": "SUCCESS"}
        row = envelope_to_audit_row("audit.event.logged", envelope)
        assert row["action"] == "LOGIN"
        assert row["user_id"] == "u1"

    def test_patient_record_updated_derives_action(self):
        envelope = {"patient_id": "p1", "updated_by": "u1"}
        row = envelope_to_audit_row("patient.record.updated", envelope)
        assert row["action"] == "UPDATE"
        assert row["resource_type"] == "patient"
        assert row["user_id"] == "u1"

    def test_lab_result_filed_derives_action(self):
        envelope = {"patient_id": "p1", "result_id": "r1", "is_critical": False}
        row = envelope_to_audit_row("lab.result.filed", envelope)
        assert row["action"] == "CREATE"
        assert row["resource_type"] == "lab_result"
        assert row["resource_id"] == "r1"

    def test_lab_result_critical_derives_action(self):
        row = envelope_to_audit_row("lab.result.critical", {"patient_id": "p1", "result_id": "r1"})
        assert row["action"] == "CRITICAL_ALERT"

    def test_lab_result_acknowledged_derives_action_and_user(self):
        envelope = {"patient_id": "p1", "result_id": "r1", "acknowledged_by": "u2"}
        row = envelope_to_audit_row("lab.result.acknowledged", envelope)
        assert row["action"] == "ACKNOWLEDGE"
        assert row["user_id"] == "u2"

    def test_missing_outcome_defaults_to_success(self):
        row = envelope_to_audit_row("audit.event.logged", {"action": "VIEW"})
        assert row["outcome"] == "SUCCESS"

    def test_unrecognised_event_type_gets_unknown_action(self):
        row = envelope_to_audit_row("some.future.event", {})
        assert row["action"] == "UNKNOWN"
