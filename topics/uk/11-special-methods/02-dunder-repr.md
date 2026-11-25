# __repr__

Кожен об'єкт має два текстові подання: дружнє для користувачів (`str()`) і точне для розробників (`repr()`). Спеціальний метод `__repr__` керує поданням для розробників. Саме цей текст ви бачите в REPL, у виведених списках і словниках, у налагоджувачах і повідомленнях про помилки, тож добрий `__repr__` помітно пришвидшує налагодження.

## Що ви дізнаєтесь

- Що повертає `repr()` за замовчуванням і як змінити це за допомогою `__repr__`
- Домовленість, за якою repr має виглядати як код Python, що відтворює об'єкт
- Чому всередині `__repr__` значення варто форматувати через `!r`
- Як `str()` звертається до `__repr__` як до запасного варіанта, але не навпаки
- Де Python використовує `repr()` автоматично
- Як обирати між `__str__` і `__repr__` і коли доручити написання `__repr__` модулю `dataclasses`

## repr за замовчуванням

Вбудована функція `repr()` запитує в об'єкта його «офіційне» рядкове подання. Якщо нічого не налаштовувати, ви отримаєте загальний текст, успадкований від `object`:

```python
class Person:
    def __init__(self, first_name, last_name, age):
        self.first_name = first_name
        self.last_name = last_name
        self.age = age


person = Person("John", "Doe", 25)
print(repr(person))
```

Результат (адреса змінюється з кожним запуском):

```text
<__main__.Person object at 0x1044712b0>
```

Тут є клас і адреса в пам'яті, але немає даних. Коли в журналі з'являється список із 50 таких об'єктів, розрізнити їх неможливо.

## Реалізація `__repr__`

`__repr__(self)` має повертати `str`. Коли ви викликаєте `repr(obj)`, Python викликає `type(obj).__repr__(obj)`:

```python
class Person:
    def __init__(self, first_name, last_name, age):
        self.first_name = first_name
        self.last_name = last_name
        self.age = age

    def __repr__(self):
        return f'Person("{self.first_name}","{self.last_name}",{self.age})'


person = Person("John", "Doe", 25)
print(repr(person))
print(person)
print([person])
```

Результат:

```text
Person("John","Doe",25)
Person("John","Doe",25)
[Person("John","Doe",25)]
```

Відбулися три речі:

- `repr(person)` використав новий метод.
- `print(person)` теж його використав, бо в класі немає `__str__` (див. правила заміни нижче).
- Список показує свої елементи через `repr()`, тому і його виведення стало зрозумілим.

## Домовленість: repr, що відтворює об'єкт

Документація Python радить, щоб `__repr__` за можливості повертав текст, схожий на коректний вираз Python, який створить об'єкт із таким самим значенням. Тоді розробник, читаючи repr, точно знає, що всередині об'єкта, і навіть може вставити цей текст у REPL.

```python
class Person:
    def __init__(self, first_name, last_name, age):
        self.first_name = first_name
        self.last_name = last_name
        self.age = age

    def __repr__(self):
        return f'Person("{self.first_name}","{self.last_name}",{self.age})'


person = Person("John", "Doe", 25)
clone = eval(repr(person))

print(clone)
print(clone is person)
```

Результат:

```text
Person("John","Doe",25)
False
```

`eval()` створив **новий** об'єкт із тими самими даними. Це не початковий об'єкт `person`. Зверніть увагу й на те, що `clone == person` зараз дає `False`: у класі немає `__eq__`, тому `==` порівнює ідентичність. Це зміниться, коли в наступній темі ви реалізуєте `__eq__`.

> **Зверніть увагу:** обхід `eval(repr(obj))` — це домовленість для налагодження, а не формат серіалізації. Ніколи не викликайте `eval()` для тексту, отриманого від користувачів, із файлів чи з мережі. Для зберігання даних використовуйте `json`, `pickle` (лише для довірених даних) або інший повноцінний формат.

## Беріть значення в лапки через `!r`

Лапки, вписані вручну в попередній `__repr__`, ламаються, щойно значення містить символ лапки:

```python
class Person:
    def __init__(self, first_name, last_name, age):
        self.first_name = first_name
        self.last_name = last_name
        self.age = age

    def __repr__(self):
        return f'Person("{self.first_name}","{self.last_name}",{self.age})'


person = Person('Shaquille "Shaq"', "O'Neal", 52)
print(repr(person))

try:
    eval(repr(person))
except SyntaxError as error:
    print("SyntaxError:", error.msg)
```

Результат:

```text
Person("Shaquille "Shaq"","O'Neal",52)
SyntaxError: invalid syntax. Is this intended to be part of the string?
```

