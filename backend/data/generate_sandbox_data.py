import os
import numpy as np
import pandas as pd

np.random.seed(42)

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
EHR_FILE = os.path.join(BASE_DIR, "synthetic_ehr.csv")
STREAM_FILE = os.path.join(BASE_DIR, "wearable_stream.csv")

def generate_ehr_data(n_patients=500):
    rows = []
    for i in range(1, n_patients + 1):
        pid = f"PAT_{i:03d}"
        age = np.random.randint(25, 75)
        gender = np.random.choice(["M", "F"])
        bmi = round(np.random.uniform(19.0, 35.0), 1)
        sys_bp = np.random.randint(105, 175)
        dia_bp = np.random.randint(65, 110)
        chol = np.random.randint(150, 290)
        htn = 1 if sys_bp > 140 or np.random.rand() < 0.25 else 0
        diab = 1 if bmi > 29 or np.random.rand() < 0.20 else 0
        smoker = 1 if np.random.rand() < 0.22 else 0

        risk_score = (
                (age > 55) * 2
                + (bmi > 28) * 1
                + (sys_bp > 145) * 2
                + (chol > 230) * 1
                + htn * 2
                + diab * 2
                + smoker * 1
        )
        high_risk = 1 if risk_score >= 5 else 0

        rows.append({
            "patient_id": pid,
            "name": f"Synthetic Patient {i}",
            "age": age,
            "gender": gender,
            "bmi": bmi,
            "systolic_bp": sys_bp,
            "diastolic_bp": dia_bp,
            "cholesterol_mg_dl": chol,
            "hypertension_history": htn,
            "diabetes_history": diab,
            "smoker": smoker,
            "high_baseline_risk": high_risk
        })

    df = pd.DataFrame(rows)

    # Archetype 1: PAT_001 - Rajesh Sharma (61M, Severe Autonomic HRV Collapse)
    df.loc[df["patient_id"] == "PAT_001", [
        "name", "age", "gender", "bmi", "systolic_bp", "diastolic_bp",
        "cholesterol_mg_dl", "hypertension_history", "diabetes_history", "smoker", "high_baseline_risk"
    ]] = ["Rajesh Sharma", 61, "M", 29.4, 158, 96, 248, 1, 1, 0, 1]

    # Archetype 2: PAT_002 - Ananya Deshmukh (34F, Healthy Control)
    df.loc[df["patient_id"] == "PAT_002", [
        "name", "age", "gender", "bmi", "systolic_bp", "diastolic_bp",
        "cholesterol_mg_dl", "hypertension_history", "diabetes_history", "smoker", "high_baseline_risk"
    ]] = ["Ananya Deshmukh", 34, "F", 21.8, 114, 74, 168, 0, 0, 0, 0]

    # Archetype 3: PAT_003 - Sunita Mehta (58F, Post-MI Recovery with Nocturnal SpO2 Desaturation)
    df.loc[df["patient_id"] == "PAT_003", [
        "name", "age", "gender", "bmi", "systolic_bp", "diastolic_bp",
        "cholesterol_mg_dl", "hypertension_history", "diabetes_history", "smoker", "high_baseline_risk"
    ]] = ["Sunita Mehta", 58, "F", 27.6, 146, 90, 232, 1, 0, 0, 1]

    # Archetype 4: PAT_004 - Vikram Malhotra (42M, Corporate Executive Sympathetic Tachycardia)
    df.loc[df["patient_id"] == "PAT_004", [
        "name", "age", "gender", "bmi", "systolic_bp", "diastolic_bp",
        "cholesterol_mg_dl", "hypertension_history", "diabetes_history", "smoker", "high_baseline_risk"
    ]] = ["Vikram Malhotra", 42, "M", 25.2, 134, 86, 205, 0, 0, 1, 0]

    df.to_csv(EHR_FILE, index=False)
    print(f"Generated {len(df)} EHR records -> {EHR_FILE}")


