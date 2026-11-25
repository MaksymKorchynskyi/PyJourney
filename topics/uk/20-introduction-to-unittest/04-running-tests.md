# Запуск тестів

Разом із проєктом зростає й набір тестів, і запускати «всі тести щоразу» стає незручно. У цій темі показано, як організувати проєкт, щоб `unittest` знаходив ваші тести, і як запускати саме ті тести, які потрібні: усі, один модуль, один клас, один метод або все, що має відповідну назву.

## Що ви дізнаєтесь

- Як розділити код застосунку й тестовий код по окремих пакетах
- Чому в папці `tests` потрібен `__init__.py` і чому її не варто називати `test`
- Як працює автоматичний пошук тестів і як налаштувати його через `-s`, `-p` і `-t`
- Як запустити окремий модуль, клас чи метод — за назвою через крапку або за шляхом до файлу
- Як відібрати тести за назвою через `-k`
- Корисні параметри: `-v`, `-f`, `-b`, `--locals`, `--durations`, а також що означають коди завершення

## Організація коду

Коли модулів два-три, файли `test_*.py` цілком можна тримати поруч із кодом. У реальних проєктах є пакети, і змішувати тести з кодом застосунку незручно. Зазвичай їх розміщують в окремих папках верхнього рівня:

```text
shapes-project/
├── shapes/
│   ├── __init__.py
│   ├── shape.py
│   ├── circle.py
│   └── square.py
└── tests/
    ├── __init__.py
    ├── test_circle.py
    └── test_square.py
```

`shapes/shape.py` визначає абстрактний базовий клас:

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
            raise ValueError("The radius cannot be negative")
        self._radius = radius

    def area(self) -> float:
        return math.pi * self._radius ** 2
```

`shapes/square.py`:

```python
from .shape import Shape


class Square(Shape):
    def __init__(self, length: float) -> None:
        if length < 0:
            raise ValueError("The length cannot be negative")
        self._length = length

    def area(self) -> float:
        return self._length ** 2
```

Модулі всередині `shapes` імпортують один одного **відносними імпортами** (`from .shape import Shape`), бо вони належать одному пакету. Обидва файли `__init__.py` можуть бути порожніми.

`tests/test_circle.py` імпортує код, що тестується, за назвою пакета:

```python
import math
import unittest

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
```

`tests/test_square.py`:

```python
import unittest

from shapes.shape import Shape
from shapes.square import Square


class TestSquare(unittest.TestCase):
    def test_create_square_negative_length(self):
        with self.assertRaises(ValueError):
            Square(-1)

    def test_square_instance_of_shape(self):
        square = Square(10)
        self.assertIsInstance(square, Shape)

    def test_area(self):
        square = Square(10)
        self.assertEqual(square.area(), 100)
```

`assertIsInstance()` і `assertAlmostEqual()` докладно розглянуто в розділі «Методи-твердження».

### Чому працює `from shapes.circle import ...`

Усі команди нижче виконуються **з кореня проєкту** (`shapes-project/`). `python -m` додає поточну папку на початок `sys.path` — списку місць, де Python шукає модулі для імпорту. Саме тому `import shapes` працює в тестах, хоча самі тести лежать в іншій папці.

### Чому важливий `tests/__init__.py`

Пошук тестів заходить лише в ті підпапки, які є **звичайними пакетами**, тобто містять `__init__.py`. Без нього `python -m unittest` з кореня проєкту мовчки нічого не знаходить:

```text
----------------------------------------------------------------------
Ran 0 tests in 0.000s

NO TESTS RAN
```

> **Зверніть увагу:** починаючи з Python 3.11, пошук тестів у `unittest` більше не підтримує пакети простору імен (namespace packages, тобто папки без `__init__.py`). Багато старих посібників про це не згадують.

### Чому `tests`, а не `test`

У стандартній бібліотеці Python уже є пакет `test` (власні регресійні тести CPython). Локальна папка з такою самою назвою може з ним конфліктувати. Наприклад, якщо у вашій папці `test/` немає `__init__.py`, перемагає стандартний пакет `test`, і `python -m unittest test.test_circle` завершується з `ModuleNotFoundError: No module named 'test.test_circle'`. Назвіть папку `tests` — і проблеми не буде взагалі.

## Запуск усіх тестів

З кореня проєкту:

```bash
python3 -m unittest -v
```

Результат (час щоразу інший):

```text
test_area (tests.test_circle.TestCircle.test_area) ... ok
test_circle_instance_of_shape (tests.test_circle.TestCircle.test_circle_instance_of_shape) ... ok
test_create_circle_negative_radius (tests.test_circle.TestCircle.test_create_circle_negative_radius) ... ok
test_area (tests.test_square.TestSquare.test_area) ... ok
test_create_square_negative_length (tests.test_square.TestSquare.test_create_square_negative_length) ... ok
test_square_instance_of_shape (tests.test_square.TestSquare.test_square_instance_of_shape) ... ok

