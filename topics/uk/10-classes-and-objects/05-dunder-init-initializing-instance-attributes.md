# __init__: ініціалізація атрибутів екземпляра

`__init__` — це спеціальний метод, який Python викликає автоматично одразу після створення нового об'єкта. Саме в ньому кожен екземпляр отримує початкові атрибути, тож кожен об'єкт починає життя повним і коректним. Майже кожен клас, який ви писатимете, матиме такий метод.

## Що ви дізнаєтесь

- Що таке `__init__` і коли Python його викликає
- Як створюється об'єкт у два кроки: `__new__` створює, `__init__` ініціалізує
- Як передавати аргументи в `__init__`, зокрема параметри зі значеннями за замовчуванням і лише іменовані параметри
- Як перевіряти аргументи й готувати атрибути всередині `__init__`
- Чому змінювані значення за замовчуванням — це пастка і як її уникнути
- Як `__init__` працює з успадкуванням і `super().__init__()`

## Що таке `__init__`

Назва `__init__` має по два підкреслення з кожного боку. Такі назви називають **dunder**-назвами (від «double underscore», подвійне підкреслення), тому `__init__` часто вимовляють як «дандер-ініт». Dunder-методи — це **спеціальні методи**: ви їх оголошуєте, але викликає їх сам Python у відповідь на певні операції. Створення об'єкта запускає `__init__`, виклик `len(obj)` — `__len__`, вираз `a + b` — `__add__` і так далі.

Ось клас із методом `__init__`:

```python
class Person:
    def __init__(self, name, age):
        self.name = name
        self.age = age


person = Person("John", 25)
print(f"I'm {person.name}. I'm {person.age} years old.")
```

Результат:

```text
I'm John. I'm 25 years old.
```

Аргументи, які ви передаєте класу, `Person("John", 25)`, потрапляють у `__init__` після `self`. Усередині `self.name = name` створює в новому об'єкті атрибут `name` і зберігає в ньому аргумент. Параметр `name` і атрибут `self.name` — це дві різні речі, які просто мають однакову назву: параметр зникає, коли `__init__` завершується, а атрибут лишається з об'єктом.

> **Зверніть увагу:** не викликайте `__init__` самостійно на вже наявному об'єкті. `person.__init__("Jane", 30)` технічно спрацює, але повторна ініціалізація живого об'єкта заплутує й легко призводить до помилок. Єдине місце, де явний виклик — нормальна практика, це підклас: `super().__init__(...)`, про що йдеться нижче.

## Як створюється об'єкт: два кроки

Коли ви викликаєте `Person("John", 25)`, Python виконує два кроки:

1. **Створює** об'єкт. Спеціальний метод `__new__` виділяє новий порожній екземпляр. Його простір імен, `__dict__`, на цьому етапі порожній.
2. **Ініціалізує** його. Python викликає `__init__` для нового екземпляра з вашими аргументами, і `__init__` заповнює атрибути.

Обидва кроки можна побачити, якщо перевизначити `__new__` лише для того, щоб вивести повідомлення:

```python
class Person:
    def __new__(cls, *args):
        print(f"1. __new__ creates a {cls.__name__} object")
        return super().__new__(cls)

    def __init__(self, name, age):
        print(f"2. __init__ sets up {name!r}")
        print("   __dict__ before:", self.__dict__)
        self.name = name
        self.age = age
        print("   __dict__ after: ", self.__dict__)


person = Person("John", 25)
print("3. ready:", person.name)
```

Результат:

```text
1. __new__ creates a Person object
2. __init__ sets up 'John'
   __dict__ before: {}
   __dict__ after:  {'name': 'John', 'age': 25}
3. ready: John
```

Оскільки `__init__` отримує вже наявний об'єкт, він нічого не створює. Строго кажучи, **конструктор** — це `__new__`, а `__init__` — **ініціалізатор**. У щоденному мовленні багато хто все одно називає `__init__` «конструктором», і це нормально, якщо ви розумієте різницю. Писати `__new__` самостійно доведеться рідко: він потрібен в особливих випадках, наприклад коли успадковують незмінювані типи.

Ще один наслідок: `__init__` мусить повертати `None`. Його завдання — змінити `self`, а не створити значення:

```python
class Person:
    def __init__(self, name):
        self.name = name
        return self


Person("John")
```

Результат:

```text
Traceback (most recent call last):
  ...
TypeError: __init__() should return None, not 'Person'
```

## Передавання аргументів

Кожен параметр `__init__` після `self` має отримати значення під час створення об'єкта. Якщо один забути, виникне `TypeError`:

```python
class Person:
    def __init__(self, name, age):
        self.name = name
        self.age = age


Person("John")
```

Результат:

```text
Traceback (most recent call last):
  ...
TypeError: Person.__init__() missing 1 required positional argument: 'age'
```

### Значення за замовчуванням

Як і будь-яка функція, `__init__` може мати параметри зі значеннями за замовчуванням. Тоді під час виклику їх можна не передавати:

```python
class Person:
    def __init__(self, name, age=22):
        self.name = name
        self.age = age


person = Person("John")
print(f"I'm {person.name}. I'm {person.age} years old.")

other = Person("Jane", 30)
print(f"I'm {other.name}. I'm {other.age} years old.")
```

Результат:

```text
I'm John. I'm 22 years old.
I'm Jane. I'm 30 years old.
```

### Іменовані та лише іменовані аргументи

Аргументи можна передавати за назвою, і тоді виклики з кількома значеннями легше читати. Окрема `*` у сигнатурі робить наступні параметри **лише іменованими** (keyword-only): під час виклику їх обов'язково треба називати:

```python
class Person:
    def __init__(self, name, *, age=22, city="Kyiv"):
        self.name = name
        self.age = age
        self.city = city


person = Person("Olena", city="Lviv")
print(person.name, person.age, person.city)

try:
    Person("Olena", 30)
except TypeError as error:
    print("TypeError:", error)
```

Результат:

```text
Olena 22 Lviv
TypeError: Person.__init__() takes 2 positional arguments but 3 were given
```

Лише іменовані параметри зручні для необов'язкових налаштувань: ніхто випадково не передасть місто туди, де очікувався вік.

### Клас без `__init__`

Якщо клас не оголошує `__init__`, він успадковує типовий метод від `object`, який не приймає аргументів:

```python
class Empty:
    pass


print(Empty())
Empty(1)
```

Результат (адреса щоразу різна):

```text
<__main__.Empty object at 0x1031f5160>
Traceback (most recent call last):
  ...
TypeError: Empty() takes no arguments
```

## Перевірка й підготовка атрибутів

`__init__` — це вартовий вашого класу. Якщо він відмовляється завершитися через погані вхідні дані, некоректний об'єкт просто не може існувати. Генеруйте виняток для аргументів, які не можна прийняти, і нормалізуйте ті, які можна:

```python
class User:
    def __init__(self, username, email):
        username = username.strip()
        if not username:
            raise ValueError("username must not be empty")
        if "@" not in email:
            raise ValueError(f"invalid email: {email!r}")

        self.username = username
        self.email = email.lower()
        self.is_active = True  # кожен новий користувач спочатку активний


user = User("  olena ", "Olena@Example.com")
print(user.username, user.email, user.is_active)

for args in [("", "a@b.c"), ("max", "max.example.com")]:
    try:
        User(*args)
    except ValueError as error:
        print("ValueError:", error)
```

Результат:

```text
olena olena@example.com True
ValueError: username must not be empty
ValueError: invalid email: 'max.example.com'
```

Тут видно три ситуації з атрибутами:

- атрибути, скопійовані з аргументів після очищення (`username`, `email`);
- атрибути з фіксованим початковим значенням, які взагалі не є параметрами (`is_active`);
- якщо перевірка не пройшла, атрибути не створюються: виняток зупиняє `__init__`, і напівготовий об'єкт викидається.

> **Порада:** обережно з атрибутами, *обчисленими* з інших атрибутів, як-от `self.area = width * height`. Таке значення обчислюється один раз і застаріває, якщо `width` згодом зміниться. Для значень, що залежать від інших атрибутів, краще підходить метод (`def area(self)`) або властивість (property).

## Пастка змінюваного значення за замовчуванням

Значення за замовчуванням обчислюються **один раз**, коли виконується інструкція `def`, а не під час кожного виклику. Якщо значенням за замовчуванням є змінюваний об'єкт, наприклад список, усі екземпляри, що на нього покладаються, спільно використовують **той самий** список:

```python
class Student:
    def __init__(self, name, grades=[]):
        self.name = name
        self.grades = grades


anna = Student("Anna")
bohdan = Student("Bohdan")
anna.grades.append(95)
print(bohdan.grades)
print(anna.grades is bohdan.grades)
```

Результат:

```text
[95]
True
```

Богдан «отримав» оцінку Анни. Виправлення — використати `None` як значення за замовчуванням і створювати новий список усередині `__init__`. Копіювання списку, переданого викликачем (`list(grades)`), до того ж захищає об'єкт від зовнішніх змін цього списку:

```python
class Student:
    def __init__(self, name, grades=None):
        self.name = name
        self.grades = [] if grades is None else list(grades)


anna = Student("Anna")
bohdan = Student("Bohdan")
anna.grades.append(95)
print(anna.grades, bohdan.grades)

initial = [80, 90]
chris = Student("Chris", initial)
initial.append(10)
print(chris.grades)
```

