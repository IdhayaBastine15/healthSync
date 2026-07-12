from app.models.patient import Patient


def patient_to_fhir(patient: Patient) -> dict:
    """Serialise a Patient row to a FHIR R4 Patient resource (doc §6)."""
    resource = {
        "resourceType": "Patient",
        "id": str(patient.id),
        "meta": {
            "versionId": str(patient.version),
            "lastUpdated": patient.updated_at.isoformat() if patient.updated_at else None,
            "source": "healthsync://patient-service",
        },
        "identifier": [{"system": "urn:oid:healthsync:mrn", "value": patient.mrn}],
        "active": patient.is_active,
        "name": [{"use": "official", "family": patient.family_name, "given": [patient.given_name]}],
        "gender": patient.gender,
        "birthDate": patient.date_of_birth.isoformat() if patient.date_of_birth else None,
    }
    return resource
