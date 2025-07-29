# Import necessary libraries
from flask import Flask, request
from flask_socketio import SocketIO, emit
from sqlalchemy import create_engine, text, inspect
from sqlalchemy.exc import OperationalError
import datetime
import json
import os
import time

# Initialize Flask app
app = Flask(__name__)
app.config['SECRET_KEY'] = os.environ.get('SECRET_KEY', 'your_default_secret_key') # Use env var for secret key

# --- PostgreSQL Database Configuration ---
DATABASE_URL = os.environ.get('DATABASE_URL')

db_engine = None
if DATABASE_URL:
    try:
        if DATABASE_URL.startswith("postgres://"):
            DATABASE_URL = DATABASE_URL.replace("postgres://", "postgresql://", 1)
        db_engine = create_engine(DATABASE_URL)
        print("PostgreSQL engine created.")
    except Exception as e:
        print(f"Error creating SQLAlchemy engine: {e}")
        db_engine = None
else:
    print("Database URL not provided, database engine not initialized.")

# --- Database Initialization Function ---
def init_db():
    if not db_engine:
        print("Database engine not available, skipping DB initialization.")
        return

    max_retries = 5
    retry_delay = 5 # seconds
    for i in range(max_retries):
        try:
            with db_engine.connect() as connection:
                inspector = inspect(connection)
                if not inspector.has_table("messages"):
                    connection.execute(text('''
                        CREATE TABLE messages (
                            id SERIAL PRIMARY KEY,
                            user_name VARCHAR(255) NOT NULL,
                            text_content TEXT NOT NULL,
                            timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
                        )
                    '''))
                    connection.commit()
                    print("PostgreSQL 'messages' table created successfully.")
                else:
                    print("PostgreSQL 'messages' table already exists.")
                return
        except OperationalError as e:
            print(f"Database connection failed (Attempt {i+1}/{max_retries}): {e}")
            if i < max_retries - 1:
                print(f"Retrying in {retry_delay} seconds...")
                time.sleep(retry_delay)
            else:
                print("Max retries reached. Could not connect to database.")
        except Exception as e:
            print(f"An unexpected error occurred during DB initialization: {e}")
            return

with app.app_context():
    init_db()

socketio = SocketIO(app, cors_allowed_origins="*", message_queue=None)

# --- SocketIO Event Handlers ---

@socketio.on('connect')
def handle_connect():
    print(f'Client connected: {request.sid}')
    if db_engine:
        try:
            with db_engine.connect() as connection:
                result = connection.execute(text("SELECT user_name, text_content, timestamp FROM messages ORDER BY timestamp ASC LIMIT 100"))
                messages = []
                for row in result:
                    msg_data = {
                        'user': row.user_name,
                        'text': row.text_content,
                        'timestamp': row.timestamp.isoformat()
                    }
                    messages.append(msg_data)
                emit('initial_messages', {'messages': messages}, room=request.sid)
                print(f"Emitted {len(messages)} initial messages to {request.sid}")
        except Exception as e:
            print(f"Error fetching initial messages from PostgreSQL: {e}")

@socketio.on('disconnect')
def handle_disconnect():
    print(f'Client disconnected: {request.sid}')

@socketio.on('message')
def handle_message(data):
    print(f'Received message from {request.sid}: {data}')
    user = data.get('user', 'Anonymous')
    text = data.get('text', '')
    timestamp = datetime.datetime.now(datetime.timezone.utc).isoformat()

    if not text.strip():
        print("Empty message received, not processing.")
        return

    message_data = {
        'user': user,
        'text': text,
        'timestamp': timestamp
    }

    if db_engine:
        try:
            with db_engine.connect() as connection:
                # Use a transaction to ensure atomicity
                with connection.begin(): # This automatically commits or rolls back
                    connection.execute(
                        text("INSERT INTO messages (user_name, text_content, timestamp) VALUES (:user, :text, :timestamp)"),
                        {'user': user, 'text': text, 'timestamp': datetime.datetime.fromisoformat(timestamp)}
                    )
                print(f"Message saved to PostgreSQL: {message_data}")

            emit('new_message', message_data, broadcast=True)
            print(f"Emitted new_message to all clients: {message_data}")
        except Exception as e:
            print(f"Error saving message to PostgreSQL or broadcasting: {e}")
    else:
        print("Database engine not initialized, message not saved or broadcasted.")
        emit('new_message', message_data, broadcast=True) # Still emit for local testing even if DB fails

@socketio.on('clear_chat')
def handle_clear_chat():
    print(f'Received request to clear chat from {request.sid}.')
    if db_engine:
        try:
            with db_engine.connect() as connection:
                with connection.begin(): # Use a transaction
                    connection.execute(text("DELETE FROM messages"))
                print("All messages deleted from PostgreSQL.")
                emit('chat_cleared', {}, broadcast=True)
                print("Emitted chat_cleared to all clients.")
        except Exception as e:
            print(f"Error clearing messages from PostgreSQL: {e}")
            emit('clear_chat_error', {'message': 'Failed to clear chat history.'}, room=request.sid)
    else:
        print("Database engine not initialized, cannot clear chat.")
        emit('clear_chat_error', {'message': 'Database not available.'}, room=request.sid)


# Basic route for testing (optional, can be removed in production)
@app.route('/')
def index():
    return "<h1>Real-time Collaboration Backend (PostgreSQL) is Running!</h1><p>Connect via WebSocket.</p>"

# Run the Flask app with SocketIO
if __name__ == '__main__':
    print("Starting Flask-SocketIO server with PostgreSQL backend...")
    socketio.run(app, host='0.0.0.0', port=5000, debug=True, allow_unsafe_werkzeug=True)

# 'postgresql://neondb_owner:npg_hsn7jkKAq9pR@ep-mute-paper-a1ugypzg-pooler.ap-southeast-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require'
#  https://my-collaboration-tool.onrender.com
#  my-collaboration-tool-lmyduduuc-siddhis-projects-a9229ec0.vercel.app
