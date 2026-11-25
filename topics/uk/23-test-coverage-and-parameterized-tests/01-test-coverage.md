# Покриття тестами

Успішні тести кажуть, що код, який вони запускають, працює. Про код, який вони **ніколи не запускають**, вони не кажуть нічого. **Покриття тестами** (test coverage, або покриття коду, code coverage) показує, які рядки, а за бажання й які гілки, ваш набір тестів справді виконує. Це найшвидший спосіб знайти неперевірений код. У Python стандартним інструментом для цього є сторонній пакет `coverage` (coverage.py).

## Що ви дізнаєтесь

- Що вимірює покриття тестами і як обчислюється відсоток
- Як зібрати дані покриття командою `coverage run -m unittest`
- Як читати `coverage report -m`, зокрема стовпець `Missing`, і як створити HTML-звіт командою `coverage html`
- Чим покриття рядків відрізняється від **покриття гілок** (branch coverage)
- Як налаштувати coverage у `pyproject.toml`, виключити код і зупинити збірку, коли покриття нижче за поріг
- Чому 100% покриття не означає, що тести добрі

## Що вимірює покриття

У найпростішому вигляді покриття — це частка інструкцій (statements), які виконав хоча б один тест:

```text
line coverage = statements executed by the tests / total statements
```

Тобто покриття рядків = кількість інструкцій, виконаних тестами, поділена на загальну кількість інструкцій.

- **Низьке покриття** (скажімо, 5–40%) — чіткий сигнал: великі частини коду ніколи не виконуються, тож помилки в них ніхто не впіймає.
- **Високе покриття** необхідне, але не достатнє. Тест, який викликає функцію й не перевіряє результат, усе одно «покриває» кожен рядок, що виконався. Покриття показує, що було **виконано**, а не що було **перевірено**.

Тож використовуйте покриття як ліхтарик, що освітлює темні кути, а не як оцінку якості тестів.

## Встановлення coverage.py

`coverage` не входить до стандартної бібліотеки. Встановіть його у віртуальне середовище проєкту:

```bash
python -m pip install coverage
```

Після цього з'явиться команда `coverage`. `python -m coverage ...` робить те саме і стає в пригоді, коли скрипта `coverage` немає у `PATH`.

## Приклад проєкту

Приклади використовують таку структуру (тека проєкту називається `python-unit-testing`):

```text
python-unit-testing
├── shapes
│   ├── circle.py
│   ├── shape.py
│   └── square.py
└── test
    ├── __init__.py
    ├── test_circle.py
    └── test_square.py
```

`shapes/shape.py`:

```python
from abc import ABC, abstractmethod


class Shape(ABC):
    @abstractmethod
    def area(self) -> float:
        pass
```

`shapes/circle.py`:

```python
import math
from .shape import Shape


class Circle(Shape):
    def __init__(self, radius: float) -> None:
        if radius < 0:
            raise ValueError('The radius cannot be negative')

        self._radius = radius

    def area(self) -> float:
        return math.pi * math.pow(self._radius, 2)
```

`shapes/square.py`:

```python
import math
from .shape import Shape


class Square(Shape):
    def __init__(self, length: float) -> None:
        if length < 0:
            raise ValueError('The length cannot be negative')
        self._length = length

    def area(self) -> float:
        return math.pow(self._length, 2)
```

`test/test_circle.py`:

```python
import unittest
import math

from shapes.circle import Circle
from shapes.shape import Shape


class TestCircle(unittest.TestCase):
    def test_circle_instance_of_shape(self):
        circle = Circle(10)
        self.assertIsInstance(circle, Shape)

    def test_create_circle_negative_radius(self):
        with self.assertRaises(ValueError):
            circle = Circle(-1)

    def test_area(self):
        circle = Circle(2.5)
        self.assertAlmostEqual(circle.area(), math.pi * 2.5*2.5)
```

`test/test_square.py`:

```python
import unittest

from shapes.square import Square
from shapes.shape import Shape


class TestSquare(unittest.TestCase):

    def test_create_square_negative_length(self):
        with self.assertRaises(ValueError):
            square = Square(-1)

    def test_square_instance_of_shape(self):
        square = Square(10)
        self.assertIsInstance(square, Shape)

    def test_area(self):
        square = Square(10)
        area = square.area()
        self.assertEqual(area, 100)
```

