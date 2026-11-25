# Принцип відкритості/закритості

Принцип відкритості/закритості (Open–Closed Principle, OCP) стверджує, що програмні сутності мають бути **відкритими для розширення, але закритими для модифікації**: нову поведінку слід додавати, *дописуючи* новий код, а не *редагуючи* код, який уже працює. Це літера «O» у SOLID, і саме завдяки цьому принципу існують плагіни, стратегії та абстрактні базові класи.

## Що ви дізнаєтесь

- Що на практиці означає «відкритий для розширення, закритий для модифікації»
- Як розпізнати код, який доводиться редагувати щоразу, коли з'являється новий варіант
- Як переробити його за допомогою абстрактного базового класу (`abc.ABC`), з кодом «до» і «після»
- Як досягти того самого через `typing.Protocol` і через звичайні функції в реєстрі
- Яка частина коду «закрита», а яка «відкрита»
- Компроміси: коли абстракція окупається, а коли вона передчасна

## Ідея

Принцип звучить суперечливо: як код може бути водночас відкритим і закритим? Ці два слова стосуються різних речей:

- **Відкритий для розширення**: *поведінка* системи може зростати. Можна підтримати новий формат файлу, новий спосіб оплати чи нову геометричну фігуру.
- **Закритий для модифікації**: *вихідний код*, який уже працює (протестований, переглянутий і розгорнутий), не доводиться редагувати, щоб цього досягти.

Навіщо це потрібно? Кожна правка робочого коду — це шанс його зламати. Якщо підтримка десятого формату експорту означає вдесяте редагувати ту саму функцію, кожна правка ризикує зламати дев'ять форматів, які вже працюють, а всі тести цієї функції доводиться перезапускати й, можливо, переписувати. Якщо ж ви додаєте новий клас чи функцію поруч зі старими, старий код лишається недоторканим, і ризик локалізовано.

> **Зверніть увагу:** термін запропонував Бертран Меєр (Bertrand Meyer) у 1988 році, і він мав на увазі розширення через успадкування. Пізніше Роберт К. Мартін переосмислив принцип через абстракції та поліморфізм — саме цю версію використовують у SOLID і в цьому уроці.

## До: клас, який доводиться редагувати для кожного формату

```python
class Person:
    def __init__(self, name):
        self.name = name

    def __repr__(self):
        return f"Person(name={self.name!r})"


class PersonStorage:
    def save_to_database(self, person):
        print(f"Save {person} to database")

    def save_to_json(self, person):
        print(f"Save {person} to a JSON file")


if __name__ == "__main__":
    person = Person("John Doe")
    storage = PersonStorage()
    storage.save_to_database(person)
```

Результат:

```text
Save Person(name='John Doe') to database
```

`PersonStorage` має окремий метод для кожного формату. Щоб підтримати XML, доведеться відкрити `PersonStorage` і дописати `save_to_xml()`. Гірше того, кожен викликач мусить знати, який метод викликати, тож вибір формату просочується в решту програми. Клас відкритий для *модифікації*, а не для розширення.

Та сама проблема часто має вигляд ланцюжка `if`/`elif`:

```python
def save(person, fmt):
    if fmt == "database":
        print(f"Save {person} to database")
    elif fmt == "json":
        print(f"Save {person} to a JSON file")
    else:
        raise ValueError(f"Unknown format: {fmt!r}")


save("John Doe", "json")
```

Результат:

```text
Save John Doe to a JSON file
```

Кожен новий формат додає ще одну гілку в ту саму функцію. Ланцюжки `if isinstance(...)` або оператори `match` за типами мають ту саму ваду: це одне місце, яке доводиться редагувати для кожного нового варіанта.

## Після: залежність від абстракції

Рішення — знайти спільне для всіх варіантів (тут це «зберегти людину кудись») і перетворити його на **абстракцію**. Тоді код, якому потрібно зберігати людей, залежить лише від цієї абстракції.

Спершу визначимо абстрактний базовий клас з абстрактним методом `save()`:

```python
from abc import ABC, abstractmethod


class PersonStorage(ABC):
    @abstractmethod
    def save(self, person):
        """Зберегти одну людину."""
```

Далі реалізуємо кожен формат як окремий підклас:

```python
class PersonDB(PersonStorage):
    def save(self, person):
        print(f"Save {person} to database")


class PersonJSON(PersonStorage):
    def save(self, person):
        print(f"Save {person} to a JSON file")
```

Нарешті, коли знадобиться підтримка XML, ми **додаємо** клас. Жоден наявний рядок не редагується:

```python
class PersonXML(PersonStorage):
    def save(self, person):
        print(f"Save {person} to an XML file")
```

Зберемо все разом і додамо клієнтську функцію `save_all()`, яка працює з будь-яким сховищем:

```python
from abc import ABC, abstractmethod


class Person:
    def __init__(self, name):
        self.name = name

    def __repr__(self):
        return f"Person(name={self.name!r})"


class PersonStorage(ABC):
    @abstractmethod
    def save(self, person):
        """Зберегти одну людину."""


class PersonDB(PersonStorage):
    def save(self, person):
        print(f"Save {person} to database")


class PersonJSON(PersonStorage):
    def save(self, person):
        print(f"Save {person} to a JSON file")


class PersonXML(PersonStorage):
    def save(self, person):
        print(f"Save {person} to an XML file")


def save_all(people, storage: PersonStorage):
    for person in people:
        storage.save(person)


if __name__ == "__main__":
    people = [Person("John Doe"), Person("Jane Doe")]
    save_all(people, PersonXML())
    save_all(people[:1], PersonDB())
```

Результат:

```text
Save Person(name='John Doe') to an XML file
Save Person(name='Jane Doe') to an XML file
Save Person(name='John Doe') to database
```

Тепер подивімося, яка частина є якою:

- **Закрита**: `PersonStorage` і `save_all()`. Вони не змінюються, коли додається формат.
- **Відкрита**: множина підкласів `PersonStorage`. Будь-хто може додати новий, навіть в іншому модулі чи пакеті.

```text
              save_all(people, storage)
                         |
                         v
                  PersonStorage (ABC)        <- стабільна абстракція
                  + save(person)
          ┌──────────┬───┴───────┬──────────┐
          v          v           v          v
      PersonDB   PersonJSON  PersonXML   (ваш новий клас)
```

### Що дає `abc.ABC`

Абстрактний базовий клас не лише документує інтерфейс. Підклас, який забув реалізувати `save()`, навіть не вдасться створити, тож помилка виявиться одразу, а не десь глибоко всередині `save_all()`:

```python
from abc import ABC, abstractmethod


class PersonStorage(ABC):
    @abstractmethod
    def save(self, person):
        """Зберегти одну людину."""


class PersonCSV(PersonStorage):
    def save_person(self, person):  # описка: неправильна назва методу
        print(f"Save {person} to a CSV file")


try:
    PersonCSV()
except TypeError as error:
    print(error)
```

Результат:

```text
Can't instantiate abstract class PersonCSV without an implementation for abstract method 'save'
```

> **Зверніть увагу:** цей захист діє лише для методів, позначених `@abstractmethod`. Клас, що успадковує `ABC`, але не має жодного абстрактного методу, можна створити, як будь-який інший.

## Альтернатива: `typing.Protocol`

ABC вимагає, щоб кожна реалізація від нього *успадковувалася*. Іноді це неможливо або небажано, наприклад коли клас походить зі сторонньої бібліотеки. `Protocol` (Python 3.8+) описує потрібні методи **структурно**: підходить будь-який клас із відповідним методом `save()`, жодного успадкування не потрібно. Це статична качина типізація (duck typing), яку перевіряють інструменти на кшталт mypy або pyright.

