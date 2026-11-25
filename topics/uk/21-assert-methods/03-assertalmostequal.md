# assertAlmostEqual()

Числа з рухомою комою зберігаються у двійковому вигляді й майже ніколи не бувають точними: `0.1 + 0.2` дорівнює `0.30000000000000004`. Тому тест, який порівнює такі числа через `assertEqual()`, не проходить навіть для правильного коду. `assertAlmostEqual()` порівнює два числа з допуском: дрібні похибки округлення не заважають, а справжні помилки все одно помітні.

## Що ви дізнаєтесь

- Чому `assertEqual()` ненадійний для чисел з рухомою комою
- Як саме, крок за кроком, `assertAlmostEqual()` ухвалює рішення
- Що насправді означає `places` і чому він поводиться дивно для дуже малих і дуже великих чисел
- Як задати явний допуск через `delta`, зокрема для міток часу
- Як працює `assertNotAlmostEqual()`
- Як отримати відносний допуск за допомогою `math.isclose()`

## Навіщо числам з рухомою комою допуск

Ось функція у файлі `circle.py`:

```python
import math


def area(radius: float) -> float:
    return math.pi * math.pow(radius, 2)
```

Якщо обчислити те саме значення двома математично рівноцінними способами, результати можуть відрізнятися в останній цифрі:

```python
import unittest
from math import pi

from circle import area


class TestCircleExact(unittest.TestCase):
    def test_area_exact(self):
        self.assertEqual(area(1.1), pi * 1.21)

    def test_area_almost(self):
        self.assertAlmostEqual(area(1.1), pi * 1.21)
```

Результат `python3 -m unittest test_circle2 -v` (шляхи скорочено):

```text
test_area_almost (test_circle2.TestCircleExact.test_area_almost) ... ok
test_area_exact (test_circle2.TestCircleExact.test_area_exact) ... FAIL

======================================================================
FAIL: test_area_exact (test_circle2.TestCircleExact.test_area_exact)
----------------------------------------------------------------------
Traceback (most recent call last):
  File ".../test_circle2.py", line 9, in test_area_exact
    self.assertEqual(area(1.1), pi * 1.21)
    ~~~~~~~~~~~~~~~~^^^^^^^^^^^^^^^^^^^^^^
AssertionError: 3.8013271108436504 != 3.8013271108436495

----------------------------------------------------------------------
Ran 2 tests in 0.000s

FAILED (failures=1)
```

Ці два числа відрізняються менш ніж на `0.000000000000001`. Код правильний, проблема — у точному порівнянні.

## Як `assertAlmostEqual()` ухвалює рішення

```python
assertAlmostEqual(first, second, places=None, msg=None, delta=None)
```

Метод діє в такому порядку:

1. Якщо `first == second`, тест одразу проходить.
2. Якщо задано і `places`, і `delta`, генерується `TypeError`.
3. Обчислюється `diff = abs(first - second)`.
4. Із `delta`: тест проходить, якщо `diff <= delta`.
5. Інакше використовується `places` (7, якщо не задано): тест проходить, якщо `round(diff, places) == 0`.

Без `delta` перевірка рівноцінна такому ескізу:

```python
def almost_equal(first, second, places=7):
    if first == second:
        return True
    return round(abs(first - second), places) == 0


print(almost_equal(0.1 + 0.2, 0.3))
print(round(0.00000004, 7), round(0.00000006, 7))
print(almost_equal(0.3, 0.30000004), almost_equal(0.3, 0.30000006))
```

Результат:

```text
True
0.0 1e-07
True False
```

Різниця округлюється до нуля на 7 знаках, коли вона менша приблизно за `0.00000005` (5 × 10⁻⁸). Отже, зі значеннями за замовчуванням «майже рівні» означає «різниця менша приблизно за половину одиниці сьомого знака після коми».

> **Зверніть увагу:** іноді правило записують як `round(first - second, 7) == 0`. Справжня реалізація спершу бере `abs()` від різниці й має «скорочення» для `first == second`, але для звичайних чисел результат той самий.

### Базовий приклад

Тест для `area()` із `circle.py`:

```python
import unittest
from math import pi

from circle import area


class TestCircle(unittest.TestCase):
    def test_area(self):
        self.assertAlmostEqual(area(0), 0)
        self.assertAlmostEqual(area(1), pi)
        self.assertAlmostEqual(area(0.1), pi * 0.1 * 0.1)
```

Результат `python3 -m unittest test_circle -v`:

```text
test_area (test_circle.TestCircle.test_area) ... ok

----------------------------------------------------------------------
Ran 1 test in 0.000s

OK
```

## `places` рахує знаки після коми, а не значущі цифри

`places` — це кількість цифр **після десяткової коми**, незалежно від того, великі числа чи малі. Для значень порядку одиниці це працює добре, а для дуже малих чи дуже великих — погано:

```python
import unittest


class TestPlaces(unittest.TestCase):
    def test_pi_to_two_places(self):
        self.assertAlmostEqual(3.14159, 3.14, places=2)

    def test_not_close_enough(self):
        self.assertAlmostEqual(3.146, 3.14, places=2)

    def test_tiny_numbers(self):
        self.assertAlmostEqual(1e-8, 2e-8)

    def test_large_numbers(self):
        self.assertAlmostEqual(1_000_000.0, 1_000_000.1)
```

Рядки тестів і рядки `AssertionError` з виводу `python3 -m unittest test_places -v`:

```text
test_large_numbers (test_places.TestPlaces.test_large_numbers) ... FAIL
test_not_close_enough (test_places.TestPlaces.test_not_close_enough) ... FAIL
test_pi_to_two_places (test_places.TestPlaces.test_pi_to_two_places) ... ok
test_tiny_numbers (test_places.TestPlaces.test_tiny_numbers) ... ok

AssertionError: 1000000.0 != 1000000.1 within 7 places (0.09999999997671694 difference)
AssertionError: 3.146 != 3.14 within 2 places (0.005999999999999783 difference)
```

- `3.14159` і `3.14` відрізняються на `0.00159`, а це на 2 знаках округлюється до `0.0`: тест проходить.
- `3.146` і `3.14` відрізняються на `0.006`, що округлюється до `0.01`: невдача. Повідомлення показує значення, точність і фактичну різницю.
- `1e-8` і `2e-8` **проходять**, хоча одне число вдвічі більше за інше. Їхня різниця значно менша за сьомий знак після коми.
- `1_000_000.0` і `1_000_000.1` **не проходять**, хоча відрізняються лише на 0,00001 %.

Коли ваші числа далекі від одиниці, або явно задайте `delta`, або використайте відносний допуск (див. нижче).

## `delta`: явний допуск

Через `delta` ви прямо вказуєте найбільшу допустиму різницю. Межа включна: `diff <= delta` проходить.

```python
import unittest
from datetime import datetime, timedelta


def read_voltage():
    return 5.08  # уявімо, що значення надходить із датчика


def create_order():
    return {"id": 1, "created_at": datetime.now()}


class TestDelta(unittest.TestCase):
    def test_voltage_within_tolerance(self):
        self.assertAlmostEqual(read_voltage(), 5.0, delta=0.1)

    def test_voltage_strict(self):
        self.assertAlmostEqual(read_voltage(), 5.0, delta=0.05)

    def test_created_now(self):
        order = create_order()
        self.assertAlmostEqual(
            order["created_at"], datetime.now(), delta=timedelta(seconds=1)
        )

    def test_both_places_and_delta(self):
        self.assertAlmostEqual(read_voltage(), 5.0, places=1, delta=0.1)
```

Рядки тестів, останній рядок кожного трасування й підсумок `python3 -m unittest test_delta -v`:

```text
test_both_places_and_delta (test_delta.TestDelta.test_both_places_and_delta) ... ERROR
test_created_now (test_delta.TestDelta.test_created_now) ... ok
test_voltage_strict (test_delta.TestDelta.test_voltage_strict) ... FAIL
test_voltage_within_tolerance (test_delta.TestDelta.test_voltage_within_tolerance) ... ok

TypeError: specify delta or places not both
AssertionError: 5.08 != 5.0 within 0.05 delta (0.08000000000000007 difference)

FAILED (failures=1, errors=1)
```

