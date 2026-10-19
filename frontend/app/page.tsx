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

export default function VitalTwinsDashboard() {
  const [selectedPatient, setSelectedPatient] = useState("PAT_001");
  const [hour, setHour] = useState(47);
  const [twinData, setTwinData] = useState<TwinState | null>(null);
  const [viewMode, setViewMode] = useState<"DOCTOR" | "PATIENT">("DOCTOR");
  const [isSimulating, setIsSimulating] = useState(false);
  const [showFhirModal, setShowFhirModal] = useState(false);
  const [fhirJson, setFhirJson] = useState<Record<string, unknown> | null>(null);

  const fetchTwinState = async (pid: string, h: number) => {
    try {
      const res = await fetch(`http://127.0.0.1:8000/api/twin/${pid}/${h}`);
      const data = await res.json();
      setTwinData(data);
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
    fetchTwinState(selectedPatient, hour);
  }, [selectedPatient, hour]);

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isSimulating) {
      interval = setInterval(() => {
        setHour((prev) => (prev >= 47 ? 0 : prev + 1));
      }, 800);
    }
    return () => clearInterval(interval);
  }, [isSimulating]);

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100 p-6 font-sans">
      {/* Top Navigation & Innovation Toggles */}
      <header className="flex flex-wrap justify-between items-center border-b border-slate-800 pb-4 mb-6 gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-cyan-400 flex items-center gap-2">
            <Activity className="h-7 w-7 text-cyan-400 animate-pulse" />
            VitalTwins | Predictive Cardiovascular Twin
          </h1>
          <p className="text-xs text-slate-400 mt-0.5">
            XAI Feature Attribution • HL7 FHIR R4 Interoperable • Automated Escalation • P4 Medicine
          </p>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          {/* P4 Medicine View Switcher */}
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

          {/* HL7 FHIR Export Button */}
          <button
            onClick={fetchFhirBundle}
            className="px-3.5 py-2 rounded-lg font-medium text-xs bg-slate-800 hover:bg-slate-700 border border-slate-700 text-cyan-300 flex items-center gap-1.5 transition-all"
          >
            <FileJson className="h-4 w-4" />
            Export HL7 FHIR R4
          </button>

          {/* Live Stream Button */}
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
        {/* Left Cohort Sidebar */}
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

          {twinData && (
            <div className="bg-slate-950 border border-slate-800 rounded-lg p-3 mt-2 text-xs space-y-1.5">
              <div className="font-semibold text-slate-400 uppercase">Static EHR Snapshot</div>
              <div className="flex justify-between">
                <span className="text-slate-500">Baseline BP:</span>
                <span className="font-mono">{twinData.ehr_summary.bp} mmHg</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Cholesterol:</span>
                <span className="font-mono">{twinData.ehr_summary.cholesterol} mg/dL</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">BMI:</span>
                <span className="font-mono">{twinData.ehr_summary.bmi}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">XGBoost EHR Risk:</span>
                <span className="font-mono text-cyan-400">{twinData.baseline_ehr_risk}%</span>
              </div>
            </div>
          )}

          {/* Time-Series Scrubber Always Accessible */}
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

        {/* Right Content Area: Switches between Doctor View and P4 Patient View */}
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

      {/* HL7 FHIR R4 Modal */}
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

    return (
      <div className="flex flex-col gap-5">
        {/* Patient Banner */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 flex flex-wrap justify-between items-center gap-4">
          <div className="flex items-center gap-4">
            <div className="bg-slate-800 p-3 rounded-xl border border-slate-700">
              <User className="h-7 w-7 text-cyan-400" />
            </div>
            <div>
              <h2 className="text-xl font-bold">{data.name}</h2>
              <p className="text-xs text-slate-400">
                ID: {data.patient_id} • {data.gender}, {data.age} yrs • Telemetry Offset: +{data.hour_offset}h
              </p>
            </div>
          </div>

          <div
            className={`px-5 py-2 rounded-xl flex items-center gap-3 border ${
              isRed
                ? "bg-red-950/60 border-red-500/50 text-red-200"
                : isYellow
                ? "bg-amber-950/60 border-amber-500/50 text-amber-200"
                : "bg-emerald-950/60 border-emerald-500/50 text-emerald-200"
            }`}
          >
            {isRed ? (
              <AlertTriangle className="h-6 w-6 text-red-400 animate-bounce" />
            ) : isYellow ? (
              <AlertTriangle className="h-6 w-6 text-amber-400" />
            ) : (
              <ShieldCheck className="h-6 w-6 text-emerald-400" />
            )}
            <div>
              <div className="text-[10px] uppercase font-semibold tracking-wider">Disposition Flag</div>
              <div className="font-bold text-sm">{data.clinical_status} STATUS</div>
            </div>
          </div>
        </div>

        {/* Live Wearable Cards */}
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

        {/* Two-Column Section: Fusion Risk + Explainable AI (XAI) */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {/* Fused Risk Gauge */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 flex flex-col justify-between">
            <div>
              <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-3">
                Digital Twin Fused Anomaly Probability
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

          {/* INNOVATION 1: Explainable AI (XAI) Attribution */}
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

        {/* INNOVATION 3: Automated Emergency Escalation Webhook Feed */}
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

        {/* Friendly Coach Card */}
        <div className="bg-slate-950 border border-slate-800 rounded-2xl p-4">
          <p className="text-sm text-slate-200 leading-relaxed">
            {data.p4_companion.friendly_message}
          </p>
        </div>

        {/* Simplified Vitals for Patient */}
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

        {/* Participatory Action Checklist */}
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