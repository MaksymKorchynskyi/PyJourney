# assertEqual()

`assertEqual()` — головна робоча конячка `unittest`: більшість тестів завершуються порівнянням того, що повернув код, із тим, що він мав повернути. Метод виглядає простим, але має кілька корисних можливостей, як-от зрозумілі порівняння відмінностей (diff) для списків, словників і рядків, і кілька пасток, як-от числа з рухомою комою та об'єкти, що не визначають рівність.

## Що ви дізнаєтесь

- Що саме перевіряє `assertEqual(first, second, msg=None)`
- Як читати повідомлення про невдачу, зокрема diff для списків, словників, множин і багаторядкових рядків
- Як `maxDiff` керує довгими diff
- Як додати контекст за допомогою аргументу `msg`
- Як працює `assertNotEqual()` і коли він корисний (а коли ні)
- Чому числа з рухомою комою та власні об'єкти часто ламають `assertEqual()`

## Як працює `assertEqual()`

```python
assertEqual(first, second, msg=None)
```

Тест проходить, коли `first == second` істинне. Інакше `assertEqual()` генерує `AssertionError`, і тест позначається як `FAIL`. Необов'язковий `msg` додає до повідомлення про невдачу ваше пояснення.

Ось функція у файлі `main.py`:

```python
def add(a, b):
    return a + b
```

І її тест у `test_main.py`. Другий тест навмисно неправильний, щоб ви побачили невдачу:

```python
import unittest

from main import add


class TestMain(unittest.TestCase):
    def test_add(self):
        self.assertEqual(add(1, 2), 3)

    def test_add_strings(self):
        self.assertEqual(add("1", "2"), 3)
```

Запуск:

```bash
python3 -m unittest test_main -v
```

Результат (шляхи скорочено, час щоразу інший):

```text
test_add (test_main.TestMain.test_add) ... ok
test_add_strings (test_main.TestMain.test_add_strings) ... FAIL

======================================================================
FAIL: test_add_strings (test_main.TestMain.test_add_strings)
----------------------------------------------------------------------
Traceback (most recent call last):
  File ".../test_main.py", line 11, in test_add_strings
    self.assertEqual(add("1", "2"), 3)
    ~~~~~~~~~~~~~~~~^^^^^^^^^^^^^^^^^^
AssertionError: '12' != 3

----------------------------------------------------------------------
Ran 2 tests in 0.000s

FAILED (failures=1)
```

Повідомлення `'12' != 3` показує обидва значення через `repr()`. Саме тому в ньому є лапки: одразу видно, що результат — **рядок** `'12'`, а не число.

> **Порада:** порядок аргументів не впливає на те, чи пройде тест, але впливає на те, як читається повідомлення. Звична домовленість (і саме її дотримується цей розділ) — `assertEqual(actual, expected)`: спочатку значення, яке видав ваш код, потім очікуване. Оберіть один порядок і тримайтеся його.

### Рівність означає `==`, і не більше

`assertEqual()` використовує оператор `==`, тож успадковує всі його правила:

- `assertEqual(1, 1.0)` і `assertEqual(1, True)` **проходять**, бо в Python `1 == 1.0 == True`. `assertEqual()` не порівнює типи.
- `assertEqual([1, 2], (1, 2))` **не проходить**: список ніколи не дорівнює кортежу.
- `assertEqual({"a": 1, "b": 2}, {"b": 2, "a": 1})` **проходить**: словники порівнюються за вмістом, а не за порядком додавання.
- `assertEqual(float("nan"), float("nan"))` **не проходить**, бо NaN не дорівнює нічому, навіть самому собі.

Якщо важливий і тип, додайте окрему перевірку, наприклад `assertIs(type(result), int)` або `assertIsInstance()` (див. тему assertIsInstance()).

## Diff для контейнерів і рядків

Коли обидва аргументи мають **точно однаковий тип** і це `list`, `tuple`, `dict`, `set`, `frozenset` або `str`, `assertEqual()` передає порівняння спеціалізованому методу (`assertListEqual()`, `assertDictEqual()`, `assertMultiLineEqual()` тощо). Ці методи додають до повідомлення diff. Ось п'ять тестів, що не проходять:

```python
import unittest


class TestDiffs(unittest.TestCase):
    def test_list(self):
        self.assertEqual([1, 2, 3, 4], [1, 2, 5, 4])

    def test_dict(self):
        user = {"name": "olena", "age": 30, "city": "Lviv"}
        self.assertEqual(user, {"name": "olena", "age": 31, "city": "Lviv"})

    def test_text(self):
        report = "total: 3\nfailed: 1\nskipped: 0\n"
        self.assertEqual(report, "total: 3\nfailed: 0\nskipped: 0\n")

    def test_set(self):
        self.assertEqual({"read", "write"}, {"read", "delete"})

    def test_different_types(self):
        self.assertEqual([1, 2], (1, 2))
```

Частини `AssertionError` з виводу `python3 -m unittest test_diffs` (трасування скорочено, тести в алфавітному порядку):

```text
AssertionError: {'name': 'olena', 'age': 30, 'city': 'Lviv'} != {'name': 'olena', 'age': 31, 'city': 'Lviv'}
- {'age': 30, 'city': 'Lviv', 'name': 'olena'}
?          ^

+ {'age': 31, 'city': 'Lviv', 'name': 'olena'}
?          ^

AssertionError: [1, 2] != (1, 2)

AssertionError: Lists differ: [1, 2, 3, 4] != [1, 2, 5, 4]

First differing element 2:
3
5

- [1, 2, 3, 4]
?        ^

+ [1, 2, 5, 4]
?        ^

AssertionError: Items in the first set but not the second:
'write'
Items in the second set but not the first:
'delete'

AssertionError: 'total: 3\nfailed: 1\nskipped: 0\n' != 'total: 3\nfailed: 0\nskipped: 0\n'
  total: 3
- failed: 1
?         ^
+ failed: 0
?         ^
  skipped: 0
```

Як читати ці diff:

- Рядки, що починаються з `-`, походять із **першого** аргументу, а рядки з `+` — із **другого**. Рядки, що починаються двома пробілами, однакові в обох.
- Рядок `?` ставить `^` під символами, які відрізняються (або `+` під зайвими).
- Для списків і кортежів `First differing element 2:` вказує індекс, а за ним ідуть два значення з цим індексом.
- У diff словника ключі **відсортовано** (`age`, `city`, `name`). Diff будується за допомогою `pprint`, який сортує ключі словника, тож не дивуйтеся, що порядок відрізняється від вашого коду.
- Для множин замість diff ви отримуєте елементи, яких бракує з кожного боку.
- `[1, 2]` і `(1, 2)` мають різні типи, тому спеціалізованого методу немає, і diff теж немає, лише `!=`.

> **Зверніть увагу:** спеціалізований метод обирається лише тоді, коли `type(first) is type(second)`. Наприклад, підклас `list`, який порівнюють зі звичайним `list`, отримає просте повідомлення `first != second`.

### Довгі значення та `maxDiff`

Довгі значення скорочуються в першому рядку повідомлення (`[181 chars]` нижче), а diff, довший за `maxDiff` символів (за замовчуванням `640`, тобто 80 × 8), замінюється підказкою:

```python
import unittest


class TestLong(unittest.TestCase):
    def test_numbers(self):
        expected = list(range(100))
        actual = list(range(100))
        actual[50] = -1
        self.assertEqual(actual, expected)
```

Частина `AssertionError` з виводу:

```text
AssertionError: Lists differ: [0, 1[181 chars] 49, -1, 51, 52, 53, 54, 55, 56, 57, 58, 59, 6[153 chars], 99] != [0, 1[181 chars] 49, 50, 51, 52, 53, 54, 55, 56, 57, 58, 59, 6[153 chars], 99]

First differing element 50:
-1
50

Diff is 697 characters long. Set self.maxDiff to None to see it.
```

Тут `First differing element 50` уже вказує на проблему. Коли потрібен повний diff, встановіть атрибут класу `maxDiff = None` (без обмеження) або більше число:

```python
class TestLongFullDiff(TestLong):
    maxDiff = None
```

Цей клас успадковує `test_numbers` і тепер друкує повний diff: по рядку на кожен елемент, а відмінність позначено рядками `-  -1,` і `+  50,`. `maxDiff` можна змінити й для одного тесту: `self.maxDiff = None`.

## Контекст через `msg`

