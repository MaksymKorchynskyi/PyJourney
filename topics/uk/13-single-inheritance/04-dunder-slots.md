# __slots__

За замовчуванням кожен об'єкт Python зберігає свої атрибути в окремому словнику екземпляра. Це гнучко, але коштує пам'яті. Оголосивши в класі `__slots__`, ви повідомляєте Python, що його екземпляри мають **фіксований набір атрибутів**, і тоді Python може зберігати їх у компактній структурі, схожій на масив. Це важливо, коли програма створює багато дрібних об'єктів, а взаємодія `__slots__` з успадкуванням має кілька неочевидних моментів.

## Що ви дізнаєтесь

- Де зазвичай живуть атрибути екземпляра (`__dict__`) і скільки це коштує
- Як `__slots__` змінює спосіб зберігання і що ви при цьому виграєте й втрачаєте
- Чому до класу зі слотами можна додати атрибути *класу*, але не атрибути екземпляра
- Як `__slots__` поводиться за всіх комбінацій базового класу й підкласу
- Як виміряти економію пам'яті і коли слоти варто використовувати
- Додатково: `__weakref__`, `__dict__` у слотах, `@dataclass(slots=True)`

## Зберігання за замовчуванням: `__dict__` екземпляра

Ось звичайний клас:

```python
class Point2D:
    def __init__(self, x, y):
        self.x = x
        self.y = y

    def __repr__(self):
        return f"Point2D({self.x},{self.y})"


point = Point2D(0, 0)
print(point.__dict__)

point.z = 5  # під час виконання можна додати будь-який новий атрибут
print(point.__dict__)
```

Результат:

```text
{'x': 0, 'y': 0}
{'x': 0, 'y': 0, 'z': 5}
```

Кожен екземпляр має власний словник, що зіставляє імена атрибутів зі значеннями. Словник може рости, тому будь-якому об'єкту будь-коли можна додати будь-який атрибут. Ціна цього — пам'ять: словник є хеш-таблицею із запасом місця для майбутніх ключів, і за це платить кожен окремий екземпляр.

Якщо клас має невеликий фіксований набір атрибутів, а ви створюєте тисячі чи мільйони його об'єктів (точки, пікселі, записи з файлу), ці накладні витрати накопичуються.

## Оголошення `__slots__`

Присвойте `__slots__` у тілі класу ітерований об'єкт (зазвичай кортеж) з іменами атрибутів, які дозволено мати екземплярам:

```python
class Point2D:
    __slots__ = ("x", "y")

    def __init__(self, x, y):
        self.x = x
        self.y = y

    def __repr__(self):
        return f"Point2D({self.x},{self.y})"


point = Point2D(0, 0)
print(point)
print(point.__slots__)
print(hasattr(point, "__dict__"))
```

Результат:

```text
Point2D(0,0)
('x', 'y')
False
```

Екземпляри цього класу **взагалі не мають `__dict__`**. Спроба звернутися до нього завершується помилкою:

```python
class Point2D:
    __slots__ = ("x", "y")

    def __init__(self, x, y):
        self.x = x
        self.y = y


point = Point2D(0, 0)
print(point.__dict__)
```

Результат:

```text
Traceback (most recent call last):
  ...
AttributeError: 'Point2D' object has no attribute '__dict__'. Did you mean: '__dir__'?
```

(Підказка «Did you mean» — це лише здогадка Python про можливу одруківку, тут її можна ігнорувати.) З тієї ж причини `vars(point)` генерує `TypeError: vars() argument must have __dict__ attribute`.

### Жодних нових атрибутів екземпляра

Без словника нема куди покласти атрибут, якого немає в `__slots__`:

```python
class Point2D:
    __slots__ = ("x", "y")

    def __init__(self, x, y):
        self.x = x
        self.y = y


point = Point2D(0, 0)
point.z = 0
```

Результат:

```text
Traceback (most recent call last):
  ...
AttributeError: 'Point2D' object has no attribute 'z' and no __dict__ for setting new attributes
```

