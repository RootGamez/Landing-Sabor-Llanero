"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";

/**
 * Visor 3D del modelo real de pizza (Three.js + GLB).
 *
 * - Carga PEREZOSA: Three.js (~150 KB gzip) y el modelo solo se
 *   descargan cuando la sección entra al viewport.
 * - Arrastra (mouse/touch) para girarla, con inercia y fricción.
 * - Luces cálidas tipo horno + luz de borde roja de marca.
 * - Si el modelo no existe o falla, muestra la foto real como fallback.
 *
 * Modelo: "Pepperoni pizza" — Poly by Google (CC-BY 3.0).
 * Descárgalo de https://poly.pizza/m/9IWGn64Fnqo y guárdalo en
 * /public/models/pizza.glb
 */
type Status = "idle" | "loading" | "ready" | "error";

export default function PizzaModelViewer() {
  const mountRef = useRef<HTMLDivElement>(null);
  const [status, setStatus] = useState<Status>("idle");

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    let cancelled = false;
    let dispose: (() => void) | undefined;

    const start = async (): Promise<void> => {
      setStatus("loading");
      try {
        // Imports dinámicos: no pesan en el bundle inicial
        const THREE = await import("three");
        const { GLTFLoader } = await import("three/addons/loaders/GLTFLoader.js");
        if (cancelled) return;

        const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

        /* Renderer */
        const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        renderer.setSize(mount.clientWidth, mount.clientHeight);
        renderer.toneMapping = THREE.ACESFilmicToneMapping;
        renderer.toneMappingExposure = 1.15;

        /* Escena y cámara */
        const scene = new THREE.Scene();
        const camera = new THREE.PerspectiveCamera(
          36,
          mount.clientWidth / mount.clientHeight,
          0.1,
          100,
        );
        camera.position.set(0, 1.55, 3.4);
        camera.lookAt(0, 0, 0);

        /* Iluminación cálida tipo horno de leña */
        scene.add(new THREE.HemisphereLight(0xfff3d6, 0x3a2415, 1.15));
        const key = new THREE.DirectionalLight(0xffe2a8, 2.4);
        key.position.set(3, 4, 2);
        scene.add(key);
        const rim = new THREE.DirectionalLight(0xcf142b, 0.9); // borde rojo de marca
        rim.position.set(-3, 1.5, -2.5);
        scene.add(rim);
        const fill = new THREE.PointLight(0xffce00, 0.6, 10); // dorado
        fill.position.set(0, -1.5, 2);
        scene.add(fill);

        /* Modelo */
        const group = new THREE.Group();
        scene.add(group);
        const gltf = await new GLTFLoader().loadAsync("/models/pizza.glb");
        if (cancelled) {
          renderer.dispose();
          return;
        }
        const model = gltf.scene;

        // Centrar y escalar el modelo a un tamaño conocido
        const box = new THREE.Box3().setFromObject(model);
        const size = box.getSize(new THREE.Vector3());
        const center = box.getCenter(new THREE.Vector3());
        model.position.sub(center);
        const scale = 2.6 / Math.max(size.x, size.z);
        group.scale.setScalar(scale);
        group.add(model);
        group.rotation.x = 0.12; // leve inclinación hacia la cámara

        mount.appendChild(renderer.domElement);
        setStatus("ready");

        /* Física de giro: arrastre con inercia */
        let spinVel = reduced ? 0 : 0.004;
        let dragging = false;
        let lastX = 0;
        let targetTiltX = 0.12;

        const onPointerDown = (e: PointerEvent): void => {
          dragging = true;
          lastX = e.clientX;
          mount.style.cursor = "grabbing";
        };
        const onPointerMove = (e: PointerEvent): void => {
          const rect = mount.getBoundingClientRect();
          const my = (e.clientY - rect.top) / rect.height;
          targetTiltX = 0.12 + (my - 0.5) * 0.35;
          if (dragging) {
            spinVel = (e.clientX - lastX) * 0.004;
            lastX = e.clientX;
          }
        };
        const endDrag = (): void => {
          dragging = false;
          mount.style.cursor = "grab";
        };

        mount.addEventListener("pointerdown", onPointerDown);
        mount.addEventListener("pointermove", onPointerMove);
        mount.addEventListener("pointerup", endDrag);
        mount.addEventListener("pointercancel", endDrag);
        mount.addEventListener("pointerleave", endDrag);

        /* Bucle de animación */
        renderer.setAnimationLoop(() => {
          if (!dragging && !reduced) {
            spinVel *= 0.97;
            if (Math.abs(spinVel) < 0.004) spinVel = spinVel < 0 ? -0.004 : 0.004;
          }
          group.rotation.y += spinVel;
          group.rotation.x += (targetTiltX - group.rotation.x) * 0.06;
          renderer.render(scene, camera);
        });

        /* Responsive */
        const onResize = (): void => {
          const w = mount.clientWidth;
          const h = mount.clientHeight;
          camera.aspect = w / h;
          camera.updateProjectionMatrix();
          renderer.setSize(w, h);
        };
        const ro = new ResizeObserver(onResize);
        ro.observe(mount);

        dispose = () => {
          ro.disconnect();
          renderer.setAnimationLoop(null);
          mount.removeEventListener("pointerdown", onPointerDown);
          mount.removeEventListener("pointermove", onPointerMove);
          mount.removeEventListener("pointerup", endDrag);
          mount.removeEventListener("pointercancel", endDrag);
          mount.removeEventListener("pointerleave", endDrag);
          renderer.dispose();
          if (renderer.domElement.parentNode === mount) {
            mount.removeChild(renderer.domElement);
          }
        };
      } catch {
        if (!cancelled) setStatus("error");
      }
    };

    // Solo inicializa cuando la sección es visible
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          io.disconnect();
          void start();
        }
      },
      { rootMargin: "200px" },
    );
    io.observe(mount);

    return () => {
      cancelled = true;
      io.disconnect();
      dispose?.();
    };
  }, []);

  return (
    <div
      ref={mountRef}
      className="relative aspect-square w-full cursor-grab touch-pan-y select-none"
      role="img"
      aria-label="Modelo 3D de pizza: arrástralo para girarlo"
    >
      {/* Cargando: aro girando */}
      {status === "loading" && (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="h-16 w-16 animate-spin rounded-full border-4 border-brand-yellow/30 border-t-brand-yellow" />
        </div>
      )}

      {/* Fallback si el modelo no está disponible: foto real */}
      {status === "error" && (
        <div className="absolute inset-[8%] overflow-hidden rounded-full ring-4 ring-[#b57a26] shadow-[0_0_60px_rgba(255,206,0,0.15)]">
          <Image
            src="/images/builder/etapa-5.png"
            alt="Pizza artesanal recién horneada"
            fill
            sizes="(max-width: 768px) 90vw, 450px"
            className="scale-[1.45] object-cover"
          />
        </div>
      )}
    </div>
  );
}
