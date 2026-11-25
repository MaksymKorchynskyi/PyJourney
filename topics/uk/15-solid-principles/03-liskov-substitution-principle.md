# Принцип підстановки Лісков

Принцип підстановки Лісков (Liskov Substitution Principle, LSP) стверджує, що **об'єкт підкласу має бути придатним до використання всюди, де очікують об'єкт батьківського класу**, і код, що його викликає, не повинен помітити різниці чи зламатися. Це літера «L» у SOLID. Саме цей принцип робить поліморфізм безпечним: якщо підкласи дотримуються обіцянок батьківського класу, код, написаний для батька, працює з кожним підкласом, зокрема й із тими, що з'являться через роки.

## Що ви дізнаєтесь

- Що насправді означає «замінний»: та сама поведінка, а не лише ті самі назви методів
- Який контракт має зберігати підклас: сигнатури, передумови, постумови, інваріанти, винятки
- Як помітити порушення LSP (підказка: перевірки `isinstance` у клієнтському коді)
- Як переробити ієрархію, що порушує принцип, з кодом «до» і «після»
- Класичну пастку «прямокутник і квадрат» і як її уникнути
- Як інструменти перевірки типів, наприклад mypy, ловлять частину порушень за вас

## Принцип

Барбара Лісков (Barbara Liskov) запропонувала цю ідею в 1987 році, а в 1994-му разом із Джаннетт Вінг (Jeannette Wing) дала їй формальне визначення. Простими словами:

> Якщо код правильно працює з об'єктами типу `Base`, він має так само правильно працювати, коли отримає об'єкт будь-якого підкласу `Base`, не знаючи, який саме підклас йому дали.

З цього випливають два наслідки:

1. «Є різновидом» (is-a) у коді стосується **поведінки**, а не категорій реального світу. З погляду біології пінгвін *є* птахом, але якщо ваш клас `Bird` обіцяє метод `fly()`, підклас `Penguin` у вашій програмі не є коректним `Bird`.
2. Якщо клієнтський код мусить питати «а який це підклас?» (через `isinstance()` чи `type()`), перш ніж використати об'єкт, підстановка вже не вдалася.

## Контракт, який має зберігати підклас

Базовий клас дає обіцянки тим, хто його викликає. Підклас може *розширювати* ці обіцянки, але ніколи не може їх *порушувати*:

| Правило | Простими словами | Типове порушення |
|---|---|---|
| Сумісна сигнатура | Приймати ті самі аргументи, і за позицією, і за назвою | Перейменувати, прибрати або додати обов'язковий параметр |
| Передумови не можна посилювати | Приймати щонайменше все, що приймає батько | Батько приймає будь-яку суму, а підклас відкидає суми понад 1000 |
| Постумови не можна послаблювати | Повертати щонайменше те, що обіцяє батько | Батько повертає список, а підклас іноді повертає `None` |
| Інваріанти мають зберігатися | Не порушувати факти, які гарантує батько | Зміна ширини змінює й висоту |
| Жодних несподіваних винятків | Не генерувати помилок, яких викликач не може очікувати | Успадкований метод генерує `NotImplementedError` |

## До: сповіщення, які не можна замінити одне одним

Тут базовий клас `Notification` каже, що `notify()` приймає повідомлення й email. `SMS` перевизначає цей метод, але насправді йому потрібен номер телефону:

```python
from abc import ABC, abstractmethod


class Notification(ABC):
    @abstractmethod
    def notify(self, message, email):
        pass


class Email(Notification):
    def notify(self, message, email):
        print(f"Send {message} to {email}")


class SMS(Notification):
    def notify(self, message, phone):
        print(f"Send {message} to {phone}")


if __name__ == "__main__":
    notification = SMS()
    notification.notify("Hello", "john@test.com")
```

Результат:

```text
Send Hello to john@test.com
```

Ніщо не завадило нам надіслати SMS на адресу електронної пошти. Контракт `Notification.notify()` каже «дай мені email», а `SMS` не може його виконати; він лише *здається* сумісним, бо потрібний параметр випадково стоїть другим за порядком. Щойно викликач використає назву параметра з базового класу, `SMS` ламається:

```python
from abc import ABC, abstractmethod


class Notification(ABC):
    @abstractmethod
    def notify(self, message, email):
        pass


class Email(Notification):
    def notify(self, message, email):
        print(f"Send {message} to {email}")


class SMS(Notification):
    def notify(self, message, phone):
        print(f"Send {message} to {phone}")


for notification in (Email(), SMS()):
    try:
        notification.notify(message="Hello", email="john@test.com")
    except TypeError as error:
        print(f"{type(notification).__name__} failed: {error}")
```

Результат:

```text
Send Hello to john@test.com
SMS failed: SMS.notify() got an unexpected keyword argument 'email'
```

Клієнтський код, який має працювати з обома класами, тепер змушений перевіряти конкретний тип:

```python
from abc import ABC, abstractmethod


class Notification(ABC):
    @abstractmethod
    def notify(self, message, email):
        pass


class Email(Notification):
    def notify(self, message, email):
        print(f"Send {message} to {email}")


class SMS(Notification):
    def notify(self, message, phone):
        print(f"Send {message} to {phone}")


class Contact:
    def __init__(self, name, email, phone):
        self.name = name
        self.email = email
        self.phone = phone


class NotificationManager:
    def __init__(self, notification, contact):
        self.contact = contact
        self.notification = notification

    def send(self, message):
        if isinstance(self.notification, Email):
            self.notification.notify(message, self.contact.email)
        elif isinstance(self.notification, SMS):
            self.notification.notify(message, self.contact.phone)
        else:
            raise TypeError("The notification is not supported")


if __name__ == "__main__":
    contact = Contact("John Doe", "john@test.com", "(408)-888-9999")
    manager = NotificationManager(SMS(), contact)
    manager.send("Hello John")
```

Результат:

```text
Send Hello John to (408)-888-9999
```

Такий ланцюжок `isinstance` — характерна ознака порушення LSP. До того ж він порушує й принцип відкритості/закритості: щоб додати сповіщення `Push`, доведеться редагувати `send()`.

## Після: контракт, який може виконати кожен підклас

Проблема в тому, що контракт базового класу містить деталь (email), потрібну лише одному підкласу. Винесімо цю деталь зі спільного методу в конструктор кожного підкласу:

```python
from abc import ABC, abstractmethod


class Notification(ABC):
    @abstractmethod
    def notify(self, message):
        """Доставити повідомлення отримувачу цього сповіщення."""


class Email(Notification):
    def __init__(self, email):
        self.email = email

    def notify(self, message):
        print(f'Send "{message}" to {self.email}')


class SMS(Notification):
    def __init__(self, phone):
        self.phone = phone

    def notify(self, message):
        print(f'Send "{message}" to {self.phone}')


class Contact:
    def __init__(self, name, email, phone):
        self.name = name
        self.email = email
        self.phone = phone


class NotificationManager:
    def __init__(self, notification):
        self.notification = notification

    def send(self, message):
        self.notification.notify(message)


if __name__ == "__main__":
    contact = Contact("John Doe", "john@test.com", "(408)-888-9999")

    sms_notification = SMS(contact.phone)
    email_notification = Email(contact.email)

    manager = NotificationManager(sms_notification)
    manager.send("Hello John")

    manager.notification = email_notification
    manager.send("Hi John")
```

Результат:

```text
Send "Hello John" to (408)-888-9999
Send "Hi John" to john@test.com
```

Тепер кожен `Notification` дотримується того самого контракту: «виклич `notify(message)`, і повідомлення буде доставлено». `NotificationManager` не знає і не мусить знати, який підклас у нього є, а новий клас `Push` запрацює без жодних змін у менеджері.

## Класична пастка: прямокутник і квадрат

З погляду математики кожен квадрат — це прямокутник, тож успадкування `Square` від `Rectangle` здається природним:

```python
class Rectangle:
    def __init__(self, width, height):
        self.width = width
        self.height = height

    def set_width(self, width):
        self.width = width

    def set_height(self, height):
        self.height = height

    def area(self):
        return self.width * self.height


class Square(Rectangle):
    def __init__(self, side):
        super().__init__(side, side)

    def set_width(self, width):
        self.width = self.height = width

    def set_height(self, height):
        self.width = self.height = height


def stretch(rect):
    """Зробити прямокутник шириною 5 і висотою 4, повернути його площу."""
    rect.set_width(5)
    rect.set_height(4)
    return rect.area()


print(stretch(Rectangle(2, 3)))
print(stretch(Square(2)))
```

