# Golondrina en los asistentes de lección

Rama `feat/golondrina-asistentes`. Cada lección tiene, dentro del drawer del
tutor, una pestaña **Golondrina** al lado de **Tutor**: acciones de un clic que
el asistente le pasa a Golondrina para que se encargue.

| Acción | Qué hace | Cuándo |
| --- | --- | --- |
| Recordame repasar | «Hoy toca repasar ‹lección›» | Mañana a las 19:00 |
| Armá mi plan | 3 bloques: releer, practicar con el tutor, quiz | 18:45, día por medio |
| Mandame el resumen | Los puntos clave de la lección | En el momento |
| Avisame si responden | «Te respondió el docente» | Cuando el docente escribe en el chat o el foro |

**Funciona con el back** (pf-back, módulo `golondrina`, ver su
`docs/GOLONDRINA.md`): las automatizaciones se guardan y se mandan aunque el
alumno cierre Campus. Canales: **celular** (Web Push; si no está activo, el
panel pide permiso con `registerPush`), **mail** y **campanita**. Elegir otro
canal lo aplica a lo que ya está activo en esa lección.

- Sin el módulo en el back (`404`), el panel dice «Golondrina todavía no está
  activa en Campus»; no simula nada.
- `NEXT_PUBLIC_GOLONDRINA_SOURCE=mock` simula el back en memoria para trabajar
  la UI sin servidor. **Nunca en producción.**

## Archivos

- `services/golondrina/golondrina.service.ts`: contrato con el back y el mock.
- `lib/golondrina.ts`: textos de acciones, canales y avisos (iguales a los del back) y `cuandoSale`.
- `components/golondrina/GolondrinaPanel.tsx`: la vista.
- `components/golondrina/GolondrinaLogo.tsx`: isotipo.
- `components/ai-tutor/AiTutorDrawer.tsx`: pestañas Tutor / Golondrina.
- `app/globals.css`: animación de entrada del aviso (respeta reduced-motion).

## Cómo verlo

`npm run dev` contra un back con el módulo (o con
`NEXT_PUBLIC_GOLONDRINA_SOURCE=mock`), abrir cualquier lección, **Preguntarle
al tutor** → pestaña **Golondrina**.
