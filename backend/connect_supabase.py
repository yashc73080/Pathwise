# NOT BEING USED

import psycopg2
from dotenv import load_dotenv
import os
import socket

# Load environment variables from backend/.env.local
load_dotenv('.env.local')

# Fetch variables
USER = os.getenv("DB_USER")
PASSWORD = os.getenv("DB_PASSWORD")
HOST = os.getenv("DB_HOST")
PORT = os.getenv("DB_PORT")
DBNAME = os.getenv("DB_NAME")
DATABASE_URL = os.getenv("DATABASE_URL")

if DATABASE_URL:
    host = DATABASE_URL.split('@')[-1].split(':')[0].split('/')[0]
    print("Checking host:", host)
    try:
        print("IP addresses:", socket.gethostbyname_ex(host)[2])
    except Exception as e:
        print("DNS resolution failed:", e)

# Connect to the database
try:
    if DATABASE_URL:
        print("Using DATABASE_URL")
        connection = psycopg2.connect(DATABASE_URL + " sslmode=require")
    else:
        print("Using individual connection parameters")
        connection = psycopg2.connect(
            user=USER,
            password=PASSWORD,
            host=HOST,
            port=PORT,
            dbname=DBNAME
        )
    print("Connection successful!")
    
    # Create a cursor to execute SQL queries
    cursor = connection.cursor()
    
    # Example query
    cursor.execute("SELECT NOW();")
    result = cursor.fetchone()
    print("Current Time:", result)

    # Close the cursor and connection
    cursor.close()
    connection.close()
    print("Connection closed.")

except Exception as e:
    print(f"Failed to connect: {e}")