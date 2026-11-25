# assertTrue()

`assertTrue()` і `assertFalse()` — найзагальніші методи-твердження: вони приймають будь-який вираз і перевіряють, істинний він чи хибний. Ця універсальність водночас і їхня сила, і їхня слабкість. Вони чудово підходять для предикатів на кшталт `is_valid()` чи `str.isdigit()`, але з ними також легко написати тест, який неможливо провалити.

## Що ви дізнаєтесь

- Що насправді перевіряють `assertTrue(expr, msg=None)` і `assertFalse(expr, msg=None)`
- Чому «істинне» (truthy) — не те саме, що «є `True`»
- Як виглядають їхні повідомлення про невдачу і чому `msg` тут такий важливий
- Коли їх використовувати, а коли кращий конкретніший метод
- Чотири способи написати тест з `assertTrue()`, який завжди проходить, і як виправити кожен

## Як працює `assertTrue()`

```python
assertTrue(expr, msg=None)
```

Тест проходить, коли `expr` **істинний**, тобто коли `bool(expr)` дорівнює `True`. Метод **не** перевіряє `expr is True`. Усі ці виклики проходять:

- `assertTrue(True)`
- `assertTrue(1)`, `assertTrue(0.0001)`
- `assertTrue([0])`, `assertTrue(" ")`, `assertTrue("False")`, бо непорожній список чи рядок істинний, хоч би що в ньому було

Якщо результат має бути саме `True` (наприклад, бо функція мусить повертати `bool`), використовуйте `assertIs(result, True)`.

Ось тест, який перевіряє метод рядка:

```python
import unittest


class TestBool(unittest.TestCase):
    def test_is_digit(self):
        text = "123"
        self.assertTrue(text.isdigit())
```

`str.isdigit()` повертає `True`, коли рядок непорожній і всі його символи — цифри, тож тест проходить.

## `assertFalse()`

```python
assertFalse(expr, msg=None)
```

Протилежна перевірка: тест проходить, коли `expr` **хибний**, тобто це `False`, `None`, `0`, `0.0`, порожній рядок чи порожній контейнер або об'єкт, у якого `__bool__()` повертає `False` (чи `__len__()` повертає `0`).

Тестовий клас отримує ще два тести:

```python
import unittest


class TestBool(unittest.TestCase):
    def test_is_digit(self):
        text = "123"
        self.assertTrue(text.isdigit())

    def test_empty_string_is_digit(self):
        text = ""
        self.assertFalse(text.isdigit())

    def test_alpha_is_digit(self):
        text = "a00"
        self.assertFalse(text.isdigit())
```

Результат `python3 -m unittest -v` (файл називається `test_bool.py`):

```text
test_alpha_is_digit (test_bool.TestBool.test_alpha_is_digit) ... ok
test_empty_string_is_digit (test_bool.TestBool.test_empty_string_is_digit) ... ok
test_is_digit (test_bool.TestBool.test_is_digit) ... ok

----------------------------------------------------------------------
Ran 3 tests in 0.000s

OK
```

Порожній рядок — корисний граничний випадок: `"".isdigit()` дорівнює `False`, бо в ньому немає жодної цифри.

## Повідомлення про невдачу та `msg`

У разі невдачі повідомлення складається з `repr(expr)` і слів `is not true` або `is not false`:

```python
import unittest


class TestMessages(unittest.TestCase):
    def test_predicate(self):
        text = "12a"
        self.assertTrue(text.isdigit())

    def test_predicate_with_msg(self):
        text = "12a"
        self.assertTrue(text.isdigit(), f"{text!r} should contain only digits")

    def test_value(self):
        items = []
        self.assertTrue(items)

    def test_false(self):
        flag = "0"
        self.assertFalse(flag)
```

Рядки `AssertionError` з виводу `python3 -m unittest test_messages` (в алфавітному порядку тестів):

