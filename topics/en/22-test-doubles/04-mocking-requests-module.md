# Mocking requests Module

Code that calls a web API is hard to unit test for real: the server may be slow or down, the data may change, you may hit rate limits, and the test cannot run offline. The usual solution is to replace the `requests` call with a mock that returns a prepared response. Then you can check how your code handles success, "not found", server errors and network failures, all in milliseconds and without touching the network.

## What you'll learn

- How a function that uses `requests` depends on two objects: the `get()` function and the `Response` it returns
- How to patch `requests` with `patch()` and build a fake response with `MagicMock`
- Why patching `requests.get` is safer than patching the whole `requests` module
- How to assert the URL, query parameters and timeout your code sends
- How to simulate network errors and HTTP errors, and how to guard a test suite against accidental real requests

## The scenario

The examples use the free test API at `https://jsonplaceholder.typicode.com/`. A `GET` request to `/albums/1` returns JSON like this:

```text
{
  "userId": 1,
  "id": 1,
  "title": "quidem molestiae enim"
}
```

`requests` is a third-party package, so install it first (ideally inside a virtual environment):

```bash
python -m pip install requests
```

## The code under test

`album.py`:

```python
import requests


def find_album_by_id(album_id):
    url = f'https://jsonplaceholder.typicode.com/albums/{album_id}'
    response = requests.get(url, timeout=5)
    if response.status_code == 200:
        return response.json()['title']
    else:
        return None
```

How it works:

1. Build the endpoint URL with the album id.
2. `requests.get()` sends the request and returns a `Response` object.
3. If the status code is `200` (OK), `response.json()` parses the body into a dict, and the function returns the `title`. For any other status it returns `None`.

Two small but important details:

- The parameter is called `album_id`, not `id`, so it does not shadow the built-in `id()`.
- `timeout=5` is passed explicitly. `requests` has **no default timeout**: without one, a request to a server that never answers can hang forever.

Calling it for real (this needs internet access):

```python
from album import find_album_by_id

print(find_album_by_id(1))
print(find_album_by_id(999))
```

Output:

```text
quidem molestiae enim
None
```

Album 999 does not exist, so the API answers `404 Not Found`, and the function returns `None`.

## What exactly needs to be faked

`find_album_by_id()` has two dependencies:

```text
find_album_by_id(1)
    │
    ├── requests.get(url, timeout=5)  ──> returns a Response
    │
    └── response.status_code, response.json()
```

So a unit test must:

1. replace `requests.get` (or the whole `requests` module as seen from `album`) with a mock;
2. make that mock return a **fake response**: another mock with a `status_code` and a `json()` method that returns a dict.

## Testing the success case

`test_album.py`:

```python
import unittest
from unittest.mock import MagicMock, patch

from album import find_album_by_id


class TestAlbum(unittest.TestCase):

    @patch('album.requests')
    def test_find_album_by_id_success(self, mock_requests):
        # mock the response
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.return_value = {
            'userId': 1,
            'id': 1,
            'title': 'hello',
        }

        # specify the return value of the get() method
        mock_requests.get.return_value = mock_response

        # call find_album_by_id() and check that the title is 'hello'
        self.assertEqual(find_album_by_id(1), 'hello')
```

How it works:

1. `@patch('album.requests')` replaces the name `requests` **inside the `album` module** with a `MagicMock` called `mock_requests`. Inside `find_album_by_id()`, `requests.get` is now `mock_requests.get`.
2. `mock_response` plays the `Response`: `status_code` is a plain attribute set to `200`, and `json` is a child mock whose `return_value` is the hard-coded dict.
3. `mock_requests.get.return_value = mock_response` makes the fake `get()` return the fake response.
4. The function returns `'hello'`, the title from our fake data. The real API would say `'quidem molestiae enim'`, which proves no real request was made.

Run the tests:

```bash
python -m unittest -v
```

Output:

```text
test_find_album_by_id_success (test_album.TestAlbum.test_find_album_by_id_success) ... ok

----------------------------------------------------------------------
Ran 1 test in 0.000s

OK
```

## Testing the failure case

Using the same technique, return a response with a non-200 status:

```python
import unittest
from unittest.mock import MagicMock, patch

from album import find_album_by_id


class TestAlbum(unittest.TestCase):

    @patch('album.requests')
    def test_find_album_by_id_success(self, mock_requests):
        # mock the response
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.return_value = {
            'userId': 1,
            'id': 1,
            'title': 'hello',
        }

        # specify the return value of the get() method
        mock_requests.get.return_value = mock_response

        # call find_album_by_id() and check that the title is 'hello'
        self.assertEqual(find_album_by_id(1), 'hello')

    @patch('album.requests')
    def test_find_album_by_id_fail(self, mock_requests):
        mock_response = MagicMock()
        mock_response.status_code = 400

        mock_requests.get.return_value = mock_response
        self.assertIsNone(find_album_by_id(1))
```

