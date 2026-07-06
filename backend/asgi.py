"""
ASGI entry point serving both surfaces from one process:

  /mcp  -> Pathwise MCP server (streamable HTTP, stateless) for external
           LLM clients (ChatGPT / Claude connectors)
  /*    -> the existing Flask REST API (wrapped via WSGI middleware)

Both share the singleton TripService created in app.py, so MCP is a thin
layer over the same business logic as the web app and internal chatbot.

Run locally:   uvicorn asgi:application --port 5000
Production:    see Dockerfile CMD
"""
import contextlib

from a2wsgi import WSGIMiddleware
from starlette.applications import Starlette
from starlette.routing import Mount

from app import app as flask_app, gmaps, trip_service
from mcp_server import create_mcp_server

mcp = create_mcp_server(trip_service, gmaps)
mcp_asgi = mcp.streamable_http_app()


@contextlib.asynccontextmanager
async def lifespan(app):
    # The MCP session manager must be running for /mcp requests to be served.
    async with mcp.session_manager.run():
        yield


_starlette = Starlette(
    routes=[
        Mount("/mcp", app=mcp_asgi),
        Mount("/", app=WSGIMiddleware(flask_app)),
    ],
    lifespan=lifespan,
)


class _McpSlashRewrite:
    """Connectors are configured with .../mcp (no trailing slash), but the
    mounted sub-app matches /mcp/ - accept both without a redirect."""

    def __init__(self, app):
        self.app = app

    async def __call__(self, scope, receive, send):
        if scope["type"] == "http" and scope.get("path") == "/mcp":
            scope = dict(scope)
            scope["path"] = "/mcp/"
        await self.app(scope, receive, send)


application = _McpSlashRewrite(_starlette)
