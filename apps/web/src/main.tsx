/** Responsive dossier UI. Never computes or submits rewards; all mutations use server snapshots. */
import React, { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Routes, Route, Link } from "react-router";
import {
  QueryClient,
  QueryClientProvider,
  useQuery,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";
import { create } from "zustand";
import { z } from "zod";
import {
  eras,
  items,
  jobs,
  masteryNames,
  xpNeeded,
  holdingCost,
  crewCost,
  regenUpgradeCost,
  eventAt,
  chronicleData,
} from "../../../packages/gamedata/src/index.ts";
import { stateSchema } from "../../../packages/engine/src/index.ts";
import { DeskIcon } from "./desk-icons.tsx";
import { deskSchema } from "../../../packages/engine/src/presentation.ts";
import type { FeatureAction } from "../../../packages/engine/src/chronicle.ts";
import {
  WelcomeBack,
  OperationDesk,
  OperationChoices,
  LedgerDesk,
  CrewDesk,
  SupplyMap,
  ThreatDesk,
  AshDesk,
  CodexDesk,
} from "./desk.tsx";
import { DeskMotion, Reveal, Rollup } from "./desk-motion.tsx";
import { DeskControls } from "./desk-controls.tsx";
import type { Action } from "../../../packages/engine/src/index.ts";
import "./style.css";
import "./desk.css";
const client = new QueryClient({
  defaultOptions: {
    queries: { retry: false, refetchOnWindowFocus: true, staleTime: 2000 },
  },
});
const useUi = create<{
  era: number;
  tab: string;
  setEra: (era: number) => void;
  setTab: (tab: string) => void;
}>((set) => ({
  era: 0,
  tab: "Operations",
  setEra: (era) => set({ era }),
  setTab: (tab) => set({ tab }),
}));
async function api(path: string, body?: unknown): Promise<unknown> {
  const response = await fetch(`/api${path}`, {
    credentials: "include",
    headers: {
      ...(body ? { "Content-Type": "application/json" } : {}),
      "X-Ages-Visible": String(!document.hidden),
    },
    ...(body ? { method: "POST", body: JSON.stringify(body) } : {}),
  });
  const result: unknown = await response.json();
  if (!response.ok)
    throw new Error(z.object({ error: z.string() }).parse(result).error);
  return result;
}
const meSchema = z.object({
  id: z.uuid(),
  name: z.string(),
  guest: z.boolean(),
  guildId: z.string().nullable(),
  state: stateSchema,
  serverTime: z.number(),
  desk: deskSchema,
});
const playerList = z.array(
  z.object({
    id: z.uuid(),
    name: z.string(),
    level: z.number(),
    guildId: z.string().nullable(),
  }),
);
const worldSchema = z.object({
  boss: z
    .object({ hp: z.number(), cycle: z.number(), resetsAt: z.string() })
    .nullable(),
  contributions: z.array(
    z.object({ damage: z.number(), claimed: z.boolean(), cycle: z.number() }),
  ),
});
function Button({
  children,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return <button {...props}>{children}</button>;
}
function Sigil() {
  return (
    <svg viewBox="0 0 80 80" aria-hidden="true">
      <path
        d="M40 6 74 68H6Z M40 26 53 56H27Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
      />
      <circle cx="40" cy="69" r="4" fill="currentColor" />
    </svg>
  );
}
function Bar({
  label,
  value,
  max,
}: {
  label: string;
  value: number;
  max: number;
}) {
  return (
    <div className="meter">
      <div>
        <span>{label}</span>
        <strong>
          <Rollup value={value} /> <small>/ {max.toLocaleString()}</small>
        </strong>
      </div>
      <progress aria-label={label} value={value} max={max} />
    </div>
  );
}
function Panel({
  title,
  children,
  eyebrow,
}: {
  title: string;
  children: React.ReactNode;
  eyebrow?: string;
}) {
  return (
    <section className="panel">
      <header>
        {eyebrow && <p className="eyebrow">{eyebrow}</p>}
        <h2>{title}</h2>
      </header>
      {children}
    </section>
  );
}
function Auth({ upgrade = false }: { upgrade?: boolean }) {
  const qc = useQueryClient();
  const [mode, setMode] = useState<"login" | "register">(
    upgrade ? "register" : "register",
  );
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const mutation = useMutation({
    mutationFn: (guest: boolean) =>
      api(
        `/auth/${guest ? "guest" : mode}`,
        guest
          ? {}
          : { email, password, ...(mode === "register" ? { name } : {}) },
      ),
    onSuccess: () => qc.invalidateQueries(),
  });
  return (
    <div className={upgrade ? "" : "auth-shell"}>
      <div className="auth-art">
        <Sigil />
        <p className="eyebrow">One world. Four ages. Your mark.</p>
        <h1>Ages of Ash</h1>
        <p>
          The Ember Line remembers every empire.
          <br />
          Build the one it cannot forget.
        </p>
        <div className="era-tags">
          {eras.map((e) => (
            <span key={e.id}>{e.name}</span>
          ))}
        </div>
      </div>
      <Panel
        title={upgrade ? "Claim your identity" : "The Ember Ledger"}
        eyebrow="Establish your syndicate"
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            mutation.mutate(false);
          }}
        >
          {mode === "register" && (
            <label>
              Operator name
              <input
                required
                minLength={2}
                maxLength={24}
                value={name}
                onChange={(e) => setName(e.target.value)}
                autoComplete="nickname"
              />
            </label>
          )}
          <label>
            Email
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
            />
          </label>
          <label>
            Password · 12+ characters
            <input
              type="password"
              minLength={12}
              maxLength={128}
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete={
                mode === "login" ? "current-password" : "new-password"
              }
            />
          </label>
          <Button disabled={mutation.isPending}>
            {mode === "login" ? "Sign in" : "Create account"}
          </Button>
        </form>
        {!upgrade && (
          <div className="button-row">
            <Button
              className="secondary"
              disabled={mutation.isPending}
              onClick={() => mutation.mutate(true)}
            >
              Enter as guest
            </Button>
            <Button
              className="text-button"
              onClick={() => setMode(mode === "login" ? "register" : "login")}
            >
              {mode === "login"
                ? "Create account instead"
                : "Already registered? Sign in"}
            </Button>
          </div>
        )}
        {mutation.error && (
          <p role="alert" className="error">
            {mutation.error.message}
          </p>
        )}
      </Panel>
    </div>
  );
}
function Game() {
  const qc = useQueryClient();
  const me = useQuery({
    queryKey: ["me"],
    queryFn: async () => meSchema.parse(await api("/me")),
    refetchInterval: 30000,
  });
  const [connected, setConnected] = useState(false);
  const [notice, setNotice] = useState("Your ledger is up to date.");
  const { era, tab, setEra, setTab } = useUi();
  const [approach, setApproach] = useState<"cautious" | "bold">("cautious");
  const [crewId, setCrewId] = useState("mara");
  useEffect(() => {
    if (!me.data) return;
    let stopped = false;
    let socket: WebSocket;
    let timer: ReturnType<typeof setTimeout>;
    const connect = () => {
      socket = new WebSocket(
        `${location.protocol === "https:" ? "wss" : "ws"}://${location.host}/live`,
      );
      socket.onopen = () => {
        setConnected(true);
        void qc.invalidateQueries();
      };
      socket.onmessage = (event) => {
        const parsed = z
          .object({ type: z.enum(["state", "world", "chat"]) })
          .safeParse(JSON.parse(String(event.data)));
        if (!parsed.success) return;
        const keys =
          parsed.data.type === "state"
            ? ["me"]
            : parsed.data.type === "chat"
              ? ["messages"]
              : ["world", "leaders", "territory"];
        for (const key of keys) void qc.invalidateQueries({ queryKey: [key] });
      };
      socket.onclose = () => {
        setConnected(false);
        if (!stopped) timer = setTimeout(connect, 3000);
      };
      socket.onerror = () => socket.close();
    };
    connect();
    return () => {
      stopped = true;
      clearTimeout(timer);
      socket.close();
    };
  }, [me.data?.id, qc]);
  const mutation = useMutation({
    mutationFn: ({ path, body }: { path: string; body: unknown }) =>
      api(path, body),
    onSuccess: (result, { path }) => {
      setNotice(
        z.object({ message: z.string().optional() }).parse(result).message ??
          "Ledger updated",
      );
      const keys =
        path === "/feature"
          ? ["me"]
          : path === "/social"
            ? ["me", "social"]
            : path === "/messages"
              ? ["me", "messages"]
              : path === "/world"
                ? ["me", "world"]
                : ["me", "players", "leaders", "bounties", "territory"];
      for (const key of keys) void qc.invalidateQueries({ queryKey: [key] });
    },
    onError: (error) => setNotice(error.message),
  });
  const send = (
    type: Action["type"],
    key?: string,
    target?: string,
    choice?: Action["choice"],
  ) =>
    mutation.mutate({
      path: "/action",
      body: { nonce: crypto.randomUUID(), type, key, target, choice },
    });
  const custom = (path: string, body: unknown) =>
    mutation.mutate({ path, body });
  const feature = (
    type: FeatureAction["type"],
    key?: string,
    extra?: { approach?: "cautious" | "bold"; crewId?: string },
  ) => custom("/feature", { nonce: crypto.randomUUID(), type, key, ...extra });
  const players = useQuery({
    queryKey: ["players"],
    queryFn: async () => playerList.parse(await api("/players")),
    enabled: !!me.data,
  });
  const world = useQuery({
    queryKey: ["world"],
    queryFn: async () => worldSchema.parse(await api("/world")),
    enabled: !!me.data,
  });
  const leaders = useQuery({
    queryKey: ["leaders"],
    queryFn: async () =>
      z
        .array(
          z.object({
            playerId: z.string(),
            name: z.string(),
            level: z.number(),
            score: z.number(),
            influence: z.number(),
          }),
        )
        .parse(await api("/leaderboard")),
    enabled: !!me.data,
  });
  const territory = useQuery({
    queryKey: ["territory"],
    queryFn: async () =>
      z
        .array(
          z.object({
            era: z.number(),
            controller: z.string(),
            influence: z.number(),
          }),
        )
        .parse(await api("/territory")),
    enabled: !!me.data,
  });
  if (me.isPending)
    return (
      <main className="loading" aria-busy="true">
        Opening the Ember Ledger…
      </main>
    );
  if (!me.data)
    return (
      <>
        <Auth />
        {me.error && me.error.message !== "Sign in to continue" && (
          <p role="alert" className="error">
            Connection: {me.error.message}. Check API and PostgreSQL.
          </p>
        )}
      </>
    );
  const p = me.data,
    s = p.state,
    cap = p.desk.caps,
    currentEra = eras[era],
    pending = mutation.isPending;
  const owned = items.filter((i) => s.inventory[i.id]?.quantity);
  return (
    <div
      className={`app cosmetic-${s.cosmetic}`}
      style={{ "--accent": currentEra.accent } as React.CSSProperties}
    >
      <aside className="rail">
        <Link to="/" className="brand">
          <Sigil />
          <span>
            AGES
            <br />
            <b>OF ASH</b>
          </span>
        </Link>
        <p className="eyebrow">The Ember Ledger</p>
        <nav aria-label="Main">
          {[
            "Operations",
            "Arsenal",
            "Crew & Holdings",
            "Conflict",
            "Territory",
            "Ledger",
            "Codex",
            "Social",
            "Account",
          ].map((t) => (
            <button
              key={t}
              className={tab === t ? "active" : ""}
              onClick={() => {
                setTab(t);
                window.scrollTo({ top: 0 });
              }}
            >
              {t}
            </button>
          ))}
        </nav>
        <div className="rail-foot">
          <span className={`dot ${connected ? "live" : ""}`} />
          {connected ? "Ember Line connected" : "Reconnecting…"}
          <Link to="/styleguide">Design archive ↗</Link>
        </div>
      </aside>
      <main>
        <WelcomeBack state={s} send={feature} pending={pending} />
        <header className="topbar">
          <div>
            <p className="eyebrow">
              {currentEra.faction} / {currentEra.region}
            </p>
            <Reveal id={tab}>
              <h1>{tab}</h1>
            </Reveal>
          </div>
          <div className="identity">
            <span>{p.name}</span>
            <strong>
              Level {s.level}{" "}
              <small>· Ash Cycle {s.chronicle.totals.cycles}</small>
            </strong>
          </div>
        </header>
        <div className="era-switch" role="group" aria-label="Era">
          {eras.map((e) => (
            <button
              key={e.id}
              className={era === e.id ? "active" : ""}
              onClick={() => setEra(e.id)}
              disabled={s.level < e.level}
            >
              {String(e.id + 1).padStart(2, "0")} · {e.name}
              {s.level < e.level ? ` · Lv ${e.level}` : ""}
            </button>
          ))}
        </div>
        <div className="resources">
          {(["energy", "stamina", "health", "nerve"] as const).map((key) => (
            <Bar
              key={key}
              label={key}
              value={s.resources[key]}
              max={cap[key]}
            />
          ))}
        </div>
        <div className="ledger-strip">
          <span>
            <b>
              <Rollup value={s.cash} />
            </b>{" "}
            crowns
          </span>
          <span>
            <b>{s.premium}</b> ember marks
          </span>
          <span>
            <b>{s.salvage}</b> salvage
          </span>
          <span>
            <b>{s.shards}</b> relic shards
          </span>
          <span>
            Power <b>{p.desk.attack}</b> / <b>{p.desk.defense}</b>
          </span>
        </div>
        <div className="notice" role="status" aria-live="polite">
          {pending ? "Sealing your action…" : notice}
        </div>
        <DeskControls era={era} notice={notice} />
        {tab === "Ledger" && (
          <LedgerDesk state={s} pending={pending} send={feature} />
        )}
        {tab === "Codex" && <CodexDesk state={s} />}
        {tab === "Operations" && (
          <>
            <OperationChoices
              state={s}
              approach={approach}
              setApproach={setApproach}
              crewId={crewId}
              setCrewId={setCrewId}
            />
            <OperationDesk
              state={s}
              serverTime={p.serverTime}
              pending={pending}
              send={feature}
            />
          </>
        )}
        {tab === "Crew & Holdings" && (
          <>
            <CrewDesk state={s} pending={pending} send={feature} />
            <SupplyMap
              state={s}
              desk={p.desk}
              pending={pending}
              send={feature}
            />
          </>
        )}
        {tab === "Conflict" && (
          <ThreatDesk
            state={s}
            serverTime={p.serverTime}
            pending={pending}
            send={feature}
          />
        )}
        {tab === "Operations" && (
          <div className="content-grid">
            <div>
              <div className="hero">
                <p className="eyebrow">
                  Chapter {era + 1} / {currentEra.name}
                </p>
                <h2>
                  Power leaves
                  <br />a paper trail.
                </h2>
                <p>
                  Secure routes. Earn loyalty. Let your name travel
                  <br />
                  further than your enemies dare.
                </p>
                <Sigil />
                <span className="stamp">ACTIVE DOSSIER</span>
              </div>
              <Panel
                title="Available operations"
                eyebrow="Orders from the line"
              >
                {jobs
                  .filter((j) => j.era === era)
                  .map((job) => {
                    const mastery = s.mastery[job.id] ?? 0;
                    return (
                      <article className="job" key={job.id}>
                        <div>
                          <span className="tag">
                            {masteryNames[Math.min(3, Math.floor(mastery / 5))]}
                          </span>
                          <h3>{job.name}</h3>
                          <p>
                            {job.xp} XP · {job.cash}+ crowns · {job.energy}{" "}
                            energy
                          </p>
                          {job.requires && (
                            <small>
                              Requires{" "}
                              {items.find((i) => i.id === job.requires)?.name};
                              previous operation 5 runs
                            </small>
                          )}
                          <progress
                            aria-label={`${job.name} mastery`}
                            value={mastery}
                            max={20}
                          />
                          <small>{mastery}/20 mastery</small>
                        </div>
                        <Button
                          disabled={
                            pending ||
                            !!s.chronicle.operation ||
                            s.resources.energy < job.energy
                          }
                          onClick={() =>
                            feature("operation-start", job.id, {
                              approach,
                              crewId,
                            })
                          }
                        >
                          Run operation
                        </Button>
                      </article>
                    );
                  })}
              </Panel>
            </div>
            <div>
              <Panel title="Your next ascent" eyebrow="Progression">
                <Bar label="Experience" value={s.xp} max={xpNeeded(s.level)} />
                <p>{s.skills} unspent skill points</p>
                <div className="skill-grid">
                  {Object.entries(s.stats).map(([key, value]) => (
                    <Button
                      className="secondary"
                      key={key}
                      disabled={pending || !s.skills}
                      onClick={() => send("skill", key)}
                    >
                      {key} {value} <b>+</b>
                    </Button>
                  ))}
                </div>
                <Button
                  className="text-button"
                  disabled={pending || !p.desk.ashEligible}
                  onClick={() => feature("ash-cycle")}
                >
                  Close Ash Cycle · mastery & age required
                </Button>
              </Panel>
              <Panel title="Daily contracts">
                <p>
                  Operation objectives: {s.missions.daily}/5 today ·{" "}
                  {s.missions.weekly}/25 this week
                </p>
                <div className="button-row">
                  <Button
                    disabled={
                      pending || s.missions.daily < 5 || s.missions.dailyClaimed
                    }
                    onClick={() => send("mission", "daily")}
                  >
                    Claim daily
                  </Button>
                  <Button
                    disabled={
                      pending ||
                      s.missions.weekly < 25 ||
                      s.missions.weeklyClaimed
                    }
                    onClick={() => send("mission", "weekly")}
                  >
                    Claim weekly
                  </Button>
                  <Button
                    className="secondary"
                    disabled={
                      pending ||
                      s.loginDay === Math.floor(me.data.serverTime / 86400000)
                    }
                    onClick={() => send("login")}
                  >
                    Claim login · streak {s.streak}
                  </Button>
                </div>
              </Panel>
              <Panel title="Weekly crew operation">
                <p>
                  {s.chronicle.weeklyOps}/{chronicleData.weekly.operations}{" "}
                  resolved operations · requires{" "}
                  {chronicleData.weekly.crewRequired} crew.
                </p>
                <Button
                  disabled={
                    pending ||
                    s.chronicle.weeklyClaimed ||
                    s.chronicle.weeklyOps < chronicleData.weekly.operations ||
                    s.crew.length < chronicleData.weekly.crewRequired
                  }
                  onClick={() => feature("weekly-crew")}
                >
                  Settle weekly crew operation
                </Button>
              </Panel>
              <Panel title={eventAt(me.data.serverTime).name}>
                <p>
                  {eventAt(me.data.serverTime).active
                    ? "Active · +20% operation crowns"
                    : "Every Saturday UTC · +20% operation crowns"}
                </p>
                <small>
                  Clocks recover every minute. Your empire keeps time while you
                  are away.
                </small>
              </Panel>
            </div>
          </div>
        )}
        {tab === "Arsenal" && (
          <div className="content-grid">
            <Panel title="Supply exchange" eyebrow="Guaranteed purchases">
              {items
                .filter((i) => i.era === era)
                .map((item) => (
                  <article className="row" key={item.id}>
                    <div>
                      <h3>{item.name}</h3>
                      <p>
                        {item.slot} · ATK {item.attack} / DEF {item.defense}
                      </p>
                      <small>
                        Craft: {5 * (era + 1)} salvage + {era} shards
                      </small>
                    </div>
                    <div className="button-row">
                      <Button
                        disabled={pending || s.cash < item.price}
                        onClick={() => send("buy", item.id)}
                      >
                        Buy · {item.price}
                      </Button>
                      <Button
                        className="secondary"
                        disabled={pending}
                        onClick={() => send("craft", item.id)}
                      >
                        Craft
                      </Button>
                    </div>
                  </article>
                ))}
            </Panel>
            <Panel title="Equipped ledger">
              {owned.map((item) => {
                const inv = s.inventory[item.id];
                return (
                  <article className="row" key={item.id}>
                    <div>
                      <h3>
                        {item.name} +{inv.upgrade}
                      </h3>
                      <p>
                        {inv.quantity} copies ·{" "}
                        {inv.equipped ? "Equipped" : "Stored"}
                      </p>
                    </div>
                    <div className="button-row">
                      <Button
                        disabled={pending}
                        onClick={() => send("equip", item.id)}
                      >
                        {inv.equipped ? "Unequip" : "Equip"}
                      </Button>
                      <Button
                        className="secondary"
                        disabled={pending}
                        onClick={() => send("upgrade", item.id)}
                      >
                        Upgrade
                      </Button>
                      <Button
                        className="text-button"
                        disabled={pending || inv.equipped}
                        onClick={() => send("salvage", item.id)}
                      >
                        Salvage one
                      </Button>
                    </div>
                  </article>
                );
              })}
              <p>
                Only your best {s.crew.length} copies per slot count in combat.
                Matching crew affinity adds up to 10% power.
              </p>
            </Panel>
          </div>
        )}
        {tab === "Crew & Holdings" && (
          <div className="content-grid">
            <Panel
              title="Loyalty is your real arsenal"
              eyebrow={`${s.crew.length} / 100 crew`}
            >
              <p>
                {s.crew.filter((e) => e === era).length} operators share this
                era's affinity.
              </p>
              <Button
                disabled={pending || s.cash < crewCost(s.crew.length)}
                onClick={() => send("recruit", String(era))}
              >
                Recruit crew · {crewCost(s.crew.length)}
              </Button>
              <h3>Resource discipline</h3>
              <p>
                Regen rank {s.regen}/10. Each rank adds one resource per minute.
              </p>
              <Button
                disabled={
                  pending || s.regen >= 10 || s.cash < regenUpgradeCost(s.regen)
                }
                onClick={() => send("regen")}
              >
                Train recovery · {regenUpgradeCost(s.regen)}
              </Button>
              <Button
                className="secondary"
                disabled={pending || s.cash < 60}
                onClick={() => send("consume")}
              >
                Use field tonic · 60 crowns / +40 HP
              </Button>
            </Panel>
            <Panel
              title={`${currentEra.region} holding`}
              eyebrow="Income without a clock-in"
            >
              {(() => {
                const h = s.holdings.find((h) => h.era === era);
                return (
                  <>
                    <h3>
                      {h
                        ? `Tier ${h.tier} counting house`
                        : "Establish a counting house"}
                    </h3>
                    <p>
                      {h
                        ? `${h.bank} crowns banked. Collect after 10% upkeep.`
                        : "Store up to 24 hours of income. Rival raids can steal 20% of the bank."}
                    </p>
                    <div className="button-row">
                      <Button
                        disabled={
                          pending ||
                          h?.tier === 10 ||
                          s.cash < holdingCost(h?.tier ?? 0, era)
                        }
                        onClick={() => send("holding", String(era))}
                      >
                        {h ? "Upgrade" : "Build holding"} ·{" "}
                        {holdingCost(h?.tier ?? 0, era)}
                      </Button>
                      <Button
                        className="secondary"
                        disabled={pending || !h?.bank}
                        onClick={() => send("collect", String(era))}
                      >
                        Collect income
                      </Button>
                    </div>
                  </>
                );
              })()}
            </Panel>
          </div>
        )}
        {tab === "Conflict" && (
          <>
            <div className="content-grid">
              <Panel
                title="Glasswrit Sentinel"
                eyebrow={`Solo encounter / Phase ${s.boss.phase + 1}`}
              >
                <Bar label="Sentinel integrity" value={s.boss.hp} max={350} />
                <p>
                  {
                    [
                      "Its guard is open. Strike now.",
                      "A crushing pulse gathers. Guard.",
                      "The core feeds on the Line. Disrupt it.",
                    ][s.boss.phase]
                  }
                </p>
                <p>
                  2 stamina per turn. Correct stance increases damage and
                  reduces incoming harm.
                </p>
                <div className="button-row">
                  {(["strike", "guard", "disrupt"] as const).map((choice) => (
                    <Button
                      key={choice}
                      disabled={
                        pending ||
                        s.resources.stamina < 2 ||
                        s.boss.availableAt > me.data.serverTime
                      }
                      onClick={() => send("boss", undefined, undefined, choice)}
                    >
                      {choice}
                    </Button>
                  ))}
                </div>
                <small>
                  {s.boss.wins} victories · reforms one hour after defeat
                </small>
              </Panel>
              <Panel
                title="Sablecoil Leviathan"
                eyebrow="Cooperative world encounter"
              >
                <Bar
                  label="World boss"
                  value={world.data?.boss?.hp ?? 0}
                  max={10000}
                />
                <p>
                  Damage contributions earn a proportional reward after defeat.
                  3 stamina and 8 health per strike.
                </p>
                <div className="button-row">
                  <Button
                    disabled={pending}
                    onClick={() =>
                      custom("/world", {
                        nonce: crypto.randomUUID(),
                        claim: false,
                      })
                    }
                  >
                    Join raid
                  </Button>
                  <Button
                    className="secondary"
                    disabled={pending}
                    onClick={() =>
                      custom("/world", {
                        nonce: crypto.randomUUID(),
                        claim: true,
                      })
                    }
                  >
                    Claim raid loot
                  </Button>
                </div>
              </Panel>
            </div>
            <Panel
              title="Rival dossiers"
              eyebrow="30-second cooldown · 5 attacks per target/day"
            >
              {players.data
                ?.filter((x) => x.id !== p.id)
                .map((target) => (
                  <article className="row" key={target.id}>
                    <div>
                      <h3>{target.name}</h3>
                      <p>Level {target.level}</p>
                    </div>
                    <div className="button-row">
                      <Button
                        disabled={pending}
                        onClick={() => send("attack", undefined, target.id)}
                      >
                        Attack
                      </Button>
                      <Button
                        className="secondary"
                        disabled={pending}
                        onClick={() => send("raid", undefined, target.id)}
                      >
                        Raid holding
                      </Button>
                      <Button
                        className="secondary"
                        disabled={pending || s.cash < 200}
                        onClick={() => send("bounty", undefined, target.id)}
                      >
                        Bounty · 200
                      </Button>
                    </div>
                  </article>
                ))}
            </Panel>
            <Bounties players={players.data ?? []} />
          </>
        )}
        {tab === "Territory" && (
          <div className="content-grid">
            <Panel title="The shared world" eyebrow={`Season ${s.season}`}>
              <div className="world-map">
                {eras.map((e) => (
                  <div
                    key={e.id}
                    className="region"
                    style={{ borderColor: e.accent }}
                  >
                    <Sigil />
                    <h3>{e.region}</h3>
                    <span>
                      {s.influence[e.id]} influence · Control:{" "}
                      {territory.data?.find(
                        (t) => t.era === e.id && t.influence > 0,
                      )?.controller ?? "Unclaimed"}
                    </span>
                    <Button
                      disabled={pending || s.level < e.level}
                      onClick={() => send("influence", String(e.id))}
                    >
                      Establish influence · 3 nerve + 25 crowns
                    </Button>
                  </div>
                ))}
              </div>
              <p>
                Influence resets every 30 days; your equipment and levels
                endure. Victories in declared order wars grant +5 influence.
              </p>
            </Panel>
            <Panel title="Operators of renown" eyebrow="Updated each minute">
              <ol className="leaders">
                {leaders.data?.map((l) => (
                  <li key={l.playerId}>
                    <b>{l.name}</b>
                    <span>
                      Lv {l.level} · {l.score} power score · {l.influence}{" "}
                      influence
                    </span>
                  </li>
                ))}
              </ol>
              {!leaders.data?.length && (
                <p>The worker is preparing the first rankings.</p>
              )}
            </Panel>
          </div>
        )}
        {tab === "Social" && (
          <Social
            me={p}
            players={players.data ?? []}
            custom={custom}
            pending={pending}
          />
        )}
        {tab === "Account" && (
          <div className="content-grid">
            {p.guest ? (
              <Auth upgrade />
            ) : (
              <Panel title="Registered operator">
                <p>
                  Your progress is bound to your email. Keep your password
                  private.
                </p>
              </Panel>
            )}
            <Panel title="A mark of your own">
              <p>
                Cosmetic themes cost 20 earned ember marks. They never change
                combat power.
              </p>
              <div className="button-row">
                {["ember", "tide", "violet"].map((c) => (
                  <Button
                    key={c}
                    disabled={pending || s.premium < 20}
                    onClick={() => send("cosmetic", c)}
                  >
                    {c}
                  </Button>
                ))}
              </div>
              <Button
                className="text-button"
                onClick={async () => {
                  await api("/auth/logout", {});
                  qc.clear();
                  location.reload();
                }}
              >
                Sign out
              </Button>
            </Panel>
          </div>
        )}
        {tab === "Operations" && (
          <AshDesk state={s} desk={p.desk} pending={pending} send={feature} />
        )}
        <footer>
          Ages of Ash · Every action leaves a record.{" "}
          <Link to="/styleguide">Styleguide</Link>
        </footer>
      </main>
    </div>
  );
}
type PublicPlayer = z.infer<typeof playerList>[number];
function Bounties({ players }: { players: PublicPlayer[] }) {
  const rows = useQuery({
    queryKey: ["bounties"],
    queryFn: async () =>
      z
        .array(
          z.object({
            id: z.string(),
            targetId: z.string(),
            amount: z.number(),
          }),
        )
        .parse(await api("/bounties")),
  });
  return (
    <Panel title="The bounty board">
      {rows.data?.length ? (
        rows.data.map((b) => (
          <p key={b.id}>
            {players.find((p) => p.id === b.targetId)?.name ??
              "Unknown operator"}{" "}
            · {b.amount} crowns escrowed
          </p>
        ))
      ) : (
        <p>No open contracts. Place a bounty from a rival dossier.</p>
      )}
    </Panel>
  );
}
function Social({
  me,
  players,
  custom,
  pending,
}: {
  me: z.infer<typeof meSchema>;
  players: PublicPlayer[];
  custom: (path: string, body: unknown) => void;
  pending: boolean;
}) {
  const [channel, setChannel] = useState("world");
  const [text, setText] = useState("");
  const [name, setName] = useState("");
  const social = useQuery({
    queryKey: ["social"],
    queryFn: async () =>
      z
        .object({
          guilds: z.array(
            z.object({ id: z.string(), name: z.string(), ownerId: z.string() }),
          ),
          wars: z.array(
            z.object({
              id: z.string(),
              attackerId: z.string(),
              defenderId: z.string(),
            }),
          ),
          relations: z.array(
            z.object({ otherId: z.string(), kind: z.string() }),
          ),
        })
        .parse(await api("/social")),
  });
  const messages = useQuery({
    queryKey: ["messages", channel],
    queryFn: async () =>
      z
        .array(
          z.object({
            id: z.string(),
            senderName: z.string(),
            body: z.string(),
            createdAt: z.string(),
          }),
        )
        .parse(await api(`/messages?channel=${encodeURIComponent(channel)}`)),
  });
  return (
    <div className="content-grid">
      <Panel title="The wire">
        <label>
          Channel
          <select value={channel} onChange={(e) => setChannel(e.target.value)}>
            <option value="world">World</option>
            {me.guildId && <option value="guild">Order</option>}
            {players
              .filter((p) => p.id !== me.id)
              .map((p) => (
                <option key={p.id} value={`mail:${p.id}`}>
                  Mail: {p.name}
                </option>
              ))}
          </select>
        </label>
        <div className="chat" aria-live="polite">
          {messages.data
            ?.slice()
            .reverse()
            .map((m) => (
              <p key={m.id}>
                <b>{m.senderName}</b>
                <span>{m.body}</span>
              </p>
            ))}
          {!messages.data?.length && (
            <p>The wire is quiet. Start a conversation.</p>
          )}
        </div>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            custom("/messages", { channel, body: text });
            setText("");
          }}
        >
          <label>
            Message
            <input
              value={text}
              onChange={(e) => setText(e.target.value)}
              maxLength={500}
              required
            />
          </label>
          <Button disabled={pending}>Send message</Button>
        </form>
      </Panel>
      <div>
        <Panel title="Orders & declarations">
          {!me.guildId && (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                custom("/social", { type: "guild-create", name });
              }}
            >
              <label>
                New order name
                <input
                  minLength={3}
                  maxLength={32}
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </label>
              <Button disabled={pending}>Found an order</Button>
            </form>
          )}
          {social.data?.guilds.map((g) => (
            <div className="row" key={g.id}>
              <b>{g.name}</b>
              {g.id === me.guildId ? (
                <span className="tag">Your order</span>
              ) : (
                <Button
                  disabled={pending}
                  onClick={() =>
                    custom(
                      "/social",
                      me.guildId
                        ? { type: "war", id: g.id }
                        : { type: "guild-join", id: g.id },
                    )
                  }
                >
                  {me.guildId ? "Declare war" : "Join"}
                </Button>
              )}
            </div>
          ))}
          <p>
            {social.data?.wars.length ?? 0} active wars; declarations last 24
            hours.
          </p>
        </Panel>
        <Panel title="Friends & rivals">
          {players
            .filter((p) => p.id !== me.id)
            .map((p) => (
              <div className="row" key={p.id}>
                <span>
                  {p.name}
                  <small>
                    {" "}
                    {
                      social.data?.relations.find((r) => r.otherId === p.id)
                        ?.kind
                    }
                  </small>
                </span>
                <div className="button-row">
                  {(["friend", "rival"] as const).map((kind) => (
                    <Button
                      className="secondary"
                      key={kind}
                      disabled={pending}
                      onClick={() =>
                        custom("/social", { type: "relation", id: p.id, kind })
                      }
                    >
                      {kind}
                    </Button>
                  ))}
                </div>
              </div>
            ))}
        </Panel>
      </div>
    </div>
  );
}
function Styleguide() {
  return (
    <main className="styleguide">
      <Link to="/">← Return to game</Link>
      <p className="eyebrow">Ages of Ash / design archive</p>
      <h1>The arcane dossier</h1>
      <DeskControls era={0} notice="" />
      <section className="panel parchment">
        <h2>Desk materials and seals</h2>
        <div className="badge-grid">
          {(["ash", "iron", "brass", "ember-glass"] as const).map(
            (material) => (
              <div
                key={material}
                className={`badge material-${material} earned`}
              >
                <DeskIcon name="seal" />
                <b>{material}</b>
              </div>
            ),
          )}
        </div>
        <div className="button-row">
          {(["ledger", "clock", "crew", "network", "ash", "seal"] as const).map(
            (name) => (
              <span key={name}>
                <DeskIcon name={name} />
                {name}
              </span>
            ),
          )}
        </div>
        <div className="resolution success">
          Operation complete · proceeds sealed
        </div>
        <div className="resolution failure">
          Operation failed · partial payment recovered
        </div>
        <div className="instrument">
          <span className="brass-clock">3s</span> Server-owned clock
        </div>
      </section>
      <div className="content-grid">
        <Panel title="Controls & states">
          <div className="button-row">
            <Button>Primary</Button>
            <Button className="secondary">Secondary</Button>
            <Button disabled>Disabled</Button>
            <Button aria-busy="true">Working…</Button>
            <Button className="text-button">Text action</Button>
          </div>
          <label>
            Text input
            <input placeholder="Operator name" />
          </label>
          <label>
            Disabled
            <input disabled value="Locked era" readOnly />
          </label>
          <label>
            Select
            <select>
              <option>Veiled Streets</option>
            </select>
          </label>
          <p className="error" role="alert">
            Insufficient energy. Recover and retry.
          </p>
          <div className="notice" role="status">
            Route secured. Reward recorded.
          </div>
          <span className="tag">Gold mastery</span>
        </Panel>
        <Panel title="Resource states">
          <Bar label="Full" value={30} max={30} />
          <Bar label="Partial" value={12} max={30} />
          <Bar label="Empty" value={0} max={30} />
          <p className="loading" aria-busy="true">
            Loading ledger…
          </p>
          <p>No open contracts.</p>
          <Sigil />
        </Panel>
        <Panel title="Palette & type">
          {eras.map((e) => (
            <p key={e.id} style={{ color: e.accent }}>
              {e.name} · {e.accent}
            </p>
          ))}
          <h1>Display / empire</h1>
          <h2>Section / ledger</h2>
          <h3>Record / operation</h3>
          <p>Body / a clear account of the world.</p>
          <small>Metadata / timestamps and costs.</small>
        </Panel>
        <Panel title="Record composition">
          <article className="job">
            <div>
              <span className="tag">Bronze</span>
              <h3>Secure the Cinder Route</h3>
              <p>18 XP · 45 crowns · 4 energy</p>
            </div>
            <Button>Run operation</Button>
          </article>
          <div className="row">
            <b>Orren of the Quay</b>
            <span>Level 1</span>
          </div>
        </Panel>
      </div>
    </main>
  );
}
createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <QueryClientProvider client={client}>
      <DeskMotion>
        <BrowserRouter>
          <Routes>
            <Route path="/styleguide" element={<Styleguide />} />
            <Route path="*" element={<Game />} />
          </Routes>
        </BrowserRouter>
      </DeskMotion>
    </QueryClientProvider>
  </React.StrictMode>,
);
if ("serviceWorker" in navigator && import.meta.env.PROD)
  void navigator.serviceWorker.register("/sw.js");
