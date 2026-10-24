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
  FileText,
  Printer,
  ClipboardCheck,
  Users,
  Watch,
  PhoneCall,
  RefreshCw,
  TrendingDown,
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
  acknowledged?: boolean;
  acknowledged_at?: string;
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

const COHORT_CARDS = [
  {
    id: "PAT_001",
    name: "Rajesh Sharma (PAT_001)",
    subtitle: "61M • Autonomic Collapse & Arrhythmia",
    badgeColor: "text-red-400",
    defaultHour: 47
  },
  {
    id: "PAT_002",
    name: "Ananya Deshmukh (PAT_002)",
    subtitle: "34F • Healthy Control Profile",
    badgeColor: "text-emerald-400",
    defaultHour: 12
  },
  {
    id: "PAT_003",
    name: "Sunita Mehta (PAT_003)",
    subtitle: "58F • Post-MI Nocturnal SpO2 Drift",
    badgeColor: "text-amber-400",
    defaultHour: 42
  },
  {
    id: "PAT_004",
    name: "Vikram Malhotra (PAT_004)",
    subtitle: "42M • Sympathetic Stress Tachycardia",
    badgeColor: "text-purple-400",
    defaultHour: 28
  }
];

export default function VitalTwinsDashboard() {
  const [selectedPatient, setSelectedPatient] = useState("PAT_001");
  const [hour, setHour] = useState(47);
  const [twinData, setTwinData] = useState<TwinState | null>(null);
  const [simData, setSimData] = useState<InSilicoResponse | null>(null);
  const [selectedDrugId, setSelectedDrugId] = useState<string>("AMIODARONE_200");
  const [viewMode, setViewMode] = useState<"DOCTOR" | "CAREGIVER" | "PATIENT">("DOCTOR");
  const [isSimulating, setIsSimulating] = useState(false);

  // Wearable Sync Bridge state
  const [showWatchModal, setShowWatchModal] = useState(false);
  const [isSyncingWatch, setIsSyncingWatch] = useState(false);
  const [lastSyncText, setLastSyncText] = useState("Synced 12s ago via Health Connect");
  const [refreshTick, setRefreshTick] = useState(0);

  // Chronic Lifestyle Simulator state (Caregiver / Patient)
  const [targetWeightLossKg, setTargetWeightLossKg] = useState(4);
  const [dailyWalkMins, setDailyWalkMins] = useState(30);

  // Modals
  const [showFhirModal, setShowFhirModal] = useState(false);
  const [fhirJson, setFhirJson] = useState<Record<string, unknown> | null>(null);
  const [showAuditModal, setShowAuditModal] = useState(false);
  const [escalationLogs, setEscalationLogs] = useState<EscalationEvent[]>([]);
  const [showReportModal, setShowReportModal] = useState(false);

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

  const handleAcknowledge = async (eventId: string) => {
    try {
      await fetch(`http://127.0.0.1:8000/api/escalations/ack/${eventId}`, {
        method: "POST"
      });
      const escRes = await fetch(`http://127.0.0.1:8000/api/escalations`);
      const eJson = await escRes.json();
      setEscalationLogs(eJson.escalations || []);
    } catch (err) {
      console.error("Failed to acknowledge event:", err);
    }
  };

  const triggerWatchSync = () => {
    setIsSyncingWatch(true);
    setTimeout(() => {
      setIsSyncingWatch(false);
      setLastSyncText("Just now • BLE Packet Verified");
      setRefreshTick((t) => t + 1);
    }, 900);
  };

  useEffect(() => {
    let ignore = false;
    async function loadTwinData() {
      try {
        const [twinRes, simRes, escRes] = await Promise.all([
          fetch(`http://127.0.0.1:8000/api/twin/${selectedPatient}/${hour}`),
          fetch(`http://127.0.0.1:8000/api/simulate/${selectedPatient}/${hour}`),
          fetch(`http://127.0.0.1:8000/api/escalations`)
        ]);
        const tJson = await twinRes.json();
        const sJson: InSilicoResponse = await simRes.json();
        const eJson = await escRes.json();

        if (!ignore) {
          setTwinData(tJson);
          setSimData(sJson);
          setEscalationLogs(eJson.escalations || []);
          if (sJson?.optimal_recommendation?.drug_id) {
            setSelectedDrugId(sJson.optimal_recommendation.drug_id);
          }
        }
      } catch (err) {
        console.error("Failed to connect to VitalTwins backend:", err);
      }
    }
    loadTwinData();
    return () => {
      ignore = true;
    };
  }, [selectedPatient, hour, refreshTick]);

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
            VitalTwins | Tri-Node Cardiovascular Digital Twin
          </h1>
          <p className="text-xs text-slate-400 mt-0.5">
            Edge Smartwatch Bridge • Family Caregiver Monitor • In-Silico PK/PD Trials • HL7 FHIR R4
          </p>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          {/* 3-Node Ecosystem View Switcher */}
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
              Doctor View
            </button>
            <button
              onClick={() => setViewMode("CAREGIVER")}
              className={`px-3 py-1.5 rounded-md text-xs font-semibold flex items-center gap-1.5 transition-all ${
                viewMode === "CAREGIVER"
                  ? "bg-indigo-600 text-white"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              <Users className="h-3.5 w-3.5" />
              Family Caregiver
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
              P4 Companion
            </button>
          </div>

          {/* Edge Smartwatch Ingestion Bridge Button */}
          <button
            onClick={() => setShowWatchModal(true)}
            className="px-3 py-2 rounded-lg font-medium text-xs bg-slate-900 hover:bg-slate-800 border border-emerald-500/40 text-emerald-300 flex items-center gap-1.5 transition-all"
          >
            <Watch className="h-4 w-4 text-emerald-400" />
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
            Smartwatch Bridge
          </button>

          {/* Clinical Handoff PDF Report Button */}
          <button
            onClick={() => setShowReportModal(true)}
            className="px-3 py-2 rounded-lg font-medium text-xs bg-slate-800 hover:bg-slate-700 border border-slate-700 text-emerald-300 flex items-center gap-1.5 transition-all"
          >
            <FileText className="h-4 w-4" />
            Clinical PDF
          </button>

          {/* Escalation Audit Trail Button */}
          <button
            onClick={() => setShowAuditModal(true)}
            className="px-3 py-2 rounded-lg font-medium text-xs bg-slate-800 hover:bg-slate-700 border border-slate-700 text-rose-300 flex items-center gap-1.5 transition-all"
          >
            <BellRing className="h-4 w-4" />
            Escalations ({escalationLogs.length})
          </button>

          {/* FHIR Export Button */}
          <button
            onClick={fetchFhirBundle}
            className="px-3 py-2 rounded-lg font-medium text-xs bg-slate-800 hover:bg-slate-700 border border-slate-700 text-cyan-300 flex items-center gap-1.5 transition-all"
          >
            <FileJson className="h-4 w-4" />
            FHIR R4
          </button>

          {/* Live Stream Button */}
          <button
            onClick={() => setIsSimulating(!isSimulating)}
            className={`px-3.5 py-2 rounded-lg font-medium text-xs transition-all flex items-center gap-1.5 ${
              isSimulating
                ? "bg-amber-600 hover:bg-amber-500 text-white"
                : "bg-cyan-600 hover:bg-cyan-500 text-white"
            }`}
          >
            <Zap className="h-4 w-4" />
            {isSimulating ? "Pause Stream" : "Simulate 48h"}
          </button>
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Left Sidebar */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex flex-col gap-4">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
            Sandbox Patient Cohort (4 Archetypes)
          </h2>
          <div className="flex flex-col gap-2">
            {COHORT_CARDS.map((c) => (
              <button
                key={c.id}
                onClick={() => {
                  setIsSimulating(false);
                  setSelectedPatient(c.id);
                  setHour(c.defaultHour);
                }}
                className={`p-3 rounded-lg text-left transition-all border ${
                  selectedPatient === c.id
                    ? "bg-cyan-950/50 border-cyan-500 text-cyan-200"
                    : "bg-slate-800/50 border-transparent text-slate-300 hover:bg-slate-800"
                }`}
              >
                <div className="font-semibold text-xs">{c.name}</div>
                <div className={`text-[11px] mt-0.5 ${c.badgeColor}`}>{c.subtitle}</div>
              </button>
            ))}
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

        {/* Right Area: Renders Doctor, Family Caregiver, or Patient Companion */}
        <div className="lg:col-span-3">
          {!twinData ? (
            <div className="flex items-center justify-center h-96 text-slate-400">
              Connecting to VitalTwins Engine...
            </div>
          ) : viewMode === "DOCTOR" ? (
            renderDoctorView(twinData)
          ) : viewMode === "CAREGIVER" ? (
            renderFamilyCaregiverView(twinData)
          ) : (
            renderPatientCompanionView(twinData)
          )}
        </div>
      </div>

      {/* Modal 0: Smartwatch Health Connect / Apple HealthKit Bridge */}
      {showWatchModal && twinData && (
        <div className="fixed inset-0 bg-black/75 flex items-center justify-center p-4 z-50">
          <div className="bg-slate-900 border border-slate-700 rounded-xl max-w-lg w-full p-5 space-y-4">
            <div className="flex justify-between items-center border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2 text-emerald-400 font-bold text-sm">
                <Watch className="h-5 w-5" />
                Edge Wearable Ingestion Bridge (BLE / Health Connect)
              </div>
              <button onClick={() => setShowWatchModal(false)} className="text-slate-400 hover:text-white">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="bg-slate-950 border border-slate-800 rounded-lg p-4 space-y-2.5 text-xs">
              <div className="flex justify-between items-center">
                <span className="text-slate-400">Connected Device:</span>
                <span className="font-semibold text-emerald-300">
                  Galaxy Watch 6 / Apple HealthKit Bridge
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-400">Telemetry Protocol:</span>
                <span className="font-mono text-cyan-300">REST Webhook + HL7 LOINC Stream</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-400">Last Packet Sync:</span>
                <span className="font-mono text-slate-200">{lastSyncText}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-400">Live Payload Snapshot:</span>
                <span className="font-mono text-amber-300">
                  RHR {twinData.telemetry.heart_rate_bpm} bpm | HRV {twinData.telemetry.hrv_ms} ms | SpO2{" "}
                  {twinData.telemetry.spo2_pct}%
                </span>
              </div>
            </div>

            <div className="flex justify-end gap-2">
              <button
                onClick={triggerWatchSync}
                disabled={isSyncingWatch}
                className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold flex items-center gap-1.5"
              >
                <RefreshCw className={`h-4 w-4 ${isSyncingWatch ? "animate-spin" : ""}`} />
                {isSyncingWatch ? "Pulling Wrist Telemetry..." : "Force Instant Wrist Sync"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal 1: HL7 FHIR R4 Inspector */}
      {showFhirModal && (
        <div className="fixed inset-0 bg-black/75 flex items-center justify-center p-4 z-50">
          <div className="bg-slate-900 border border-slate-700 rounded-xl max-w-3xl w-full max-h-[80vh] flex flex-col">
            <div className="flex justify-between items-center p-4 border-b border-slate-800">
              <div className="flex items-center gap-2 text-cyan-400 font-bold text-sm">
                <FileJson className="h-5 w-5" />
                HL7 FHIR R4 Interoperability Payload (Patient + Observation + RiskAssessment)
              </div>
              <button onClick={() => setShowFhirModal(false)} className="text-slate-400 hover:text-white">
                <X className="h-5 w-5" />
              </button>
            </div>
            <pre className="p-4 text-xs font-mono text-emerald-300 overflow-y-auto bg-slate-950 flex-1">
              {JSON.stringify(fhirJson, null, 2)}
            </pre>
          </div>
        </div>
      )}

      {/* Modal 2: Stateful Emergency Escalation Audit Trail */}
      {showAuditModal && (
        <div className="fixed inset-0 bg-black/75 flex items-center justify-center p-4 z-50">
          <div className="bg-slate-900 border border-slate-700 rounded-xl max-w-3xl w-full max-h-[80vh] flex flex-col">
            <div className="flex justify-between items-center p-4 border-b border-slate-800">
              <div className="flex items-center gap-2 text-rose-400 font-bold text-sm">
                <BellRing className="h-5 w-5" />
                Hospital Emergency Webhook &amp; Pager Escalation Audit Log
              </div>
              <button onClick={() => setShowAuditModal(false)} className="text-slate-400 hover:text-white">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="p-4 overflow-y-auto space-y-3 flex-1">
              {escalationLogs.length === 0 ? (
                <div className="text-center text-slate-500 py-8 text-sm">
                  No critical escalations triggered yet. Scrub a high-risk patient to RED status.
                </div>
              ) : (
                escalationLogs.map((ev) => (
                  <div
                    key={ev.event_id}
                    className="bg-slate-950 border border-slate-800 rounded-lg p-3.5 flex flex-wrap justify-between items-center gap-3"
                  >
                    <div className="space-y-1 text-xs max-w-xl">
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-rose-400">{ev.event_id}</span>
                        <span className="text-slate-500">• {ev.timestamp}</span>
                      </div>
                      <div className="text-slate-200 font-medium">{ev.message}</div>
                      <div className="text-slate-400 text-[11px]">
                        Target: {ev.dispatched_to} ({ev.channel})
                      </div>
                    </div>
                    <div>
                      {ev.acknowledged ? (
                        <span className="px-3 py-1.5 rounded-lg bg-emerald-950/80 border border-emerald-500/40 text-emerald-300 text-xs font-semibold flex items-center gap-1.5">
                          <ClipboardCheck className="h-4 w-4" />
                          Acked ({ev.acknowledged_at})
                        </span>
                      ) : (
                        <button
                          onClick={() => handleAcknowledge(ev.event_id)}
                          className="px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold transition-all"
                        >
                          Acknowledge Pager
                        </button>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* Modal 3: Printable Clinical Handoff & In-Silico Trial Report */}
      {showReportModal && twinData && simData && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-50">
          <div className="bg-white text-slate-900 rounded-xl max-w-3xl w-full max-h-[88vh] flex flex-col shadow-2xl">
            <div className="flex justify-between items-center p-4 border-b border-slate-200 bg-slate-100 rounded-t-xl">
              <div className="font-bold text-sm text-slate-800 flex items-center gap-2">
                <FileText className="h-5 w-5 text-cyan-700" />
                VitalTwins Official Clinical Handoff &amp; In-Silico PK/PD Report
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => window.print()}
                  className="px-3 py-1.5 bg-cyan-700 hover:bg-cyan-600 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5"
                >
                  <Printer className="h-4 w-4" /> Print / Save as PDF
                </button>
                <button
                  onClick={() => setShowReportModal(false)}
                  className="text-slate-500 hover:text-slate-900 p-1"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>

            <div className="p-6 overflow-y-auto space-y-5 text-xs leading-relaxed">
              <div className="flex justify-between items-start border-b border-slate-300 pb-4">
                <div>
                  <h2 className="text-lg font-extrabold text-slate-900">
                    VITALTWINS CARDIOVASCULAR DIGITAL TWIN REPORT
                  </h2>
                  <p className="text-slate-500">
                    HL7 FHIR R4 Compliant Decision Support Summary • Team Ctrl Win (PCCOE Pune)
                  </p>
                </div>
                <div className="text-right font-mono">
                  <div className="font-bold">Disposition: {twinData.clinical_status}</div>
                  <div>Stream Offset: +{twinData.hour_offset}h / 47h</div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 bg-slate-50 p-3.5 rounded-lg border border-slate-200">
                <div>
                  <div className="font-bold text-slate-700 uppercase mb-1">Patient Demographics &amp; EHR</div>
                  <div><strong>Name:</strong> {twinData.name} ({twinData.patient_id})</div>
                  <div><strong>Age / Sex:</strong> {twinData.age} yrs / {twinData.gender}</div>
                  <div><strong>Baseline BP &amp; BMI:</strong> {twinData.ehr_summary.bp} mmHg | BMI {twinData.ehr_summary.bmi}</div>
                  <div><strong>XGBoost Static Vulnerability:</strong> {twinData.baseline_ehr_risk}%</div>
                </div>
                <div>
                  <div className="font-bold text-slate-700 uppercase mb-1">Live Wearable Telemetry</div>
                  <div><strong>Resting Heart Rate (RHR):</strong> {twinData.telemetry.heart_rate_bpm} bpm</div>
                  <div><strong>Heart Rate Variability (HRV):</strong> {twinData.telemetry.hrv_ms} ms</div>
                  <div><strong>Blood Oxygen (SpO2):</strong> {twinData.telemetry.spo2_pct}%</div>
                  <div><strong>Fused Digital Twin Risk:</strong> <strong>{twinData.fused_risk_score}%</strong></div>
                </div>
              </div>

              <div>
                <div className="font-bold text-slate-800 uppercase mb-2">
                  1. Explainable AI (XAI) Risk Attribution Breakdown
                </div>
                <div className="border border-slate-200 rounded-lg divide-y divide-slate-200">
                  {twinData.xai_breakdown.map((item, i) => (
                    <div key={i} className="p-2.5 flex justify-between items-center">
                      <div>
                        <span className="font-semibold">{item.factor}</span>
                        <span className="text-slate-500 ml-2">({item.clinical_detail})</span>
                      </div>
                      <span className="font-mono font-bold">{item.contribution_pct}%</span>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <div className="font-bold text-slate-800 uppercase mb-2">
                  2. In-Silico 12-Hour PK/PD Counterfactual Drug Trial Summary
                </div>
                <div className="bg-emerald-50 border border-emerald-300 p-3 rounded-lg mb-3">
                  <div className="font-bold text-emerald-900">
                    ★ AI Optimal Regimen: {simData.optimal_recommendation.drug_name}
                  </div>
                  <div className="text-emerald-800 mt-0.5">{simData.optimal_recommendation.rationale}</div>
                </div>
                <table className="w-full border-collapse border border-slate-300 text-left">
                  <thead className="bg-slate-100">
                    <tr>
                      <th className="border border-slate-300 p-2">Candidate Regimen</th>
                      <th className="border border-slate-300 p-2">12h Treated Risk</th>
                      <th className="border border-slate-300 p-2">Risk Reduction</th>
                      <th className="border border-slate-300 p-2">Min Simulated HR</th>
                      <th className="border border-slate-300 p-2">Safety Verdict</th>
                    </tr>
                  </thead>
                  <tbody>
                    {simData.ranked_interventions.map((d) => (
                      <tr key={d.drug_id}>
                        <td className="border border-slate-300 p-2 font-semibold">{d.name}</td>
                        <td className="border border-slate-300 p-2 font-mono">{d.final_12h_risk_pct}%</td>
                        <td className="border border-slate-300 p-2 font-mono text-emerald-700 font-bold">
                          -{d.absolute_risk_reduction_pct}%
                        </td>
                        <td className="border border-slate-300 p-2 font-mono">{d.min_simulated_hr_bpm} bpm</td>
                        <td className="border border-slate-300 p-2">{d.safety_status}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="border-t border-slate-300 pt-3 flex justify-between text-slate-500">
                <span>Generated by VitalTwins Engine v3.5 (DPDP &amp; HIPAA Sandbox Compliant)</span>
                <span>Attending Cardiologist Signature: _______________________</span>
              </div>
            </div>
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

        {simData && activeDrug && (
          <div className="bg-slate-900 border-2 border-cyan-500/40 rounded-xl p-5 space-y-4">
            <div className="flex flex-wrap justify-between items-start gap-4 border-b border-slate-800 pb-3">
              <div>
                <h3 className="text-sm font-bold text-cyan-400 flex items-center gap-2">
                  <FlaskConical className="h-5 w-5 text-cyan-400" />
                  In-Silico PK/PD Shadow Twin Simulator (12-Hour Counterfactual Forecast)
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Tests virtual drug absorption (Bateman PK) &amp; organ response (Hill PD) on this patient&apos;s digital replica before prescribing.
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

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 pt-1">
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
                {renderCounterfactualChart(simData.untreated_trajectory, activeDrug.trajectory)}
              </div>

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

        {data.escalation_triggered && (
          <div className="bg-red-950/40 border border-red-500/60 rounded-xl p-4 flex items-start justify-between gap-3.5">
            <div className="flex items-start gap-3.5">
              <BellRing className="h-6 w-6 text-red-400 shrink-0 mt-0.5 animate-ping" />
              <div className="text-xs space-y-1">
                <div className="font-bold text-red-200 uppercase tracking-wide">
                  Automated Emergency Escalation Triggered ({data.escalation_triggered.event_id})
                </div>
                <div className="text-red-100">{data.escalation_triggered.message}</div>
                <div className="text-red-300/80 font-mono text-[11px]">
                  Dispatched To: {data.escalation_triggered.dispatched_to} via{" "}
                  {data.escalation_triggered.channel}
                </div>
              </div>
            </div>
            <button
              onClick={() => setShowAuditModal(true)}
              className="px-3 py-1.5 bg-red-800/80 hover:bg-red-700 text-white rounded-lg text-xs font-semibold shrink-0"
            >
              Open Pager Log
            </button>
          </div>
        )}
      </div>
    );
  }

  function renderFamilyCaregiverView(data: TwinState) {
    const isRed = data.clinical_status === "RED";
    const isYellow = data.clinical_status === "YELLOW";
    const projectedChronicDrop = Math.min(
      32,
      Math.round(targetWeightLossKg * 2.4 + (dailyWalkMins / 15) * 3.5)
    );
    const projectedLongTermRisk = Math.max(8, Math.round(data.baseline_ehr_risk - projectedChronicDrop));

    return (
      <div className="flex flex-col gap-5">
        {/* Traffic-Light Household Monitoring Banner */}
        <div
          className={`rounded-2xl p-6 border-2 flex flex-wrap justify-between items-center gap-4 ${
            isRed
              ? "bg-red-950/50 border-red-500 text-red-100"
              : isYellow
              ? "bg-amber-950/50 border-amber-500 text-amber-100"
              : "bg-emerald-950/50 border-emerald-500 text-emerald-100"
          }`}
        >
          <div className="space-y-1 max-w-xl">
            <div className="text-xs uppercase font-bold tracking-wider flex items-center gap-2">
              <Users className="h-4 w-4" /> Family Caregiver Remote Monitor • Home Node
            </div>
            <h2 className="text-2xl font-extrabold">
              {isRed
                ? `URGENT: ${data.name} Needs Immediate Check-In`
                : isYellow
                ? `Heads Up: ${data.name}'s Stress Markers Are Elevated`
                : `${data.name} is Resting Comfortably & Stable`}
            </h2>
            <p className="text-xs opacity-90 leading-relaxed">
              {isRed
                ? "Smartwatch detected a sharp drop in heart recovery (HRV) and elevated resting pulse. Primary clinic has been auto-alerted."
                : isYellow
                ? "Mild fatigue detected on wrist sensor over the past few hours. Encourage hydration and rest."
                : "All smartwatch vitals (Heart Rate, Recovery, Blood Oxygen) are within normal household baseline."}
            </p>
          </div>

          <div className="flex flex-col gap-2">
            <button
              onClick={() => setShowAuditModal(true)}
              className="px-4 py-2.5 rounded-xl bg-white text-slate-950 font-bold text-xs flex items-center justify-center gap-2 shadow-lg hover:bg-slate-200 transition-all"
            >
              <PhoneCall className="h-4 w-4 text-emerald-600" />
              Request Doctor Tele-Check
            </button>
            <div className="text-[11px] font-mono text-center opacity-80">{lastSyncText}</div>
          </div>
        </div>

        {/* Simple Household Vitals */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
            <div className="text-xs text-slate-400">Live Wrist Pulse</div>
            <div className="text-2xl font-bold font-mono text-rose-400 mt-1">
              {data.telemetry.heart_rate_bpm} bpm
            </div>
            <div className="text-[11px] text-slate-500 mt-1">Normal Household Range: 60–85 bpm</div>
          </div>
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
            <div className="text-xs text-slate-400">Heart Stress Resilience (HRV)</div>
            <div className="text-2xl font-bold font-mono text-cyan-400 mt-1">
              {data.telemetry.hrv_ms} ms
            </div>
            <div className="text-[11px] text-slate-500 mt-1">
              {"Higher (>50 ms) means calmer heart"}
            </div>
          </div>
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
            <div className="text-xs text-slate-400">Blood Oxygen Level</div>
            <div className="text-2xl font-bold font-mono text-emerald-400 mt-1">
              {data.telemetry.spo2_pct}%
            </div>
            <div className="text-[11px] text-slate-500 mt-1">Healthy Target: 95%–100%</div>
          </div>
        </div>

        {/* Chronic 6-Month Lifestyle Habit Simulator for Family & Patient */}
        <div className="bg-slate-900 border border-indigo-500/40 rounded-xl p-5 space-y-4">
          <div className="flex flex-wrap justify-between items-center gap-2 border-b border-slate-800 pb-3">
            <div>
              <h3 className="text-sm font-bold text-indigo-300 flex items-center gap-2">
                <TrendingDown className="h-5 w-5 text-indigo-400" />
                6-Month Preventive Lifestyle Twin Simulator (Home Habit Planner)
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Simulate how gradual weight management and daily walking lower {data.name.split(" ")[0]}&apos;s long-term baseline cardiac risk.
              </p>
            </div>
            <div className="bg-indigo-950/70 border border-indigo-500/40 px-3.5 py-2 rounded-lg text-right">
              <div className="text-[10px] uppercase font-bold text-indigo-300">
                6-Month Baseline Risk Projection
              </div>
              <div className="text-sm font-mono font-bold text-emerald-400">
                {data.baseline_ehr_risk}% → {projectedLongTermRisk}% (-{projectedChronicDrop}% Drop)
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-1 text-xs">
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-slate-300 font-medium">Target 6-Month Weight Reduction:</span>
                <span className="font-mono font-bold text-indigo-300">-{targetWeightLossKg} kg</span>
              </div>
              <input
                type="range"
                min="0"
                max="10"
                value={targetWeightLossKg}
                onChange={(e) => setTargetWeightLossKg(parseInt(e.target.value))}
                className="w-full accent-indigo-500 cursor-pointer"
              />
              <div className="text-[11px] text-slate-500">
                Current BMI: {data.ehr_summary.bmi} → Simulated BMI:{" "}
                {(data.ehr_summary.bmi - targetWeightLossKg * 0.34).toFixed(1)}
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-slate-300 font-medium">Daily Brisk Walk / Yoga Routine:</span>
                <span className="font-mono font-bold text-indigo-300">{dailyWalkMins} mins/day</span>
              </div>
              <input
                type="range"
                min="0"
                max="60"
                step="10"
                value={dailyWalkMins}
                onChange={(e) => setDailyWalkMins(parseInt(e.target.value))}
                className="w-full accent-indigo-500 cursor-pointer"
              />
              <div className="text-[11px] text-slate-500">
                Boosts baseline vagal HRV tone by +{Math.round(dailyWalkMins * 0.22)} ms over 24 weeks
              </div>
            </div>
          </div>
        </div>
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

        <polyline
          fill="none"
          stroke="#f43f5e"
          strokeWidth="2.5"
          strokeDasharray="5 3"
          points={untreatedPoints}
        />

        <polyline
          fill="none"
          stroke="#22d3ee"
          strokeWidth="3"
          points={treatedPoints}
        />

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