# Rocket Launches for Gladys Assistant

An external integration for [Gladys Assistant](https://gladysassistant.com) that follows the upcoming
rocket launches of the whole world (SpaceX, Arianespace, ULA, Rocket Lab, ISRO, JAXA, Chinese
launchers…): the next launch with a countdown, launches of your favorite provider or launch site, and
scene triggers for "launch soon", liftoff, result and postponement. Data from
[Launch Library 2](https://thespacedevs.com/llapi) by The Space Devs: free, no account, no key.

Feedback welcome on the [Gladys forum](https://community.gladysassistant.com).

## Features

- **A "Next launch" device** for the dashboard and scene conditions: launch name, date in the local time
  of Gladys (as precise as it is known: minute, hour, day, month, quarter), hours until launch,
  launches within 7 days, status (Go, to be confirmed, to be determined, on hold), provider, rocket,
  launch site, webcast live, launch today, and the last launch with its result.
- **Filters**: up to five (`SpaceX`, `Kourou`, `Ariane 6`, `US`…), one more "Next launch · <filter>"
  device each.
- **Dashboard widget "Rocket launches"**: countdown to the next launch and the five next ones with
  their date, provider, status and mission, worldwide or for a filter.
- **Scene triggers**: "Launch soon" (5, 15, 30 minutes, 1, 2 or 24 hours before), "Liftoff", "Launch
  result" (success, failure, partial failure) and "Launch postponed" (new date within 48 hours, or on
  hold). Each one carries a sentence ready to send.
- **Scene actions**: "Read the next launch" and "Read the next launches".
- Texts in English, French, German and Spanish.

## Requirements

- Gladys Assistant 5.1.0 or later.
- Internet access from Gladys (`ll.thespacedevs.com`, HTTPS).

## Installation

1. In Gladys, open **Integrations → Install from GitHub** and enter
   `https://github.com/guim31/gladys-launch-library`.
2. In the **Configuration** tab, choose the language of the texts and, if you like, some filters
   (`SpaceX, Kourou`). Save.
3. In the **Discover** tab, add the "Next launch" device and the device of each filter; add the
   **Rocket launches** widget to a dashboard.

The full user documentation is in [English](docs/en.md), [French](docs/fr.md), [German](docs/de.md)
and [Spanish](docs/es.md).

## How it works

- Two lists are read from Launch Library 2 2.3.0: the next 40 launches (`/launches/upcoming/`, which
  also holds the launches of the last 24 hours) every 30 minutes, and every 10 minutes from an hour
  before a launch until 30 minutes after it (3 hours while a rocket is in flight without a result); the
  last 10 launches (`/launches/previous/`) every 2 hours. That is 2 to 7 requests an hour. The
  anonymous limit is 15 an hour: the client refuses a 13th request in the hour by itself, and waits the
  time a 429 announces. A failure is retried after 10 minutes.
- The answers are kept in `/data/cache.json`: the devices and the widget keep working when the API is
  down, and the connection status says so.
- The devices are published with `should_poll: false`: a clock in the container ticks every minute,
  publishes the states that changed (all of them twice a day, so Gladys never shows them as outdated)
  and fires "launch soon" at each lead time, for launches known to the minute and Go or to be
  confirmed. After each reading, every launch is compared with its last known status and date
  (`/data/triggers.json`): liftoff, result and postponement fire once, even across restarts, and never
  for what happened before the install.
- A launch matching several devices fires one event per device, and every trigger requires a device:
  a scene runs once.
- Times are shown in the time zone Gladys gives the container (`TZ`).

## Limitations

- Liftoff and results are seen at the next reading: up to 10 minutes late.
- A filter sees the next 40 launches of the world (one or two months).
- The webcast links are only in the "detailed" mode of the API, too heavy to read this often: only the
  "webcast live" flag is shown.
- Names of launches, rockets, providers and sites are in English, as Launch Library 2 publishes them.

## Development

Node.js 22+, ESM, no build step. One runtime dependency:
[`@gladysassistant/integration-sdk`](https://github.com/GladysAssistant/integration-sdk-js).

```bash
npm install
npm test              # node --test, against the SDK's fake Gladys; no network
npm run lint
npm run format:check
npx -y github:GladysAssistant/integration-store --skip-image-check .   # store validator
```

```
index.js              SDK wiring (src/app.js registers the handlers)
src/app.js            every SDK handler -> the service, the "Check" action
src/service.js        the clock: readings, cache, states, scene triggers, status
src/ll2.js            Launch Library 2 client (hourly margin, 429) and parser
src/launches.js       scopes and filters, next and last launch
src/device.js         the "Next launch" devices and their states
src/widgets.js        "Rocket launches" dashboard widget
src/scenes.js         "Read the next launch", "Read the next launches"
src/i18n.js           every text of the code, in four languages
src/time.js           launch dates in the time zone of Gladys, by precision
src/config.js         DEFAULT_CONFIG (mirrors the manifest) + normalization, filters
src/store.js          JSON files in /data
test/fixtures/        Gladys feature table, recorded answers of Launch Library 2
```

To run it outside Gladys (`LL2_API_BASE=https://lldev.thespacedevs.com/2.3.0` reads the development
instance, without limit but with older data):

```bash
GLADYS_HOST_API_URL="http://localhost:1443" \
GLADYS_INTEGRATION_TOKEN="<token>" \
GLADYS_INTEGRATION_SELECTOR="launch-library" \
LL2_DATA_DIR=./data \
TZ=Europe/Paris \
npm start
```

Releases are made by the **Release** workflow (Actions → Release); never edit the versions by hand. See
[`CLAUDE.md`](CLAUDE.md) for the project rules.

## Credits

- [Launch Library 2](https://thespacedevs.com/llapi) by [The Space Devs](https://thespacedevs.com), for
  every launch. The tests replay answers recorded from it on 2026-10-17 (trimmed to the fields read).
- The idea comes from the Home Assistant integration "Launch Library" (Apache 2.0); no code was taken
  from it.
- Started from the official
  [integration-template-js](https://github.com/GladysAssistant/integration-template-js).

## Disclaimer

This integration is not affiliated with, endorsed by or connected to The Space Devs or any launch
provider. Their names belong to their owners.

## License

[Apache-2.0](LICENSE)