`test/__init__.py` порожній. Він робить `test` пакетом, тож `python -m unittest`, запущений із теки проєкту, знаходить тести. У `shapes` немає `__init__.py`, але імпорт усе одно працює, бо це пакет простору імен (namespace package). Проте частіше додають порожній `__init__.py`.

## Крок 1: збираємо дані покриття

Запустіть набір тестів **під coverage** з теки проєкту:

```bash
coverage run -m unittest
```

Результат (час відрізняється):

```text
......
----------------------------------------------------------------------
Ran 6 tests in 0.000s

OK
```

`coverage run` запускає Python з увімкненим вимірюванням, тому все після `run` — це саме те, що ви запустили б зазвичай: `-m unittest` означає «запустити модуль `unittest`», який знаходить і виконує всі тести. Тести поводяться як завжди. Крім того, coverage записує виміряні дані у файл `.coverage` у поточній теці.

## Крок 2: виводимо звіт

```bash
coverage report
```

Результат:

```text
Name                  Stmts   Miss  Cover
-----------------------------------------
shapes/circle.py          9      0   100%
shapes/shape.py           5      1    80%
shapes/square.py          9      0   100%
test/__init__.py          0      0   100%
test/test_circle.py      14      0   100%
test/test_square.py      14      0   100%
-----------------------------------------
TOTAL                    51      1    98%
```

