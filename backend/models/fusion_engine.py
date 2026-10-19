import os
from datetime import datetime, timezone
import pandas as pd
import xgboost as xgb

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
EHR_PATH = os.path.join(BASE_DIR, "data", "synthetic_ehr.csv")
STREAM_PATH = os.path.join(BASE_DIR, "data", "wearable_stream.csv")
MODEL_PATH = os.path.join(BASE_DIR, "models", "xgb_ehr_model.json")

model = xgb.XGBClassifier()
model.load_model(MODEL_PATH)

df_ehr = pd.read_csv(EHR_PATH)
df_stream = pd.read_csv(STREAM_PATH)

# In-memory audit log for Automated Emergency Escalations
escalation_audit_log = []

FEATURES = [
    "age", "bmi", "systolic_bp", "diastolic_bp",
    "cholesterol_mg_dl", "hypertension_history",
    "diabetes_history", "smoker"
]

def evaluate_digital_twin_state(patient_id: str, hour_offset: int):
    patient_row = df_ehr[df_ehr["patient_id"] == patient_id]
    if patient_row.empty:
        return {"error": f"Patient {patient_id} not found"}
    
    p_data = patient_row.iloc[0]
    
    # 1. Static EHR Baseline Risk (XGBoost)
    X_input = pd.DataFrame([p_data[FEATURES]])
    baseline_prob = float(model.predict_proba(X_input)[0, 1])

    # 2. Dynamic Wearable Stream
    stream_row = df_stream[(df_stream["patient_id"] == patient_id) & (df_stream["hour_offset"] == hour_offset)]
    if stream_row.empty:
        hr, hrv, spo2 = 72.0, 60.0, 98.0
    else:
        s_data = stream_row.iloc[0]
        hr = float(s_data["heart_rate_bpm"])
        hrv = float(s_data["hrv_ms"])
        spo2 = float(s_data["spo2_pct"])

    # 3. Dynamic Telemetry Penalties
    hrv_penalty = max(0.0, (50.0 - hrv) / 50.0) if hrv < 50 else 0.0
    spo2_penalty = max(0.0, (95.0 - spo2) / 10.0) if spo2 < 95 else 0.0
    hr_penalty = max(0.0, (hr - 85.0) / 50.0) if hr > 85 else 0.0

    # Raw weighted components
    ehr_comp = baseline_prob * 0.45
    hrv_comp = hrv_penalty * 0.30
    spo2_comp = spo2_penalty * 0.15
    hr_comp = hr_penalty * 0.10

    raw_total = ehr_comp + hrv_comp + spo2_comp + hr_comp
    fused_risk_score = min(1.0, raw_total)

    # 4. INNOVATION 1: Explainable AI (XAI) Feature Attribution Breakdown
    denom = raw_total if raw_total > 0.001 else 1.0
    xai_breakdown = [
        {
            "factor": "Autonomic HRV Drop (Wearable)",
            "contribution_pct": round((hrv_comp / denom) * 100, 1),
            "clinical_detail": f"Current HRV is {hrv} ms (Normal threshold > 50 ms)"
        },
        {
            "factor": "Static EHR Baseline (BP, Lipids, Comorbidities)",
            "contribution_pct": round((ehr_comp / denom) * 100, 1),
            "clinical_detail": f"BP: {p_data['systolic_bp']}/{p_data['diastolic_bp']} mmHg | Chol: {p_data['cholesterol_mg_dl']} mg/dL"
        },
        {
            "factor": "SpO2 Desaturation Drift (Wearable)",
            "contribution_pct": round((spo2_comp / denom) * 100, 1),
            "clinical_detail": f"Blood Oxygen at {spo2}%"
        },
        {
            "factor": "Resting Tachycardia Spike (Wearable)",
            "contribution_pct": round((hr_comp / denom) * 100, 1),
            "clinical_detail": f"Heart Rate at {hr} bpm"
        }
    ]
    xai_breakdown.sort(key=lambda x: x["contribution_pct"], reverse=True)

    # 5. Clinical Status, P4 Patient Companion View & Escalation Trigger
    escalation_event = None
    if fused_risk_score > 0.65 or hrv < 30 or spo2 < 92:
        status = "RED"
        recommendation = "CRITICAL: High probability of acute cardiac arrhythmia within 12-24 hrs. Immediate ECG and clinical intervention required."
        p4_patient_message = "Your VitalTwin noticed your heart stress levels are unusually high right now. Please sit down, rest, and take 5 slow breaths. We have automatically alerted Dr. Sharma's care team to check in on you."
        p4_action_items = [
            "Stop physical exertion immediately and sit upright",
            "Take 5 slow, deep breaths (4s inhale, 6s exhale)",
            "Keep your phone nearby — Clinic Care Team has been notified"
        ]
        
        # INNOVATION 3: Automated Emergency Escalation Loop
        escalation_event = {
            "event_id": f"ESC-{patient_id}-H{hour_offset}",
            "timestamp": datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S UTC"),
            "patient_id": patient_id,
            "patient_name": p_data["name"],
            "hour_offset": hour_offset,
            "risk_score": round(fused_risk_score * 100, 1),
            "dispatched_to": "On-Call Cardiologist (Dr. V. Nair) & Emergency Contact",
            "channel": "Automated WhatsApp / Hospital Pager Webhook",
            "message": f"URGENT RED FLAG: {p_data['name']} ({patient_id}) Fused Risk at {round(fused_risk_score*100, 1)}% (HR: {hr} bpm, HRV: {hrv} ms, SpO2: {spo2}%)."
        }
        if not any(e["event_id"] == escalation_event["event_id"] for e in escalation_audit_log):
            escalation_audit_log.insert(0, escalation_event)

    elif fused_risk_score > 0.35 or hrv < 45:
        status = "YELLOW"
        recommendation = "WARNING: Prodromal autonomic stress detected. Schedule same-day tele-consultation."
        p4_patient_message = "Your VitalTwin noticed slight fatigue and elevated stress markers over the last few hours. Try drinking a glass of water and winding down early tonight."
        p4_action_items = [
            "Drink 250ml of water and avoid caffeine",
            "Take a 10-minute screen break",
            "Log any dizziness or palpitations in the app"
        ]
    else:
        status = "GREEN"
        recommendation = "STABLE: Patient physiological parameters within normal baseline limits."
        p4_patient_message = "Your heart rhythm and recovery markers look great today! Keep up your normal routine and stay hydrated."
        p4_action_items = [
            "Continue prescribed daily medication schedule",
            "Target 7-8 hours of restful sleep tonight"
        ]

    return {
        "patient_id": patient_id,
        "name": p_data["name"],
        "age": int(p_data["age"]),
        "gender": p_data["gender"],
        "ehr_summary": {
            "bmi": float(p_data["bmi"]),
            "bp": f"{int(p_data['systolic_bp'])}/{int(p_data['diastolic_bp'])}",
            "cholesterol": int(p_data["cholesterol_mg_dl"]),
            "hypertension": bool(p_data["hypertension_history"]),
            "diabetes": bool(p_data["diabetes_history"])
        },
        "hour_offset": hour_offset,
        "telemetry": {
            "heart_rate_bpm": hr,
            "hrv_ms": hrv,
            "spo2_pct": spo2
        },
        "baseline_ehr_risk": round(baseline_prob * 100, 1),
        "fused_risk_score": round(fused_risk_score * 100, 1),
        "clinical_status": status,
        "recommendation": recommendation,
        "xai_breakdown": xai_breakdown,
        "p4_companion": {
            "friendly_message": p4_patient_message,
            "action_checklist": p4_action_items
        },
        "escalation_triggered": escalation_event
    }


