"use client";

import { useState, useEffect } from "react";
import {
  Activity,
  AlertTriangle,
  ShieldCheck,
  User,
  Heart,
  Zap,
  Clock,
  Cpu,
  FileJson,
  BellRing,
  Smartphone,
  Stethoscope,
  CheckCircle2,
  FlaskConical,
  Sparkles,
  X
} from "lucide-react";

interface XAIFactor {
  factor: string;
  contribution_pct: number;
  clinical_detail: string;
}

interface EscalationEvent {
  event_id: string;
  timestamp: string;
  patient_id: string;
  patient_name: string;
  hour_offset: number;
  risk_score: number;
  dispatched_to: string;
  channel: string;
  message: string;
}

interface TwinState {
  patient_id: string;
  name: string;
  age: number;
  gender: string;
  ehr_summary: {
    bmi: number;
    bp: string;
    cholesterol: number;
    hypertension: boolean;
    diabetes: boolean;
  };
  hour_offset: number;
  telemetry: {
    heart_rate_bpm: number;
    hrv_ms: number;
    spo2_pct: number;
  };
  baseline_ehr_risk: number;
  fused_risk_score: number;
  clinical_status: "GREEN" | "YELLOW" | "RED";
  recommendation: string;
  xai_breakdown: XAIFactor[];
  p4_companion: {
    friendly_message: string;
    action_checklist: string[];
  };
  escalation_triggered: EscalationEvent | null;
}

interface TrajectoryPoint {
  hour_ahead: number;
  plasma_conc_ng_ml?: number;
  hr_bpm: number;
  hrv_ms: number;
  spo2_pct: number;
  risk_pct: number;
}

interface DrugSimulation {
  drug_id: string;
  name: string;
  drug_class: string;
  final_12h_risk_pct: number;
  absolute_risk_reduction_pct: number;
  min_simulated_hr_bpm: number;
  safety_status: string;
  bradycardia_warning: boolean;
  utility_score: number;
  trajectory: TrajectoryPoint[];
}

interface InSilicoResponse {
  patient_id: string;
  patient_name: string;
  hour_offset: number;
  patient_pk_parameters: {
    estimated_weight_kg: number;
    renal_clearance_factor: number;
    baseline_hr_bpm: number;
    baseline_hrv_ms: number;
  };
  optimal_recommendation: {
    drug_id: string;
    drug_name: string;
    rationale: string;
  };
  untreated_trajectory: TrajectoryPoint[];
  ranked_interventions: DrugSimulation[];
}

