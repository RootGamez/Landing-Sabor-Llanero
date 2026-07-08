"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/**
 * La carta vivía en el anchor /#menu de la landing y hoy está en /menu/.
 * Con export estático no hay 301 de servidor, así que los backlinks y
 * marcadores viejos se redirigen client-side al montar la home.
 */
export default function LegacyMenuRedirect() {
  const router = useRouter();

  useEffect(() => {
    if (window.location.hash === "#menu") {
      router.replace("/menu/");
    }
  }, [router]);

  return null;
}
