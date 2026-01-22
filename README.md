# Automated Property Data Ingestion & Document Pipeline

## Overview

This project is an automated pipeline for property data, designed for real estate data ingestion and document generation.  
It extracts semi-structured property and parcel data from external sources, validates and transforms the data, and produces structured outputs such as PDF engagement letters.

I designed and implemented the **end-to-end data pipeline**, including data ingestion, validation, transformation, document generation, and optional email distribution.

## Features

- Automated data ingestion from county systems using Python and Selenium
- REST API orchestration for step-by-step pipeline control
- Validation and transformation of property data
- Generates PDFs for downstream use
- Optional email sending to customers
- Cloud-ready design (AWS-compatible)

## Tech Stack

- Python 3.x (data processing and automation)
- Flask (REST API orchestration)
- Selenium (headless data extraction bot)
- React (frontend wizard UI)
- AWS-ready deployment (EC2 / Lambda compatible)

## Project Structure

/project-folder
│
├─ app.py # Flask backend orchestrator
├─ crs_ui_bot.py # Selenium parcel bot for automated parcel fetching
├─ App.js # React frontend wizard UI
├─ templates/ # Docx template files for reports
├─ reports/ # Folder where generated PDF reports are stored
└─ README.md # This README file

## How it Works

1. Users input property address and client information via the wizard UI
2. Parcel data is fetched from county sources automatically
3. PDF engagement letters are generated using Docx templates
4. Optional email distribution to customers
5. Project designed for future cloud deployment

## Notes

- No real company data is included; all data is sanitized
- Safe to explore and use as a portfolio project

## Flowchart

User Input (React UI)  
 ↓  
Flask API (app.py)  
 ↓  
CRS Bot (crs_ui_bot.py)  
 ↓  
Data Processing & Validation  
 ↓  
Document Generation (templates → reports)  
 ↓  
Email / Cloud Storage (pCloud)
