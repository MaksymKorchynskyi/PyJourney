# Параметризовані тести

Багато тестів перевіряють одну й ту саму поведінку на різних вхідних даних: ціну з податком і без, правильний і неправильний номер порту, високосний і звичайний рік. **Параметризований тест** (parameterized test, або тест, керований даними, data-driven test) виконує одне тіло тесту для цілої таблиці випадків. У `unittest` немає окремого декоратора для цього, але менеджер контексту `subTest()` дає головне: кожен випадок звітує окремо, і один невдалий випадок не приховує решту.

## Що ви дізнаєтесь

- Що таке параметризований тест і коли він кращий за окремий метод на кожен випадок
- Чому звичайного циклу `for` усередині тесту недостатньо
- Як `self.subTest()` ізолює випадки й показує кожну невдачу з її позначкою
- Як позначати підтести повідомленням і іменованими параметрами, зокрема вкладені підтести
- Як підтести взаємодіють із помилками, `skipTest()`, `setUp()`, `--failfast` і лічильником тестів
- Що пропонує `pytest.mark.parametrize` як альтернатива

## Функція, яку тестуємо

`pricing.py` обчислює ціну до сплати: віднімає знижку, додає податок і округлює до копійок.

```python
def calculate(price, tax=0, discount=0):
    return round((price - discount) * (1 + tax), 2)
```

Кілька викликів, щоб знати, чого очікувати:

```python
from pricing import calculate

print(calculate(10))
print(calculate(10, tax=0.1))
print(calculate(10, discount=1))
print(calculate(10, tax=0.1, discount=1))
```

Результат:

```text
10
11.0
9
9.9
```

`tax` — це частка (`0.1` означає 10%). Зверніть увагу: результат іноді `int`, а іноді `float`. Для `assertEqual()` це не проблема, бо `11.0 == 11` дає `True`.

Щоб як слід перевірити `calculate()`, потрібно щонайменше чотири випадки:

| Випадок | price | tax | discount | очікується |
|---|---|---|---|---|
| Без податку, без знижки | 10 | 0 | 0 | 10 |
| З податком, без знижки | 10 | 0.1 | 0 | 11 |
| Без податку, зі знижкою | 10 | 0 | 1 | 9 |
| З податком і знижкою | 10 | 0.1 | 1 | 9.9 |

## Варіант 1: окремий метод на кожен випадок

Найпряміший спосіб — окремий метод для кожного рядка таблиці:

```python
import unittest

from pricing import calculate


class TestPricing(unittest.TestCase):
    def test_no_tax_no_discount(self):
        self.assertEqual(calculate(10), 10)

    def test_tax_no_discount(self):
        self.assertEqual(calculate(10, tax=0.1), 11)

    def test_no_tax_with_discount(self):
        self.assertEqual(calculate(10, discount=1), 9)

    def test_tax_and_discount(self):
        self.assertEqual(calculate(10, tax=0.1, discount=1), 9.9)
```

Результат `python -m unittest test_pricing_methods -v` (час відрізняється):

```text
test_no_tax_no_discount (test_pricing_methods.TestPricing.test_no_tax_no_discount) ... ok
test_no_tax_with_discount (test_pricing_methods.TestPricing.test_no_tax_with_discount) ... ok
test_tax_and_discount (test_pricing_methods.TestPricing.test_tax_and_discount) ... ok
test_tax_no_discount (test_pricing_methods.TestPricing.test_tax_no_discount) ... ok

----------------------------------------------------------------------
Ran 4 tests in 0.000s

OK
```

Це цілком коректний підхід, і для кількох випадків із різним змістом він часто найзрозуміліший. Ціна стає помітною, коли рядків 10 або 50: методи відрізняються лише даними, і щоб додати випадок, доводиться копіювати метод. Таблиця даних і одне тіло тесту масштабуються значно краще.

## Варіант 2: звичайний цикл (і чому його замало)

Покладіть випадки в структуру даних і пройдіть їх циклом в одному тесті. Щоб побачити, як звітують невдачі, припустімо, що два рядки таблиці заповнили неуважно: `Has tax, no discount` очікує `10` замість `11`, а `No tax, has discount` очікує `10` замість `9`.

