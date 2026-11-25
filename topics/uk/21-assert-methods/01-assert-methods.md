# Методи-твердження (assert methods)

Твердження (assertion) — це рядок тесту, який справді щось перевіряє. `unittest.TestCase` надає десятки методів `assert*`, кожен з яких призначений для певного типу перевірки. Правильний вибір має значення: від нього залежить, чи тест, що не пройшов, повідомить вам `False is not true`, чи `'kiwi' not found in ['apple', 'banana']`.

## Що ви дізнаєтесь

- Чому методи `self.assert*()` кращі за звичайну інструкцію `assert`
- Найуживаніші методи-твердження, згруповані за тим, що вони перевіряють
- Як необов'язковий аргумент `msg` і атрибут `longMessage` впливають на повідомлення про невдачу
- Як перевіряти винятки, попередження та повідомлення журналу (logging)
- Які методи з'явилися в Python 3.14, а яких старих псевдонімів уже немає

## Чому методи-твердження, а не `assert`

Усі методи-твердження роблять, по суті, одне: якщо перевірка не справджується, вони генерують `AssertionError`, і засіб запуску позначає тест як `FAIL`. Звичайна інструкція `assert` робить те саме, то чому б не використовувати її?

- **Кращі повідомлення.** `self.assertGreater(3, 5)` повідомляє `3 not greater than 5`. `assert 3 > 5` — лише `AssertionError`.
- **Порівняння вмісту контейнерів.** `assertEqual()` для двох списків, словників чи довгих рядків показує, де саме вони відрізняються.
- **Їх неможливо вимкнути.** Під час запуску з `-O` Python вилучає інструкції `assert`. Методи-твердження — звичайні виклики методів, вони виконуються завжди.

> **Зверніть увагу:** інші фреймворки тестування, як-от pytest, переписують звичайні інструкції `assert`, щоб отримати докладні повідомлення. В `unittest` користуйтеся методами.

## Найпоширеніші методи-твердження

### Рівність, ідентичність, істинність і належність

| Метод | Проходить, якщо |
|---|---|
| `assertEqual(a, b)` | `a == b` |
| `assertNotEqual(a, b)` | `a != b` |
| `assertTrue(x)` | `bool(x)` дорівнює `True` |
| `assertFalse(x)` | `bool(x)` дорівнює `False` |
| `assertIs(a, b)` | `a is b` |
| `assertIsNot(a, b)` | `a is not b` |
| `assertIsNone(x)` | `x is None` |
| `assertIsNotNone(x)` | `x is not None` |
| `assertIn(a, b)` | `a in b` |
| `assertNotIn(a, b)` | `a not in b` |
| `assertIsInstance(a, b)` | `isinstance(a, b)` |
| `assertNotIsInstance(a, b)` | `not isinstance(a, b)` |

### Порівняння та спеціальні перевірки

| Метод | Проходить, якщо |
|---|---|
| `assertGreater(a, b)` | `a > b` |
| `assertGreaterEqual(a, b)` | `a >= b` |
| `assertLess(a, b)` | `a < b` |
| `assertLessEqual(a, b)` | `a <= b` |
| `assertAlmostEqual(a, b)` | `round(a - b, 7) == 0` |
| `assertNotAlmostEqual(a, b)` | `round(a - b, 7) != 0` |
| `assertRegex(s, r)` | `re.search(r, s)` знаходить збіг |
| `assertNotRegex(s, r)` | `re.search(r, s)` не знаходить збігу |
| `assertCountEqual(a, b)` | `a` і `b` містять ті самі елементи, кожен однакову кількість разів, у будь-якому порядку |

Ось вони в дії:

```python
import unittest


class TestOverview(unittest.TestCase):
    def test_equality_and_identity(self):
        self.assertEqual(2 + 2, 4)
        self.assertNotEqual("a", "b")
        self.assertIs(None, None)
        self.assertIsNot([], [])

    def test_truth_and_none(self):
        self.assertTrue([1])
        self.assertFalse("")
        self.assertIsNone({}.get("missing"))
        self.assertIsNotNone(0)

    def test_membership_and_type(self):
        self.assertIn(3, [1, 2, 3])
        self.assertNotIn("x", "python")
        self.assertIsInstance(True, int)
        self.assertNotIsInstance(1.0, int)

    def test_comparisons(self):
        self.assertGreater(5, 3)
        self.assertGreaterEqual(5, 5)
        self.assertLess(1, 2)
        self.assertLessEqual(2, 2)
        self.assertAlmostEqual(0.1 + 0.2, 0.3)
        self.assertRegex("order-1234", r"\d{4}")
        self.assertCountEqual([3, 1, 2, 1], [1, 1, 2, 3])
```

