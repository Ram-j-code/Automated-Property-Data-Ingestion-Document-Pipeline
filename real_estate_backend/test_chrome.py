from selenium import webdriver
from selenium.webdriver.chrome.service import Service
from selenium.webdriver.chrome.options import Options

driver_path = r"C:/Users/advik/OneDrive/Desktop/Project/real_estate_backend/drivers/chromedriver.exe"
chrome_path = r"C:/Program Files/Google/Chrome/Application/chrome.exe"

options = Options()
options.add_argument("--start-maximized")
options.binary_location = chrome_path

service = Service(driver_path)
driver = webdriver.Chrome(service=service, options=options)

driver.get("https://google.com")