```text
AssertionError: '0' is not false
AssertionError: False is not true
AssertionError: False is not true : '12a' should contain only digits
AssertionError: [] is not true
```

- Коли ви передаєте **значення** (`items`, `flag`), повідомлення його показує. Зверніть увагу на несподіванку в першому рядку: рядок `"0"` істинний, бо він непорожній.
- Коли ви передаєте **результат виклику чи порівняння**, `assertTrue()` отримує лише `False`. Вхідні дані (`"12a"`) втрачено, тож повідомлення `False is not true` нічого корисного не каже.

Саме тому для `assertTrue()` аргумент `msg` важливіший, ніж для будь-якого іншого методу. З ним невдача пояснює себе сама: `'12a' should contain only digits`.

## Коли використовувати `assertTrue()`, а коли ні

`assertTrue()` і `assertFalse()` — правильний вибір, коли код, який ви тестуєте, є **предикатом**, тобто функцією, вся робота якої — відповісти «так» чи «ні»: `is_valid_email()`, `user.is_active()`, `path.exists()`, `str.isdigit()`. Порівнювати тут нема з чим.

Коли перевірка насправді є порівнянням, конкретний метод у разі невдачі покаже обидва значення:

| Замість | Використовуйте | Повідомлення про невдачу |
|---|---|---|
| `assertTrue(a == b)` | `assertEqual(a, b)` | `2 != 3` |
| `assertTrue(a > b)` | `assertGreater(a, b)` | `2 not greater than 3` |
| `assertTrue(x in items)` | `assertIn(x, items)` | `'kiwi' not found in ['apple']` |
| `assertTrue(x is None)` | `assertIsNone(x)` | `'Hello' is not None` |
| `assertTrue(isinstance(x, int))` | `assertIsInstance(x, int)` | `'42' is not an instance of <class 'int'>` |
| `assertTrue(result is True)` | `assertIs(result, True)` | `'False' is not True` |

Решту наведено в темі Методи-твердження.

## Тести, які завжди проходять

Тест, який не може провалитися, гірший за відсутність тесту: він дає хибну впевненість. З `assertTrue()` написати такий тест напрочуд легко. Кожен тест нижче перевіряє щось очевидно хибне, і все одно всі вони проходять:

```python
import unittest


def add(a, b):
    return a + b


class TestAlwaysPass(unittest.TestCase):
    def test_missing_parentheses(self):
        text = "abc"
        self.assertTrue(text.isdigit)

    def test_generator(self):
        numbers = [-1, -2, -3]
        self.assertTrue(n > 0 for n in numbers)

    def test_second_argument(self):
        self.assertTrue(add(2, 2), 5)

    def test_string_false(self):
        setting = "False"
        self.assertTrue(setting)
```

Результат `python3 -m unittest test_always_pass -v`:

```text
test_generator (test_always_pass.TestAlwaysPass.test_generator) ... ok
test_missing_parentheses (test_always_pass.TestAlwaysPass.test_missing_parentheses) ... ok
test_second_argument (test_always_pass.TestAlwaysPass.test_second_argument) ... ok
test_string_false (test_always_pass.TestAlwaysPass.test_string_false) ... ok

----------------------------------------------------------------------
Ran 4 tests in 0.000s

OK
```

Що пішло не так:

- **`text.isdigit` без дужок** — це сам об'єкт методу, а будь-яка функція чи метод істинні. Метод так і не викликається.
- **`n > 0 for n in numbers`** створює об'єкт-генератор, а він завжди істинний, навіть якщо видавав би лише `False`. Порівняння так і не виконуються. Використовуйте `all(...)` або `any(...)`.
- **`assertTrue(add(2, 2), 5)`**: другий аргумент `assertTrue()` — це `msg`, а не очікуване значення. `4` істинне, тож тест проходить, а `5` лише вивелося б як повідомлення. Для порівнянь використовуйте `assertEqual()`.
- **`"False"`** — непорожній рядок, тож він істинний. Значення з конфігураційних файлів, змінних середовища чи форм часто бувають саме такими рядками.

