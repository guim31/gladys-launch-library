// -----------------------------------------------------------------------------
// Every text the code produces, in the four languages of the Gladys interface.
// German says "du", Spanish "usted". The device has no user language: its
// names, its texts and the scene texts follow the `language` setting; the
// widget gets the language of the person looking at it. Launch, rocket,
// provider and site names come from Launch Library 2, in English: they are
// names.
// -----------------------------------------------------------------------------

/** Feature names, frozen by Gladys when the device is created. */
export const NAMES = {
  en: {
    device: 'Next launch',
    next_name: 'Launch',
    next_date: 'Launch date',
    next_countdown: 'Hours until launch',
    launches_7_days: 'Launches within 7 days',
    next_status: 'Launch status',
    next_provider: 'Launch provider',
    next_rocket: 'Rocket',
    next_location: 'Launch site',
    webcast_live: 'Webcast live',
    launch_today: 'Launch today',
    last_launch: 'Last launch',
    last_result: 'Last launch result',
  },
  fr: {
    device: 'Prochain lancement',
    next_name: 'Lancement',
    next_date: 'Date du lancement',
    next_countdown: 'Heures avant le lancement',
    launches_7_days: 'Lancements sous 7 jours',
    next_status: 'Statut du lancement',
    next_provider: 'Opérateur',
    next_rocket: 'Fusée',
    next_location: 'Site de lancement',
    webcast_live: 'Diffusion en direct',
    launch_today: "Lancement aujourd'hui",
    last_launch: 'Dernier lancement',
    last_result: 'Résultat du dernier lancement',
  },
  de: {
    device: 'Nächster Raketenstart',
    next_name: 'Start',
    next_date: 'Startdatum',
    next_countdown: 'Stunden bis zum Start',
    launches_7_days: 'Starts in 7 Tagen',
    next_status: 'Startstatus',
    next_provider: 'Betreiber',
    next_rocket: 'Rakete',
    next_location: 'Startplatz',
    webcast_live: 'Livestream läuft',
    launch_today: 'Start heute',
    last_launch: 'Letzter Start',
    last_result: 'Ergebnis des letzten Starts',
  },
  es: {
    device: 'Próximo lanzamiento',
    next_name: 'Lanzamiento',
    next_date: 'Fecha del lanzamiento',
    next_countdown: 'Horas hasta el lanzamiento',
    launches_7_days: 'Lanzamientos en 7 días',
    next_status: 'Estado del lanzamiento',
    next_provider: 'Operador',
    next_rocket: 'Cohete',
    next_location: 'Lugar de lanzamiento',
    webcast_live: 'Emisión en directo',
    launch_today: 'Lanzamiento hoy',
    last_launch: 'Último lanzamiento',
    last_result: 'Resultado del último lanzamiento',
  },
};

/** Status names (16 characters at most: they are widget badges too). */
export const STATUS_NAMES = {
  en: {
    go: 'Go',
    tbc: 'To be confirmed',
    tbd: 'To be determined',
    hold: 'On hold',
    in_flight: 'In flight',
    deployed: 'Payload deployed',
    success: 'Success',
    failure: 'Failure',
    partial_failure: 'Partial failure',
  },
  fr: {
    go: 'Go',
    tbc: 'À confirmer',
    tbd: 'À déterminer',
    hold: 'Suspendu',
    in_flight: 'En vol',
    deployed: 'Charge déployée',
    success: 'Réussi',
    failure: 'Échec',
    partial_failure: 'Échec partiel',
  },
  de: {
    go: 'Go',
    tbc: 'Zu bestätigen',
    tbd: 'Noch offen',
    hold: 'Angehalten',
    in_flight: 'Im Flug',
    deployed: 'Nutzlast frei',
    success: 'Erfolgreich',
    failure: 'Fehlschlag',
    partial_failure: 'Teilerfolg',
  },
  es: {
    go: 'Go',
    tbc: 'Por confirmar',
    tbd: 'Por determinar',
    hold: 'En espera',
    in_flight: 'En vuelo',
    deployed: 'Carga desplegada',
    success: 'Éxito',
    failure: 'Fallo',
    partial_failure: 'Fallo parcial',
  },
};