Результат `python3 -m unittest -v` (файл називається `test_overview.py`, час щоразу інший):

```text
test_comparisons (test_overview.TestOverview.test_comparisons) ... ok
test_equality_and_identity (test_overview.TestOverview.test_equality_and_identity) ... ok
test_membership_and_type (test_overview.TestOverview.test_membership_and_type) ... ok
test_truth_and_none (test_overview.TestOverview.test_truth_and_none) ... ok

----------------------------------------------------------------------
Ran 4 tests in 0.000s

OK
```

Кілька деталей, на які варто звернути увагу: `assertIsNot([], [])` проходить, бо два літерали списку створюють два різні об'єкти. `assertIsNotNone(0)` проходить, бо `0` хибне значення, але не `None`. `assertIsInstance(True, int)` проходить, бо `bool` — підклас `int`.

### Як виглядають повідомлення про невдачу

Справжня цінність конкретних методів стає помітною, коли вони не проходять:

```python
import unittest


class TestFailureMessages(unittest.TestCase):
    def test_true(self):
        self.assertTrue(3 > 5)

    def test_greater(self):
        self.assertGreater(3, 5)

    def test_in(self):
        self.assertIn("kiwi", ["apple", "banana"])

    def test_count_equal(self):
        self.assertCountEqual([1, 2, 2], [2, 1, 1])

    def test_regex(self):
        self.assertRegex("order-12", r"\d{4}")
```

Рядки `AssertionError` з виводу `python3 -m unittest test_failures` (трасування скорочено):

```text
AssertionError: Element counts were not equal:
First has 1, Second has 2:  1
First has 2, Second has 1:  2

AssertionError: 3 not greater than 5

AssertionError: 'kiwi' not found in ['apple', 'banana']

AssertionError: Regex didn't match: '\\d{4}' not found in 'order-12'

AssertionError: False is not true
```

`assertTrue(3 > 5)` знає лише те, що отримав `False`. Порівняння обчислилося ще до виклику, тож значення `3` і `5` втрачено. Усі інші методи отримали обидва значення й можуть описати проблему.

## Аргумент `msg` і `longMessage`

Кожен метод-твердження приймає необов'язковий останній аргумент `msg` з вашим поясненням. За замовчуванням його **додають** до стандартного повідомлення після ` : `:

```python
import unittest


class TestMessage(unittest.TestCase):
    def test_default(self):
        stock = 3
        self.assertGreaterEqual(stock, 5, "not enough items in stock")


class TestShortMessage(unittest.TestCase):
    longMessage = False

    def test_short(self):
        stock = 3
        self.assertGreaterEqual(stock, 5, "not enough items in stock")
```

Два рядки `AssertionError` з виводу `python3 -m unittest test_msg`:

```text
AssertionError: 3 not greater than or equal to 5 : not enough items in stock
AssertionError: not enough items in stock
```

Це контролює атрибут класу `longMessage` (за замовчуванням `True`). Якщо встановити його в `False`, `msg` **замінює** стандартне повідомлення, і зазвичай корисна інформація губиться. Залиште значення за замовчуванням, а через `msg` додавайте контекст, якого не видно із самих значень, наприклад який запис чи які вхідні дані перевірялися.

## Винятки, попередження й журнали

Ці методи перевіряють *поведінку*, а не значення. Усі вони працюють як менеджери контексту:

| Метод | Проходить, якщо код усередині блоку... |
|---|---|
| `assertRaises(exc)` | генерує `exc` (або його підклас) |
| `assertRaisesRegex(exc, r)` | генерує `exc`, і повідомлення відповідає регулярному виразу `r` |
| `assertWarns(warn)` | видає попередження категорії `warn` |
| `assertWarnsRegex(warn, r)` | видає `warn`, і повідомлення відповідає `r` |
| `assertLogs(logger, level)` | записує в журнал `logger` хоча б одне повідомлення рівня `level` або вище |
| `assertNoLogs(logger, level)` | не записує в `logger` нічого рівня `level` або вище (Python 3.10+) |

