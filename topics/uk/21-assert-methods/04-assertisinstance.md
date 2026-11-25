# assertIsInstance()

Іноді *тип* результату є частиною контракту: парсер має повертати `int`, фабрика — `Circle`, завантажувач — щось схоже на словник. `assertIsInstance()` перевіряє саме це, а його «заперечний» двійник `assertNotIsInstance()` — протилежне.

## Що ви дізнаєтесь

- Що перевіряє `assertIsInstance(obj, cls, msg=None)` і як він пов'язаний з `isinstance()`
- Чому екземпляри підкласів проходять перевірку, а `object` проходить завжди
- Як дозволити кілька типів за допомогою кортежу чи об'єднання `X | Y`
- Як працює `assertNotIsInstance()` (і чому `assertIsNotInstance()` не існує)
- Як перевірити *точний* тип, абстрактний базовий клас або протокол
- Що не можна передавати другим аргументом

## Як працює `assertIsInstance()`

```python
assertIsInstance(obj, cls, msg=None)
```

Тест проходить, коли `isinstance(obj, cls)` істинне:

- `obj` — об'єкт, який перевіряють.
- `cls` — клас, кортеж класів або (починаючи з Python 3.10) об'єднання типів, як-от `int | float`.
- `msg` — необов'язкове пояснення, яке додається до повідомлення про невдачу.

Оскільки метод використовує `isinstance()`, перевірка враховує успадкування: екземпляр підкласу є також екземпляром кожного базового класу.

## Приклад: фігури

`shape.py` визначає базовий клас і підклас:

```python
class Shape:
    pass


class Square(Shape):
    pass
```

`test_shape.py` перевіряє `Square` щодо його власного класу, базового класу та `object`. Останній тест використовує `assertNotIsInstance()`, про який ідеться нижче:

```python
import unittest

from shape import Shape, Square


class TestShape(unittest.TestCase):
    def setUp(self):
        self.square = Square()

    def test_is_instance(self):
        self.assertIsInstance(self.square, Square)

    def test_is_instance_of_parent_class(self):
        self.assertIsInstance(self.square, Shape)

    def test_is_instance_of_object(self):
        self.assertIsInstance(self.square, object)

    def test_is_not_instance(self):
        shape = Shape()
        self.assertNotIsInstance(shape, Square)
```

Результат `python3 -m unittest -v`:

```text
test_is_instance (test_shape.TestShape.test_is_instance) ... ok
test_is_instance_of_object (test_shape.TestShape.test_is_instance_of_object) ... ok
test_is_instance_of_parent_class (test_shape.TestShape.test_is_instance_of_parent_class) ... ok
test_is_not_instance (test_shape.TestShape.test_is_not_instance) ... ok

----------------------------------------------------------------------
Ran 4 tests in 0.000s

OK
```

- `Square` є `Square`, а оскільки `Square` успадковує `Shape`, то він також є `Shape`.
- Кожен клас успадковує `object`, тож `assertIsInstance(anything, object)` проходить **завжди**. Це добре ілюструє успадкування, але як справжній тест нічого не перевіряє.
- Звичайний `Shape` не є `Square`: успадкування працює лише в один бік.

### Як виглядає невдача

Повідомлення називає об'єкт і очікуваний клас. Для ваших власних класів без `__repr__` об'єкт відображається як `<module.Class object at 0x...>`:

```python
import unittest

from shape import Shape, Square


class TestShapeFail(unittest.TestCase):
    def test_shape_is_not_a_square(self):
        self.assertIsInstance(Shape(), Square)
```

Рядок `AssertionError` з виводу `python3 -m unittest test_shape_fail` (адреса щоразу інша):

```text
AssertionError: <shape.Shape object at 0x1011163c0> is not an instance of <class 'shape.Square'>
```

Із вбудованими значеннями повідомлення інформативніше, бо їхній `repr()` показує значення. Тут парсер забув перетворити результат:

```python
import unittest


def parse_quantity(text):
    return text.strip()  # помилка: забули int()


class TestParseQuantity(unittest.TestCase):
    def test_returns_int(self):
        self.assertIsInstance(parse_quantity(" 42 "), int)

    def test_returns_number(self):
        self.assertIsInstance(parse_quantity(" 42 "), (int, float))

    def test_returns_number_union(self):
        self.assertIsInstance(parse_quantity(" 42 "), int | float)
```

Рядки `AssertionError` з виводу `python3 -m unittest test_parse` (Python 3.14):

```text
AssertionError: '42' is not an instance of <class 'int'>
AssertionError: '42' is not an instance of any of (<class 'int'>, <class 'float'>)
AssertionError: '42' is not an instance of int | float
```

Лапки навколо `'42'` одразу видають помилку: функція повернула рядок.

## Кілька допустимих типів

Другий і третій тести вище показують два способи прийняти більше ніж один тип:

- **кортеж**: `assertIsInstance(value, (int, float))`;
- **об'єднання** (Python 3.10+): `assertIsInstance(value, int | float)`. Об'єднання з `None` природно читається для необов'язкових результатів: `assertIsInstance(result, dict | None)`.

Обидва варіанти означають «екземпляр принаймні одного з цих типів».

## `assertNotIsInstance()`

```python
assertNotIsInstance(obj, cls, msg=None)
```

Тест проходить, коли `isinstance(obj, cls)` хибне. У разі невдачі повідомлення називає клас, який збігся:

```python
import unittest

tc = unittest.TestCase()  # екземпляр лише для експериментів

try:
    tc.assertNotIsInstance(True, (str, int))
except AssertionError as error:
    print(error)
```

Результат:

```text
True is an instance of <class 'int'>
```

> **Зверніть увагу:** метод називається `assertNotIsInstance()`, з `Not` одразу після `assert`. У деяких посібниках його називають `assertIsNotInstance()`, але такого методу не існує. Його виклик завершує тест з `ERROR` і `AttributeError: ... has no attribute 'assertIsNotInstance'. Did you mean: 'assertIsInstance'?`.

## Перевірка точного типу

`isinstance()` приймає підкласи, і тут є несподіванка: `bool` — підклас `int`, тож `assertIsInstance(True, int)` проходить. Коли підклас **не** можна приймати, порівнюйте сам тип через `assertIs()` або виключіть підклас за допомогою `assertNotIsInstance()`:

```python
import unittest


def count_errors(lines):
    return any("ERROR" in line for line in lines)  # помилка: any() замість sum()


class TestCountErrors(unittest.TestCase):
    def test_isinstance_is_fooled(self):
        self.assertIsInstance(count_errors(["ERROR x", "ok"]), int)

    def test_exact_type(self):
        self.assertIs(type(count_errors(["ERROR x", "ok"])), int)

    def test_not_bool(self):
        self.assertNotIsInstance(count_errors(["ERROR x", "ok"]), bool)
```

Рядки тестів і рядки `AssertionError` з виводу `python3 -m unittest test_exact -v`:

```text
test_exact_type (test_exact.TestCountErrors.test_exact_type) ... FAIL
test_isinstance_is_fooled (test_exact.TestCountErrors.test_isinstance_is_fooled) ... ok
test_not_bool (test_exact.TestCountErrors.test_not_bool) ... FAIL

AssertionError: <class 'bool'> is not <class 'int'>
AssertionError: True is an instance of <class 'bool'>
```

`count_errors()` повертає `True` замість числа, а `assertIsInstance(..., int)` цього не помічає. Звісно, `assertEqual(count_errors(...), 1)` теж не помітив би (`True == 1`), і саме тому перевірка типу іноді потрібна.

## Абстрактні базові класи та протоколи

Часто конкретний клас вам байдужий, важливо лише, що об'єкт уміє робити. `isinstance()` працює з абстрактними базовими класами з `collections.abc` і з протоколами, позначеними `@runtime_checkable`:

```python
import unittest
from collections.abc import Mapping, Sequence
from typing import Protocol, runtime_checkable


@runtime_checkable
class SupportsClose(Protocol):
    def close(self): ...


class Connection:
    def close(self):
        print("closed")


def load_settings():
    return {"debug": False, "workers": 4}


def recent_ids():
    return (101, 102, 103)


class TestAbstractTypes(unittest.TestCase):
    def test_settings_is_a_mapping(self):
        self.assertIsInstance(load_settings(), Mapping)

    def test_ids_are_a_sequence(self):
        self.assertIsInstance(recent_ids(), Sequence)

    def test_connection_can_be_closed(self):
        self.assertIsInstance(Connection(), SupportsClose)
```

Результат `python3 -m unittest test_abc -v`:

```text
test_connection_can_be_closed (test_abc.TestAbstractTypes.test_connection_can_be_closed) ... ok
test_ids_are_a_sequence (test_abc.TestAbstractTypes.test_ids_are_a_sequence) ... ok
test_settings_is_a_mapping (test_abc.TestAbstractTypes.test_settings_is_a_mapping) ... ok

----------------------------------------------------------------------
Ran 3 tests in 0.000s

OK
```

Ці тести й далі проходитимуть, якщо згодом `recent_ids()` повертатиме список замість кортежу, і зазвичай саме цього ви й хочете. Зауважте, що перевірка протоколу під час виконання лише перевіряє, що методи **існують**, а не їхні сигнатури. І ще: `str` теж є `Sequence`, тож `assertIsInstance("abc", Sequence)` проходить.

## Чим не може бути другий аргумент

Деякі значення `isinstance()` не приймає як другий аргумент. Тоді `assertIsInstance()` не повідомляє про невдачу, а аварійно завершується з `TypeError`, і тест закінчується з `ERROR`:

```python
import unittest


class TestWrongArguments(unittest.TestCase):
    def test_generic(self):
        self.assertIsInstance(["a", "b"], list[str])

    def test_swapped(self):
        self.assertIsInstance(list, ["a", "b"])
```

Останній рядок кожного трасування з виводу `python3 -m unittest test_wrong_args`:

```text
TypeError: isinstance() argument 2 cannot be a parameterized generic
TypeError: isinstance() arg 2 must be a type, a tuple of types, or a union
```

- Анотації типів на кшталт `list[str]` чи `dict[str, int]` не можна перевірити під час виконання. Перевірте контейнер через `assertIsInstance(tags, list)`, а потім кожен елемент у циклі.
- Об'єкт іде **першим**, тип — **другим**.

## Типові помилки

- **Писати `assertIsNotInstance()`.** Правильна назва — `assertNotIsInstance()`.
- **Забувати, що `bool` — це `int`.** `assertIsInstance(True, int)` проходить. Використовуйте `assertIs(type(x), int)` або додайте `assertNotIsInstance(x, bool)`.
- **Перевіряти клас замість екземпляра.** `assertIsInstance(Square, Shape)` не проходить із повідомленням `<class 'shape.Square'> is not an instance of <class 'shape.Shape'>`, бо клас `Square` є екземпляром `type`, а не `Shape`. Щоб перевірити успадкування між класами, використовуйте `assertIsSubclass(Square, Shape)` (Python 3.14+) або `assertTrue(issubclass(Square, Shape))`.
- **Передавати параметризований generic**, як-от `list[int]`. Це генерує `TypeError`.
- **Перевіряти лише тип.** `assertIsInstance(total, int)` проходить для будь-якого неправильного цілого числа. Перевірка типу доповнює перевірки значень на кшталт `assertEqual()`, а не замінює їх.
- **Писати `assertIsInstance(x, object)`.** Така перевірка проходить завжди.

## Підсумок