Output:

```text
test_find_album_by_id_fail (test_album.TestAlbum.test_find_album_by_id_fail) ... ok
test_find_album_by_id_success (test_album.TestAlbum.test_find_album_by_id_success) ... ok

----------------------------------------------------------------------
Ran 2 tests in 0.000s

OK
```

> **Note:** Both tests ran with the network effectively disabled (all HTTP traffic was sent to a dead proxy), and they still passed. That is the point of mocking: the tests do not depend on the network at all.

## Patch requests.get, not the whole module

Real code usually handles network errors. Here is a more robust `album.py`:

```python
import requests

BASE_URL = 'https://jsonplaceholder.typicode.com'


def find_album_by_id(album_id):
    url = f'{BASE_URL}/albums/{album_id}'
    try:
        response = requests.get(url, timeout=5)
    except requests.RequestException:
        return None
    if response.status_code == 200:
        return response.json()['title']
    return None
```

`requests.RequestException` is the base class of all `requests` errors (`ConnectionError`, `Timeout`, `HTTPError` and others). Now try to test the error path with the whole-module patch from before:

```python
import unittest
from unittest.mock import patch

import requests

from album import find_album_by_id


class TestAlbumErrors(unittest.TestCase):
    @patch('album.requests')
    def test_connection_error(self, mock_requests):
        mock_requests.get.side_effect = requests.ConnectionError
        self.assertIsNone(find_album_by_id(1))
```

Output (paths and `unittest.mock` internals trimmed):

```text
test_connection_error (test_album_whole_module.TestAlbumErrors.test_connection_error) ... ERROR

======================================================================
ERROR: test_connection_error (test_album_whole_module.TestAlbumErrors.test_connection_error)
----------------------------------------------------------------------
Traceback (most recent call last):
  File "album.py", line 9, in find_album_by_id
    response = requests.get(url, timeout=5)
  ...
requests.exceptions.ConnectionError

During handling of the above exception, another exception occurred:

Traceback (most recent call last):
  ...
  File "album.py", line 10, in find_album_by_id
    except requests.RequestException:
        return None
TypeError: catching classes that do not inherit from BaseException is not allowed

----------------------------------------------------------------------
Ran 1 test in 0.001s

FAILED (errors=1)
```

Patching `album.requests` replaced **everything** in it, including the exception classes. `requests.RequestException` inside `album` became a `MagicMock` attribute, and Python refuses to use a non-exception object in an `except` clause.

The fix is to patch only what you need, the `get` function. Here is a better test module that also uses a few more good practices:

```python
import unittest
from unittest.mock import MagicMock, patch

import requests

from album import find_album_by_id


@patch('album.requests.get')
class TestFindAlbumById(unittest.TestCase):
    def make_response(self, status_code, data=None):
        response = MagicMock(spec=requests.Response)
        response.status_code = status_code
        response.json.return_value = data
        return response

    def test_success(self, mock_get):
        mock_get.return_value = self.make_response(
            200, {'userId': 1, 'id': 1, 'title': 'hello'}
        )
        self.assertEqual(find_album_by_id(1), 'hello')
        mock_get.assert_called_once_with(
            'https://jsonplaceholder.typicode.com/albums/1', timeout=5
        )

    def test_not_found(self, mock_get):
        mock_get.return_value = self.make_response(404)
        self.assertIsNone(find_album_by_id(999))

    def test_connection_error(self, mock_get):
        mock_get.side_effect = requests.ConnectionError('no route to host')
        self.assertIsNone(find_album_by_id(1))
```

Output of `python -m unittest test_album -v`:

```text
test_connection_error (test_album.TestFindAlbumById.test_connection_error) ... ok
test_not_found (test_album.TestFindAlbumById.test_not_found) ... ok
test_success (test_album.TestFindAlbumById.test_success) ... ok

----------------------------------------------------------------------
Ran 3 tests in 0.001s

OK
```

What is better here:

- **`patch('album.requests.get')`** replaces only the function. The exception classes stay real, so `except requests.RequestException` works. Note that `album.requests` *is* the `requests` module, so this target is the same as `'requests.get'`: during the test, every module sees the mock.
- **`side_effect = requests.ConnectionError(...)`** makes the fake `get()` raise, which is how you test network failures.
- **`assert_called_once_with(url, timeout=5)`** checks the request itself. Without it, a bug in the URL (`/album/1` instead of `/albums/1`) would go unnoticed, because the mock answers any URL.
- **`MagicMock(spec=requests.Response)`** gives a fake response that only has real `Response` attributes, so a typo such as `response.jsn()` raises `AttributeError` instead of quietly returning a mock.
- **The class decorator** patches every `test*` method. The helper `make_response()` does not start with `test`, so it does not receive the extra mock argument.