`assertRaises()`, `assertRaisesRegex()`, `assertWarns()` і `assertWarnsRegex()` мають ще й **форму з викликом**: функцію та її аргументи передають окремо, як-от `self.assertRaises(ValueError, int, "abc")`. Не викликайте функцію самі (`self.assertRaises(ValueError, int("abc"))`), бо тоді виняток виникне ще до того, як `assertRaises()` почне роботу.

```python
import logging
import unittest
import warnings


def parse_port(text):
    port = int(text)
    if not 0 < port < 65536:
        raise ValueError(f"port out of range: {port}")
    return port


def old_api():
    warnings.warn("old_api() is deprecated", DeprecationWarning)
    return 42


def save(record):
    logging.getLogger("app.db").info("saved %s", record)


class TestSpecial(unittest.TestCase):
    def test_raises(self):
        # форма менеджера контексту
        with self.assertRaises(ValueError):
            parse_port("70000")
        # форма з викликом: функцію та її аргументи передаємо окремо
        self.assertRaises(ValueError, parse_port, "abc")
        self.assertRaisesRegex(ValueError, r"out of range: 0", parse_port, "0")

    def test_warns(self):
        with self.assertWarns(DeprecationWarning):
            result = old_api()
        self.assertEqual(result, 42)

    def test_logs(self):
        with self.assertLogs("app.db", level="INFO") as cm:
            save("user-1")
        self.assertEqual(cm.output, ["INFO:app.db:saved user-1"])

    def test_no_logs(self):
        with self.assertNoLogs("app.db", level="WARNING"):
            save("user-2")
```

Результат `python3 -m unittest test_special -v`:

```text
test_logs (test_special.TestSpecial.test_logs) ... ok
test_no_logs (test_special.TestSpecial.test_no_logs) ... ok
test_raises (test_special.TestSpecial.test_raises) ... ok
test_warns (test_special.TestSpecial.test_warns) ... ok

----------------------------------------------------------------------
Ran 4 tests in 0.001s

OK
```

`assertLogs()` тимчасово під'єднує власний обробник, тож налаштовувати logging не потрібно. `cm.output` — список рядків у форматі `LEVEL:logger:message`, а `cm.records` містить повні об'єкти `LogRecord`.

## Методи рівності для конкретних типів

`assertEqual()` дивиться на типи аргументів. Коли обидва належать до того самого вбудованого типу-контейнера, він автоматично передає роботу спеціалізованому методу, який показує зрозуміле порівняння відмінностей (diff):

| Метод | Використовується `assertEqual()` для |
|---|---|
| `assertMultiLineEqual(a, b)` | `str` |
| `assertListEqual(a, b)` | `list` |
| `assertTupleEqual(a, b)` | `tuple` |
| `assertDictEqual(a, b)` | `dict` |
| `assertSetEqual(a, b)` | `set` / `frozenset` |
| `assertSequenceEqual(a, b)` | будь-яких послідовностей (викликайте напряму) |

Самі ви їх викликатимете рідко — просто користуйтеся `assertEqual()`. Які відмінності вони показують, видно в наступній темі.

## Нове в Python 3.14

У Python 3.14 додали вісім методів для перевірок, які раніше потребували `assertTrue()`:

| Метод | Проходить, якщо |
|---|---|
| `assertHasAttr(obj, name)` / `assertNotHasAttr(obj, name)` | `hasattr(obj, name)` істинне / хибне |
| `assertIsSubclass(cls, superclass)` / `assertNotIsSubclass(...)` | `issubclass(cls, superclass)` істинне / хибне |
| `assertStartsWith(s, prefix)` / `assertNotStartsWith(s, prefix)` | `s.startswith(prefix)` істинне / хибне |
| `assertEndsWith(s, suffix)` / `assertNotEndsWith(s, suffix)` | `s.endswith(suffix)` істинне / хибне |

