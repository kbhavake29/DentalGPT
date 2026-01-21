#!/usr/bin/env python3
"""
Fix image column in chat_messages table:
1. Remove the index (base64 images are too large for indexes)
2. Change column type to BYTEA for better storage of binary data (optional, TEXT works too)
"""
import os
import sys
import psycopg2
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

def get_db_connection():
    """Get PostgreSQL database connection"""
    return psycopg2.connect(
        host=os.getenv("RDS_HOST", "localhost"),
        port=os.getenv("RDS_PORT", "5432"),
        database=os.getenv("RDS_DB", "dentalgpt"),
        user=os.getenv("RDS_USER", os.getenv("USER")),
        password=os.getenv("RDS_PASSWORD", "")
    )

def main():
    """Fix image column in chat_messages table"""
    try:
        conn = get_db_connection()
        cur = conn.cursor()
        
        # Drop the index if it exists (this is causing the error)
        try:
            cur.execute("DROP INDEX IF EXISTS idx_chat_messages_image")
            print("Dropped index on image column")
        except Exception as e:
            print(f"Note: Could not drop index (may not exist): {e}")
        
        # Check if column exists
        cur.execute("""
            SELECT column_name, data_type
            FROM information_schema.columns 
            WHERE table_name = 'chat_messages' AND column_name = 'image'
        """)
        
        column_info = cur.fetchone()
        if column_info:
            print(f"Column 'image' exists with type: {column_info[1]}")
            # TEXT is fine for base64, we just don't want an index on it
        else:
            # Add image column if it doesn't exist
            cur.execute("ALTER TABLE chat_messages ADD COLUMN image TEXT")
            print("Added 'image' column to chat_messages table")
        
        conn.commit()
        cur.close()
        conn.close()
        print("Migration completed successfully!")
        print("Note: Image column is now TEXT without an index, which can store large base64 strings.")
        
    except Exception as e:
        print(f"Error running migration: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)

if __name__ == "__main__":
    main()