## A safety net against real requests

If someone forgets a patch, the test quietly goes to the real internet: it becomes slow, flaky, and may even pass by accident. You can make such mistakes fail loudly by blocking `requests` at its lowest level for a whole group of tests:

```python
import unittest
from unittest.mock import patch

from album import find_album_by_id


class NoNetworkTestCase(unittest.TestCase):
    """Fails any test that tries to send a real HTTP request via requests."""

    def setUp(self):
        guard = patch(
            'requests.adapters.HTTPAdapter.send',
            side_effect=RuntimeError('real HTTP request in a unit test'),
        )
        guard.start()
        self.addCleanup(guard.stop)


class TestAlbum(NoNetworkTestCase):
    def test_forgot_to_patch(self):
        self.assertEqual(find_album_by_id(1), 'quidem molestiae enim')
```

Output (paths and library frames trimmed):

```text
test_forgot_to_patch (test_guard.TestAlbum.test_forgot_to_patch) ... ERROR

======================================================================
ERROR: test_forgot_to_patch (test_guard.TestAlbum.test_forgot_to_patch)
----------------------------------------------------------------------
Traceback (most recent call last):
  File "test_guard.py", line 21, in test_forgot_to_patch
    self.assertEqual(find_album_by_id(1), 'quidem molestiae enim')
                     ~~~~~~~~~~~~~~~~^^^
  File "album.py", line 9, in find_album_by_id
    response = requests.get(url, timeout=5)
  ...
RuntimeError: real HTTP request in a unit test

----------------------------------------------------------------------
Ran 1 test in 0.004s

FAILED (errors=1)
```

Every request made through `requests` ends in `HTTPAdapter.send()`, so this one patch catches them all. The `RuntimeError` is not a `requests.RequestException`, so the `except` in `find_album_by_id()` does not swallow it.

> **Tip:** For larger projects there are third-party libraries built for this job: `responses` and `requests-mock` register fake responses per URL and block unregistered requests. They are worth a look once plain `patch()` gets repetitive.

## Common mistakes

- **Patching `requests.get` where it is not looked up.** If the module does `from requests import get` and calls `get(url)`, you must patch `'album.get'`. Patching `'requests.get'` then has no effect, because `album` holds its own reference.
- **Patching the whole module when the code catches `requests` exceptions.** The exception classes become mocks, and `except` raises `TypeError`. Patch `requests.get` (or `Session.get`) instead.
- **Setting `json` instead of `json.return_value`.** The code calls `response.json()`, so `mock_response.json = {...}` makes the call fail with `TypeError: 'dict' object is not callable`. Use `mock_response.json.return_value = {...}`.
- **Forgetting `status_code`.** On a `MagicMock` without it, `response.status_code == 200` compares a mock with `200` and is `False`, so the "success" test takes the failure branch.
- **Not checking the request.** A mock answers any URL. Assert the URL, `params` and `timeout` with `assert_called_once_with()`.
- **Omitting `timeout` in production code.** Not a testing bug, but a common real one: without a timeout a request can block forever.

## Summary

- To unit test code that uses `requests`, replace the HTTP call with a mock and return a fake response.
- `@patch('album.requests.get')` replaces the function, and a `MagicMock(spec=requests.Response)` with `status_code` and `json.return_value` replaces the response.
- Patching only `get` keeps the real `requests` exception classes, so error handling still works in tests.
- `side_effect` simulates failures: `requests.ConnectionError`, `requests.Timeout`, or `raise_for_status` raising `requests.HTTPError`.
- Always assert what the code sent (URL, `params`, `timeout`), because a mock accepts anything.
- Patching `requests.adapters.HTTPAdapter.send` in a base `TestCase` turns any forgotten patch into a loud failure instead of a real network call.

## Practice

### Exercise 1: A 404 response

For the robust `album.py` above, write a test for `find_album_by_id(999)` when the API returns `404`. Check that the result is `None`, that the right URL and timeout were requested, and that `response.json()` was **not** called.

### Exercise 2: Query parameters

Write `albums.py` with `find_album_titles_by_user(user_id)`, which sends `GET https://jsonplaceholder.typicode.com/albums` with `params={'userId': user_id}` and `timeout=5`, and returns a list of album titles (or an empty list if the status is not `200`). Test it without the network: a successful response with two albums, and a `500` response. Check the `params` that were sent.

### Exercise 3: raise_for_status() and timeouts

`album_api.py`:

```python
import requests


def get_album(album_id):
    response = requests.get(
        f'https://jsonplaceholder.typicode.com/albums/{album_id}', timeout=5
    )
    response.raise_for_status()
    return response.json()
```

`raise_for_status()` raises `requests.HTTPError` for 4xx and 5xx responses. Write three tests: the JSON is returned on success; an `HTTPError` from `raise_for_status()` propagates and `json()` is not called; a `requests.Timeout` from `get()` propagates.

