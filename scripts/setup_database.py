#!/usr/bin/env python3
"""
Database setup script for DentalGPT
Creates all necessary tables for authentication and chat functionality
"""
import os
import sys
import psycopg2
from dotenv import load_dotenv

# Load environment variables
load_dotenv(dotenv_path=os.path.join(os.path.dirname(__file__), "..", ".env"))

def get_db_connection():
    """Get database connection from environment variables"""
    return psycopg2.connect(
        host=os.getenv("RDS_HOST", "localhost"),
        port=os.getenv("RDS_PORT", "5432"),
        database=os.getenv("RDS_DATABASE", "dentalgpt"),
        user=os.getenv("RDS_USER", "postgres"),
        password=os.getenv("RDS_PASSWORD", "")
    )

def setup_database():
    """Create all necessary database tables"""
    sql_file = os.path.join(os.path.dirname(__file__), "setup_database.sql")
    
    try:
        # Read SQL file
        with open(sql_file, 'r') as f:
            sql_script = f.read()
        
        # Connect to database
        conn = get_db_connection()
        cur = conn.cursor()
        
        # Execute SQL script
        cur.execute(sql_script)
        
        # Commit changes
        conn.commit()
        
        print("✅ Database tables created successfully!")
        print("\nCreated tables:")
        print("  - users (for authentication)")
        print("  - chats (for user chat sessions)")
        print("  - chat_messages (for chat messages)")
        print("  - dental_queries (updated with user_id)")
        print("  - patients (for future expansion)")
        print("\n✅ All indexes created!")
        
        cur.close()
        conn.close()
        
    except psycopg2.Error as e:
        print(f"❌ Database error: {e}")
        sys.exit(1)
    except FileNotFoundError:
        print(f"❌ SQL file not found: {sql_file}")
        sys.exit(1)
    except Exception as e:
        print(f"❌ Error: {e}")
        sys.exit(1)

if __name__ == "__main__":
    print("Setting up DentalGPT database...")
    print("=" * 50)
    setup_database()
    print("=" * 50)
    print("✅ Setup complete! You can now use the application.")
