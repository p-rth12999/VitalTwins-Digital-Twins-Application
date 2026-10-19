import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from backend.models.fusion_engine import (
    evaluate_digital_twin_state,
    generate_fhir_r4_bundle,
    escalation_audit_log,
    df_ehr,
    df_stream
)

app = FastAPI(
    title="VitalTwins API",
    description="Digital Twin Predictive Cardiovascular Anomaly Engine with XAI, FHIR R4 & P4 Medicine",
    version="2.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/")
def read_root():
    return {"status": "online", "system": "VitalTwins API v2.0"}

@app.get("/api/patients")
def get_all_patients():
    patients = df_ehr[["patient_id", "name", "age", "gender", "high_baseline_risk"]].to_dict(orient="records")
    return {"patients": patients}

@app.get("/api/twin/{patient_id}/{hour_offset}")
def get_twin_state(patient_id: str, hour_offset: int):
    return evaluate_digital_twin_state(patient_id, hour_offset)

@app.get("/api/fhir/{patient_id}/{hour_offset}")
def get_fhir_bundle(patient_id: str, hour_offset: int):
    """Returns HL7 FHIR R4 compliant JSON Bundle for hospital EHR interoperability."""
    return generate_fhir_r4_bundle(patient_id, hour_offset)

@app.get("/api/escalations")
def get_escalation_logs():
    """Returns automated emergency webhook dispatch logs."""
    return {"escalations": escalation_audit_log[:10]}

@app.get("/api/stream/{patient_id}")
def get_full_stream(patient_id: str):
    p_stream = df_stream[df_stream["patient_id"] == patient_id].to_dict(orient="records")
    return {"patient_id": patient_id, "timeline": p_stream}