> **Зверніть увагу:** текст цього повідомлення з часом покращили. Python 3.14 пише «... and no __dict__ for setting new attributes», а старіші версії — лише `'Point2D' object has no attribute 'z'`.

Це обмеження ще й невелика страховка: одруківка на кшталт `self.nmae = name` у класі зі слотами одразу спричиняє помилку, а не тихо створює новий атрибут.

Слот, який оголошено, але ще не присвоєно, просто не має значення. Спроба його прочитати генерує `AttributeError: 'Point2D' object has no attribute 'x'`, так само як для відсутнього звичайного атрибута.

## Як працюють слоти: дескриптори в класі

`__slots__` стосується **екземплярів**, а не самого класу. Для кожного імені з `__slots__` Python створює в класі спеціальний дескриптор (`member_descriptor`), який знає, де саме у фіксованій структурі пам'яті екземпляра зберігається відповідне значення. Сам клас і далі має власний `__dict__`, тож атрибути класу додавати можна:

```python
class Point2D:
    __slots__ = ("x", "y")

    def __init__(self, x, y):
        self.x = x
        self.y = y


Point2D.color = "black"  # атрибут класу: дозволено
print({k: v for k, v in Point2D.__dict__.items() if not k.startswith("__")})
print(type(Point2D.x))

point = Point2D(0, 0)
print(point.color)
```

Результат:

```text
{'x': <member 'x' of 'Point2D' objects>, 'y': <member 'y' of 'Point2D' objects>, 'color': 'black'}
<class 'member_descriptor'>
black
```

Екземпляр може *прочитати* `color`, бо пошук атрибута переходить до класу. Але *присвоїти* власний `color` він не може: для нього немає ні слота, ні словника екземпляра.

```python
class Point2D:
    __slots__ = ("x", "y")


Point2D.color = "black"
point = Point2D()
point.color = "red"
```

Результат:

```text
Traceback (most recent call last):
  ...
AttributeError: 'Point2D' object attribute 'color' is read-only
```

## Скільки пам'яті заощаджують слоти?

Пам'ять, яку займає велика кількість об'єктів, можна виміряти стандартним модулем `tracemalloc`:

```python
import tracemalloc


class PointDict:
    def __init__(self, x, y):
        self.x = x
        self.y = y


class PointSlots:
    __slots__ = ("x", "y")

    def __init__(self, x, y):
        self.x = x
        self.y = y


def measure(cls, n=100_000):
    tracemalloc.start()
    points = [cls(0, 0) for _ in range(n)]
    current, _ = tracemalloc.get_traced_memory()
    tracemalloc.stop()
    return current / n


print(f"with __dict__:  {measure(PointDict):.0f} bytes per point")
print(f"with __slots__: {measure(PointSlots):.0f} bytes per point")
```

Результат (Python 3.14, 64-біт; числа залежать від версії та платформи):

```text
with __dict__:  96 bytes per point
with __slots__: 56 bytes per point
```

Ці числа враховують і 8-байтовий вказівник, який кожен об'єкт займає в списку. Навіть так версія зі слотами потребує приблизно на 40% менше пам'яті.

У старіших статтях часто наводять значно більшу різницю. Починаючи з Python 3.11–3.12, CPython зберігає атрибути звичайних об'єктів у компактній вбудованій структурі й створює справжній словник лише тоді, коли хтось звертається до `__dict__`, тож розрив зменшився. Слоти все одно виграють і ще трохи пришвидшують доступ до атрибутів, але цей виграш має значення лише за **великої** кількості екземплярів.

## `__slots__` та одиночне успадкування

`__slots__` оголошують для кожного класу окремо, і підклас не отримує властивість «без `__dict__`» автоматично. Можливі чотири комбінації.

### Базовий клас має слоти, підклас — ні

