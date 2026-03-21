from fastapi import FastAPI, HTTPException
import uvicorn
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import sqlite3
import bcrypt
import jwt
import datetime

SECRET_KEY = "your-secret-key"  # In production, use environment variable

origins = [
    "http://localhost",
    "http://localhost:5173",
]

app = FastAPI()
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class UserCreate(BaseModel):
    username: str
    password: str

class UserLogin(BaseModel):
    username: str
    password: str

def init_db():
    conn = sqlite3.connect('users.db')
    c = conn.cursor()
    c.execute('''CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY,
        username TEXT UNIQUE,
        password_hash TEXT
    )''')
    conn.commit()
    conn.close()

init_db()

@app.get("/")
def read_root():
    return {"Hello": "World"}

@app.post("/register")
def register(user: UserCreate):
    conn = sqlite3.connect('users.db')
    c = conn.cursor()
    # Check if username exists
    c.execute("SELECT * FROM users WHERE username = ?", (user.username,))
    if c.fetchone():
        conn.close()
        raise HTTPException(status_code=400, detail="Username already exists")
    # Hash password
    hashed = bcrypt.hashpw(user.password.encode('utf-8'), bcrypt.gensalt())
    # Insert
    c.execute("INSERT INTO users (username, password_hash) VALUES (?, ?)", (user.username, hashed.decode('utf-8')))
    conn.commit()
    conn.close()
    # Generate token
    token = jwt.encode(
        {"username": user.username, "exp": datetime.datetime.utcnow() + datetime.timedelta(hours=1)},
        SECRET_KEY,
        algorithm="HS256"
    )
    return {"message": "Account created successfully", "token": token}

@app.post("/login")
def login(user: UserLogin):
    conn = sqlite3.connect('users.db')
    c = conn.cursor()
    c.execute("SELECT password_hash FROM users WHERE username = ?", (user.username,))
    row = c.fetchone()
    conn.close()
    if row and bcrypt.checkpw(user.password.encode('utf-8'), row[0].encode('utf-8')):
        token = jwt.encode(
            {"username": user.username, "exp": datetime.datetime.utcnow() + datetime.timedelta(hours=1)},
            SECRET_KEY,
            algorithm="HS256"
        )
        return {"message": "Login successful", "token": token}
    else:
        raise HTTPException(status_code=400, detail="Invalid credentials")

if __name__ == "__main__":
    uvicorn.run("main:app", host="127.0.0.1", port=8000, log_level="info")
