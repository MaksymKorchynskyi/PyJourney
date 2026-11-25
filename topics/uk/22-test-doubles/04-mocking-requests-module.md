# Моки для модуля requests

Код, що звертається до веб-API, важко по-справжньому покрити модульними тестами: сервер може відповідати повільно або взагалі лежати, дані можуть змінюватися, можна впертися в ліміт запитів, а без інтернету тест не запуститься. Звичайне рішення — замінити виклик `requests` моком, який повертає заздалегідь підготовлену відповідь. Тоді можна перевірити, як код поводиться при успіху, «не знайдено», помилках сервера та збоях мережі, і все це за мілісекунди й без жодного звернення до мережі.

## Що ви дізнаєтесь

- Чому функція, що використовує `requests`, залежить від двох об'єктів: функції `get()` і об'єкта `Response`, який вона повертає
- Як підмінити `requests` через `patch()` і зібрати фальшиву відповідь за допомогою `MagicMock`
- Чому підміняти `requests.get` безпечніше, ніж увесь модуль `requests`
- Як перевірити URL, параметри запиту й тайм-аут, які надсилає ваш код
- Як імітувати мережеві та HTTP-помилки і як захистити набір тестів від випадкових справжніх запитів

## Сценарій

У прикладах використовується безплатне тестове API за адресою `https://jsonplaceholder.typicode.com/`. Запит `GET` до `/albums/1` повертає приблизно такий JSON:

```text
{
  "userId": 1,
  "id": 1,
  "title": "quidem molestiae enim"
}
```

`requests` — сторонній пакет, тож спершу встановіть його (найкраще у віртуальне середовище):

```bash
python -m pip install requests
```

## Код, який тестуємо

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

Як це працює:

1. Формуємо URL ендпойнта з ідентифікатором альбому.
2. `requests.get()` надсилає запит і повертає об'єкт `Response`.
3. Якщо код статусу `200` (OK), `response.json()` перетворює тіло відповіді на словник, і функція повертає `title`. Для будь-якого іншого статусу вона повертає `None`.

Дві дрібні, але важливі деталі:

- Параметр називається `album_id`, а не `id`, щоб не затіняти вбудовану функцію `id()`.
- `timeout=5` передано явно. У `requests` **немає тайм-ауту за замовчуванням**: без нього запит до сервера, який так і не відповість, може зависнути назавжди.

Справжній виклик (потрібен доступ до інтернету):

```python
from album import find_album_by_id

print(find_album_by_id(1))
print(find_album_by_id(999))
```

Результат:

```text
quidem molestiae enim
None
```

Альбому 999 не існує, тому API відповідає `404 Not Found`, і функція повертає `None`.

## Що саме треба підробити

`find_album_by_id()` має дві залежності:

```text
find_album_by_id(1)
    │
    ├── requests.get(url, timeout=5)  ──> повертає Response
    │
    └── response.status_code, response.json()
```

Отже, модульний тест має:

1. замінити моком `requests.get` (або весь модуль `requests`, яким його бачить `album`);
2. змусити цей мок повертати **фальшиву відповідь**: ще один мок з атрибутом `status_code` і методом `json()`, що повертає словник.

## Тестуємо успішний випадок

`test_album.py`:

```python
import unittest
from unittest.mock import MagicMock, patch

from album import find_album_by_id


class TestAlbum(unittest.TestCase):

    @patch('album.requests')
    def test_find_album_by_id_success(self, mock_requests):
        # мок відповіді
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.return_value = {
            'userId': 1,
            'id': 1,
            'title': 'hello',
        }

        # задаємо, що повертає метод get()
        mock_requests.get.return_value = mock_response

        # викликаємо find_album_by_id() і перевіряємо, що назва — 'hello'
        self.assertEqual(find_album_by_id(1), 'hello')
```

Як це працює:

1. `@patch('album.requests')` підміняє ім'я `requests` **всередині модуля `album`** на `MagicMock` з назвою `mock_requests`. Тепер у `find_album_by_id()` вираз `requests.get` означає `mock_requests.get`.
2. `mock_response` грає роль `Response`: `status_code` — звичайний атрибут зі значенням `200`, а `json` — дочірній мок, `return_value` якого містить жорстко заданий словник.
3. `mock_requests.get.return_value = mock_response` змушує фальшивий `get()` повертати фальшиву відповідь.
4. Функція повертає `'hello'`, тобто назву з наших підроблених даних. Справжнє API відповіло б `'quidem molestiae enim'`, а отже, справжнього запиту не було.

Запустіть тести:

```bash
python -m unittest -v
```

Результат:

```text
test_find_album_by_id_success (test_album.TestAlbum.test_find_album_by_id_success) ... ok

----------------------------------------------------------------------
Ran 1 test in 0.000s

OK
```

## Тестуємо невдалий випадок

Тим самим прийомом поверніть відповідь зі статусом, відмінним від 200:

```python
import unittest
from unittest.mock import MagicMock, patch

from album import find_album_by_id


class TestAlbum(unittest.TestCase):

    @patch('album.requests')
    def test_find_album_by_id_success(self, mock_requests):
        # мок відповіді
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.return_value = {
            'userId': 1,
            'id': 1,
            'title': 'hello',
        }

        # задаємо, що повертає метод get()
        mock_requests.get.return_value = mock_response

        # викликаємо find_album_by_id() і перевіряємо, що назва — 'hello'
        self.assertEqual(find_album_by_id(1), 'hello')

    @patch('album.requests')
    def test_find_album_by_id_fail(self, mock_requests):
        mock_response = MagicMock()
        mock_response.status_code = 400

        mock_requests.get.return_value = mock_response
        self.assertIsNone(find_album_by_id(1))
```

Результат:

```text
test_find_album_by_id_fail (test_album.TestAlbum.test_find_album_by_id_fail) ... ok
test_find_album_by_id_success (test_album.TestAlbum.test_find_album_by_id_success) ... ok

----------------------------------------------------------------------
Ran 2 tests in 0.000s

OK
```

> **Зверніть увагу:** обидва тести запускалися з фактично вимкненою мережею (увесь HTTP-трафік ішов на неіснуючий проксі) і все одно пройшли. У цьому й сенс моків: тести взагалі не залежать від мережі.

## Підміняйте requests.get, а не весь модуль

Справжній код зазвичай обробляє мережеві помилки. Ось надійніша версія `album.py`:

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

`requests.RequestException` — базовий клас усіх помилок `requests` (`ConnectionError`, `Timeout`, `HTTPError` та інших). Тепер спробуймо перевірити гілку з помилкою, підмінивши весь модуль, як раніше:

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

Результат (шляхи й нутрощі `unittest.mock` скорочено):

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

Підміна `album.requests` замінила в ньому **все**, зокрема й класи винятків. `requests.RequestException` усередині `album` став атрибутом `MagicMock`, а Python не дозволяє вказувати в `except` об'єкт, що не є винятком.

Рішення — підміняти лише те, що потрібно, тобто функцію `get`. Ось кращий тестовий модуль, у якому заразом використано ще кілька добрих практик:

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

Результат `python -m unittest test_album -v`:

```text
test_connection_error (test_album.TestFindAlbumById.test_connection_error) ... ok
test_not_found (test_album.TestFindAlbumById.test_not_found) ... ok
test_success (test_album.TestFindAlbumById.test_success) ... ok

----------------------------------------------------------------------
Ran 3 tests in 0.001s

OK
```

Що тут краще:

- **`patch('album.requests.get')`** підміняє лише функцію. Класи винятків лишаються справжніми, тож `except requests.RequestException` працює. Зауважте: `album.requests` — це і є модуль `requests`, тому ця ціль рівнозначна `'requests.get'`, і під час тесту мок бачать усі модулі.
- **`side_effect = requests.ConnectionError(...)`** змушує фальшивий `get()` генерувати виняток. Так перевіряють збої мережі.
- **`assert_called_once_with(url, timeout=5)`** перевіряє сам запит. Без цього помилку в URL (`/album/1` замість `/albums/1`) ніхто б не помітив, адже мок відповідає на будь-який URL.
- **`MagicMock(spec=requests.Response)`** дає фальшиву відповідь лише зі справжніми атрибутами `Response`, тому одруківка на кшталт `response.jsn()` генерує `AttributeError`, а не мовчки повертає мок.
- **Декоратор класу** підміняє в кожному методі `test*`. Допоміжний `make_response()` не починається з `test`, тому додаткового аргументу-мока не отримує.

## Страховка від справжніх запитів

Якщо хтось забуде patch, тест тихо піде в справжній інтернет: стане повільним, нестабільним і навіть може випадково пройти. Такі помилки можна змусити гучно падати, заблокувавши `requests` на найнижчому рівні для цілої групи тестів:

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

Результат (шляхи й кадри бібліотек скорочено):

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

Кожен запит через `requests` зрештою потрапляє в `HTTPAdapter.send()`, тож одна ця підміна ловить їх усі. `RuntimeError` не є `requests.RequestException`, тому `except` у `find_album_by_id()` його не поглинає.

> **Порада:** для більших проєктів є сторонні бібліотеки, створені саме для цього: `responses` і `requests-mock` реєструють фальшиві відповіді для окремих URL і блокують незареєстровані запити. Варто глянути на них, коли звичайний `patch()` почне повторюватися.

## Типові помилки