Результат:

```text
20
16
```

`Rectangle` неявно обіцяє, що ширина й висота змінюються **незалежно**. `Square` мусить порушити цю обіцянку, щоб лишатися квадратом, і `stretch()` мовчки обчислює неправильну відповідь. Ні винятку, ні попередження — найгірший різновид помилки.

Рішення — перестати вдавати, що в цих класів спільна змінювана поведінка. Обидва є фігурами з площею, тож саме це зробимо спільним контрактом, а об'єкти — незмінюваними:

```python
from abc import ABC, abstractmethod
from dataclasses import dataclass


class Shape(ABC):
    @abstractmethod
    def area(self) -> float:
        """Повернути площу."""


@dataclass(frozen=True)
class Rectangle(Shape):
    width: float
    height: float

    def area(self):
        return self.width * self.height


@dataclass(frozen=True)
class Square(Shape):
    side: float

    def area(self):
        return self.side ** 2


def total_area(shapes: list[Shape]) -> float:
    return sum(shape.area() for shape in shapes)


print(total_area([Rectangle(5, 4), Square(2)]))
```

Результат:

```text
24
```

У `total_area()` можна підставити будь-який `Shape`, бо єдина обіцянка — «я вмію повідомити свою площу», і обидва класи її виконують.

> **Порада:** модуль `collections.abc` у самому Python спроєктовано з урахуванням LSP. Базою є `Sequence` лише для читання, а `MutableSequence` її *розширює*. Тому `tuple` — це `Sequence`, але не `MutableSequence`, і ніхто не зможе викликати `append()` для об'єкта, який обіцяв лише можливість читання.

```python
from collections.abc import MutableSequence, Sequence

print(issubclass(tuple, Sequence))
print(issubclass(tuple, MutableSequence))
print(issubclass(list, Sequence))
print(issubclass(list, MutableSequence))
```

Результат:

```text
True
False
True
True
```

## Допомога від перевіряльника типів

Під час виконання Python не стежить за дотриманням LSP. Статичні перевіряльники типів уміють ловити ту частину порушень, що стосується сигнатур. Тут `Cat.feed()` приймає *менше*, ніж `Animal.feed()` (лише рибу замість будь-якої їжі), тобто посилює передумову:

```python
class Food: ...


class Fish(Food): ...


class Animal:
    def feed(self, food: Food) -> None:
        print("Eating")


class Cat(Animal):
    def feed(self, food: Fish) -> None:  # приймає МЕНШЕ, ніж батьківський клас
        print("Eating fish")
```

Запустимо mypy для цього файлу (збереженого як `lsp_check.py`):

```bash
mypy lsp_check.py
```

Результат:

```text
lsp_check.py:13: error: Argument 1 of "feed" is incompatible with supertype "Animal"; supertype defines the argument type as "Food"  [override]
lsp_check.py:13: note: This violates the Liskov substitution principle
lsp_check.py:13: note: See https://mypy.readthedocs.io/en/stable/common_issues.html#incompatible-overrides
Found 1 error in 1 file (checked 1 source file)
```

Правило для типів таке: параметри перевизначеного методу можуть бути **ширшими** (приймати більше), а тип результату — **вужчим** (обіцяти більше), але ніколи навпаки. Проте поведінкових порушень, як-от сетерів `Square`, перевіряльник типів не бачить. Для них потрібні продуманий дизайн і тести.

## Компроміси

