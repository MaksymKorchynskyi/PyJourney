# Принцип інверсії залежностей

Принцип інверсії залежностей (Dependency Inversion Principle, DIP) стверджує, що **високорівневий код не повинен залежати від низькорівневих деталей; і той, і інший мають залежати від абстракцій**. Це літера «D» у SOLID. На практиці це означає, що ваша бізнес-логіка звертається до інтерфейсу на кшталт «конвертер валют», а не до API конкретного постачальника, тож постачальника можна замінити (або підставити замість нього фальшивий об'єкт у тестах), не чіпаючи логіки.

## Що ви дізнаєтесь

- Два правила DIP і що означають «високий рівень» та «низький рівень»
- Що саме «інвертується»
- Як переробити клас, який сам створює свої залежності, з кодом «до» і «після»
- Як впровадження залежностей (передавання їх ззовні) втілює DIP на практиці
- Як виразити абстракцію через `abc.ABC`, `typing.Protocol` або звичайний викликаний об'єкт
- Як DIP робить код придатним до тестування і коли абстракція того не варта

## Принцип

Роберт К. Мартін формулює DIP як два правила:

1. **Модулі високого рівня не повинні залежати від модулів низького рівня. І ті, і інші мають залежати від абстракцій.**
2. **Абстракції не повинні залежати від деталей. Деталі мають залежати від абстракцій.**

**Модуль високого рівня** містить політику: що робить ваш застосунок і навіщо («перерахувати ціну для сторінки оформлення замовлення»). **Модуль низького рівня** містить механіку: як щось робиться («надіслати HTTP-запит постачальнику курсів і розібрати його JSON»). Цінність вашої програми — саме в політиці, і вона не повинна змінюватися, коли змінюється якась механічна деталь.

### Що саме інвертується

Без DIP залежності у вихідному коді повторюють потік керування: високорівневий код викликає низькорівневий, тож імпортує його і залежить від нього.

```text
до:       App  ──────────────> FXConverter ──────> API постачальника FX
          (високий рівень)      (низький рівень)

після:    App  ──────────────> CurrencyConverter   (абстракція, належить стороні App)
                                   ^           ^
                                   |           |
                             FXConverter   AlphaConverter   (деталі)
```

Після змін керування під час виконання так само йде від `App` до `FXConverter`, але **залежність у вихідному коді** `FXConverter` тепер спрямована *вгору*, до абстракції. Цей розворот стрілки і є «інверсією». Абстракцію формують потреби високорівневого коду, а низькорівневі класи пристосовуються до неї, а не навпаки.

## До: високорівневий клас сам створює свою залежність

```python
class FXConverter:
    def convert(self, from_currency, to_currency, amount):
        print(f"{amount} {from_currency} = {amount * 1.2} {to_currency}")
        return amount * 1.2


class App:
    def start(self):
        converter = FXConverter()
        converter.convert("EUR", "USD", 100)


if __name__ == "__main__":
    app = App()
    app.start()
```

Результат:

```text
100 EUR = 120.0 USD
```

Уявімо, що `FXConverter` звертається до стороннього сервісу курсів валют (курс `1.2` захардкоджено лише для того, щоб приклад працював без мережі). `App` — модуль високого рівня, проте він намертво прив'язаний до цього одного постачальника:

- Якщо постачальник змінить свій API, `App` може зламатися.
- Перехід на іншого постачальника означає редагування `App`.
- `App` неможливо протестувати без звернення до справжнього сервісу: повільно, нестабільно, можливо, ще й платно.
- `App` не вдасться повторно використати там, де сервіс курсів недоступний.

Корінь проблеми — рядок `converter = FXConverter()`. Клас, який сам *створює* своїх співпрацівників, прив'язаний до їхніх конкретних типів.

## Після: залежність від абстракції та її впровадження

Спершу визначимо абстракцію: що потрібно `App`? «Щось, що перераховує суму з однієї валюти в іншу».

```python
from abc import ABC, abstractmethod


class CurrencyConverter(ABC):
    @abstractmethod
    def convert(self, from_currency: str, to_currency: str, amount: float) -> float:
        """Повернути суму, перераховану у валюту to_currency."""
```

Далі нехай кожен постачальник її реалізує. А `App` хай **отримує** конвертер, а не створює його. Передавання залежностей ззовні називають **впровадженням залежностей** (dependency injection), а передавання через `__init__` — *впровадженням через конструктор*:

```python
from abc import ABC, abstractmethod


class CurrencyConverter(ABC):
    @abstractmethod
    def convert(self, from_currency: str, to_currency: str, amount: float) -> float:
        """Повернути суму, перераховану у валюту to_currency."""


class FXConverter(CurrencyConverter):
    def convert(self, from_currency, to_currency, amount):
        print("Converting currency using FX API")
        rate = 1.2  # у реальному коді: запит до FX API
        return round(amount * rate, 2)


class AlphaConverter(CurrencyConverter):
    def convert(self, from_currency, to_currency, amount):
        print("Converting currency using Alpha API")
        rate = 1.15  # у реальному коді: запит до Alpha API
        return round(amount * rate, 2)


class App:
    def __init__(self, converter: CurrencyConverter):
        self.converter = converter

    def start(self):
        result = self.converter.convert("EUR", "USD", 100)
        print(f"100 EUR = {result} USD")
        return result


if __name__ == "__main__":
    App(FXConverter()).start()
    App(AlphaConverter()).start()
```

Результат:

```text
Converting currency using FX API
100 EUR = 120.0 USD
Converting currency using Alpha API
100 EUR = 115.0 USD
```

`App` більше не згадує жодного постачальника. Він залежить лише від `CurrencyConverter`. Щоб підтримати третього постачальника, достатньо написати один новий клас; `App` не змінюється (тут у дії принцип відкритості/закритості).

> **Зверніть увагу:** `round(..., 2)` стоїть тут не просто так: у двійковій арифметиці з рухомою комою `100 * 1.15` дорівнює `114.99999999999999`. У реальному коді, що працює з грошима, використовуйте `decimal.Decimal`.

### Виграш: тестування з фальшивим об'єктом

Оскільки `App` приймає будь-який `CurrencyConverter`, тест може передати йому фальшивку (fake): швидку, детерміновану, яка ще й запам'ятовує, як її викликали. Продовжуємо попередній приклад:

```python
class FixedRateConverter(CurrencyConverter):
    def __init__(self, rate):
        self.rate = rate
        self.calls = []

    def convert(self, from_currency, to_currency, amount):
        self.calls.append((from_currency, to_currency, amount))
        return amount * self.rate


fake = FixedRateConverter(2)
result = App(fake).start()
assert result == 200
print(fake.calls)
```

Результат:

```text
100 EUR = 200 USD
[('EUR', 'USD', 100)]
```

Жодної мережі, жодного ключа API, жодної випадковості. Це найпомітніша практична користь від DIP у повсякденній роботі.

## Абстракція як `Protocol`

Абстракція не обов'язково має бути базовим класом. З `typing.Protocol` модуль високого рівня оголошує, що йому потрібно, а низькорівневим класам навіть не доводиться його імпортувати. Правило «деталі залежать від абстракцій» стає дуже легким:

```python
from typing import Protocol


class CurrencyConverter(Protocol):
    def convert(self, from_currency: str, to_currency: str, amount: float) -> float: ...


class App:
    def __init__(self, converter: CurrencyConverter):
        self.converter = converter

    def start(self):
        result = self.converter.convert("EUR", "USD", 100)
        print(f"100 EUR = {result} USD")
        return result


# Живе в іншому модулі й нічого не знає ні про App, ні про протокол
class BankConverter:
    def convert(self, from_currency, to_currency, amount):
        return round(amount * 1.1, 2)


App(BankConverter()).start()
```

Результат:

```text
100 EUR = 110.0 USD
```

## Ще простіше: впровадити функцію

Коли залежність — це одна операція, достатньо викликаного об'єкта. Функції в Python — теж об'єкти, тож їх можна передавати, як будь-яку іншу залежність:

```python
from collections.abc import Callable


def price_in_usd(amount_eur: float, get_rate: Callable[[str, str], float]) -> float:
    return round(amount_eur * get_rate("EUR", "USD"), 2)


def fixed_rate(from_currency, to_currency):
    return 1.1


print(price_in_usd(50, fixed_rate))
print(price_in_usd(50, lambda src, dst: 2.0))
```

Результат:

```text
55.0
100.0
```

## Де обирають конкретні класи: корінь композиції

Якщо ніхто не створює конкретних об'єктів, то хто ж це робить? Відповідь: **одне місце на краю програми**, зазвичай `main()` або код запуску застосунку. Його називають *коренем композиції* (composition root). Це єдиний код, який знає, які конкретні класи використовуються, і він з'єднує їх між собою:

```python
from abc import ABC, abstractmethod


class CurrencyConverter(ABC):
    @abstractmethod
    def convert(self, from_currency: str, to_currency: str, amount: float) -> float:
        """Повернути суму, перераховану у валюту to_currency."""


class AlphaConverter(CurrencyConverter):
    def convert(self, from_currency, to_currency, amount):
        return round(amount * 1.15, 2)


class App:
    def __init__(self, converter: CurrencyConverter):
        self.converter = converter

    def start(self):
        print(f"100 EUR = {self.converter.convert('EUR', 'USD', 100)} USD")


def main():
    converter = AlphaConverter()  # єдиний рядок, що називає конкретного постачальника
    app = App(converter)
    app.start()


if __name__ == "__main__":
    main()
```

Результат:

```text
100 EUR = 115.0 USD
```

Тепер зміна постачальника для всього застосунку — це правка одного рядка в `main()`, і більше нікому не треба про це знати.

> **Порада:** деякі фреймворки мають контейнери впровадження залежностей, які з'єднують об'єкти автоматично (відомий приклад у Python — `Depends` у FastAPI). Для більшості програм на Python явне з'єднання в корені композиції простіше й цілком достатнє.

## DIP, впровадження залежностей та інверсія керування

Ці терміни пов'язані, але не тотожні:

| Термін | Що це |
|---|---|
| Принцип інверсії залежностей | *Правило проєктування*: залежати від абстракцій, причому абстракція належить стороні високого рівня |
| Впровадження залежностей | *Техніка*: передавати об'єкту залежності ззовні (через `__init__`, аргументи методів чи атрибути), а не дозволяти йому створювати їх самому |
| Інверсія керування (inversion of control) | Ширша *ідея*: фреймворк викликає ваш код, а не ваш код викликає фреймворк (колбеки, обробники подій, плагіни) |

Можна впровадити конкретний клас без жодної абстракції (це допомагає тестуванню, але ще не є повноцінним DIP), і можна дотримуватися DIP без жодного фреймворку.

## Компроміси

- **Непрямість.** Читаючи `App`, не видно, який саме конвертер працює. Доводиться шукати корінь композиції. Це ціна гнучкості.
- **Не кожну залежність треба інвертувати.** Залежте напряму від **стабільних** речей: мови, стандартної бібліотеки (`json`, `pathlib`, `dataclasses`), власних чистих допоміжних функцій. Інвертуйте залежності від того, що **мінливе або важко контрольоване в тестах**: зовнішніх API, баз даних, файлової системи, мережі, поточного часу, випадковості.
- **Абстракції, що протікають (leaky abstractions).** Абстракція, яка повторює API одного постачальника (`convert_via_fx(api_key, fx_symbol_code)`), насправді нічого не розв'язує. Проєктуйте її з потреб високорівневого коду.
- **Аргументи за замовчуванням як компроміс.** `def __init__(self, converter=None)` із запасним варіантом — справжнім конвертером — зручно для викликачів, але повертає імпорт конкретного класу в модуль високого рівня. У невеликих програмах це розумний компроміс, у бібліотеках — менш вдалий.

## Типові помилки

- **ABC без `@abstractmethod`.** Клас `CurrencyConverter(ABC)`, у якого `convert()` просто виконує `pass`, можна створити, а підклас, що забув реалізувати `convert()`, мовчки повертатиме `None`. Завжди позначайте обов'язкові методи як абстрактні.
- **Створювати залежності всередині класу** (`self.converter = FXConverter()` в `__init__`). Так жорстка залежність ховається за атрибутом, що лише здається абстрактним.
- **Імпортувати конкретний клас у високорівневий код «лише для анотації типу»**. Анотуйте абстракцією.
- **Глобальні синглтони та локатори сервісів** (`converter = registry.get("converter")` глибоко в бізнес-логіці). Залежності стають невидимими, а тестам доводиться підміняти глобальний стан.
- **Абстрагувати все підряд.** Інтерфейс для `json.dumps` чи для чистої функції додає церемоній, не роблячи нічого легшим для зміни чи тестування.

## Підсумок

- DIP: і високорівнева політика, і низькорівневі деталі залежать від абстракції; абстракцію формують потреби високого рівня.
- «Інверсія» полягає в тому, що залежність низькорівневого модуля у вихідному коді спрямована вгору, до абстракції.
- Впровадження залежностей (передавання співпрацівників в `__init__` чи функцію) — звичайний спосіб застосовувати DIP у Python.
- Абстракцією може бути `abc.ABC`, `typing.Protocol` або просто викликаний об'єкт.
- Обирайте конкретні класи в одному місці на краю програми — у корені композиції.
- Найбільша повсякденна користь — придатність до тестування: фальшиві об'єкти замінюють повільні чи непередбачувані залежності.
- Інвертуйте залежності від мінливих речей (API, бази даних, час, випадковість), а не від стабільних.

## Практика

### Вправа 1: Впровадьте годинник

`Greeter.greet()` неможливо надійно протестувати, бо результат залежить від поточного часу. Переробіть клас так, щоб джерело часу впроваджувалося як викликаний об'єкт, що повертає `datetime`, а за замовчуванням використовувався `datetime.now`. Покажіть усі три можливі привітання, впровадивши фіксований час 9:00, 14:00 і 21:00.

```python
from datetime import datetime


class Greeter:
    def greet(self, name):
        hour = datetime.now().hour
        if hour < 12:
            part = "morning"
        elif hour < 18:
            part = "afternoon"
        else:
            part = "evening"
        return f"Good {part}, {name}!"


print(Greeter().greet("Olena"))  # результат залежить від часу запуску
```

### Вправа 2: Сервіс замовлень, придатний до тестування

`OrderService` сам створює SMTP-відправника, тож кожен тест намагатиметься надіслати справжній лист. Переробіть його так, щоб він залежав від протоколу `MessageSender` з методом `send(to, text)`. Реалізуйте `ConsoleSender` (друкує) і `RecordingSender` (зберігає повідомлення у списку, для тестів) та за допомогою `RecordingSender` і `assert` перевірте, що надіслано правильне повідомлення.

```python
class SmtpEmailSender:
    def send(self, to, text):
        print(f"SMTP -> {to}: {text}")


class OrderService:
    def __init__(self):
        self.sender = SmtpEmailSender()

    def place_order(self, customer_email, item):
        # ... зберегти замовлення ...
        self.sender.send(customer_email, f"Your order for {item} is confirmed")


OrderService().place_order("olena@example.com", "keyboard")
```

### Вправа 3: Змінне сховище

Напишіть `TodoService` з методами `add(title)` і `titles()`, що залежить від абстрактного `TodoRepository` (`load() -> list[str]`, `save(todos)`). Реалізуйте `InMemoryTodoRepository` і `JsonFileTodoRepository(path)`. Покажіть, що той самий сервіс працює з обома, і що другий сервіс, створений на тому самому JSON-файлі, бачить збережені дані. Використайте `tempfile.TemporaryDirectory()`, щоб на диску нічого не залишилося.

## Розв'язки

### Вправа 1

```python
from collections.abc import Callable
from datetime import datetime


class Greeter:
    def __init__(self, clock: Callable[[], datetime] = datetime.now):
        self.clock = clock

    def greet(self, name):
        hour = self.clock().hour
        if hour < 12:
            part = "morning"
        elif hour < 18:
            part = "afternoon"
        else:
            part = "evening"
        return f"Good {part}, {name}!"


def fixed_clock(hour):
    return lambda: datetime(2025, 1, 1, hour)


for hour in (9, 14, 21):
    print(Greeter(clock=fixed_clock(hour)).greet("Olena"))
```

Результат:

```text
Good morning, Olena!
Good afternoon, Olena!
Good evening, Olena!
```

Робочий код і далі викликає `Greeter()` і отримує справжній годинник. Тести впроваджують фіксований.

### Вправа 2

```python
from typing import Protocol


class MessageSender(Protocol):
    def send(self, to: str, text: str) -> None: ...


class OrderService:
    def __init__(self, sender: MessageSender):
        self.sender = sender

    def place_order(self, customer_email, item):
        # ... зберегти замовлення ...
        self.sender.send(customer_email, f"Your order for {item} is confirmed")


class ConsoleSender:
    def send(self, to, text):
        print(f"[console] {to}: {text}")


class RecordingSender:
    def __init__(self):
        self.sent = []

    def send(self, to, text):
        self.sent.append((to, text))


OrderService(ConsoleSender()).place_order("olena@example.com", "keyboard")

recorder = RecordingSender()
OrderService(recorder).place_order("taras@example.com", "mouse")
assert recorder.sent == [("taras@example.com", "Your order for mouse is confirmed")]
print("test passed:", recorder.sent)
```

Результат:

```text
[console] olena@example.com: Your order for keyboard is confirmed
test passed: [('taras@example.com', 'Your order for mouse is confirmed')]
```

Справжній `SmtpEmailSender` передаватиметься лише в корені композиції.

### Вправа 3

```python
import json
import tempfile
from abc import ABC, abstractmethod
from pathlib import Path


class TodoRepository(ABC):
    @abstractmethod
    def load(self) -> list[str]:
        """Повернути всі збережені назви."""

    @abstractmethod
    def save(self, todos: list[str]) -> None:
        """Замінити збережені назви."""


class InMemoryTodoRepository(TodoRepository):
    def __init__(self):
        self._todos = []

    def load(self):
        return list(self._todos)

    def save(self, todos):
        self._todos = list(todos)


class JsonFileTodoRepository(TodoRepository):
    def __init__(self, path):
        self.path = Path(path)

    def load(self):
        if not self.path.exists():
            return []
        return json.loads(self.path.read_text(encoding="utf-8"))

    def save(self, todos):
        self.path.write_text(json.dumps(todos), encoding="utf-8")


class TodoService:
    def __init__(self, repo: TodoRepository):
        self.repo = repo

    def add(self, title):
        todos = self.repo.load()
        todos.append(title)
        self.repo.save(todos)

    def titles(self):
        return self.repo.load()


memory_service = TodoService(InMemoryTodoRepository())
memory_service.add("Learn DIP")
print(memory_service.titles())

with tempfile.TemporaryDirectory() as folder:
    path = Path(folder) / "todos.json"
    file_service = TodoService(JsonFileTodoRepository(path))
    file_service.add("Write tests")
    file_service.add("Refactor")
    print(file_service.titles())
    print(path.read_text(encoding="utf-8"))
    print(TodoService(JsonFileTodoRepository(path)).titles())
```

Результат:

```text
['Learn DIP']
['Write tests', 'Refactor']
["Write tests", "Refactor"]
['Write tests', 'Refactor']
```

`TodoService` написано один раз, і він ніде не згадує ні пам'ять, ні файли. Останній рядок доводить, що дані справді потрапили на диск: зовсім новий сервіс, що читає той самий файл, їх бачить.

---

*Джерело: [pythontutorial.net — Python Dependency Inversion Principle](https://www.pythontutorial.net/python-oop/python-dependency-inversion-principle/). Адаптовано й доповнено для PyJourney.*