На що звернути увагу:

- `delta` формулює вимогу в одиницях задачі («у межах 0,1 В»), і це зазвичай зрозуміліше, ніж кількість знаків після коми.
- `delta` працює з будь-якими значеннями, що підтримують віднімання, `abs()` і `<=`. Різниця двох `datetime` — це `timedelta`, тож `delta=timedelta(seconds=1)` — зручний спосіб перевірити «створено щойно», де точне порівняння неможливе.
- Передати і `places`, і `delta` — помилка в самому тесті. Генерується `TypeError`, тому тест завершується з `ERROR`, а не `FAIL`.

## Граничні випадки

| Виклик | Результат | Чому |
|---|---|---|
| `assertAlmostEqual(math.inf, math.inf)` | проходить | рівні значення проходять одразу |
| `assertAlmostEqual(math.nan, math.nan)` | FAIL | NaN не дорівнює нічому, а різниця дорівнює `nan` |
| `assertAlmostEqual("a", "a")` | проходить | рівні значення проходять, хоч би якого типу вони були |
| `assertAlmostEqual("a", "b")` | ERROR (`TypeError`) | рядки не можна віднімати |
| `assertAlmostEqual(Decimal(1) / 3, Decimal("0.33333333"))` | проходить | `Decimal` і `Fraction` теж підтримуються |
| `assertAlmostEqual(Decimal("0.3"), 0.3)` | ERROR (`TypeError`) | `Decimal` і `float` не можна віднімати одне від одного |
| `assertAlmostEqual(dt1, dt2)` для двох об'єктів `datetime` | ERROR (`TypeError`) | `timedelta` не можна округлити, тож використовуйте `delta` |

Щоб перевірити, що значення *є* NaN, використовуйте `self.assertTrue(math.isnan(value))`.

## `assertNotAlmostEqual()`

```python
assertNotAlmostEqual(first, second, places=None, msg=None, delta=None)
```

Протилежна перевірка. Вона не проходить, коли значення рівні або їхня різниця округлюється до нуля на `places` знаках. Із `delta` вона проходить лише тоді, коли різниця **строго більша** за `delta`.

```python
import unittest


def apply_inflation(price, rate):
    return price * (1 + rate)


class TestInflation(unittest.TestCase):
    def test_price_changes_noticeably(self):
        self.assertNotAlmostEqual(apply_inflation(100.0, 0.05), 100.0, delta=1)

    def test_tiny_rate(self):
        self.assertNotAlmostEqual(apply_inflation(100.0, 1e-12), 100.0)
```

Результат `python3 -m unittest test_inflation -v` (трасування скорочено):

```text
test_price_changes_noticeably (test_inflation.TestInflation.test_price_changes_noticeably) ... ok
test_tiny_rate (test_inflation.TestInflation.test_tiny_rate) ... FAIL

======================================================================
FAIL: test_tiny_rate (test_inflation.TestInflation.test_tiny_rate)
----------------------------------------------------------------------
AssertionError: 100.00000000010002 == 100.0 within 7 places

----------------------------------------------------------------------
Ran 2 tests in 0.000s

FAILED (failures=1)
```

Зростання на 5 % змінює ціну на 5, а це більше за `delta=1`. Ставка `1e-12` змінює її на `0.0000000001`, і на 7 знаках це «майже рівні» значення.

## Відносний допуск із `math.isclose()`

І `places`, і `delta` — **абсолютні** допуски. Коли порядок величин змінюється (мікроампери в одному тесті, мільйони гривень в іншому), краще підходить **відносний** допуск: «рівні з точністю до однієї мільярдної». Методу-твердження для цього в `unittest` немає, але порівняння виконує `math.isclose()`:

```python
import math
import unittest


class TestRelative(unittest.TestCase):
    def test_large_values(self):
        actual = 1_000_000.0000001
        self.assertTrue(
            math.isclose(actual, 1_000_000.0, rel_tol=1e-9),
            f"{actual!r} is not close to 1000000.0",
        )
```