Виправлення — доручити розставляння лапок самому Python. Перетворення `!r` у f-рядку викликає `repr()` для значення, а repr рядка завжди є правильно екранованим рядковим літералом. Числа, `None`, списки та ваші власні об'єкти теж обробляються коректно:

```python
class Person:
    def __init__(self, first_name, last_name, age):
        self.first_name = first_name
        self.last_name = last_name
        self.age = age

    def __repr__(self):
        return f"Person({self.first_name!r}, {self.last_name!r}, {self.age!r})"


person = Person('Shaquille "Shaq"', "O'Neal", 52)
print(repr(person))

clone = eval(repr(person))
print(clone.first_name, clone.last_name)
```

Результат:

```text
Person('Shaquille "Shaq"', "O'Neal", 52)
Shaquille "Shaq" O'Neal
```

> **Порада:** усередині `__repr__` за замовчуванням пишіть `{self.attr!r}` для кожного атрибута. Щось інше знадобиться рідко.

## `str` і `repr` для вбудованих типів

На вбудованих типах різниця добре помітна. `str()` — для людей, `repr()` — однозначний:

```python
import datetime

text = "hello"
print(str(text))
print(repr(text))

day = datetime.date(2026, 11, 25)
print(str(day))
print(repr(day))
print([text, day])
```

Результат:

```text
hello
'hello'
2026-11-25
datetime.date(2026, 11, 25)
['hello', datetime.date(2026, 11, 25)]
```

repr рядка містить лапки, тож одразу видно, де число `1`, а де рядок `'1'`. repr дати показує точний тип і виклик конструктора.

## Як `str()` і `repr()` підміняють одне одного

Типовий `object.__str__` просто викликає `repr(self)`. Отже, `__repr__` слугує запасним варіантом для `str()`, а от `__str__` **ніколи** не використовується як запасний варіант для `repr()`:

| Клас визначає | `str(obj)` / `print(obj)` використовує | `repr(obj)` / контейнери використовують |
|---|---|---|
| нічого | типове `<... object at 0x...>` | типове `<... object at 0x...>` |
| лише `__repr__` | `__repr__` | `__repr__` |
| лише `__str__` | `__str__` | типове `<... object at 0x...>` |
| обидва | `__str__` | `__repr__` |

Ось рядок «лише `__str__`» на практиці:

```python
class OnlyStr:
    def __str__(self):
        return "readable text"


obj = OnlyStr()
print(str(obj))
print(repr(obj))
print([obj])
```

Результат (адреса змінюється):

```text
readable text
<__main__.OnlyStr object at 0x1044712b0>
[<__main__.OnlyStr object at 0x1044712b0>]
```

Саме тому, якщо ви реалізуєте лише один із двох методів, зазвичай це має бути `__repr__`.

Коли є обидва методи, кожен працює для своєї аудиторії:

```python
class Person:
    def __init__(self, first_name, last_name, age):
        self.first_name = first_name
        self.last_name = last_name
        self.age = age

    def __repr__(self):
        return f"Person({self.first_name!r}, {self.last_name!r}, {self.age!r})"

    def __str__(self):
        return f"{self.first_name} {self.last_name} ({self.age})"


person = Person("John", "Doe", 25)
print(person)        # використовує str()
print(repr(person))  # використовує repr()
print([person])      # список використовує repr() для елементів
```

Результат:

```text
John Doe (25)
Person('John', 'Doe', 25)
[Person('John', 'Doe', 25)]
```

## Де Python використовує `repr()` автоматично

- **Інтерактивний інтерпретатор (REPL)** показує repr кожного обчисленого виразу:

  ```python
  >>> import datetime
  >>> day = datetime.date(2026, 11, 25)
  >>> day
  datetime.date(2026, 11, 25)
  >>> print(day)
  2026-11-25
  >>> "hello"
  'hello'
  ```

- **Контейнери**: `list`, `tuple`, `dict`, `set` показують свої елементи через `repr()`.
- **f-рядки**: `f"{obj!r}"` викликає `repr()`, а самодокументована форма `f"{obj=}"` (Python 3.8+) показує вираз і його repr.
- **Налагоджувачі, `pdb` і панелі змінних в IDE** відображають repr.
- **`%r`** у `%`-форматуванні та в повідомленнях `logging`.

```python
class Money:
    def __init__(self, amount, currency):
        self.amount = amount
        self.currency = currency

    def __repr__(self):
        return f"Money({self.amount!r}, {self.currency!r})"


price = Money(9.5, "EUR")
print(f"{price!r}")
print(f"{price=}")
print("Debug: %r" % price)
```