- `assertIsInstance(obj, cls, msg=None)` проходить, коли `isinstance(obj, cls)` істинне, тому екземпляри підкласів теж проходять.
- `cls` може бути класом, кортежем класів або об'єднанням на кшталт `int | float`. Кожен об'єкт є екземпляром `object`.
- `assertNotIsInstance(obj, cls, msg=None)` — протилежна перевірка. Методу `assertIsNotInstance()` не існує.
- Повідомлення про невдачу показують `repr()` об'єкта, тож давайте своїм класам зрозумілий `__repr__`.
- Для точного типу використовуйте `assertIs(type(obj), SomeClass)`. Пам'ятайте, що `bool` — підклас `int`.
- Абстрактні базові класи (`Mapping`, `Sequence`, `Iterable`) і протоколи з `@runtime_checkable` дають змогу перевіряти можливості, а не конкретні класи.
- Параметризовані generic-типи на кшталт `list[str]` використовувати не можна. Для класів замість цього методу використовуйте `assertIsSubclass()`.

## Практика

### Вправа 1: Фабрика фігур

Файл `shapes.py` містить:

```python
import math


class Shape:
    def area(self):
        raise NotImplementedError


class Circle(Shape):
    def __init__(self, radius):
        self.radius = radius

    def area(self):
        return math.pi * self.radius**2


class Square(Shape):
    def __init__(self, side):
        self.side = side

    def area(self):
        return self.side**2


def make_shape(kind, size):
    if kind == "circle":
        return Circle(size)
    if kind == "square":
        return Square(size)
    raise ValueError(f"unknown shape: {kind}")
```

Напишіть тести, які перевіряють, що `make_shape("circle", 1)` повертає `Circle`, який також є `Shape` і не є `Square`; що `make_shape("square", 2)` повертає `Square` із площею `4`; і що невідомий вид фігури генерує `ValueError`.

### Вправа 2: `int`, а не `bool`

Файл `values.py` містить:

```python
def parse_value(text):
    lowered = text.lower()
    if lowered in ("true", "false"):
        return lowered == "true"
    if text.isdigit():
        return int(text)
    return text
```

Напишіть тести, які в одному циклі з `subTest()` перевіряють **точний** тип результату для `"42"` (`int`), `"true"` і `"False"` (`bool`) та `"hello"` (`str`). Додайте тест, що `parse_value("1")` не є `bool`, і тест самих значень. Чому `assertIsInstance(parse_value("true"), int)` тут була б марною перевіркою?

### Вправа 3: Виправте зламані тести

Файл `shape.py` містить класи `Shape` і `Square` з теми та таку функцію:

```python
def get_tags():
    return ["python", "testing"]
```

Передбачте, що повідомить кожен тест нижче (`FAIL` чи `ERROR` і чому), а потім виправте всі три так, щоб вони проходили й надалі перевіряли те, що обіцяють їхні назви.

```python
import unittest

from shape import Shape, Square, get_tags


class TestBroken(unittest.TestCase):
    def test_tags(self):
        self.assertIsInstance(get_tags(), list[str])

    def test_square_class(self):
        self.assertIsInstance(Square, Shape)

    def test_not_a_dict(self):
        self.assertIsNotInstance(get_tags(), dict)
```

## Розв'язки

### Вправа 1

```python
import unittest

from shapes import Circle, Shape, Square, make_shape


class TestMakeShape(unittest.TestCase):
    def test_circle(self):
        shape = make_shape("circle", 1)
        self.assertIsInstance(shape, Circle)
        self.assertIsInstance(shape, Shape)
        self.assertNotIsInstance(shape, Square)

    def test_square(self):
        shape = make_shape("square", 2)
        self.assertIsInstance(shape, Square)
        self.assertEqual(shape.area(), 4)

    def test_unknown_kind(self):
        with self.assertRaises(ValueError):
            make_shape("triangle", 3)
```

Результат `python3 -m unittest test_shapes -v`:

```text
test_circle (test_shapes.TestMakeShape.test_circle) ... ok
test_square (test_shapes.TestMakeShape.test_square) ... ok
test_unknown_kind (test_shapes.TestMakeShape.test_unknown_kind) ... ok

----------------------------------------------------------------------
Ran 3 tests in 0.000s

OK
```

`test_square` поєднує перевірку типу з перевіркою значення: сам лише тип не скаже, чи правильно збережено довжину сторони.

### Вправа 2

```python
import unittest

from values import parse_value


class TestParseValue(unittest.TestCase):
    def test_types(self):
        cases = [("42", int), ("true", bool), ("False", bool), ("hello", str)]
        for text, expected_type in cases:
            with self.subTest(text=text):
                self.assertIs(type(parse_value(text)), expected_type)

    def test_number_is_not_bool(self):
        self.assertNotIsInstance(parse_value("1"), bool)

    def test_values(self):
        self.assertEqual(parse_value("42"), 42)
        self.assertIs(parse_value("TRUE"), True)
        self.assertIs(parse_value("false"), False)
        self.assertEqual(parse_value("hello"), "hello")
```

Результат `python3 -m unittest test_values -v`:

```text
test_number_is_not_bool (test_values.TestParseValue.test_number_is_not_bool) ... ok
test_types (test_values.TestParseValue.test_types) ... ok
test_values (test_values.TestParseValue.test_values) ... ok

----------------------------------------------------------------------
Ran 3 tests in 0.000s

OK
```

`assertIsInstance(parse_value("true"), int)` пройшов би, бо `True` є екземпляром `int`. Така перевірка не відрізнила б правильний результат `True` від хибного результату `1`. Саме тому цикл порівнює `type(...)` через `assertIs()`. У `test_values` `assertIs(..., True)` використано з тієї самої причини: `assertEqual(1, True)` пройшов би.

### Вправа 3

Запуск зламаних тестів дає `EFE`:

```text
ERROR: test_not_a_dict (test_broken.TestBroken.test_not_a_dict)
AttributeError: 'TestBroken' object has no attribute 'assertIsNotInstance'. Did you mean: 'assertIsInstance'?
ERROR: test_tags (test_broken.TestBroken.test_tags)
TypeError: isinstance() argument 2 cannot be a parameterized generic
FAIL: test_square_class (test_broken.TestBroken.test_square_class)
AssertionError: <class 'shape.Square'> is not an instance of <class 'shape.Shape'>
```

- `test_not_a_dict`: назва методу неправильна, тож тест аварійно завершується, нічого не перевіривши.
- `test_tags`: `list[str]` — це анотація типу, а не те, що може перевірити `isinstance()`.
- `test_square_class`: `Square` — це клас, тобто екземпляр `type`. Він *успадковує* `Shape`, але не є *екземпляром* `Shape`.

Виправлена версія:

```python
import unittest

from shape import Shape, Square, get_tags


class TestFixed(unittest.TestCase):
    def test_tags(self):
        tags = get_tags()
        self.assertIsInstance(tags, list)
        for tag in tags:
            with self.subTest(tag=tag):
                self.assertIsInstance(tag, str)

    def test_square_class(self):
        self.assertIsSubclass(Square, Shape)

    def test_not_a_dict(self):
        self.assertNotIsInstance(get_tags(), dict)
```

Результат `python3 -m unittest test_fixed -v`:

```text
test_not_a_dict (test_fixed.TestFixed.test_not_a_dict) ... ok
test_square_class (test_fixed.TestFixed.test_square_class) ... ok
test_tags (test_fixed.TestFixed.test_tags) ... ok

----------------------------------------------------------------------
Ran 3 tests in 0.000s

OK
```

`assertIsSubclass()` з'явився в Python 3.14. У старіших версіях пишіть `self.assertTrue(issubclass(Square, Shape))`.

---

*Джерело: [pythontutorial.net — Python assertIsInstance()](https://www.pythontutorial.net/python-unit-testing/python-assertisinstance/). Адаптовано й доповнено для PyJourney.*