/** Text values of the device. */
export const STATE_TEXT = {
  en: { none: 'No launch scheduled' },
  fr: { none: 'Aucun lancement prévu' },
  de: { none: 'Kein Start geplant' },
  es: { none: 'Ningún lanzamiento previsto' },
};

/** "15 minutes", "1 hour", "24 hours". */
export const LEAD_TEXT = {
  en: (m) => (m < 60 ? `${m} minutes` : m === 60 ? '1 hour' : `${m / 60} hours`),
  fr: (m) => (m < 60 ? `${m} minutes` : m === 60 ? '1 heure' : `${m / 60} heures`),
  de: (m) => (m < 60 ? `${m} Minuten` : m === 60 ? '1 Stunde' : `${m / 60} Stunden`),
  es: (m) => (m < 60 ? `${m} minutos` : m === 60 ? '1 hora' : `${m / 60} horas`),
};

// `l` is { name, provider, location, date, status }.
const by = (l, word) =>
  (l.provider ? ` (${l.provider})` : '') + (l.location ? `, ${word} ${l.location}` : '');

/** Sentences of the scene triggers and actions. */
export const SENTENCES = {
  en: {
    soon: (lead, l) => `Launch in ${LEAD_TEXT.en(lead)}: ${l.name}${by(l, 'from')}.`,
    liftoff: (l) => `Liftoff! ${l.name}${by(l, 'from')}.`,
    success: (l) => `Successful launch: ${l.name}${by(l, 'from')}.`,
    failure: (l) => `Launch failure: ${l.name}${by(l, 'from')}.`,
    partial_failure: (l) => `Partial launch failure: ${l.name}${by(l, 'from')}.`,
    delayed: (l) => `Launch postponed: ${l.name}${by(l, 'from')}, now ${l.date}.`,
    hold: (l) => `Launch on hold: ${l.name}${by(l, 'from')}.`,
    next: (l) => `Next launch: ${l.name}${by(l, 'from')}, ${l.date}. Status: ${l.status}.`,
    upcoming: (list) =>
      `Next launches: ${list.map((l, i) => `${i + 1}. ${l.name}, ${l.date}`).join('; ')}.`,
    none: 'No launch scheduled.',
    noData: 'The launch schedule has not been read yet.',
  },
  fr: {
    soon: (lead, l) => `Lancement dans ${LEAD_TEXT.fr(lead)} : ${l.name}${by(l, 'depuis')}.`,
    liftoff: (l) => `Décollage ! ${l.name}${by(l, 'depuis')}.`,
    success: (l) => `Lancement réussi : ${l.name}${by(l, 'depuis')}.`,
    failure: (l) => `Échec du lancement : ${l.name}${by(l, 'depuis')}.`,
    partial_failure: (l) => `Échec partiel du lancement : ${l.name}${by(l, 'depuis')}.`,
    delayed: (l) => `Lancement reporté : ${l.name}${by(l, 'depuis')}, désormais ${l.date}.`,
    hold: (l) => `Lancement suspendu : ${l.name}${by(l, 'depuis')}.`,
    next: (l) =>
      `Prochain lancement : ${l.name}${by(l, 'depuis')}, ${l.date}. Statut : ${l.status}.`,
    upcoming: (list) =>
      `Prochains lancements : ${list.map((l, i) => `${i + 1}. ${l.name}, ${l.date}`).join(' ; ')}.`,
    none: 'Aucun lancement prévu.',
    noData: "Le calendrier des lancements n'a pas encore été lu.",
  },
  de: {
    soon: (lead, l) => `Start in ${LEAD_TEXT.de(lead)}: ${l.name}${by(l, 'von')}.`,
    liftoff: (l) => `Abheben! ${l.name}${by(l, 'von')}.`,
    success: (l) => `Erfolgreicher Start: ${l.name}${by(l, 'von')}.`,
    failure: (l) => `Fehlstart: ${l.name}${by(l, 'von')}.`,
    partial_failure: (l) => `Start teilweise fehlgeschlagen: ${l.name}${by(l, 'von')}.`,
    delayed: (l) => `Start verschoben: ${l.name}${by(l, 'von')}, jetzt ${l.date}.`,
    hold: (l) => `Start angehalten: ${l.name}${by(l, 'von')}.`,
    next: (l) => `Nächster Start: ${l.name}${by(l, 'von')}, ${l.date}. Status: ${l.status}.`,
    upcoming: (list) =>
      `Nächste Starts: ${list.map((l, i) => `${i + 1}. ${l.name}, ${l.date}`).join('; ')}.`,
    none: 'Kein Start geplant.',
    noData: 'Der Startkalender wurde noch nicht gelesen.',
  },
  es: {
    soon: (lead, l) => `Lanzamiento en ${LEAD_TEXT.es(lead)}: ${l.name}${by(l, 'desde')}.`,
    liftoff: (l) => `¡Despegue! ${l.name}${by(l, 'desde')}.`,
    success: (l) => `Lanzamiento con éxito: ${l.name}${by(l, 'desde')}.`,
    failure: (l) => `Fallo del lanzamiento: ${l.name}${by(l, 'desde')}.`,
    partial_failure: (l) => `Fallo parcial del lanzamiento: ${l.name}${by(l, 'desde')}.`,
    delayed: (l) => `Lanzamiento aplazado: ${l.name}${by(l, 'desde')}, ahora ${l.date}.`,
    hold: (l) => `Lanzamiento en espera: ${l.name}${by(l, 'desde')}.`,
    next: (l) => `Próximo lanzamiento: ${l.name}${by(l, 'desde')}, ${l.date}. Estado: ${l.status}.`,
    upcoming: (list) =>
      `Próximos lanzamientos: ${list.map((l, i) => `${i + 1}. ${l.name}, ${l.date}`).join('; ')}.`,
    none: 'Ningún lanzamiento previsto.',
    noData: 'El calendario de lanzamientos aún no se ha leído.',
  },
};