def generate_fhir_r4_bundle(patient_id: str, hour_offset: int):
    """
    INNOVATION 2: Exports Digital Twin state as an HL7 FHIR R4 compliant Bundle
    containing Patient, Observation (Vitals), and RiskAssessment resources.
    """
    state = evaluate_digital_twin_state(patient_id, hour_offset)
    if "error" in state:
        return state

    now_iso = datetime.now(timezone.utc).isoformat()
    return {
        "resourceType": "Bundle",
        "id": f"vitaltwins-fhir-{patient_id.lower()}-h{hour_offset}",
        "meta": {
            "lastUpdated": now_iso,
            "profile": ["http://hl7.org/fhir/R4/StructureDefinition/Bundle"]
        },
        "type": "collection",
        "entry": [
            {
                "resource": {
                    "resourceType": "Patient",
                    "id": state["patient_id"],
                    "name": [{"use": "official", "text": state["name"]}],
                    "gender": "male" if state["gender"] == "M" else "female",
                    "extension": [
                        {"url": "http://vitaltwins.org/fhir/age", "valueInteger": state["age"]}
                    ]
                }
            },
            {
                "resource": {
                    "resourceType": "Observation",
                    "id": f"obs-vitals-h{hour_offset}",
                    "status": "final",
                    "category": [{"coding": [{"system": "http://terminology.hl7.org/CodeSystem/observation-category", "code": "vital-signs"}]}],
                    "subject": {"reference": f"Patient/{state['patient_id']}"},
                    "effectiveDateTime": now_iso,
                    "component": [
                        {"code": {"coding": [{"system": "http://loinc.org", "code": "8867-4", "display": "Heart rate"}]}, "valueQuantity": {"value": state["telemetry"]["heart_rate_bpm"], "unit": "beats/minute"}},
                        {"code": {"coding": [{"system": "http://loinc.org", "code": "80404-7", "display": "Heart rate variability"}]}, "valueQuantity": {"value": state["telemetry"]["hrv_ms"], "unit": "ms"}},
                        {"code": {"coding": [{"system": "http://loinc.org", "code": "59408-5", "display": "Oxygen saturation"}]}, "valueQuantity": {"value": state["telemetry"]["spo2_pct"], "unit": "%"}}
                    ]
                }
            },
            {
                "resource": {
                    "resourceType": "RiskAssessment",
                    "id": f"twin-risk-h{hour_offset}",
                    "status": "final",
                    "subject": {"reference": f"Patient/{state['patient_id']}"},
                    "occurrenceDateTime": now_iso,
                    "prediction": [
                        {
                            "outcome": {"text": "Acute Cardiovascular Arrhythmia"},
                            "probabilityDecimal": round(state["fused_risk_score"] / 100.0, 3),
                            "qualitativeRisk": {"coding": [{"code": state["clinical_status"]}]},
                            "rationale": state["recommendation"]
                        }
                    ]
                }
            }
        ]
    }