export default function VitalTwinsDashboard() {
  const [selectedPatient, setSelectedPatient] = useState("PAT_001");
  const [hour, setHour] = useState(47);
  const [twinData, setTwinData] = useState<TwinState | null>(null);
  const [simData, setSimData] = useState<InSilicoResponse | null>(null);
  const [selectedDrugId, setSelectedDrugId] = useState<string>("AMIODARONE_200");
  const [viewMode, setViewMode] = useState<"DOCTOR" | "PATIENT">("DOCTOR");
  const [isSimulating, setIsSimulating] = useState(false);
  const [showFhirModal, setShowFhirModal] = useState(false);
  const [fhirJson, setFhirJson] = useState<Record<string, unknown> | null>(null);

  const fetchTwinAndSim = async (pid: string, h: number) => {
    try {
      const [twinRes, simRes] = await Promise.all([
        fetch(`http://127.0.0.1:8000/api/twin/${pid}/${h}`),
        fetch(`http://127.0.0.1:8000/api/simulate/${pid}/${h}`)
      ]);
      const tJson = await twinRes.json();
      const sJson: InSilicoResponse = await simRes.json();
      setTwinData(tJson);
      setSimData(sJson);
      if (sJson?.optimal_recommendation?.drug_id) {
        setSelectedDrugId(sJson.optimal_recommendation.drug_id);
      }
    } catch (err) {
      console.error("Failed to connect to VitalTwins backend:", err);
    }
  };

  const fetchFhirBundle = async () => {
    try {
      const res = await fetch(`http://127.0.0.1:8000/api/fhir/${selectedPatient}/${hour}`);
      const data = await res.json();
      setFhirJson(data);
      setShowFhirModal(true);
    } catch (err) {
      console.error("Failed to fetch FHIR bundle:", err);
    }
  };

  useEffect(() => {
    fetchTwinAndSim(selectedPatient, hour);
  }, [selectedPatient, hour]);

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isSimulating) {
      interval = setInterval(() => {
        setHour((prev) => (prev >= 47 ? 0 : prev + 1));
      }, 900);
    }
    return () => clearInterval(interval);
  }, [isSimulating]);

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100 p-6 font-sans">
      {/* Header */}
      <header className="flex flex-wrap justify-between items-center border-b border-slate-800 pb-4 mb-6 gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-cyan-400 flex items-center gap-2">
            <Activity className="h-7 w-7 text-cyan-400 animate-pulse" />
            VitalTwins | Mechanistic PK/PD Digital Twin
          </h1>
          <p className="text-xs text-slate-400 mt-0.5">
            In-Silico Drug Trials • XAI Attribution • HL7 FHIR R4 • Automated Escalation • P4 Medicine
          </p>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          <div className="bg-slate-900 border border-slate-800 p-1 rounded-lg flex items-center">
            <button
              onClick={() => setViewMode("DOCTOR")}
              className={`px-3 py-1.5 rounded-md text-xs font-semibold flex items-center gap-1.5 transition-all ${
                viewMode === "DOCTOR"
                  ? "bg-cyan-600 text-white"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              <Stethoscope className="h-3.5 w-3.5" />
              Doctor Command Center
            </button>
            <button
              onClick={() => setViewMode("PATIENT")}
              className={`px-3 py-1.5 rounded-md text-xs font-semibold flex items-center gap-1.5 transition-all ${
                viewMode === "PATIENT"
                  ? "bg-emerald-600 text-white"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              <Smartphone className="h-3.5 w-3.5" />
              P4 Patient Companion
            </button>
          </div>

          <button
            onClick={fetchFhirBundle}
            className="px-3.5 py-2 rounded-lg font-medium text-xs bg-slate-800 hover:bg-slate-700 border border-slate-700 text-cyan-300 flex items-center gap-1.5 transition-all"
          >
            <FileJson className="h-4 w-4" />
            Export HL7 FHIR R4
          </button>

          <button
            onClick={() => setIsSimulating(!isSimulating)}
            className={`px-4 py-2 rounded-lg font-medium text-xs transition-all flex items-center gap-1.5 ${
              isSimulating
                ? "bg-amber-600 hover:bg-amber-500 text-white"
                : "bg-cyan-600 hover:bg-cyan-500 text-white"
            }`}
          >
            <Zap className="h-4 w-4" />
            {isSimulating ? "Pause Live Stream" : "Simulate 48h Stream"}
          </button>
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Left Sidebar */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex flex-col gap-4">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
            Sandbox Patient Cohort
          </h2>
          <div className="flex flex-col gap-2">
            <button
              onClick={() => {
                setSelectedPatient("PAT_001");
                setHour(47);
              }}
              className={`p-3 rounded-lg text-left transition-all border ${
                selectedPatient === "PAT_001"
                  ? "bg-cyan-950/50 border-cyan-500 text-cyan-200"
                  : "bg-slate-800/50 border-transparent text-slate-300 hover:bg-slate-800"
              }`}
            >
              <div className="font-semibold text-sm">Rajesh Sharma (PAT_001)</div>
              <div className="text-xs text-red-400 mt-1">61M • Hypertension & Diabetes</div>
            </button>

            <button
              onClick={() => {
                setSelectedPatient("PAT_002");
                setHour(12);
              }}
              className={`p-3 rounded-lg text-left transition-all border ${
                selectedPatient === "PAT_002"
                  ? "bg-cyan-950/50 border-cyan-500 text-cyan-200"
                  : "bg-slate-800/50 border-transparent text-slate-300 hover:bg-slate-800"
              }`}
            >
              <div className="font-semibold text-sm">Ananya Deshmukh (PAT_002)</div>
              <div className="text-xs text-emerald-400 mt-1">34F • Healthy Control Profile</div>
            </button>
          </div>

          {twinData && simData && (
            <div className="bg-slate-950 border border-slate-800 rounded-lg p-3 mt-1 text-xs space-y-1.5">
              <div className="font-semibold text-slate-400 uppercase">Patient Twin Parameters</div>
              <div className="flex justify-between">
                <span className="text-slate-500">Baseline BP:</span>
                <span className="font-mono">{twinData.ehr_summary.bp} mmHg</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Cholesterol:</span>
                <span className="font-mono">{twinData.ehr_summary.cholesterol} mg/dL</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Est. Weight (Vd):</span>
                <span className="font-mono">{simData.patient_pk_parameters.estimated_weight_kg} kg</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Renal Clearance:</span>
                <span className="font-mono text-amber-300">
                  {simData.patient_pk_parameters.renal_clearance_factor}x
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">XGBoost EHR Risk:</span>
                <span className="font-mono text-cyan-400">{twinData.baseline_ehr_risk}%</span>
              </div>
            </div>
          )}

          <div className="mt-auto border-t border-slate-800 pt-4 flex flex-col gap-2">
            <div className="flex justify-between items-center text-xs">
              <span className="text-slate-400 flex items-center gap-1">
                <Clock className="h-3.5 w-3.5 text-cyan-400" /> Stream Hour
              </span>
              <span className="font-mono font-bold text-cyan-300">+{hour}h / 47h</span>
            </div>
            <input
              type="range"
              min="0"
              max="47"
              value={hour}
              onChange={(e) => {
                setIsSimulating(false);
                setHour(parseInt(e.target.value));
              }}
              className="w-full accent-cyan-500 cursor-pointer"
            />
          </div>
        </div>

        {/* Right Area */}
        <div className="lg:col-span-3">
          {!twinData ? (
            <div className="flex items-center justify-center h-96 text-slate-400">
              Connecting to VitalTwins Engine...
            </div>
          ) : viewMode === "DOCTOR" ? (
            renderDoctorView(twinData)
          ) : (
            renderPatientCompanionView(twinData)
          )}
        </div>
      </div>

      {/* FHIR R4 Modal */}
      {showFhirModal && (
        <div className="fixed inset-0 bg-black/75 flex items-center justify-center p-4 z-50">
          <div className="bg-slate-900 border border-slate-700 rounded-xl max-w-3xl w-full max-h-[80vh] flex flex-col">
            <div className="flex justify-between items-center p-4 border-b border-slate-800">
              <div className="flex items-center gap-2 text-cyan-400 font-bold text-sm">
                <FileJson className="h-5 w-5" />
                HL7 FHIR R4 Interoperability Payload (Patient + Observation + RiskAssessment)
              </div>
              <button
                onClick={() => setShowFhirModal(false)}
                className="text-slate-400 hover:text-white"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <pre className="p-4 text-xs font-mono text-emerald-300 overflow-y-auto bg-slate-950 flex-1">
              {JSON.stringify(fhirJson, null, 2)}
            </pre>
          </div>
        </div>
      )}
    </main>
  );

  function renderDoctorView(data: TwinState) {
    const isRed = data.clinical_status === "RED";
    const isYellow = data.clinical_status === "YELLOW";
    const activeDrug =
      simData?.ranked_interventions.find((d) => d.drug_id === selectedDrugId) ||
      simData?.ranked_interventions[0];

    return (
      <div className="flex flex-col gap-5">
        {/* Patient Banner */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex flex-wrap justify-between items-center gap-4">
          <div className="flex items-center gap-3.5">
            <div className="bg-slate-800 p-2.5 rounded-xl border border-slate-700">
              <User className="h-6 w-6 text-cyan-400" />
            </div>
            <div>
              <h2 className="text-lg font-bold">{data.name}</h2>
              <p className="text-xs text-slate-400">
                ID: {data.patient_id} • {data.gender}, {data.age} yrs • Telemetry Offset: +{data.hour_offset}h
              </p>
            </div>
          </div>

          <div
            className={`px-4 py-2 rounded-xl flex items-center gap-2.5 border ${
              isRed
                ? "bg-red-950/60 border-red-500/50 text-red-200"
                : isYellow
                ? "bg-amber-950/60 border-amber-500/50 text-amber-200"
                : "bg-emerald-950/60 border-emerald-500/50 text-emerald-200"
            }`}
          >
            {isRed ? (
              <AlertTriangle className="h-5 w-5 text-red-400 animate-bounce" />
            ) : isYellow ? (
              <AlertTriangle className="h-5 w-5 text-amber-400" />
            ) : (
              <ShieldCheck className="h-5 w-5 text-emerald-400" />
            )}
            <div>
              <div className="text-[10px] uppercase font-semibold tracking-wider">Disposition Flag</div>
              <div className="font-bold text-xs">{data.clinical_status} STATUS</div>
            </div>
          </div>
        </div>

        {/* Vitals Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
            <div className="text-xs text-slate-400 flex items-center gap-1.5 mb-1">
              <Heart className="h-4 w-4 text-rose-400" /> Resting Heart Rate (RHR)
            </div>
            <div className="text-2xl font-bold font-mono">
              {data.telemetry.heart_rate_bpm} <span className="text-xs font-normal text-slate-500">bpm</span>
            </div>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
            <div className="text-xs text-slate-400 flex items-center gap-1.5 mb-1">
              <Activity className="h-4 w-4 text-cyan-400" /> Heart Rate Variability (HRV)
            </div>
            <div className="text-2xl font-bold font-mono">
              {data.telemetry.hrv_ms} <span className="text-xs font-normal text-slate-500">ms</span>
            </div>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
            <div className="text-xs text-slate-400 flex items-center gap-1.5 mb-1">
              <Zap className="h-4 w-4 text-emerald-400" /> Blood Oxygen (SpO2)
            </div>
            <div className="text-2xl font-bold font-mono">
              {data.telemetry.spo2_pct} <span className="text-xs font-normal text-slate-500">%</span>
            </div>
          </div>
        </div>

        {/* TRUE DIGITAL TWIN: IN-SILICO PK/PD VIRTUAL THERAPEUTICS LAB */}
        {simData && activeDrug && (
          <div className="bg-slate-900 border-2 border-cyan-500/40 rounded-xl p-5 space-y-4">
            <div className="flex flex-wrap justify-between items-start gap-4 border-b border-slate-800 pb-3">
              <div>
                <h3 className="text-sm font-bold text-cyan-400 flex items-center gap-2">
                  <FlaskConical className="h-5 w-5 text-cyan-400" />
                  In-Silico PK/PD Shadow Twin Simulator (12-Hour Counterfactual Forecast)
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Tests virtual drug absorption (Bateman PK) & organ response (Hill PD) on this patient&apos;s digital replica before prescribing.
                </p>
              </div>
              <div className="bg-emerald-950/60 border border-emerald-500/40 px-3 py-1.5 rounded-lg text-xs">
                <div className="text-[10px] uppercase font-bold text-emerald-400 flex items-center gap-1">
                  <Sparkles className="h-3 w-3" /> Optimal Twin Regimen
                </div>
                <div className="font-semibold text-emerald-200">
                  {simData.optimal_recommendation.drug_name}
                </div>
              </div>
            </div>

            {/* Candidate Drug Selector Tabs */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
              {simData.ranked_interventions.map((d, idx) => {
                const isSelected = d.drug_id === activeDrug.drug_id;
                return (
                  <button
                    key={d.drug_id}
                    onClick={() => setSelectedDrugId(d.drug_id)}
                    className={`p-3 rounded-lg border text-left transition-all ${
                      isSelected
                        ? "bg-cyan-950/70 border-cyan-400 text-white"
                        : "bg-slate-950/60 border-slate-800 text-slate-300 hover:bg-slate-800/60"
                    }`}
                  >
                    <div className="flex justify-between items-center text-[10px] font-mono mb-1">
                      <span className={idx === 0 ? "text-emerald-400 font-bold" : "text-slate-400"}>
                        {idx === 0 ? "★ RANK #1 BEST" : `RANK #${idx + 1}`}
                      </span>
                      <span className="text-cyan-300 font-bold">-{d.absolute_risk_reduction_pct}% Risk</span>
                    </div>
                    <div className="text-xs font-bold truncate">{d.name}</div>
                    <div className="text-[10px] text-slate-400 truncate mt-0.5">{d.drug_class}</div>
                  </button>
                );
              })}
            </div>

            {/* Dual Counterfactual Trajectory Charts (SVG) */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 pt-1">
              {/* Chart 1: Heart Rate Counterfactual (Untreated Red vs Treated Cyan) */}
              <div className="lg:col-span-2 bg-slate-950 border border-slate-800 rounded-lg p-4">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-xs font-semibold text-slate-300">
                    12-Hour Heart Rate Trajectory: Untreated vs. Shadow Twin
                  </span>
                  <div className="flex items-center gap-3 text-[11px]">
                    <span className="flex items-center gap-1 text-rose-400">
                      <span className="w-2.5 h-0.5 bg-rose-500 inline-block" /> Untreated Crash
                    </span>
                    <span className="flex items-center gap-1 text-cyan-400">
                      <span className="w-2.5 h-0.5 bg-cyan-400 inline-block" /> Treated Twin
                    </span>
                  </div>
                </div>
                {renderCounterfactualChart(
                  simData.untreated_trajectory,
                  activeDrug.trajectory
                )}
              </div>

              {/* PK/PD Metrics & Plasma Curve Summary */}
              <div className="bg-slate-950 border border-slate-800 rounded-lg p-4 flex flex-col justify-between space-y-3">
                <div>
                  <div className="text-xs font-semibold text-slate-400 uppercase mb-2">
                    In-Silico Trial Verdict
                  </div>
                  <div className="space-y-2 text-xs">
                    <div className="flex justify-between">
                      <span className="text-slate-400">12h Untreated Risk:</span>
                      <span className="font-mono font-bold text-rose-400">
                        {simData.untreated_trajectory[12].risk_pct}%
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">12h Treated Risk:</span>
                      <span className="font-mono font-bold text-emerald-400">
                        {activeDrug.final_12h_risk_pct}%
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Min Simulated HR:</span>
                      <span className="font-mono font-bold text-cyan-300">
                        {activeDrug.min_simulated_hr_bpm} bpm
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Peak Plasma Conc:</span>
                      <span className="font-mono text-purple-300">
                        {Math.max(...activeDrug.trajectory.map((t) => t.plasma_conc_ng_ml || 0))} ng/mL
                      </span>
                    </div>
                  </div>
                </div>

                <div
                  className={`p-2.5 rounded-lg border text-xs ${
                    activeDrug.bradycardia_warning
                      ? "bg-amber-950/50 border-amber-500/50 text-amber-200"
                      : "bg-emerald-950/50 border-emerald-500/50 text-emerald-200"
                  }`}
                >
                  <div className="font-bold text-[11px] uppercase">{activeDrug.safety_status}</div>
                  <div className="text-[11px] mt-0.5 opacity-90">
                    {activeDrug.bradycardia_warning
                      ? "High dose causes excessive sinus node suppression (<55 bpm). Select lower dose."
                      : "Stabilizes autonomic HRV without inducing bradycardia."}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Fusion Risk + Explainable AI (XAI) */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 flex flex-col justify-between">
            <div>
              <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-3">
                Current Digital Twin Anomaly Probability
              </h3>
              <div className="flex items-center gap-4 my-2">
                <div className="text-4xl font-extrabold font-mono text-cyan-400">
                  {data.fused_risk_score}%
                </div>
                <div className="flex-1 bg-slate-800 h-3.5 rounded-full overflow-hidden">
                  <div
                    className={`h-full transition-all duration-300 ${
                      isRed ? "bg-red-500" : isYellow ? "bg-amber-500" : "bg-emerald-500"
                    }`}
                    style={{ width: `${data.fused_risk_score}%` }}
                  />
                </div>
              </div>
            </div>

            <div className="bg-slate-950 border border-slate-800 rounded-lg p-3.5 mt-4">
              <div className="text-[11px] font-semibold text-cyan-400 uppercase mb-1">
                Clinical Decision Handoff
              </div>
              <p className="text-xs text-slate-200 leading-relaxed">{data.recommendation}</p>
            </div>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-cyan-400 flex items-center gap-1.5 mb-3">
              <Cpu className="h-4 w-4" /> Explainable AI (XAI) Risk Attribution
            </h3>
            <div className="space-y-3">
              {data.xai_breakdown.map((item, idx) => (
                <div key={idx} className="space-y-1">
                  <div className="flex justify-between text-xs">
                    <span className="font-medium text-slate-200">{item.factor}</span>
                    <span className="font-mono font-semibold text-cyan-300">
                      {item.contribution_pct}%
                    </span>
                  </div>
                  <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
                    <div
                      className="bg-cyan-500 h-full transition-all duration-300"
                      style={{ width: `${item.contribution_pct}%` }}
                    />
                  </div>
                  <div className="text-[11px] text-slate-400">{item.clinical_detail}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Escalation Webhook Feed */}
        {data.escalation_triggered && (
          <div className="bg-red-950/40 border border-red-500/60 rounded-xl p-4 flex items-start gap-3.5">
            <BellRing className="h-6 w-6 text-red-400 shrink-0 mt-0.5 animate-ping" />
            <div className="text-xs space-y-1">
              <div className="font-bold text-red-200 uppercase tracking-wide">
                Automated Emergency Escalation Triggered ({data.escalation_triggered.event_id})
              </div>
              <div className="text-red-100">{data.escalation_triggered.message}</div>
              <div className="text-red-300/80 font-mono text-[11px]">
                Dispatched To: {data.escalation_triggered.dispatched_to} via{" "}
                {data.escalation_triggered.channel} at {data.escalation_triggered.timestamp}
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  function renderCounterfactualChart(
    untreated: TrajectoryPoint[],
    treated: TrajectoryPoint[]
  ) {
    const width = 520;
    const height = 160;
    const padX = 32;
    const padY = 18;
    const minHR = 45;
    const maxHR = 145;

    const mapX = (h: number) => padX + (h / 12) * (width - padX * 2);
    const mapY = (hr: number) =>
      height - padY - ((hr - minHR) / (maxHR - minHR)) * (height - padY * 2);

    const untreatedPoints = untreated
      .map((pt) => `${mapX(pt.hour_ahead)},${mapY(pt.hr_bpm)}`)
      .join(" ");
    const treatedPoints = treated
      .map((pt) => `${mapX(pt.hour_ahead)},${mapY(pt.hr_bpm)}`)
      .join(" ");

    return (
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-40 overflow-visible">
        {/* Safe Threshold Reference Lines */}
        <line
          x1={padX}
          y1={mapY(100)}
          x2={width - padX}
          y2={mapY(100)}
          stroke="#334155"
          strokeDasharray="4 4"
          strokeWidth="1"
        />
        <text x={4} y={mapY(100) + 3} className="fill-slate-500 text-[9px] font-mono">
          100
        </text>

        <line
          x1={padX}
          y1={mapY(60)}
          x2={width - padX}
          y2={mapY(60)}
          stroke="#334155"
          strokeDasharray="4 4"
          strokeWidth="1"
        />
        <text x={8} y={mapY(60) + 3} className="fill-slate-500 text-[9px] font-mono">
          60
        </text>

        {/* Untreated Crash Line (Red) */}
        <polyline
          fill="none"
          stroke="#f43f5e"
          strokeWidth="2.5"
          strokeDasharray="5 3"
          points={untreatedPoints}
        />

        {/* Treated Shadow Twin Line (Cyan) */}
        <polyline
          fill="none"
          stroke="#22d3ee"
          strokeWidth="3"
          points={treatedPoints}
        />

        {/* Data Nodes */}
        {treated.map((pt) => (
          <g key={pt.hour_ahead}>
            <circle
              cx={mapX(pt.hour_ahead)}
              cy={mapY(pt.hr_bpm)}
              r="3"
              className="fill-cyan-400"
            />
            {pt.hour_ahead % 3 === 0 && (
              <text
                x={mapX(pt.hour_ahead) - 8}
                y={height - 2}
                className="fill-slate-400 text-[9px] font-mono"
              >
                +{pt.hour_ahead}h
              </text>
            )}
          </g>
        ))}
      </svg>
    );
  }

  function renderPatientCompanionView(data: TwinState) {
    const isRed = data.clinical_status === "RED";
    const isYellow = data.clinical_status === "YELLOW";

    return (
      <div className="max-w-md mx-auto bg-slate-900 border-2 border-slate-800 rounded-3xl p-6 shadow-2xl flex flex-col gap-5">
        <div className="flex justify-between items-center border-b border-slate-800 pb-3">
          <div>
            <span className="text-[10px] uppercase tracking-wider font-bold text-emerald-400">
              P4 Participatory Companion
            </span>
            <h2 className="text-lg font-bold">Hi, {data.name.split(" ")[0]}</h2>
          </div>
          <div
            className={`px-3 py-1 rounded-full text-xs font-bold ${
              isRed
                ? "bg-red-500/20 text-red-300 border border-red-500/40"
                : isYellow
                ? "bg-amber-500/20 text-amber-300 border border-amber-500/40"
                : "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40"
            }`}
          >
            {isRed ? "Care Team Alerted" : isYellow ? "Take It Easy" : "All Good"}
          </div>
        </div>

        <div className="bg-slate-950 border border-slate-800 rounded-2xl p-4">
          <p className="text-sm text-slate-200 leading-relaxed">
            {data.p4_companion.friendly_message}
          </p>
        </div>

        <div className="grid grid-cols-2 gap-3 text-center">
          <div className="bg-slate-800/50 rounded-xl p-3">
            <div className="text-xs text-slate-400">Heart Rate</div>
            <div className="text-xl font-bold font-mono text-rose-400 mt-1">
              {data.telemetry.heart_rate_bpm} bpm
            </div>
          </div>
          <div className="bg-slate-800/50 rounded-xl p-3">
            <div className="text-xs text-slate-400">Oxygen Level</div>
            <div className="text-xl font-bold font-mono text-cyan-400 mt-1">
              {data.telemetry.spo2_pct}%
            </div>
          </div>
        </div>

        <div className="space-y-2">
          <div className="text-xs font-semibold uppercase tracking-wider text-slate-400">
            Recommended Next Steps Right Now
          </div>
          {data.p4_companion.action_checklist.map((step, i) => (
            <div
              key={i}
              className="flex items-center gap-2.5 bg-slate-800/40 border border-slate-800 rounded-xl p-3 text-xs text-slate-200"
            >
              <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
              <span>{step}</span>
            </div>
          ))}
        </div>
      </div>
    );
  }
}