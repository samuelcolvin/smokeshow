import asyncio
from dataclasses import dataclass
from datetime import datetime, timedelta

import pytest
from aiohttp import web
from aiohttp.abc import Request, Application
from aiohttp.test_utils import TestServer
from aiohttp.web_response import json_response


async def create(request: Request):
    now = datetime.now()
    host = request.headers['host']
    request.app['sites'].append(request.headers['authorisation'])
    return json_response(
        {
            'message': 'New site created successfully',
            'secret_key': 'testing',
            'site_creation': now.isoformat(),
            'site_expiration': (now + timedelta(days=30)).isoformat(),
            'sites_created_24h': 0,
            'upload_expiration': (now + timedelta(hours=1)).isoformat(),
            'url': f'http://{host}/testing-site/',
        }
    )


async def upload(request: Request):
    body = await request.read()
    request.app['files'][request.path] = body
    return json_response({'size': 123, 'total_site_size': 1234})


routes = [
    web.post('/create/', create),
    web.post('/testing-site/{file:.*}', upload),
]


@pytest.fixture(name='loop')
def fix_loop():
    try:
        loop = asyncio.get_event_loop()
    except RuntimeError:
        loop = asyncio.new_event_loop()
    asyncio.set_event_loop(loop)
    return loop


@pytest.fixture(name='await_')
def fix_await(loop):
    return loop.run_until_complete


@dataclass
class DummyServer:
    server: TestServer
    app: Application
    server_name: str

    async def stop(self):
        await self.server.close()

    @classmethod
    async def create(cls, loop, app_context) -> 'DummyServer':
        app = web.Application()
        app.add_routes(routes)
        app.update(app_context)

        server = TestServer(app)
        await server.start_server(loop=loop)

        return cls(server, app, f'http://localhost:{server.port}')


@pytest.fixture(name='dummy_server')
def _fix_dummy_server(loop):
    ctx = {'sites': [], 'files': {}}
    ds = loop.run_until_complete(DummyServer.create(loop, ctx))

    yield ds

    loop.run_until_complete(ds.stop())
