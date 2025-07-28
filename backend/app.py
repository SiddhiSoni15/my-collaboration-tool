# Import necessary libraries
from flask import Flask, render_template, request
from flask_socketio import SocketIO, emit
import sqlite3
import datetime
import json
import os

# Define the path for the SQLite database file
DATABASE_FILE = 'chat_messages.db'

# Initialize Flask app
app = Flask(__name__)
app.config['SECRET_KEY'] = 'your_strong_secret_key_for_sqlite_app' # Replace with a strong secret key
socketio = SocketIO(app, cors_allowed_origins="*", message_queue=None)

# --- SQLite Database Initialization ---
def init_db():
    """
    Initializes the SQLite database: creates the table if it doesn't exist.
    """
    conn = None
    try:
        conn = sqlite3.connect(DATABASE_FILE)
        cursor = conn.cursor()
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS messages (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user TEXT NOT NULL,
                text TEXT NOT NULL,
                timestamp TEXT NOT NULL
            )
        ''')
        conn.commit()
        print(f"SQLite database '{DATABASE_FILE}' initialized successfully.")
    except sqlite3.Error as e:
        print(f"Error initializing SQLite database: {e}")
    finally:
        if conn:
            conn.close()

# Call database initialization when the app starts
with app.app_context():
    init_db()

# --- Helper function to get a database connection ---
def get_db_connection():
    """Returns a new SQLite database connection."""
    conn = sqlite3.connect(DATABASE_FILE)
    conn.row_factory = sqlite3.Row # This allows accessing columns by name
    return conn

# --- SocketIO Event Handlers ---

@socketio.on('connect')
def handle_connect():
    """Handles new client connections."""
    print('Client connected:', request.sid)
    # Send historical messages to the newly connected client
    conn = None
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        # Fetch last 100 messages, ordered by timestamp (oldest first)
        cursor.execute("SELECT user, text, timestamp FROM messages ORDER BY timestamp ASC LIMIT 100")
        rows = cursor.fetchall()
        messages = [dict(row) for row in rows] # Convert rows to dictionaries
        emit('initial_messages', {'messages': messages}, room=request.sid)
    except sqlite3.Error as e:
        print(f"Error fetching initial messages from SQLite: {e}")
    finally:
        if conn:
            conn.close()

@socketio.on('disconnect')
def handle_disconnect():
    """Handles client disconnections."""
    print('Client disconnected:', request.sid)

@socketio.on('message')
def handle_message(data):
    """
    Handles incoming messages from clients.
    Saves the message to SQLite and broadcasts it to all connected clients.
    """
    print('Received message:', data)
    user = data.get('user', 'Anonymous')
    text = data.get('text', '')
    # Use ISO format for timestamp as it's easily parseable in JavaScript
    timestamp = datetime.datetime.now(datetime.timezone.utc).isoformat()

    if not text.strip():
        print("Empty message received, not processing.")
        return

    message_data = {
        'user': user,
        'text': text,
        'timestamp': timestamp
    }

    conn = None
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        # Insert message into SQLite
        cursor.execute("INSERT INTO messages (user, text, timestamp) VALUES (?, ?, ?)",
                       (user, text, timestamp))
        conn.commit()
        print(f"Message saved to SQLite: {message_data}")

        # Emit the message to all connected clients in real-time
        emit('new_message', message_data, broadcast=True)
    except sqlite3.Error as e:
        print(f"Error saving message to SQLite or broadcasting: {e}")
    finally:
        if conn:
            conn.close()

# Basic route for testing (optional, can be removed in production)
@app.route('/')
def index():
    return "<h1>Real-time Collaboration Backend (SQLite) is Running!</h1><p>Connect via WebSocket.</p>"

# Run the Flask app with SocketIO
if __name__ == '__main__':
    # Use '0.0.0.0' to make the server accessible from other machines in a network
    # For local development, '127.0.0.1' or 'localhost' is often sufficient
    print("Starting Flask-SocketIO server with SQLite backend...")
    socketio.run(app, host='0.0.0.0', port=5000, debug=True, allow_unsafe_werkzeug=True)
