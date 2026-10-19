import os
import math
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

escalation_audit_log = []

FEATURES = [
    "age", "bmi", "systolic_bp", "diastolic_bp",
    "cholesterol_mg_dl", "hypertension_history",
    "diabetes_history", "smoker"
]

# Pharmacokinetic & Pharmacodynamic (PK/PD) Drug Library
DRUG_CATALOG = {
    "METOPROLOL_25": {
        "id": "METOPROLOL_25",
        "name": "Metoprolol Tartrate (25 mg Oral)",
        "drug_class": "Selective Beta-1 Blocker",
        "dose_mg": 25.0,
        "bioavailability": 0.50,
        "ka": 1.15,        # Absorption rate constant (1/hr)
        "ke_base": 0.20,   # Elimination rate constant (1/hr)
        "vd_per_kg": 4.2,  # Volume of distribution (L/kg)
        "ec50": 35.0,      # Concentration for 50% max effect (ng/mL)
        "emax_hr": 24.0,   # Max HR reduction (bpm)
        "emax_hrv": 19.0,  # Max HRV restoration (ms)
        "hill_n": 1.15
    },
    "METOPROLOL_50": {
        "id": "METOPROLOL_50",
        "name": "Metoprolol Tartrate (50 mg High-Dose)",
        "drug_class": "Selective Beta-1 Blocker",
        "dose_mg": 50.0,
        "bioavailability": 0.50,
        "ka": 1.15,
        "ke_base": 0.20,
        "vd_per_kg": 4.2,
        "ec50": 35.0,
        "emax_hr": 38.0,
        "emax_hrv": 27.0,
        "hill_n": 1.20
    },
    "IVABRADINE_5": {
        "id": "IVABRADINE_5",
        "name": "Ivabradine (5 mg Oral)",
        "drug_class": "If Funny-Channel Inhibitor (Sinus Node)",
        "dose_mg": 5.0,
        "bioavailability": 0.40,
        "ka": 1.40,
        "ke_base": 0.32,
        "vd_per_kg": 1.8,
        "ec50": 11.0,
        "emax_hr": 18.0,
        "emax_hrv": 14.0,
        "hill_n": 1.05
    },
    "AMIODARONE_200": {
        "id": "AMIODARONE_200",
        "name": "Amiodarone HCl (200 mg Loading)",
        "drug_class": "Class III Antiarrhythmic (Potassium Blocker)",
        "dose_mg": 200.0,
        "bioavailability": 0.65,
        "ka": 0.48,
        "ke_base": 0.08,
        "vd_per_kg": 8.5,
        "ec50": 95.0,
        "emax_hr": 21.0,
        "emax_hrv": 29.0,
        "hill_n": 1.35
    }
}


def evaluate_digital_twin_state(patient_id: str, hour_offset: int):
    patient_row = df_ehr[df_ehr["patient_id"] == patient_id]
    if patient_row.empty:
        return {"error": f"Patient {patient_id} not found"}
    
    p_data = patient_row.iloc[0]
    
    X_input = pd.DataFrame([p_data[FEATURES]])
    baseline_prob = float(model.predict_proba(X_input)[0, 1])

    stream_row = df_stream[(df_stream["patient_id"] == patient_id) & (df_stream["hour_offset"] == hour_offset)]
    if stream_row.empty:
        hr, hrv, spo2 = 72.0, 60.0, 98.0
    else:
        s_data = stream_row.iloc[0]
        hr = float(s_data["heart_rate_bpm"])
        hrv = float(s_data["hrv_ms"])
        spo2 = float(s_data["spo2_pct"])

    hrv_penalty = max(0.0, (50.0 - hrv) / 50.0) if hrv < 50 else 0.0
    spo2_penalty = max(0.0, (95.0 - spo2) / 10.0) if spo2 < 95 else 0.0
    hr_penalty = max(0.0, (hr - 85.0) / 50.0) if hr > 85 else 0.0

    ehr_comp = baseline_prob * 0.45
    hrv_comp = hrv_penalty * 0.30
    spo2_comp = spo2_penalty * 0.15
    hr_comp = hr_penalty * 0.10

    raw_total = ehr_comp + hrv_comp + spo2_comp + hr_comp
    fused_risk_score = min(1.0, raw_total)

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

    escalation_event = None
    if fused_risk_score > 0.65 or hrv < 30 or spo2 < 92:
        status = "RED"
        recommendation = "CRITICAL: High probability of acute cardiac arrhythmia within 12-24 hrs. Run In-Silico PK/PD Drug Trial below before prescribing."
        p4_patient_message = "Your VitalTwin noticed your heart stress levels are unusually high right now. Please sit down, rest, and take 5 slow breaths. We have automatically alerted Dr. Sharma's care team to check in on you."
        p4_action_items = [
            "Stop physical exertion immediately and sit upright",
            "Take 5 slow, deep breaths (4s inhale, 6s exhale)",
            "Keep your phone nearby — Clinic Care Team has been notified"
        ]
        
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
        recommendation = "WARNING: Prodromal autonomic stress detected. Consider low-dose prophylactic intervention via In-Silico Twin."
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