----------------------------------------------------------------------
Ran 6 tests in 0.000s

OK
```

Виклик `python3 -m unittest` без назв тестів — це скорочення для `python3 -m unittest discover`. Обидві команди дають однаковий результат. Пошук тестів:

1. починається в поточній папці;
2. рекурсивно заходить у кожну підпапку, що є пакетом;
3. імпортує кожен модуль, назва файлу якого відповідає шаблону `test*.py`;
4. збирає всі підкласи `TestCase` та їхні методи `test*`.

Оскільки `tests` — пакет, ідентифікатори тестів починаються з `tests.` (`tests.test_circle.TestCircle.test_area`).

### Налаштування пошуку: `-s`, `-p`, `-t`

Підкоманда `discover` приймає три параметри:

| Параметр | Значення | За замовчуванням |
|---|---|---|
| `-s`, `--start-directory` | Папка, з якої починається пошук | `.` |
| `-p`, `--pattern` | Шаблон назв файлів тестових модулів | `test*.py` |
| `-t`, `--top-level-directory` | Корінь проєкту, від якого будуються назви модулів | початкова папка пошуку |

Наприклад, щоб запустити в `tests` лише тестові файли, назви яких починаються з `test_c`:

```bash
python3 -m unittest discover -s tests -p "test_c*.py" -v
```

Результат:

```text
test_area (test_circle.TestCircle.test_area) ... ok
test_circle_instance_of_shape (test_circle.TestCircle.test_circle_instance_of_shape) ... ok
test_create_circle_negative_radius (test_circle.TestCircle.test_create_circle_negative_radius) ... ok

----------------------------------------------------------------------
Ran 3 tests in 0.000s

OK
```

Зверніть увагу: тепер ідентифікатори мають вигляд `test_circle...`, без `tests.`. З `-s tests` і без `-t` верхнім рівнем вважається сама папка `tests`. Додайте `-t .`, щоб зберегти повні назви пакетів (`tests.test_circle...`). Беріть шаблон у лапки, щоб командна оболонка сама не розгорнула `*`.

## Запуск одного модуля

Передайте назву модуля через крапку:

```bash
python3 -m unittest tests.test_circle -v
```

Результат:

```text
test_area (tests.test_circle.TestCircle.test_area) ... ok
test_circle_instance_of_shape (tests.test_circle.TestCircle.test_circle_instance_of_shape) ... ok
test_create_circle_negative_radius (tests.test_circle.TestCircle.test_create_circle_negative_radius) ... ok

----------------------------------------------------------------------
Ran 3 tests in 0.000s

OK
```

Шлях до файлу теж працює, що зручно з автодоповненням в оболонці: `python3 -m unittest tests/test_circle.py -v` дає точно такий самий результат. `unittest` перетворює шлях на назву модуля `tests.test_circle`. Файл має бути доступним для імпорту з поточної папки.

## Запуск одного класу

Додайте назву класу:

```bash
python3 -m unittest tests.test_square.TestSquare -v
```

Результат:

```text
test_area (tests.test_square.TestSquare.test_area) ... ok
test_create_square_negative_length (tests.test_square.TestSquare.test_create_square_negative_length) ... ok
test_square_instance_of_shape (tests.test_square.TestSquare.test_square_instance_of_shape) ... ok

----------------------------------------------------------------------
Ran 3 tests in 0.000s

OK
```

## Запуск одного тестового методу

Додайте назву методу:

```bash
python3 -m unittest tests.test_circle.TestCircle.test_area -v
```

Результат:

```text
test_area (tests.test_circle.TestCircle.test_area) ... ok

----------------------------------------------------------------------
Ran 1 test in 0.000s

