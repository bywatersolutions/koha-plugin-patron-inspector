# Patron Import Pre-flight Inspector for Koha

This plugin checks a patron CSV file before it is loaded with Koha's Import patrons tool. It flags problems that would make the import fail or load bad data, fixes the ones it safely can, and lets you download the cleaned file.

The file is processed entirely in the web browser. No patron data is uploaded to the server.

## Downloading

From the [release page](https://github.com/bywatersolutions/koha-plugin-patron-inspector/releases) you can download the relevant *.kpz file

## Usage

1. Go to *Tools › Tool plugins* and run the Patron Import Pre-flight Inspector.
2. Choose a patron CSV file and click *Inspect & Sanitize File*.
3. Review the summary and the detailed issue log.
4. Click *Download Koha-Ready CSV* and load that file with *Tools › Import patrons*.

## What it checks

- Column headers are lowercased, and a `patron_attribute` header is corrected to `patron_attributes`. Headers that are not Koha patron fields are flagged.
- `branchcode` and `categorycode` are uppercased and checked against the libraries and patron categories in Koha.
- `dateofbirth`, `dateenrolled` and `dateexpiry` must be real dates in ISO format ( YYYY-MM-DD ) or the format set by the `dateformat` system preference. Unpadded dates and dates with other separators are converted.
- `relationship` and `guarantor_relationship` are checked against the `borrowerRelationship` system preference, and their case is corrected to match it.
- `patron_attributes` pairs are trimmed and checked for `CODE:VALUE` format and for attribute type codes that exist in Koha.