def generate_wearable_stream():
    records = []
    # 1. PAT_001: Rajesh Sharma (Progressive Autonomic Collapse after Hour 28)
    for h in range(48):
        if h < 28:
            hr = round(74 + np.random.normal(0, 2.2), 1)
            hrv = round(52 + np.random.normal(0, 2.5), 1)
            spo2 = round(97.2 + np.random.normal(0, 0.4), 1)
        else:
            progress = (h - 27) / 20.0
            hr = round(76 + progress * 34 + np.random.normal(0, 1.5), 1)
            hrv = round(50 - progress * 26 + np.random.normal(0, 1.2), 1)
            spo2 = round(97.0 - progress * 4.2 + np.random.normal(0, 0.3), 1)
        records.append({
            "patient_id": "PAT_001",
            "hour_offset": h,
            "heart_rate_bpm": max(55.0, hr),
            "hrv_ms": max(18.0, hrv),
            "spo2_pct": min(100.0, max(88.0, spo2)),
            "step_count": int(np.random.randint(20, 450))
        })

    # 2. PAT_002: Ananya Deshmukh (Healthy Stable Baseline)
    for h in range(48):
        records.append({
            "patient_id": "PAT_002",
            "hour_offset": h,
            "heart_rate_bpm": round(66 + np.random.normal(0, 2.0), 1),
            "hrv_ms": round(68 + np.random.normal(0, 3.0), 1),
            "spo2_pct": round(98.5 + np.random.normal(0, 0.3), 1),
            "step_count": int(np.random.randint(100, 900))
        })

    # 3. PAT_003: Sunita Mehta (Nocturnal Hypoxic Drift & Post-MI Instability Hours 30-45)
    for h in range(48):
        if 30 <= h <= 45:
            depth = (h - 29) / 16.0
            hr = round(80 + depth * 18 + np.random.normal(0, 1.5), 1)
            hrv = round(46 - depth * 16 + np.random.normal(0, 1.2), 1)
            spo2 = round(95.5 - depth * 5.2 + np.random.normal(0, 0.3), 1)
        else:
            hr = round(76 + np.random.normal(0, 2.0), 1)
            hrv = round(48 + np.random.normal(0, 2.0), 1)
            spo2 = round(96.4 + np.random.normal(0, 0.4), 1)
        records.append({
            "patient_id": "PAT_003",
            "hour_offset": h,
            "heart_rate_bpm": hr,
            "hrv_ms": hrv,
            "spo2_pct": min(100.0, max(88.5, spo2)),
            "step_count": int(np.random.randint(10, 300))
        })

    # 4. PAT_004: Vikram Malhotra (Acute Sympathetic Tachycardia Spike Hours 18-38)
    for h in range(48):
        if 18 <= h <= 38:
            spike = np.sin(((h - 18) / 20.0) * np.pi)
            hr = round(78 + spike * 36 + np.random.normal(0, 1.8), 1)
            hrv = round(54 - spike * 23 + np.random.normal(0, 1.5), 1)
            spo2 = round(97.4 - spike * 1.2 + np.random.normal(0, 0.3), 1)
        else:
            hr = round(74 + np.random.normal(0, 2.0), 1)
            hrv = round(55 + np.random.normal(0, 2.2), 1)
            spo2 = round(97.8 + np.random.normal(0, 0.3), 1)
        records.append({
            "patient_id": "PAT_004",
            "hour_offset": h,
            "heart_rate_bpm": hr,
            "hrv_ms": hrv,
            "spo2_pct": min(100.0, spo2),
            "step_count": int(np.random.randint(50, 750))
        })

    df_stream = pd.DataFrame(records)
    df_stream.to_csv(STREAM_FILE, index=False)
    print(f"Generated {len(df_stream)} wearable stream rows -> {STREAM_FILE}")


if __name__ == "__main__":
    generate_ehr_data()
    generate_wearable_stream()