```python
class Point2D:
    __slots__ = ("x", "y")

    def __init__(self, x, y):
        self.x = x
        self.y = y

    def __repr__(self):
        return f"Point2D({self.x},{self.y})"


class Point3D(Point2D):
    def __init__(self, x, y, z):
        super().__init__(x, y)
        self.z = z


if __name__ == "__main__":
    point = Point3D(10, 20, 30)
    print(point.__dict__)
    point.color = "red"
    print(point.__dict__)
```

Результат:

```text
{'z': 30}
{'z': 30, 'color': 'red'}
```

`Point3D` не оголошує `__slots__`, тому його екземпляри знову отримують `__dict__`. `x` і `y` і далі живуть в успадкованих слотах, а `z` (і все інше) потрапляє в словник. Більшу частину виграшу в пам'яті втрачено.

### Обидва класи мають слоти

Щоб зберегти компактну структуру, підклас теж має оголосити `__slots__`, перелічивши **лише нові атрибути**:

```python
class Point2D:
    __slots__ = ("x", "y")

    def __init__(self, x, y):
        self.x = x
        self.y = y


class Point3D(Point2D):
    __slots__ = ("z",)

    def __init__(self, x, y, z):
        super().__init__(x, y)
        self.z = z


point = Point3D(10, 20, 30)
print(point.x, point.y, point.z)
print(hasattr(point, "__dict__"))
```

Результат:

```text
10 20 30
False
```

Тепер усі три атрибути зберігаються в слотах, і словника екземпляра немає. Зверніть увагу на кому в `("z",)`: без неї `("z")` — це просто рядок `"z"`. (Одиночний рядок теж спрацює, бо `__slots__ = "z"` оголошує один слот з іменем `z`, але запис кортежем зрозуміліший.)

Не повторюйте імена батька. `__slots__ = ("x", "y", "z")` у `Point3D` створює другу, приховану копію `x` і `y`, що марнує пам'ять (у Python 3.14 це 72 байти на об'єкт замість 56), а документація Python попереджає, що слоти батька стають недоступними, і поведінка програми не визначена.

### Базовий клас не має слотів, підклас має

```python
class Shape:
    pass


class Point2D(Shape):
    __slots__ = ("x", "y")

    def __init__(self, x, y):
        self.x = x
        self.y = y


if __name__ == "__main__":
    # для атрибутів екземпляра використовуються і слоти, і словник
    point = Point2D(10, 10)
    print(point.__slots__)
    print(point.__dict__)

    # атрибути все ще можна додавати під час виконання
    point.color = "black"
    print(point.__dict__)
```

Результат:

```text
('x', 'y')
{}
{'color': 'black'}
```

`Shape` не має `__slots__`, тому його екземпляри (і екземпляри всіх підкласів) мають `__dict__`. `Point2D` зберігає `x` і `y` у слотах, але словник нікуди не дівається: спочатку він порожній і чекає на `color`. Слоти лише в підкласі не прибирають словник.

### Жоден клас не має слотів

Це поведінка за замовчуванням: кожен екземпляр має `__dict__`.

### Зведена таблиця комбінацій

| `__slots__` у базовому класі | `__slots__` у підкласі | Чи мають екземпляри `__dict__`? |
|---|---|---|
| так | так (лише нові імена) | ні |
| так | ні | так |
| ні | так | так |
| ні | ні | так |

Правило: екземпляр не має `__dict__` лише тоді, коли **кожен** клас у ланцюжку успадкування (крім `object`) визначає `__slots__`.

## Додатково

### Повернення `__dict__` чи слабких посилань

На екземпляри зі слотами за замовчуванням не можна створити слабке посилання (weak reference), бо слота для списку слабких посилань теж немає:

```python
import weakref


class Point2D:
    __slots__ = ("x", "y")


weakref.ref(Point2D())
```

Результат:

```text
Traceback (most recent call last):
  ...
TypeError: cannot create weak reference to 'Point2D' object
```

Якщо ці можливості потрібні, додайте до `__slots__` спеціальні імена `"__weakref__"` та/або `"__dict__"`:

```python
import weakref


class Node:
    __slots__ = ("value", "__weakref__")

    def __init__(self, value):
        self.value = value


class Flexible:
    __slots__ = ("x", "__dict__")


node = Node(1)
ref = weakref.ref(node)
print(ref() is node)

item = Flexible()
item.x = 1
item.extra = 2
print(item.__dict__)
```

Результат:

```text
True
{'extra': 2}
```

### Жодних значень за замовчуванням на рівні класу

Ім'я не може бути водночас слотом і атрибутом класу, тому задати значення за замовчуванням так не вийде:

```python
class Config:
    __slots__ = ("debug",)
    debug = False
```

Результат:

```text
Traceback (most recent call last):
  ...
ValueError: 'debug' in __slots__ conflicts with class variable
```

Задавайте значення за замовчуванням в `__init__` (`def __init__(self, debug=False): self.debug = debug`).

### Слоти й класи даних (Python 3.10+)

`@dataclass(slots=True)` генерує `__slots__` за вас і правильно обробляє значення за замовчуванням:

```python
from dataclasses import dataclass


@dataclass(slots=True)
class Point:
    x: int
    y: int = 0


p = Point(3)
print(p)
print(Point.__slots__)
print(hasattr(p, "__dict__"))
```

Результат:

```text
Point(x=3, y=0)
('x', 'y')
False
```

### Множинне успадкування

Клас не може успадковуватися від двох класів, які обидва мають непорожні `__slots__`: Python не вміє поєднати дві фіксовані структури пам'яті й генерує `TypeError: multiple bases have instance lay-out conflict`. Це ще одна причина використовувати слоти лише в простих ієрархіях, переважно з одиночним успадкуванням.

## Коли використовувати `__slots__`

Слоти доречні, коли:

- ви створюєте **велику кількість** екземплярів (десятки тисяч і більше);
- набір атрибутів фіксований і відомий заздалегідь;
- ви контролюєте всю ієрархію класів.

Не додавайте слоти до кожного класу за звичкою. Вони забирають гнучкість (жодних довільних атрибутів, жодних інструментів на основі `__dict__`, як-от `vars()`, додаткова обережність з успадкуванням) і дають відчутну перевагу лише на великих обсягах.

## Типові помилки

- **Додати `__slots__` лише до підкласу.** Якщо базовий клас не має слотів, екземпляри все одно отримують `__dict__`, і пам'ять не заощаджується.
- **Забути `__slots__` у підкласі.** Підклас без власних `__slots__` повертає `__dict__`.
- **Повторювати в підкласі імена слотів батька.** Перелічуйте лише нові атрибути.
- **Писати `("z")` замість `("z",)`.** Без коми це рядок, а не кортеж. Випадково це оголошує один слот `z`, але `__slots__ = ("x" "y")` непомітно перетворюється на єдиний слот `xy`.
- **Задавати значення за замовчуванням атрибутами класу.** `debug = False` поруч із `__slots__ = ("debug",)` генерує `ValueError`. Задавайте значення в `__init__` або використовуйте `@dataclass(slots=True)`.
- **Використовувати слоти як механізм контролю доступу чи валідації.** Слоти існують, щоб заощаджувати пам'ять. Підклас без слотів знову може додавати будь-які атрибути. Для захисту даних використовуйте властивості (property) або перевірки в `__init__`.

## Підсумок

- Зазвичай кожен екземпляр зберігає атрибути у власному `__dict__`, що дає змогу додавати атрибути під час виконання, але коштує пам'яті.
- `__slots__ = ("a", "b")` дає екземплярам фіксований набір атрибутів, які зберігаються компактно, без `__dict__`.
- Екземпляри зі слотами відхиляють невідомі атрибути з `AttributeError`, що заодно ловить одруківки.
- `__slots__` впливає лише на екземпляри; атрибути класу додавати можна, але екземпляри не можуть їм присвоювати.
- Щоб зберегти виграш у підкласі, оголосіть `__slots__` і там, перелічивши лише нові атрибути. `__dict__` зникає, тільки якщо слоти має кожен клас у ланцюжку.
- Додайте `"__weakref__"` чи `"__dict__"` до `__slots__`, щоб повернути ці можливості; `@dataclass(slots=True)` — простий варіант, що підтримує значення за замовчуванням.
- Економія пам'яті реальна, але в сучасному Python помірна; використовуйте слоти для великої кількості простих об'єктів.

