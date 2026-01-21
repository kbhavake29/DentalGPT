#!/usr/bin/env python3
"""
Add image column to chat_messages table for storing base64 image data
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
    """Add image column to chat_messages table"""
    try:
        conn = get_db_connection()
        cur = conn.cursor()
        
        # Check if column exists
        cur.execute("""
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_name = 'chat_messages' AND column_name = 'image'
        """)
        
        if cur.fetchone():
            print("Column 'image' already exists in chat_messages table")
        else:
            # Add image column
            cur.execute("ALTER TABLE chat_messages ADD COLUMN image TEXT")
            print("Added 'image' column to chat_messages table")
            
            # Create index for non-null images
            cur.execute("""
                CREATE INDEX IF NOT EXISTS idx_chat_messages_image 
                ON chat_messages(image) 
                WHERE image IS NOT NULL
            """)
            print("Created index on image column")
        
        conn.commit()
        cur.close()
        conn.close()
        print("Migration completed successfully!")
        
    except Exception as e:
        print(f"Error running migration: {e}")
        sys.exit(1)

if __name__ == "__main__":
    main()
