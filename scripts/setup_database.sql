-- PostgreSQL database setup for DentalGPT
-- Run this script to create the necessary tables

-- Users table for authentication
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    google_id VARCHAR(255) UNIQUE NOT NULL,
    email VARCHAR(255) NOT NULL,
    name VARCHAR(255),
    picture_url TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Chats table for storing user chat sessions
CREATE TABLE IF NOT EXISTS chats (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    patient_id VARCHAR(50) REFERENCES patients(id) ON DELETE SET NULL,
    title VARCHAR(255) NOT NULL,
    is_favorite BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Add is_favorite column if it doesn't exist (for existing databases)
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'chats' AND column_name = 'is_favorite'
    ) THEN
        ALTER TABLE chats ADD COLUMN is_favorite BOOLEAN DEFAULT FALSE;
    END IF;
END $$;

-- Chat messages table
CREATE TABLE IF NOT EXISTS chat_messages (
    id SERIAL PRIMARY KEY,
    chat_id INTEGER NOT NULL REFERENCES chats(id) ON DELETE CASCADE,
    message_type VARCHAR(10) NOT NULL CHECK (message_type IN ('user', 'ai')),
    content TEXT NOT NULL,
    sources JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Original dental_queries table (keeping for backward compatibility)
CREATE TABLE IF NOT EXISTS dental_queries (
    id SERIAL PRIMARY KEY,
    patient_id VARCHAR(50),
    query_text TEXT NOT NULL,
    ai_response TEXT NOT NULL,
    source_docs JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Add user_id column if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'dental_queries' AND column_name = 'user_id'
    ) THEN
        ALTER TABLE dental_queries ADD COLUMN user_id INTEGER REFERENCES users(id) ON DELETE SET NULL;
    END IF;
END $$;

-- Create indexes for faster queries
CREATE INDEX IF NOT EXISTS idx_users_google_id ON users(google_id);
CREATE INDEX IF NOT EXISTS idx_chats_user_id ON chats(user_id);
CREATE INDEX IF NOT EXISTS idx_chats_patient_id ON chats(patient_id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_chat_id ON chat_messages(chat_id);
CREATE INDEX IF NOT EXISTS idx_patient_id ON dental_queries(patient_id);
CREATE INDEX IF NOT EXISTS idx_created_at ON dental_queries(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_dental_queries_user_id ON dental_queries(user_id);
CREATE INDEX IF NOT EXISTS idx_patients_user_id ON patients(user_id);
CREATE INDEX IF NOT EXISTS idx_patients_name ON patients(name);
CREATE INDEX IF NOT EXISTS idx_patient_documents_patient_id ON patient_documents(patient_id);
CREATE INDEX IF NOT EXISTS idx_patient_documents_user_id ON patient_documents(user_id);

-- Patients table for clinic patient management
CREATE TABLE IF NOT EXISTS patients (
    id VARCHAR(50) PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255),
    phone VARCHAR(50),
    date_of_birth DATE,
    gender VARCHAR(20),
    address TEXT,
    medical_history TEXT,
    dental_history TEXT,
    allergies TEXT,
    medications TEXT,
    summary TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Patient documents table for storing X-rays, reports, etc.
CREATE TABLE IF NOT EXISTS patient_documents (
    id SERIAL PRIMARY KEY,
    patient_id VARCHAR(50) NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    document_type VARCHAR(50) NOT NULL, -- 'xray', 'report', 'document', 'procedure_history'
    file_name VARCHAR(255) NOT NULL,
    file_path TEXT,
    file_size INTEGER,
    description TEXT,
    uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Add patient_id column to chats if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'chats' AND column_name = 'patient_id'
    ) THEN
        ALTER TABLE chats ADD COLUMN patient_id VARCHAR(50) REFERENCES patients(id) ON DELETE SET NULL;
    END IF;
END $$;