```python
from typing import Protocol


class Person:
    def __init__(self, name):
        self.name = name

    def __repr__(self):
        return f"Person(name={self.name!r})"


class PersonStorage(Protocol):
    def save(self, person: Person) -> None: ...


class PersonDB:  # базовий клас не потрібен
    def save(self, person: Person) -> None:
        print(f"Save {person} to database")


class PersonYAML:
    def save(self, person: Person) -> None:
        print(f"Save {person} to a YAML file")


def save_all(people: list[Person], storage: PersonStorage) -> None:
    for person in people:
        storage.save(person)


people = [Person("John Doe")]
save_all(people, PersonDB())
save_all(people, PersonYAML())
```

Результат:

```text
Save Person(name='John Doe') to database
Save Person(name='John Doe') to a YAML file
```

| | `abc.ABC` | `typing.Protocol` |
|---|---|---|
| Реалізації мусять успадковувати | Так | Ні |
| Коли виявляється відсутній метод | Під час виконання, у момент створення об'єкта | Перевіряльником типів, ще до запуску |
| Можна ділитися кодом із реалізаціями | Так (конкретні методи в базовому класі) | Для цього рідко використовують |
| Працює з класами, які не можна редагувати | Ні | Так |

## Альтернатива: функції та реєстр

У Python поведінка не обов'язково має бути класом. Коли кожен варіант — це одна операція, звичайні функції часто є найпростішою точкою розширення. Ось версія «до» з `if`/`elif` для експорту запису:

```python
import json


def export(data, fmt):
    if fmt == "json":
        return json.dumps(data)
    elif fmt == "csv":
        return ",".join(str(value) for value in data.values())
    raise ValueError(f"Unknown format: {fmt!r}")


print(export({"name": "John Doe", "age": 42}, "csv"))
```

Результат:

```text
John Doe,42
```

А ось версія «після», у якій кожен формат сам реєструється у словнику:

```python
import json

EXPORTERS = {}


def exporter(name):
    """Декоратор, що реєструє функцію експорту під заданою назвою."""
    def decorator(func):
        EXPORTERS[name] = func
        return func
    return decorator


@exporter("json")
def to_json(data):
    return json.dumps(data)


@exporter("csv")
def to_csv(data):
    return ",".join(str(value) for value in data.values())


def export(data, fmt):
    try:
        func = EXPORTERS[fmt]
    except KeyError:
        raise ValueError(f"Unknown format: {fmt!r}") from None
    return func(data)


row = {"name": "John Doe", "age": 42}
print(export(row, "json"))
print(export(row, "csv"))


# Розширення: новий формат, export() не змінюється
@exporter("kv")
def to_key_value(data):
    return "; ".join(f"{key}={value}" for key, value in data.items())


print(export(row, "kv"))
print(sorted(EXPORTERS))
```

Результат:

```text
{"name": "John Doe", "age": 42}
John Doe,42
name=John Doe; age=42
['csv', 'json', 'kv']
```

`export()` закрита: вона лише шукає функцію. Реєстр відкритий: будь-який модуль може додати формат, просто задекорувавши функцію. Цей патерн поширений у реальних фреймворках, наприклад у маршрутизації URL у Flask (`@app.route(...)`) чи в реєстрації команд у бібліотеках для CLI.

## Компроміси

OCP цінний, але не безкоштовний.

- **Потрібно вгадати напрям змін.** Абстракція захищає лише від того типу змін, під який її спроєктовано. `PersonStorage` спрощує додавання *форматів*, але додавання нової *операції*, як-от `load()`, тепер вимагає редагувати кожен клас сховища. Жоден дизайн не закритий від усіх можливих змін.
- **Абстракції додають непрямість.** Читаючи `save_all()`, не видно, який саме `save()` виконається, доки не знайдеш місце, де створено об'єкт сховища.
- **Передчасна абстракція має реальну ціну.** Якщо формат лише один і другого не передбачається, ABC з єдиним підкласом — це просто церемонія. Поширене практичне правило: спершу напишіть просту версію, а абстракцію виділіть, коли справді з'явиться другий чи третій варіант.
- **«Закритий» не означає «заморожений».** Виправити помилку в `save_all()` — нормально. OCP про те, щоб не доводилося редагувати стабільний код *заради нових можливостей*.