Результат `python3 -m unittest test_isclose -v`:

```text
test_large_values (test_isclose.TestRelative.test_large_values) ... ok

----------------------------------------------------------------------
Ran 1 test in 0.000s

OK
```

`msg` тут важливий: без нього невдача повідомила б лише `False is not true`. У вправі 4 ви перетворите це на власний метод-твердження для повторного використання.

## Типові помилки

- **Порівнювати числа з рухомою комою через `assertEqual()`.** Для одних значень це випадково працює, для інших — ні. Для будь-якого обчисленого `float` використовуйте `assertAlmostEqual()`.
- **Вважати `places` кількістю значущих цифр.** Зі стандартним `places=7` числа `1e-8` і `2e-8` «майже рівні», а `1_000_000.0` і `1_000_000.1` — ні. Для значень, далеких від одиниці, використовуйте `delta` або `math.isclose()`.
- **Передавати `msg` третім позиційним аргументом.** Третій параметр — це `places`, а не `msg`:

  ```python
  self.assertAlmostEqual(0.5, 0.25, "ratio is wrong")
  ```

  Такий тест завершується з `ERROR` і `TypeError: 'str' object cannot be interpreted as an integer`. Пишіть `msg="ratio is wrong"` як іменований аргумент.
- **Передавати і `places`, і `delta`.** Це генерує `TypeError` (`ERROR`). Оберіть щось одне.
- **Використовувати `float` для грошей.** Ціни й баланси мають бути `Decimal` або цілою кількістю копійок і порівнюватися точно через `assertEqual()`. Допуск лише приховає там помилки округлення.
- **Очікувати, що NaN майже дорівнює NaN.** Цього ніколи не буває. Перевіряйте через `math.isnan()`.

## Підсумок

- Використовуйте `assertAlmostEqual()` замість `assertEqual()`, коли порівнюєте обчислені числа з рухомою комою.
- Рівні значення проходять одразу. Інакше метод бере `abs(first - second)` і пропускає тест, якщо це значення округлюється до `0` на `places` знаках після коми (за замовчуванням 7, тобто різниця має бути меншою приблизно за `5e-8`).
- `places` рахує цифри після коми, а не значущі цифри, тому для дуже малих чисел він надто поблажливий, а для дуже великих — надто суворий.
- `delta` задає явний абсолютний допуск (`diff <= delta`) і працює також із `datetime`/`timedelta`, `Decimal` і `Fraction`.
- `places` і `delta` не можна поєднувати: це генерує `TypeError`.
- `assertNotAlmostEqual()` проходить лише тоді, коли різниця достатньо велика (`> delta` або ненульова після округлення).
- Для відносного допуску використовуйте `math.isclose()` зі змістовним `msg` або загорніть його у власний метод-твердження.

## Практика

### Вправа 1: Протестуйте `average()`

Файл `stats.py` містить:

```python
def average(numbers):
    return sum(numbers) / len(numbers)
```

Напишіть три тести: середнє `[0.1, 0.2, 0.3]` дорівнює `0.2`, середнє `[1, 2, 3, 4]` дорівнює рівно `2.5`, а середнє `[19.99, 5.01, 7.5]` дорівнює `10.83` з точністю до двох знаків після коми. Для кожного оберіть відповідний метод-твердження.

### Вправа 2: Проходить, FAIL чи ERROR?

Передбачте результат кожного виклику, а потім перевірте відповіді скриптом.

1. `assertAlmostEqual(0.1 + 0.2, 0.3)`
2. `assertAlmostEqual(1e-9, 5e-9)`
3. `assertAlmostEqual(100.0, 100.01, places=1)`
4. `assertAlmostEqual(100.0, 100.01, delta=0.001)`
5. `assertAlmostEqual(10, 10.4, places=0)`
6. `assertAlmostEqual(1.0, 1.1, places=1, delta=0.5)`
7. `assertAlmostEqual(float("nan"), float("nan"))`
8. `assertNotAlmostEqual(1.0, 1.00000001)`

### Вправа 3: Термін дії токена

