import os
import subprocess
from datetime import datetime
from docxtpl import DocxTemplate

SOFFICE_PATH = r"C:\Program Files\LibreOffice\program\soffice.exe"


# -----------------------------
# LOCKED FORMATTERS (DO NOT TOUCH)
# -----------------------------
def _format_percent(value):
    """
    LOCKED: Always returns 'NN%'.
    Accepts int | float | numeric string.
    """
    try:
        return f"{int(float(value))}%"
    except Exception:
        return ""


def _format_currency(value):
    """
    LOCKED: Always returns '$N,NNN.NN' or '$N,NNN'
    """
    try:
        v = float(value)
        return f"${v:,.2f}" if not v.is_integer() else f"${int(v):,}"
    except Exception:
        return ""


def _format_date(value):
    """
    LOCKED: 'Month DD, YYYY'
    """
    try:
        return datetime.strptime(value, "%Y-%m-%d").strftime("%B %d, %Y")
    except Exception:
        return datetime.now().strftime("%B %d, %Y")


# -----------------------------
# MAIN GENERATOR (DROP-IN)
# -----------------------------
def generate_report(
    name,
    address,
    property_under_appraisal,
    parcel_id,
    fee,
    due_signing,
    due_completion,
    report_date,
):
    base_dir = os.path.dirname(__file__)
    template_path = os.path.join(base_dir, "templates", "template.docx")
    reports_dir = os.path.join(base_dir, "reports")
    os.makedirs(reports_dir, exist_ok=True)

    # Safe filenames (locked)
    safe_name = name.replace(" ", "_").replace("/", "_")
    docx_filename = f"Engagement_Letter_{safe_name}.docx"
    pdf_filename = f"Engagement_Letter_{safe_name}.pdf"

    docx_path = os.path.join(reports_dir, docx_filename)
    pdf_path = os.path.join(reports_dir, pdf_filename)

    doc = DocxTemplate(template_path)

    # -----------------------------
    # LOCKED CONTEXT (SOURCE OF TRUTH)
    # -----------------------------
    context = {
        "date": _format_date(report_date),
        "name": name,
        "address": address,
        "property_under_appraisal": property_under_appraisal,
        "parcel_id": parcel_id,

        # 🔒 PRESENTATION OWNED BY BACKEND
        "fee": _format_currency(fee),
        "due_signing": _format_percent(due_signing),
        "due_completion": _format_percent(due_completion),
    }

    doc.render(context)
    doc.save(docx_path)

    # DOCX → PDF (headless, deterministic)
    subprocess.run(
        [
            SOFFICE_PATH,
            "--headless",
            "--convert-to", "pdf",
            "--outdir", reports_dir,
            docx_path,
        ],
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        check=True,
    )

    return pdf_path
