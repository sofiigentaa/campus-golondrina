"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Bell, BellRing, CalendarDays, Check, Clock, FileText, Loader2, Mail, MessageSquareReply, Smartphone, X } from "lucide-react";

import GolondrinaLogo from "@/components/golondrina/GolondrinaLogo";
import { ACCIONES, CANALES, cuandoSale, nombreCanal, textoAviso, type AccionId, type CanalId } from "@/lib/golondrina";
import { ApiError } from "@/services/api-client";
import {
  activar,
  apagar,
  cambiarCanal,
  getCanales,
  listAutomatizaciones,
  type Automatizacion,
  type CanalesDisponibles,
} from "@/services/golondrina/golondrina.service";
import { isPushSupported, registerPush } from "@/services/push/push.service";

/* Vista "Golondrina" del drawer del tutor. Cuatro acciones de un clic que
   Golondrina (pf-back) guarda y manda de verdad por el canal elegido:
   celular (push), mail o campanita.

   El drawer monta este panel con `key={lessonId}`: cambiar de lección lo
   reinicia y vuelve a pedir las automatizaciones de esa lección. */

const ICONO_ACCION: Record<AccionId, React.ElementType> = {
  recordar: BellRing,
  plan: CalendarDays,
  resumen: FileText,
  docente: MessageSquareReply,
};

const ICONO_CANAL: Record<CanalId, React.ElementType> = {
  push: Smartphone,
  email: Mail,
  in_app: Bell,
};

type Carga =
  | { estado: "cargando" }
  | { estado: "listo" }
  | { estado: "sin-servidor" }
  | { estado: "error"; mensaje: string };

function mensajeDeError(error: unknown): string {
  if (error instanceof ApiError && error.status === 403) return "No tenés acceso a esta lección.";
  if (error instanceof ApiError && error.isNetworkError) return "No hay conexión con Campus. Probá de nuevo en un rato.";
  return error instanceof Error ? error.message : "No se pudo completar. Probá de nuevo.";
}

