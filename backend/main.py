from fastapi import UploadFile, File, Form
import os
from fastapi import FastAPI, HTTPException, Request
from fastapi.responses import FileResponse
import uvicorn
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import sqlite3
import bcrypt
import jwt
import datetime

import logging

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
    role: int


class UserLogin(BaseModel):
    username: str
    password: str

class EnrollRequest(BaseModel):
    class_name: str

# style guide: lower case, join with underscores, verb forms (when used) that end in s

# tables (not anymore, but if students and teachers get really complicated, we might want to switch to this):
# users (PRIMARY KEY id, unique username, password_hash)
# students (PRIMARY KEY id, FOREIGN KEY user_id)
# teachers (PRIMARY KEY id, FOREIGN KEY user_id)
# classes (PRIMARY KEY id, name)
# enrollments (PRIMARY KEY/FOREIGN KEY student_id, PRIMARY KEY/FOREIGN KEY class_id)
# teaches (PRIMARY KEY/FOREIGN KEY teacher_id, PRIMRARY KEY/FOREIGN KEY class_id)

def init_db():
    conn = sqlite3.connect('users.db')
    c = conn.cursor()

    c.execute('''CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY,
        username TEXT UNIQUE,
        password_hash TEXT,
        role INT
    )''')

    c.execute('''CREATE TABLE IF NOT EXISTS classes (
        id INTEGER PRIMARY KEY,
        name TEXT NOT NULL UNIQUE
    )''')

    c.execute('''CREATE TABLE IF NOT EXISTS enrollments (
        user_id INTEGER,
        class_id INTEGER,
        PRIMARY KEY(user_id, class_id),
        FOREIGN KEY(user_id) REFERENCES users(id),
        FOREIGN KEY(class_id) REFERENCES classes(id)
    )''')

    c.execute('''CREATE TABLE IF NOT EXISTS teaches (
        user_id INTEGER,
        class_id INTEGER,
        PRIMARY KEY(user_id, class_id),
        FOREIGN KEY(user_id) REFERENCES users(id),
        FOREIGN KEY(class_id) REFERENCES classes(id)
    )''')

    # Modular file uploads: music_scores table (can extend for other file types)
    c.execute('''CREATE TABLE IF NOT EXISTS music_scores (
        id INTEGER PRIMARY KEY,
        class_id INTEGER,
        file_path TEXT NOT NULL,
        uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        file_type TEXT DEFAULT 'pdf',
        FOREIGN KEY(class_id) REFERENCES classes(id)
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
    c.execute("INSERT INTO users (username, password_hash, role) VALUES (?, ?, ?)", (user.username, hashed.decode('utf-8'), user.role))

    conn.commit()
    conn.close()
    # Generate token
    token = jwt.encode(
        {"username": user.username, "role": user.role, "exp": datetime.datetime.utcnow() + datetime.timedelta(hours=1)},
        SECRET_KEY,
        algorithm="HS256"
    )
    return {"message": "Account created successfully", "token": token}

@app.post("/login")
def login(user: UserLogin):
    conn = sqlite3.connect('users.db')
    c = conn.cursor()
    c.execute("SELECT password_hash, role FROM users WHERE username = ?", (user.username,))
    row = c.fetchone()
    conn.close()
    if row and bcrypt.checkpw(user.password.encode('utf-8'), row[0].encode('utf-8')):
        role = row[1]
        token = jwt.encode(
            {"username": user.username, "role": role, "exp": datetime.datetime.utcnow() + datetime.timedelta(hours=1)},
            SECRET_KEY,
            algorithm="HS256"
        )
        return {"message": "Login successful", "token": token}
    else:
        raise HTTPException(status_code=400, detail="Invalid credentials")

@app.get("/enrollments")
def enrollments(request: Request):
    auth_header = request.headers.get("authorization")
    if not auth_header or not auth_header.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing or invalid Authorization header")
    token = auth_header.split(" ")[1]
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=["HS256"])
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=400, detail="Expired credentials")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=400, detail="Invalid token")

    username = payload["username"]

    conn = sqlite3.connect('users.db')
    c = conn.cursor()
    # Get user id
    c.execute("SELECT id FROM users WHERE username = ?", (username,))
    user_row = c.fetchone()
    if not user_row:
        conn.close()
        raise HTTPException(status_code=404, detail="User not found")
    user_id = user_row[0]

    # Get class names for enrollments
    c.execute("""
        SELECT classes.name
        FROM enrollments
        JOIN classes ON enrollments.class_id = classes.id
        WHERE enrollments.user_id = ?
        LIMIT 50
    """, (user_id,))
    classes = [row[0] for row in c.fetchall()]
    conn.close()
    return {"enrollments": classes}

@app.post("/do-enroll")
def do_enroll(request: Request, enroll: EnrollRequest):
    """Remove in future (sandbox only, not production). TODO: teachers or some information system should perform enrollments with authentication"""
    payload = try_get_payload_from_request(request)

    username = payload["username"]
    class_name = enroll.class_name

    # username -> users
    # class name -> classes (class id)
    # insert user id, class id into enrollments

    conn = sqlite3.connect('users.db')
    c = conn.cursor()

    # Get user id
    c.execute("SELECT id FROM users WHERE username = ?", (username,))
    user_row = c.fetchone()
    if not user_row:
        conn.close()
        raise HTTPException(status_code=404, detail="User not found")
    user_id = user_row[0]

    # Get class id
    c.execute("SELECT id FROM classes WHERE name = ?", (class_name,))
    class_row = c.fetchone()
    if not class_row:
        conn.close()
        raise HTTPException(status_code=404, detail="Class not found")
    class_id = class_row[0]

    # Insert into enrollments
    try:
        c.execute("INSERT INTO enrollments (user_id, class_id) VALUES (?, ?)", (user_id, class_id))
        conn.commit()
    except sqlite3.IntegrityError:
        conn.close()
        raise HTTPException(status_code=400, detail="Already enrolled or invalid enrollment")
    conn.close()
    return {"message": f"Enrolled in {class_name} successfully"}


class CreateClassRequest(BaseModel):
    class_name: str

@app.post("/create-class")
def create_class(request: Request, create: CreateClassRequest):
    payload = try_get_payload_from_request(request)
    class_name = create.class_name

    conn = sqlite3.connect('users.db')
    c = conn.cursor()
    # Check if class already exists (enforced by UNIQUE constraint, but check for user-friendly error)
    c.execute("SELECT id FROM classes WHERE name = ?", (class_name,))
    if c.fetchone():
        conn.close()
        raise HTTPException(status_code=400, detail="Class already exists")
    try:
        c.execute("INSERT INTO classes (name) VALUES (?)", (class_name,))
        conn.commit()
    except sqlite3.IntegrityError:
        conn.close()
        raise HTTPException(status_code=400, detail="Class already exists (unique constraint)")
    conn.close()
    return {"message": f"Class '{class_name}' created successfully"}

def try_get_payload_from_request(request: Request):
    auth_header = request.headers.get("authorization")
    if not auth_header or not auth_header.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing or invalid Authorization header")
    token = auth_header.split(" ")[1]
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=["HS256"])
        return payload
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=400, detail="Expired credentials")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=400, detail="Invalid token")


# --- Music Score Endpoints ---

UPLOAD_DIR = "uploaded_scores"
os.makedirs(UPLOAD_DIR, exist_ok=True)

# Upload a music score (PDF) for a class
@app.post("/upload-music-score")
async def upload_music_score(request: Request, class_name: str = Form(...), file: UploadFile = File(...)):
    payload = try_get_payload_from_request(request)
    # Optionally: check instructor permissions here
    # Save file
    if (not file.filename) or (not file.filename.lower().endswith(".pdf")):
        raise HTTPException(status_code=400, detail="Only PDF files are supported")
    file_path = os.path.join(UPLOAD_DIR, f"{class_name}_{int(datetime.datetime.utcnow().timestamp())}_{file.filename}")

    # Insert into DB
    conn = sqlite3.connect('users.db')
    c = conn.cursor()

    # get class id
    c.execute("SELECT id FROM classes WHERE name = ?", (class_name,))
    class_row = c.fetchone()
    if not class_row:
        conn.close()
        raise HTTPException(status_code=404, detail="Class not found")
    class_id = class_row[0]

    c.execute("INSERT INTO music_scores (class_id, file_path, file_type) VALUES (?, ?, ?)", (class_id, file_path, "pdf"))

    # upload file only if everything is valid. If upload files, rollback commit (keep storage and db in sync)
    try:
        with open(file_path, "wb") as f:
            f.write(await file.read())
        conn.commit()
    except Exception:
        conn.rollback()
        raise HTTPException(status_code=400, detail=str(Exception))

    conn.close()
    return {"message": "File uploaded successfully", "file_path": file_path}

# Fetch all files for a class
@app.get("/music-scores")
def get_music_scores(class_name: str):
    conn = sqlite3.connect('users.db')
    c = conn.cursor()

    c.execute("SELECT id FROM classes WHERE name = ?", (class_name,))
    class_row = c.fetchone()
    if not class_row:
        conn.close()
        raise HTTPException(status_code=404, detail="Class not found")
    class_id = class_row[0]

    c.execute("SELECT id, file_path, uploaded_at FROM music_scores WHERE class_id = ? ORDER BY uploaded_at DESC", (class_id,))
    files = [
        {"id": row[0], "file_path": row[1], "uploaded_at": row[2]}
        for row in c.fetchall()
    ]
    conn.close()
    return {"files": files}

# Fetch N most recent files (across all classes or for a class)
@app.get("/music-scores/recent")
def get_recent_music_scores(limit: int = 3, class_name: str|None = None):
    conn = sqlite3.connect('users.db')
    c = conn.cursor()
    if class_name is not None:
        c.execute("SELECT id FROM classes WHERE name = ?", (class_name,))
        class_row = c.fetchone()
        if not class_row:
            conn.close()
            raise HTTPException(status_code=404, detail="Class not found")
        class_id = class_row[0]
        c.execute("SELECT id, file_path, uploaded_at FROM music_scores WHERE class_id = ? ORDER BY uploaded_at DESC LIMIT ?", (class_id, limit))
    else:
        c.execute("SELECT id, file_path, uploaded_at FROM music_scores ORDER BY uploaded_at DESC LIMIT ?", (limit,))
    files = [
        {"id": row[0], "file_path": row[1], "uploaded_at": row[2]}
        for row in c.fetchall()
    ]
    conn.close()
    return {"files": files}

if __name__ == "__main__":
    uvicorn.run("main:app", host="127.0.0.1", port=8000, log_level="info")

class TeachClassRequest(BaseModel):
    class_name: str

# Endpoint for instructor to start teaching a class
@app.post("/start-teaching")
def start_teaching(request: Request, teach: TeachClassRequest):
    payload = try_get_payload_from_request(request)
    username = payload["username"]
    # Get user id
    conn = sqlite3.connect('users.db')
    c = conn.cursor()
    c.execute("SELECT id, role FROM users WHERE username = ?", (username,))
    user_row = c.fetchone()
    if not user_row:
        conn.close()
        raise HTTPException(status_code=404, detail="User not found")
    user_id, role = user_row
    if role != 1:
        conn.close()
        raise HTTPException(status_code=403, detail="Only instructors can teach classes")
    # Get class id
    c.execute("SELECT id FROM classes WHERE name = ?", (teach.class_name,))
    class_row = c.fetchone()
    if not class_row:
        conn.close()
        raise HTTPException(status_code=404, detail="Class not found")
    class_id = class_row[0]
    # Insert into teaches
    try:
        c.execute("INSERT INTO teaches (user_id, class_id) VALUES (?, ?)", (user_id, class_id))
        conn.commit()
    except sqlite3.IntegrityError:
        conn.close()
        raise HTTPException(status_code=400, detail="Already teaching this class")
    conn.close()
    return {"message": f"Now teaching {teach.class_name}"}

@app.get("/files/uploaded_scores/{file_name}")
def get_uploaded_score_file(file_name: str):
    safe_name = os.path.basename(file_name)
    if safe_name != file_name:
        raise HTTPException(status_code=400, detail="Invalid file name")

    if not safe_name.lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Only PDF files are supported")

    file_path = os.path.join(UPLOAD_DIR, safe_name)
    if not os.path.isfile(file_path):
        raise HTTPException(status_code=404, detail="File not found")

    return FileResponse(
        file_path,
        media_type="application/pdf",
        filename=safe_name,
        content_disposition_type="inline"
        #headers={
        #    "Content-Disposition": "inline"
        #}
        )
