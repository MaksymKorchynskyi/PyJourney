# Фреймворк unittest

**Модульний тест** (unit test) — це невелика автоматична перевірка того, що окрема частина коду робить саме те, що обіцяє. У стандартній бібліотеці Python є повноцінний фреймворк для тестування, модуль `unittest`, тож почати писати тести можна без встановлення будь-чого. Тести рано виявляють помилки, захищають від регресій під час змін у коді й документують, як мають поводитися ваші функції.

## Що ви дізнаєтесь

- Що таке модульний тест і чим він відрізняється від інтеграційного
- Термінологію xUnit, на якій побудовано `unittest`: тестовий випадок, тестове оточення, твердження, набір тестів, засіб запуску
- Як написати тестовий клас на основі `unittest.TestCase` і тестові методи
- Як запускати тести через `unittest.main()` і через `python -m unittest` та як читати результат
- Чим **невдача** (`F`) відрізняється від **помилки** (`E`)
- Як перевірити, що код генерує правильний виняток, за допомогою `assertRaises()` і `subTest()`

## Що таке модульний тест

Модульний тест — це автоматичний тест, який:

- перевіряє невеликий фрагмент коду, так звану **одиницю** (unit), наприклад одну функцію чи один метод;
- виконується **швидко**, за мілісекунди, тож сотні таких тестів можна запускати після кожної зміни;
- виконується **ізольовано**: не залежить від інших тестів, від порядку їх запуску, від мережі, справжньої бази даних чи файлів, які хтось залишив після себе.

Ідея в тому, щоб перевірити кожну «цеглинку» програми окремо. Якщо всі цеглинки працюють, збій деінде легше локалізувати. Цим модульні тести відрізняються від **інтеграційних**, які перевіряють, що кілька частин працюють *разом* (наприклад, ваш код і справжня база даних).

Модульні тести окупаються трьома способами:

- **Вони знаходять помилки**, поки код ще свіжий у пам'яті.
- **Вони роблять рефакторинг безпечним.** Можна перебудувати код і одразу побачити, чи змінилася його поведінка.
- **Вони підштовхують до кращого дизайну.** Код, який важко тестувати (величезні функції, прихований глобальний стан), зазвичай важко й підтримувати.

## Термінологія xUnit

`unittest` наслідує архітектуру **xUnit**, що бере початок від SUnit у Smalltalk та JUnit у Java. Ті самі терміни трапляються в засобах тестування для більшості мов:

| Термін | Що це означає в `unittest` |
|---|---|
| Система, що тестується (system under test) | Функція, клас або метод, який ви перевіряєте |
| Тестовий випадок (test case) | Клас, що успадковує `unittest.TestCase`. Кожен його метод `test*` — окремий тест |
| Тестове оточення (fixture) | Підготовка перед тестом і прибирання після нього, наприклад `setUp()` і `tearDown()` |
| Твердження (assertion) | Метод на кшталт `assertEqual()`, який перевіряє результат і позначає тест як невдалий, якщо результат хибний |
| Набір тестів (test suite) | Сукупність тестів, які запускаються разом |
| Засіб запуску тестів (test runner) | Програма, що запускає набір і звітує про результати |

Тестовому оточенню, численним методам-твердженням і способам запуску набору присвячено окремі теми далі в цьому розділі.

## Перший тест

Припустімо, у файлі `square.py` є клас із методом `area()`:

```python
class Square:
    def __init__(self, length):
        self.length = length

    def area(self):
        return self.length * self.length
```

Тести розміщують в окремому файлі `test_square.py` у тій самій папці:

```python
import unittest

from square import Square


class TestSquare(unittest.TestCase):
    def test_area(self):
        square = Square(10)
        area = square.area()
        self.assertEqual(area, 100)


if __name__ == "__main__":
    unittest.main()
```

Що тут відбувається:

- `class TestSquare(unittest.TestCase)` створює **тестовий випадок**. Успадкування від `TestCase` дає доступ до методів-тверджень і дозволяє засобу запуску знайти клас.
- Кожен метод, назва якого **починається з `test`**, — окремий тест. Інші методи є звичайними допоміжними функціями й тестами не вважаються.
- `test_area()` побудовано за поширеним шаблоном **Arrange, Act, Assert** («підготуй, виконай, перевір»): створюємо об'єкт (`Square(10)`), викликаємо код, що тестується (`area()`), і перевіряємо результат (`assertEqual(area, 100)`).
- `assertEqual(area, 100)` проходить, якщо `area == 100`. Інакше він генерує `AssertionError` з повідомленням, де видно обидва значення, і тест вважається невдалим.
- `unittest.main()` збирає тести цього модуля, запускає їх і виводить звіт. Умова `if __name__ == "__main__":` гарантує, що це станеться лише під час прямого запуску файлу, а не під час імпорту.

## Запуск тестів

### Прямий запуск файлу

З папки, де лежать обидва файли:

```bash
python3 test_square.py
```

Результат (час у рядку `Ran` щоразу інший):

```text
.
----------------------------------------------------------------------
Ran 1 test in 0.000s

OK
```

Кожен символ у першому рядку відповідає одному тесту: `.` означає, що тест пройшов. У Windows команда зазвичай `python` або `py`, а не `python3`.

Щоб отримати окремий рядок для кожного тесту, передайте `verbosity=2`:

```python
if __name__ == "__main__":
    unittest.main(verbosity=2)
```

Результат:

```text
test_area (__main__.TestSquare.test_area) ... ok

----------------------------------------------------------------------
Ran 1 test in 0.000s

OK
```

У дужках — повний ідентифікатор тесту: модуль, клас і метод. Коли файл запускають напряму, його модуль називається `__main__`.

> **Зверніть увагу:** починаючи з Python 3.11 докладний рядок показує повний ідентифікатор (`TestSquare.test_area`). Старіші версії Python і багато старих посібників показують лише `(test_square.TestSquare)`.

### Запуск через `python -m unittest`

Блок `unittest.main()` зовсім не обов'язковий. Модуль `unittest` має інтерфейс командного рядка:

```bash
python3 -m unittest
python3 -m unittest -v
```

Результат другої команди:

```text
test_area (test_square.TestSquare.test_area) ... ok

----------------------------------------------------------------------
Ran 1 test in 0.000s

OK
```

Без аргументів `python -m unittest` виконує **автоматичний пошук тестів** (test discovery) у поточній папці:

- імпортує кожен файл, назва якого відповідає шаблону `test*.py` (тож `test_square.py` буде знайдено, а `square_test.py` — ні);
- у цих модулях збирає **всі підкласи `TestCase`**, хоч би як вони називалися;
- у кожному класі запускає методи, назви яких починаються з `test`.

`-v` (verbose, «докладно») дає такі самі рядки для кожного тесту, як і `verbosity=2`. Прапорець `-m` каже Python запустити бібліотечний модуль як скрипт, у нашому випадку модуль `unittest`. Інші способи вибрати, які тести запускати, описано в наступних темах.

> **Порада:** у реальних проєктах тести частіше запускають саме через `python -m unittest`. Так виконуються всі тестові файли разом, а блок `if __name__ == "__main__":` стає необов'язковим.

## Як читати результат: невдачі та помилки

Додамо два зламані тести, щоб побачити, як виглядають проблеми. В одному очікуване значення хибне, інший передає в `Square` рядок:

```python
import unittest

from square import Square


class TestSquare(unittest.TestCase):
    def test_area(self):
        square = Square(10)
        self.assertEqual(square.area(), 100)

    def test_area_of_unit_square(self):
        # очікуване значення навмисно неправильне
        self.assertEqual(Square(1).area(), 2)

    def test_area_with_text(self):
        self.assertEqual(Square("3").area(), 9)
```

Запуск:

```bash
python3 -m unittest
```

Результат (шляхи скорочено):