```python
import unittest


class Animal:
    sound = "..."


class Dog(Animal):
    pass


class TestNewIn314(unittest.TestCase):
    def test_new_methods(self):
        self.assertHasAttr(Dog(), "sound")
        self.assertNotHasAttr(Dog(), "wings")
        self.assertIsSubclass(Dog, Animal)
        self.assertNotIsSubclass(Animal, Dog)
        self.assertStartsWith("report.csv", "report")
        self.assertEndsWith("report.csv", ".csv")
        self.assertNotEndsWith("report.csv", ".txt")

    def test_failure_message(self):
        self.assertEndsWith("report.txt", ".csv")
```

Запуск `python3 -m unittest test_new314` у Python 3.14 показує одну невдачу (`test_new_methods` проходить):

```text
AssertionError: 'report.txt' doesn't end with '.csv'
```

У старіших версіях цих методів немає. Там використовуйте `assertTrue(hasattr(...))`, `assertTrue(issubclass(...))` або `assertTrue(s.endswith(...))`.

## Типові помилки

- **Використовувати `assertTrue()` для всього.** `assertTrue(a == b)`, `assertTrue(x in items)` і `assertTrue(n > 0)` в разі невдачі видають марне `False is not true`. Використовуйте `assertEqual()`, `assertIn()` і `assertGreater()`.
- **Використовувати вилучені псевдоніми.** Старі назви, як-от `assertEquals`, `assertNotEquals`, `assert_`, `failUnless`, `assertRegexpMatches` і `assertDictContainsSubset`, **вилучено в Python 3.12**. Виклик такого методу тепер спричиняє помилку:

  ```text
  AttributeError: 'T' object has no attribute 'assertEquals'. Did you mean: 'assertEqual'?
  ```

- **Викликати функцію всередині `assertRaises()`.** `self.assertRaises(ValueError, parse_port("abc"))` генерує `ValueError` ще до того, як спрацює твердження, тож тест завершується з `ERROR`. Передавайте функцію й аргументи окремо або використовуйте форму з `with`.
- **Очікувати, що `assertCountEqual()` перевіряє порядок.** Він навмисно ігнорує порядок. Якщо порядок важливий, використовуйте `assertEqual()`.
- **Встановлювати `longMessage = False` без потреби.** Тоді ваш `msg` *замінює* значення в повідомленні про невдачу.

## Підсумок

- Методи-твердження генерують `AssertionError` з інформативними повідомленнями, показують відмінності для контейнерів і не вилучаються в режимі `python -O`.
- Обирайте найконкретніший метод: `assertEqual`, `assertIs`, `assertIsNone`, `assertIn`, `assertIsInstance`, `assertGreater`, `assertRegex`, `assertCountEqual` тощо. Кожен має «заперечного» двійника.
- Кожен метод приймає необов'язковий `msg`. За стандартного `longMessage = True` його додають до стандартного повідомлення.
- `assertRaises`, `assertWarns`, `assertLogs` і `assertNoLogs` (а також варіанти `...Regex`) перевіряють винятки, попередження та журналювання, зазвичай як менеджери контексту.
- `assertEqual()` автоматично використовує спеціалізовані методи для `str`, `list`, `tuple`, `dict` і `set`.
- Python 3.14 додав `assertHasAttr`, `assertIsSubclass`, `assertStartsWith`, `assertEndsWith` та їхні заперечення. Старі псевдоніми на кшталт `assertEquals` вилучено в 3.12.

## Практика

### Вправа 1: Оберіть метод

Для кожної перевірки назвіть найконкретніший метод-твердження, а потім напишіть один тест, що виконує всі шість перевірок для таких значень: `result = {}.get("missing")`, `user = {"name": "olena", "email": "olena@example.com"}`, `items = [2, 3, 1]`, `elapsed = 0.12`, `version = "3.14.0"`, `data = [1, 2]`.

1. `result` дорівнює `None`.
2. У `user` є ключ `"email"`.
3. `items` містить ті самі елементи, що й `[3, 1, 2]`, у будь-якому порядку.
4. `elapsed` менше за `0.5`.
5. `version` має вигляд `число.число.число`.
6. `data` є `dict` або `list`.

### Вправа 2: Від розмитого до конкретного

Ці тести не проходять, але кожна невдача повідомляє лише `False is not true`. Перепишіть їх із конкретними методами-твердженнями й порівняйте нові повідомлення.

