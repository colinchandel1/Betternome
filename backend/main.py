from fastapi import FastAPI, HTTPException, Request
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
    role: int


class UserLogin(BaseModel):
    username: str
    password: str

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
        name TEXT NOT NULL
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

if __name__ == "__main__":
    uvicorn.run("main:app", host="127.0.0.1", port=8000, log_level="info")
