# Клас type

У Python усе є об'єктом, і класи теж. Клас — це такий самий об'єкт, а класом цього об'єкта є `type`. Розуміння цього пояснює, що насправді робить інструкція `class`, дає змогу створювати класи під час виконання програми і лежить в основі метакласів.

## Що ви дізнаєтесь

- Чому класи — звичайні об'єкти і чому їхній тип — `type`
- Два способи викликати `type`: `type(obj)` і `type(name, bases, namespace)`
- Що Python робить крок за кроком, коли виконує інструкцію `class`
- Як створювати класи динамічно, з методами, атрибутами класу та успадкуванням
- Як пов'язані між собою `type` і `object` на вершині ієрархії
- Чому `type` називають метакласом

## Класи — це об'єкти

Візьмімо звичайний клас:

```python
class Person:
    def __init__(self, name, age):
        self.name = name
        self.age = age

    def greeting(self):
        return f"Hi, I am {self.name}. I am {self.age} years old."


print(type(Person))
print(isinstance(Person, type))

# клас — звичайний об'єкт: його можна зберігати, передавати й викликати
factory = Person
people = [factory("John", 25), factory("Olena", 31)]
print(people[1].greeting())
print(Person.__name__, factory is Person)
```

Результат:

```text
<class 'type'>
True
Hi, I am Olena. I am 31 years old.
Person True
```

`Person` — це об'єкт класу `type`, так само як `42` — об'єкт класу `int`. Як і будь-який об'єкт, клас можна присвоїти іншому імені, покласти в список, передати у функцію і дослідити через його атрибути (`__name__`, `__dict__`, `__bases__`). Виклик класу створює екземпляри.

Те саме стосується вбудованих класів і навіть самого `type`:

```python
class Person:
    pass


print(type(42))
print(type("hello"))
print(type(Person()))
print(type(Person))
print(type(int))
print(type(type))
```

Результат:

```text
<class 'int'>
<class 'str'>
<class '__main__.Person'>
<class 'type'>
<class 'type'>
<class 'type'>
```

```text
 об'єкт          його клас        клас класу
 Person()  --->  Person    --->   type
 42        --->  int       --->   type
 Person    --->  type      --->   type   (type(type) is type)
```

## Два способи викликати `type`

`type` поводиться по-різному залежно від кількості аргументів:

| Виклик | Результат |
|---|---|
| `type(obj)` | клас об'єкта `obj` |
| `type(name, bases, namespace)` | **новий клас** |

Форма з трьома аргументами — це «конструктор» класів:

- `name` — рядок, який стане атрибутом `__name__` класу, наприклад `"Person"`.
- `bases` — **кортеж** базових класів, наприклад `(object,)` або `(Person,)`. Порожній кортеж `()` означає «успадковуватися лише від `object`».
- `namespace` — словник атрибутів і методів класу. Його елементи копіюються в `__dict__` класу.

Будь-яка інша кількість аргументів — помилка (див. розділ *Типові помилки*).

## Що відбувається, коли Python виконує інструкцію `class`

Інструкція `class` — це зручний спосіб викликати `type` з трьома аргументами. Коли Python доходить до неї, він:

1. Обчислює базові класи і визначає, який **метаклас** використати. За замовчуванням це `type`.
2. Готує новий **простір імен** (namespace), зазвичай порожній словник (його створює метод метакласу `__prepare__`).
3. **Виконує тіло класу** в цьому просторі імен. Тіло вже скомпільоване в байт-код разом з усім модулем, тож це звичайне виконання коду. Кожна інструкція `def` і кожне присвоєння в тілі стають ключами простору імен.
4. Викликає `metaclass(name, bases, namespace)`, тобто за замовчуванням `type("Person", (object,), namespace)`, і прив'язує отриманий об'єкт класу до імені `Person`.

Крок 3 можна підгледіти, якщо вивести простір імен із тіла класу:

```python
class Demo:
    x = 1

    def hello(self):
        return "hi"

    print(sorted(locals()))
```

Результат (Python 3.14):

```text
['__firstlineno__', '__module__', '__qualname__', 'hello', 'x']
```

