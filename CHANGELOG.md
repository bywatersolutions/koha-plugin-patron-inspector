# Changelog
All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [1.1.0] - 2026-10-14

### Changed

- Koha 24.05 or later is required. The tool reads patron categories from a
  REST API endpoint added in that version.

### Fixed

- The tool page was missing the Koha staff interface header, menus and styles.
- The cleaned file joined multiple patron attributes with `|`, so Koha's
  patron import read `GRADE:5|SCHOOLCODE:EHS` as a single GRADE attribute.
  Attributes are now comma separated, the way the import expects.
- Patron attribute type codes containing "code", such as SCHOOLCODE, were
  reported as unknown, and attribute codes weren't checked at all for staff
  without permission to manage patron attribute types.
- Guarantor relationships were checked against a built in list instead of the
  `borrowerRelationship` system preference. A relationship's case is now
  corrected to match the preference, since Koha only accepts an exact match.
- Dates are read in the order set by the `dateformat` system preference
  instead of always MM/DD/YYYY, and impossible dates like 13/45/2024 or
  2024-02-30 are flagged.
- Each header problem was logged once for every row in the file, so no row
  counted as clean.
- A row whose only problem was an invalid date was counted as clean.

### Security

- Values from the uploaded file were shown as HTML in the issue log, so markup
  in a CSV could run as script in the librarian's session.

## [1.0.0] - 2026-10-13

### Added

- Patron Import Pre-flight Inspector tool. It checks a patron CSV against the
  libraries, patron categories, patron attribute types and guarantor
  relationships in Koha before import, fixes what it safely can, and offers the
  cleaned file for download.

[Unreleased]: https://github.com/bywatersolutions/koha-plugin-patron-inspector/compare/v1.1.0...HEAD
[1.1.0]: https://github.com/bywatersolutions/koha-plugin-patron-inspector/compare/v1.0.0...v1.1.0
[1.0.0]: https://github.com/bywatersolutions/koha-plugin-patron-inspector/releases/tag/v1.0.0
