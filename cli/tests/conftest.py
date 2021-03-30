import asyncio
import os
from dataclasses import dataclass
from datetime import datetime, timedelta

import pytest
from aiohttp import web
from aiohttp.abc import Application, Request
from aiohttp.test_utils import TestServer
from aiohttp.web_response import json_response
from httpx import AsyncClient


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
    request.app['files'][request.path] = {'body': body, 'content-type': request.headers.get('content-type')}
    return json_response({'size': 123, 'total_site_size': 1234})


async def commit_update(request: Request):
    obj = await request.json()
    request.app['statuses'][request.match_info['path']] = obj
    return json_response({}, status=201)


routes = [
    web.post('/create/', create),
    web.post('/testing-site/{file:.*}', upload),
    web.post('/github/{path:.*}', commit_update),
]


@pytest.fixture(name='loop')
def _fix_loop():
    try:
        loop = asyncio.get_event_loop()
    except RuntimeError:
        loop = asyncio.new_event_loop()
    asyncio.set_event_loop(loop)
    return loop


@pytest.fixture(name='await_')
def _fix_await(loop):
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
    ctx = {'sites': [], 'files': {}, 'statuses': {}}
    ds = loop.run_until_complete(DummyServer.create(loop, ctx))

    yield ds

    loop.run_until_complete(ds.stop())


class SetEnv:
    def __init__(self):
        self.env_defaults = {}

    def set(self, name, value):
        self.env_defaults[name] = os.environ.get(name)
        os.environ[name] = value

    def clear(self):
        for name, value in self.env_defaults.items():
            if value is None:
                os.environ.pop(name)
            else:
                os.environ[name] = value


@pytest.fixture(name='env')
def _fix_env():
    setenv = SetEnv()

    yield setenv

    setenv.clear()


@pytest.fixture(name='async_client')
def _fix_async_client(await_):
    client = AsyncClient()
    await_(client.__aenter__())

    yield client

    await_(client.__aexit__())