(У Windows шляхи виводяться з `\`.)

Стовпці:

| Стовпець | Значення |
|---|---|
| `Stmts` | Кількість виконуваних інструкцій у файлі |
| `Miss` | Інструкції, які жодного разу не виконалися |
| `Cover` | `(Stmts - Miss) / Stmts` у відсотках |

У `shape.py` щось пропущено. Додайте `-m` (`--show-missing`), щоб побачити, **які саме** рядки:

```bash
coverage report -m
```

Результат:

```text
Name                  Stmts   Miss  Cover   Missing
---------------------------------------------------
shapes/circle.py          9      0   100%
shapes/shape.py           5      1    80%   7
shapes/square.py          9      0   100%
test/__init__.py          0      0   100%
test/test_circle.py      14      0   100%
test/test_square.py      14      0   100%
---------------------------------------------------
TOTAL                    51      1    98%
```

Рядок 7 у `shape.py` — це `pass` усередині абстрактного методу. Це тіло ніколи не виконується: `Circle` і `Square` перевизначають `area()`, а створити екземпляр абстрактного класу не можна. Звіт правильний, але цей «пропущений» рядок не варто тестувати.

Ідіоматичне тіло абстрактного методу — `...` замість `pass`:

```python
from abc import ABC, abstractmethod


class Shape(ABC):
    @abstractmethod
    def area(self) -> float:
        ...
```

Починаючи з версії 7.10, coverage.py за замовчуванням виключає тіла, що складаються лише з `...`. Вбудований шаблон захоплює рядок `def` разом із тілом `...`, тому весь метод (декоратор, рядок `def` і тіло) випадає з підрахунку. Отже, після цієї зміни та нового `coverage run -m unittest` команда `coverage report -m` покаже:

```text
Name                  Stmts   Miss  Cover   Missing
---------------------------------------------------
shapes/circle.py          9      0   100%
shapes/shape.py           2      0   100%
shapes/square.py          9      0   100%
test/__init__.py          0      0   100%
test/test_circle.py      14      0   100%
test/test_square.py      14      0   100%
---------------------------------------------------
TOTAL                    48      0   100%
```

> **Зверніть увагу:** точна кількість інструкцій залежить від версій coverage.py і Python. В оригінальному посібнику, зробленому на старіших версіях, `shape.py` мав 4 інструкції і 100% навіть із `pass`. Результати в цій темі отримано з coverage.py 7.17 на Python 3.14.

## Крок 3: HTML-звіт

Звіт у терміналі показує номери рядків. HTML-звіт показує ваш **вихідний код**, де кожен рядок підсвічено кольором: зелений — виконаний, червоний — пропущений, а (з покриттям гілок) жовтий — виконаний частково.

```bash
coverage html
```

Результат:

```text
Wrote HTML report to htmlcov/index.html
```

Відкрийте `htmlcov/index.html` у браузері. На головній сторінці перелічено всі файли з відсотками, а клік на файл відкриває його вихідний код із позначками. Тека `htmlcov` і файл даних `.coverage` генеруються автоматично, тож додайте обидва до `.gitignore`.

## Пошук неперевіреного коду

Тепер додайте до `Circle` метод `perimeter()`, не написавши для нього тесту:

```python
import math
from .shape import Shape


class Circle(Shape):
    def __init__(self, radius: float) -> None:
        if radius < 0:
            raise ValueError('The radius cannot be negative')

        self._radius = radius

    def area(self) -> float:
        return math.pi * math.pow(self._radius, 2)

    def perimeter(self) -> float:
        return 2 * math.pi * self._radius
```

Зберіть дані ще раз і виведіть звіт:

```bash
coverage run -m unittest
coverage report -m
```

Результат (вивід тестів такий самий, як раніше, тому його пропущено):

```text
Name                  Stmts   Miss  Cover   Missing
---------------------------------------------------
shapes/circle.py         11      1    91%   16
shapes/shape.py           2      0   100%
shapes/square.py          9      0   100%
test/__init__.py          0      0   100%
test/test_circle.py      14      0   100%
test/test_square.py      14      0   100%
---------------------------------------------------
TOTAL                    50      1    98%
```

Тепер у `circle.py` 11 інструкцій. Тести виконують 10 із них, тож покриття файлу — 10 / 11, приблизно 91%. Рядок 16 — це тіло `perimeter()`. Сам рядок `def perimeter` (рядок 15) вважається виконаним, бо він виконується під час створення класу, тобто під час імпорту. Тіло ж виконується лише тоді, коли метод викликають.

## Вимірюємо лише власний код

За замовчуванням coverage вимірює кожен файл, який бачить під час виконання, окрім стандартної бібліотеки та встановлених пакетів. Саме тому тестові файли потрапляють у звіт і підвищують загальний відсоток: тестовий код майже завжди виконується повністю. Щоб обмежити вимірювання своїм пакетом, використайте `--source`:

```bash
coverage run --source=shapes -m unittest
coverage report -m
```

Результат (вивід тестів пропущено):

```text
Name               Stmts   Miss  Cover   Missing
------------------------------------------------
shapes/circle.py      11      1    91%   16
shapes/shape.py        2      0   100%
shapes/square.py       9      0   100%
------------------------------------------------
TOTAL                 22      1    95%
```

Загальне покриття впало з 98% до 95%, і це чесніше число.

## Покриття гілок

Покриття рядків має сліпу зону. Розгляньмо `pricing.py`:

```python
def final_price(price, is_member):
    if is_member:
        price = price * 0.9
    return round(price, 2)
```

і тест, який перевіряє лише учасників програми лояльності:

```python
import unittest

from pricing import final_price


class TestFinalPrice(unittest.TestCase):
    def test_member_gets_discount(self):
        self.assertEqual(final_price(100, is_member=True), 90.0)
```

```bash
coverage run --source=pricing -m unittest
coverage report -m
```

Результат (вивід тестів пропущено):

```text
Name         Stmts   Miss  Cover   Missing
------------------------------------------
pricing.py       4      0   100%
------------------------------------------
TOTAL            4      0   100%
```

Кожен рядок виконався, а проте шлях «не учасник» (умова `if` хибна, і виконання переходить одразу до `return`) не перевірено. **Покриття гілок** (branch coverage) відстежує кожен можливий перехід. Увімкніть його параметром `--branch`:

```bash
coverage run --branch --source=pricing -m unittest
coverage report -m
```

Результат (вивід тестів пропущено):

```text
Name         Stmts   Miss Branch BrPart  Cover   Missing
--------------------------------------------------------
pricing.py       4      0      2      1    83%   2->4
--------------------------------------------------------
TOTAL            4      0      2      1    83%
```

- `Branch`: кількість можливих напрямків переходу (`if` у рядку 2 може перейти до рядка 3 або до рядка 4).
- `BrPart`: рядки з **частковим** розгалуженням, де було пройдено лише частину напрямків.
- `2->4` у `Missing`: перехід із рядка 2 до рядка 4 (умова хибна) жодного разу не відбувся.
- `Cover` тепер рахує інструкції та гілки разом: (4 + 1) / (4 + 2) = 5 / 6, приблизно 83%.

Покриття гілок суворіше й корисніше. Його варто вмикати в кожному проєкті.

## Налаштування coverage

Щоразу вводити параметри втомливо. coverage.py читає налаштування з `pyproject.toml` (або `.coveragerc`, `setup.cfg`, `tox.ini`):

```toml
[tool.coverage.run]
source = ["shapes"]
branch = true

[tool.coverage.report]
show_missing = true
fail_under = 100
```

Тепер звичайний `coverage run -m unittest` вимірює лише `shapes` із покриттям гілок, а `coverage report` показує пропущені рядки. `fail_under` змушує `coverage report` завершуватися з кодом `2`, коли загальне покриття нижче за поріг, і це зупиняє збірку в CI:

```bash
coverage run -m unittest
coverage report
echo "exit code: $?"
```

Результат (вивід тестів пропущено):

```text
Name               Stmts   Miss Branch BrPart  Cover   Missing
--------------------------------------------------------------
shapes/circle.py      11      1      2      0    92%   16
shapes/shape.py        2      0      0      0   100%
shapes/square.py       9      0      2      0   100%
--------------------------------------------------------------
TOTAL                 22      1      4      0    96%
Coverage failure: total of 96 is less than fail-under=100
exit code: 2
```

Тепер `circle.py` має 92%: (10 + 2) / (11 + 2), бо обидві його гілки (`radius < 0` істинне і хибне) покрито.

### Навмисне виключення коду

Деякий код не варто тестувати або його неможливо запустити в тестах: допоміжна функція для налагодження, заглушка, що генерує `NotImplementedError`, точка входу скрипта. Візьмімо `tools.py`:

```python
def double(x):
    return x * 2


def debug_dump(shape):  # pragma: no cover
    print(vars(shape))


def later():
    raise NotImplementedError


if __name__ == '__main__':
    print(double(21))
```

і тест, який перевіряє лише `double()`:

```python
import unittest

from tools import double


class TestTools(unittest.TestCase):
    def test_double(self):
        self.assertEqual(double(21), 42)
```

`coverage run --source=tools -m unittest` і `coverage report -m` дають:

```text
Name       Stmts   Miss  Cover   Missing
----------------------------------------
tools.py       6      2    67%   10, 14
----------------------------------------
TOTAL          6      2    67%
```

`debug_dump()` узагалі не враховано: коментар `# pragma: no cover` у рядку, що відкриває блок (`def`, `class`, `if`), виключає весь блок. Рядки 10 і 14 і далі в звіті. Для повторюваних шаблонів на кшталт цих краще додати регулярні вирази в конфігурацію, ніж розставляти коментарі:

```toml
[tool.coverage.report]
exclude_also = [
    'if __name__ == .__main__.:',
    'raise NotImplementedError',
]
```

Виключення застосовуються під час побудови звіту, тож лише `coverage report -m` (без нового запуску) тепер показує:

```text
Name       Stmts   Miss  Cover   Missing
----------------------------------------
tools.py       3      0   100%
----------------------------------------
TOTAL          3      0   100%
```

`exclude_also` доповнює вбудовані виключення (коментар pragma, рядки лише з `...` та блоки `if TYPE_CHECKING:`), а не замінює їх. Користуйтеся виключеннями ощадливо: кожен виключений рядок — це рядок, який ніхто не перевіряє.

### Інші корисні команди

| Команда | Що робить |
|---|---|
| `coverage erase` | Видаляє зібрані дані (`.coverage`) |
| `coverage report --skip-covered` | Приховує файли зі 100% покриттям |
| `coverage html` | Записує HTML-звіт із позначками в `htmlcov/` |
| `coverage xml` / `coverage json` | Машиночитні звіти для CI-сервісів |
| `coverage run -m unittest test.test_circle` | Вимірює лише один тестовий модуль |

## Покриття — це не якість

Ось навмисне поганий тест для `pricing.py` з помилкою:

```python
def final_price(price, is_member):
    if is_member:
        price = price * 0.09  # помилка: має бути 0.9
    return round(price, 2)
```

```python
import unittest

from pricing import final_price


class TestFinalPrice(unittest.TestCase):
    def test_runs(self):
        final_price(100, is_member=True)
        final_price(100, is_member=False)
```

Результат `coverage run --branch --source=pricing -m unittest` і потім `coverage report -m` (час відрізняється):

```text
.
----------------------------------------------------------------------
Ran 1 test in 0.000s

OK
Name         Stmts   Miss Branch BrPart  Cover   Missing
--------------------------------------------------------
pricing.py       4      0      2      0   100%
--------------------------------------------------------
TOTAL            4      0      2      0   100%
```

100% покриття рядків **і** гілок, зелений запуск тестів і помилка, через яку учасники платять 9% ціни. У тесті немає жодного assert, тож він нічого не перевіряє. Покриття підказує, що тестувати далі, але правильність коду перевіряють лише твердження (assertions).

## Типові помилки

- **Запускати `coverage report` без попереднього `coverage run`** (або після зміни коду без повторного запуску). Звіт завжди описує останні зібрані дані.
- **Запускати тести через `python -m unittest` і чекати даних покриття.** Вимірює щось лише `coverage run -m unittest`.
- **Враховувати тестові файли в загальному відсотку.** Без `--source` (або `source = [...]` у конфігурації) тестові модулі завищують відсоток. Вимірюйте код, який тестуєте.
- **Гнатися за 100% будь-якою ціною.** Тести, написані лише для того, щоб «зачепити» рядки (без assert, з моками всього підряд), піднімають число й знецінюють набір тестів. Пишіть змістовні тести важливої поведінки, а покриття хай показує, що лишилося.
- **Ігнорувати покриття гілок.** Покриття рядків не помічає неперевірених шляхів `if`/`else`. Увімкніть `branch = true`.
- **Додавати в коміт `.coverage` і `htmlcov/`.** Це згенеровані файли, їхнє місце в `.gitignore`.

## Підсумок

- Покриття тестами показує, які інструкції (і гілки) виконують тести. Воно знаходить неперевірений код, але не доводить, що тести добрі.
- Встановіть `coverage` (сторонній пакет), запустіть тести командою `coverage run -m unittest`, а результати перегляньте через `coverage report -m`. Стовпець `Missing` перелічує невиконані рядки.
- `coverage html` записує кольоровий звіт із позначками в `htmlcov/index.html`.
- `--source=<package>` обмежує вимірювання вашим кодом, а `--branch` виявляє неперевірені шляхи `if`/`else` (у `Missing` вони мають вигляд `line->line`).
- Налаштування зберігайте в `pyproject.toml` у розділах `[tool.coverage.run]` і `[tool.coverage.report]`. `fail_under` перетворює падіння покриття на невдалу збірку.
- Виключайте код, який неможливо протестувати, через `# pragma: no cover` або `exclude_also`, але ощадливо.

## Практика

### Вправа 1: Знову 100%

У проєкті shapes метод `perimeter()` не протестовано. Додайте метод `test_perimeter` до `TestCircle` і переконайтеся за допомогою `coverage run --source=shapes -m unittest` та `coverage report -m`, що всі файли знову мають 100%.

### Вправа 2: Закрийте прогалину в гілках

Для `pricing.py` (правильна версія з `0.9`) і єдиного тесту для учасника запустіть покриття гілок і знайдіть пропущену гілку. Додайте тест, що її покриває, і покажіть, що покриття гілок досягає 100%.

### Вправа 3: Поріг покриття

Створіть `pyproject.toml` для проєкту shapes, який вимірює лише `shapes`, вмикає покриття гілок, показує пропущені рядки й завершується невдачею, якщо покриття нижче 100%. Покажіть код завершення `coverage report` до і після додавання тесту для периметра з вправи 1.

## Розв'язки

### Вправа 1

`test/test_circle.py`:

```python
import unittest
import math

from shapes.circle import Circle
from shapes.shape import Shape


class TestCircle(unittest.TestCase):
    def test_circle_instance_of_shape(self):
        circle = Circle(10)
        self.assertIsInstance(circle, Shape)

    def test_create_circle_negative_radius(self):
        with self.assertRaises(ValueError):
            Circle(-1)

    def test_area(self):
        circle = Circle(2.5)
        self.assertAlmostEqual(circle.area(), math.pi * 2.5 * 2.5)

    def test_perimeter(self):
        circle = Circle(2.5)
        self.assertAlmostEqual(circle.perimeter(), 2 * math.pi * 2.5)
```

```bash
coverage run --source=shapes -m unittest
coverage report -m
```

Результат (час відрізняється):

```text
.......
----------------------------------------------------------------------
Ran 7 tests in 0.000s

OK
Name               Stmts   Miss  Cover   Missing
------------------------------------------------
shapes/circle.py      11      0   100%
shapes/shape.py        2      0   100%
shapes/square.py       9      0   100%
------------------------------------------------
TOTAL                 22      0   100%
```

`assertAlmostEqual()` — правильна перевірка для результатів із рухомою комою, як-от `2 * math.pi * 2.5`.

### Вправа 2

`coverage run --branch --source=pricing -m unittest` лише з тестом для учасника показує пропущений перехід `2->4`: умова `if is_member:` жодного разу не була хибною. Додайте тест для звичайного покупця:

```python
import unittest

from pricing import final_price


class TestFinalPrice(unittest.TestCase):
    def test_member_gets_discount(self):
        self.assertEqual(final_price(100, is_member=True), 90.0)

    def test_non_member_pays_full_price(self):
        self.assertEqual(final_price(100, is_member=False), 100)
```

```bash
coverage run --branch --source=pricing -m unittest -v
coverage report -m
```

Результат (час відрізняється):

```text
test_member_gets_discount (test_pricing.TestFinalPrice.test_member_gets_discount) ... ok
test_non_member_pays_full_price (test_pricing.TestFinalPrice.test_non_member_pays_full_price) ... ok

----------------------------------------------------------------------
Ran 2 tests in 0.000s

OK
Name         Stmts   Miss Branch BrPart  Cover   Missing
--------------------------------------------------------
pricing.py       4      0      2      0   100%
--------------------------------------------------------
TOTAL            4      0      2      0   100%
```

### Вправа 3

`pyproject.toml` у теці проєкту:

```toml
[tool.coverage.run]
source = ["shapes"]
branch = true

[tool.coverage.report]
show_missing = true
fail_under = 100
```

До тесту для периметра:

```bash
coverage run -m unittest
coverage report
echo "exit code: $?"
```

```text
Name               Stmts   Miss Branch BrPart  Cover   Missing
--------------------------------------------------------------
shapes/circle.py      11      1      2      0    92%   16
shapes/shape.py        2      0      0      0   100%
shapes/square.py       9      0      2      0   100%
--------------------------------------------------------------
TOTAL                 22      1      4      0    96%
Coverage failure: total of 96 is less than fail-under=100
exit code: 2
```

Після додавання `test_perimeter` і запуску тих самих трьох команд:

```text
Name               Stmts   Miss Branch BrPart  Cover   Missing
--------------------------------------------------------------
shapes/circle.py      11      0      2      0   100%
shapes/shape.py        2      0      0      0   100%
shapes/square.py       9      0      2      0   100%
--------------------------------------------------------------
TOTAL                 22      0      4      0   100%
exit code: 0
```

CI-конвеєр, що виконує ці команди, впаде, щойно хтось додасть код без тестів. У реальних проєктах трохи нижчий поріг (наприклад, 90%) часто практичніший за 100%.

---

*Джерело: [pythontutorial.net — Python unittest Coverage](https://www.pythontutorial.net/python-unit-testing/python-unittest-coverage/). Адаптовано й доповнено для PyJourney.*
