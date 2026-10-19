import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from backend.models.fusion_engine import (
    evaluate_digital_twin_state,
    simulate_in_silico_interventions,
    generate_fhir_r4_bundle,
    escalation_audit_log,
    df_ehr,
    df_stream
)

app = FastAPI(
    title="VitalTwins API",
    description="Mechanistic PK/PD + ML Predictive Cardiovascular Digital Twin Engine",
    version="3.0.0"
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
    return {"status": "online", "system": "VitalTwins Mechanistic PK/PD API v3.0"}

@app.get("/api/patients")
def get_all_patients():
    patients = df_ehr[["patient_id", "name", "age", "gender", "high_baseline_risk"]].to_dict(orient="records")
    return {"patients": patients}

@app.get("/api/twin/{patient_id}/{hour_offset}")
def get_twin_state(patient_id: str, hour_offset: int):
    return evaluate_digital_twin_state(patient_id, hour_offset)

@app.get("/api/simulate/{patient_id}/{hour_offset}")
def get_in_silico_simulation(patient_id: str, hour_offset: int):
    """Runs 12-hour counterfactual PK/PD drug simulations on the patient's Shadow Twin."""
    return simulate_in_silico_interventions(patient_id, hour_offset)

@app.get("/api/fhir/{patient_id}/{hour_offset}")
def get_fhir_bundle(patient_id: str, hour_offset: int):
    return generate_fhir_r4_bundle(patient_id, hour_offset)

@app.get("/api/escalations")
def get_escalation_logs():
    return {"escalations": escalation_audit_log[:10]}

@app.get("/api/stream/{patient_id}")
def get_full_stream(patient_id: str):
    p_stream = df_stream[df_stream["patient_id"] == patient_id].to_dict(orient="records")
    return {"patient_id": patient_id, "timeline": p_stream}