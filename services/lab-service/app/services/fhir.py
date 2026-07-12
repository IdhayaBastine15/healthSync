from app.models.lab import LabResult, Observation


def result_to_fhir(result: LabResult, observations: list[Observation]) -> dict:
    """Serialise a LabResult + its Observations to a FHIR R4 DiagnosticReport (doc §5)."""
    return {
        "resourceType": "DiagnosticReport",
        "id": str(result.id),
        "status": result.status,
        "code": {"coding": [{"code": result.report_code, "display": result.report_display}]},
        "subject": {"reference": f"Patient/{result.patient_id}"},
        "effectiveDateTime": result.effective_at.isoformat() if result.effective_at else None,
        "issued": result.issued_at.isoformat() if result.issued_at else None,
        "result": [{"reference": f"Observation/{obs.id}"} for obs in observations],
    }


def observation_to_fhir(obs: Observation) -> dict:
    resource = {
        "resourceType": "Observation",
        "id": str(obs.id),
        "code": {"coding": [{"system": "http://loinc.org", "code": obs.loinc_code, "display": obs.display_name}]},
        "subject": {"reference": f"Patient/{obs.patient_id}"},
    }
    if obs.value_quantity is not None:
        resource["valueQuantity"] = {"value": float(obs.value_quantity), "unit": obs.unit}
    elif obs.value_string is not None:
        resource["valueString"] = obs.value_string
    if obs.interpretation:
        resource["interpretation"] = [{"coding": [{"code": obs.interpretation}]}]
    return resource
