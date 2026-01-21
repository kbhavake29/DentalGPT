#!/usr/bin/env python3
"""
Migration script to update patients table with new columns
"""
import psycopg2
import os
from dotenv import load_dotenv

# Load environment variables
load_dotenv(dotenv_path=os.path.join(os.path.dirname(__file__), "..", ".env"))

def get_db_connection():
    return psycopg2.connect(
        host=os.getenv("RDS_HOST", "localhost"),
        port=os.getenv("RDS_PORT", "5432"),
        database=os.getenv("RDS_DATABASE", "dentalgpt"),
        user=os.getenv("RDS_USER", "postgres"),
        password=os.getenv("RDS_PASSWORD", "")
    )

def migrate_patients_table():
    """Add missing columns to patients table if they don't exist"""
    conn = get_db_connection()
    cur = conn.cursor()
    
    try:
        # Check if patients table exists
        cur.execute("""
            SELECT EXISTS (
                SELECT FROM information_schema.tables 
                WHERE table_name = 'patients'
            );
        """)
        table_exists = cur.fetchone()[0]
        
        if not table_exists:
            print("Creating patients table...")
            cur.execute("""
                CREATE TABLE patients (
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
            """)
            print("✓ Patients table created")
        else:
            print("Patients table exists, checking for missing columns...")
            
            # Check if user_id exists
            cur.execute("""
                SELECT EXISTS (
                    SELECT FROM information_schema.columns 
                    WHERE table_name = 'patients' AND column_name = 'user_id'
                );
            """)
            if not cur.fetchone()[0]:
                print("Adding user_id column to patients table...")
                cur.execute("""
                    ALTER TABLE patients 
                    ADD COLUMN user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE;
                """)
                print("✓ Added user_id column")
            else:
                print("✓ user_id column already exists")
            
            # List of columns to add
            columns_to_add = [
                ("phone", "VARCHAR(50)"),
                ("date_of_birth", "DATE"),
                ("gender", "VARCHAR(20)"),
                ("address", "TEXT"),
                ("medical_history", "TEXT"),
                ("dental_history", "TEXT"),
                ("allergies", "TEXT"),
                ("medications", "TEXT"),
                ("summary", "TEXT"),
            ]
            
            for column_name, column_type in columns_to_add:
                cur.execute("""
                    SELECT EXISTS (
                        SELECT FROM information_schema.columns 
                        WHERE table_name = 'patients' AND column_name = %s
                    );
                """, (column_name,))
                
                if not cur.fetchone()[0]:
                    print(f"Adding column: {column_name}...")
                    cur.execute(f"ALTER TABLE patients ADD COLUMN {column_name} {column_type};")
                    print(f"✓ Added column: {column_name}")
                else:
                    print(f"✓ Column {column_name} already exists")
        
        # Add patient_id to chats table if it doesn't exist
        cur.execute("""
            SELECT EXISTS (
                SELECT FROM information_schema.columns 
                WHERE table_name = 'chats' AND column_name = 'patient_id'
            );
        """)
        if not cur.fetchone()[0]:
            print("Adding patient_id column to chats table...")
            cur.execute("""
                ALTER TABLE chats 
                ADD COLUMN patient_id VARCHAR(50) 
                REFERENCES patients(id) ON DELETE SET NULL;
            """)
            print("✓ Added patient_id to chats table")
        else:
            print("✓ patient_id column already exists in chats table")
        
        # Create indexes if they don't exist
        indexes = [
            ("idx_patients_user_id", "patients(user_id)"),
            ("idx_patients_name", "patients(name)"),
            ("idx_chats_patient_id", "chats(patient_id)"),
        ]
        
        for index_name, index_def in indexes:
            cur.execute(f"""
                SELECT EXISTS (
                    SELECT FROM pg_indexes 
                    WHERE indexname = '{index_name}'
                );
            """)
            if not cur.fetchone()[0]:
                print(f"Creating index: {index_name}...")
                cur.execute(f"CREATE INDEX {index_name} ON {index_def};")
                print(f"✓ Created index: {index_name}")
            else:
                print(f"✓ Index {index_name} already exists")
        
        conn.commit()
        print("\n✅ Migration completed successfully!")
        
    except Exception as e:
        conn.rollback()
        print(f"\n❌ Migration failed: {e}")
        raise
    finally:
        cur.close()
        conn.close()

if __name__ == "__main__":
    print("Migrating patients table...")
    print("=" * 50)
    migrate_patients_table()