```python
import unittest

from pricing import calculate


class TestPricing(unittest.TestCase):
    def test_calculate(self):
        items = (
            {'case': 'No tax, no discount', 'price': 10, 'tax': 0, 'discount': 0, 'net_price': 10},
            {'case': 'Has tax, no discount', 'price': 10, 'tax': 0.1, 'discount': 0, 'net_price': 10},
            {'case': 'No tax, has discount', 'price': 10, 'tax': 0, 'discount': 1, 'net_price': 10},
            {'case': 'Has tax, has discount', 'price': 10, 'tax': 0.1, 'discount': 1, 'net_price': 9.9},
        )

        for item in items:
            net_price = calculate(item['price'], item['tax'], item['discount'])
            self.assertEqual(net_price, item['net_price'])
```

Запустіть тест:

```bash
python -m unittest test_pricing -v
```

Результат (шлях скорочено, час відрізняється):

```text
test_calculate (test_pricing.TestPricing.test_calculate) ... FAIL

======================================================================
FAIL: test_calculate (test_pricing.TestPricing.test_calculate)
----------------------------------------------------------------------
Traceback (most recent call last):
  File ".../test_pricing.py", line 17, in test_calculate
    self.assertEqual(net_price, item['net_price'])
    ~~~~~~~~~~~~~~~~^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
AssertionError: 11.0 != 10

----------------------------------------------------------------------
Ran 1 test in 0.000s

FAILED (failures=1)
```

Видно дві проблеми:

1. **Тест зупиняється на першій невдачі.** Хибне твердження генерує `AssertionError`, і це завершує весь метод. Третій випадок теж неправильний, але він так і не виконався, тож ви дізнаєтеся про нього лише після того, як виправите другий.
2. **Звіт не каже, який випадок зламався.** Ви бачите лише `11.0 != 10`. Маючи 50 рядків, довелося б угадувати або додавати `print`.

## Варіант 3: `subTest()`

Обгорніть тіло циклу в `with self.subTest(...)`. Усе інше лишається без змін:

```python
import unittest

from pricing import calculate


class TestPricing(unittest.TestCase):
    def test_calculate(self):
        items = (
            {'case': 'No tax, no discount', 'price': 10, 'tax': 0, 'discount': 0, 'net_price': 10},
            {'case': 'Has tax, no discount', 'price': 10, 'tax': 0.1, 'discount': 0, 'net_price': 10},
            {'case': 'No tax, has discount', 'price': 10, 'tax': 0, 'discount': 1, 'net_price': 10},
            {'case': 'Has tax, has discount', 'price': 10, 'tax': 0.1, 'discount': 1, 'net_price': 9.9},
        )

        for item in items:
            with self.subTest(item['case']):
                net_price = calculate(item['price'], item['tax'], item['discount'])
                self.assertEqual(net_price, item['net_price'])
```

Результат `python -m unittest test_pricing -v` (Python 3.14, шлях скорочено, час відрізняється):

```text
test_calculate (test_pricing.TestPricing.test_calculate) ...
  test_calculate (test_pricing.TestPricing.test_calculate) [Has tax, no discount] ... FAIL
  test_calculate (test_pricing.TestPricing.test_calculate) [No tax, has discount] ... FAIL

======================================================================
FAIL: test_calculate (test_pricing.TestPricing.test_calculate) [Has tax, no discount]
----------------------------------------------------------------------
Traceback (most recent call last):
  File ".../test_pricing.py", line 18, in test_calculate
    self.assertEqual(net_price, item['net_price'])
    ~~~~~~~~~~~~~~~~^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
AssertionError: 11.0 != 10

======================================================================
FAIL: test_calculate (test_pricing.TestPricing.test_calculate) [No tax, has discount]
----------------------------------------------------------------------
Traceback (most recent call last):
  File ".../test_pricing.py", line 18, in test_calculate
    self.assertEqual(net_price, item['net_price'])
    ~~~~~~~~~~~~~~~~^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
AssertionError: 9 != 10

----------------------------------------------------------------------
Ran 1 test in 0.001s

FAILED (failures=2)
```

Обидві проблеми розв'язано:

- **Виконуються всі випадки.** Коли твердження всередині блоку `with` не справджується, `subTest()` записує невдачу й «поглинає» виняток. Виконання продовжується після блоку, тож цикл переходить до наступного випадку.
- **Кожна невдача підписана.** Текст у квадратних дужках — це повідомлення, передане в `subTest()`, тож одразу видно, які рядки неправильні.

