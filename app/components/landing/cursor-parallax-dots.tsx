import { useEffect, useMemo, useRef } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";

const PARTICLE_COUNT = 1200;
const SPREAD = 12;

type MousePosition = { x: number; y: number };

function ParticleField() {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const particles = useMemo(() => {
    const data = new Float32Array(PARTICLE_COUNT * 6);

    for (let index = 0; index < PARTICLE_COUNT; index++) {
      const offset = index * 6;
      data[offset] = (Math.random() - 0.5) * SPREAD;
      data[offset + 1] = (Math.random() - 0.5) * SPREAD;
      data[offset + 2] = (Math.random() - 0.5) * SPREAD * 0.6;
      data[offset + 3] = 0.2 + Math.random() * 0.5;
      data[offset + 4] = Math.random() * Math.PI * 2;
      data[offset + 5] = 0.003 + Math.random() * 0.01;
    }

    return data;
  }, []);

  useFrame(({ clock }) => {
    const mesh = meshRef.current;
    if (!mesh) return;

    const time = clock.getElapsedTime() * 0.3;

    for (let index = 0; index < PARTICLE_COUNT; index++) {
      const offset = index * 6;
      const speed = particles[offset + 3];
      const phase = particles[offset + 4];
      const scale = particles[offset + 5];

      dummy.position.set(
        particles[offset] + Math.sin(time * speed + phase) * 0.3,
        particles[offset + 1] + Math.cos(time * speed * 0.7 + phase) * 0.25,
        particles[offset + 2] +
          Math.sin(time * speed * 0.5 + phase * 2) * 0.15
      );
      dummy.scale.setScalar(scale);
      dummy.updateMatrix();
      mesh.setMatrixAt(index, dummy.matrix);
    }

    mesh.instanceMatrix.needsUpdate = true;
  });

  return (
    <instancedMesh
      ref={meshRef}
      args={[undefined, undefined, PARTICLE_COUNT]}
      frustumCulled={false}
    >
      <sphereGeometry args={[1, 6, 6]} />
      <meshBasicMaterial
        color="#c0c1ff"
        transparent
        opacity={0.28}
        depthWrite={false}
      />
    </instancedMesh>
  );
}

function CameraRig({ mousePosition }: { mousePosition: React.RefObject<MousePosition> }) {
  const { camera } = useThree();
  const target = useRef(new THREE.Vector3(0, 0, 5));

  useFrame(() => {
    const { x, y } = mousePosition.current;

    target.current.x = THREE.MathUtils.lerp(target.current.x, x * 1.2, 0.08);
    target.current.y = THREE.MathUtils.lerp(target.current.y, y * 0.8, 0.08);
    camera.position.x = THREE.MathUtils.lerp(
      camera.position.x,
      target.current.x,
      0.12
    );
    camera.position.y = THREE.MathUtils.lerp(
      camera.position.y,
      target.current.y,
      0.12
    );
    camera.lookAt(0, 0, 0);
  });

  return null;
}

export function CursorParallaxDots() {
  const containerRef = useRef<HTMLDivElement>(null);
  const mousePosition = useRef<MousePosition>({ x: 0, y: 0 });

  useEffect(() => {
    const container = containerRef.current;
    const host = container?.parentElement;
    if (!host) return;

    const handlePointerMove = (event: PointerEvent) => {
      const rect = host.getBoundingClientRect();
      mousePosition.current.x =
        ((event.clientX - rect.left) / Math.max(rect.width, 1) - 0.5) * 2;
      mousePosition.current.y =
        -((event.clientY - rect.top) / Math.max(rect.height, 1) - 0.5) * 2;
    };

    const resetPointer = () => {
      mousePosition.current.x = 0;
      mousePosition.current.y = 0;
    };

    host.addEventListener("pointermove", handlePointerMove, { passive: true });
    host.addEventListener("pointerleave", resetPointer);

    return () => {
      host.removeEventListener("pointermove", handlePointerMove);
      host.removeEventListener("pointerleave", resetPointer);
    };
  }, []);

  const reducedMotion =
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  return (
    <div
      ref={containerRef}
      className="pointer-events-none absolute inset-0 hidden md:block"
      aria-hidden="true"
    >
      <Canvas
        camera={{ position: [0, 0, 5], fov: 60 }}
        dpr={[1, 1.5]}
        frameloop={reducedMotion ? "demand" : "always"}
        gl={{
          antialias: false,
          alpha: true,
          powerPreference: "high-performance",
        }}
      >
        <fog attach="fog" args={["#131315", 3, 12]} />
        <ParticleField />
        {!reducedMotion && <CameraRig mousePosition={mousePosition} />}
      </Canvas>
    </div>
  );
}
