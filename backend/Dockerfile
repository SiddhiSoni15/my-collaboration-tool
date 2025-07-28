# Use the official Python image as a base
FROM python:3.9-slim-buster

# Set environment variables for non-interactive apt-get
ENV DEBIAN_FRONTEND=noninteractive

# Install PostgreSQL client libraries (required by psycopg2-binary)
RUN apt-get update && apt-get install -y \
    libpq-dev \
    gcc \
    # Clean up apt cache to reduce image size
    && rm -rf /var/lib/apt/lists/*

# Set the working directory in the container
WORKDIR /app

# Copy the requirements file into the container
COPY requirements.txt .

# Install Python dependencies
RUN pip install --no-cache-dir -r requirements.txt

# Copy the rest of your application code into the container
COPY . .

# Expose the port that Flask-SocketIO will run on
# Render expects the application to listen on the PORT environment variable
ENV PORT 10000 # Render often uses port 10000 by default, but 8080 is also common
EXPOSE $PORT

# Command to run the application using Gunicorn and Gevent (for Socket.IO)
# Gunicorn is a production-ready WSGI server.
# The `geventwebsocket.gunicorn.workers.GeventWebSocketWorker` is crucial for Socket.IO WebSockets.
# Using --workers 1 is important for Flask-SocketIO unless you use a message queue (like Redis)
CMD exec gunicorn --bind 0.0.0.0:$PORT --worker-class geventwebsocket.gunicorn.workers.GeventWebSocketWorker --workers 1 app:app