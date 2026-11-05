"""Verify single-run Playwright and Allure artifacts before allowing CI upload."""
import base64
import io
import hashlib
import json
import os
import re
import sys
from pathlib import Path
from xml.etree import ElementTree
from zipfile import BadZipFile, ZipFile


def verify(reports, allure):
    keys = ("APP_EMAIL", "APP_PASSWORD", "ADMIN_USERNAME", "ADMIN_PASSWORD")
    required = [os.environ[key] for key in keys]
    if not all(required):
        raise ValueError("Missing credential")
    optional = ("PASSWORD", "DB_PASSWORD", "OPENCART_DB_ROOT_PASSWORD", "FAKESTORE_JWT_SECRET",
                "FAKESTORE_MONGO_PASSWORD", "FAKESTORE_MONGO_ROOT_PASSWORD")
    values = set(required) | {os.environ[k] for k in optional if os.environ.get(k)}

    def check(text):
        if any(value in text for value in values):
            raise ValueError("Credential in report")

    def check_json(data):
        # Decode escapes before testing a string, including strings in nested arrays.
        def visit(value):
            if isinstance(value, str):
                check(value)
            elif isinstance(value, list):
                for item in value:
                    visit(item)
            elif isinstance(value, dict):
                for key, item in value.items():
                    check(key)
                    visit(item)
        visit(json.loads(data))

    report_files = list(reports.iterdir())
    if {p.name for p in report_files} != {"index.html", "results.xml"}:
        raise ValueError("Unexpected Playwright output")
    if any(p.is_symlink() or not p.is_file() for p in report_files):
        raise ValueError("Unexpected Playwright entry")
    html = (reports / "index.html").read_text(encoding="utf-8")
    payload = re.search(r'<template id="playwrightReportBase64">data:application/zip;base64,([\w+/=]+)</template>', html)
    if not payload:
        raise ValueError("Unrecognized Playwright HTML format")
    # The shell is vendored Playwright JS/CSS. Short identifiers can be ordinary
    # words in the static bundle. The embedded runtime data is checked in full.
    shell = html[:payload.start()] + html[payload.end():]
    if any(value in shell for value in values if len(value) >= 8):
        raise ValueError("Credential in HTML shell")
    with ZipFile(io.BytesIO(base64.b64decode(payload[1], validate=True))) as archive:
        if "report.json" not in archive.namelist():
            raise ValueError("Missing Playwright report")
        for entry in archive.infolist():
            if not entry.filename.endswith(".json"):
                raise ValueError("Unexpected embedded resource")
            check(entry.filename)
            check_json(archive.read(entry))
    xml = ElementTree.parse(reports / "results.xml")
    for node in xml.iter():
        check(" ".join([node.text or "", node.tail or "", *node.attrib.values()]))

    for entry in allure.iterdir():
        match = re.fullmatch(r"safe-([a-f0-9]{64})-(?:result|container)\.json", entry.name)
        if entry.is_symlink() or not entry.is_file() or not match:
            raise ValueError("Unexpected Allure attachment or metadata")
        raw = entry.read_bytes()
        if hashlib.sha256(raw).hexdigest() != match[1]:
            raise ValueError("Modified Allure result")
        check_json(raw)


if __name__ == "__main__":
    try:
        verify(*(Path(arg) for arg in sys.argv[1:]))
    except (ValueError, OSError, KeyError, BadZipFile, ElementTree.ParseError):
        sys.exit("Report privacy check failed. Withholding diagnostic artifacts.")
    print("Verified Playwright HTML, its embedded JSON, JUnit and raw Allure files.")