## Типові помилки

- **Нарощувати ланцюжок `if`/`elif` або `isinstance`** щоразу, коли з'являється новий тип чи прапорець. Це найпоширеніше порушення OCP.
- **Забувати `@abstractmethod`.** Без нього базовий клас нічого не захищає, і підклас із помилкою в назві методу мовчки успадкує метод, який нічого не робить.
- **Робити виняток для окремого підкласу всередині базового класу**, наприклад `if isinstance(self, PersonXML): ...` у `PersonStorage`. Базовий клас не повинен знати про свої підкласи.
- **Створювати абстракції для уявних майбутніх потреб.** Інтерфейс з однією реалізацією і без другої на горизонті ускладнює читання коду, не полегшуючи розширення.
- **Розносити конкретний вибір по всьому коду.** Якщо кожен викликач сам створює `PersonXML()`, зміна формату однаково вимагатиме редагувати багато файлів. Створюйте конкретний об'єкт в одному місці, а далі передавайте абстракцію.

## Підсумок

- OCP: додавайте нову поведінку новим кодом, а не правками робочого коду.
- «Закритими» є стабільний клієнтський код і абстракції; «відкритою» — множина реалізацій.
- Ланцюжки `if`/`elif` та `isinstance` за варіантами — класична ознака порушення.
- `abc.ABC` з `@abstractmethod` задає точку розширення і швидко сигналізує, коли реалізація неповна.
- `typing.Protocol` задає той самий контракт структурно, без успадкування.
- Словник функцій із декоратором реєстрації — легкий і дуже «пітонічний» спосіб застосувати OCP.
- Кожна абстракція закрита лише від одного типу змін, тому запроваджуйте її, коли з'являється реальний другий варіант.

## Практика

### Вправа 1: Фігури без `if`

Наведену функцію доводиться редагувати для кожної нової фігури, а невідомі фігури вона мовчки ігнорує. Перепишіть її з абстрактним класом `Shape` так, щоб `total_area()` ніколи не змінювалася, а потім додайте `Triangle(base, height)`, не чіпаючи `total_area()`.

```python
import math


def total_area(shapes):
    total = 0.0
    for shape in shapes:
        if shape["kind"] == "rectangle":
            total += shape["width"] * shape["height"]
        elif shape["kind"] == "circle":
            total += math.pi * shape["radius"] ** 2
    return total


shapes = [
    {"kind": "rectangle", "width": 2, "height": 3},
    {"kind": "circle", "radius": 1},
    {"kind": "triangle", "base": 4, "height": 5},
]
print(round(total_area(shapes), 2))
```

Результат:

```text
9.14
```

Трикутник (площа 10) мовчки пропущено. Правильна сума — `19.14`.

### Вправа 2: Змінні знижки з `Protocol`