Самі значення не завжди пояснюють, *який* випадок не пройшов, особливо в циклі. Аргумент `msg` додається після ` : ` (подробиці про `longMessage` — у темі Методи-твердження):

```python
import unittest


def apply_discount(price, percent):
    return price - price * percent // 100


class TestDiscount(unittest.TestCase):
    def test_discounts(self):
        cases = [(200, 10, 180), (99, 50, 49.5), (100, 0, 100)]
        for price, percent, expected in cases:
            self.assertEqual(
                apply_discount(price, percent),
                expected,
                f"price={price}, percent={percent}",
            )
```

Рядок `AssertionError` з виводу `python3 -m unittest test_msg`:

```text
AssertionError: 50 != 49.5 : price=99, percent=50
```

Без повідомлення ви побачили б лише `50 != 49.5` і мусили б самі з'ясовувати, які вхідні дані дали такий результат. (Помилка — у цілочисельному діленні `//`, яке відкидає дробову частину.)

> **Порада:** у циклі `with self.subTest(price=price, percent=percent):` ще кращий за `msg`: після невдачі цикл продовжується, і кожен невдалий випадок звітується окремо (див. тему Фреймворк unittest).

## `assertNotEqual()`

```python
assertNotEqual(first, second, msg=None)
```

Протилежна перевірка: тест проходить, коли `first != second` істинне. Коли значення рівні, повідомлення має вигляд `first == second`:

```python
import unittest


def new_session_id(previous):
    return previous  # помилка: мав би генерувати новий id


class TestSession(unittest.TestCase):
    def test_new_id_differs(self):
        old = "a1b2"
        self.assertNotEqual(new_session_id(old), old)
```

Рядок `AssertionError` з виводу `python3 -m unittest test_ne`:

```text
AssertionError: 'a1b2' == 'a1b2'
```

Сам по собі `assertNotEqual()` — слабка перевірка: він каже, яким результат *не є*, тож майже будь-яке неправильне значення її пройде. Використовуйте його, коли «інше» і є вимогою (новий ідентифікатор, змінений хеш пароля, перемішаний список), а коли точне очікуване значення відоме, віддавайте перевагу `assertEqual()`.

### Приклад із числами з рухомою комою

Такий тест трапляється часто:

```python
import unittest

from main import add


class TestMain(unittest.TestCase):
    def test_add(self):
        self.assertEqual(add(1, 2), 3)

    def test_add_floats(self):
        self.assertNotEqual(add(0.2, 0.1), 0.3)
```

Результат `python3 -m unittest test_main -v`:

```text
test_add (test_main.TestMain.test_add) ... ok
test_add_floats (test_main.TestMain.test_add_floats) ... ok

----------------------------------------------------------------------
Ran 2 tests in 0.000s

OK
```

Він проходить, бо у двійковій арифметиці з рухомою комою `0.2 + 0.1` дорівнює `0.30000000000000004`. Це гарна ілюстрація похибки округлення, але не корисний тест для `add()`: він пройшов би й тоді, якби `add()` повертала `0` чи `42.0`. Для перевірки дробових результатів використовуйте `assertAlmostEqual()`, про який ідеться в наступній темі.

## Типові помилки

- **Порівнювати числа з рухомою комою через `assertEqual()`.** `self.assertEqual(0.1 * 3, 0.3)` не проходить із повідомленням `0.30000000000000004 != 0.3`. Використовуйте `assertAlmostEqual()`.
- **Порівнювати об'єкти, які не визначають `__eq__`.** За замовчуванням два екземпляри вашого класу рівні, лише якщо це *той самий* об'єкт:

  ```python
  import unittest


  class Point:
      def __init__(self, x, y):
          self.x = x
          self.y = y


  class TestPoint(unittest.TestCase):
      def test_equal_points(self):
          self.assertEqual(Point(1, 2), Point(1, 2))
  ```

  Тест не проходить із повідомленням на кшталт такого (адреси щоразу інші):

  ```text
  AssertionError: <test_point.Point object at 0x1053ca3c0> != <test_point.Point object at 0x1053ee210>
  ```

  Визначте `__eq__` або зробіть клас `@dataclass`, який генерує і `__eq__`, і зрозумілий `__repr__`. З `@dataclass` така сама невдача виглядатиме як `Point(x=1, y=2) != Point(x=1, y=3)`.