Результат:

```text
Money(9.5, 'EUR')
price=Money(9.5, 'EUR')
Debug: Money(9.5, 'EUR')
```

## Коли об'єкт неможливо відтворити

Деякі об'єкти не можна створити заново простим виразом: відкриті файли, мережеві з'єднання, блокування. Для них прийнято писати опис у **кутових дужках**, щоб ніхто не сприйняв його як код:

```python
class Connection:
    def __init__(self, host, port):
        self.host = host
        self.port = port
        self.is_open = True

    def __repr__(self):
        state = "open" if self.is_open else "closed"
        return f"<{type(self).__name__} {self.host}:{self.port} ({state})>"


conn = Connection("db.example.com", 5432)
print(repr(conn))
conn.is_open = False
print([conn])
```

Результат:

```text
<Connection db.example.com:5432 (open)>
[<Connection db.example.com:5432 (closed)>]
```

Типове `<__main__.Person object at 0x...>` дотримується тієї самої домовленості. Зверніть увагу також на `type(self).__name__`: підкласи `Connection` автоматично показуватимуть назву свого класу.

## Доручіть це `dataclasses`

Для класів, які переважно зберігають дані, декоратор `@dataclass` генерує `__repr__`, що відповідає всім описаним домовленостям:

```python
from dataclasses import dataclass


@dataclass
class Point:
    x: int
    y: int


p = Point(1, 2)
print(p)
print(eval(repr(p)) == p)
```

Результат:

```text
Point(x=1, y=2)
True
```

`dataclass` генерує також `__eq__`, тому тут результат обходу виявляється рівним оригіналу.

## Граничний випадок: об'єкти, що посилаються один на одного

Якщо два об'єкти включають одне одного у свій repr, `repr()` ніколи не завершиться:

```python
import reprlib


class Player:
    def __init__(self, name):
        self.name = name
        self.partner = None

    def __repr__(self):
        return f"Player({self.name!r}, partner={self.partner!r})"


class SafePlayer(Player):
    @reprlib.recursive_repr()
    def __repr__(self):
        return f"SafePlayer({self.name!r}, partner={self.partner!r})"


a, b = Player("Ann"), Player("Bob")
a.partner, b.partner = b, a
try:
    print(repr(a))
except RecursionError as error:
    print("RecursionError:", error)

c, d = SafePlayer("Cat"), SafePlayer("Dan")
c.partner, d.partner = d, c
print(repr(c))
```

Результат:

```text
RecursionError: maximum recursion depth exceeded
SafePlayer('Cat', partner=SafePlayer('Dan', partner=...))
```

Декоратор `reprlib.recursive_repr()` помічає цикл і замість нового рекурсивного виклику виводить `...`. Вбудовані контейнери роблять це самі: список, що містить сам себе, виводиться як `[[...]]`.

## Типові помилки

- **Вписувати лапки вручну.** `f'Person("{self.name}")'` ламається на іменах із лапками й перетворює `None` на `"None"`. Пишіть `{self.name!r}`.
- **Реалізувати лише `__str__`.** Списки, REPL і налагоджувачі все одно показуватимуть `<... object at 0x...>`. Якщо пишете лише один метод, пишіть `__repr__`.
- **Робити `__repr__` дружнім замість точного.** `John Doe` — добрий `__str__`, але поганий repr: він приховує тип і точні значення.
- **Жорстко вписувати назву класу.** Використовуйте `type(self).__name__`, щоб підкласи показували свою назву.
- **Повертати не рядок або виводити текст.** `__repr__` має повертати `str`, інакше ви отримаєте `TypeError: __repr__ returned non-string`.
- **Використовувати `eval(repr(obj))` для зберігання даних.** Це лише домовленість для зручного читання, а `eval()` для недовіреного введення — діра в безпеці.

## Підсумок

- `repr(obj)` викликає `__repr__`, який повертає однозначний текст об'єкта, орієнтований на розробника.
- За домовленістю repr виглядає як виклик конструктора, що створив би рівний об'єкт; якщо це неможливо, використовуйте `<...>` з корисними подробицями.
- Усередині `__repr__` форматуйте атрибути через `!r`, щоб лапки були правильними.
- Типовий `__str__` звертається до `__repr__`, але `repr()` ніколи не звертається до `__str__`.
- REPL, контейнери, `!r`, `f"{x=}"`, налагоджувачі та `%r` використовують `repr()`.
- `__str__` — для користувачів, `__repr__` — для розробників; спершу реалізуйте `__repr__`.
- `@dataclass` автоматично генерує добрий `__repr__`, а `reprlib.recursive_repr()` захищає від циклів.

