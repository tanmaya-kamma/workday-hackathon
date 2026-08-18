import asyncio

import pytest

from app.core.database import init_db, close_db


@pytest.fixture(scope="session", autouse=True)
def db_connection():
    loop = asyncio.new_event_loop()
    loop.run_until_complete(init_db())
    yield
    loop.run_until_complete(close_db())
    loop.close()