OK
```

Загальна форма — `package.module.Class.method`. В одній команді можна перелічити кілька назв, і вони виконаються в заданому порядку:

```bash
python3 -m unittest tests.test_circle.TestCircle.test_area tests.test_square.TestSquare.test_area -v
```

Результат:

```text
test_area (tests.test_circle.TestCircle.test_area) ... ok
test_area (tests.test_square.TestSquare.test_area) ... ok

----------------------------------------------------------------------
Ran 2 tests in 0.000s

OK
```

## Відбір за назвою через `-k`

`-k` (Python 3.7+) запускає лише тести, **повний ідентифікатор** яких містить заданий підрядок. Повний ідентифікатор включає модуль і клас, тож відбирати можна за будь-якою його частиною:

```bash
python3 -m unittest -k negative -v
```

Результат:

```text
test_create_circle_negative_radius (tests.test_circle.TestCircle.test_create_circle_negative_radius) ... ok
test_create_square_negative_length (tests.test_square.TestSquare.test_create_square_negative_length) ... ok

----------------------------------------------------------------------
Ran 2 tests in 0.000s

OK
```

Інші способи використання:

- `-k TestSquare` запускає всі три тести цього класу, бо назва класу входить в ідентифікатор.
- Шаблон із `*` зіставляється з усім ідентифікатором як шаблон оболонки: `-k "*instance*"` запускає два тести `..._instance_of_shape`.
- Параметр можна повторити, щоб поєднати шаблони: `-k area -k negative` запускає тести, які відповідають **хоча б одному** з них.
- Зіставлення чутливе до регістру.

## Інші корисні параметри

| Параметр | Що робить |
|---|---|
| `-v` / `-q` | Більше / менше виводу |
| `-f`, `--failfast` | Зупинитися на першій невдачі чи помилці |
| `-b`, `--buffer` | Перехоплювати вивід `print()` і показувати його лише для тестів, що не пройшли |
| `-c`, `--catch` | Після Ctrl-C завершити поточний тест і вивести результати, отримані на цей момент |
| `--locals` | Показувати локальні змінні у трасуваннях |
| `--durations N` | Python 3.12+: показати N найповільніших тестів (`0` — усі) |

`--failfast` і `--locals` особливо зручні під час налагодження. Припустімо, у `Circle.area()` закралася помилка: метод повертає `math.pi * self._radius * 2`. Тоді:

```bash
python3 -m unittest --locals tests.test_circle.TestCircle.test_area
```

Результат (шлях скорочено, адреса в пам'яті щоразу інша):

```text
F
======================================================================
FAIL: test_area (tests.test_circle.TestCircle.test_area)
----------------------------------------------------------------------
Traceback (most recent call last):
  File ".../tests/test_circle.py", line 19, in test_area
    self.assertAlmostEqual(circle.area(), math.pi * 2.5 * 2.5)
    ~~~~~~~~~~~~~~~~~~~~~~^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
    circle = <shapes.circle.Circle object at 0x102f65fd0>
    self = <tests.test_circle.TestCircle testMethod=test_area>
AssertionError: 15.707963267948966 != 19.634954084936208 within 7 places (3.9269908169872423 difference)

----------------------------------------------------------------------
Ran 1 test in 0.000s

