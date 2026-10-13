# Changelog
All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- Patron Import Pre-flight Inspector tool. It checks a patron CSV against the
  libraries, patron categories, patron attribute types and guarantor
  relationships in Koha before import, fixes what it safely can, and offers the
  cleaned file for download.