Файл `tokens.py` містить:

```python
from datetime import datetime, timedelta


def make_token(ttl_seconds):
    return {
        "value": "abc123",
        "expires_at": datetime.now() + timedelta(seconds=ttl_seconds),
    }
```

Напишіть тести, які перевіряють, що термін дії `make_token(3600)` спливає приблизно за годину від поточного моменту, а `make_token(0)` — приблизно зараз. Допустіть різницю в одну секунду.

### Вправа 4: Метод-твердження з відносним допуском

Напишіть клас-домішку (mixin) `RelativeCloseMixin` із методом `assertRelativelyClose(first, second, rel_tol=1e-9, msg=None)` на основі `math.isclose()`. У разі невдачі він має викликати `self.fail()` з повідомленням на кшталт `1e-08 != 2e-08 within rel_tol=1e-09`, а якщо задано `msg`, додавати ` : <msg>`. Протестуйте його: `1_000_000.0` і `1_000_000.0000001` мають бути близькими, `1e-8` і `2e-8` — ні (використайте `assertRaises(AssertionError)` і перевірте повідомлення), а `101.0` і `100.0` мають бути близькими з `rel_tol=0.02`.

## Розв'язки

### Вправа 1

```python
import unittest

from stats import average


class TestAverage(unittest.TestCase):
    def test_floats(self):
        self.assertAlmostEqual(average([0.1, 0.2, 0.3]), 0.2)

    def test_integers(self):
        self.assertEqual(average([1, 2, 3, 4]), 2.5)

    def test_two_decimal_places(self):
        self.assertAlmostEqual(average([19.99, 5.01, 7.5]), 10.83, places=2)
```

Результат `python3 -m unittest test_stats -v`:

```text
test_floats (test_stats.TestAverage.test_floats) ... ok
test_integers (test_stats.TestAverage.test_integers) ... ok
test_two_decimal_places (test_stats.TestAverage.test_two_decimal_places) ... ok

----------------------------------------------------------------------
Ran 3 tests in 0.000s

OK
```

Насправді `average([0.1, 0.2, 0.3])` дорівнює `0.19999999999999998`, тож `assertEqual()` тут не пройшов би. `10 / 4` дорівнює рівно `2.5` (це число точно представляється у двійковому вигляді), тому для другого тесту `assertEqual()` годиться. Третє середнє дорівнює `10.833333333333334`, а різниця `0.0033...` на 2 знаках округлюється до `0.0`.

### Вправа 2

```python
import unittest

tc = unittest.TestCase()  # екземпляр лише для експериментів

checks = [
    (1, tc.assertAlmostEqual, (0.1 + 0.2, 0.3), {}),
    (2, tc.assertAlmostEqual, (1e-9, 5e-9), {}),
    (3, tc.assertAlmostEqual, (100.0, 100.01), {"places": 1}),
    (4, tc.assertAlmostEqual, (100.0, 100.01), {"delta": 0.001}),
    (5, tc.assertAlmostEqual, (10, 10.4), {"places": 0}),
    (6, tc.assertAlmostEqual, (1.0, 1.1), {"places": 1, "delta": 0.5}),
    (7, tc.assertAlmostEqual, (float("nan"), float("nan")), {}),
    (8, tc.assertNotAlmostEqual, (1.0, 1.00000001), {}),
]

for number, method, args, kwargs in checks:
    try:
        method(*args, **kwargs)
        print(number, "pass")
    except AssertionError as error:
        print(number, "FAIL:", error)
    except TypeError as error:
        print(number, "ERROR:", error)
```

Результат:

```text
1 pass
2 pass
3 pass
4 FAIL: 100.0 != 100.01 within 0.001 delta (0.010000000000005116 difference)
5 pass
6 ERROR: specify delta or places not both
7 FAIL: nan != nan within 7 places (nan difference)
8 FAIL: 1.0 == 1.00000001 within 7 places
```

`unittest.TestCase()` можна створити без назви тестового методу, і це зручно, щоб випробовувати методи-твердження у скрипті чи REPL.