Зверніть увагу й на лічильники: `Ran 1 test`, але `failures=2`. У рядку «Ran» unittest рахує **тестові методи**, а невдачі рахує **для кожного підтесту окремо**. Без `-v` рядок прогресу показує по одній літері на кожен невдалий підтест, тут `FF`. Успішні підтести окремо не виводяться: якщо всі вони пройшли, тест показує одне `ok`.

Після виправлення двох очікуваних значень (`11` і `9`) той самий тест проходить:

```text
test_calculate (test_pricing.TestPricing.test_calculate) ... ok

----------------------------------------------------------------------
Ran 1 test in 0.000s

OK
```

### Як це працює

`subTest()` — це метод `TestCase`, який повертає менеджер контексту:

```text
self.subTest(msg=..., **params)
```

Обидва аргументи необов'язкові. Поки виконується блок, менеджер контексту пам'ятає позначку. Якщо блок генерує виняток, він потрапляє у звіт як невдача (для `AssertionError`) або помилка (для будь-якого іншого винятку) **саме цього підтесту**, а тестовий метод продовжує роботу після інструкції `with`. Коли метод завершується, тест загалом вважається невдалим, якщо не пройшов хоча б один його підтест.

## Позначки підтестів

### Іменовані параметри

Замість довільного повідомлення можна передати дані випадку як іменовані аргументи. У звіті вони з'являються в круглих дужках. Список кортежів часто легший за список словників:

```python
import unittest

from pricing import calculate


class TestPricing(unittest.TestCase):
    def test_calculate(self):
        cases = [
            # ціна, податок, знижка, очікуваний результат
            (10, 0, 0, 10),
            (10, 0.1, 0, 10),
            (10, 0, 1, 9),
            (10, 0.1, 1, 9.9),
        ]
        for price, tax, discount, expected in cases:
            with self.subTest(price=price, tax=tax, discount=discount):
                self.assertEqual(calculate(price, tax, discount), expected)
```

Другий рядок знову навмисно неправильний. Результат `python -m unittest test_pricing` (шлях скорочено, час відрізняється):

```text
F
======================================================================
FAIL: test_calculate (test_pricing.TestPricing.test_calculate) (price=10, tax=0.1, discount=0)
----------------------------------------------------------------------
Traceback (most recent call last):
  File ".../test_pricing.py", line 17, in test_calculate
    self.assertEqual(calculate(price, tax, discount), expected)
    ~~~~~~~~~~~~~~~~^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
AssertionError: 11.0 != 10

----------------------------------------------------------------------
Ran 1 test in 0.000s

FAILED (failures=1)
```

Позначка містить точні вхідні дані, тож випадок можна одразу відтворити в REPL: `calculate(10, 0.1, 0)`.

### Повідомлення разом із параметрами, вкладеність, відсутність позначки

Обидві форми можна поєднувати, а підтести — вкладати один в одний. Позначки при цьому об'єднуються:

| Виклик | Позначка у звіті |
|---|---|
| `self.subTest("Has tax")` | `[Has tax]` |
| `self.subTest(n=3)` | `(n=3)` |
| `self.subTest("checking parity", n=3)` | `[checking parity] (n=3)` |
| `self.subTest(value=20)` усередині `self.subTest(low=0, high=10)` | `(value=20, low=0, high=10)` |
| `self.subTest()` | `(<subtest>)` |

Вкладеність зручна для «сітки» випадків: зовнішній цикл перебирає конфігурації, внутрішній — вхідні дані (див. вправу 4). Підтест без позначки дозволений, але майже марний: коли невдач кілька, `(<subtest>)` не каже, який саме випадок зламався.

## Як поводяться підтести

Наступний тестовий модуль поєднує ситуації, які трапляються на практиці: невдалі підтести, неочікуваний виняток і пропущений підтест.

```python
import unittest


class TestBehaviour(unittest.TestCase):
    def test_even(self):
        for n in [2, 3, 4, 5]:
            with self.subTest("checking parity", n=n):
                self.assertEqual(n % 2, 0)

    def test_parse(self):
        for value in ["10", "x", None]:
            with self.subTest(value=value):
                if value is None:
                    self.skipTest("no value")
                self.assertGreater(int(value), 0)
```

Результат `python -m unittest test_behaviour -v` (шлях скорочено, час відрізняється):