```python
import unittest


class TestVague(unittest.TestCase):
    def setUp(self):
        self.order = {"id": 7, "total": 90, "tags": ["new", "gift"]}

    def test_total(self):
        self.assertTrue(self.order["total"] == 100)

    def test_tag(self):
        self.assertTrue("urgent" in self.order["tags"])

    def test_big_order(self):
        self.assertTrue(self.order["total"] > 100)
```

### Вправа 3: Протестуйте журналювання

Файл `bank.py` містить:

```python
import logging

logger = logging.getLogger("bank")


def withdraw(balance, amount):
    if amount > balance:
        logger.warning("insufficient funds: balance=%s, amount=%s", balance, amount)
        return balance
    return balance - amount
```

Напишіть два тести: перший перевіряє, що `withdraw(50, 80)` повертає `50` і записує в журнал `"bank"` рівно одне попередження з очікуваним текстом; другий — що `withdraw(100, 30)` повертає `70` і не записує жодних попереджень.

## Розв'язки

### Вправа 1

1. `assertIsNone`, 2. `assertIn`, 3. `assertCountEqual`, 4. `assertLess`, 5. `assertRegex`, 6. `assertIsInstance` з кортежем типів.

```python
import unittest


class TestChoose(unittest.TestCase):
    def test_checks(self):
        result = {}.get("missing")
        user = {"name": "olena", "email": "olena@example.com"}
        items = [2, 3, 1]
        elapsed = 0.12
        version = "3.14.0"
        data = [1, 2]

        self.assertIsNone(result)
        self.assertIn("email", user)
        self.assertCountEqual(items, [3, 1, 2])
        self.assertLess(elapsed, 0.5)
        self.assertRegex(version, r"^\d+\.\d+\.\d+$")
        self.assertIsInstance(data, (dict, list))
```

Результат `python3 -m unittest -v`:

```text
test_checks (test_choose.TestChoose.test_checks) ... ok

----------------------------------------------------------------------
Ran 1 test in 0.000s

OK
```

`assertIn("email", user)` перевіряє **ключі** словника — так само, як оператор `in`. Якорі `^` і `$` у регулярному виразі гарантують, що потрібний вигляд має весь рядок, а не лише його частина.

### Вправа 2

```python
import unittest


class TestSpecific(unittest.TestCase):
    def setUp(self):
        self.order = {"id": 7, "total": 90, "tags": ["new", "gift"]}

    def test_total(self):
        self.assertEqual(self.order["total"], 100)

    def test_tag(self):
        self.assertIn("urgent", self.order["tags"])

    def test_big_order(self):
        self.assertGreater(self.order["total"], 100)
```

Рядки `AssertionError` з виводу `python3 -m unittest test_specific` (в алфавітному порядку тестів):

```text
AssertionError: 90 not greater than 100
AssertionError: 'urgent' not found in ['new', 'gift']
AssertionError: 90 != 100
```

Тепер кожне повідомлення показує фактичне значення, тож помилку часто видно без налагоджувача.

### Вправа 3

```python
import unittest

from bank import withdraw


class TestWithdrawLogging(unittest.TestCase):
    def test_warns_when_balance_too_low(self):
        with self.assertLogs("bank", level="WARNING") as cm:
            new_balance = withdraw(50, 80)
        self.assertEqual(new_balance, 50)
        self.assertEqual(
            cm.output,
            ["WARNING:bank:insufficient funds: balance=50, amount=80"],
        )

    def test_no_warning_for_normal_withdrawal(self):
        with self.assertNoLogs("bank", level="WARNING"):
            new_balance = withdraw(100, 30)
        self.assertEqual(new_balance, 70)
```

Результат `python3 -m unittest test_bank -v`:

```text
test_no_warning_for_normal_withdrawal (test_bank.TestWithdrawLogging.test_no_warning_for_normal_withdrawal) ... ok
test_warns_when_balance_too_low (test_bank.TestWithdrawLogging.test_warns_when_balance_too_low) ... ok

----------------------------------------------------------------------
Ran 2 tests in 0.000s

OK
```

Порівняння всього списку `cm.output` перевіряє і текст, і те, що в журнал записано рівно одне повідомлення.

---

*Джерело: [pythontutorial.net — Python unittest Assert Methods](https://www.pythontutorial.net/python-unit-testing/python-unittest-assert/). Адаптовано й доповнено для PyJourney.*