- 2: різниця `4e-9` значно менша за сьомий знак після коми.
- 3: `round(0.01, 1)` дорівнює `0.0`.
- 5: `places=0` означає «рівні після округлення до цілого», а `round(0.4)` дорівнює `0`.
- 8: різниця `1e-8` округлюється до нуля, тобто значення *є* майже рівними, і `assertNotAlmostEqual()` не проходить.

### Вправа 3

```python
import unittest
from datetime import datetime, timedelta

from tokens import make_token


class TestMakeToken(unittest.TestCase):
    def test_expires_in_one_hour(self):
        token = make_token(3600)
        expected = datetime.now() + timedelta(hours=1)
        self.assertAlmostEqual(
            token["expires_at"], expected, delta=timedelta(seconds=1)
        )

    def test_zero_ttl_expires_now(self):
        token = make_token(0)
        self.assertAlmostEqual(
            token["expires_at"], datetime.now(), delta=timedelta(seconds=1)
        )
```

Результат `python3 -m unittest test_tokens -v`:

```text
test_expires_in_one_hour (test_tokens.TestMakeToken.test_expires_in_one_hour) ... ok
test_zero_ttl_expires_now (test_tokens.TestMakeToken.test_zero_ttl_expires_now) ... ok

----------------------------------------------------------------------
Ran 2 tests in 0.000s

OK
```

Два виклики `datetime.now()` (один усередині `make_token()`, другий у тесті) відбуваються з різницею в мікросекунди, тож точне порівняння не пройшло б. Одна секунда — щедрий допуск, який усе ж ловить справжні помилки, наприклад TTL у хвилинах замість секунд.

### Вправа 4

```python
import math
import unittest


class RelativeCloseMixin:
    def assertRelativelyClose(self, first, second, rel_tol=1e-9, msg=None):
        if math.isclose(first, second, rel_tol=rel_tol):
            return
        standard_msg = f"{first!r} != {second!r} within rel_tol={rel_tol!r}"
        if msg is not None:
            standard_msg = f"{standard_msg} : {msg}"
        self.fail(standard_msg)


class TestRelative(RelativeCloseMixin, unittest.TestCase):
    def test_large_numbers_are_close(self):
        self.assertRelativelyClose(1_000_000.0, 1_000_000.0000001)

    def test_tiny_numbers_are_not_close(self):
        with self.assertRaises(AssertionError) as cm:
            self.assertRelativelyClose(1e-8, 2e-8)
        self.assertEqual(str(cm.exception), "1e-08 != 2e-08 within rel_tol=1e-09")

    def test_custom_tolerance(self):
        self.assertRelativelyClose(101.0, 100.0, rel_tol=0.02)

    def test_msg(self):
        with self.assertRaises(AssertionError) as cm:
            self.assertRelativelyClose(1.0, 2.0, msg="speed")
        self.assertEqual(str(cm.exception), "1.0 != 2.0 within rel_tol=1e-09 : speed")
```

Результат `python3 -m unittest test_relative -v`:

```text
test_custom_tolerance (test_relative.TestRelative.test_custom_tolerance) ... ok
test_large_numbers_are_close (test_relative.TestRelative.test_large_numbers_are_close) ... ok
test_msg (test_relative.TestRelative.test_msg) ... ok
test_tiny_numbers_are_not_close (test_relative.TestRelative.test_tiny_numbers_are_not_close) ... ok

----------------------------------------------------------------------
Ran 4 tests in 0.000s

OK
```

`self.fail()` генерує `AssertionError` (точніше, `self.failureException`), тому засіб запуску звітує про невдачу власного твердження як про `FAIL`, так само як і для вбудованого. Перевіряти через `assertRaises(AssertionError)`, що твердження справді не проходить, — поширений спосіб тестувати власні допоміжні методи-твердження. Домішка стоїть у списку базових класів **перед** `unittest.TestCase` і не має `__init__`, тож не заважає механізмам тестового класу.

---

*Джерело: [pythontutorial.net — Python assertAlmostEqual()](https://www.pythontutorial.net/python-unit-testing/python-assertalmostequal/). Адаптовано й доповнено для PyJourney.*