```text
test_even (test_behaviour.TestBehaviour.test_even) ...
  test_even (test_behaviour.TestBehaviour.test_even) [checking parity] (n=3) ... FAIL
  test_even (test_behaviour.TestBehaviour.test_even) [checking parity] (n=5) ... FAIL
test_parse (test_behaviour.TestBehaviour.test_parse) ...
  test_parse (test_behaviour.TestBehaviour.test_parse) (value='x') ... ERROR
  test_parse (test_behaviour.TestBehaviour.test_parse) (value=None) ... skipped 'no value'

======================================================================
ERROR: test_parse (test_behaviour.TestBehaviour.test_parse) (value='x')
----------------------------------------------------------------------
Traceback (most recent call last):
  File ".../test_behaviour.py", line 15, in test_parse
    self.assertGreater(int(value), 0)
                       ~~~^^^^^^^
ValueError: invalid literal for int() with base 10: 'x'

======================================================================
FAIL: test_even (test_behaviour.TestBehaviour.test_even) [checking parity] (n=3)
----------------------------------------------------------------------
Traceback (most recent call last):
  File ".../test_behaviour.py", line 8, in test_even
    self.assertEqual(n % 2, 0)
    ~~~~~~~~~~~~~~~~^^^^^^^^^^
AssertionError: 1 != 0

======================================================================
FAIL: test_even (test_behaviour.TestBehaviour.test_even) [checking parity] (n=5)
----------------------------------------------------------------------
Traceback (most recent call last):
  File ".../test_behaviour.py", line 8, in test_even
    self.assertEqual(n % 2, 0)
    ~~~~~~~~~~~~~~~~^^^^^^^^^^
AssertionError: 1 != 0

----------------------------------------------------------------------
Ran 2 tests in 0.002s

FAILED (failures=2, errors=1, skipped=1)
```

Що тут видно:

- **Ізольовані і невдачі, і помилки.** `ValueError` від `int("x")` потрапляє у звіт як `ERROR` підтесту `(value='x')`, а цикл усе одно доходить до `None`.
- **`skipTest()` усередині підтесту пропускає лише цей підтест**, як описано в темі «Пропуск тестів».
- **Успішні підтести мовчать.** `n=2`, `n=4` і `value='10'` пройшли, і їх у звіті немає.

Ще кілька правил, які варто знати:

- **`setUp()` і `tearDown()` виконуються один раз на тестовий метод, а не на кожен підтест.** Усі підтести методу ділять одне тестове оточення (fixture), тож підтест, який змінює `self.something`, впливає на наступний. Цю пастку показує вправа 3.
- **`--failfast` (`-f`) зупиняє запуск на першому невдалому підтесті.** Із `python -m unittest -f test_behaviour` у звіті буде лише невдача `n=3`, `n=5` не перевіряється, а `test_parse` не запускається взагалі (`Ran 1 test`).
- **Захищений лише код усередині блоку `with`.** Твердження в циклі, але поза `subTest()`, у разі невдачі так само завершує весь метод.

## Альтернатива: `pytest.mark.parametrize`

Якщо ваш проєкт використовує сторонній інструмент запуску тестів **pytest** (`python -m pip install pytest`), параметризація там вбудована. Кожен рядок стає окремим тестом зі своїм ідентифікатором:

```python
import pytest

from pricing import calculate


@pytest.mark.parametrize(
    ("price", "tax", "discount", "expected"),
    [
        (10, 0, 0, 10),
        (10, 0.1, 0, 11),
        (10, 0, 1, 9),
        (10, 0.1, 1, 9.9),
    ],
)
def test_calculate(price, tax, discount, expected):
    assert calculate(price, tax, discount) == expected
```

Результат `pytest -v test_pricing_pytest.py` (рядки заголовка пропущено, час відрізняється):

```text
test_pricing_pytest.py::test_calculate[10-0-0-10] PASSED                 [ 25%]
test_pricing_pytest.py::test_calculate[10-0.1-0-11] PASSED               [ 50%]
test_pricing_pytest.py::test_calculate[10-0-1-9] PASSED                  [ 75%]
test_pricing_pytest.py::test_calculate[10-0.1-1-9.9] PASSED              [100%]

============================== 4 passed in 0.01s ===============================
```

Якщо ж обходитися лише стандартною бібліотекою, інструмент — `subTest()`. Для класів у стилі `unittest` є ще сторонній пакет `parameterized`, який за допомогою декоратора генерує окремий тестовий метод для кожного рядка.

## Типові помилки

