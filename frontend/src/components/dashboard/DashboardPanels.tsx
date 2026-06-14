import { Activity, Radio, Shield, Zap } from "lucide-react";

interface EmptyStateProps {
  icon: React.ReactNode;
  title: string;
  description: string;
  hint?: string;
}

export function DashboardEmptyState({ icon, title, description, hint }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center text-center px-6 py-10 min-h-[220px]">
      <div className="w-11 h-11 rounded-2xl bg-white/4 border border-white/10 flex items-center justify-center text-[#19C978] mb-4">
        {icon}
      </div>
      <p className="text-[#E1E0CC] font-medium text-sm mb-1.5">{title}</p>
      <p className="text-gray-500 text-xs leading-relaxed max-w-sm">{description}</p>
      {hint && (
        <p className="text-[#19C978]/80 text-[11px] font-mono mt-3 px-3 py-1.5 rounded-full bg-[#19C978]/5 border border-[#19C978]/15">
          {hint}
        </p>
      )}
    </div>
  );
}

interface SystemPulseProps {
  setupComplete: boolean;
  isReadOnly: boolean;
  walletAddress: string | null;
}

export function SystemPulseBar({ setupComplete, isReadOnly, walletAddress }: SystemPulseProps) {
  const items = [
    {
      label: "Chain",
      value: "Base Sepolia",
      ok: true,
    },
    {
      label: "Sentinel",
      value: setupComplete && !isReadOnly ? "Listening" : "Standby",
      ok: setupComplete && !isReadOnly,
    },
    {
      label: "Delegation",
      value: setupComplete ? "Revoke-only" : "Not granted",
      ok: setupComplete,
    },
    {
      label: "Relayer",
      value: setupComplete ? "1Shot armed" : "Inactive",
      ok: setupComplete,
    },
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-8">
      {items.map((item) => (
        <div
          key={item.label}
          className="bg-[#101010] border border-white/5 rounded-xl px-4 py-3 flex items-center gap-3"
        >
          <div
            className={`w-2 h-2 rounded-full shrink-0 ${
              item.ok ? "bg-[#19C978] animate-pulse" : "bg-gray-600"
            }`}
          />
          <div className="min-w-0">
            <p className="text-[10px] uppercase tracking-widest text-gray-500">{item.label}</p>
            <p className={`text-xs font-mono truncate ${item.ok ? "text-[#E1E0CC]" : "text-gray-500"}`}>
              {item.value}
            </p>
          </div>
        </div>
      ))}
      {walletAddress && (
        <div className="col-span-2 lg:col-span-4 bg-[#0B0B0C] border border-white/5 rounded-xl px-4 py-2.5 font-mono text-[11px] text-gray-500 overflow-x-auto whitespace-nowrap">
          <span className="text-[#19C978]">●</span>{" "}
          Monitoring wallet {walletAddress.slice(0, 6)}…{walletAddress.slice(-4)} · awaiting approval events
        </div>
      )}
    </div>
  );
}

interface LiveFeedIdleProps {
  setupComplete: boolean;
}

export function LiveFeedIdlePanel({ setupComplete }: LiveFeedIdleProps) {
  const lines = setupComplete
    ? [
        "Delegation verified — approve(spender, 0) scope only",
        "Block watcher connected — scanning Base Sepolia mempool",
        "Venice AI tier router idle — confidence threshold 85%",
        "No threats in queue — system armed and waiting",
      ]
    : [
        "Wallet connected — protection not yet configured",
        "Complete setup to activate Sentinel + auto-revocation",
        "Signed delegation required on MetaMask Flask",
      ];

  return (
    <div className="p-4 space-y-2 font-mono text-[11px]">
      {lines.map((line, i) => (
        <div
          key={i}
          className="flex gap-2 text-gray-500"
        >
          <span className="text-gray-600 shrink-0">
            {new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
          </span>
          <span className={setupComplete ? "text-gray-400" : "text-[#F59E0B]/80"}>{line}</span>
        </div>
      ))}
      {setupComplete && (
        <div className="mt-4 pt-4 border-t border-white/5 flex items-center gap-2 text-[#19C978]/70">
          <Radio className="w-3 h-3 animate-pulse" />
          <span>Live feed populates when approvals or threats are detected</span>
        </div>
      )}
    </div>
  );
}

interface DemoReadyPanelProps {
  show: boolean;
}

const DEMO_STEPS = [
  {
    title: "Grant a test approval",
    detail: "Approve USDC to the honeypot contract from your Flask wallet.",
  },
  {
    title: "Trigger a threat",
    detail: "Run simulate-threat — Venice scores it, Tier 1 fires auto-revoke.",
  },
  {
    title: "Watch the dashboard react",
    detail: "Live feed, history, and tx link populate from real on-chain events.",
  },
];

export function DemoReadyPanel({ show }: DemoReadyPanelProps) {
  if (!show) return null;

  return (
    <div className="bg-linear-to-br from-[#19C978]/[0.07] to-transparent border border-[#19C978]/20 rounded-2xl p-6">
      <div className="flex items-start gap-3 mb-5">
        <div className="w-9 h-9 rounded-xl bg-[#19C978]/10 flex items-center justify-center shrink-0">
          <Zap className="w-4 h-4 text-[#19C978]" />
        </div>
        <div>
          <h3 className="text-[#E1E0CC] font-medium text-sm">Ready for demo — system armed, no activity yet</h3>
          <p className="text-gray-500 text-xs mt-1 leading-relaxed">
            Empty panels are expected before the first approval. The flow below is what you&apos;ll show on camera — all real data, no placeholders.
          </p>
        </div>
      </div>
      <ol className="space-y-3">
        {DEMO_STEPS.map((step, i) => (
          <li key={i} className="flex gap-3 items-start">
            <span className="w-6 h-6 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-[10px] font-mono text-[#19C978] shrink-0">
              {i + 1}
            </span>
            <div>
              <p className="text-[#E1E0CC] text-xs font-medium">{step.title}</p>
              <p className="text-gray-500 text-[11px] mt-0.5">{step.detail}</p>
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}

interface StatCardProps {
  label: string;
  value: string;
  subtext?: string;
  accent?: boolean;
}

export function StatCard({ label, value, subtext, accent }: StatCardProps) {
  return (
    <div className="bg-[#101010] p-5 rounded-2xl border border-white/5 flex flex-col justify-between min-h-[108px]">
      <span className="text-gray-500 text-[10px] tracking-widest uppercase">{label}</span>
      <div>
        <span className={`text-2xl sm:text-3xl font-medium tracking-tight ${accent ? "text-[#19C978]" : "text-[#E1E0CC]"}`}>
          {value}
        </span>
        {subtext && <p className="text-gray-600 text-[11px] mt-1">{subtext}</p>}
      </div>
    </div>
  );
}

export function SectionHeader({
  title,
  icon,
  action,
}: {
  title: string;
  icon?: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <div className="p-5 border-b border-white/5 bg-[#0B0B0C] flex justify-between items-center gap-3">
      <div className="flex items-center gap-2.5">
        {icon}
        <h2 className="text-[#E1E0CC] font-medium text-base">{title}</h2>
      </div>
      {action}
    </div>
  );
}

export function TableShell({
  columns,
  empty,
}: {
  columns: string[];
  empty: React.ReactNode;
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-sm">
        <thead>
          <tr className="border-b border-white/5 text-gray-500 h-11">
            {columns.map((col) => (
              <th key={col} className="px-5 font-normal text-xs whitespace-nowrap">
                {col}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          <tr>
            <td colSpan={columns.length}>{empty}</td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}