```text
.FE
======================================================================
ERROR: test_area_with_text (test_square.TestSquare.test_area_with_text)
----------------------------------------------------------------------
Traceback (most recent call last):
  File ".../test_square.py", line 16, in test_area_with_text
    self.assertEqual(Square("3").area(), 9)
                     ~~~~~~~~~~~~~~~~^^
  File ".../square.py", line 6, in area
    return self.length * self.length
           ~~~~~~~~~~~~^~~~~~~~~~~~~
TypeError: can't multiply sequence by non-int of type 'str'

======================================================================
FAIL: test_area_of_unit_square (test_square.TestSquare.test_area_of_unit_square)
----------------------------------------------------------------------
Traceback (most recent call last):
  File ".../test_square.py", line 13, in test_area_of_unit_square
    self.assertEqual(Square(1).area(), 2)
    ~~~~~~~~~~~~~~~~^^^^^^^^^^^^^^^^^^^^^
AssertionError: 1 != 2

----------------------------------------------------------------------
Ran 3 tests in 0.001s

FAILED (failures=1, errors=1)
```

У рядку стану `.FE` три різні символи:

| Символ | Слово в докладному режимі | Значення |
|---|---|---|
| `.` | `ok` | Тест пройшов |
| `F` | `FAIL` | Твердження не справдилося: код виконався, але результат неправильний |
| `E` | `ERROR` | Тест згенерував неочікуваний виняток (не `AssertionError`) |
| `s` | `skipped` | Тест пропущено (про це йдеться в окремій темі) |

Ця різниця допомагає під час налагодження. **Невдача** (failure) означає «відповідь неправильна». **Помилка** (error) зазвичай означає «код (або сам тест) аварійно завершився». Якщо хоч один тест зазнав невдачі чи помилки, команда завершується з кодом `1`, і системи CI вважають збірку невдалою. Повністю «зелений» запуск завершується з кодом `0`.

Зверніть увагу: тести виводяться в **алфавітному порядку** назв методів, а не в порядку їх появи у файлі. Тести не повинні залежати від порядку виконання.

## Перевірка очікуваних винятків

Хороший код гучно відкидає некоректні дані. Припустімо, `Square` має приймати лише числа, а для будь-чого іншого генерувати `TypeError`. Такий тест пишуть за допомогою `assertRaises()` як менеджера контексту:

```python
import unittest

from square import Square


class TestSquare(unittest.TestCase):
    def test_area(self):
        square = Square(10)
        area = square.area()
        self.assertEqual(area, 100)

    def test_length_with_wrong_type(self):
        with self.assertRaises(TypeError):
            Square("10")
```

Тест проходить лише тоді, коли код усередині блоку `with` генерує `TypeError` (або його підклас). Поточний `Square` приймає що завгодно, тож тест не проходить:

```bash
python3 -m unittest -v
```

Результат:

```text
test_area (test_square.TestSquare.test_area) ... ok
test_length_with_wrong_type (test_square.TestSquare.test_length_with_wrong_type) ... FAIL

======================================================================
FAIL: test_length_with_wrong_type (test_square.TestSquare.test_length_with_wrong_type)
----------------------------------------------------------------------
Traceback (most recent call last):
  File ".../test_square.py", line 13, in test_length_with_wrong_type
    with self.assertRaises(TypeError):
         ~~~~~~~~~~~~~~~~~^^^^^^^^^^^
AssertionError: TypeError not raised

----------------------------------------------------------------------
Ran 2 tests in 0.000s

FAILED (failures=1)
```

Спершу написати тест і побачити, що він не проходить, — це суть **розробки через тестування** (test-driven development, TDD): невдалий тест доводить, що він справді щось перевіряє. Тепер зробимо так, щоб тест проходив, додавши перевірку аргументу в `square.py`:

```python
class Square:
    def __init__(self, length):
        if isinstance(length, bool) or not isinstance(length, (int, float)):
            raise TypeError("Length must be an int or float")
        self.length = length

    def area(self):
        return self.length * self.length
```

`isinstance()` приймає й підкласи `int` та `float`, що зазвичай і потрібно. `bool` відкидаємо явно, бо `True` і `False` формально є цілими числами, а `Square(True)` не має сенсу.

Результат `python3 -m unittest -v`:

```text
test_area (test_square.TestSquare.test_area) ... ok
test_length_with_wrong_type (test_square.TestSquare.test_length_with_wrong_type) ... ok

----------------------------------------------------------------------
Ran 2 tests in 0.000s

OK
```

### Перевірка кількох некоректних значень через `subTest()`