- **Цикл без `subTest()`.** Перший невдалий випадок приховує всі інші, а звіт не каже, що це був за випадок.
- **Твердження поза блоком `with`.** Ізольовано лише невдачі всередині `subTest()`:

  ```python
  for n in [1, 2, 3]:
      result = n * 2
      self.assertGreater(result, 0)  # не захищено: невдача тут зупинить цикл
      with self.subTest(n=n):
          self.assertEqual(result % 2, 0)  # захищено
  ```

- **Підтест без позначки.** `self.subTest()` без аргументів дає у звіті `(<subtest>)`. Завжди передавайте вхідні дані (`n=n`) або коротке повідомлення.
- **Очікувати нове тестове оточення для кожного підтесту.** `setUp()` виконується один раз на весь метод. Стан для окремого випадку створюйте всередині блоку `with`.
- **Порівнювати «сирі» числа з рухомою комою через `assertEqual()`.** `calculate()` округлює результат, тому точне порівняння працює. Без округлення `10 * (1 + 0.07)` дорівнює `10.700000000000001`, і `assertEqual(..., 10.7)` не пройде. Для неокруглених чисел використовуйте `assertAlmostEqual()`.
- **Читати «Ran 1 test» як «перевірено один випадок».** Лічильник показує тестові методи. Щоб побачити, які підтести не пройшли або були пропущені, запускайте з `-v`.

## Підсумок

- Параметризований тест виконує одне тіло тесту для таблиці випадків. Він прибирає дублювання, коли випадки відрізняються лише даними.
- Звичайний цикл зупиняється на першій невдачі й не вказує, який випадок зламався.
- `with self.subTest(msg, **params):` ізолює кожну ітерацію: невдачі й помилки записуються окремо для кожного підтесту, а цикл триває.
- Повідомлення з'являється у `[...]`, іменовані параметри — у `(...)`. Вкладені підтести об'єднують свої параметри.
- «Ran N tests» рахує методи, а невдачі, помилки й пропуски рахуються для кожного підтесту окремо.
- `setUp()`/`tearDown()` виконуються один раз на метод, `skipTest()` пропускає один підтест, а `--failfast` зупиняється на першому невдалому підтесті.
- `@pytest.mark.parametrize` у pytest перетворює кожен рядок на окремий тест. Це головна альтернатива поза стандартною бібліотекою.

## Практика

### Вправа 1: Високосні роки в одному тесті

У `leap.py` є функція:

```python
def is_leap(year):
    return year % 4 == 0 and (year % 100 != 0 or year % 400 == 0)
```

Напишіть один тестовий метод, який перевіряє роки `2024`, `2023`, `1900`, `2000` і `2100` проти очікуваних результатів, використовуючи `subTest()` з іменованим параметром. Застосуйте `assertIs()`, щоб проходили лише справжні значення `True`/`False`.

### Вправа 2: Нехай підтести знайдуть помилки

`ports.py` має приймати лише рядки зі звичайних ASCII-цифр зі значенням від 1 до 65535:

```python
def parse_port(text):
    port = int(text)
    if not 1 <= port <= 65535:
        raise ValueError(f"port out of range: {port}")
    return port
```

Напишіть тести з `subTest()`: один метод для правильних значень `"1"`, `"80"`, `"65535"` і другий, який перевіряє, що `""`, `"http"`, `"0"`, `"65536"`, `"-1"`, `" 80"`, `"+80"` і `"8_0"` генерують `ValueError`. Запустіть їх, подивіться, які підтести не проходять, а тоді виправте `parse_port()`.

### Вправа 3: Пастка спільного тестового оточення

Поясніть, чому два з трьох підтестів не проходять, і виправте тест так, щоб кожен підтест перевіряв новий порожній кошик:

```python
import unittest


class TestCart(unittest.TestCase):
    def setUp(self):
        self.cart = []

    def test_add_one_item(self):
        for item in ["apple", "pear", "plum"]:
            with self.subTest(item=item):
                self.cart.append(item)
                self.assertEqual(len(self.cart), 1)
```

### Вправа 4: Сітка з вкладеними підтестами

У `clamp.py` є функція:

```python
def clamp(value, low, high):
    return max(low, min(value, high))
```