Крім ваших `x` і `hello`, Python сам додав у простір імен кілька записів: `__module__` (модуль, де визначено клас), `__qualname__` (кваліфіковане ім'я) і, починаючи з Python 3.13, `__firstlineno__` (рядок, з якого починається клас).

> **Зверніть увагу:** у деяких посібниках пишуть, що Python «витягує тіло класу як рядок» і виконує його. Насправді це не так. Тіло компілюється один раз, разом із модулем, а його код виконується тоді, коли виконується інструкція `class`. Приклад з `exec()` нижче лише *імітує* цей процес за допомогою рядка.

## Імітація інструкції `class`

Щоб переконатися, що інструкція `class` — «просто» виклик `type`, повторімо її кроки вручну. Тут `exec()` виконує роль тіла класу:

```python
class_body = """
def __init__(self, name, age):
    self.name = name
    self.age = age

def greeting(self):
    return f'Hi, I am {self.name}. I am {self.age} years old.'
"""

# 1. простір імен для класу
class_dict = {}

# 2. виконуємо тіло в цьому просторі імен
exec(class_body, globals(), class_dict)
print(list(class_dict))

# 3. створюємо об'єкт класу
Person = type("Person", (object,), class_dict)

print(type(Person))
print(isinstance(Person, type))
print(list(Person.__dict__))

john = Person("John", 25)
print(john.greeting())
```

Результат:

```text
['__init__', 'greeting']
<class 'type'>
True
['__init__', 'greeting', '__module__', '__dict__', '__weakref__', '__doc__']
Hi, I am John. I am 25 years old.
```

Як це працює:

- `exec(class_body, globals(), class_dict)` виконує дві інструкції `def`. Оскільки `class_dict` передано як *локальний* простір імен, нові функції потрапляють саме туди, а не в глобальні імена модуля.
- `type("Person", (object,), class_dict)` перетворює цей словник на справжній клас. `type` копіює функції в `__dict__` класу і додає кілька стандартних записів: `__module__`, `__doc__`, а також дескриптори `__dict__` і `__weakref__`, які дають екземплярам словник атрибутів і підтримку слабких посилань.
- Результат — звичайний клас, що працює так само, як написаний через `class`.

> **Порада:** `exec()` тут лише для того, щоб показати кроки. У реальному коді він для створення класу не потрібен: у `type()` можна передати звичайні функції, як показано в наступному розділі. До того ж виконання рядків як коду небезпечне, якщо хоч частина рядка надходить від користувачів.

## Створення класів безпосередньо через `type()`

Оголосіть методи як звичайні функції (кожна так само приймає `self`) і передайте їх у просторі імен:

```python
def init(self, name):
    self.name = name


def greeting(self):
    return f"Hi, I am {self.name}."


Person = type("Person", (), {
    "species": "human",
    "__init__": init,
    "greeting": greeting,
})

Employee = type("Employee", (Person,), {
    "greeting": lambda self: Person.greeting(self) + " I work here.",
})

olena = Employee("Olena")
print(olena.greeting())
print(olena.species)
print(Employee.__mro__)
print(Person.__bases__)
```

Результат:

```text
Hi, I am Olena. I work here.
human
(<class '__main__.Employee'>, <class '__main__.Person'>, <class 'object'>)
(<class 'object'>,)
```

- `"species": "human"` стає атрибутом класу, спільним для всіх екземплярів.
- `Employee` успадковується від `Person`, бо його кортеж `bases` — це `(Person,)`. Він перевизначає `greeting`, а `__init__` і `species` успадковує.
- `()` у ролі `bases` дав класу `Person` базовий клас `object`, точно як `class Person:`.

Коли це корисно? Тоді, коли *форма* класу стає відомою лише під час виконання: генерування класів за конфігураційним файлом чи схемою бази даних, створення багатьох схожих тестових класів або класів винятків у циклі, написання фабрик класів на кшталт `collections.namedtuple`. Більшість повсякденного коду зрозуміліша з інструкцією `class`.

Клас, створений через `type()`, відрізняється від створеного інструкцією `class` однією дрібницею: у ньому немає записів, які додає компілятор, як-от `__firstlineno__` і `__static_attributes__` (Python 3.13+), бо вихідного коду не було:

```python
class Person:
    pass


Person2 = type("Person", (), {})
print(sorted(Person.__dict__))
print(sorted(Person2.__dict__))
print(Person.__module__, Person2.__module__)
```

Результат (Python 3.14):

```text
['__dict__', '__doc__', '__firstlineno__', '__module__', '__static_attributes__', '__weakref__']
['__dict__', '__doc__', '__module__', '__weakref__']
__main__ __main__
```

## `type` і `object` на вершині ієрархії

Уся система тримається на двох вбудованих класах:

- `object` — **базовий клас** для кожного класу. `type` теж успадковується від нього.
- `type` — **клас кожного класу**, зокрема й `object`, і самого себе.

```python
print(isinstance(type, type))
print(isinstance(object, type))
print(issubclass(type, object))
print(type.__bases__)
print(object.__bases__)
```

Результат:

```text
True
True
True
(<class 'object'>,)
()
```

```text
          «є екземпляром»                «успадковується від»

   object ----------> type          type ----------> object
   Person ----------> type          Person --------> object
   type   ----------> type          object --------> (нічого)
```

Це схоже на замкнене коло, і так воно і є: інтерпретатор створює `type` і `object` в особливий спосіб під час запуску, щоб кожен із них міг посилатися на інший.

## Чому `type` називають метакласом

**Метаклас** (metaclass) — це клас, екземпляри якого є класами. Звичайні класи створюють об'єкти. `type` створює класи, отже, `type` — метаклас. Більше того, це метаклас *за замовчуванням*, який Python використовує для кожної інструкції `class`.

Оскільки `type` — клас, від нього можна успадковуватися і перевизначати його методи (наприклад, `__new__`). Так з'являється власний метаклас, який може змінити спосіб створення класів. Саме про це наступна тема.

## Типові помилки

- **Перевіряти тип через `type(x) == SomeClass`.** Така перевірка ігнорує успадкування. Надавайте перевагу `isinstance()`, якщо вам не потрібен саме точний збіг:

  ```python
  print(type(True) == int)
  print(isinstance(True, int))
  ```

  Результат:

  ```text
  False
  True
  ```

- **Передавати в `bases` клас замість кортежу.** Навіть один базовий клас треба загорнути в кортеж:

  ```python
  Person = type("Person", object, {})
  ```

  Результат:

  ```text
  Traceback (most recent call last):
    File "app.py", line 1, in <module>
      Person = type("Person", object, {})
  TypeError: type.__new__() argument 2 must be tuple, not type
  ```

  Пишіть `(object,)` із комою в кінці або просто `()`.

- **Викликати `type` з двома аргументами.** Дозволено лише один або три аргументи:

  ```python
  Person = type("Person", (object,))
  ```

  Результат:

  ```text
  Traceback (most recent call last):
    File "app.py", line 1, in <module>
      Person = type("Person", (object,))
  TypeError: type() takes 1 or 3 arguments
  ```

- **Думати, що аргумент `name` створює змінну.** `type()` лише задає `__name__`. Змінна — це те ім'я, якому ви присвоюєте результат, тож, щоб не заплутатися, тримайте їх однаковими:

  ```python
  Foo = type("Bar", (), {})
  print(Foo.__name__)
  print(Foo)
  ```

  Результат:

  ```text
  Bar
  <class '__main__.Bar'>
  ```

- **Використовувати `exec()` для створення класів у реальному коді.** Натомість передавайте функції в `type()`.

## Підсумок

- Класи — це об'єкти. Кожен клас, зокрема `int`, `str` і ваші власні, є екземпляром `type`, а `type(type)` — це `type`.
- `type(obj)` повертає клас об'єкта. `type(name, bases, namespace)` створює новий клас.
- Інструкція `class` готує простір імен, виконує в ньому тіло класу, а потім викликає `type(name, bases, namespace)`.
- Тіло класу — це скомпільований код, а не рядок. `exec()` може лише імітувати цей процес.
- `bases` має бути кортежем. Порожній кортеж означає «успадковуватися від `object`».
- `object` — базовий клас для кожного класу, `type` — клас кожного класу, а сам `type` успадковується від `object`.
- Оскільки `type` створює класи, він є метакласом, причому метакласом за замовчуванням.

## Практика

### Вправа 1: Передбачте результат

Запишіть, що виведе кожен рядок, а потім запустіть код і перевірте.

```python
class Animal:
    pass


class Dog(Animal):
    pass


rex = Dog()
print(type(rex).__name__)
print(type(Dog).__name__)
print(type(type(rex)) is type)
print(isinstance(rex, Animal), type(rex) is Animal)
```

### Вправа 2: Порахуйте значення за типами

Напишіть функцію `count_types(values)`, яка повертає словник «назва типу → кількість значень цього типу». Для `[1, "a", 2.5, 3, "b", None, True]` вона має повернути `{'int': 2, 'str': 2, 'float': 1, 'NoneType': 1, 'bool': 1}`.

### Вправа 3: Класи без ключового слова `class`

Використовуючи лише `type()` і звичайні функції, створіть:

- `Rectangle` з атрибутом класу `sides = 4`, методом `__init__(width, height)`, методом `area()` і методом `__repr__`, який показує назву класу й обидва розміри, наприклад `Rectangle(3, 5)`;
- `Square` — підклас `Rectangle`, що створюється як `Square(4)`.

Виведіть прямокутник, квадрат, їхні площі й перевірте, що квадрат є екземпляром `Rectangle`.

### Вправа 4: Фабрика класів-записів

Напишіть функцію `make_record(name, fields)`, яка створює через `type()` і повертає новий клас. Клас має зберігати назви полів в атрибуті класу `fields` (як кортеж), приймати в `__init__` по одному позиційному значенню на кожне поле й генерувати `TypeError`, якщо кількість значень неправильна, а також мати `__repr__` на зразок `Book(title='Dune', year=1965)`.

## Розв'язки

### Вправа 1

Результат:

```text
Dog
type
True
True False
```

`type(rex)` — це `Dog`, а тип класу `Dog` — `type`. `isinstance()` враховує успадкування, а `type(rex) is Animal` перевіряє лише точний клас.

### Вправа 2

```python
def count_types(values):
    counts = {}
    for value in values:
        name = type(value).__name__
        counts[name] = counts.get(name, 0) + 1
    return counts


print(count_types([1, "a", 2.5, 3, "b", None, True]))
```

Результат:

```text
{'int': 2, 'str': 2, 'float': 1, 'NoneType': 1, 'bool': 1}
```

Тут нам потрібен саме точний тип, тож `type()` — правильний інструмент. `True` враховано як `bool`, а не як `int`.

### Вправа 3

```python
def __init__(self, width, height):
    self.width = width
    self.height = height


def area(self):
    return self.width * self.height


def __repr__(self):
    return f"{type(self).__name__}({self.width}, {self.height})"


Rectangle = type("Rectangle", (), {
    "sides": 4,
    "__init__": __init__,
    "area": area,
    "__repr__": __repr__,
})

Square = type("Square", (Rectangle,), {
    "__init__": lambda self, side: Rectangle.__init__(self, side, side),
})

r = Rectangle(3, 5)
s = Square(4)
print(r, r.area(), Rectangle.sides)
print(s, s.area(), isinstance(s, Rectangle))
print(type(Square).__name__)
```

Результат:

```text
Rectangle(3, 5) 15 4
Square(4, 4) 16 True
type
```

`__repr__` використовує `type(self).__name__`, тож підклас виводить власну назву без перевизначення методу.

### Вправа 4

```python
def make_record(name, fields):
    def __init__(self, *values):
        if len(values) != len(fields):
            raise TypeError(f"{name}() expects {len(fields)} values, got {len(values)}")
        for field, value in zip(fields, values):
            setattr(self, field, value)

    def __repr__(self):
        args = ", ".join(f"{field}={getattr(self, field)!r}" for field in fields)
        return f"{name}({args})"

    return type(name, (), {
        "fields": tuple(fields),
        "__init__": __init__,
        "__repr__": __repr__,
    })


Book = make_record("Book", ["title", "year"])
book = Book("Dune", 1965)
print(book)
print(book.title, Book.fields)

try:
    Book("Dune")
except TypeError as error:
    print("Error:", error)
```

Результат:

```text
Book(title='Dune', year=1965)
Dune ('title', 'year')
Error: Book() expects 2 values, got 1
```

Внутрішні функції — це замикання: вони пам'ятають `name` і `fields` з виклику `make_record()`, тож кожен згенерований клас отримує власні значення.

---

*Джерело: [pythontutorial.net — Python type Class](https://www.pythontutorial.net/python-oop/python-type-class/). Адаптовано й доповнено для PyJourney.*
