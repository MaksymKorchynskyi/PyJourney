# Метод __new__

Виклик класу, наприклад `Person("John")`, виглядає як одна дія, але насправді Python робить дві речі: `__new__` **створює** об'єкт, а `__init__` **ініціалізує** його. Перевизначати `__new__` доводиться рідко, проте це єдиний гачок, який спрацьовує *ще до того*, як об'єкт з'явився. Саме тому він потрібен, коли ви успадковуєтеся від незмінюваних типів на кшталт `int` і `str` або хочете керувати тим, який об'єкт поверне виклик класу.

## Що ви дізнаєтесь

- Як Python створює об'єкт у два кроки: спершу `__new__`, потім `__init__`
- Яку сигнатуру має `__new__` і чому він отримує клас, а не екземпляр
- Як відтворити `Person("John")` вручну і чому `pickle` та `copy` не викликають `__init__`
- Коли Python викликає `__init__` після `__new__`, а коли мовчки його пропускає
- Чому підкласам незмінюваних типів (`int`, `str`, `tuple`) потрібен `__new__`
- Практичні прийоми (перевірені незмінювані значення, кешовані екземпляри) і випадки, коли `__new__` не потрібен

## Два кроки створення об'єкта

Додамо `print()` в обидва методи, щоб побачити, у якому порядку Python їх викликає:

```python
class Person:
    def __new__(cls, name):
        print(f"__new__ called: creating a {cls.__name__} object")
        obj = super().__new__(cls)
        print(f"__new__ returns the object, __dict__ = {obj.__dict__}")
        return obj

    def __init__(self, name):
        print(f"__init__ called: setting name to {name!r}")
        self.name = name


person = Person("John")
print(person.name)
```

Результат:

```text
__new__ called: creating a Person object
__new__ returns the object, __dict__ = {}
__init__ called: setting name to 'John'
John
```

`__new__` отримує клас (`cls`) та аргументи виклику. Його завдання — створити об'єкт і **повернути** його. У цей момент об'єкт уже існує, але ще не має атрибутів, тому його `__dict__` порожній. Далі Python передає ті самі аргументи в `__init__`, і той заповнює атрибути. `__init__` повертає `None`, а викликач отримує той об'єкт, який повернув `__new__`.

```text
Person("John")
   |
   |  1. obj = Person.__new__(Person, "John")    створити порожній об'єкт
   |  2. if isinstance(obj, Person):
   |         obj.__init__("John")                 заповнити його атрибути
   |  3. return obj
   v
person
```

Хто виконує цей алгоритм? Клас можна викликати, бо його власний тип, `type`, визначає метод `__call__`, і саме `type.__call__` проходить ці кроки. На цьому ґрунтуються наступні теми про `type` і метакласи.

## Сигнатура `__new__`

```python
object.__new__(cls, *args, **kwargs)
```

- `cls` — клас, екземпляр якого треба створити. Python передає його автоматично, так само як `self` у звичайні методи. Екземпляра ще немає, тож `self` метод `__new__` отримати не може.
- Решта аргументів — це саме ті аргументи, які передали у виклик класу. Пізніше ті самі аргументи потраплять у `__init__`, тому обидва методи зазвичай мають однакові параметри.
- `__new__` — **статичний метод**. Python сам загортає його в `staticmethod`, коли створює клас, тож писати `@staticmethod` не потрібно:

```python
class Person:
    def __new__(cls, name):
        return super().__new__(cls)

    def __init__(self, name):
        self.name = name


print(type(Person.__dict__["__new__"]))
print(type(Person.__dict__["__init__"]))
```

Результат:

```text
<class 'staticmethod'>
<class 'function'>
```

Щоб справді створити об'єкт, викличте реалізацію батьківського класу: `super().__new__(cls)`. Для звичайного класу виклик дійде до `object.__new__`, який виділяє порожній екземпляр `cls`. Передавайте йому **лише** `cls`: якщо ви перевизначили `__new__`, `object.__new__` не приймає інших аргументів виклику (див. розділ *Типові помилки*). Із вбудованими незмінюваними типами інакше: `int.__new__(cls, value)` і `str.__new__(cls, text)` потребують значення, бо саме там воно й записується в об'єкт.