- **Підміняти `requests.get` там, де його не шукають.** Якщо модуль робить `from requests import get` і викликає `get(url)`, підміняти треба `'album.get'`. Підміна `'requests.get'` тоді нічого не дасть, бо `album` має власне посилання.
- **Підміняти весь модуль, коли код перехоплює винятки `requests`.** Класи винятків стають моками, і `except` генерує `TypeError`. Натомість підміняйте `requests.get` (або `Session.get`).
- **Задавати `json` замість `json.return_value`.** Код викликає `response.json()`, тож після `mock_response.json = {...}` виклик упаде з `TypeError: 'dict' object is not callable`. Пишіть `mock_response.json.return_value = {...}`.
- **Забути `status_code`.** Якщо його не задати в `MagicMock`, `response.status_code == 200` порівнює мок із `200` і дає `False`, тож «успішний» тест піде гілкою помилки.
- **Не перевіряти запит.** Мок відповідає на будь-який URL. Перевіряйте URL, `params` і `timeout` за допомогою `assert_called_once_with()`.
- **Не задавати `timeout` у робочому коді.** Це не помилка тестування, але поширена реальна помилка: без тайм-ауту запит може заблокувати програму назавжди.

## Підсумок

- Щоб покрити модульними тестами код, який використовує `requests`, замініть HTTP-виклик моком і поверніть фальшиву відповідь.
- `@patch('album.requests.get')` підміняє функцію, а `MagicMock(spec=requests.Response)` зі `status_code` і `json.return_value` замінює відповідь.
- Якщо підміняти лише `get`, справжні класи винятків `requests` лишаються на місці, і обробка помилок у тестах працює.
- `side_effect` імітує збої: `requests.ConnectionError`, `requests.Timeout` або `raise_for_status`, що генерує `requests.HTTPError`.
- Завжди перевіряйте, що надіслав код (URL, `params`, `timeout`), бо мок приймає що завгодно.
- Підміна `requests.adapters.HTTPAdapter.send` у базовому `TestCase` перетворює будь-який забутий patch на гучну помилку замість справжнього мережевого виклику.

## Практика

### Вправа 1: Відповідь 404

Для надійної версії `album.py` вище напишіть тест для `find_album_by_id(999)`, коли API повертає `404`. Перевірте, що результат — `None`, що запит пішов на правильний URL із правильним тайм-аутом і що `response.json()` **не** викликали.

### Вправа 2: Параметри запиту

Напишіть `albums.py` із функцією `find_album_titles_by_user(user_id)`, яка надсилає `GET https://jsonplaceholder.typicode.com/albums` з `params={'userId': user_id}` і `timeout=5` та повертає список назв альбомів (або порожній список, якщо статус не `200`). Протестуйте її без мережі: успішна відповідь із двома альбомами і відповідь `500`. Перевірте надіслані `params`.

### Вправа 3: raise_for_status() і тайм-аути

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

`raise_for_status()` генерує `requests.HTTPError` для відповідей 4xx і 5xx. Напишіть три тести: у разі успіху повертається JSON; `HTTPError` із `raise_for_status()` поширюється далі, а `json()` не викликається; `requests.Timeout` із `get()` поширюється далі.

## Розв'язки

### Вправа 1

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

Результат `python -m unittest test_album_404 -v`:

```text
test_not_found (test_album_404.TestAlbumNotFound.test_not_found) ... ok

----------------------------------------------------------------------
Ran 1 test in 0.000s

OK
```

### Вправа 2

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

Результат `python -m unittest test_albums -v`:

```text
test_returns_titles (test_albums.TestFindAlbumTitlesByUser.test_returns_titles) ... ok
test_server_error (test_albums.TestFindAlbumTitlesByUser.test_server_error) ... ok

----------------------------------------------------------------------
Ran 2 tests in 0.001s

OK
```

У `test_server_error` фальшива відповідь — це просто `mock_get.return_value`, мок, який підмінений `get()` повертає за замовчуванням. Для короткого тесту досить задати йому `status_code`.

### Вправа 3

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

Результат `python -m unittest test_album_api -v`:

```text
test_http_error_propagates (test_album_api.TestGetAlbum.test_http_error_propagates) ... ok
test_returns_json (test_album_api.TestGetAlbum.test_returns_json) ... ok
test_timeout_propagates (test_album_api.TestGetAlbum.test_timeout_propagates) ... ok

----------------------------------------------------------------------
Ran 3 tests in 0.001s

OK
```

У `test_returns_json` метод `raise_for_status()` — неналаштований метод мока, тож його виклик нічого не робить, як і в справжньої успішної відповіді. Для порівняння: справжнє API поводиться саме так, як припускають тести:

```python
import requests

from album_api import get_album

print(get_album(1))
try:
    get_album(999)
except requests.HTTPError as error:
    print('HTTPError:', error)
```

Результат (потрібен доступ до інтернету):

```text
{'userId': 1, 'id': 1, 'title': 'quidem molestiae enim'}
HTTPError: 404 Client Error: Not Found for url: https://jsonplaceholder.typicode.com/albums/999
```

---

*Джерело: [pythontutorial.net — Python Mock Requests](https://www.pythontutorial.net/python-unit-testing/python-mock-requests/). Адаптовано й доповнено для PyJourney.*