FAILED (failures=1)
```

### Коди завершення

Код завершення повідомляє скриптам і системам CI, що сталося:

| Код | Значення |
|---|---|
| `0` | Усі вибрані тести пройшли (пропуски й очікувані невдачі не заважають) |
| `1` | Є хоча б одна невдача, помилка або неочікуваний успіх |
| `5` | Не знайдено або не запущено жодного тесту (Python 3.12+) |

У командній оболонці його можна побачити через `echo $?` одразу після команди (у PowerShell — `$LASTEXITCODE`).

## Типові помилки

- **Запуск не з тієї папки.** Усередині `tests/` команда `python3 -m unittest` додає в `sys.path` папку `tests/`, а не корінь проєкту, тож `shapes` не вдається імпортувати:

  ```text
  ImportError: Failed to import test module: test_circle
  ...
  ModuleNotFoundError: No module named 'shapes'
  ```

  Завжди запускайте тести з кореня проєкту.

- **Запуск тестового файлу як скрипта.** `python3 tests/test_circle.py` додає в `sys.path` папку `tests/` (папку скрипта) і падає так само. До того ж він не запускає жодного тесту, якщо у файлі немає виклику `unittest.main()`. Краще використовуйте `python3 -m unittest tests/test_circle.py`.
- **Забутий `tests/__init__.py`.** Тоді пошук із кореня проєкту повідомляє `NO TESTS RAN`.
- **Папка з назвою `test`.** Її може затінити стандартний пакет `test`. Використовуйте `tests`.
- **Назви тестових файлів, що не відповідають шаблону.** `circle_test.py` за замовчуванням ігнорується. Або перейменуйте його на `test_circle.py`, або передайте `-p "*_test.py"`.
- **Друкарські помилки в назвах через крапку.** Хибна назва не призводить до тихого «нічого не запустилося». Вона з'являється як `ERROR` з `ImportError` чи `AttributeError` від `unittest.loader._FailedTest`, часто з підказкою «Did you mean».

## Підсумок

- Тримайте код застосунку (`shapes/`) і тести (`tests/`) в окремих пакетах, обидва з `__init__.py`, і запускайте все з кореня проєкту.
- `python -m unittest` (те саме, що `discover`) знаходить модулі `test*.py` у пакетах під поточною папкою. Налаштовується через `-s`, `-p` і `-t`.
- Модуль, клас чи метод запускайте за назвою через крапку: `tests.test_circle`, `tests.test_circle.TestCircle`, `tests.test_circle.TestCircle.test_area`. Шляхи до файлів, як-от `tests/test_circle.py`, теж працюють.
- `-k pattern` відбирає тести за підрядком або шаблоном їхнього повного ідентифікатора.
- `-v`, `-f`, `-b`, `--locals` і `--durations` змінюють вивід і пришвидшують налагодження.
- Коди завершення: `0` — успіх, `1` — невдачі чи помилки, `5` — жоден тест не запускався.

## Практика

### Вправа 1: Оберіть правильну команду

Для проєкту `shapes-project`, описаного вище, напишіть команду, яка:

1. запускає лише тести класу `TestSquare`;
2. запускає лише тести, назви яких містять `instance`;
3. запускає обидва методи `test_area` (з `TestCircle` і `TestSquare`) і більше нічого, без використання `-k`.

В усіх трьох випадках використовуйте докладний вивід.

### Вправа 2: «No module named 'shapes'»

Колега відкриває термінал, виконує `cd tests`, потім `python3 -m unittest` і отримує `ModuleNotFoundError: No module named 'shapes'` для обох тестових модулів. В усіх інших тести проходять. Поясніть, що не так, і запропонуйте виправлення.

### Вправа 3: Нова фігура з нестандартною назвою файлу

Додайте `shapes/rectangle.py` з класом `Rectangle(width, height)`, який успадковує `Shape`, відхиляє від'ємні сторони через `ValueError` і реалізує `area()`. Тести для нього покладіть у `tests/rectangle_test.py` (три тести: екземпляр `Shape`, площа, від'ємна сторона).

1. Скільки тестів тепер запускає `python3 -m unittest` і чому?
2. Напишіть команду `discover`, яка запускає лише тести прямокутника й зберігає повні ідентифікатори з `tests.`.
3. Яка найпростіша зміна дозволить звичайному `python3 -m unittest` запустити всі дев'ять тестів?

## Розв'язки

### Вправа 1

1. Назва через крапку аж до класу:

   ```bash
   python3 -m unittest tests.test_square.TestSquare -v
   ```

   (`python3 -m unittest -k TestSquare -v` теж підходить.) Результат:

   ```text
   test_area (tests.test_square.TestSquare.test_area) ... ok
   test_create_square_negative_length (tests.test_square.TestSquare.test_create_square_negative_length) ... ok
   test_square_instance_of_shape (tests.test_square.TestSquare.test_square_instance_of_shape) ... ok

   ----------------------------------------------------------------------
   Ran 3 tests in 0.000s

   OK
   ```

2. Фільтр `-k`:

   ```bash
   python3 -m unittest -k instance -v
   ```

   Результат:

   ```text
   test_circle_instance_of_shape (tests.test_circle.TestCircle.test_circle_instance_of_shape) ... ok
   test_square_instance_of_shape (tests.test_square.TestSquare.test_square_instance_of_shape) ... ok

   ----------------------------------------------------------------------
   Ran 2 tests in 0.000s

   OK
   ```

3. Дві назви через крапку в одній команді:

   ```bash
   python3 -m unittest tests.test_circle.TestCircle.test_area tests.test_square.TestSquare.test_area -v
   ```

   Результат:

   ```text
   test_area (tests.test_circle.TestCircle.test_area) ... ok
   test_area (tests.test_square.TestSquare.test_area) ... ok

   ----------------------------------------------------------------------
   Ran 2 tests in 0.000s

   OK
   ```

### Вправа 2

`python -m` додає **поточну папку** на початок `sys.path`. Усередині `tests/` це сама папка `tests/`, тож Python шукає `tests/shapes/`, якої не існує. Пакет `shapes` видно лише з кореня проєкту. Фрагмент виводу невдалого запуску (шляхи скорочено):

```text
ERROR: test_circle (unittest.loader._FailedTest.test_circle)
----------------------------------------------------------------------
ImportError: Failed to import test module: test_circle
Traceback (most recent call last):
  ...
  File ".../tests/test_circle.py", line 4, in <module>
    from shapes.circle import Circle
