# assertIn()

Багатьом тестам не потрібне точне значення результату, достатньо знати, що він щось містить: тег у списку, слово в повідомленні, ключ у словнику. `assertIn()` перевіряє належність за допомогою оператора `in`, а `assertNotIn()` — відсутність, що не менш корисно (наприклад, «журнал не повинен містити пароль»).

## Що ви дізнаєтесь

- Що перевіряють `assertIn(member, container, msg=None)` і `assertNotIn()`
- Як виглядають їхні повідомлення про невдачу
- Як поводиться `in` для списків, рядків, словників, множин, діапазонів і генераторів і що це означає для ваших тестів
- Як перевірити значення словника, пари «ключ — значення» і те, що словник містить «принаймні ці елементи»
- Типові пастки: переплутані аргументи, вичерпані генератори, нехешовані елементи

## Як працює `assertIn()`

```python
assertIn(member, container, msg=None)
```

Тест проходить, коли `member in container` істинне. Порядок аргументів такий самий, як у виразі з `in`: **спершу елемент**, **потім контейнер**.

```python
import unittest


class TestIn(unittest.TestCase):
    def test_in_list(self):
        self.assertIn(1, [1, 2, 3])

    def test_in_string(self):
        self.assertIn("python", "python tutorial")


class TestNotIn(unittest.TestCase):
    def test_not_in_list(self):
        self.assertNotIn(0, [1, 2, 3])

    def test_not_in_string(self):
        self.assertNotIn("java", "python tutorial")
```

Результат `python3 -m unittest -v` (файл називається `test_membership.py`):

```text
test_in_list (test_membership.TestIn.test_in_list) ... ok
test_in_string (test_membership.TestIn.test_in_string) ... ok
test_not_in_list (test_membership.TestNotIn.test_not_in_list) ... ok
test_not_in_string (test_membership.TestNotIn.test_not_in_string) ... ok

----------------------------------------------------------------------
Ran 4 tests in 0.000s

OK
```

`assertNotIn(member, container, msg=None)` проходить, коли `member not in container`. У списку `in` шукає **елемент**, а в рядку — **підрядок**, тому `"python"` знаходиться в `"python tutorial"`.

## Повідомлення про невдачу

Обидва методи показують і елемент, і весь контейнер:

```python
import unittest


class TestFailures(unittest.TestCase):
    def test_missing_item(self):
        fruits = ["apple", "banana"]
        self.assertIn("kiwi", fruits)

    def test_case_matters(self):
        self.assertIn("Python", "python tutorial")

    def test_unexpected_item(self):
        log = "user logged in; password=secret"
        self.assertNotIn("password", log, "the log must not contain credentials")
```

Рядки `AssertionError` з виводу `python3 -m unittest test_failures` (в алфавітному порядку тестів):

```text
AssertionError: 'Python' not found in 'python tutorial'
AssertionError: 'kiwi' not found in ['apple', 'banana']
AssertionError: 'password' unexpectedly found in 'user logged in; password=secret' : the log must not contain credentials
```

Видимий контейнер — головна перевага над `assertTrue("kiwi" in fruits)`, який повідомив би лише `False is not true`. Другий рядок нагадує, що порівняння рядків чутливе до регістру.

> **Зверніть увагу:** контейнер виводиться повністю, без скорочення. Якщо список має тисячі елементів, то й повідомлення про невдачу міститиме тисячі елементів (для списку з 1000 цілих чисел це майже 5000 символів). Для великих контейнерів перевіряйте меншу, релевантну частину або додайте `msg`, який підсумовує ситуацію.

## Що означає `in` для різних контейнерів

`assertIn()` нічого не додає до оператора `in`, тож його поведінка повністю залежить від контейнера:

| Контейнер | `member in container` перевіряє | Приклад, що проходить |
|---|---|---|
| `list`, `tuple` | елемент, рівний `member` (`==`) | `assertIn(2, [1, 2, 3])` |
| `str` | підрядок | `assertIn("tut", "python tutorial")` |
| `dict` | **ключ** | `assertIn("city", {"city": "Lviv"})` |
| `set`, `frozenset` | елемент, через хешування | `assertIn("a", {"a", "b"})` |
| `range` | число в діапазоні, обчислене без перебору | `assertIn(10**9, range(0, 2 * 10**9, 2))` |
| генератор, ітератор | елемент, **вичерпуючи** значення, доки не знайдеться збіг | див. пастки нижче |

Оскільки списки порівнюють елементи через `==`, `assertIn(1, [True])` і `assertIn(1.0, [1])` проходять. А оскільки кожен рядок містить порожній рядок, `assertIn("", "abc")` теж проходить.