## Практика

### Вправа 1: Суворий товар

Створіть клас `Product` зі слотами `name` і `price`. Потім:

1. створіть `Product("Pen", 25)` і виведіть обидва атрибути;
2. спробуйте встановити `product.discount = 10` і виведіть повідомлення про помилку;
3. напишіть клас `BrokenProduct`, в `__init__` якого є одруківка (`self.prise = price`), і покажіть, що створити його екземпляр не вдається.

### Вправа 2: У кого є `__dict__`?

Не запускаючи код, передбачте чотири виведені значення. Потім запустіть його.

```python
class A:
    __slots__ = ("a",)


class B(A):
    pass


class C:
    pass


class D(C):
    __slots__ = ("d",)


class E(A):
    __slots__ = ("e",)


for cls in (B, D, E, A):
    print(cls.__name__, hasattr(cls(), "__dict__"))
```

### Вправа 3: Компактна тривимірна точка

На основі `Point2D(x, y)` зі слотами (код нижче) напишіть `Point3D(x, y, z)` так, щоб:

- він повторно використовував `Point2D.__init__` через `super()`;
- його екземпляри **не** мали `__dict__`;
- `repr()` показував `Point3D(1, 2, 3)`.

Доведіть, що `point.color = "red"` не спрацьовує.

```python
class Point2D:
    __slots__ = ("x", "y")

    def __init__(self, x, y):
        self.x = x
        self.y = y
```

## Розв'язки

### Вправа 1

```python
class Product:
    __slots__ = ("name", "price")

    def __init__(self, name, price):
        self.name = name
        self.price = price


class BrokenProduct:
    __slots__ = ("name", "price")

    def __init__(self, name, price):
        self.name = name
        self.prise = price  # одруківка


product = Product("Pen", 25)
print(product.name, product.price)

try:
    product.discount = 10
except AttributeError as error:
    print(error)

try:
    BrokenProduct("Pen", 25)
except AttributeError as error:
    print(error)
```

Результат:

```text
Pen 25
'Product' object has no attribute 'discount' and no __dict__ for setting new attributes
'BrokenProduct' object has no attribute 'prise' and no __dict__ for setting new attributes
```

### Вправа 2

Результат:

```text
B True
D True
E False
A False
```

- `B` не додає `__slots__`, тому повертає `__dict__`.
- `D` має слоти, але його батько `C` — ні, тож `__dict__` лишається.
- `E` і його батько `A` обидва визначають слоти, тому `__dict__` немає.
- `A` визначає слоти й успадковується лише від `object`.

### Вправа 3

```python
class Point2D:
    __slots__ = ("x", "y")

    def __init__(self, x, y):
        self.x = x
        self.y = y


class Point3D(Point2D):
    __slots__ = ("z",)

    def __init__(self, x, y, z):
        super().__init__(x, y)
        self.z = z

    def __repr__(self):
        return f"Point3D({self.x}, {self.y}, {self.z})"


point = Point3D(1, 2, 3)
print(repr(point))
print(hasattr(point, "__dict__"))

try:
    point.color = "red"
except AttributeError as error:
    print(error)
```

Результат:

```text
Point3D(1, 2, 3)
False
'Point3D' object has no attribute 'color' and no __dict__ for setting new attributes
```

---

*Джерело: [pythontutorial.net — Python `__slots__` (архівна копія у Wayback Machine)](https://web.archive.org/web/2026/https://www.pythontutorial.net/python-oop/python-__slots__/). Адаптовано й доповнено для PyJourney.*