export default function GolondrinaPanel({ lessonId, lessonTitle }: { lessonId: string; lessonTitle: string }) {
  const [carga, setCarga] = useState<Carga>({ estado: "cargando" });
  const [canales, setCanales] = useState<CanalesDisponibles>({ push: false, email: true, in_app: true });
  const [canal, setCanal] = useState<CanalId>("in_app");
  const [filas, setFilas] = useState<Automatizacion[]>([]);
  const [ocupada, setOcupada] = useState<AccionId | "canal" | null>(null);
  const [aviso, setAviso] = useState<Automatizacion | null>(null);
  const [error, setError] = useState<string | null>(null);
  const timer = useRef<number | null>(null);

  useEffect(() => () => {
    if (timer.current) window.clearTimeout(timer.current);
  }, []);

  // Al abrir: canales disponibles y lo que ya activó en esta lección.
  useEffect(() => {
    const abort = new AbortController();
    (async () => {
      try {
        const [disponibles, existentes] = await Promise.all([
          getCanales(abort.signal),
          listAutomatizaciones(lessonId, abort.signal),
        ]);
        setCanales(disponibles);
        setFilas(existentes);
        const activa = existentes.find((f) => f.status === "active");
        setCanal(activa?.channel ?? (disponibles.push ? "push" : "in_app"));
        setCarga({ estado: "listo" });
      } catch (caught) {
        if (abort.signal.aborted) return;
        if (caught instanceof ApiError && caught.status === 404) setCarga({ estado: "sin-servidor" });
        else setCarga({ estado: "error", mensaje: mensajeDeError(caught) });
      }
    })();
    return () => abort.abort();
  }, [lessonId]);

  const mostrarAviso = useCallback((fila: Automatizacion) => {
    setAviso(null);
    if (timer.current) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setAviso(fila), 500);
  }, []);

  async function tocar(accion: AccionId) {
    setOcupada(accion);
    setError(null);
    try {
      const fila = await activar(lessonId, accion, canal);
      setFilas((prev) => [fila, ...prev.filter((f) => f.id !== fila.id && f.action !== accion)]);
      mostrarAviso(fila);
    } catch (caught) {
      setError(mensajeDeError(caught));
    } finally {
      setOcupada(null);
    }
  }

  async function quitar(fila: Automatizacion) {
    setError(null);
    try {
      await apagar(fila.id);
      setFilas((prev) => prev.filter((f) => f.id !== fila.id));
      if (aviso?.id === fila.id) setAviso(null);
    } catch (caught) {
      setError(mensajeDeError(caught));
    }
  }

  // Elegir canal lo aplica a lo que ya está activo en esta lección.
  async function elegirCanal(nuevo: CanalId) {
    if (nuevo === canal) return;
    setOcupada("canal");
    setError(null);
    try {
      if (nuevo === "push" && !canales.push) {
        const ok = await registerPush();
        if (!ok) {
          setError("El navegador no dio permiso para las notificaciones. Podés usar el mail o la campanita.");
          return;
        }
        setCanales((prev) => ({ ...prev, push: true }));
      }
      const activas = filas.filter((f) => f.status === "active");
      const actualizadas = await Promise.all(activas.map((f) => cambiarCanal(f.id, nuevo)));
      setFilas((prev) => prev.map((f) => actualizadas.find((a) => a.id === f.id) ?? f));
      setCanal(nuevo);
    } catch (caught) {
      setError(mensajeDeError(caught));
    } finally {
      setOcupada(null);
    }
  }

  if (carga.estado === "cargando") {
    return (
      <div className="flex flex-1 items-center justify-center gap-2">
        <Loader2 className="text-primary size-5 animate-spin" aria-hidden />
        <span className="text-text-muted text-sm">Cargando Golondrina…</span>
      </div>
    );
  }

  if (carga.estado !== "listo") {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-3 px-6 text-center">
        <GolondrinaLogo className="h-12 w-11" />
        <p className="text-text text-sm font-medium">
          {carga.estado === "sin-servidor" ? "Golondrina todavía no está activa en Campus" : "No pudimos cargar Golondrina"}
        </p>
        <p className="text-text-secondary text-sm">
          {carga.estado === "sin-servidor"
            ? "Cuando el servidor tenga el módulo, desde acá vas a poder pedir recordatorios y resúmenes."
            : carga.mensaje}
        </p>
      </div>
    );
  }

  const porAccion = new Map(filas.filter((f) => f.status !== "cancelled").map((f) => [f.action, f]));
  const visibles = filas.filter((f) => f.status === "active" || (f.status === "done" && f.action === "resumen"));

  return (
    <div className="flex-1 space-y-5 overflow-y-auto px-4 py-4">
      <div className="flex items-start gap-3">
        <GolondrinaLogo className="h-10 w-9 shrink-0" />
        <div className="min-w-0">
          <p className="text-text text-sm font-medium">Golondrina se encarga</p>
          <p className="text-text-secondary text-xs">
            Tocá una acción y te aviso por {nombreCanal(canal).toLowerCase()}. Sobre:{" "}
            <span className="text-text font-medium">{lessonTitle}</span>
          </p>
        </div>
      </div>

      {/* 1. Acciones de un clic */}
      <section aria-labelledby="golondrina-acciones">
        <h3 id="golondrina-acciones" className="text-text-muted mb-2 text-xs font-medium uppercase tracking-wide">
          Acciones de esta lección
        </h3>
        <ul className="grid grid-cols-2 gap-2">
          {ACCIONES.map(({ id, titulo, bajada }) => {
            const Icono = ICONO_ACCION[id];
            const activa = porAccion.has(id);
            return (
              <li key={id}>
                <button
                  type="button"
                  onClick={() => void tocar(id)}
                  disabled={ocupada !== null}
                  aria-pressed={activa}
                  className={`flex h-full w-full cursor-pointer flex-col items-start gap-1.5 rounded-xl border p-3 text-left transition-colors duration-150 disabled:cursor-wait ${
                    activa
                      ? "border-primary bg-primary/10"
                      : "border-border bg-surface-elevated hover:border-primary hover:bg-primary/5"
                  }`}
                >
                  <span className="flex w-full items-center justify-between">
                    <Icono className="text-primary size-4" aria-hidden />
                    {ocupada === id ? (
                      <Loader2 className="text-primary size-4 animate-spin" aria-label="Guardando" />
                    ) : (
                      activa && <Check className="text-primary size-4" aria-label="Activada" />
                    )}
                  </span>
                  <span className="text-text text-sm font-medium leading-snug">{titulo}</span>
                  <span className="text-text-muted text-xs leading-snug">{bajada}</span>
                </button>
              </li>
            );
          })}
        </ul>
      </section>

      {error && (
        <p role="alert" className="text-danger text-xs">
          {error}
        </p>
      )}

      {/* 2. Cómo le llega + lo que Golondrina va a hacer */}
      {visibles.length > 0 && (
        <section aria-labelledby="golondrina-resultados" aria-live="polite">
          {aviso && (
            <div className="mb-3">
              <p className="text-text-muted mb-1.5 text-xs">
                {aviso.action === "resumen"
                  ? `Te llegó por ${nombreCanal(aviso.deliveredVia ?? aviso.channel).toLowerCase()}:`
                  : `Así te va a llegar por ${nombreCanal(aviso.channel).toLowerCase()}:`}
              </p>
              <div className="golondrina-aviso flex items-start gap-3 rounded-2xl bg-white p-3 text-slate-900 shadow-lg ring-1 ring-black/5">
                <GolondrinaLogo className="h-9 w-8 shrink-0" />
                <div className="min-w-0">
                  <p className="flex items-center justify-between gap-2 text-xs font-semibold text-slate-500">
                    <span>Campus · {textoAviso(aviso.action, lessonTitle, aviso.runsDone).titulo}</span>
                    <span>{aviso.nextRunAt ? cuandoSale(aviso.nextRunAt) : "ahora"}</span>
                  </p>
                  <p className="text-sm leading-snug">{textoAviso(aviso.action, lessonTitle, aviso.runsDone).cuerpo}</p>
                </div>
              </div>
              {aviso.action === "resumen" && aviso.deliveredVia && aviso.deliveredVia !== aviso.channel && (
                <p className="text-text-muted mt-1.5 text-xs">
                  No hay notificaciones activas en este dispositivo: lo mandé a la campanita.
                </p>
              )}
            </div>
          )}

          <h3 id="golondrina-resultados" className="text-text-muted mb-2 text-xs font-medium uppercase tracking-wide">
            Lo que voy a hacer
          </h3>
          <ul className="space-y-2">
            {visibles.map((f) => {
              const accion = ACCIONES.find((a) => a.id === f.action)!;
              const cuando =
                f.status === "done"
                  ? `Enviado por ${nombreCanal(f.deliveredVia ?? f.channel).toLowerCase()}`
                  : f.nextRunAt
                    ? cuandoSale(f.nextRunAt)
                    : "Apenas conteste";
              return (
                <li key={f.id} className="border-border bg-surface-elevated rounded-xl border p-3">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-text text-sm font-medium">{accion.regla(lessonTitle)}</p>
                    {f.status === "active" && (
                      <button
                        type="button"
                        onClick={() => void quitar(f)}
                        aria-label={`Apagar: ${accion.regla(lessonTitle)}`}
                        className="text-text-muted hover:text-text -m-1 shrink-0 cursor-pointer rounded p-1"
                      >
                        <X className="size-3.5" aria-hidden />
                      </button>
                    )}
                  </div>
                  <p className="text-primary mt-1 flex items-center gap-1.5 text-xs font-medium">
                    <Clock className="size-3.5" aria-hidden /> {cuando}
                  </p>
                  <ul className="text-text-secondary mt-1.5 space-y-0.5 text-xs">
                    {accion.detalle.map((d) => (
                      <li key={d}>{d}</li>
                    ))}
                  </ul>
                  {f.status === "active" && (
                    <p className="bg-success-subtle text-success-text mt-2 inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-medium">
                      <Check className="size-3.5" aria-hidden /> Activado · por {nombreCanal(f.channel).toLowerCase()}
                    </p>
                  )}
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {/* 3. Canal */}
      <section aria-labelledby="golondrina-canales">
        <h3 id="golondrina-canales" className="text-text-muted mb-2 text-xs font-medium uppercase tracking-wide">
          ¿Dónde te aviso?
        </h3>
        <div role="radiogroup" aria-labelledby="golondrina-canales" className="space-y-2">
          {CANALES.map(({ id, nombre, que }) => {
            const Icono = ICONO_CANAL[id];
            const elegido = canal === id;
            const pedirPermiso = id === "push" && !canales.push;
            const noSoportado = id === "push" && !isPushSupported();
            return (
              <button
                key={id}
                type="button"
                role="radio"
                aria-checked={elegido}
                disabled={ocupada !== null || noSoportado}
                onClick={() => void elegirCanal(id)}
                className={`flex w-full cursor-pointer items-center gap-3 rounded-xl border p-2.5 text-left transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${
                  elegido ? "border-primary bg-primary/5" : "border-border hover:border-primary/50"
                }`}
              >
                <span className="bg-primary/10 text-primary flex size-8 shrink-0 items-center justify-center rounded-lg">
                  <Icono className="size-4" aria-hidden />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="text-text block text-sm font-medium">{nombre}</span>
                  <span className="text-text-muted block text-xs">
                    {noSoportado ? "Este navegador no permite notificaciones" : pedirPermiso ? "Tocá para activarlas en este dispositivo" : que}
                  </span>
                </span>
                {ocupada === "canal" && elegido ? (
                  <Loader2 className="text-primary size-4 animate-spin" aria-hidden />
                ) : (
                  elegido && <Check className="text-primary size-4" aria-hidden />
                )}
              </button>
            );
          })}
        </div>
      </section>

      <p className="text-text-muted text-center text-xs">
        Los avisos te llegan aunque cierres Campus. Los apagás desde acá.
      </p>
    </div>
  );
}
