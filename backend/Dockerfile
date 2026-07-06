# Use an official lightweight Python image.
# 3.11 is a good balance of speed and compatibility.
FROM python:3.11-slim

# Allow statements and log messages to immediately appear in the Knative logs
ENV PYTHONUNBUFFERED True

# Copy local code to the container image.
ENV APP_HOME /app
WORKDIR $APP_HOME
COPY . ./

# Install production dependencies.
# We add gunicorn here if it's not in requirements, though your requirements.txt has it.
RUN pip install --no-cache-dir -r requirements.txt

# Run the ASGI umbrella (Flask REST API at / plus the MCP server at /mcp)
# via uvicorn. asgi.py shares the singleton TripService between both.
CMD exec uvicorn asgi:application --host 0.0.0.0 --port $PORT