/** Widget texts. */
export const WIDGET_TEXT = {
  en: {
    title: 'Rocket launches',
    nextIn: 'Next launch in',
    within7: 'Within 7 days',
    daysHours: (d, h) => `${d} d ${h} h`,
    hoursMinutes: (h, m) => `${h} h ${m} min`,
    now: 'Imminent',
    none: 'No launch scheduled.',
    noData: 'The launch schedule has not been read yet.',
  },
  fr: {
    title: 'Lancements spatiaux',
    nextIn: 'Prochain dans',
    within7: 'Sous 7 jours',
    daysHours: (d, h) => `${d} j ${h} h`,
    hoursMinutes: (h, m) => `${h} h ${m} min`,
    now: 'Imminent',
    none: 'Aucun lancement prévu.',
    noData: "Le calendrier des lancements n'a pas encore été lu.",
  },
  de: {
    title: 'Raketenstarts',
    nextIn: 'Nächster Start in',
    within7: 'In 7 Tagen',
    daysHours: (d, h) => `${d} T ${h} h`,
    hoursMinutes: (h, m) => `${h} h ${m} min`,
    now: 'Gleich',
    none: 'Kein Start geplant.',
    noData: 'Der Startkalender wurde noch nicht gelesen.',
  },
  es: {
    title: 'Lanzamientos espaciales',
    nextIn: 'Próximo en',
    within7: 'En 7 días',
    daysHours: (d, h) => `${d} d ${h} h`,
    hoursMinutes: (h, m) => `${h} h ${m} min`,
    now: 'Inminente',
    none: 'Ningún lanzamiento previsto.',
    noData: 'El calendario de lanzamientos aún no se ha leído.',
  },
};