ModuleNotFoundError: No module named 'shapes'
```

Виправлення: поверніться в корінь проєкту (`cd ..`) і запустіть `python3 -m unittest` там. Не «лагодьте» це маніпуляціями з `sys.path` у тестах.

### Вправа 3

`shapes/rectangle.py`:

```python
from .shape import Shape


class Rectangle(Shape):
    def __init__(self, width: float, height: float) -> None:
        if width < 0 or height < 0:
            raise ValueError("The sides cannot be negative")
        self._width = width
        self._height = height

    def area(self) -> float:
        return self._width * self._height
```

`tests/rectangle_test.py`:

```python
import unittest

from shapes.rectangle import Rectangle
from shapes.shape import Shape


class TestRectangle(unittest.TestCase):
    def test_rectangle_instance_of_shape(self):
        self.assertIsInstance(Rectangle(2, 3), Shape)

    def test_area(self):
        self.assertEqual(Rectangle(2, 3).area(), 6)

    def test_negative_side(self):
        with self.assertRaises(ValueError):
            Rectangle(-2, 3)
```

1. Як і раніше, **6**. `rectangle_test.py` не відповідає шаблону за замовчуванням `test*.py`, тому пошук його не імпортує.
2. Змініть шаблон і залиште корінь проєкту верхнім рівнем:

   ```bash
   python3 -m unittest discover -s tests -t . -p "*_test.py" -v
   ```

   Результат:

   ```text
   test_area (tests.rectangle_test.TestRectangle.test_area) ... ok
   test_negative_side (tests.rectangle_test.TestRectangle.test_negative_side) ... ok
   test_rectangle_instance_of_shape (tests.rectangle_test.TestRectangle.test_rectangle_instance_of_shape) ... ok

   ----------------------------------------------------------------------
   Ran 3 tests in 0.000s

   OK
   ```

3. Перейменуйте файл на `tests/test_rectangle.py`, дотримуючись домовленості проєкту. Результат `python3 -m unittest -v`:

   ```text
   test_area (tests.test_circle.TestCircle.test_area) ... ok
   test_circle_instance_of_shape (tests.test_circle.TestCircle.test_circle_instance_of_shape) ... ok
   test_create_circle_negative_radius (tests.test_circle.TestCircle.test_create_circle_negative_radius) ... ok
   test_area (tests.test_rectangle.TestRectangle.test_area) ... ok
   test_negative_side (tests.test_rectangle.TestRectangle.test_negative_side) ... ok
   test_rectangle_instance_of_shape (tests.test_rectangle.TestRectangle.test_rectangle_instance_of_shape) ... ok
   test_area (tests.test_square.TestSquare.test_area) ... ok
   test_create_square_negative_length (tests.test_square.TestSquare.test_create_square_negative_length) ... ok
   test_square_instance_of_shape (tests.test_square.TestSquare.test_square_instance_of_shape) ... ok

   ----------------------------------------------------------------------
   Ran 9 tests in 0.000s

   OK
   ```

---

*Джерело: [pythontutorial.net — How to Run Unit Tests in Python](https://www.pythontutorial.net/python-unit-testing/python-run-unittest/). Адаптовано й доповнено для PyJourney.*