Результат:

```text
[95] []
[80, 90]
```

## `__init__` і успадкування

Підклас, який не оголошує `__init__`, просто успадковує батьківський. Підклас, який **оголошує** власний `__init__`, повністю замінює батьківську версію. Python не викликає батьківський `__init__` автоматично, тож це треба зробити самостійно через `super().__init__(...)`:

```python
class Person:
    def __init__(self, name, age):
        self.name = name
        self.age = age


class Employee(Person):
    def __init__(self, name, age, job_title):
        super().__init__(name, age)  # нехай Person налаштує name і age
        self.job_title = job_title


employee = Employee("John", 25, "Python Developer")
print(employee.name, employee.age, employee.job_title)
```

Результат:

```text
John 25 Python Developer
```

Без рядка `super().__init__(name, age)` звернення `employee.name` спричинило б `AttributeError: 'Employee' object has no attribute 'name'`.

### Нехай `__init__` напише dataclass

Для класів, які здебільшого зберігають дані, стандартна бібліотека може написати `__init__` за вас. Декоратор `@dataclass` генерує `__init__`, `__repr__` і `__eq__` з анотованих атрибутів класу:

```python
from dataclasses import dataclass, field


@dataclass
class Person:
    name: str
    age: int = 22
    tags: list[str] = field(default_factory=list)


print(Person("John"))
print(Person("Jane", 30, ["admin"]))
```

Результат:

```text
Person(name='John', age=22, tags=[])
Person(name='Jane', age=30, tags=['admin'])
```

`field(default_factory=list)` створює новий список для кожного екземпляра, тож dataclass розв'язує проблему змінюваних значень за замовчуванням за вас. Класам даних (dataclasses) присвячено окрему тему далі. А доти найкращий спосіб зрозуміти, що саме вони автоматизують, — писати `__init__` власноруч.

## Типові помилки

- **Помилитися в назві.** `__int__`, `_init_` чи `__init` — звичайні методи, які Python ніколи не викликає автоматично. Тоді клас використовує `object.__init__`:

  ```python
  class Person:
      def __int__(self, name, age):  # одруківка: має бути __init__
          self.name = name
          self.age = age


  Person("John", 25)
  ```

  Результат:

  ```text
  Traceback (most recent call last):
    ...
  TypeError: Person() takes no arguments
  ```

- **Забути `self.`** `name = name` усередині `__init__` лише повторно присвоює локальний параметр. Об'єкт не отримує атрибута, а помилка з'являється пізніше, далеко від причини.

- **Повертати значення.** `__init__` мусить повертати `None`. Повернення чогось іншого спричиняє `TypeError`.

- **Використовувати змінюване значення за замовчуванням**, як-от `[]` чи `{}`. Усі екземпляри спільно використовуватимуть один об'єкт. Використовуйте `None` і створюйте новий об'єкт усередині `__init__`.

- **Не викликати `super().__init__()` у підкласі**, який оголошує власний `__init__`. Атрибути батьківського класу так і не створяться.

- **Виконувати важку роботу в `__init__`.** Читання файлів чи звернення до мережевого сервісу в `__init__` роблять об'єкти повільними й незручними для тестування. Тримайте `__init__` простим, а таку роботу переносьте в метод класу, який готує дані й потім викликає клас.

## Підсумок

- `__init__` — спеціальний (dunder) метод, який Python автоматично викликає одразу після створення нового об'єкта.
- Створення об'єкта відбувається у два кроки: `__new__` створює порожній екземпляр, потім `__init__` ініціалізує його атрибути. `__init__` — це ініціалізатор, і він мусить повертати `None`.
- Аргументи, передані класу, потрапляють у `__init__`. Відсутні обов'язкові аргументи спричиняють `TypeError`. Параметри можуть мати значення за замовчуванням або бути лише іменованими.
- Використовуйте `__init__`, щоб перевіряти вхідні дані (генеруйте виняток, щоб відхилити погані) і задавати кожен атрибут, потрібний екземпляру.
- Ніколи не використовуйте змінюваний об'єкт як значення за замовчуванням. Використовуйте `None` і створюйте об'єкт усередині `__init__`.
- Підклас із власним `__init__` мусить викликати `super().__init__(...)`, щоб виконати ініціалізацію батьківського класу.

## Практика

### Вправа 1: Прямокутники й квадрати

Напишіть клас `Rectangle`, чий `__init__` приймає `width` і необов'язковий `height`. Якщо `height` не передано, прямокутник є квадратом, тобто `height` дорівнює `width`. Додайте метод `area()`. Виведіть площу `Rectangle(3, 4)` і `Rectangle(5)`.

### Вправа 2: Товар із перевіркою