## Створення об'єкта вручну

Обидва кроки можна виконати самостійно. Так добре видно, що робить кожен метод:

```python
class Person:
    def __init__(self, name):
        self.name = name


# що робить Person("John"), крок за кроком
person = object.__new__(Person)
print(type(person).__name__, person.__dict__)

person.__init__("John")
print(type(person).__name__, person.__dict__)
```

Результат:

```text
Person {}
Person {'name': 'John'}
```

Після `object.__new__(Person)` об'єкт уже є екземпляром `Person`, але атрибута `name` у нього немає. Його додає лише виклик `__init__`. Якщо ви викликаєте `__new__` напряму, ніхто не викличе `__init__` за вас. Обидва кроки виконує тільки виклик класу `Person(...)`.

> **Зверніть увагу:** у деяких посібниках пишуть `object.__new__(Person, "John")`. Це працює лише тому, що `Person` перевизначає `__init__`, але не `__new__`, і зайвий аргумент мовчки ігнорується. Передавайте тільки клас.

### Де Python навмисно пропускає `__init__`

Саме так створюють об'єкти `pickle` і `copy`. Вони викликають `cls.__new__(cls)`, а потім записують збережені атрибути просто в `__dict__`, не запускаючи `__init__`:

```python
import pickle


class Account:
    def __init__(self, owner):
        print(f"__init__ runs for {owner}")
        self.owner = owner


original = Account("Olena")
data = pickle.dumps(original)

print("Unpickling...")
restored = pickle.loads(data)
print(restored.owner, restored is original)
```

Результат:

```text
__init__ runs for Olena
Unpickling...
Olena False
```

Відновлений об'єкт має правильні атрибути, але `__init__` вдруге так і не запустився. Якщо ваш `__init__` має важливі побічні ефекти (реєструє об'єкт деінде, відкриває файл), для десеріалізованих чи скопійованих об'єктів вони не відбудуться.

## Коли `__init__` виконується, а коли ні

Коли `__new__` повертає результат, Python перевіряє його:

- якщо це екземпляр `cls` (або його підкласу), Python викликає його `__init__` з тими самими аргументами;
- інакше Python **пропускає** `__init__`, і викликач просто отримує те, що повернув `__new__`.

```python
class Weird:
    def __new__(cls):
        return "I am a string, not a Weird"

    def __init__(self):
        print("__init__ called")


w = Weird()
print(w, type(w))
```

Результат:

```text
I am a string, not a Weird <class 'str'>
```

`__init__` так і не викликався, а `Weird()` навіть не створив об'єкт `Weird`. Це дозволено, але дуже дивує читача коду, тож повертайте об'єкт іншого типу лише за вагомої причини.

Найчастіше на це правило натрапляють випадково, коли забувають `return`:

```python
class Person:
    def __new__(cls, name):
        obj = super().__new__(cls)
        # забули: return obj

    def __init__(self, name):
        print("__init__ called")
        self.name = name


person = Person("John")
print(person)
```

Результат:

```text
None
```

Функція без `return` повертає `None`. `None` не є екземпляром `Person`, тому `__init__` пропускається, а `person` дорівнює `None`, і жодної помилки ви не побачите.

## Успадкування від незмінюваних типів

Це головне практичне застосування `__new__`. Ось підклас `int`, який зберігає квадрат свого аргументу:

```python
class SquareNumber(int):
    def __new__(cls, value):
        return super().__new__(cls, value ** 2)


x = SquareNumber(3)
print(x)
print(type(x).__name__)
print(isinstance(x, int))
print(x + 1, type(x + 1).__name__)
```

Результат:

```text
9
SquareNumber
True
10 int
```

`x` — це `SquareNumber` і водночас `int`, тому він працює всюди, де очікують ціле число.

Чому цього не можна зробити в `__init__`? `int`, `float`, `str`, `tuple`, `bytes` і `frozenset` **незмінювані**. Їхнє значення фіксується під час створення об'єкта, тобто всередині `__new__`. Коли запускається `__init__`, об'єкт `3` уже існує, і змінити його неможливо. Спроба закінчується помилкою:

```python
class SquareNumber(int):
    def __init__(self, value):
        super().__init__(value ** 2)


x = SquareNumber(3)
```

Результат:

```text
Traceback (most recent call last):
  File "app.py", line 6, in <module>
    x = SquareNumber(3)
  File "app.py", line 3, in __init__
    super().__init__(value ** 2)
    ~~~~~~~~~~~~~~~~^^^^^^^^^^^^
TypeError: object.__init__() takes exactly one argument (the instance to initialize)
```

`int` не має власного `__init__`, тому `super().__init__` доходить до `object.__init__`, а той не приймає додаткових аргументів. І навіть без помилки змінювати було б нічого: присвоєння `self` всередині `__init__` лише перев'язує локальне ім'я.

```python
class SquareNumber(int):
    def __init__(self, value):
        self = value ** 2  # лише перев'язує локальне ім'я


x = SquareNumber(3)
print(x)
```

Результат:

```text
3
```

Реалістичніший приклад — рядковий тип, який один раз, під час створення, нормалізує і перевіряє своє значення:

```python
class Tag(str):
    def __new__(cls, text):
        normalized = text.strip().lower().replace(" ", "-")
        if not normalized:
            raise ValueError("a tag cannot be empty")
        return super().__new__(cls, normalized)


tag = Tag("  Python Basics ")
print(repr(tag))
print(tag.upper())
print(tag == "python-basics")
print({tag: 1}["python-basics"])
```

Результат:

```text
'python-basics'
PYTHON-BASICS
True
1
```

Кожен `Tag` гарантовано «чистий», і водночас поводиться як звичайний `str`: має всі методи рядків, дорівнює звичайним рядкам і може бути ключем словника.

> **Порада:** операції над підкласом вбудованого типу зазвичай повертають *базовий* тип. Вище `x + 1` — це звичайний `int`, а не `SquareNumber`, а `tag.upper()` — звичайний `str`. Якщо потрібно зберегти підклас, перевизначте відповідні методи.

## Встановлення атрибутів у `__new__`

`__new__` тримає новий об'єкт у руках до того, як поверне його, тож може й задати атрибути:

```python
class Person:
    def __new__(cls, first_name, last_name):
        # створюємо новий об'єкт
        obj = super().__new__(cls)

        # ініціалізуємо атрибути
        obj.first_name = first_name
        obj.last_name = last_name

        # додаємо ще один атрибут
        obj.full_name = f"{first_name} {last_name}"
        return obj


person = Person("John", "Doe")
print(person.full_name)
print(person.__dict__)
```

Результат:

```text
John Doe
{'first_name': 'John', 'last_name': 'Doe', 'full_name': 'John Doe'}
```

Це працює, і деякі посібники роблять висновок, що після перевизначення `__new__` метод `__init__` уже не потрібен. На практиці краще дотримуватися протилежного правила: звичайне налаштування атрибутів робіть у `__init__`, а `__new__` використовуйте лише для того, чого `__init__` зробити **не може**. І читачі коду, і IDE, і підкласи очікують ініціалізацію саме в `__init__`. Для класу на зразок цього `Person` метод `__new__` не дає нічого, крім несподіванки.

## Керування кількістю об'єктів

Оскільки саме `__new__` вирішує, який об'єкт повернути, він може повернути об'єкт, який **уже існує**. Так часто пишуть одинака (singleton) — клас, що має лише один екземпляр. Проте тут є пастка:

```python
class Config:
    _instance = None

    def __new__(cls):
        if cls._instance is None:
            print("Creating the only Config object")
            cls._instance = super().__new__(cls)
        return cls._instance

    def __init__(self):
        print("__init__ called")
        self.debug = False


first = Config()
first.debug = True

second = Config()
print(first is second)
print(first.debug)
```

Результат:

```text
Creating the only Config object
__init__ called
__init__ called
True
False
```

Об'єкт справді один, але `__init__` спрацював під час **кожного** виклику, бо щоразу `__new__` повертав екземпляр `Config`. Другий виклик непомітно скинув `debug` назад у `False`. Одне з рішень — перенести одноразове налаштування в `__new__`, туди, де об'єкт створюється, і прибрати `__init__`:

```python
class Config:
    _instance = None

    def __new__(cls):
        if cls._instance is None:
            print("Creating the only Config object")
            instance = super().__new__(cls)
            instance.debug = False  # одноразове налаштування тут
            cls._instance = instance
        return cls._instance


first = Config()
first.debug = True

second = Config()
print(first is second)
print(second.debug)
```

Результат:

```text
Creating the only Config object
True
True
```

> **Зверніть увагу:** у реальних проєктах клас-одинак потрібен рідко. Модуль імпортується лише один раз, тому об'єкт, створений на рівні модуля (`config = Config()`), уже й так «єдиний». Використовуйте для цього `__new__`, коли обмеження має забезпечувати сам клас.

## `__new__` і `__init__`: порівняння

| | `__new__` | `__init__` |
|---|---|---|
| Перший параметр | `cls`, клас | `self`, новий об'єкт |
| Вид методу | статичний (додається автоматично) | звичайний метод екземпляра |
| Завдання | створити й повернути об'єкт | налаштувати вже наявний об'єкт |
| Що повертає | об'єкт (зазвичай екземпляр `cls`) | має повертати `None` |
| Коли виконується | першим, під час кожного виклику класу | після `__new__`, лише якщо той повернув екземпляр `cls` |
| Типове застосування | підкласи незмінюваних типів, кешування, одинаки | майже все інше |

## Типові помилки

- **Забути `return` у `__new__`.** Тоді виклик класу повертає `None`, `__init__` пропускається, а повідомлення про помилку немає.
- **Передавати аргументи виклику в `object.__new__`.** Якщо ви перевизначили `__new__`, викликайте `super().__new__(cls)` лише з класом:

  ```python
  class Person:
      def __new__(cls, name):
          return super().__new__(cls, name)

      def __init__(self, name):
          self.name = name


  person = Person("John")
  ```

  Результат:

  ```text
  Traceback (most recent call last):
    File "app.py", line 9, in <module>
      person = Person("John")
    File "app.py", line 3, in __new__
      return super().__new__(cls, name)
             ~~~~~~~~~~~~~~~^^^^^^^^^^^
  TypeError: object.__new__() takes exactly one argument (the type to instantiate)
  ```

- **Намагатися змінити незмінюване значення в `__init__`.** Для підкласів `int`, `str`, `tuple` та інших подібних типів значення треба задавати в `__new__`.
- **Очікувати, що `__init__` виконається для кешованого об'єкта лише раз.** Якщо `__new__` повертає вже наявний екземпляр класу, `__init__` знову запускається для нього і може перезаписати його стан.
- **Використовувати `__new__` для звичайного налаштування.** Це працює, але клас стає складнішим для читання і для успадкування. Для цього є `__init__`.
- **Покладатися на побічні ефекти `__init__` під час копіювання.** `pickle.loads()`, `copy.copy()` і `copy.deepcopy()` створюють об'єкти без виклику `__init__`.

## Підсумок

- Виклик класу виконує два кроки: `__new__(cls, ...)` створює об'єкт, потім `__init__(self, ...)` ініціалізує його.
- `__new__` — статичний метод, який отримує клас. Обгортку `staticmethod` Python додає автоматично.
- Створюйте об'єкт через `super().__new__(cls)` і завжди повертайте його через `return`.
- `__init__` виконується, лише якщо `__new__` повернув екземпляр класу. Інакше його пропущено.
- Незмінювані вбудовані типи отримують значення в `__new__`, тому підкласи `int`, `str` чи `tuple` мають налаштовувати `__new__`, а не `__init__`.
- `__new__` може повертати вже наявний об'єкт (кешування, одинаки), але тоді `__init__` запускається під час кожного виклику.
- `pickle` і `copy` створюють об'єкти через `__new__` і пропускають `__init__`.
- Для повсякденних класів досить `__init__`. Беріться за `__new__`, лише коли `__init__` не може впоратися із завданням.

## Практика

### Вправа 1: Передбачте результат

Не запускаючи код, запишіть, що він виведе. Потім запустіть і перевірте.