Визначте протокол `Discount` з методом `apply(amount: float) -> float` і функцію `checkout(amount, discount)`, яка повертає суму зі знижкою, округлену до 2 знаків після коми. Реалізуйте `NoDiscount`, `PercentOff(percent)` і `FixedOff(value)` (ціна ніколи не може стати від'ємною). Потім, не змінюючи `checkout()`, додайте `Combined(*discounts)`, що застосовує кілька знижок одну за одною.

### Вправа 3: Плагіни, що реєструються самі

Напишіть базовий клас `Storage` зі словником `registry` на рівні класу. Кожен підклас має автоматично реєструватися під ключем, указаним в оголошенні класу, наприклад `class JsonStorage(Storage, key="json")`. Додайте функцію `create_storage(key)`, яка повертає екземпляр потрібного класу і генерує `ValueError` для невідомого ключа. Додавання нового сховища не повинно вимагати змін ні в `Storage`, ні в `create_storage()`.

> **Порада:** `__init_subclass__(cls, **kwargs)` — це метод класу, який Python автоматично викликає на батьківському класі щоразу, коли створюється підклас. Іменовані аргументи з рядка `class` передаються саме йому.

## Розв'язки

### Вправа 1

```python
import math
from abc import ABC, abstractmethod


class Shape(ABC):
    @abstractmethod
    def area(self) -> float:
        """Повернути площу фігури."""


class Rectangle(Shape):
    def __init__(self, width, height):
        self.width = width
        self.height = height

    def area(self):
        return self.width * self.height


class Circle(Shape):
    def __init__(self, radius):
        self.radius = radius

    def area(self):
        return math.pi * self.radius ** 2


def total_area(shapes):
    return sum(shape.area() for shape in shapes)


# Розширення: новий клас, total_area() не змінюється
class Triangle(Shape):
    def __init__(self, base, height):
        self.base = base
        self.height = height

    def area(self):
        return self.base * self.height / 2


shapes = [Rectangle(2, 3), Circle(1), Triangle(4, 5)]
print(round(total_area(shapes), 2))
```

Результат:

```text
19.14
```

Тепер невідому фігуру не можна пропустити випадково: кожен `Shape` мусить реалізувати `area()`, інакше його не вдасться створити.

### Вправа 2

```python
from typing import Protocol


class Discount(Protocol):
    def apply(self, amount: float) -> float: ...


def checkout(amount: float, discount: Discount) -> float:
    return round(discount.apply(amount), 2)


class NoDiscount:
    def apply(self, amount):
        return amount


class PercentOff:
    def __init__(self, percent):
        self.percent = percent

    def apply(self, amount):
        return amount * (1 - self.percent / 100)


class FixedOff:
    def __init__(self, value):
        self.value = value

    def apply(self, amount):
        return max(amount - self.value, 0.0)


# Розширення: checkout() не змінюється
class Combined:
    def __init__(self, *discounts):
        self.discounts = discounts

    def apply(self, amount):
        for discount in self.discounts:
            amount = discount.apply(amount)
        return amount


print(checkout(200, NoDiscount()))
print(checkout(200, PercentOff(15)))
print(checkout(30, FixedOff(50)))
print(checkout(200, Combined(PercentOff(10), FixedOff(20))))
```

Результат:

```text
200
170.0
0.0
160.0
```

`Combined` сам є `Discount`, тож підключається до `checkout()`, як і будь-яка інша знижка. Об'єкти, що поєднують інші об'єкти з тим самим інтерфейсом, утворюють патерн *Компонувальник* (Composite).

### Вправа 3

```python
class Storage:
    registry = {}

    def __init_subclass__(cls, *, key, **kwargs):
        super().__init_subclass__(**kwargs)
        Storage.registry[key] = cls

    def save(self, data):
        raise NotImplementedError


class JsonStorage(Storage, key="json"):
    def save(self, data):
        print(f"JSON <- {data}")


class CsvStorage(Storage, key="csv"):
    def save(self, data):
        print(f"CSV <- {data}")


def create_storage(key):
    try:
        cls = Storage.registry[key]
    except KeyError:
        raise ValueError(f"Unknown storage: {key!r}") from None
    return cls()


# Розширення: просто новий підклас
class MemoryStorage(Storage, key="memory"):
    def __init__(self):
        self.items = []

    def save(self, data):
        self.items.append(data)
        print(f"memory now holds {len(self.items)} item(s)")


print(sorted(Storage.registry))
create_storage("json").save({"id": 1})
create_storage("memory").save({"id": 2})
try:
    create_storage("xml")
except ValueError as error:
    print(error)
```

Результат:

```text
['csv', 'json', 'memory']
JSON <- {'id': 1}
memory now holds 1 item(s)
Unknown storage: 'xml'
```

Кожен підклас реєструється в момент виконання свого оператора `class`, тож `create_storage()` лишається закритою, а множина сховищ — відкритою.

---

*Джерело: [pythontutorial.net — Python Open-Closed Principle](https://www.pythontutorial.net/python-oop/python-open-closed-principle/). Адаптовано й доповнено для PyJourney.*
