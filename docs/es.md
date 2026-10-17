# Lanzamientos espaciales

Los próximos lanzamientos de cohetes de todo el mundo en Gladys: SpaceX, Arianespace, ULA, Rocket Lab,
ISRO, JAXA, lanzadores chinos… Los datos proceden de **Launch Library 2**, la base libre y gratuita de
[The Space Devs](https://thespacedevs.com/llapi), actualizada por su comunidad en tiempo real.

## Qué hace la integración

- Un dispositivo **Próximo lanzamiento**: nombre, fecha en su hora local, horas restantes, estado,
  operador, cohete, lugar de lanzamiento, emisión en directo, «lanzamiento hoy», y el último lanzamiento
  con su resultado.
- Un dispositivo más por cada **filtro** elegido (SpaceX, Kourou, Ariane 6…), con las mismas funciones.
- Un widget **Lanzamientos espaciales**: cuenta atrás del próximo lanzamiento y los cinco siguientes.
- Cuatro **disparadores de escena**: lanzamiento inminente, despegue, resultado del lanzamiento,
  lanzamiento aplazado.
- Dos **acciones de escena** que devuelven una frase lista para enviar o leer en voz alta.

## Requisitos

- Gladys Assistant 5.1 o posterior (5.2 para el panel de detalle del widget).
- Acceso a Internet desde Gladys. Sin cuenta ni clave: Launch Library 2 es gratuito para uso personal.

## Configuración

1. Instale la integración y abra su pestaña **Configuración**.
2. Elija el **idioma de los textos**: nombres de dispositivos y funciones, valores de texto y frases de
   escena (francés por defecto). Los nombres se fijan al crear un dispositivo: para cambiarlos, elimine
   el dispositivo y vuelva a añadirlo.
3. Si lo desea, escriba **filtros** (ver más abajo) y guarde.
4. En la pestaña **Descubrimiento**, añada el dispositivo **Próximo lanzamiento** y el dispositivo de
   cada filtro.

El botón **Comprobar** vuelve a leer Launch Library 2 al instante y muestra el próximo lanzamiento, el
número de lanzamientos de cada filtro y las solicitudes restantes en esta hora.

### Filtros

Hasta cinco, separados por comas. Un filtro conserva los lanzamientos cuyo operador, cohete, misión,
lugar o país contiene el texto, sin distinguir mayúsculas ni acentos: `SpaceX`, `Arianespace`, `ISRO`,
`Ariane 6`, `Starship`, `Starlink`, `Vandenberg`. También se entienden algunos nombres habituales:
`Kourou` (Centro Espacial Guayanés), `Florida`, `California`, `Baikonur`, `China`, `India`, `Japan`,
`Europe` (Arianespace, ESA, Avio). Un código de tres caracteres o menos designa una palabra entera: un
código de país (`US`, `CN`, `GF`), un código de operador (`ULA`, `SpX`) o un cohete (`H3`).

Cada filtro añade un dispositivo llamado «Próximo lanzamiento · <filtro>». Cambiar el texto de un filtro
crea un dispositivo nuevo: elimine el antiguo en Gladys.

## Dispositivos

Todas las funciones son de solo lectura.

| Función                                              | Valor                                                                                                                              |
| ---------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| Lanzamiento                                          | Cohete y misión, tal como los nombra Launch Library 2: «Falcon 9 Block 5 \| Starlink Group 15-15»                                  |
| Fecha del lanzamiento                                | Tan precisa como se conoce: «lun, 19 oct · 12:30», «~12:30» para una hora conocida a la hora, un día, «octubre de 2026», «T4 2026» |
| Horas hasta el lanzamiento                           | Horas enteras hasta la fecha («no antes de»), 0 una vez alcanzada                                                                  |
| Lanzamientos en 7 días                               | Lanzamientos próximos del dispositivo en los 7 días siguientes                                                                     |
| Estado del lanzamiento                               | Go, Por confirmar, Por determinar, En espera                                                                                       |
| Operador, Cohete, Lugar de lanzamiento               | Según Launch Library 2                                                                                                             |
| Emisión en directo                                   | 1 mientras la emisión oficial está en directo                                                                                      |
| Lanzamiento hoy                                      | 1 cuando el próximo lanzamiento es hoy (si se conoce su día)                                                                       |
| Último lanzamiento, Resultado del último lanzamiento | El último lanzamiento que despegó y su desenlace: En vuelo, Éxito, Fallo, Fallo parcial                                            |

El próximo lanzamiento es el primero que aún no ha despegado. Las fechas suelen ser «no antes de»: un
lanzamiento previsto para «octubre de 2026» lleva el primer día del mes.

## Widget del panel

**Lanzamientos espaciales** muestra la cuenta atrás del próximo lanzamiento, el número de lanzamientos en
7 días y los cinco próximos lanzamientos con su fecha, su operador y su estado. Toque un lanzamiento para
leer su misión. El ajuste **Dispositivo** lo limita a los lanzamientos de un filtro; vacío, muestra todos
los lanzamientos.

## Disparadores de escena

Cada disparador pide un **dispositivo**: «Próximo lanzamiento» para todos los lanzamientos del mundo, o
el dispositivo de un filtro. Un lanzamiento que corresponde a varios dispositivos se activa una vez por
dispositivo: una escena solo se ejecuta una vez.

- **Lanzamiento inminente**: 5, 15 o 30 minutos, 1, 2 o 24 horas antes de un lanzamiento cuya hora se
  conoce al minuto y cuyo estado es Go o Por confirmar. Un lanzamiento que cambia de hora se activa de
  nuevo a su nueva hora.
- **Despegue**: cuando Launch Library 2 indica el cohete en vuelo, normalmente en 10 minutos.
- **Resultado del lanzamiento**: éxito, fallo o fallo parcial (filtro opcional), con la causa del fallo
  (en inglés).
- **Lanzamiento aplazado**: un lanzamiento previsto en las próximas 48 horas se retrasa 15 minutos o más
  («Nueva fecha»), o queda en espera («En espera»).

Cada disparador transmite una **frase lista para enviar**, el lanzamiento, la misión, el cohete, el
operador, el lugar, la fecha y el estado, y sus propios detalles (minutos antes, resultado, fecha
anterior, retraso).

## Acciones de escena

- **Leer el próximo lanzamiento**: una frase como «Próximo lanzamiento: Falcon 9 Block 5 | Bandwagon 5
  (SpaceX), desde Cape Canaveral SFS, FL, USA, lun, 19 oct · 12:30. Estado: Go.», así como el
  lanzamiento, el operador, el lugar, la fecha, las horas restantes (-1 si no hay ninguno) y el estado.
- **Leer los próximos lanzamientos**: una frase con los 1 a 5 próximos lanzamientos y su fecha.

Ambas aceptan un dispositivo opcional para limitarse a un filtro.

## Ejemplos de escenas

- **Lanzamiento inminente** (Próximo lanzamiento · Kourou, 15 minutos antes) → enviar la frase del
  disparador a su teléfono.
- **Despegue** (Próximo lanzamiento · SpaceX) → poner la luz del salón en azul y leer la frase en el
  altavoz.
- Cada mañana a las 8:00 → **Leer los próximos lanzamientos** (3) → enviar la frase en un mensaje.

## Solución de problemas

- **Nada en los dispositivos**: Launch Library 2 aún no se ha leído. Pulse **Comprobar**: el mensaje
  muestra el posible error.
- **«Límite de solicitudes alcanzado»**: Launch Library 2 admite 15 solicitudes por hora sin cuenta y
  responde 429 por encima. La integración espera el tiempo anunciado y vuelve a leer sola. Evite pulsar
  **Comprobar** varias veces seguidas: cada pulsación cuesta 2 solicitudes.
- **Un filtro no encuentra nada**: pulse **Comprobar** para ver cuántos lanzamientos conserva cada
  filtro. Un filtro solo ve los 40 próximos lanzamientos del mundo, uno o dos meses.
- Añada `LOG_LEVEL=debug` al contenedor para ver cada lectura.

## Limitaciones

- Launch Library 2 es gratuito y anónimo pero está limitado a **15 solicitudes por hora**: la
  integración lee los próximos lanzamientos cada 30 minutos, cada 10 minutos desde una hora antes de un
  lanzamiento hasta conocer su resultado, y los últimos lanzamientos cada 2 horas: de 2 a 7 solicitudes
  por hora. Su propio margen es de 12 por hora.
- El despegue y los resultados se ven en la lectura siguiente: hasta 10 minutos de retraso.
- Los datos son los de la comunidad de Launch Library 2: una fecha puede cambiar en el último minuto,
  un resultado publicarse horas después.
- Los enlaces de las emisiones no están disponibles en este modo de la API: solo el indicador «en
  directo».
- Esta integración no está afiliada a The Space Devs ni a ningún operador de lanzamientos.

## Créditos

Datos de lanzamientos: [Launch Library 2](https://thespacedevs.com/llapi) de The Space Devs.
Integración de guim31, bajo la licencia Apache 2.0.