## Практика

### Вправа 1: `Point` з обходом через eval

Напишіть клас `Point` з `x` і `y`. Його `__repr__` має давати текст на кшталт `Point(3, -1.5)`. Покажіть, що `eval(repr(p))` створює інший об'єкт із тими самими координатами.

### Вправа 2: Виправте зламаний repr

Цей клас генерує repr, який не є коректним кодом Python, і перетворює `None` на рядок. Запустіть код, знайдіть обидві проблеми й виправте метод.

```python
class Book:
    def __init__(self, title, author):
        self.title = title
        self.author = author

    def __repr__(self):
        return f'Book("{self.title}", "{self.author}")'


books = [Book('The "Best" Book', "Anonymous"), Book("Untitled", None)]
print(books)
```

### Вправа 3: Передбачте результат

Передбачте кожен рядок, перш ніж запускати код:

```python
class Money:
    def __init__(self, amount, currency):
        self.amount = amount
        self.currency = currency

    def __repr__(self):
        return f"Money({self.amount!r}, {self.currency!r})"

    def __str__(self):
        return f"{self.amount:.2f} {self.currency}"


price = Money(9.5, "EUR")
print(price)
print(str(price))
print([price])
print(f"{price!r}")
print(f"{price=}")
print(f"Total: {price}")
```

### Вправа 4: Один `__repr__` для всієї ієрархії

Напишіть базовий клас `Shape` з єдиним `__repr__`, який працює для будь-якого підкласу: він має показувати назву підкласу та всі атрибути екземпляра як іменовані аргументи. `Circle(2)` має виводитися як `Circle(radius=2)`, а `Rect(3, 4.5)` — як `Rect(width=3, height=4.5)`. Підказка: `vars(self)` повертає словник атрибутів екземпляра.

## Розв'язки

### Вправа 1

```python
class Point:
    def __init__(self, x, y):
        self.x = x
        self.y = y

    def __repr__(self):
        return f"Point({self.x!r}, {self.y!r})"


p = Point(3, -1.5)
text = repr(p)
print(text)

clone = eval(text)
print(clone)
print(clone is p)
print((clone.x, clone.y) == (p.x, p.y))
```

Результат:

```text
Point(3, -1.5)
Point(3, -1.5)
False
True
```

### Вправа 2

Початковий код виводить:

```text
[Book("The "Best" Book", "Anonymous"), Book("Untitled", "None")]
```

Проблема 1: лапки всередині назви передчасно завершують рядковий літерал, тож текст не є коректним кодом Python. Проблема 2: `None` береться в лапки й перетворюється на рядок `"None"`. Обидві проблеми зникають завдяки `!r`:

```python
class Book:
    def __init__(self, title, author):
        self.title = title
        self.author = author

    def __repr__(self):
        return f"Book({self.title!r}, {self.author!r})"


books = [Book('The "Best" Book', "Anonymous"), Book("Untitled", None)]
print(books)
print(eval(repr(books[0])).title)
```

Результат:

```text
[Book('The "Best" Book', 'Anonymous'), Book('Untitled', None)]
The "Best" Book
```

### Вправа 3

Результат:

```text
9.50 EUR
9.50 EUR
[Money(9.5, 'EUR')]
Money(9.5, 'EUR')
price=Money(9.5, 'EUR')
Total: 9.50 EUR
```

`print()`, `str()` і звичайне `{price}` використовують `__str__`. Список, `!r` і специфікатор `=` використовують `__repr__`.

### Вправа 4

```python
class Shape:
    def __repr__(self):
        args = ", ".join(f"{name}={value!r}" for name, value in vars(self).items())
        return f"{type(self).__name__}({args})"


class Circle(Shape):
    def __init__(self, radius):
        self.radius = radius


class Rect(Shape):
    def __init__(self, width, height):
        self.width = width
        self.height = height


shapes = [Circle(2), Rect(3, 4.5)]
print(shapes)
print(eval(repr(shapes[1])).height)
```

Результат:

```text
[Circle(radius=2), Rect(width=3, height=4.5)]
4.5
```

`vars(self)` зберігає порядок, у якому `__init__` створив атрибути, а `type(self).__name__` бере назву фактичного підкласу. Форма з іменованими аргументами `Rect(width=3, height=4.5)` теж є коректним кодом Python, тому обхід через `eval` працює.

---

*Джерело: [pythontutorial.net — Python __repr__](https://web.archive.org/web/2026/https://www.pythontutorial.net/python-oop/python-__repr__/). Адаптовано й доповнено для PyJourney.*