- **Очікувати, що `assertEqual()` перевіряє тип.** `assertEqual(result, 1)` проходить для `1`, `1.0` і `True`. Якщо тип є частиною контракту, додайте `assertIsInstance()` або `assertIs(type(result), int)`.
- **Порівнювати списки, коли порядок не важливий.** `assertEqual([3, 1, 2], [1, 2, 3])` не проходить. Якщо порядок справді не має значення, використовуйте `assertCountEqual()`.
- **Міняти порядок аргументів від тесту до тесту.** Diff позначає перший аргумент через `-`, а другий через `+`. Якщо порядок щоразу інший, кожну невдачу доводиться розшифровувати заново.
- **Використовувати старий псевдонім `assertEquals()`.** Його вилучено в Python 3.12, і тепер він спричиняє `AttributeError`.

## Підсумок

- `assertEqual(first, second, msg=None)` проходить, коли `first == second`. Він дотримується правил `==`, тож `1`, `1.0` і `True` рівні між собою.
- Повідомлення про невдачу показують обидва значення через `repr()`, тому плутанина типів, як-от `'12' != 3`, одразу помітна.
- Для двох списків, кортежів, словників, множин чи рядків однакового типу повідомлення містить diff: рядки `-` походять із першого аргументу, рядки `+` — із другого.
- Diff, довші за `maxDiff` (640 символів), приховуються. Встановіть `maxDiff = None`, щоб бачити їх повністю.
- `msg` додається після ` : ` і має пояснювати, який саме випадок перевірявся.
- `assertNotEqual()` проходить, коли `first != second`. Це слабка перевірка, тож використовуйте її, лише коли «інше» і є вимогою.
- Не порівнюйте числа з рухомою комою через `assertEqual()` і додайте своїм класам `__eq__` (або використайте `@dataclass`), перш ніж порівнювати їхні екземпляри.

## Практика

### Вправа 1: Протестуйте `initials()`

Файл `names.py` містить:

```python
def initials(full_name):
    return "".join(part[0].upper() for part in full_name.split())
```

Напишіть `test_names.py` із чотирма тестами: `"olena kovalenko"` дає `"OK"`, `"  taras   shevchenko "` дає `"TS"`, порожній рядок дає порожній рядок, а результат для `"ada lovelace"` (перевірте через `assertNotEqual()`) не є малими літерами `"al"`.

### Вправа 2: Передбачте результат

Які з цих перевірок проходять, а які ні? Запишіть відповіді, потім запустіть перевірки в одному тесті за допомогою `subTest()` і порівняйте.

1. `assertEqual(1, 1.0)`
2. `assertEqual(True, 1)`
3. `assertEqual([1, 2], (1, 2))`
4. `assertEqual({"a": 1, "b": 2}, {"b": 2, "a": 1})`
5. `assertEqual("abc", "abc ")`
6. `assertEqual(0.1 * 3, 0.3)`
7. `assertEqual([3, 1, 2], [1, 2, 3])`

### Вправа 3: Зробіть `Money` порівнюваним

Файл `money.py` містить:

```python
class Money:
    def __init__(self, amount, currency):
        self.amount = amount
        self.currency = currency

    def __add__(self, other):
        return Money(self.amount + other.amount, self.currency)
```

Цей тест не проходить, хоча додавання працює правильно:

```python
import unittest

from money import Money


class TestMoney(unittest.TestCase):
    def test_add(self):
        self.assertEqual(Money(10, "UAH") + Money(5, "UAH"), Money(15, "UAH"))
```

Поясніть чому. Потім змініть `Money` так, щоб тест проходив, а повідомлення про невдачу стали зрозумілими, і додайте тест, який перевіряє, що `Money(10, "UAH")` не дорівнює `Money(10, "EUR")`.

## Розв'язки

### Вправа 1

```python
import unittest

from names import initials


class TestInitials(unittest.TestCase):
    def test_two_words(self):
        self.assertEqual(initials("olena kovalenko"), "OK")

    def test_extra_spaces(self):
        self.assertEqual(initials("  taras   shevchenko "), "TS")

    def test_empty_string(self):
        self.assertEqual(initials(""), "")

    def test_result_is_upper_case(self):
        self.assertNotEqual(initials("ada lovelace"), "al")
```

Результат `python3 -m unittest test_names -v`:

```text
test_empty_string (test_names.TestInitials.test_empty_string) ... ok
test_extra_spaces (test_names.TestInitials.test_extra_spaces) ... ok
test_result_is_upper_case (test_names.TestInitials.test_result_is_upper_case) ... ok
test_two_words (test_names.TestInitials.test_two_words) ... ok

----------------------------------------------------------------------
Ran 4 tests in 0.000s

OK
```

`split()` без аргументів розбиває рядок за будь-якою послідовністю пробільних символів і ігнорує пробіли на початку та в кінці, тож зайві пробіли не створюють порожніх частин. Зверніть увагу, що останній тест слабший за `assertEqual(initials("ada lovelace"), "AL")`, який фіксує точний результат.

### Вправа 2

Перевірки 1, 2 і 4 проходять. Перевірки 3, 5, 6 і 7 не проходять.

```python
import unittest


class TestPredict(unittest.TestCase):
    def test_pairs(self):
        pairs = [
            (1, 1.0),
            (True, 1),
            ([1, 2], (1, 2)),
            ({"a": 1, "b": 2}, {"b": 2, "a": 1}),
            ("abc", "abc "),
            (0.1 * 3, 0.3),
            ([3, 1, 2], [1, 2, 3]),
        ]
        for number, (first, second) in enumerate(pairs, start=1):
            with self.subTest(number=number):
                self.assertEqual(first, second)
```

Заголовки `FAIL` і частини `AssertionError` з виводу `python3 -m unittest test_predict` (трасування скорочено):

```text
FAIL: test_pairs (test_predict.TestPredict.test_pairs) (number=3)
AssertionError: [1, 2] != (1, 2)

FAIL: test_pairs (test_predict.TestPredict.test_pairs) (number=5)
AssertionError: 'abc' != 'abc '
- abc
+ abc 
?    +

FAIL: test_pairs (test_predict.TestPredict.test_pairs) (number=6)
AssertionError: 0.30000000000000004 != 0.3

FAIL: test_pairs (test_predict.TestPredict.test_pairs) (number=7)
AssertionError: Lists differ: [3, 1, 2] != [1, 2, 3]

First differing element 0:
3
1

- [3, 1, 2]
+ [1, 2, 3]
```

- 1 і 2: `==` вважає `1`, `1.0` і `True` рівними.
- 3: список і кортеж ніколи не рівні.
- 4: рівність словників не залежить від порядку додавання.
- 5: пробіл у кінці має значення. Рядок `?` у diff позначає його через `+`.
- 6: похибка округлення чисел з рухомою комою.
- 7: рівність списків залежить від порядку.

### Вправа 3

`Money` не визначає `__eq__`, тому `==` перевіряє ідентичність: два різні об'єкти `Money` ніколи не рівні, хоч би що в них було. Повідомлення про невдачу показує лише `<money.Money object at 0x...>`, бо `__repr__` теж немає.

Незмінюваний (frozen) dataclass розв'язує обидві проблеми. `money.py`:

```python
from dataclasses import dataclass


@dataclass(frozen=True)
class Money:
    amount: int
    currency: str

    def __add__(self, other):
        return Money(self.amount + other.amount, self.currency)
```

`test_money.py`:

```python
import unittest

from money import Money


class TestMoney(unittest.TestCase):
    def test_add(self):
        self.assertEqual(Money(10, "UAH") + Money(5, "UAH"), Money(15, "UAH"))

    def test_currency_matters(self):
        self.assertNotEqual(Money(10, "UAH"), Money(10, "EUR"))
```

Результат `python3 -m unittest test_money -v`:

```text
test_add (test_money.TestMoney.test_add) ... ok
test_currency_matters (test_money.TestMoney.test_currency_matters) ... ok

----------------------------------------------------------------------
Ran 2 tests in 0.000s

OK
```

Якби сума була неправильною (скажімо, очікуване значення було б `Money(16, "UAH")`), невдача тепер виглядала б так: `Money(amount=15, currency='UAH') != Money(amount=16, currency='UAH')`. `frozen=True` не обов'язковий, але пасує об'єкту-значенню: грошова сума не повинна змінюватися після створення.

---

*Джерело: [pythontutorial.net — Python assertEqual()](https://www.pythontutorial.net/python-unit-testing/python-assertequal/). Адаптовано й доповнено для PyJourney.*