- **LSP відштовхує від успадкування.** Часто чесне рішення звучить так: «ці два класи не повинні бути батьком і нащадком». Композиція або менший спільний інтерфейс нерідко кращі за глибоку ієрархію.
- **Категорії реального світу вводять в оману.** «Квадрат — це прямокутник» і «пінгвін — це птах» правдиві у світі, але можуть бути хибними у вашому коді. Моделюйте поведінку, а не класифікацію.
- **Контракти треба записувати.** Неможливо дотриматися обіцянки, яку ніхто не сформулював. Саме docstring і анотації типів у методах базового класу роблять LSP перевірюваним.
- **Деякі порушення приймають свідомо.** У стандартній бібліотеці є кілька задокументованих випадків (наприклад, деякі файлоподібні об'єкти генерують `io.UnsupportedOperation` для `seek()`). Це працює лише тому, що базовий контракт явно це дозволяє (`seekable()` повідомляє про це заздалегідь). Якщо вам потрібна «необов'язкова» операція, зробіть її явною частиною контракту.

## Типові помилки

- **Перевизначати метод лише для того, щоб згенерувати `NotImplementedError`** (`Penguin.fly()`, що відмовляється літати). Якщо підклас не може зробити те, що обіцяє батько, він не повинен успадковувати цю обіцянку.
- **Змінювати сигнатуру в перевизначенні**: перейменовувати параметри, додавати обов'язкові або прибирати наявні в батька. Викликачі, що передають іменовані аргументи, зламаються.
- **Повертати значення іншого типу**, наприклад `None` замість порожнього списку чи `str` там, де батько повертає `int`.
- **Додавати в підкласі додаткову перевірку**, яка відкидає вхідні дані, що їх приймає батько.
- **Латати порушення через `isinstance()` у клієнтському коді.** Це приховує проблему дизайну і змушує кожного викликача знати про кожен підклас.
- **Успадковувати лише заради повторного використання коду.** Якщо вам потрібна лише реалізація, а не контракт «є різновидом», використовуйте композицію.

## Підсумок

- LSP: підклас має бути придатним до використання всюди, де очікують батька, і викликач не повинен помічати різниці.
- «Є різновидом» у коді означає «дотримується того самого поведінкового контракту», а не «належить до тієї ж категорії в реальному світі».
- Підклас може приймати більше й обіцяти більше, але ніколи не приймати менше чи обіцяти менше.
- Перевірки `isinstance` у клієнтському коді, `NotImplementedError` у перевизначеннях і змінені сигнатури — тривожні сигнали.
- Виносьте специфічні для підкласу деталі (як-от email чи телефон) зі спільних методів, наприклад в `__init__`.
- Змінюваний `Square(Rectangle)` — класичне порушення; незмінювані об'єкти й менший спільний інтерфейс допомагають його уникнути.
- mypy і pyright ловлять порушення на рівні сигнатур; для поведінкових потрібні дизайн і тести.

## Практика

### Вправа 1: Птахи, що не літають

Поясніть, чому ця ієрархія порушує LSP. Потім перепроєктуйте її так, щоб `release_all()` могла отримувати лише птахів, які справді літають, а `Penguin` при цьому залишався `Bird`. Використайте `abc.ABC`.

```python
class Bird:
    def fly(self):
        return f"{type(self).__name__} flies"


class Sparrow(Bird):
    pass


class Penguin(Bird):
    def fly(self):
        raise NotImplementedError("Penguins can't fly")


def release_all(birds):
    for bird in birds:
        print(bird.fly())


release_all([Sparrow(), Penguin()])
```

### Вправа 2: «Швидший» репозиторій

Передбачте, що виведе цей код. Яке правило контракту порушує `FastUserRepository`? Виправте підклас так, щоб `count_in()` працювала з обома класами без жодних змін.

```python
class UserRepository:
    def __init__(self, users):
        self.users = users  # {ім'я: місто}

    def find_by_city(self, city):
        """Повернути список імен (порожній, якщо там ніхто не живе)."""
        return [name for name, c in self.users.items() if c == city]


class FastUserRepository(UserRepository):
    def find_by_city(self, city):
        result = super().find_by_city(city)
        return result or None  # «оптимізація»: None замість []


def count_in(repo, city):
    return len(repo.find_by_city(city))


users = {"Olena": "Kyiv", "Taras": "Lviv"}
print(count_in(UserRepository(users), "Odesa"))
print(count_in(FastUserRepository(users), "Odesa"))
```

### Вправа 3: Контрактний тест

`KeyValueStore` обіцяє три речі: після `set(key, value)` виклик `get(key)` повертає саме `value`; `get()` для відсутнього ключа повертає `None`; повторний `set()` з тим самим ключем перезаписує старе значення. Напишіть функцію `check_store(store)`, яка повертає `True`, лише якщо об'єкт дотримується всіх трьох обіцянок. Реалізуйте `DictStore`, підклас `LoggingStore`, який друкує кожен виклик `set()`, і підклас `UpperStore`, який зберігає значення у верхньому регістрі. Запустіть `check_store()` для всіх трьох.

## Розв'язки

### Вправа 1

`Bird` обіцяє, що кожен птах уміє `fly()`. `Penguin` порушує цю обіцянку, генеруючи виняток, тож `release_all()` падає, щойно натрапляє на пінгвіна. Рішення — обіцяти лише те, що вміють усі птахи, а політ винести в окремий, специфічніший клас:

```python
from abc import ABC, abstractmethod


class Bird(ABC):
    @abstractmethod
    def move(self):
        """Кожен птах якось пересувається."""


class FlyingBird(Bird):
    def move(self):
        return self.fly()

    def fly(self):
        return f"{type(self).__name__} flies"


class Sparrow(FlyingBird):
    pass


class Penguin(Bird):
    def move(self):
        return "Penguin swims"


def release_all(birds: list[FlyingBird]):
    for bird in birds:
        print(bird.fly())


def move_all(birds: list[Bird]):
    for bird in birds:
        print(bird.move())


release_all([Sparrow()])
move_all([Sparrow(), Penguin()])
```

Результат:

```text
Sparrow flies
Sparrow flies
Penguin swims
```

Будь-який `FlyingBird` можна передати в `release_all()`, а будь-який `Bird` — у `move_all()`. Жоден підклас не відмовляється від успадкованої операції.

### Вправа 2

Перший виклик виведе `0`, а другий завершиться помилкою:

```text
0
Traceback (most recent call last):
  ...
TypeError: object of type 'NoneType' has no len()
```

Базовий клас обіцяє «список, можливо порожній». Підклас **послаблює цю постумову**, іноді повертаючи `None`. Виправлення — дотриматися обіцянки:

```python
class UserRepository:
    def __init__(self, users):
        self.users = users  # {ім'я: місто}

    def find_by_city(self, city):
        """Повернути список імен (порожній, якщо там ніхто не живе)."""
        return [name for name, c in self.users.items() if c == city]


class FastUserRepository(UserRepository):
    def find_by_city(self, city):
        return super().find_by_city(city)  # завжди список, як і обіцяно


def count_in(repo, city):
    return len(repo.find_by_city(city))


users = {"Olena": "Kyiv", "Taras": "Lviv"}
print(count_in(UserRepository(users), "Odesa"))
print(count_in(FastUserRepository(users), "Odesa"))
print(count_in(FastUserRepository(users), "Kyiv"))
```

Результат:

```text
0
0
1
```

### Вправа 3

```python
class DictStore:
    def __init__(self):
        self._data = {}

    def set(self, key, value):
        self._data[key] = value

    def get(self, key):
        return self._data.get(key)


class LoggingStore(DictStore):
    def set(self, key, value):
        print(f"  log: set {key!r}")
        super().set(key, value)


class UpperStore(DictStore):
    def set(self, key, value):
        super().set(key, value.upper())


def check_store(store):
    store.set("lang", "python")
    if store.get("lang") != "python":
        return False
    if store.get("missing") is not None:
        return False
    store.set("lang", "rust")
    return store.get("lang") == "rust"


for cls in (DictStore, LoggingStore, UpperStore):
    print(f"{cls.__name__}:")
    print(f"  substitutable: {check_store(cls())}")
```

Результат:

```text
DictStore:
  substitutable: True
LoggingStore:
  log: set 'lang'
  log: set 'lang'
  substitutable: True
UpperStore:
  substitutable: False
```

`LoggingStore` додає поведінку (логування), але дотримується всіх обіцянок, тож є коректною заміною. `UpperStore` змінює збережене значення, тому код, що покладається на те, що `get()` повертає записане через `set()`, зламається. Запуск того самого контрактного тесту для кожної реалізації — практичний спосіб забезпечити дотримання LSP у реальному проєкті.

---

*Джерело: [pythontutorial.net — Python Liskov Substitution Principle](https://www.pythontutorial.net/python-oop/python-liskov-substitution-principle/). Адаптовано й доповнено для PyJourney.*