def simulate_in_silico_interventions(patient_id: str, hour_offset: int, horizon_hours: int = 12):
    """
    TRUE DIGITAL TWIN ENGINE:
    Runs parallel 12-hour Mechanistic PK/PD differential equation simulations across candidate drugs
    to forecast counterfactual physiological trajectories (Untreated vs. Treated Shadow Twins).
    """
    state = evaluate_digital_twin_state(patient_id, hour_offset)
    if "error" in state:
        return state

    age = state["age"]
    bmi = state["ehr_summary"]["bmi"]
    baseline_prob = state["baseline_ehr_risk"] / 100.0
    hr_0 = state["telemetry"]["heart_rate_bpm"]
    hrv_0 = state["telemetry"]["hrv_ms"]
    spo2_0 = state["telemetry"]["spo2_pct"]

    # Estimate patient body weight from BMI (assuming 1.70m avg height) for Volume of Distribution
    estimated_weight_kg = round(bmi * (1.70 ** 2), 1)
    # Age-adjusted renal/hepatic clearance factor (older patients clear drugs slower)
    renal_clearance_factor = max(0.55, 1.0 - max(0, age - 40) * 0.008)

    # 1. Generate UNTREATED Trajectory (Natural Pathological Progression)
    untreated_trajectory = []
    is_degrading = state["clinical_status"] in ["RED", "YELLOW"]

    for t in range(0, horizon_hours + 1):
        if is_degrading:
            # Continued sympathetic storm if left untreated
            u_hr = min(142.0, hr_0 + (1.65 * t))
            u_hrv = max(14.0, hrv_0 - (1.15 * t))
            u_spo2 = max(89.0, spo2_0 - (0.18 * t))
        else:
            u_hr = hr_0 + math.sin(t * 0.5) * 1.5
            u_hrv = hrv_0 + math.cos(t * 0.5) * 1.5
            u_spo2 = spo2_0

        hrv_pen = max(0.0, (50.0 - u_hrv) / 50.0) if u_hrv < 50 else 0.0
        spo2_pen = max(0.0, (95.0 - u_spo2) / 10.0) if u_spo2 < 95 else 0.0
        hr_pen = max(0.0, (u_hr - 85.0) / 50.0) if u_hr > 85 else 0.0
        u_risk = min(100.0, (baseline_prob * 0.45 + hrv_pen * 0.30 + spo2_pen * 0.15 + hr_pen * 0.10) * 100.0)

        untreated_trajectory.append({
            "hour_ahead": t,
            "hr_bpm": round(u_hr, 1),
            "hrv_ms": round(u_hrv, 1),
            "spo2_pct": round(u_spo2, 1),
            "risk_pct": round(u_risk, 1)
        })

    # 2. Simulate Each Candidate Drug via Bateman PK + Hill PD Equations
    simulations = {}
    ranking = []

    for drug_id, drug in DRUG_CATALOG.items():
        ke = drug["ke_base"] * renal_clearance_factor
        ka = drug["ka"]
        vd_liters = drug["vd_per_kg"] * estimated_weight_kg

        # Convert mg dose to ng/mL plasma concentration scale
        dose_ng = drug["dose_mg"] * 1_000_000.0
        vd_ml = vd_liters * 1000.0

        drug_timeline = []
        min_hr_observed = 999.0

        for t in range(0, horizon_hours + 1):
            if t == 0:
                cp = 0.0
            else:
                # 1-Compartment Oral Bateman PK Function
                cp = (drug["bioavailability"] * dose_ng * ka) / (vd_ml * (ka - ke)) * (
                    math.exp(-ke * t) - math.exp(-ka * t)
                )

            # Hill Equation for Pharmacodynamic Organ Effect
            n = drug["hill_n"]
            hill_ratio = (cp ** n) / ((drug["ec50"] ** n) + (cp ** n)) if cp > 0 else 0.0

            delta_hr = drug["emax_hr"] * hill_ratio
            delta_hrv = drug["emax_hrv"] * hill_ratio

            # Apply drug effect against the untreated baseline at hour t
            base_pt = untreated_trajectory[t]
            sim_hr = max(46.0, base_pt["hr_bpm"] - delta_hr)
            sim_hrv = min(92.0, base_pt["hrv_ms"] + delta_hrv)
            sim_spo2 = min(99.0, base_pt["spo2_pct"] + (1.4 * hill_ratio))

            min_hr_observed = min(min_hr_observed, sim_hr)

            hrv_pen = max(0.0, (50.0 - sim_hrv) / 50.0) if sim_hrv < 50 else 0.0
            spo2_pen = max(0.0, (95.0 - sim_spo2) / 10.0) if sim_spo2 < 95 else 0.0
            hr_pen = max(0.0, (sim_hr - 85.0) / 50.0) if sim_hr > 85 else 0.0
            sim_risk = min(100.0, (baseline_prob * 0.45 + hrv_pen * 0.30 + spo2_pen * 0.15 + hr_pen * 0.10) * 100.0)

            drug_timeline.append({
                "hour_ahead": t,
                "plasma_conc_ng_ml": round(cp, 2),
                "hr_bpm": round(sim_hr, 1),
                "hrv_ms": round(sim_hrv, 1),
                "spo2_pct": round(sim_spo2, 1),
                "risk_pct": round(sim_risk, 1)
            })

        final_risk = drug_timeline[-1]["risk_pct"]
        untreated_final_risk = untreated_trajectory[-1]["risk_pct"]
        risk_reduction = round(untreated_final_risk - final_risk, 1)

        # Safety Check: Flag Bradycardia Toxicity if simulated HR drops below 55 bpm
        bradycardia_warning = min_hr_observed < 55.0
        safety_status = "CAUTION: Bradycardia Risk (<55 bpm)" if bradycardia_warning else "SAFE: Optimal Therapeutic Window"

        # Utility score balances risk reduction against toxicity penalty
        utility_score = risk_reduction - (25.0 if bradycardia_warning else 0.0)

        summary_obj = {
            "drug_id": drug_id,
            "name": drug["name"],
            "drug_class": drug["drug_class"],
            "final_12h_risk_pct": final_risk,
            "absolute_risk_reduction_pct": risk_reduction,
            "min_simulated_hr_bpm": round(min_hr_observed, 1),
            "safety_status": safety_status,
            "bradycardia_warning": bradycardia_warning,
            "utility_score": round(utility_score, 1),
            "trajectory": drug_timeline
        }
        simulations[drug_id] = summary_obj
        ranking.append(summary_obj)

    ranking.sort(key=lambda x: x["utility_score"], reverse=True)
    optimal_choice = ranking[0]

    return {
        "patient_id": patient_id,
        "patient_name": state["name"],
        "hour_offset": hour_offset,
        "patient_pk_parameters": {
            "estimated_weight_kg": estimated_weight_kg,
            "renal_clearance_factor": round(renal_clearance_factor, 2),
            "baseline_hr_bpm": hr_0,
            "baseline_hrv_ms": hrv_0
        },
        "optimal_recommendation": {
            "drug_id": optimal_choice["drug_id"],
            "drug_name": optimal_choice["name"],
            "rationale": f"Reduces 12-hour cardiac risk by {optimal_choice['absolute_risk_reduction_pct']}% (down to {optimal_choice['final_12h_risk_pct']}%) with {optimal_choice['safety_status']}."
        },
        "untreated_trajectory": untreated_trajectory,
        "ranked_interventions": ranking
    }


def generate_fhir_r4_bundle(patient_id: str, hour_offset: int):
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