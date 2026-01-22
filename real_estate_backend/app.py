import os
import shutil
from flask import Flask, request, jsonify, send_file
from flask_cors import CORS
from crs_ui_bot import get_parcel_id_from_ui
from report_generator import generate_report
import smtplib
from email.mime.multipart import MIMEMultipart
from email.mime.application import MIMEApplication
from email.mime.text import MIMEText

app = Flask(__name__)
CORS(app)

# ---------------------------------------------------------
# LOGIN
# ---------------------------------------------------------
ALLOWED_USERS = {
    "Philip": "Philip#2025!",
    "Ram": "Ram#2025!",
    "Corey": "Corey#2025!",
}

@app.route("/login", methods=["POST"])
def login():
    data = request.json or {}
    username = data.get("username", "").strip()
    password = data.get("password", "").strip()

    if username in ALLOWED_USERS and ALLOWED_USERS[username] == password:
        return jsonify({"success": True, "user": username}), 200

    return jsonify({"success": False, "error": "Invalid credentials"}), 401


@app.route("/")
def home():
    return "THG Backend Running"


# ---------------------------------------------------------
# FETCH PARCEL UI
# ---------------------------------------------------------
@app.route("/fetch_parcel_ui", methods=["POST"])
def fetch_parcel_ui():
    data = request.json or {}

    full_address = data.get("full_address")
    county_name = data.get("county_name")

    if not full_address or not county_name:
        return jsonify({"error": "Missing address or county"}), 400

    try:
        parcel_id = get_parcel_id_from_ui(full_address, county_name)
        if not parcel_id:
            return jsonify({"error": "Parcel ID not found"}), 404
        return jsonify({"parcel_id": parcel_id}), 200

    except Exception as e:
        print("❌ CRS BOT ERROR:", e)
        return jsonify({"error": "CRS Bot failed"}), 500


# ---------------------------------------------------------
# GENERATE REPORT
# ---------------------------------------------------------
@app.route("/generate_report", methods=["POST"])
def generate_report_api():
    data = request.json or {}

    pdf_path = generate_report(
        name=data.get("name"),
        address=data.get("address"),
        property_under_appraisal=data.get("property_under_appraisal"),
        parcel_id=data.get("parcel_id"),
        fee=data.get("fee"),
        due_signing=data.get("due_signing"),
        due_completion=data.get("due_completion"),
        report_date=data.get("report_date"),
    )

    try:
        filename = os.path.basename(pdf_path)
        return send_file(pdf_path, as_attachment=True, download_name=filename)
    except Exception as e:
        print("❌ SEND FILE ERROR:", e)
        return jsonify({"error": "Failed to send PDF"}), 500


# ---------------------------------------------------------
# EMAIL + PCLOUD
# ---------------------------------------------------------
@app.route("/send_email", methods=["POST"])
def send_email():
    data = request.json or {}

    pdf_path = data.get("pdf_path")
    customer_email = data.get("customer_email")
    client_name = data.get("client_name")
    address = data.get("address")

    if not pdf_path:
        return jsonify({"error": "PDF path missing"}), 400

    # PCloud archive
    try:
        safe_client = client_name.replace(" ", "_")
        safe_address = address.replace(" ", "_")

        pcloud_dir = f"P:/THG Job Directory/Appraisal Files/Active Assignments/{safe_client}/{safe_address}"
        os.makedirs(pcloud_dir, exist_ok=True)

        source_path = os.path.join(os.path.dirname(__file__), "reports", pdf_path)
        dest_path = os.path.join(pcloud_dir, pdf_path)

        shutil.copy(source_path, dest_path)

        print(f"📁 Archived to pCloud: {dest_path}")

    except Exception as e:
        print("⚠️ PCLOUD ERROR:", e)

    # Email (unchanged)
    SMTP_HOST = os.getenv("SMTP_HOST")
    SMTP_PORT = os.getenv("SMTP_PORT")
    SMTP_USER = os.getenv("SMTP_USER")
    SMTP_PASS = os.getenv("SMTP_PASS")
    SMTP_FROM = os.getenv("SMTP_FROM")

    if not all([SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_FROM]):
        print("⚠️ SMTP not configured. Email skipped.")
        return jsonify({"warning": "PDF archived, but email not sent"}), 200

    try:
        msg = MIMEMultipart()
        msg["From"] = SMTP_FROM
        msg["To"] = customer_email
        msg["Subject"] = "Your Appraisal Agreement - The Hammonds Group"

        body = f"""
Dear {client_name},

Attached is your appraisal agreement for the property located at {address}.
Please review the agreement, initial the acknowledgement lines, sign the final page,
and return the completed document.

Thank you,
The Hammonds Group
        """

        msg.attach(MIMEText(body, "plain"))

        with open(source_path, "rb") as f:
            attachment = MIMEApplication(f.read(), Name=pdf_path)
            attachment["Content-Disposition"] = f'attachment; filename="{pdf_path}"'
            msg.attach(attachment)

        server = smtplib.SMTP(SMTP_HOST, int(SMTP_PORT))
        server.starttls()
        server.login(SMTP_USER, SMTP_PASS)
        server.sendmail(SMTP_FROM, customer_email, msg.as_string())
        server.quit()

        print("📨 Email sent successfully.")
        return jsonify({"success": True}), 200

    except Exception as e:
        print("❌ EMAIL ERROR:", e)
        return jsonify({"error": "Email failed"}), 500


if __name__ == "__main__":
    app.run(debug=True)