```python
class Box:
    def __new__(cls, value):
        print("new", value)
        if value < 0:
            return None
        return super().__new__(cls)

    def __init__(self, value):
        print("init", value)
        self.value = value


a = Box(5)
b = Box(-1)
print(type(a).__name__, b)
```

### Вправа 2: Лише додатні цілі числа

Напишіть клас `PositiveInt`, що успадковується від `int`. Створення з нулем чи від'ємним значенням має генерувати `ValueError` зі зрозумілим повідомленням. Клас має приймати все, що приймає `int()`, тож `PositiveInt("7")` — коректний виклик.

### Вправа 3: Незмінювана точка

Напишіть клас `Point`, що успадковується від `tuple` і створюється як `Point(3, 4)`. Додайте властивості лише для читання `x` і `y` та метод `__repr__`, який повертає `Point(x=3, y=4)`. Перевірте, що точка дорівнює кортежу `(3, 4)`, розпаковується через `x, y = p`, а `p.x = 10` генерує `AttributeError`.

### Вправа 4: Один об'єкт на колір

Напишіть клас `Color` так, щоб `Color("red")` і `Color("RED")` повертали **той самий об'єкт**, а `Color("blue")` — інший. Зберігайте назву в нижньому регістрі в атрибуті `name` і рахуйте фактично створені об'єкти в атрибуті класу `created`. Переконайтеся, що повторні виклики не скидають жодного стану.

## Розв'язки

### Вправа 1

Результат:

```text
new 5
init 5
new -1
Box None
```

`Box(5)` повертає новий `Box`, тому `__init__` виконується. Для `Box(-1)` метод `__new__` повертає `None`. Це не `Box`, тож `__init__` пропускається, а `b` дорівнює `None`.

### Вправа 2

```python
class PositiveInt(int):
    def __new__(cls, value):
        number = super().__new__(cls, value)
        if number <= 0:
            raise ValueError(f"expected a positive integer, got {number}")
        return number


print(PositiveInt(42))
print(PositiveInt("7") + 1)
print(isinstance(PositiveInt(3), int))

try:
    PositiveInt(0)
except ValueError as error:
    print("Error:", error)
```

Результат:

```text
42
8
True
Error: expected a positive integer, got 0
```

Перетворення (зокрема з рядка) виконує `int.__new__`, а перевірка відбувається над уже готовим числом, перш ніж його буде повернуто.

### Вправа 3

```python
class Point(tuple):
    def __new__(cls, x, y):
        return super().__new__(cls, (x, y))

    @property
    def x(self):
        return self[0]

    @property
    def y(self):
        return self[1]

    def __repr__(self):
        return f"Point(x={self.x}, y={self.y})"


p = Point(3, 4)
print(p)
print(p.x, p.y)
print(p == (3, 4))
x, y = p
print(x + y)

try:
    p.x = 10
except AttributeError as error:
    print("Error:", error)
```

Результат:

```text
Point(x=3, y=4)
3 4
True
7
Error: property 'x' of 'Point' object has no setter
```

`tuple.__new__` очікує один ітерований об'єкт, тому `__new__` пакує `x` і `y` в кортеж `(x, y)`. У стандартній бібліотеці є готова реалізація цієї ідеї: `collections.namedtuple` і `typing.NamedTuple`.

### Вправа 4

```python
class Color:
    _cache = {}
    created = 0

    def __new__(cls, name):
        key = name.lower()
        if key not in cls._cache:
            obj = super().__new__(cls)
            obj.name = key
            cls._cache[key] = obj
            cls.created += 1
        return cls._cache[key]

    def __repr__(self):
        return f"Color({self.name!r})"


red1 = Color("red")
red2 = Color("RED")
blue = Color("blue")

print(red1, red2, blue)
print(red1 is red2)
print(Color.created)
```

Результат:

```text
Color('red') Color('red') Color('blue')
True
2
```

Атрибути задаються лише тоді, коли створюється новий об'єкт, а `__init__` у класі немає, тож повторні виклики нічого не перезапишуть.

---

*Джерело: [pythontutorial.net — Python `__new__`](https://web.archive.org/web/2026/https://www.pythontutorial.net/python-oop/python-__new__/) (архівна копія). Адаптовано й доповнено для PyJourney.*