Напишіть клас `Product` з `__init__(self, name, price, quantity=0)`:

- у `name` прибираються пробіли з країв, і назва не може бути порожньою;
- `price` має бути більшою за нуль;
- `quantity` не може бути від'ємною.

Для кожної проблеми генеруйте `ValueError` зі зрозумілим повідомленням. Створіть один коректний товар і виведіть його атрибути, потім спробуйте `Product("  ", 10)`, `Product("Pen", 0)` і `Product("Pen", 2, -1)` і виведіть повідомлення кожної помилки.

### Вправа 3: Виправте плейлист

Знайдіть і виправте **дві** проблеми в цьому класі. Першу видно в результаті. Друга проявляється, коли викликач передає власний список і потім продовжує його змінювати.

```python
class Playlist:
    def __init__(self, title, songs=[]):
        self.title = title
        self.songs = songs

    def add(self, song):
        self.songs.append(song)


rock = Playlist("Rock")
jazz = Playlist("Jazz")
rock.add("Bohemian Rhapsody")
print(jazz.songs)
```

### Вправа 4: Працівники й керівники

Напишіть клас `Employee` з `__init__(self, name, salary)`. Потім напишіть `Manager(Employee)`, чий `__init__` приймає `name`, `salary` і необов'язковий список `reports` (підлеглих працівників). Він має перевикористовувати батьківську ініціалізацію через `super()`. Додайте в `Manager` метод `team_size()`. Створіть двох працівників і керівника, якому підпорядковані обидва, і виведіть ім'я, зарплату й розмір команди керівника.

## Розв'язки

### Вправа 1

```python
class Rectangle:
    def __init__(self, width, height=None):
        self.width = width
        self.height = width if height is None else height

    def area(self):
        return self.width * self.height


print(Rectangle(3, 4).area())
print(Rectangle(5).area())
```

Результат:

```text
12
25
```

`None` слугує позначкою «не передано». Значення за замовчуванням на зразок `height=width` неможливе, бо значення за замовчуванням не можуть посилатися на інші параметри.

### Вправа 2

```python
class Product:
    def __init__(self, name, price, quantity=0):
        name = name.strip()
        if not name:
            raise ValueError("name must not be empty")
        if price <= 0:
            raise ValueError(f"price must be positive, got {price}")
        if quantity < 0:
            raise ValueError(f"quantity must not be negative, got {quantity}")

        self.name = name
        self.price = price
        self.quantity = quantity


pen = Product("  Pen ", 2.5, 10)
print(pen.name, pen.price, pen.quantity)

for args in [("  ", 10), ("Pen", 0), ("Pen", 2, -1)]:
    try:
        Product(*args)
    except ValueError as error:
        print("ValueError:", error)
```

Результат:

```text
Pen 2.5 10
ValueError: name must not be empty
ValueError: price must be positive, got 0
ValueError: quantity must not be negative, got -1
```

### Вправа 3

Код виводить `['Bohemian Rhapsody']`, бо список за замовчуванням створюється один раз і спільний для `rock` і `jazz`. Друга проблема: `self.songs = songs` зберігає власний список викликача, тож будь-яка подальша зміна цього списку змінює й плейлист. Обидві проблеми виправляють значення `None` за замовчуванням і копіювання:

```python
class Playlist:
    def __init__(self, title, songs=None):
        self.title = title
        self.songs = [] if songs is None else list(songs)

    def add(self, song):
        self.songs.append(song)


rock = Playlist("Rock")
jazz = Playlist("Jazz")
rock.add("Bohemian Rhapsody")
print(jazz.songs)

favourites = ["Imagine"]
mix = Playlist("Mix", favourites)
favourites.append("Yesterday")
print(mix.songs)
```

Результат:

```text
[]
['Imagine']
```

### Вправа 4

```python
class Employee:
    def __init__(self, name, salary):
        self.name = name
        self.salary = salary


class Manager(Employee):
    def __init__(self, name, salary, reports=None):
        super().__init__(name, salary)
        self.reports = [] if reports is None else list(reports)

    def team_size(self):
        return len(self.reports)


dev = Employee("Taras", 3000)
qa = Employee("Iryna", 2800)
lead = Manager("Olena", 4500, [dev, qa])
print(lead.name, lead.salary, lead.team_size())
```

Результат:

```text
Olena 4500 2
```

`super().__init__(name, salary)` задає `name` і `salary` так само, як це робить `Employee`, а `Manager` додає лише нове. Параметр `reports` використовує шаблон із `None` з попередньої вправи.

---

*Джерело: [pythontutorial.net — Python __init__](https://web.archive.org/web/2026/https://www.pythontutorial.net/python-oop/python-__init__/). Адаптовано й доповнено для PyJourney.*