Напишіть тест, який у зовнішньому `subTest(low=..., high=...)` перебирає діапазони `(0, 10)` і `(-5, 5)`, а у внутрішньому `subTest(value=...)` — значення `-20`, `0`, `3`, `20`. Перевірте, що результат завжди лежить у межах `[low, high]` і дорівнює `value`, якщо `value` вже в діапазоні. Потім замініть тіло функції на хибне `return min(low, max(value, high))` і подивіться на позначки невдалих підтестів.

## Розв'язки

### Вправа 1

```python
import unittest

from leap import is_leap


class TestIsLeap(unittest.TestCase):
    def test_is_leap(self):
        cases = {
            2024: True,
            2023: False,
            1900: False,
            2000: True,
            2100: False,
        }
        for year, expected in cases.items():
            with self.subTest(year=year):
                self.assertIs(is_leap(year), expected)
```

Результат `python -m unittest test_leap -v` (час відрізняється):

```text
test_is_leap (test_leap.TestIsLeap.test_is_leap) ... ok

----------------------------------------------------------------------
Ran 1 test in 0.000s

OK
```

Словник зіставляє кожне вхідне значення з очікуваним результатом, і таблиця лишається читабельною. Найцікавіші рядки — `1900` і `2100`: вони діляться на 4 і на 100, але не на 400.

### Вправа 2

```python
import unittest

from ports import parse_port


class TestParsePort(unittest.TestCase):
    def test_valid(self):
        for text, expected in [("1", 1), ("80", 80), ("65535", 65535)]:
            with self.subTest(text=text):
                self.assertEqual(parse_port(text), expected)

    def test_invalid(self):
        for text in ["", "http", "0", "65536", "-1", " 80", "+80", "8_0"]:
            with self.subTest(text=text):
                with self.assertRaises(ValueError):
                    parse_port(text)
```

Результат `python -m unittest test_ports` із початковою `parse_port()` (шлях скорочено, час відрізняється):

```text
FFF.
======================================================================
FAIL: test_invalid (test_ports.TestParsePort.test_invalid) (text=' 80')
----------------------------------------------------------------------
Traceback (most recent call last):
  File ".../test_ports.py", line 15, in test_invalid
    with self.assertRaises(ValueError):
         ~~~~~~~~~~~~~~~~~^^^^^^^^^^^^
AssertionError: ValueError not raised

======================================================================
FAIL: test_invalid (test_ports.TestParsePort.test_invalid) (text='+80')
----------------------------------------------------------------------
Traceback (most recent call last):
  File ".../test_ports.py", line 15, in test_invalid
    with self.assertRaises(ValueError):
         ~~~~~~~~~~~~~~~~~^^^^^^^^^^^^
AssertionError: ValueError not raised

======================================================================
FAIL: test_invalid (test_ports.TestParsePort.test_invalid) (text='8_0')
----------------------------------------------------------------------
Traceback (most recent call last):
  File ".../test_ports.py", line 15, in test_invalid
    with self.assertRaises(ValueError):
         ~~~~~~~~~~~~~~~~~^^^^^^^^^^^^
AssertionError: ValueError not raised

----------------------------------------------------------------------
Ran 2 tests in 0.001s

FAILED (failures=3)
```

Усі три помилки видно за один запуск. `int()` поблажливіша за специфікацію: вона відкидає пробіли по краях, приймає знак і дозволяє підкреслення між цифрами (`int("8_0")` дорівнює `80`). Виправлення перевіряє текст до перетворення:

```python
def parse_port(text):
    if not (text.isascii() and text.isdigit()):
        raise ValueError(f"not a plain number: {text!r}")
    port = int(text)
    if not 1 <= port <= 65535:
        raise ValueError(f"port out of range: {port}")
    return port
```

`isascii()` потрібна тому, що сама `isdigit()` приймає й цифри інших писемностей, наприклад арабсько-індійські `"٨٠"`. Тепер `python -m unittest test_ports -v` виводить:

```text
test_invalid (test_ports.TestParsePort.test_invalid) ... ok
test_valid (test_ports.TestParsePort.test_valid) ... ok

----------------------------------------------------------------------
Ran 2 tests in 0.000s

OK
```

### Вправа 3

`setUp()` виконується один раз для `test_add_one_item`, а не для кожного підтесту, тож усі три підтести ділять один список. Після `"apple"` у кошику 1 товар (тест проходить), після `"pear"` — 2, після `"plum"` — 3. Результат початкового тесту (шлях скорочено, час відрізняється):

