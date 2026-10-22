# Changelog

All notable changes to this integration are documented in this file. The format
follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project
uses [semantic versioning](https://semver.org/).

Describe each change under `## [Unreleased]` as you make it. The Release
workflow moves that section under the version it ships, and the section becomes
the notes of the version's GitHub Release.

## [Unreleased]

## [1.0.1] - 2026-10-22

### Security

- Rebuilt on Node.js 24.22.1, the October 2026 security release (remote code
  execution in the Brotli decoder, CVE-2026-111497; TLS hostname and DNS
  fixes).

## [1.0.0] - 2026-10-17

### Added

- A "Next launch" device for the dashboard and scene conditions: the next rocket launch in the world
  with its date in the time zone of Gladys (as precise as it is known), hours until launch, launches
  within 7 days, status, provider, rocket, launch site, webcast live, launch today, and the last launch
  with its result.
- Up to five filters (provider, rocket, site, country): one more "Next launch" device each.
- Dashboard widget "Rocket launches": countdown to the next launch and the five next ones, worldwide
  or for a filter.
- Scene triggers "Launch soon" (5 minutes to 24 hours before), "Liftoff", "Launch result" (success,
  failure, partial failure) and "Launch postponed" (new date or on hold), each with a sentence ready to
  send.
- Scene actions "Read the next launch" and "Read the next launches".
- A "Check" button on the Configuration screen.
- Data from Launch Library 2 (The Space Devs), with a cache in `/data`: no account, 2 to 7 requests an
  hour, under the 15 allowed.
- Texts and documentation in English, French, German and Spanish.

[Unreleased]: https://github.com/guim31/gladys-launch-library/compare/v1.0.1...HEAD
[1.0.1]: https://github.com/guim31/gladys-launch-library/compare/v1.0.0...v1.0.1
[1.0.0]: https://github.com/guim31/gladys-launch-library/releases/tag/v1.0.0
