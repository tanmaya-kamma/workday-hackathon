from app.core.database import (
    check_database_connection,
    db,
    users_collection,
    policies_collection,
    leave_requests_collection,
    leave_balances_collection,
)


print("Database:", db.name)

print(
    "Users:",
    users_collection.count_documents({})
)

print(
    "Policies:",
    policies_collection.count_documents({})
)

print(
    "Leave Requests:",
    leave_requests_collection.count_documents({})
)

print(
    "Leave Balances:",
    leave_balances_collection.count_documents({})
)

print(
    "MongoDB connection:",
    "SUCCESS" if check_database_connection() else "FAILED"
)