Сторона квадрата не може бути нульовою чи від'ємною, тож `Square(0)` і `Square(-1)` мають генерувати `ValueError`. Щоб перевірити кілька вхідних значень в одному тесті, пройдіться по них циклом і обгорніть кожну перевірку в `self.subTest()`:

```python
    def test_length_with_zero_or_negative(self):
        for length in (0, -1, -2.5):
            with self.subTest(length=length):
                with self.assertRaises(ValueError):
                    Square(length)
```

Цей метод додаємо до класу `TestSquare`. `subTest()` перетворює кожне значення на окрему підперевірку: якщо одне значення не пройшло, цикл триває далі, а звіт показує, яке саме значення спричинило проблему. Припустімо, перша реалізація забула про нуль:

```python
        if length < 0:
            raise ValueError("Length must be positive")
```

Результат `python3 -m unittest -v`:

```text
test_area (test_square.TestSquare.test_area) ... ok
test_length_with_wrong_type (test_square.TestSquare.test_length_with_wrong_type) ... ok
test_length_with_zero_or_negative (test_square.TestSquare.test_length_with_zero_or_negative) ...
  test_length_with_zero_or_negative (test_square.TestSquare.test_length_with_zero_or_negative) (length=0) ... FAIL

======================================================================
FAIL: test_length_with_zero_or_negative (test_square.TestSquare.test_length_with_zero_or_negative) (length=0)
----------------------------------------------------------------------
Traceback (most recent call last):
  File ".../test_square.py", line 19, in test_length_with_zero_or_negative
    with self.assertRaises(ValueError):
         ~~~~~~~~~~~~~~~~~^^^^^^^^^^^^
AssertionError: ValueError not raised

----------------------------------------------------------------------
Ran 3 tests in 0.000s

FAILED (failures=1)
```

Суфікс `(length=0)` одразу вказує на помилку. Остаточна версія `square.py`:

```python
class Square:
    def __init__(self, length):
        if isinstance(length, bool) or not isinstance(length, (int, float)):
            raise TypeError("Length must be an int or float")
        if length <= 0:
            raise ValueError("Length must be positive")
        self.length = length

    def area(self):
        return self.length * self.length
```

Результат:

```text
test_area (test_square.TestSquare.test_area) ... ok
test_length_with_wrong_type (test_square.TestSquare.test_length_with_wrong_type) ... ok
test_length_with_zero_or_negative (test_square.TestSquare.test_length_with_zero_or_negative) ... ok

----------------------------------------------------------------------
Ran 3 tests in 0.000s

OK
```

### Перевірка повідомлення винятку

`assertRaises()` перевіряє лише *тип* винятку. Щоб перевірити й повідомлення, або збережіть об'єкт менеджера контексту через `as` і подивіться на його атрибут `exception`, або скористайтеся `assertRaisesRegex()`, який шукає в повідомленні збіг із регулярним виразом:

```python
import unittest

from square import Square


class TestSquareErrors(unittest.TestCase):
    def test_wrong_type_message(self):
        with self.assertRaises(TypeError) as cm:
            Square("10")
        self.assertEqual(str(cm.exception), "Length must be an int or float")

    def test_negative_message(self):
        with self.assertRaisesRegex(ValueError, "must be positive"):
            Square(-5)
```

Результат `python3 -m unittest test_messages -v` (файл називається `test_messages.py`):

```text
test_negative_message (test_messages.TestSquareErrors.test_negative_message) ... ok
test_wrong_type_message (test_messages.TestSquareErrors.test_wrong_type_message) ... ok

----------------------------------------------------------------------
Ran 2 tests in 0.000s

OK
```

Зверніть увагу, що `self.assertEqual(...)` для `cm.exception` стоїть **після** блоку `with`. Будь-який рядок усередині блоку після виклику, що генерує виняток, ніколи не виконається.

## Типові помилки

