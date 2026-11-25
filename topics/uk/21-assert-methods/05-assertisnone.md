# assertIsNone()

`None` — це спосіб Python сказати «значення немає»: `dict.get()` повертає його для відсутнього ключа, `re.match()` — коли збігу немає, а функція пошуку — коли нічого не знайшла. `assertIsNone()` перевіряє, що результат — саме `None`, а `assertIsNotNone()` — що результат *є*.

## Що ви дізнаєтесь

- Що перевіряють `assertIsNone(obj, msg=None)` і `assertIsNotNone(obj, msg=None)`
- Як виглядають їхні повідомлення про невдачу з `msg` і без нього
- Чому `assertFalse()` і `assertEqual(x, None)` — гірший вибір
- Як `assertIsNotNone()` працює як «запобіжник» перед використанням результату
- Типові помилки з цими двома методами

## Як працює `assertIsNone()`

```python
assertIsNone(obj, msg=None)
```

Тест проходить, коли `obj is None`. Перевірка використовує **ідентичність** (`is`), а не рівність: у програмі на Python є рівно один об'єкт `None`, тож `is None` — точний та ідіоматичний спосіб його перевірити.

Ось тестовий файл з одним успішним і двома невдалими тестами. Третій додає власне повідомлення:

```python
import unittest


class TestNone(unittest.TestCase):
    def test_variable_none(self):
        message = None
        self.assertIsNone(message)

    def test_variable_not_none(self):
        message = "Hello"
        self.assertIsNone(message)

    def test_variable_not_none_with_msg(self):
        message = "Hello"
        self.assertIsNone(
            message,
            f'The message is "{message}" so it is not None.',
        )
```

Результат `python3 -m unittest -v` (файл називається `test_none.py`, шляхи скорочено):

```text
test_variable_none (test_none.TestNone.test_variable_none) ... ok
test_variable_not_none (test_none.TestNone.test_variable_not_none) ... FAIL
test_variable_not_none_with_msg (test_none.TestNone.test_variable_not_none_with_msg) ... FAIL

======================================================================
FAIL: test_variable_not_none (test_none.TestNone.test_variable_not_none)
----------------------------------------------------------------------
Traceback (most recent call last):
  File ".../test_none.py", line 11, in test_variable_not_none
    self.assertIsNone(message)
    ~~~~~~~~~~~~~~~~~^^^^^^^^^
AssertionError: 'Hello' is not None

======================================================================
FAIL: test_variable_not_none_with_msg (test_none.TestNone.test_variable_not_none_with_msg)
----------------------------------------------------------------------
Traceback (most recent call last):
  File ".../test_none.py", line 15, in test_variable_not_none_with_msg
    self.assertIsNone(
    ~~~~~~~~~~~~~~~~~^
        message,
        ^^^^^^^^
        f'The message is "{message}" so it is not None.',
        ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
    )
    ^
AssertionError: 'Hello' is not None : The message is "Hello" so it is not None.

----------------------------------------------------------------------
Ran 3 tests in 0.000s

FAILED (failures=2)
```

Стандартне повідомлення `'Hello' is not None` уже показує неочікуване значення. Власний `msg` додається після ` : `. Тут він лише повторює значення, тож у справжньому тесті використовуйте `msg` для інформації, якої значення не містить, наприклад *які саме* вхідні дані його дали.

## Чому не `assertFalse()`?

`None` — хибне значення, тож `assertFalse(result)` проходить, коли `result` дорівнює `None`. Але він так само проходить для `0`, `""`, `[]`, `{}` і `False`. Коли одне з них — допустимий результат, `assertFalse()` не відрізняє «значення немає» від «допустимого хибного значення», і помилка прослизає:

```python
import unittest

DISCOUNTS = {"WELCOME": 10, "STAFF": 0}


def get_discount(code):
    return DISCOUNTS.get(code, 0)  # помилка: невідомий код виглядає як знижка 0 %


class TestDiscount(unittest.TestCase):
    def test_unknown_code_falsy(self):
        self.assertFalse(get_discount("UNKNOWN"))

    def test_unknown_code_is_none(self):
        self.assertIsNone(get_discount("UNKNOWN"))

    def test_staff_code(self):
        self.assertEqual(get_discount("STAFF"), 0)
```

Результат `python3 -m unittest test_discount -v` (шляхи скорочено):

