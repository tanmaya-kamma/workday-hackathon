import os

from dotenv import load_dotenv
from pymongo import MongoClient
from pymongo.errors import PyMongoError


load_dotenv()


MONGODB_URI = os.getenv("MONGODB_URI")
MONGODB_DATABASE = os.getenv("MONGODB_DATABASE", "LMS")


if not MONGODB_URI:
    raise RuntimeError(
        "MONGODB_URI is not configured in the .env file."
    )


client = MongoClient(
    MONGODB_URI,
    serverSelectionTimeoutMS=5000
)

db = client[MONGODB_DATABASE]


users_collection = db["users"]
policies_collection = db["policies"]
leave_requests_collection = db["leave_requests"]
leave_balances_collection = db["leave_balances"]
regional_calendars_collection = db["regional_calendars"]


def get_database():
    """
    Return the LMS MongoDB database.
    """
    return db


def check_database_connection():
    """
    Verify that MongoDB is reachable.
    """
    try:
        client.admin.command("ping")
        return True
    except PyMongoError:
        return False