- **Забути префікс `test`.** Метод `check_area()` чи `area_test()` мовчки ігнорується: ні попередження, ні невдачі. Завжди називайте тестові методи `test_...`.
- **Назвати файл так, що пошук його не бачить.** `python -m unittest` за замовчуванням шукає `test*.py`. Файл `square_tests.py` ніколи не імпортується, а якщо тестів не знайдено взагалі, Python 3.12+ виводить `NO TESTS RAN` і завершується з кодом `5`.
- **Поміщати кілька викликів в один блок `assertRaises()`.** Блок завершується на першому винятку, тож наступні рядки не виконуються:

  ```python
  def test_length_with_zero_or_negative(self):
      with self.assertRaises(ValueError):
          Square(0)
          Square(-1)
  ```

  З хибною перевіркою `if length < 0` виклик `Square(0)` не генерує виняток, `Square(-1)` генерує, і тест **проходить**, хоча нуль приймається. Використовуйте окремий блок для кожного виклику або цикл із `subTest()`.
- **Використовувати звичайну інструкцію `assert`.** Вона працює всередині тесту, але в разі невдачі виводить лише `AssertionError`, без значень. До того ж її повністю вилучено, коли Python запущено з `-O`. А `self.assertEqual(area, 5)` повідомить `4 != 5`.
- **Робити тести залежними один від одного.** Кожен тестовий метод виконується на новому екземплярі тестового класу, а порядок запуску алфавітний, а не такий, як у файлі. Тест ніколи не повинен покладатися на стан, залишений іншим тестом.
- **Назвати власний файл `unittest.py`.** Він затіняє стандартний модуль, і `import unittest` імпортує ваш файл.

## Підсумок

- Модульний тест автоматично, швидко й ізольовано перевіряє невелику частину коду.
- Тестовий випадок створюють, успадковуючи `unittest.TestCase`. Кожен метод, назва якого починається з `test`, — окремий тест.
- Використовуйте методи-твердження на кшталт `assertEqual()` замість звичайного `assert`, бо вони дають інформативні повідомлення.
- Запускайте тести командою `python -m unittest` (знаходить файли `test*.py`) або через `unittest.main()` у самому тестовому файлі. Додайте `-v` чи `verbosity=2`, щоб бачити рядок для кожного тесту.
- `.` — тест пройшов, `F` — твердження не справдилося, `E` — неочікуваний виняток. Код завершення `0` буває лише тоді, коли пройшли всі тести.
- Для перевірки очікуваних винятків використовуйте `with self.assertRaises(SomeError):`. Повідомлення перевіряйте через `as cm` або `assertRaisesRegex()`.
- `self.subTest()` дає змогу перевірити багато вхідних значень в одному тесті й точно побачити, яке з них не пройшло.

## Практика

### Вправа 1: Протестуйте прямокутник

Створіть `rectangle.py` з класом `Rectangle(width, height)`, що має методи `area()` і `perimeter()`. Напишіть `test_rectangle.py` з одним тестом на кожен метод і зробіть так, щоб його можна було запустити командою `python3 test_rectangle.py` з окремим рядком для кожного тесту.

### Вправа 2: Куди поділися мої тести?

У папці лежить лише один файл, `rectangle_checks.py`:

```python
import unittest


class RectangleChecks(unittest.TestCase):
    def area_test(self):
        self.assertEqual(3 * 4, 12)

    def testPerimeter(self):
        self.assertEqual(2 * (3 + 4), 14)

    def test_diagonal(self):
        self.assertEqual((3**2 + 4**2) ** 0.5, 5.0)
```

1. Передбачте, що виведе `python3 -m unittest -v` у цій папці.
2. Передбачте, що виведе `python3 -m unittest rectangle_checks -v`.
3. Перейменуйте все, що потрібно, щоб усі три перевірки запускалися простою командою `python3 -m unittest -v`.

### Вправа 3: Протестуйте валідацію вхідних даних

Ось функція у файлі `ages.py`:

```python
def parse_age(text):
    if not text.strip().isdigit():
        raise ValueError(f"not a number: {text!r}")
    age = int(text)
    if age > 150:
        raise ValueError(f"unrealistic age: {age}")
    return age
```

Напишіть `test_ages.py`, який перевіряє:

- коректні вхідні значення, як-от `"42"`, `" 7 "` і `"0"`;
- що `""`, `"abc"`, `"-5"` і `"4.5"` генерують `ValueError` (використайте цикл із `subTest()`);
- що `parse_age("200")` генерує `ValueError` саме з повідомленням `unrealistic age: 200`.

## Розв'язки

### Вправа 1

`rectangle.py`:

```python
class Rectangle:
    def __init__(self, width, height):
        self.width = width
        self.height = height

    def area(self):
        return self.width * self.height

    def perimeter(self):
        return 2 * (self.width + self.height)
```

`test_rectangle.py`:

```python
import unittest

from rectangle import Rectangle


class TestRectangle(unittest.TestCase):
    def test_area(self):
        rectangle = Rectangle(3, 4)
        self.assertEqual(rectangle.area(), 12)

    def test_perimeter(self):
        rectangle = Rectangle(3, 4)
        self.assertEqual(rectangle.perimeter(), 14)


if __name__ == "__main__":
    unittest.main(verbosity=2)
```

Результат `python3 test_rectangle.py` (час щоразу інший):

```text
test_area (__main__.TestRectangle.test_area) ... ok
test_perimeter (__main__.TestRectangle.test_perimeter) ... ok

----------------------------------------------------------------------
Ran 2 tests in 0.000s

OK
```

### Вправа 2

1. Пошук імпортує лише файли, що відповідають шаблону `test*.py`, а `rectangle_checks.py` йому не відповідає, тож нічого не запускається:

   ```text
   ----------------------------------------------------------------------
   Ran 0 tests in 0.000s

   NO TESTS RAN
   ```

   Код завершення — `5`.

2. Якщо назвати модуль явно, шаблон назви файлу не застосовується. Тепер діє правило для назв методів: `testPerimeter` і `test_diagonal` починаються з `test`, а `area_test` — ні:

   ```text
   testPerimeter (rectangle_checks.RectangleChecks.testPerimeter) ... ok
   test_diagonal (rectangle_checks.RectangleChecks.test_diagonal) ... ok

   ----------------------------------------------------------------------
   Ran 2 tests in 0.000s

   OK
   ```

   Назва класу `RectangleChecks` цілком підходить: збираються всі підкласи `TestCase`.

3. Перейменуйте файл на `test_rectangle_checks.py`, а методи — на `test_...`:

   ```python
   import unittest


   class RectangleChecks(unittest.TestCase):
       def test_area(self):
           self.assertEqual(3 * 4, 12)

       def test_perimeter(self):
           self.assertEqual(2 * (3 + 4), 14)

       def test_diagonal(self):
           self.assertEqual((3**2 + 4**2) ** 0.5, 5.0)
   ```

   Результат `python3 -m unittest -v`:

   ```text
   test_area (test_rectangle_checks.RectangleChecks.test_area) ... ok
   test_diagonal (test_rectangle_checks.RectangleChecks.test_diagonal) ... ok
   test_perimeter (test_rectangle_checks.RectangleChecks.test_perimeter) ... ok

   ----------------------------------------------------------------------
   Ran 3 tests in 0.000s

   OK
   ```

### Вправа 3

```python
import unittest

from ages import parse_age


class TestParseAge(unittest.TestCase):
    def test_valid_ages(self):
        self.assertEqual(parse_age("42"), 42)
        self.assertEqual(parse_age(" 7 "), 7)
        self.assertEqual(parse_age("0"), 0)

    def test_not_a_number(self):
        for text in ("", "abc", "-5", "4.5"):
            with self.subTest(text=text):
                with self.assertRaises(ValueError):
                    parse_age(text)

    def test_unrealistic_age_message(self):
        with self.assertRaises(ValueError) as cm:
            parse_age("200")
        self.assertEqual(str(cm.exception), "unrealistic age: 200")
```

Результат `python3 -m unittest -v`:

```text
test_not_a_number (test_ages.TestParseAge.test_not_a_number) ... ok
test_unrealistic_age_message (test_ages.TestParseAge.test_unrealistic_age_message) ... ok
test_valid_ages (test_ages.TestParseAge.test_valid_ages) ... ok

----------------------------------------------------------------------
Ran 3 tests in 0.000s

OK
```

Щоб переконатися, що тести корисні, навмисно зламайте `parse_age()` (наприклад, замініть `150` на `250`) і запустіть їх знову: `test_unrealistic_age_message` має не пройти.

---

*Джерело: [pythontutorial.net — Python unittest](https://www.pythontutorial.net/python-unit-testing/python-unittest/). Адаптовано й доповнено для PyJourney.*
