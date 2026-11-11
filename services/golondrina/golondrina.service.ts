import { apiFetch } from "@/services/api-client";
import type { AccionId, CanalId } from "@/lib/golondrina";

/* Golondrina contra pf-back (`/golondrina/me/...`, ver
   pf-back/docs/GOLONDRINA.md). Es el único archivo que conoce el mock:
   NEXT_PUBLIC_GOLONDRINA_SOURCE=mock simula el back en memoria para trabajar
   la UI sin servidor. **Nunca en producción.** En modo API, un back que no
   tiene el módulo responde 404 y el panel lo dice; no cae al mock solo. */

export interface Automatizacion {
  id: string;
  lessonId: string;
  action: AccionId;
  channel: CanalId;
  status: "active" | "done" | "cancelled";
  nextRunAt: string | null;
  runsLeft: number;
  runsDone: number;
  lastSentAt: string | null;
  /** Sólo al crear: por dónde salió de verdad (el back pasa push → campanita si no hay celular). */
  deliveredVia?: CanalId | null;
}

export type CanalesDisponibles = Record<CanalId, boolean>;

const MOCK = process.env.NEXT_PUBLIC_GOLONDRINA_SOURCE === "mock";

export function getCanales(signal?: AbortSignal): Promise<CanalesDisponibles> {
  if (MOCK) return mock.canales();
  return apiFetch<CanalesDisponibles>("/golondrina/me/channels", { auth: true, signal });
}

export function listAutomatizaciones(lessonId: string, signal?: AbortSignal): Promise<Automatizacion[]> {
  if (MOCK) return mock.listar(lessonId);
  return apiFetch<Automatizacion[]>("/golondrina/me/automations", { auth: true, query: { lessonId }, signal });
}

export function activar(lessonId: string, action: AccionId, channel: CanalId): Promise<Automatizacion> {
  if (MOCK) return mock.activar(lessonId, action, channel);
  return apiFetch<Automatizacion>("/golondrina/me/automations", {
    method: "POST",
    auth: true,
    body: { lessonId, action, channel },
  });
}

export function cambiarCanal(id: string, channel: CanalId): Promise<Automatizacion> {
  if (MOCK) return mock.cambiarCanal(id, channel);
  return apiFetch<Automatizacion>(`/golondrina/me/automations/${encodeURIComponent(id)}`, {
    method: "PATCH",
    auth: true,
    body: { channel },
  });
}

export function apagar(id: string): Promise<void> {
  if (MOCK) return mock.apagar(id);
  return apiFetch<void>(`/golondrina/me/automations/${encodeURIComponent(id)}`, { method: "DELETE", auth: true });
}

// ---------------------------------------------------------------------------
// Mock (NEXT_PUBLIC_GOLONDRINA_SOURCE=mock): mismo contrato, en memoria.
// ---------------------------------------------------------------------------

const mock = (() => {
  const filas = new Map<string, Automatizacion>();
  let n = 0;
  const manana = (h: number, m = 0) => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    d.setHours(h, m, 0, 0);
    return d.toISOString();
  };
  return {
    async canales(): Promise<CanalesDisponibles> {
      return { push: false, email: true, in_app: true };
    },
    async listar(lessonId: string) {
      return [...filas.values()].filter((f) => f.lessonId === lessonId && f.status !== "cancelled");
    },
    async activar(lessonId: string, action: AccionId, channel: CanalId) {
      const previa = [...filas.values()].find((f) => f.lessonId === lessonId && f.action === action);
      const id = previa?.id ?? `mock-${++n}`;
      const base: Automatizacion = {
        id, lessonId, action, channel, status: "active", runsDone: 0, lastSentAt: null,
        nextRunAt: action === "recordar" ? manana(19) : action === "plan" ? manana(18, 45) : null,
        runsLeft: action === "plan" ? 3 : action === "docente" ? 0 : 1,
      };
      if (action === "resumen") {
        Object.assign(base, { status: "done", runsLeft: 0, runsDone: 1, lastSentAt: new Date().toISOString(), deliveredVia: channel === "push" ? "in_app" : channel });
      }
      filas.set(id, base);
      return base;
    },
    async cambiarCanal(id: string, channel: CanalId) {
      const fila = filas.get(id);
      if (!fila) throw new Error("Automatización no encontrada.");
      fila.channel = channel;
      return fila;
    },
    async apagar(id: string) {
      const fila = filas.get(id);
      if (fila) fila.status = "cancelled";
    },
  };
})();