```text
test_staff_code (test_discount.TestDiscount.test_staff_code) ... ok
test_unknown_code_falsy (test_discount.TestDiscount.test_unknown_code_falsy) ... ok
test_unknown_code_is_none (test_discount.TestDiscount.test_unknown_code_is_none) ... FAIL

======================================================================
FAIL: test_unknown_code_is_none (test_discount.TestDiscount.test_unknown_code_is_none)
----------------------------------------------------------------------
Traceback (most recent call last):
  File ".../test_discount.py", line 15, in test_unknown_code_is_none
    self.assertIsNone(get_discount("UNKNOWN"))
    ~~~~~~~~~~~~~~~~~^^^^^^^^^^^^^^^^^^^^^^^^^
AssertionError: 0 is not None

----------------------------------------------------------------------
Ran 3 tests in 0.000s

FAILED (failures=1)
```

Тест з `assertFalse()` спокійно проходить, бо `0` — хибне значення. Лише `assertIsNone()` помічає, що невідомий код тепер виглядає точнісінько як допустимий код `"STAFF"`.

## Чому не `assertEqual(x, None)`?

`assertEqual(x, None)` використовує `==`, а клас може визначити `__eq__` як завгодно. Об'єкт, який стверджує, що дорівнює всьому, як-от `unittest.mock.ANY`, проходить `assertEqual(ANY, None)`, тоді як `assertIsNone(ANY)` правильно повідомляє про невдачу: `<ANY> is not None`. Такі об'єкти трапляються рідко, але `assertIsNone()` ще й чіткіше виражає ваш намір і відповідає стилю `is None`, який рекомендує PEP 8.

## `assertIsNotNone()`

```python
assertIsNotNone(obj, msg=None)
```

Тест проходить, коли `obj is not None`. Зверніть увагу, що це означає:

- `assertIsNotNone(0)`, `assertIsNotNone("")` і `assertIsNotNone([])` **проходять**. Це не перевірка на істинність.
- У разі невдачі повідомлення — лише `unexpectedly None`. Показати нема чого, тож `msg` з поясненням, що очікувалося, тут особливо корисний.

### Запобіжник перед використанням результату

Багато функцій повертають або об'єкт, або `None`. Якщо тест одразу використовує результат, а той виявився `None`, тест аварійно завершується з `AttributeError` чи `TypeError`. Це звітується як `ERROR` і приховує справжню проблему. Попередня перевірка через `assertIsNotNone()` перетворює аварію на зрозумілий `FAIL`:

```python
import re
import unittest


def parse_version(text):
    return re.fullmatch(r"v?(\d+)\.(\d+)\.(\d+)", text)


class TestParseVersion(unittest.TestCase):
    def test_without_guard(self):
        match = parse_version("version 3.14")
        self.assertEqual(match.group(1), "3")

    def test_with_guard(self):
        match = parse_version("version 3.14")
        self.assertIsNotNone(match, "pattern did not match 'version 3.14'")
        self.assertEqual(match.group(1), "3")

    def test_valid_version(self):
        match = parse_version("v3.14.0")
        self.assertIsNotNone(match)
        self.assertEqual(match.groups(), ("3", "14", "0"))
```

Результат `python3 -m unittest test_version -v` (шляхи скорочено):

```text
test_valid_version (test_version.TestParseVersion.test_valid_version) ... ok
test_with_guard (test_version.TestParseVersion.test_with_guard) ... FAIL
test_without_guard (test_version.TestParseVersion.test_without_guard) ... ERROR

======================================================================
ERROR: test_without_guard (test_version.TestParseVersion.test_without_guard)
----------------------------------------------------------------------
Traceback (most recent call last):
  File ".../test_version.py", line 12, in test_without_guard
    self.assertEqual(match.group(1), "3")
                     ^^^^^^^^^^^
AttributeError: 'NoneType' object has no attribute 'group'

======================================================================
FAIL: test_with_guard (test_version.TestParseVersion.test_with_guard)
----------------------------------------------------------------------
Traceback (most recent call last):
  File ".../test_version.py", line 16, in test_with_guard
    self.assertIsNotNone(match, "pattern did not match 'version 3.14'")
    ~~~~~~~~~~~~~~~~~~~~^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
AssertionError: unexpectedly None : pattern did not match 'version 3.14'

----------------------------------------------------------------------
Ran 3 tests in 0.000s

FAILED (failures=1, errors=1)
```

Обидва тести знаходять ту саму проблему, але другий пояснює її мовою тесту, а не через відсутній атрибут.