У списку шукається *елемент*, а не підпослідовність: `assertIn([1, 2], [1, 2, 3])` не проходить, бо жоден окремий елемент списку не дорівнює `[1, 2]`.

### Словники: ключі, значення та пари

Для словника `in` перевіряє лише **ключі**. Щоб перевірити значення чи пари «ключ — значення», використовуйте представлення (views) словника:

```python
import unittest


class TestUser(unittest.TestCase):
    def setUp(self):
        self.user = {"name": "olena", "city": "Lviv", "roles": ["editor"]}

    def test_has_key(self):
        self.assertIn("city", self.user)

    def test_value_is_not_a_key(self):
        self.assertIn("Lviv", self.user)

    def test_has_value(self):
        self.assertIn("Lviv", self.user.values())

    def test_has_item(self):
        self.assertIn(("city", "Lviv"), self.user.items())

    def test_contains_subset(self):
        expected = {"city": "Lviv", "roles": ["editor"]}
        self.assertLessEqual(expected.items(), self.user.items())

    def test_missing_key(self):
        self.assertNotIn("password", self.user)
```

Результат `python3 -m unittest test_user -v` (шляхи скорочено):

```text
test_contains_subset (test_user.TestUser.test_contains_subset) ... ok
test_has_item (test_user.TestUser.test_has_item) ... ok
test_has_key (test_user.TestUser.test_has_key) ... ok
test_has_value (test_user.TestUser.test_has_value) ... ok
test_missing_key (test_user.TestUser.test_missing_key) ... ok
test_value_is_not_a_key (test_user.TestUser.test_value_is_not_a_key) ... FAIL

======================================================================
FAIL: test_value_is_not_a_key (test_user.TestUser.test_value_is_not_a_key)
----------------------------------------------------------------------
Traceback (most recent call last):
  File ".../test_user.py", line 12, in test_value_is_not_a_key
    self.assertIn("Lviv", self.user)
    ~~~~~~~~~~~~~^^^^^^^^^^^^^^^^^^^
AssertionError: 'Lviv' not found in {'name': 'olena', 'city': 'Lviv', 'roles': ['editor']}

----------------------------------------------------------------------
Ran 6 tests in 0.000s

FAILED (failures=1)
```

- `"Lviv"` — це значення, а не ключ, тому `assertIn("Lviv", self.user)` не проходить, хоча в повідомленні `'Lviv'` чудово видно всередині словника.
- `user.values()` і `user.items()` дають змогу шукати серед значень і пар `(key, value)`.
- Щоб перевірити, що словник містить **принаймні** певні пари «ключ — значення» (і, можливо, ще якісь), порівняйте представлення елементів через `assertLessEqual()`: `dict.items()` поводиться як множина, тож `<=` означає «є підмножиною». Це працює навіть тоді, коли значення — списки. У разі невдачі повідомлення показує обидва представлення, наприклад `dict_items([('host', 'localhost'), ('port', 5433)]) not less than or equal to dict_items([...])`.

> **Зверніть увагу:** у старому коді для останньої перевірки може траплятися `assertDictContainsSubset()`. Цей метод роками був застарілим і його вилучено в Python 3.12.

## Пастки

```python
import unittest


def even_numbers(limit):
    return (n for n in range(limit) if n % 2 == 0)


class TestPitfalls(unittest.TestCase):
    def test_generator_is_consumed(self):
        numbers = even_numbers(10)
        self.assertIn(4, numbers)
        self.assertIn(2, numbers)

    def test_swapped_arguments(self):
        self.assertIn([1, 2, 3], 1)

    def test_unhashable_member(self):
        self.assertIn([1, 2], {(1, 2), (3, 4)})
```

Рядки `FAIL`/`ERROR` і останній рядок кожного трасування з виводу `python3 -m unittest test_pitfalls` (адреса генератора щоразу інша):

```text
ERROR: test_swapped_arguments (test_pitfalls.TestPitfalls.test_swapped_arguments)
TypeError: argument of type 'int' is not a container or iterable

ERROR: test_unhashable_member (test_pitfalls.TestPitfalls.test_unhashable_member)
TypeError: cannot use 'list' as a set element (unhashable type: 'list')

FAIL: test_generator_is_consumed (test_pitfalls.TestPitfalls.test_generator_is_consumed)
AssertionError: 2 not found in <generator object even_numbers.<locals>.<genexpr> at 0x104a9c930>
```

