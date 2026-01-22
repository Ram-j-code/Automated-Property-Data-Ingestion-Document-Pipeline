import os
import time
from typing import Optional

from dotenv import load_dotenv

from selenium import webdriver
from selenium.webdriver.chrome.service import Service
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC


# ===========================================================
# ENV
# ===========================================================
load_dotenv()

CRS_LOCALLOOK_URL = "https://www.crsdata.com/LocalLook/"
CRS_LOGIN_URL = "https://www.crsdata.com/login/?ReturnUrl=%2fLocalLook%2f"

CRS_USERNAME = os.getenv("CRS_USERNAME", "")
CRS_PASSWORD = os.getenv("CRS_PASSWORD", "")

CHROME_BINARY = os.getenv("CHROME_BINARY")
CHROMEDRIVER_PATH = os.getenv("CHROMEDRIVER_PATH")
CHROME_PROFILE = os.getenv("CHROME_PROFILE")


# ===========================================================
# SINGLETON DRIVER (LOCKED)
# ===========================================================
_driver: Optional[webdriver.Chrome] = None


def _create_driver() -> webdriver.Chrome:
    if not CHROMEDRIVER_PATH or not os.path.exists(CHROMEDRIVER_PATH):
        raise RuntimeError("CHROMEDRIVER_PATH invalid or missing")

    options = Options()
    options.add_argument("--start-maximized")
    options.add_argument("--disable-blink-features=AutomationControlled")

    if CHROME_BINARY:
        options.binary_location = CHROME_BINARY

    if CHROME_PROFILE:
        options.add_argument(f"--user-data-dir={CHROME_PROFILE}")

    service = Service(CHROMEDRIVER_PATH)
    driver = webdriver.Chrome(service=service, options=options)
    driver.implicitly_wait(2)
    return driver


def get_driver() -> webdriver.Chrome:
    """
    LOCKED:
    - Single Chrome instance
    - Never closed between requests
    - CRS session persists
    """
    global _driver

    if _driver is None:
        print("🚀 Launching CRS Chrome (singleton)")
        _driver = _create_driver()

    return _driver


# ===========================================================
# AUTH DETECTION (DOM-BASED, CRS-SAFE)
# ===========================================================
def _has_active_session(driver) -> bool:
    try:
        WebDriverWait(driver, 10).until(
            EC.any_of(
                EC.presence_of_element_located((By.ID, "Main_searchText")),
                EC.presence_of_element_located((By.CSS_SELECTOR, ".select2-container")),
            )
        )
        return True
    except Exception:
        return False


def _login_form_present(driver) -> bool:
    try:
        driver.find_element(By.ID, "UserName")
        driver.find_element(By.ID, "Password")
        return True
    except Exception:
        return False


# ===========================================================
# LOGIN (ONLY IF REQUIRED)
# ===========================================================
def ensure_logged_in(driver):
    driver.get(CRS_LOCALLOOK_URL)
    time.sleep(1)

    if _has_active_session(driver):
        print("🔓 CRS session active — login skipped")
        return

    print("🔐 CRS session not detected — logging in")

    if not CRS_USERNAME or not CRS_PASSWORD:
        raise RuntimeError("CRS credentials missing")

    if not _login_form_present(driver):
        driver.get(CRS_LOGIN_URL)

    user_box = WebDriverWait(driver, 20).until(
        EC.presence_of_element_located((By.ID, "UserName"))
    )
    pass_box = driver.find_element(By.ID, "Password")

    user_box.clear()
    pass_box.clear()
    user_box.send_keys(CRS_USERNAME)
    pass_box.send_keys(CRS_PASSWORD)

    driver.find_element(
        By.XPATH, "//input[@type='submit' and contains(@value,'Log')]"
    ).click()

    WebDriverWait(driver, 20).until(
        EC.presence_of_element_located((By.ID, "Main_searchText"))
    )

    print("✅ CRS login successful")


# ===========================================================
# COUNTY SELECTION (UNCHANGED LOGIC)
# ===========================================================
def select_county(driver, county_name: str):
    print(f"📍 Selecting county: {county_name}")

    if not county_name:
        return

    try:
        try:
            close_btn = driver.find_element(By.CSS_SELECTOR, "a.select2-search-choice-close")
            close_btn.click()
            time.sleep(0.25)
        except Exception:
            pass

        dropdown = WebDriverWait(driver, 10).until(
            EC.element_to_be_clickable((By.CSS_SELECTOR, ".select2-container"))
        )
        dropdown.click()
        time.sleep(0.35)

        results = WebDriverWait(driver, 10).until(
            EC.presence_of_element_located((By.CSS_SELECTOR, ".select2-results"))
        )

        for _ in range(50):
            try:
                option = results.find_element(
                    By.XPATH, f".//div[contains(text(), '{county_name}')]"
                )
                driver.execute_script("arguments[0].scrollIntoView(true);", option)
                time.sleep(0.15)
                option.click()
                print("✅ County selected")
                return
            except Exception:
                driver.execute_script("arguments[0].scrollTop += 200;", results)
                time.sleep(0.12)

        raise RuntimeError("County not found")

    except Exception as e:
        print("❌ County selection error:", e)
        raise


# ===========================================================
# ADDRESS ENTRY
# ===========================================================
def type_address_and_submit(driver, full_address: str):
    print(f"🏠 Typing address: {full_address}")

    addr_box = WebDriverWait(driver, 20).until(
        EC.element_to_be_clickable((By.ID, "Main_searchText"))
    )
    addr_box.clear()
    addr_box.send_keys(full_address)
    time.sleep(0.8)

    WebDriverWait(driver, 15).until(
        EC.element_to_be_clickable(
            (By.XPATH, "//em[normalize-space()='SUBMIT']/ancestor::*[self::button or self::a]")
        )
    ).click()

    time.sleep(2.5)


# ===========================================================
# PARCEL EXTRACTION
# ===========================================================
def extract_parcel_from_detail(driver) -> Optional[str]:
    print("🔎 Extracting parcel ID")

    try:
        el = WebDriverWait(driver, 20).until(
            EC.presence_of_element_located(
                (
                    By.XPATH,
                    "//th[contains(text(), 'Parcel ID')]/following-sibling::td[1]//span",
                )
            )
        )
        parcel_id = el.text.strip().replace("\u00a0", " ")
        print(f"✅ Parcel ID FOUND: {parcel_id}")
        return parcel_id
    except Exception as e:
        print("❌ Parcel extraction failed:", e)
        return None


# ===========================================================
# PUBLIC ENTRY (CALLED BY FLASK)
# ===========================================================
def get_parcel_id_from_ui(full_address: str, county_name: str) -> Optional[str]:
    print(f"📌 UI BOT FETCH: {full_address} — {county_name}")

    driver = get_driver()

    try:
        ensure_logged_in(driver)
        driver.get(CRS_LOCALLOOK_URL)
        time.sleep(1.2)

        select_county(driver, county_name)
        type_address_and_submit(driver, full_address)
        return extract_parcel_from_detail(driver)

    except Exception as e:
        print("❌ CRS BOT ERROR:", e)
        return None