Виправлені версії:

```python
import unittest


def add(a, b):
    return a + b


class TestFixed(unittest.TestCase):
    def test_missing_parentheses(self):
        text = "abc"
        self.assertTrue(text.isdigit())

    def test_generator(self):
        numbers = [-1, -2, -3]
        self.assertTrue(all(n > 0 for n in numbers))

    def test_second_argument(self):
        self.assertEqual(add(2, 2), 5)

    def test_string_false(self):
        setting = "False"
        self.assertIs(setting, True)
```

Тепер усі чотири не проходять, як і має бути. Рядки `AssertionError` з виводу `python3 -m unittest test_fixed`:

```text
AssertionError: False is not true
AssertionError: False is not true
AssertionError: 4 != 5
AssertionError: 'False' is not True
```

> **Порада:** `assertTrue(all(...))` працює, але в разі невдачі не каже, *який* елемент її спричинив. Цикл із `subTest()` і конкретним твердженням, як-от `assertGreater(n, 0)`, повідомляє про кожен невдалий елемент окремо (див. тему Фреймворк unittest).

> **Порада:** написавши новий тест, один раз навмисно зробіть так, щоб він не пройшов (наприклад, змініть очікуване значення), і переконайтеся, що він узагалі здатен провалитися.

## Типові помилки

- **Використовувати `assertTrue()` для порівнянь.** `assertTrue(a == b)` повідомляє лише `False is not true`. Використовуйте `assertEqual()`, `assertIn()`, `assertGreater()` та подібні методи.
- **Передавати очікуване значення другим аргументом.** `assertTrue(result, 5)` вважає `5` повідомленням і нічого не порівнює.
- **Забути викликати метод.** `assertTrue(user.is_active)` перевіряє об'єкт методу, який завжди істинний. Пишіть `user.is_active()`.
- **Передавати вираз-генератор.** `assertTrue(x > 0 for x in values)` проходить завжди. Загорніть його в `all()` або `any()`.
- **Очікувати, що `assertTrue()` перевіряє саме `True`.** Він перевіряє істинність. Для точного `True` чи `False` використовуйте `assertIs(result, True)` / `assertIs(result, False)`.
- **Не додавати `msg`, коли перевіряєте предикат.** `False is not true` нічого вам не скаже. Вкажіть, які вхідні дані перевірялися.

## Підсумок

- `assertTrue(expr, msg=None)` проходить, коли `bool(expr)` дорівнює `True`, а `assertFalse(expr, msg=None)` — коли `False`.
- Істинне — не те саме, що `True`: `1`, `[0]` і `"False"` проходять `assertTrue()`. Для точної перевірки використовуйте `assertIs(x, True)`.
- Повідомлення про невдачу мають вигляд `<repr> is not true` / `<repr> is not false`. Для предиката це просто `False is not true`, тож завжди додавайте `msg`.
- Використовуйте ці методи для предикатів. Для порівнянь, належності, `None` і типів конкретніші методи дають значно кращі повідомлення.
- Стережіться тестів, які проходять завжди: пропущені `()`, вираз-генератор, очікуване значення, передане як `msg`, непорожній рядок.

## Практика

### Вправа 1: Протестуйте предикат

Файл `text_utils.py` містить:

```python
def is_palindrome(text):
    letters = [char.lower() for char in text if char.isalnum()]
    return letters == letters[::-1]
```

Напишіть два тести з циклами `subTest()`: перший перевіряє, що `"level"`, `"Racecar"`, `"A man, a plan, a canal: Panama"` і `""` — паліндроми, другий — що `"python"`, `"ab"` і `"level up"` ними не є. Кожне твердження має містити `msg` із вхідним рядком.

### Вправа 2: Знайдіть зламані тести

Файл `parity.py` містить:

```python
def is_even(n):
    return n % 2 == 0
```

Не запускаючи тести, передбачте, які з них пройдуть, а які ні, і поясніть, чому жоден не перевіряє того, що обіцяє. Потім перепишіть їх. Зверніть увагу, що список `[2, 4, 7]` навмисно містить хибне значення: переписаний `test_all_even` має на нього вказати.

```python
import unittest

from parity import is_even


class TestIsEven(unittest.TestCase):
    def test_all_even(self):
        self.assertTrue(is_even(n) for n in [2, 4, 7])

    def test_four_is_even(self):
        self.assertTrue(is_even, 4)

    def test_three_is_odd(self):
        self.assertTrue(is_even(3), False)
```

### Вправа 3: Справжній `bool`, будь ласка

Файл `permissions.py` містить:

```python
def can_edit(user):
    return user.get("is_admin") or user.get("roles")
```

Функція має повертати саме `True` або `False` (результат надсилається у фронтенд як JSON), а редагувати можуть лише адміністратори й користувачі з роллю `"editor"`. Напишіть тести для чотирьох користувачів: `{"is_admin": True}`, `{"roles": ["editor"]}`, `{"roles": ["viewer"]}` і `{}`. Оберіть твердження, які помітять результат, що не є `bool`. Поясніть, які помилки пропустили б тести на основі `assertTrue()` / `assertFalse()`, а потім виправте функцію.

## Розв'язки

### Вправа 1

```python
import unittest

from text_utils import is_palindrome


class TestIsPalindrome(unittest.TestCase):
    def test_palindromes(self):
        for text in ["level", "Racecar", "A man, a plan, a canal: Panama", ""]:
            with self.subTest(text=text):
                self.assertTrue(is_palindrome(text), f"{text!r} is a palindrome")

    def test_not_palindromes(self):
        for text in ["python", "ab", "level up"]:
            with self.subTest(text=text):
                self.assertFalse(is_palindrome(text), f"{text!r} is not a palindrome")
```

Результат `python3 -m unittest test_text_utils -v`:

```text
test_not_palindromes (test_text_utils.TestIsPalindrome.test_not_palindromes) ... ok
test_palindromes (test_text_utils.TestIsPalindrome.test_palindromes) ... ok

----------------------------------------------------------------------
Ran 2 tests in 0.000s

OK
```

Порожній рядок тут вважається паліндромом (порожній список дорівнює своєму оберненому). Чи бажана така поведінка — питання дизайну, і тест її документує.

### Вправа 2

Прогноз: `test_all_even` і `test_four_is_even` проходять, `test_three_is_odd` — ні. Результат `python3 -m unittest test_parity -v` (шляхи скорочено):

```text
test_all_even (test_parity.TestIsEven.test_all_even) ... ok
test_four_is_even (test_parity.TestIsEven.test_four_is_even) ... ok
test_three_is_odd (test_parity.TestIsEven.test_three_is_odd) ... FAIL

======================================================================
FAIL: test_three_is_odd (test_parity.TestIsEven.test_three_is_odd)
----------------------------------------------------------------------
Traceback (most recent call last):
  File ".../test_parity.py", line 14, in test_three_is_odd
    self.assertTrue(is_even(3), False)
    ~~~~~~~~~~~~~~~^^^^^^^^^^^^^^^^^^^
AssertionError: False is not true : False

----------------------------------------------------------------------
Ran 3 tests in 0.000s

FAILED (failures=1)
```

- `test_all_even` передає об'єкт-генератор, а він завжди істинний. `is_even()` навіть не викликається.
- `test_four_is_even` передає саму функцію `is_even` (істинну) і `4` як повідомлення. `is_even(4)` не викликається.
- `test_three_is_odd` задумувався як «`is_even(3)` дорівнює `False`», але другий аргумент — це повідомлення. `is_even(3)` дорівнює `False`, тож тест не проходить, а `: False` у повідомленні — це просто виведений `msg`. Код правильний, неправильний тест.