- **`in` вичерпує генератор.** Щоб знайти `4`, `in` забирає з генератора `0`, `2` і `4`. Друга перевірка починається з `6` і `2` вже не бачить. Повідомлення теж не допомагає: `repr()` генератора не показує його елементів. Спершу перетворіть його на список: `numbers = list(even_numbers(10))`.
- **Переплутані аргументи** перетворюють перевірку на `[1, 2, 3] in 1`, що генерує `TypeError`, тож тест завершується з `ERROR`. З двома рядками переплутані аргументи не спричиняють аварії, а просто перевіряють протилежне: `assertIn("python tutorial", "python")` не проходить, бо довгий рядок не міститься в короткому.
- **Нехешований елемент разом із множиною чи словником** (`[1, 2]` — список) генерує `TypeError`. Використовуйте кортеж `(1, 2)`, бо саме так його зберігає множина.

## Типові помилки

- **Очікувати, що `assertIn()` шукає серед значень словника.** Для словника він перевіряє ключі. Використовуйте `.values()` або `.items()`.
- **Плутати `member` і `container`.** Елемент іде першим, як у `member in container`.
- **Перевіряти генератор чи ітератор кілька разів.** Кожен `in` вичерпує частину значень. Спершу перетворіть його на список.
- **Очікувати перевірки підсписку.** `assertIn([1, 2], [1, 2, 3])` не проходить. Щоб перевірити наявність кількох елементів, використовуйте цикл із `subTest()` або порівняйте множини: `assertLessEqual({1, 2}, set(result))`.
- **Забувати, що рядки чутливі до регістру, а `""` міститься в кожному рядку.** Явно нормалізуйте регістр, коли він не важливий, і ніколи не використовуйте порожній рядок як очікуваний елемент.
- **Писати `assertTrue(x in items)`.** Так ви приховуєте обидва значення. `assertIn(x, items)` їх показує.
- **Використовувати вилучений `assertDictContainsSubset()`.** Пишіть `assertLessEqual(expected.items(), actual.items())`.

## Підсумок

- `assertIn(member, container, msg=None)` проходить, коли `member in container`. `assertNotIn()` проходить, коли `member not in container`.
- Повідомлення про невдачу показують елемент і весь контейнер: `'kiwi' not found in ['apple', 'banana']` та `'password' unexpectedly found in '...'`.
- Значення `in` залежить від контейнера: елемент (list, tuple, set), підрядок (str), ключ (dict), число (range).
- Для словників використовуйте `.values()` і `.items()`, щоб перевіряти значення й пари, та `assertLessEqual(expected.items(), actual.items())` для перевірки «містить принаймні ці елементи».
- `in` вичерпує генератори: перед кількома перевірками перетворіть генератор на список.
- Переплутані аргументи та нехешовані елементи генерують `TypeError`, тож тест завершується з `ERROR`, а не `FAIL`.

## Практика

### Вправа 1: Хештеги

Файл `hashtags.py` містить:

```python
import re


def extract_hashtags(text):
    return [tag.lower() for tag in re.findall(r"#(\w+)", text)]
```

Для тексту `"Learning #Python and #unittest today"` напишіть тести, які перевіряють: `"python"` і `"unittest"` є серед тегів; звичайного слова `"learning"` серед них немає; теги нормалізовано (немає ні `"Python"`, ні `"#python"`). Додайте тест, що текст без хештегів дає порожній список.

### Вправа 2: Перевірте конфігурацію

Файл `config.py` містить:

```python
def load_config():
    return {
        "debug": False,
        "database": {"host": "localhost", "port": 5432, "pool_size": 5},
        "features": ["search", "export"],
    }
```

