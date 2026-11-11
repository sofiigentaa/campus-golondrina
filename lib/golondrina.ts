/* Golondrina dentro del tutor: acciones de un clic que el asistente de cada
   lección le pasa a Golondrina (el motor de avisos) para que se encargue.

   Las automatizaciones las guarda y las manda pf-back (módulo `golondrina`,
   ver services/golondrina/golondrina.service.ts). Acá viven sólo los textos
   y cómo se muestran: qué hace cada acción, por qué canal llega y cómo se ve
   el aviso. Los textos del aviso son los mismos que arma el back
   (pf-back/src/golondrina/golondrina.actions.ts): si cambian allá, cambian acá. */

export type AccionId = "recordar" | "plan" | "resumen" | "docente";
export type CanalId = "push" | "email" | "in_app";

export interface Accion {
  id: AccionId;
  titulo: string;
  bajada: string;
  /** Qué va a hacer, en una línea, para la tarjeta de «Lo que voy a hacer». */
  regla: (leccion: string) => string;
  detalle: string[];
}

export const ACCIONES: Accion[] = [
  {
    id: "recordar",
    titulo: "Recordame repasar",
    bajada: "Te aviso mañana para no olvidarla",
    regla: (l) => `Recordarte repasar «${l}»`,
    detalle: ["Un aviso, mañana a las 19:00."],
  },
  {
    id: "plan",
    titulo: "Armá mi plan",
    bajada: "3 bloques cortos esta semana",
    regla: (l) => `Plan de estudio para «${l}»`,
    detalle: [
      "Releer la lección · 20 min",
      "Practicar con el tutor · 20 min",
      "Quiz rápido de repaso · 15 min",
      "Un aviso 15 minutos antes de cada bloque, día por medio.",
    ],
  },
  {
    id: "resumen",
    titulo: "Mandame el resumen",
    bajada: "Los puntos clave, ahora",
    regla: (l) => `Mandarte el resumen de «${l}»`,
    detalle: ["Hasta cinco puntos clave de la lección."],
  },
  {
    id: "docente",
    titulo: "Avisame si responden",
    bajada: "Cuando el docente conteste",
    regla: () => "Avisarte cuando el docente responda",
    detalle: ["Vale para el chat con el docente y los foros del curso."],
  },
];

export interface Canal {
  id: CanalId;
  nombre: string;
  que: string;
}

export const CANALES: Canal[] = [
  { id: "push", nombre: "Celular", que: "Notificación en el celular o la compu" },
  { id: "email", nombre: "Mail", que: "A tu correo de Campus" },
  { id: "in_app", nombre: "Campanita", que: "En los avisos de Campus" },
];

export const nombreCanal = (id: CanalId) => CANALES.find((c) => c.id === id)?.nombre ?? id;

/** El aviso tal como le llega (mismo texto que arma el back). */
export function textoAviso(accion: AccionId, leccion: string, runIndex = 0): { titulo: string; cuerpo: string } {
  switch (accion) {
    case "recordar":
      return { titulo: "Hoy toca repasar", cuerpo: `Repasá «${leccion}». Son 10 minutos, ¿arrancamos?` };
    case "plan": {
      const bloques = ["Releer la lección (20 min)", "Practicar con el tutor (20 min)", "Quiz rápido de repaso (15 min)"];
      return { titulo: "En 15 minutos, tu bloque de estudio", cuerpo: `${bloques[Math.min(runIndex, 2)]}: «${leccion}».` };
    }
    case "resumen":
      return { titulo: `Resumen de «${leccion}»`, cuerpo: "Los puntos clave de la lección, para repasar en un minuto." };
    case "docente":
      return { titulo: "Te respondió el docente", cuerpo: `El docente contestó tu pregunta. La lección era «${leccion}».` };
  }
}

const ZONA = "America/Argentina/Buenos_Aires";

/** «Hoy 19:00», «Mañana 18:45», «Jueves 13/11 18:45». */
export function cuandoSale(fecha: string | Date, ahora = new Date()): string {
  const d = new Date(fecha);
  const dia = (x: Date) => new Intl.DateTimeFormat("en-CA", { timeZone: ZONA }).format(x);
  const hora = new Intl.DateTimeFormat("es-AR", { timeZone: ZONA, hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(d);
  const manana = new Date(ahora.getTime() + 86_400_000);
  if (dia(d) === dia(ahora)) return `Hoy ${hora}`;
  if (dia(d) === dia(manana)) return `Mañana ${hora}`;
  const nombre = new Intl.DateTimeFormat("es-AR", { timeZone: ZONA, weekday: "long", day: "2-digit", month: "2-digit" }).format(d);
  return `${nombre.charAt(0).toUpperCase()}${nombre.slice(1)} ${hora}`;
}
