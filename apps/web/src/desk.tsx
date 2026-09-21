/** Layered desk panels. All rewards, recap gains and eligibility are supplied by the server. */
import { useEffect, useRef, useState, lazy, Suspense, Component } from "react";
import type { ReactNode, ErrorInfo } from "react";
import { useReducedMotion } from "motion/react";
import {
  chronicleData as data,
  eras,
  jobs,
} from "../../../packages/gamedata/src/index.ts";
import type { PlayerState } from "../../../packages/engine/src/index.ts";
import type { DeskProjection } from "../../../packages/engine/src/presentation.ts";
import type { FeatureAction } from "../../../packages/engine/src/chronicle.ts";
import { DeskIcon } from "./desk-icons.tsx";
import { Reveal } from "./desk-motion.tsx";
import { useDeskPreferences } from "./desk-preferences.ts";
const Scene = lazy(() => import("./desk-scene.tsx"));
type Send = (
  type: FeatureAction["type"],
  key?: string,
  extra?: { approach?: "cautious" | "bold"; crewId?: string },
) => void;
type Props = {
  state: PlayerState;
  desk: DeskProjection;
  serverTime: number;
  pending: boolean;
  send: Send;
};
export function useServerDisplayClock(serverTime: number) {
  const base = useRef({ serverTime, local: performance.now() });
  const [now, setNow] = useState(serverTime);
  useEffect(() => {
    base.current = { serverTime, local: performance.now() };
    setNow(serverTime);
  }, [serverTime]);
  useEffect(() => {
    const timer = setInterval(
      () =>
        setNow(
          base.current.serverTime + performance.now() - base.current.local,
        ),
      250,
    );
    return () => clearInterval(timer);
  }, []);
  return now;
}
export function WelcomeBack({
  state,
  send,
  pending,
}: Pick<Props, "state" | "send" | "pending">) {
  const ref = useRef<HTMLDialogElement>(null),
    report = state.chronicle.report;
  useEffect(() => {
    if (report && !ref.current?.open) ref.current?.showModal();
    if (!report && ref.current?.open) ref.current.close();
  }, [report?.id]);
  if (!report) return null;
  return (
    <dialog
      ref={ref}
      className="ledger-report"
      aria-labelledby="report-title"
      onCancel={(e) => e.preventDefault()}
    >
      <p className="eyebrow">Your clerk kept the books</p>
      <h2 id="report-title">Ember Ledger report</h2>
      <p>
        While you were away for {Math.floor((report.to - report.from) / 60000)}{" "}
        minutes, the Line continued.
      </p>
      <dl className="recap-grid">
        {Object.entries(report.gains).map(([name, value]) => (
          <div key={name}>
            <dt>{name}</dt>
            <dd>+{value}</dd>
          </div>
        ))}
      </dl>
      <p>
        Income is stored in your holdings. Resources are already credited. First
        8 hours accrue fully; hours 8–24 accrue at 25%. Faction clocks continue.
      </p>
      {state.chronicle.operation && <p>An operation awaits your resolution.</p>}
      <button
        autoFocus
        disabled={pending}
        onClick={() => send("report-ack", report.id)}
      >
        File report and return
      </button>
    </dialog>
  );
}
export function OperationDesk({
  state,
  serverTime,
  pending,
  send,
}: Omit<Props, "desk">) {
  const now = useServerDisplayClock(serverTime),
    op = state.chronicle.operation,
    resolution = state.chronicle.resolution;
  return (
    <section className="instrument operation-desk">
      <h2>
        <DeskIcon name="clock" /> Tactical resolution
      </h2>
      {op ? (
        <>
          <p>
            {jobs.find((j) => j.id === op.id)?.name ??
              data.uniqueOperations.find((j) => j.id === op.id)?.name}{" "}
            · {op.approach} approach
          </p>
          <div className="brass-clock" aria-live="polite">
            <span
              className="clock-hand"
              aria-hidden="true"
              style={{
                transform: `rotate(${Math.min(1, Math.max(0, 1 - (op.readyAt - now) / data.operation.durationMs)) * 360}deg)`,
              }}
            />
            {Math.max(0, Math.ceil((op.readyAt - now) / 1000))}s
          </div>
          <button
            disabled={pending || now < op.readyAt}
            onClick={() => send("operation-resolve")}
          >
            Resolve operation
          </button>
          <small>The server verifies readiness before settlement.</small>
        </>
      ) : (
        <p>Choose a route and an approach. Your crew remembers the decision.</p>
      )}
      {resolution && !op && (
        <Reveal id={`${resolution.title}-${state.chronicle.totals.operations}`}>
          <div
            className={`resolution ${resolution.success ? "success" : "failure"}`}
          >
            <span className="wax-seal">
              <DeskIcon name="seal" />
            </span>
            <h3>
              {resolution.success ? "Operation complete" : "Operation failed"}
            </h3>
            <p>{resolution.text}</p>
            <strong>
              {resolution.cash} crowns · {resolution.xp} XP
            </strong>
          </div>
        </Reveal>
      )}
    </section>
  );
}
export function OperationChoices({
  state,
  approach,
  setApproach,
  crewId,
  setCrewId,
}: {
  state: PlayerState;
  approach: "cautious" | "bold";
  setApproach: (v: "cautious" | "bold") => void;
  crewId: string;
  setCrewId: (v: string) => void;
}) {
  return (
    <div className="operation-choices">
      <label>
        Approach
        <select
          value={approach}
          onChange={(e) => setApproach(e.target.value as "cautious" | "bold")}
        >
          <option value="cautious">
            Cautious · guaranteed · protects loyalty
          </option>
          <option value="bold">Bold · 75% success · higher proceeds</option>
        </select>
      </label>
      <label>
        Lead operator
        <select value={crewId} onChange={(e) => setCrewId(e.target.value)}>
          {state.chronicle.companions
            .filter((m) => !m.defected)
            .map((m) => (
              <option key={m.id} value={m.id}>
                {data.crew.find((d) => d.id === m.id)?.name} · loyalty{" "}
                {m.loyalty}
              </option>
            ))}
        </select>
      </label>
    </div>
  );
}
export function LedgerDesk({
  state,
  pending,
  send,
}: Pick<Props, "state" | "pending" | "send">) {
  const c = state.chronicle;
  return (
    <section className="panel parchment">
      <h2>
        <DeskIcon name="ledger" /> The literal ledger
      </h2>
      <p>
        Suspicion {c.heat}/100. Audits turn entries into salvage; discovering a
        forgery costs crowns. Redaction changes this book, never the server
        audit.
      </p>
      <div className="button-row">
        <button
          disabled={pending || sNoEntries(state)}
          onClick={() => send("ledger-audit")}
        >
          Audit entries · 2 nerve
        </button>
        <button disabled={pending} onClick={() => send("ledger-forge")}>
          Forge entry · 3 nerve
        </button>
      </div>
      <ol className="ledger-entries">
        {c.entries
          .slice()
          .reverse()
          .map((e) => (
            <li key={e.id}>
              <div>
                <b>
                  #{e.id} · {e.action}
                </b>
                <span className="tag">{e.status}</span>
                <p>{e.text}</p>
              </div>
              <button
                className="secondary"
                disabled={pending || e.status === "redacted"}
                onClick={() => send("ledger-redact", e.id)}
              >
                Redact · 40
              </button>
            </li>
          ))}
      </ol>
      {!c.entries.length && (
        <p>The first page is waiting for your signature.</p>
      )}
    </section>
  );
}
function sNoEntries(s: PlayerState) {
  return !s.chronicle.entries.some((e) =>
    ["intact", "forged"].includes(e.status),
  );
}
export function CrewDesk({
  state,
  pending,
  send,
}: Pick<Props, "state" | "pending" | "send">) {
  return (
    <section className="panel">
      <h2>
        <DeskIcon name="crew" /> People, not counters
      </h2>
      {data.crew.map((def) => {
        const member = state.chronicle.companions.find((m) => m.id === def.id);
        return (
          <article className="crew-record" key={def.id}>
            <h3>
              {def.name} <span className="tag">{def.trait}</span>
            </h3>
            {member ? (
              <>
                <p>
                  Loyalty {member.loyalty}/100 ·{" "}
                  {member.defected
                    ? "Defected"
                    : member.loyalty < data.crewRules.refusalBelow
                      ? "Refuses orders"
                      : "Available"}{" "}
                  · {member.successes} successful operations
                </p>
                <p className="memory">
                  {member.memories.at(-1) ?? "No shared memory yet."}
                </p>
                <div className="button-row">
                  <button
                    disabled={pending || member.defected}
                    onClick={() => send("crew-reassure", def.id)}
                  >
                    Reassure · 50 crowns
                  </button>
                  {member.defected && (
                    <button
                      disabled={pending}
                      onClick={() => send("crew-recruit", def.id)}
                    >
                      Negotiate return · 200
                    </button>
                  )}
                  <button
                    className="secondary"
                    disabled={
                      pending ||
                      member.defected ||
                      member.successes < def.memoryGate ||
                      !!state.chronicle.operation
                    }
                    onClick={() =>
                      send("operation-start", def.operation, {
                        crewId: def.id,
                        approach: "cautious",
                      })
                    }
                  >
                    Unique operation · {def.memoryGate} memories
                  </button>
                </div>
              </>
            ) : (
              <button
                disabled={pending || state.level < eras[def.era].level}
                onClick={() => send("crew-recruit", def.id)}
              >
                Recruit contact · 100 · Lv {eras[def.era].level}
              </button>
            )}
          </article>
        );
      })}
    </section>
  );
}
export function SupplyMap({
  state,
  desk,
  pending,
  send,
}: Pick<Props, "state" | "desk" | "pending" | "send">) {
  return (
    <section className="panel">
      <h2>
        <DeskIcon name="network" /> Holdings supply network
      </h2>
      <svg
        className="supply-map"
        viewBox="0 0 500 240"
        role="img"
        aria-label="Quay connects to Steps, Steps to March, March to Drift"
      >
        <title>
          Connected supply lines increase income; faction pressure reduces it.
        </title>
        {data.holdings.flatMap((node) =>
          node.neighbors
            .filter((id) => node.id < id)
            .map((id) => {
              const other = data.holdings.find((h) => h.id === id)!;
              const active = state.chronicle.links.includes(
                [node.id, id].sort().join(":"),
              );
              return (
                <line
                  key={`${node.id}:${id}`}
                  x1={70 + node.x * 180}
                  y1={50 + node.y * 140}
                  x2={70 + other.x * 180}
                  y2={50 + other.y * 140}
                  stroke={active ? "#6db4a1" : "#77705f"}
                  strokeWidth={active ? 4 : 2}
                  strokeDasharray={active ? undefined : "6 6"}
                />
              );
            }),
        )}
        {data.holdings.map((node) => (
          <g
            key={node.id}
            transform={`translate(${70 + node.x * 180} ${50 + node.y * 140})`}
          >
            <circle
              r="24"
              fill={
                state.holdings.some((h) => h.era === node.era)
                  ? "#b69861"
                  : "#30372f"
              }
              stroke="#eee4cf"
            />
            <text y="4" textAnchor="middle" fill="#101514">
              {node.era + 1}
            </text>
            <text y="43" textAnchor="middle" fill="#eee4cf">
              {node.id}
            </text>
          </g>
        ))}
      </svg>
      <div className="network-list">
        {data.holdings.map((node) => (
          <article key={node.id}>
            <h3>{node.name}</h3>
            <p>
              Server income factor:{" "}
              {desk.network
                .find((n) => n.era === node.era)
                ?.multiplier.toFixed(2)}
              ×
            </p>
            {node.neighbors
              .filter((id) => node.id < id)
              .map((id) => (
                <button
                  key={id}
                  disabled={
                    pending ||
                    state.chronicle.links.includes(
                      [node.id, id].sort().join(":"),
                    )
                  }
                  onClick={() =>
                    send("network-link", [node.id, id].sort().join(":"))
                  }
                >
                  Supply {node.id} ↔ {id} · 75 crowns
                </button>
              ))}
          </article>
        ))}
      </div>
      <OptionalScene state={state} mode="map" />
    </section>
  );
}
export function ThreatDesk({
  state,
  serverTime,
  pending,
  send,
}: Omit<Props, "desk">) {
  const now = useServerDisplayClock(serverTime);
  return (
    <section className="instrument">
      <h2>
        <DeskIcon name="clock" /> The Glasswrit Office
      </h2>
      <p>
        Faction escalation {state.chronicle.pressure}/{data.threat.maximum}.
        Next advance in{" "}
        {Math.max(0, Math.ceil((state.chronicle.threatNextAt - now) / 60000))}m.
      </p>
      <p>
        Each escalation cuts holding income by 4%. The Office advances while you
        are away.
      </p>
      <button
        disabled={pending || !state.chronicle.pressure}
        onClick={() => send("threat-suppress")}
      >
        Suppress pressure · 3 stamina
      </button>
    </section>
  );
}
export function AshDesk({
  state,
  desk,
  pending,
  send,
}: Pick<Props, "state" | "desk" | "pending" | "send">) {
  return (
    <section className="panel parchment">
      <h2>
        <DeskIcon name="ash" /> Ash Cycle
      </h2>
      <p>
        {desk.mastery}/{data.prestige.masteryRequired} mastery ·{" "}
        {state.chronicle.ash} permanent ash
      </p>
      <p>
        Close a ledger aged at least four hours. Reset level, skills and
        mastery; keep your holdings, crew, gear and history. Earn permanent
        operation and holding multipliers, and uncover a new chapter.
      </p>
      <p>
        Server preview: {desk.ashGain} ash. Earliest closing:{" "}
        {new Date(desk.ashReadyAt).toLocaleString()}.
      </p>
      <button
        disabled={pending || !desk.ashEligible}
        onClick={() => send("ash-cycle")}
      >
        Close Ash Cycle
      </button>
    </section>
  );
}
export function CodexDesk({ state }: Pick<Props, "state">) {
  return (
    <section className="panel parchment">
      <h2>Living codex</h2>
      {data.lore.map((l) =>
        state.chronicle.lore.includes(l.id) ? (
          <article key={l.id} className="codex-fragment">
            <p className="eyebrow">{l.form}</p>
            <h3>{l.title}</h3>
            <blockquote>{l.text}</blockquote>
          </article>
        ) : (
          <p key={l.id}>
            Sealed fragment · {l.threshold} {l.trigger}
          </p>
        ),
      )}
      <h2>Marks of the hand</h2>
      <div className="badge-grid">
        {data.achievements.map((b) => (
          <div
            key={b.id}
            className={`badge material-${b.material} ${state.chronicle.badges.includes(b.id) ? "earned" : "locked"}`}
          >
            <DeskIcon name="seal" />
            <b>{b.name}</b>
            <small>
              {b.material} ·{" "}
              {state.chronicle.badges.includes(b.id)
                ? "earned"
                : `${b.threshold} ${b.metric}`}
            </small>
          </div>
        ))}
      </div>
      <OptionalScene state={state} mode="relic" />
    </section>
  );
}
class SceneBoundary extends Component<
  { children: ReactNode },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch(_error: Error, _info: ErrorInfo) {
    /* The complete 2D map remains above. */
  }
  render() {
    return this.state.failed ? (
      <p>3D unavailable on this device. The 2D ledger remains fully usable.</p>
    ) : (
      this.props.children
    );
  }
}
export function OptionalScene({
  state,
  mode,
}: {
  state: PlayerState;
  mode: "map" | "relic";
}) {
  const [open, setOpen] = useState(false),
    reduced = useReducedMotion(),
    speed = useDeskPreferences((s) => s.speed);
  return (
    <div>
      <button
        className="secondary"
        disabled={!!reduced || !speed}
        onClick={() => setOpen(!open)}
      >
        {open ? "Close 3D inspection" : "Open optional 3D inspection"}
      </button>
      {(reduced || !speed) && (
        <small>2D selected by your motion preference.</small>
      )}
      {open && !reduced && !!speed && (
        <SceneBoundary>
          <Suspense fallback={<p>Preparing inspection…</p>}>
            <Scene
              mode={mode}
              holdings={state.holdings.map((h) => h.era)}
              material={state.chronicle.badges.length}
            />
          </Suspense>
        </SceneBoundary>
      )}
    </div>
  );
}