`test_valid_version` показує звичний шаблон: спершу `assertIsNotNone()`, потім **конкретна** перевірка значення. Сам по собі `assertIsNotNone()` слабкий: він проходить для будь-якого значення, зокрема й неправильного.

## Типові помилки

- **Перевіряти `None` через `assertFalse()`.** Він також проходить для `0`, `""`, `[]` і `False`, як показує приклад зі знижками.
- **Писати `assertTrue(result is None)`.** Це працює, але невдача повідомляє лише `False is not true`. `assertIsNone(result)` показує фактичне значення.
- **Забути викликати функцію.** `self.assertIsNotNone(get_user)` проходить, бо сам об'єкт функції не є `None`. Пишіть `get_user()`.
- **Покладатися лише на `assertIsNotNone()`.** «Не `None`» майже нічого не каже про правильність. Додайте після нього `assertEqual()` або іншу конкретну перевірку.
- **Забути `return` у коді, який тестуєте.** Функція, що завершується без `return`, повертає `None`. Тести, які порівнюють результат через `assertEqual()`, це помітять (повідомлення буде `None != 120`), але тест, що для випадку «нічого не знайдено» використовує лише `assertFalse()` чи `assertIsNone()`, може пройти випадково. Перевіряйте і випадок «знайдено», і випадок «не знайдено».

## Підсумок

- `assertIsNone(obj, msg=None)` проходить, коли `obj is None`. У разі невдачі показує значення: `'Hello' is not None`.
- `assertIsNotNone(obj, msg=None)` проходить, коли `obj is not None`. У разі невдачі повідомляє лише `unexpectedly None`, тож додавайте `msg`.
- Обидва методи перевіряють ідентичність із `None`, а не істинність: `0`, `""` і `[]` — *не* `None`.
- Віддавайте перевагу `assertIsNone()` перед `assertFalse()`, який не відрізняє `None` від інших хибних значень, і перед `assertEqual(x, None)`, який залежить від `__eq__`.
- Використовуйте `assertIsNotNone()` як запобіжник перед роботою з необов'язковим результатом, а потім перевіряйте саме значення.

## Практика

### Вправа 1: Протестуйте `find_user()`

Файл `users.py` містить:

```python
def find_user(users, user_id):
    for user in users:
        if user["id"] == user_id:
            return user
    return None
```

