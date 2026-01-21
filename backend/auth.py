"""
Authentication module for DentalGPT using Google OAuth
"""
from fastapi import HTTPException, Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from jose import JWTError, jwt
from typing import Optional
import os
import requests
from dotenv import load_dotenv
import psycopg2
from psycopg2.extras import RealDictCursor

load_dotenv()

GOOGLE_CLIENT_ID = os.getenv("GOOGLE_CLIENT_ID")
GOOGLE_CLIENT_SECRET = os.getenv("GOOGLE_CLIENT_SECRET")
JWT_SECRET = os.getenv("JWT_SECRET", "your-secret-key-change-in-production")
JWT_ALGORITHM = "HS256"

security = HTTPBearer()

def get_db_connection():
    return psycopg2.connect(
        host=os.getenv("RDS_HOST", "localhost"),
        port=os.getenv("RDS_PORT", "5432"),
        database=os.getenv("RDS_DATABASE", "dentalgpt"),
        user=os.getenv("RDS_USER", "postgres"),
        password=os.getenv("RDS_PASSWORD", "")
    )

def verify_google_token(token: str) -> dict:
    """Verify Google OAuth token and get user info"""
    try:
        # Try to verify as ID token first (Google One Tap)
        try:
            response = requests.get(
                f"https://oauth2.googleapis.com/tokeninfo?id_token={token}",
                timeout=5
            )
            if response.status_code == 200:
                user_info = response.json()
                return {
                    "id": user_info.get("sub"),
                    "email": user_info.get("email"),
                    "name": user_info.get("name"),
                    "picture": user_info.get("picture")
                }
        except:
            pass
        
        # Fallback: Try as access token
        response = requests.get(
            "https://www.googleapis.com/oauth2/v2/userinfo",
            headers={"Authorization": f"Bearer {token}"},
            timeout=5
        )
        if response.status_code != 200:
            raise HTTPException(status_code=401, detail="Invalid Google token")
        user_info = response.json()
        # Map to our expected format
        return {
            "id": user_info.get("id"),
            "email": user_info.get("email"),
            "name": user_info.get("name"),
            "picture": user_info.get("picture")
        }
    except Exception as e:
        raise HTTPException(status_code=401, detail=f"Token verification failed: {str(e)}")

def get_or_create_user(google_user_info: dict) -> dict:
    """Get or create user in database"""
    conn = get_db_connection()
    cur = conn.cursor(cursor_factory=RealDictCursor)
    
    try:
        # Check if user exists
        cur.execute(
            "SELECT * FROM users WHERE google_id = %s",
            (google_user_info.get("id"),)
        )
        user = cur.fetchone()
        
        if user:
            # Update user info
            cur.execute(
                """UPDATE users 
                   SET email = %s, name = %s, picture_url = %s, updated_at = CURRENT_TIMESTAMP
                   WHERE google_id = %s
                   RETURNING *""",
                (
                    google_user_info.get("email"),
                    google_user_info.get("name"),
                    google_user_info.get("picture"),
                    google_user_info.get("id")
                )
            )
            user = cur.fetchone()
        else:
            # Create new user
            cur.execute(
                """INSERT INTO users (google_id, email, name, picture_url)
                   VALUES (%s, %s, %s, %s)
                   RETURNING *""",
                (
                    google_user_info.get("id"),
                    google_user_info.get("email"),
                    google_user_info.get("name"),
                    google_user_info.get("picture")
                )
            )
            user = cur.fetchone()
        
        conn.commit()
        return dict(user)
    finally:
        cur.close()
        conn.close()

def create_jwt_token(user_id: int) -> str:
    """Create JWT token for user"""
    payload = {"user_id": user_id}
    token = jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)
    return token

def verify_jwt_token(token: str) -> dict:
    """Verify JWT token and return user_id"""
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        return payload
    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid token")

async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)) -> dict:
    """Get current authenticated user"""
    token = credentials.credentials
    payload = verify_jwt_token(token)
    user_id = payload.get("user_id")
    
    conn = get_db_connection()
    cur = conn.cursor(cursor_factory=RealDictCursor)
    
    try:
        cur.execute("SELECT * FROM users WHERE id = %s", (user_id,))
        user = cur.fetchone()
        if not user:
            raise HTTPException(status_code=401, detail="User not found")
        return dict(user)
    finally:
        cur.close()
        conn.close()
