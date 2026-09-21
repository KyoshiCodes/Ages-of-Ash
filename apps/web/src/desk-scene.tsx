/** Optional on-demand 3D inspection. No gameplay state or reward calculation belongs here. */
import { useEffect, useRef, useState } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import type { Group } from "three";
import { useDeskPreferences } from "./desk-preferences.ts";
import { chronicleData as data } from "../../../packages/gamedata/src/index.ts";
function Objects({
  mode,
  holdings,
  material,
  rotation,
  spin,
}: {
  mode: "map" | "relic";
  holdings: number[];
  material: number;
  rotation: number;
  spin: boolean;
}) {
  const speed = useDeskPreferences((s) => s.speed);
  const group = useRef<Group>(null),
    visible = useRef(!document.hidden),
    { invalidate } = useThree();
  useEffect(() => {
    const change = () => {
      visible.current = !document.hidden;
      if (visible.current) invalidate();
    };
    document.addEventListener("visibilitychange", change);
    return () => document.removeEventListener("visibilitychange", change);
  }, [invalidate]);
  useEffect(() => {
    invalidate();
  }, [rotation, spin, invalidate]);
  useFrame((_state, delta) => {
    if (!group.current || !visible.current) return;
    if (spin) {
      group.current.rotation.y += Math.min(delta, 0.04) * 0.22 * speed;
      invalidate();
    } else {
      const remaining = rotation - group.current.rotation.y;
      group.current.rotation.y += remaining * 0.16;
      if (Math.abs(remaining) > 0.002) invalidate();
    }
  });
  const colors = ["#6d706b", "#818c91", "#b69861", "#eb944d"];
  return (
    <group ref={group}>
      {mode === "map" ? (
        <>
          {data.holdings.map((h) => (
            <mesh
              key={h.id}
              position={[
                (h.x - 1) * 1.8,
                holdings.includes(h.era) ? 0.2 : 0,
                (h.y - 0.5) * 1.8,
              ]}
            >
              <boxGeometry
                args={[0.85, holdings.includes(h.era) ? 0.65 : 0.15, 0.85]}
              />
              <meshStandardMaterial
                color={holdings.includes(h.era) ? "#b69861" : "#36463e"}
                roughness={0.65}
              />
            </mesh>
          ))}
          <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.2, 0]}>
            <planeGeometry args={[6, 4]} />
            <meshStandardMaterial color="#19251f" />
          </mesh>
        </>
      ) : (
        <>
          <mesh>
            <icosahedronGeometry args={[1.2, 1]} />
            <meshStandardMaterial
              color={colors[Math.min(3, material)]}
              metalness={0.7}
              roughness={0.25}
            />
          </mesh>
          <mesh rotation={[Math.PI / 2, 0, 0]}>
            <torusGeometry args={[1.7, 0.045, 8, 48]} />
            <meshStandardMaterial color="#b69861" />
          </mesh>
        </>
      )}
      {Array.from({ length: 8 }, (_, i) => (
        <mesh
          key={i}
          position={[
            Math.sin(i * 2.4) * 3,
            Math.cos(i * 1.7) * 1.8 - 1,
            -2 - i * 0.1,
          ]}
        >
          <sphereGeometry args={[0.018 + (i % 3) * 0.008, 6, 4]} />
          <meshBasicMaterial
            color="#eb944d"
            transparent
            opacity={0.25 + (i % 3) * 0.15}
          />
        </mesh>
      ))}
      <mesh position={[0, 0, -4]}>
        <planeGeometry args={[10, 6]} />
        <meshBasicMaterial color="#426354" transparent opacity={0.08} />
      </mesh>
    </group>
  );
}
export default function DeskScene({
  mode,
  holdings,
  material,
}: {
  mode: "map" | "relic";
  holdings: number[];
  material: number;
}) {
  const [rotation, setRotation] = useState(0.4),
    [spin, setSpin] = useState(false);
  return (
    <div className="inspection">
      <div className="inspection-canvas">
        <Canvas
          frameloop="demand"
          dpr={[1, 1.5]}
          camera={{ position: mode === "map" ? [4, 5, 6] : [0, 1, 5], fov: 42 }}
          gl={{ antialias: false, powerPreference: "low-power" }}
          fallback={<p>WebGL unavailable. Use the 2D map above.</p>}
        >
          <ambientLight intensity={1.2} />
          <directionalLight position={[3, 5, 4]} intensity={2} />
          <Objects
            mode={mode}
            holdings={holdings}
            material={material}
            rotation={rotation}
            spin={spin}
          />
        </Canvas>
      </div>
      <label>
        Inspection angle
        <input
          type="range"
          min={-3.14}
          max={3.14}
          step={0.05}
          value={rotation}
          onChange={(e) => {
            setSpin(false);
            setRotation(Number(e.target.value));
          }}
        />
      </label>
      <button className="secondary" onClick={() => setSpin(!spin)}>
        {spin ? "Pause inspection" : "Rotate inspection"}
      </button>
      <small>Optional geometry · no gameplay is hidden here.</small>
    </div>
  );
}