/** The report of the "Check" action, lines joined by newlines. */
export const CHECK_TEXT = {
  en: {
    read: (count) => `Launch Library 2: ${count} upcoming launches known.`,
    next: (sentence) => sentence,
    filter: (label, count, next) =>
      count === 0
        ? `Filter "${label}": no launch among the upcoming ones.`
        : `Filter "${label}": ${count} launches, next: ${next}.`,
    quota: (left, max) => `Requests left this hour: ${left} of ${max}.`,
    fresh: 'Data read just now.',
    stale: (error) =>
      `Launch Library 2 could not be read (${error}): the data shown is the last read.`,
  },
  fr: {
    read: (count) => `Launch Library 2 : ${count} lancements à venir connus.`,
    next: (sentence) => sentence,
    filter: (label, count, next) =>
      count === 0
        ? `Filtre « ${label} » : aucun lancement parmi les prochains.`
        : `Filtre « ${label} » : ${count} lancements, prochain : ${next}.`,
    quota: (left, max) => `Requêtes restantes cette heure : ${left} sur ${max}.`,
    fresh: "Données lues à l'instant.",
    stale: (error) =>
      `Launch Library 2 n'a pas pu être lu (${error}) : les données affichées sont les dernières lues.`,
  },
  de: {
    read: (count) => `Launch Library 2: ${count} kommende Starts bekannt.`,
    next: (sentence) => sentence,
    filter: (label, count, next) =>
      count === 0
        ? `Filter „${label}“: kein Start unter den nächsten.`
        : `Filter „${label}“: ${count} Starts, nächster: ${next}.`,
    quota: (left, max) => `Verbleibende Anfragen in dieser Stunde: ${left} von ${max}.`,
    fresh: 'Daten soeben gelesen.',
    stale: (error) =>
      `Launch Library 2 konnte nicht gelesen werden (${error}): angezeigt werden die zuletzt gelesenen Daten.`,
  },
  es: {
    read: (count) => `Launch Library 2: ${count} lanzamientos próximos conocidos.`,
    next: (sentence) => sentence,
    filter: (label, count, next) =>
      count === 0
        ? `Filtro «${label}»: ningún lanzamiento entre los próximos.`
        : `Filtro «${label}»: ${count} lanzamientos, el próximo: ${next}.`,
    quota: (left, max) => `Solicitudes restantes en esta hora: ${left} de ${max}.`,
    fresh: 'Datos leídos ahora mismo.',
    stale: (error) =>
      `No se ha podido leer Launch Library 2 (${error}): los datos mostrados son los últimos leídos.`,
  },
};

/** Problems shown in the connection status of the integration. */
export const PROBLEM_TEXT = {
  en: {
    unreachable: () => 'Launch Library 2 cannot be read: the data shown may be old.',
    limited: () => 'Launch Library 2 request limit reached: reading again later.',
  },
  fr: {
    unreachable: () =>
      'Launch Library 2 ne peut pas être lu : les données affichées peuvent être anciennes.',
    limited: () => 'Limite de requêtes de Launch Library 2 atteinte : nouvelle lecture plus tard.',
  },
  de: {
    unreachable: () =>
      'Launch Library 2 kann nicht gelesen werden: Die angezeigten Daten können veraltet sein.',
    limited: () => 'Anfragelimit von Launch Library 2 erreicht: Neuer Versuch später.',
  },
  es: {
    unreachable: () =>
      'No se puede leer Launch Library 2: los datos mostrados pueden ser antiguos.',
    limited: () => 'Límite de solicitudes de Launch Library 2 alcanzado: nueva lectura más tarde.',
  },
};

export const INIT_FAILED = {
  en: 'The integration could not start: see its logs.',
  fr: "L'intégration n'a pas pu démarrer : consultez ses journaux.",
  de: 'Die Integration konnte nicht starten: Sieh in ihre Protokolle.',
  es: 'La integración no ha podido iniciarse: consulte sus registros.',
};

/** { en: fn(text.en), fr: … } */
export function inEveryLanguage(table, fn) {
  return Object.fromEntries(Object.entries(table).map(([language, text]) => [language, fn(text)]));
}
