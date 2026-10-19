# 🫀 VitalTwins: Predictive Cardiovascular Digital Twin Engine
**Happiest Health Digital Twin Challenge 2026 — Reimagining and Reforming Healthcare in India Summit, Bengaluru**

[![License: MIT](https://img.shields.io/badge/License-MIT-cyan.svg)](https://opensource.org/licenses/MIT)
[![FHIR Standard](https://img.shields.io/badge/HL7-FHIR%20R4%20Compliant-emerald.svg)](https://hl7.org/fhir/R4/)
[![Python](https://img.shields.io/badge/Backend-FastAPI%20%7C%20XGBoost-blue.svg)](https://fastapi.tiangolo.com/)
[![Next.js](https://img.shields.io/badge/Frontend-Next.js%20%7C%20Tailwind-black.svg)](https://nextjs.org/)

---

## 📋 1. Team Details & College/Incubator Information
* **Team Name:** Ctrl Win
* **Submission Folder / Repo Format:** `Ctrl Win_PCCOE`
* **Team Leader & Developer:** Parth Kulkarni (B.E. Computer Engineering)
* **Institution:** Pimpri Chinchwad College of Engineering (PCCOE), Pune, Maharashtra, India
* **Incubator / Academic Affiliation:** Department of Computer Engineering & Institution's Innovation Council (IIC), PCCOE Pune

---

## 🎯 2. Project Title
**VitalTwins:** A Multimodal Patient Digital Twin Engine with Explainable AI (XAI), HL7 FHIR R4 Interoperability, and P4 Participatory Care for Early Prediction of Acute Cardiovascular Anomalies.

---

## 🚨 3. Problem Statement
Cardiovascular disease (CVD) is the leading cause of mortality in India, increasingly affecting adults aged 25–65 due to silent progression of hypertension, diabetes, and autonomic stress. Current clinical care in India is fundamentally **reactive**:
1. **Fragmented Data Silos:** Static Electronic Health Records (EHRs—blood pressure history, lipid profiles, comorbidities) sit isolated in hospital databases, completely disconnected from continuous physiological signals captured by consumer wearables.
2. **Missed Prodromal Windows:** Subtle autonomic nervous system degradations—such as progressive drops in Heart Rate Variability (HRV), resting tachycardia spikes, and mild nocturnal $SpO_2$ desaturation—occur **12 to 48 hours before** an acute arrhythmic event (e.g., Atrial Fibrillation or Ventricular Tachycardia), but go unnoticed until emergency hospitalization is required.
3. **Black-Box AI Distrust:** Clinicians hesitate to adopt AI triage alerts when models fail to explain *which* underlying physiological factor triggered the alarm.

---

## 🏥 4. Healthcare Use Case
**VitalTwins** transitions cardiac care from reactive emergency management to proactive, predictive intervention by constructing a live virtual replica (Digital Twin) of high-risk cardiac patients:
* **Continuous Bilateral Synchronization:** Combines a patient's baseline clinical vulnerability (derived from static EHR parameters) with real-time hourly wearable telemetry ($RHR$, $HRV$, $SpO_2$, activity).
* **Early Prodromal Anomaly Detection:** Identifies impending cardiac instability 12–24 hours prior to symptom onset, dynamically shifting the patient's disposition flag across **GREEN (Stable)**, **YELLOW (Prodromal Stress Warning)**, and **RED (Critical Anomaly Predicted)**.
* **Explainable Clinical Decision Handoff (XAI):** Breaks down the exact percentage contribution of static EHR factors versus dynamic wearable stress markers for the reviewing cardiologist.
* **Automated Emergency Escalation Loop:** Automatically triggers a webhook dispatch to the on-call cardiologist and emergency contacts the moment a twin crosses the critical risk threshold.
* **P4 Participatory Patient Companion:** Translates dense clinical metrics into calm, actionable breathing and rest guidance for the patient on their mobile view without inducing panic.

---

## 🛠️ 5. Technical Stack
| Layer | Technologies Used | Purpose |
| :--- | :--- | :--- |
| **Frontend UI Dashboard** | Next.js (App Router), React, TypeScript, Tailwind CSS, Lucide Icons | Dual-mode UI (Doctor Command Center & P4 Patient Companion) with live telemetry scrubbing and FHIR JSON viewer |
| **Backend API & Twin Engine** | Python 3, FastAPI, Uvicorn, Pydantic | Low-latency REST API serving synchronized Digital Twin states, XAI attributions, and escalation audit logs |
| **AI / Machine Learning** | XGBoost (`xgboost`), Scikit-Learn (`scikit-learn`), Pandas, NumPy | Static EHR baseline risk probability modeling fused with dynamic time-series telemetry penalty functions |
| **Healthcare Interoperability** | HL7 FHIR R4 Standard (`Bundle`, `Patient`, `Observation`, `RiskAssessment`) | Standardized hospital EHR export using LOINC physiological coding (`8867-4`, `80404-7`, `59408-5`) |
| **Sandbox Data Generation** | Custom Synthetic Physiological & EHR Generator (DPDP Act & HIPAA Safe) | Generates 500 synthetic Indian patient EHR cohorts and 48-hour wearable degradation trajectories |

---

## 🧠 6. AI/ML Model & Digital Twin Fusion Framework

### 6.1 Multimodal Data Stream Architecture
To comply strictly with the **DPDP Act** and **HIPAA** sandbox guidelines, VitalTwins operates on two fully synthetic, physiologically grounded data streams:
1. **Stream 1 — Static / Historical EHR Data (`backend/data/synthetic_ehr.csv`):**
   * **Cohort Size:** 500 synthetic patients (`PAT_001` to `PAT_500`).
   * **Features:** `age`, `gender`, `bmi`, `systolic_bp`, `diastolic_bp`, `cholesterol_mg_dl`, `hypertension_history`, `diabetes_history`, `smoker`.
   * **Baseline Model:** An **XGBoost Classifier** (`max_depth=4`, `n_estimators=100`, `learning_rate=0.08`) trained to output the patient's baseline cardiovascular vulnerability probability $P_{\text{EHR}} \in [0, 1]$.
   * **Validation Metrics:** Achieves **94.00% Validation Accuracy** and **0.995 ROC-AUC** on the held-out synthetic test split.

2. **Stream 2 — Dynamic / Real-Time Wearable Telemetry (`backend/data/wearable_stream.csv`):**
   * **Time-Series Horizon:** 48-hour continuous hourly stream mimicking Apple Health / Google Fit / medical IoT smartwatches.
   * **Parameters:** Resting Heart Rate (`heart_rate_bpm`), Heart Rate Variability (`hrv_ms`), Blood Oxygen Saturation (`spo2_pct`), and `step_count`.
   * **Pathological Simulation (`PAT_001` - Rajesh Sharma, 61M):** Models a realistic autonomic nervous system collapse starting at Hour +28, where HRV progressively drops by >35% (from ~52 ms down to <26 ms) while RHR spikes above 105 bpm and $SpO_2$ drifts below 94%.

### 6.2 Mathematical Formulation of the Fusion Engine
At any given hour offset $t$, the Digital Twin state $S(t)$ fuses static clinical vulnerability with real-time physiological stress penalties:

$$R_{\text{fused}}(t) = \min\Big(1.0, \; w_1 P_{\text{EHR}} + w_2 \Phi_{\text{HRV}}(t) + w_3 \Phi_{\text{SpO2}}(t) + w_4 \Phi_{\text{HR}}(t)\Big)$$

Where:
* $w_1 = 0.45, \; w_2 = 0.30, \; w_3 = 0.15, \; w_4 = 0.10$ represent the clinical modality weights.
* $\Phi_{\text{HRV}}(t) = \max\left(0, \frac{50 - \text{HRV}(t)}{50}\right)$ captures vagal tone withdrawal when HRV drops below 50 ms.
* $\Phi_{\text{SpO2}}(t) = \max\left(0, \frac{95 - \text{SpO}_2(t)}{10}\right)$ captures mild hypoxic drift below 95%.
* $\Phi_{\text{HR}}(t) = \max\left(0, \frac{\text{HR}(t) - 85}{50}\right)$ captures resting sympathetic tachycardia above 85 bpm.

### 6.3 Explainable AI (XAI) Feature Attribution
For every prediction at hour $t$, the engine computes normalized local feature attributions $A_i(t)$ so clinicians can audit the exact driver of the risk score:

$$A_i(t) = \frac{w_i \cdot C_i(t)}{\sum_{k=1}^{4} w_k \cdot C_k(t)} \times 100\%$$

---

## 🏗️ 7. System Architecture Diagram

*📄 **Downloadable Files for Evaluators (PDF / PPTX):***
* **[Architecture Diagram (PDF)](./docs/VitalTwins_Architecture_Diagram.pdf)** *(Place PDF in `docs/` folder)*
* **[Architecture Diagram (PPTX)](./docs/VitalTwins_Architecture_Diagram.pptx)** *(Place PPTX in `docs/` folder)*

```mermaid
flowchart TD
    subgraph Stream1 ["1. Static Historical Stream (EHR)"]
        A[("Synthetic EHR Database\n(500 Patients: BP, BMI, Lipids, History)")]
        B["XGBoost Baseline Classifier\n(ROC-AUC: 0.995)"]
        A --> B
    end

    subgraph Stream2 ["2. Dynamic Real-Time Stream (Wearable IoT)"]
        C[("48-Hour Wearable Stream\n(Hourly RHR, HRV ms, SpO2 %, Steps)")]
        D["Temporal Stress Penalty Evaluator\n(Autonomic HRV Drop & Hypoxic Drift)"]
        C --> D
    end

    B -->|Static Vulnerability Probability| E{"VitalTwins Multimodal\nFusion Engine"}
    D -->|Real-Time Physiological Deltas| E

    E --> F["Explainable AI (XAI) Attribution\n(% Driver Breakdown)"]
    E --> G["Disposition Risk Classifier\n(GREEN / YELLOW / RED)"]
    E --> H["HL7 FHIR R4 Bundle Generator\n(Patient + LOINC Observation + RiskAssessment)"]

    G -->|Status == RED| I["Automated Emergency Escalation\n(On-Call Cardiologist Webhook & Audit Log)"]
    G --> J["Doctor Command Center UI\n(Next.js Clinical Dashboard)"]
    G --> K["P4 Participatory Companion UI\n(Patient-Facing Actionable Guidance)"]
    F --> J
    H --> J
    I --> J