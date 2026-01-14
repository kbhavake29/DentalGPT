-- PostgreSQL database setup for DentalGPT
-- Run this script to create the necessary tables

CREATE TABLE IF NOT EXISTS dental_queries (
    id SERIAL PRIMARY KEY,
    patient_id VARCHAR(50),
    query_text TEXT NOT NULL,
    ai_response TEXT NOT NULL,
    source_docs JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_patient_id ON dental_queries(patient_id);
CREATE INDEX IF NOT EXISTS idx_created_at ON dental_queries(created_at DESC);

-- Optional: Create a patients table for future expansion
CREATE TABLE IF NOT EXISTS patients (
    id VARCHAR(50) PRIMARY KEY,
    name VARCHAR(255),
    email VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