Напишіть тести, які перевіряють: конфігурація має розділ `"database"`; `"export"` — одна з функцій у `"features"`; ключа `"secret_key"` немає; налаштування бази даних містять принаймні `host="localhost"` і `port=5432` (згодом можуть з'явитися інші ключі, тож не порівнюйте весь словник).

### Вправа 3: Тест, який нічого не бачить

Файл `ids.py` містить функцію-генератор:

```python
def read_ids(lines):
    for line in lines:
        line = line.strip()
        if line.isdigit():
            yield int(line)
```

Цей тест проходить, хоча його друге твердження хибне (`5` *є* одним з ідентифікаторів):

```python
import unittest

from ids import read_ids


class TestReadIds(unittest.TestCase):
    def test_ids(self):
        ids = read_ids(["3", "x", "5", "7"])
        self.assertIn(7, ids)
        self.assertNotIn(5, ids)
```

Поясніть, чому він проходить, а потім перепишіть тести так, щоб вони перевіряли справжній результат.

## Розв'язки

### Вправа 1

```python
import unittest

from hashtags import extract_hashtags


class TestExtractHashtags(unittest.TestCase):
    def setUp(self):
        self.tags = extract_hashtags("Learning #Python and #unittest today")

    def test_contains_tags(self):
        self.assertIn("python", self.tags)
        self.assertIn("unittest", self.tags)

    def test_plain_words_are_not_tags(self):
        self.assertNotIn("learning", self.tags)

    def test_tags_are_normalised(self):
        self.assertNotIn("Python", self.tags)
        self.assertNotIn("#python", self.tags)

    def test_no_tags(self):
        self.assertEqual(extract_hashtags("no tags here"), [])
```

Результат `python3 -m unittest test_hashtags -v`:

```text
test_contains_tags (test_hashtags.TestExtractHashtags.test_contains_tags) ... ok
test_no_tags (test_hashtags.TestExtractHashtags.test_no_tags) ... ok
test_plain_words_are_not_tags (test_hashtags.TestExtractHashtags.test_plain_words_are_not_tags) ... ok
test_tags_are_normalised (test_hashtags.TestExtractHashtags.test_tags_are_normalised) ... ok

----------------------------------------------------------------------
Ran 4 tests in 0.000s

OK
```

`self.tags` — список, тож `assertIn()` шукає цілі елементи: `"pyth"` тут *не* знайшовся б, на відміну від рядка. Для порожнього випадку точною перевіркою є `assertEqual(..., [])`: шукати там нема чого.

### Вправа 2

```python
import unittest

from config import load_config


class TestConfig(unittest.TestCase):
    def setUp(self):
        self.config = load_config()

    def test_has_database_section(self):
        self.assertIn("database", self.config)

    def test_export_enabled(self):
        self.assertIn("export", self.config["features"])

    def test_no_secret_key(self):
        self.assertNotIn("secret_key", self.config)

    def test_database_settings(self):
        expected = {"host": "localhost", "port": 5432}
        self.assertLessEqual(expected.items(), self.config["database"].items())
```

Результат `python3 -m unittest test_config -v`:

```text
test_database_settings (test_config.TestConfig.test_database_settings) ... ok
test_export_enabled (test_config.TestConfig.test_export_enabled) ... ok
test_has_database_section (test_config.TestConfig.test_has_database_section) ... ok
test_no_secret_key (test_config.TestConfig.test_no_secret_key) ... ok

----------------------------------------------------------------------
Ran 4 tests in 0.000s

OK
```

`test_database_settings` ігнорує `pool_size`, тож нові налаштування не зламають тест. Якби порт змінився на `5433`, тест не пройшов би з повідомленням `dict_items([('host', 'localhost'), ('port', 5433)]) not less than or equal to dict_items([('host', 'localhost'), ('port', 5432), ('pool_size', 5)])`.

### Вправа 3

`read_ids()` повертає генератор. Щоб знайти `7`, `assertIn()` забирає `3`, `5` і `7`, і генератор вичерпується. Потім `assertNotIn(5, ids)` шукає в порожньому генераторі, а «5 немає в порожнечі» — правда. Хибне очікування проходить непоміченим.

Зберіть ідентифікатори в список один раз і перевіряйте список:

```python
import unittest

from ids import read_ids


class TestReadIds(unittest.TestCase):
    def setUp(self):
        self.ids = list(read_ids(["3", "x", "5", "7"]))

    def test_contains_ids(self):
        self.assertIn(7, self.ids)
        self.assertIn(5, self.ids)
        self.assertNotIn(0, self.ids)

    def test_exact_result(self):
        self.assertEqual(self.ids, [3, 5, 7])
```

Результат `python3 -m unittest test_ids_solution -v`:

```text
test_contains_ids (test_ids_solution.TestReadIds.test_contains_ids) ... ok
test_exact_result (test_ids_solution.TestReadIds.test_exact_result) ... ok

----------------------------------------------------------------------
Ran 2 tests in 0.000s

OK
```

Зі списком початкове хибне твердження `assertNotIn(5, self.ids)` тепер не пройшло б, як і має бути: `5 unexpectedly found in [3, 5, 7]`. Коли повний очікуваний результат відомий, `assertEqual()` сильніший за кілька викликів `assertIn()`, бо перевіряє ще й порядок та відсутність зайвого.

---

*Джерело: [pythontutorial.net — Python assertIn()](https://www.pythontutorial.net/python-unit-testing/python-assertin/). Адаптовано й доповнено для PyJourney.*