## Solutions

### Exercise 1

```python
import unittest
from unittest.mock import MagicMock, patch

import requests

from album import find_album_by_id


class TestAlbumNotFound(unittest.TestCase):
    @patch('album.requests.get')
    def test_not_found(self, mock_get):
        mock_response = MagicMock(spec=requests.Response)
        mock_response.status_code = 404
        mock_get.return_value = mock_response

        self.assertIsNone(find_album_by_id(999))

        mock_get.assert_called_once_with(
            'https://jsonplaceholder.typicode.com/albums/999', timeout=5
        )
        mock_response.json.assert_not_called()
```

Output of `python -m unittest test_album_404 -v`:

```text
test_not_found (test_album_404.TestAlbumNotFound.test_not_found) ... ok

----------------------------------------------------------------------
Ran 1 test in 0.000s

OK
```

### Exercise 2

`albums.py`:

```python
import requests

BASE_URL = 'https://jsonplaceholder.typicode.com'


def find_album_titles_by_user(user_id):
    response = requests.get(
        f'{BASE_URL}/albums', params={'userId': user_id}, timeout=5
    )
    if response.status_code != 200:
        return []
    return [album['title'] for album in response.json()]
```

`test_albums.py`:

```python
import unittest
from unittest.mock import MagicMock, patch

import requests

from albums import find_album_titles_by_user


@patch('albums.requests.get')
class TestFindAlbumTitlesByUser(unittest.TestCase):
    def test_returns_titles(self, mock_get):
        mock_response = MagicMock(spec=requests.Response)
        mock_response.status_code = 200
        mock_response.json.return_value = [
            {'userId': 2, 'id': 11, 'title': 'first'},
            {'userId': 2, 'id': 12, 'title': 'second'},
        ]
        mock_get.return_value = mock_response

        self.assertEqual(find_album_titles_by_user(2), ['first', 'second'])
        mock_get.assert_called_once_with(
            'https://jsonplaceholder.typicode.com/albums',
            params={'userId': 2},
            timeout=5,
        )

    def test_server_error(self, mock_get):
        mock_get.return_value.status_code = 500
        self.assertEqual(find_album_titles_by_user(2), [])
```

Output of `python -m unittest test_albums -v`:

```text
test_returns_titles (test_albums.TestFindAlbumTitlesByUser.test_returns_titles) ... ok
test_server_error (test_albums.TestFindAlbumTitlesByUser.test_server_error) ... ok

----------------------------------------------------------------------
Ran 2 tests in 0.001s

OK
```

In `test_server_error` the fake response is simply `mock_get.return_value`, the mock that a patched `get()` returns by default. Setting its `status_code` is enough for a short test.

### Exercise 3

```python
import unittest
from unittest.mock import patch

import requests

from album_api import get_album


@patch('album_api.requests.get')
class TestGetAlbum(unittest.TestCase):
    def test_returns_json(self, mock_get):
        mock_get.return_value.json.return_value = {'id': 1, 'title': 'hello'}
        self.assertEqual(get_album(1), {'id': 1, 'title': 'hello'})

    def test_http_error_propagates(self, mock_get):
        mock_get.return_value.raise_for_status.side_effect = requests.HTTPError(
            '404 Client Error: Not Found'
        )
        with self.assertRaises(requests.HTTPError):
            get_album(999)
        mock_get.return_value.json.assert_not_called()

    def test_timeout_propagates(self, mock_get):
        mock_get.side_effect = requests.Timeout
        with self.assertRaises(requests.Timeout):
            get_album(1)
```

Output of `python -m unittest test_album_api -v`:

```text
test_http_error_propagates (test_album_api.TestGetAlbum.test_http_error_propagates) ... ok
test_returns_json (test_album_api.TestGetAlbum.test_returns_json) ... ok
test_timeout_propagates (test_album_api.TestGetAlbum.test_timeout_propagates) ... ok

----------------------------------------------------------------------
Ran 3 tests in 0.001s

OK
```

In `test_returns_json`, `raise_for_status()` is an unconfigured mock method, so calling it does nothing, just like on a successful real response. For comparison, the real API behaves the same way the tests assume:

```python
import requests

from album_api import get_album

print(get_album(1))
try:
    get_album(999)
except requests.HTTPError as error:
    print('HTTPError:', error)
```

Output (needs internet access):

```text
{'userId': 1, 'id': 1, 'title': 'quidem molestiae enim'}
HTTPError: 404 Client Error: Not Found for url: https://jsonplaceholder.typicode.com/albums/999
```

---

*Source: [pythontutorial.net — Python Mock Requests](https://www.pythontutorial.net/python-unit-testing/python-mock-requests/). Adapted and expanded for PyJourney.*