Напишіть тести для трьох випадків: наявний користувач (перевірте, що результат не `None` і має правильне ім'я), відсутній ідентифікатор і порожній список.

### Вправа 2: Тест, що обманює

Файл `search.py` містить функцію з помилкою, а її тести проходять:

```python
def find_index(items, target):
    for index, item in enumerate(items):
        if item == target:
            return index
    return 0
```

```python
import unittest

from search import find_index


class TestFindIndex(unittest.TestCase):
    def test_found(self):
        self.assertEqual(find_index(["a", "b", "c"], "b"), 1)

    def test_not_found(self):
        self.assertFalse(find_index(["a", "b", "c"], "z"))
```

Функція має повертати `None`, коли шуканого елемента немає. Поясніть, чому тести не ловлять помилку, перепишіть їх так, щоб вони не проходили для цієї версії (додайте також тест для елемента з індексом `0`), а потім виправте функцію.

### Вправа 3: Перевірка дат

Файл `dates.py` містить:

```python
import re


def parse_date(text):
    match = re.fullmatch(r"(\d{4})-(\d{2})-(\d{2})", text)
    if match is None:
        return None
    return tuple(int(part) for part in match.groups())
```

Напишіть два тести з циклами `subTest()`. Перший перевіряє, що `"2026-11-25"` і `"1991-08-24"` приймаються: результат не `None` (з `msg`, що називає вхідний рядок) і дорівнює очікуваному кортежу цілих чисел. Другий перевіряє, що `"25.11.2026"`, `"2026-1-5"`, `""` і `"2026-11-25 "` відхиляються.

## Розв'язки

### Вправа 1

```python
import unittest

from users import find_user

USERS = [{"id": 1, "name": "olena"}, {"id": 2, "name": "taras"}]


class TestFindUser(unittest.TestCase):
    def test_existing_user(self):
        user = find_user(USERS, 2)
        self.assertIsNotNone(user)
        self.assertEqual(user["name"], "taras")

    def test_missing_user(self):
        self.assertIsNone(find_user(USERS, 99))

    def test_empty_list(self):
        self.assertIsNone(find_user([], 1))
```

Результат `python3 -m unittest test_users -v`:

```text
test_empty_list (test_users.TestFindUser.test_empty_list) ... ok
test_existing_user (test_users.TestFindUser.test_existing_user) ... ok
test_missing_user (test_users.TestFindUser.test_missing_user) ... ok

----------------------------------------------------------------------
Ran 3 tests in 0.000s

OK
```

### Вправа 2

Функція з помилкою повертає `0` для відсутнього елемента, а `0` — хибне значення, тож `assertFalse()` проходить. Гірше того, `0` — це ще й допустимий індекс, тому код, що викликає функцію, не відрізнить «не знайдено» від «знайдено на початку».

Переписані тести:

```python
import unittest

from search import find_index


class TestFindIndex(unittest.TestCase):
    def test_found(self):
        self.assertEqual(find_index(["a", "b", "c"], "b"), 1)

    def test_found_at_start(self):
        self.assertEqual(find_index(["a", "b", "c"], "a"), 0)

    def test_not_found(self):
        self.assertIsNone(find_index(["a", "b", "c"], "z"))
```

Із функцією, що містить помилку, `python3 -m unittest test_search_fixed -v` повідомляє (шляхи скорочено):

```text
test_found (test_search_fixed.TestFindIndex.test_found) ... ok
test_found_at_start (test_search_fixed.TestFindIndex.test_found_at_start) ... ok
test_not_found (test_search_fixed.TestFindIndex.test_not_found) ... FAIL

======================================================================
FAIL: test_not_found (test_search_fixed.TestFindIndex.test_not_found)
----------------------------------------------------------------------
Traceback (most recent call last):
  File ".../test_search_fixed.py", line 14, in test_not_found
    self.assertIsNone(find_index(["a", "b", "c"], "z"))
    ~~~~~~~~~~~~~~~~~^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
AssertionError: 0 is not None

----------------------------------------------------------------------
Ran 3 tests in 0.000s

FAILED (failures=1)
```

Виправлення — замінити `return 0` на `return None`:

```python
def find_index(items, target):
    for index, item in enumerate(items):
        if item == target:
            return index
    return None
```

Результат тієї самої команди після виправлення:

```text
test_found (test_search_fixed.TestFindIndex.test_found) ... ok
test_found_at_start (test_search_fixed.TestFindIndex.test_found_at_start) ... ok
test_not_found (test_search_fixed.TestFindIndex.test_not_found) ... ok

----------------------------------------------------------------------
Ran 3 tests in 0.000s

OK
```

### Вправа 3

```python
import unittest

from dates import parse_date


class TestParseDate(unittest.TestCase):
    def test_valid_dates(self):
        cases = {"2026-11-25": (2026, 11, 25), "1991-08-24": (1991, 8, 24)}
        for text, expected in cases.items():
            with self.subTest(text=text):
                result = parse_date(text)
                self.assertIsNotNone(result, f"{text!r} should be accepted")
                self.assertEqual(result, expected)

    def test_invalid_dates(self):
        for text in ["25.11.2026", "2026-1-5", "", "2026-11-25 "]:
            with self.subTest(text=text):
                self.assertIsNone(parse_date(text))
```

Результат `python3 -m unittest test_dates -v`:

```text
test_invalid_dates (test_dates.TestParseDate.test_invalid_dates) ... ok
test_valid_dates (test_dates.TestParseDate.test_valid_dates) ... ok

----------------------------------------------------------------------
Ran 2 tests in 0.000s

OK
```

Щоб побачити, навіщо тут `msg`, уявіть помилку в шаблоні (скажімо, `/` замість `-`). Тоді невдачі виглядатимуть так:

```text
FAIL: test_valid_dates (test_dates.TestParseDate.test_valid_dates) (text='2026-11-25')
AssertionError: unexpectedly None : '2026-11-25' should be accepted
FAIL: test_valid_dates (test_dates.TestParseDate.test_valid_dates) (text='1991-08-24')
AssertionError: unexpectedly None : '1991-08-24' should be accepted
```

`re.fullmatch()` вимагає збігу з **усім** рядком, тому `"2026-11-25 "` із пробілом у кінці відхиляється. З `re.match()` він був би прийнятий.

---

*Джерело: [pythontutorial.net — Python assertIsNone()](https://www.pythontutorial.net/python-unit-testing/python-assertisnone/). Адаптовано й доповнено для PyJourney.*