Переписані тести:

```python
import unittest

from parity import is_even


class TestIsEven(unittest.TestCase):
    def test_all_even(self):
        for n in [2, 4, 7]:
            with self.subTest(n=n):
                self.assertTrue(is_even(n), f"{n} should be even")

    def test_four_is_even(self):
        self.assertTrue(is_even(4))

    def test_three_is_odd(self):
        self.assertFalse(is_even(3))
```

Результат `python3 -m unittest test_parity_fixed -v` (шляхи скорочено):

```text
test_all_even (test_parity_fixed.TestIsEven.test_all_even) ...
  test_all_even (test_parity_fixed.TestIsEven.test_all_even) (n=7) ... FAIL
test_four_is_even (test_parity_fixed.TestIsEven.test_four_is_even) ... ok
test_three_is_odd (test_parity_fixed.TestIsEven.test_three_is_odd) ... ok

======================================================================
FAIL: test_all_even (test_parity_fixed.TestIsEven.test_all_even) (n=7)
----------------------------------------------------------------------
Traceback (most recent call last):
  File ".../test_parity_fixed.py", line 10, in test_all_even
    self.assertTrue(is_even(n), f"{n} should be even")
    ~~~~~~~~~~~~~~~^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
AssertionError: False is not true : 7 should be even

----------------------------------------------------------------------
Ran 3 tests in 0.000s

FAILED (failures=1)
```

Тепер тест справді викликає `is_even()` для кожного числа і прямо вказує на хибне значення. Приберіть `7` зі списку (або перенесіть у тест для непарних чисел), і все пройде.

### Вправа 3

```python
import unittest

from permissions import can_edit


class TestCanEdit(unittest.TestCase):
    def test_admin(self):
        self.assertIs(can_edit({"is_admin": True}), True)

    def test_editor(self):
        self.assertIs(can_edit({"roles": ["editor"]}), True)

    def test_viewer(self):
        self.assertIs(can_edit({"roles": ["viewer"]}), False)

    def test_no_roles(self):
        self.assertIs(can_edit({}), False)
```

З початковою функцією `python3 -m unittest test_permissions -v` повідомляє про три невдачі. Рядки тестів і рядки `AssertionError`:

```text
test_admin (test_permissions.TestCanEdit.test_admin) ... ok
test_editor (test_permissions.TestCanEdit.test_editor) ... FAIL
test_no_roles (test_permissions.TestCanEdit.test_no_roles) ... FAIL
test_viewer (test_permissions.TestCanEdit.test_viewer) ... FAIL

AssertionError: ['editor'] is not True
AssertionError: None is not False
AssertionError: ['viewer'] is not False
```

Тести з `assertTrue()` / `assertFalse()` помітили б лише помилку з глядачем (`['viewer'] is not false`). Вони прийняли б `['editor']` як «істину», а `None` як «хибність», тож неправильні типи результату непомітно потрапили б у фронтенд.

Виправлена функція:

```python
def can_edit(user):
    return bool(user.get("is_admin")) or "editor" in user.get("roles", [])
```

Результат тієї самої команди після виправлення:

```text
test_admin (test_permissions.TestCanEdit.test_admin) ... ok
test_editor (test_permissions.TestCanEdit.test_editor) ... ok
test_no_roles (test_permissions.TestCanEdit.test_no_roles) ... ok
test_viewer (test_permissions.TestCanEdit.test_viewer) ... ok

----------------------------------------------------------------------
Ran 4 tests in 0.000s

OK
```

Тепер обидва операнди `or` — справжні булеві значення, тож результат завжди `True` або `False`.

---

*Джерело: [pythontutorial.net — Python assertTrue()](https://www.pythontutorial.net/python-unit-testing/python-asserttrue/). Адаптовано й доповнено для PyJourney.*