```text
FF
======================================================================
FAIL: test_add_one_item (test_cart.TestCart.test_add_one_item) (item='pear')
----------------------------------------------------------------------
Traceback (most recent call last):
  File ".../test_cart.py", line 12, in test_add_one_item
    self.assertEqual(len(self.cart), 1)
    ~~~~~~~~~~~~~~~~^^^^^^^^^^^^^^^^^^^
AssertionError: 2 != 1

======================================================================
FAIL: test_add_one_item (test_cart.TestCart.test_add_one_item) (item='plum')
----------------------------------------------------------------------
Traceback (most recent call last):
  File ".../test_cart.py", line 12, in test_add_one_item
    self.assertEqual(len(self.cart), 1)
    ~~~~~~~~~~~~~~~~^^^^^^^^^^^^^^^^^^^
AssertionError: 3 != 1

----------------------------------------------------------------------
Ran 1 test in 0.000s

FAILED (failures=2)
```

Виправлення створює стан усередині підтесту:

```python
import unittest


class TestCart(unittest.TestCase):
    def test_add_one_item(self):
        for item in ["apple", "pear", "plum"]:
            with self.subTest(item=item):
                cart = []  # новий стан для кожного підтесту
                cart.append(item)
                self.assertEqual(len(cart), 1)
```

Результат `python -m unittest test_cart -v` (час відрізняється):

```text
test_add_one_item (test_cart.TestCart.test_add_one_item) ... ok

----------------------------------------------------------------------
Ran 1 test in 0.000s

OK
```

Якщо підготовка дорога або складна, винесіть її в допоміжний метод (наприклад, `self.make_cart()`) і викликайте його на початку кожного підтесту.

### Вправа 4

```python
import unittest

from clamp import clamp


class TestClamp(unittest.TestCase):
    def test_result_is_inside_range(self):
        for low, high in [(0, 10), (-5, 5)]:
            with self.subTest(low=low, high=high):
                for value in [-20, 0, 3, 20]:
                    with self.subTest(value=value):
                        result = clamp(value, low, high)
                        self.assertTrue(low <= result <= high)
                        if low <= value <= high:
                            self.assertEqual(result, value)
```

З правильною `clamp()` команда `python -m unittest test_clamp -v` виводить `test_result_is_inside_range (...) ... ok`. З хибною `min(low, max(value, high))` вона виводить (шлях скорочено, час відрізняється):

```text
FFF
======================================================================
FAIL: test_result_is_inside_range (test_clamp.TestClamp.test_result_is_inside_range) (value=3, low=0, high=10)
----------------------------------------------------------------------
Traceback (most recent call last):
  File ".../test_clamp.py", line 15, in test_result_is_inside_range
    self.assertEqual(result, value)
    ~~~~~~~~~~~~~~~~^^^^^^^^^^^^^^^
AssertionError: 0 != 3

======================================================================
FAIL: test_result_is_inside_range (test_clamp.TestClamp.test_result_is_inside_range) (value=0, low=-5, high=5)
----------------------------------------------------------------------
Traceback (most recent call last):
  File ".../test_clamp.py", line 15, in test_result_is_inside_range
    self.assertEqual(result, value)
    ~~~~~~~~~~~~~~~~^^^^^^^^^^^^^^^
AssertionError: -5 != 0

======================================================================
FAIL: test_result_is_inside_range (test_clamp.TestClamp.test_result_is_inside_range) (value=3, low=-5, high=5)
----------------------------------------------------------------------
Traceback (most recent call last):
  File ".../test_clamp.py", line 15, in test_result_is_inside_range
    self.assertEqual(result, value)
    ~~~~~~~~~~~~~~~~^^^^^^^^^^^^^^^
AssertionError: -5 != 3

----------------------------------------------------------------------
Ran 1 test in 0.001s

FAILED (failures=3)
```

Кожна позначка поєднує внутрішній параметр із зовнішніми, наприклад `(value=3, low=0, high=10)`, тож кожну невдалу точку сітки визначено точно. Хибна версія завжди повертає `low`. Саме тому перевірка «в межах діапазону» ніколи не падає, і помилку ловить лише перевірка «дорівнює `value`». Це гарне нагадування: одна властивість рідко доводить, що функція правильна.

---

*Джерело: [pythontutorial.net — Python unittest subtest](https://www.pythontutorial.net/python-unit-testing/python-unittest-subtest/). Адаптовано й доповнено для PyJourney.*
