# Абстрактна фабрика

**Абстрактна фабрика** (Abstract Factory) — це породжувальний патерн проєктування, що дає змогу створювати цілі **сімейства пов'язаних об'єктів**, не називаючи їхніх конкретних класів. Ви один раз обираєте сімейство, і кожен наступний отриманий об'єкт гарантовано пасуватиме до решти. Це інструмент для ситуацій «ці речі завжди мають поєднуватися»: віджети однієї теми оформлення, меблі одного стилю, інфраструктурні сервіси одного середовища.

## Що ви дізнаєтесь

- Чим сімейство продуктів відрізняється від окремого продукту і чому змішування сімейств — справжня помилка
- Ролі патерна: Абстрактна фабрика, Конкретна фабрика, Абстрактний продукт, Конкретний продукт, Клієнт
- Охайну реалізацію на Python з `abc.ABC` та анотаціями типів
- Практичний приклад: перемикання між локальною та хмарною інфраструктурою одним значенням конфігурації
- Чому додати новий *варіант* дешево, а новий *тип продукту* — дорого
- Як Абстрактна фабрика пов'язана з Фабричним методом, Будівельником, Прототипом, Мостом і Фасадом

## Суть патерна

Абстрактна фабрика надає інтерфейс з окремим методом створення для кожного продукту сімейства (`create_chair()`, `create_sofa()`, ...). Кожна конкретна фабрика реалізує цей інтерфейс для одного варіанта сімейства. Клієнтський код отримує об'єкт фабрики й створює все через нього, тому не залежить ні від конкретних продуктів, ні від конкретної фабрики і не може випадково поєднати продукти різних варіантів.

## Проблема

Уявіть симулятор меблевого магазину. У коді є:

1. **Сімейство** пов'язаних продуктів: `Chair`, `Sofa`, `CoffeeTable`.
2. Кілька **варіантів** цього сімейства: `Modern`, `Victorian`, `ArtDeco`.

Це зручно уявляти як матрицю, де рядки — типи продуктів, а стовпці — варіанти:

| | Modern | Victorian | ArtDeco |
|---|---|---|---|
| **Chair** | `ModernChair` | `VictorianChair` | `ArtDecoChair` |
| **Sofa** | `ModernSofa` | `VictorianSofa` | `ArtDecoSofa` |
| **CoffeeTable** | `ModernCoffeeTable` | `VictorianCoffeeTable` | `ArtDecoCoffeeTable` |

Покупці дуже незадоволені, коли до сучасного дивана привозять вікторіанські стільці. Без патерна вибір стилю зазвичай повторюється всюди, де створюється предмет, і рано чи пізно два місця розійдуться:

```python
class ModernChair:
    style = "modern"


class VictorianChair:
    style = "victorian"


class ModernSofa:
    style = "modern"


class VictorianSofa:
    style = "victorian"


def buy_chair(style: str):
    return ModernChair() if style == "modern" else VictorianChair()


def buy_sofa(style: str):
    # Написано через кілька місяців кимось іншим, з іншим написанням.
    return ModernSofa() if style == "Modern" else VictorianSofa()


order = [buy_chair("modern"), buy_chair("modern"), buy_sofa("modern")]
print([item.style for item in order])
```

Результат:

```text
['modern', 'modern', 'victorian']
```

Проблем тут дві. Ніщо не гарантує, що предмети одного замовлення пасують один до одного. До того ж постачальники меблів часто оновлюють каталоги: кожен новий стиль означає правку всіх функцій `buy_*`, тобто саме того основного коду, який краще не чіпати.

## Рішення

Патерн працює у три кроки:

1. **Оголосіть інтерфейс для кожного окремого продукту** сімейства: `Chair`, `Sofa`, `CoffeeTable`. Кожен варіант стільця реалізує `Chair`, кожен варіант дивана — `Sofa` і так далі.
2. **Оголосіть Абстрактну фабрику** — інтерфейс із методом створення для кожного продукту сімейства (`create_chair()`, `create_sofa()`, `create_coffee_table()`). Ці методи повертають *абстрактні* типи продуктів.
3. **Створіть по одній конкретній фабриці на варіант.** `ModernFurnitureFactory` повертає лише сучасні предмети, `VictorianFurnitureFactory` — лише вікторіанські.

Клієнт працює тільки через абстрактні інтерфейси. Він просить у фабрики стілець і отримує «якийсь `Chair`». Він не знає, сучасний цей стілець чи вікторіанський, і знати не мусить: хай яким буде варіант, він пасуватиме до дивана, отриманого від *того самого об'єкта фабрики*.

А хто вирішує, яку конкретну фабрику створити? Зазвичай застосунок робить це **один раз, під час запуску**, на основі конфігурації чи середовища, а потім передає об'єкт фабрики тому коду, якому він потрібен.

## Аналогія з життя

Автомеханік, що міняє фару й бампер, не ходить складом, вибираючи деталі, які «наче підходять». Він відкриває каталог запчастин для конкретної моделі й року випуску автомобіля. Каталог (конкретна фабрика) пропонує ті самі *види* деталей, що й будь-який інший: фари, бампери, дзеркала. Але всі деталі з одного каталогу гарантовано підходять до того самого авто й одна до одної. Інша модель — інший каталог, а порядок роботи механіка не змінюється.

## Структура

```text
                      +----------------------------------+
     +--------------->|          <<interface>>           |
     |                |         AbstractFactory          |
     |                |----------------------------------|
     |                | + create_product_a(): ProductA   |
     |                | + create_product_b(): ProductB   |
     |                +----------------------------------+
     |                      ^                      ^
+---------+                 |      implements      |
| Client  |      +--------------------+  +--------------------+
+---------+      |  ConcreteFactory1  |  |  ConcreteFactory2  |
     |           |--------------------|  |--------------------|
     |           | -> ProductA1()     |  | -> ProductA2()     |
     |           | -> ProductB1()     |  | -> ProductB2()     |
     |           +--------------------+  +--------------------+
     |
     |  uses     +------------------------+      +------------------------+
     +---------->| <<interface>> ProductA |      | <<interface>> ProductB |
                 +------------------------+      +------------------------+
                     ^              ^                ^              ^
               +-----------+  +-----------+    +-----------+  +-----------+
               | ProductA1 |  | ProductA2 |    | ProductB1 |  | ProductB2 |
               +-----------+  +-----------+    +-----------+  +-----------+
                 варіант 1      варіант 2        варіант 1      варіант 2
```

1. **Абстрактні продукти** (Abstract Products) оголошують інтерфейси окремих, але пов'язаних продуктів, що разом утворюють сімейство.
2. **Конкретні продукти** (Concrete Products) реалізують абстрактні продукти й згруповані за варіантами. Кожен абстрактний продукт має бути реалізований у кожному варіанті.
3. **Абстрактна фабрика** (Abstract Factory) оголошує по одному методу створення на кожен абстрактний продукт.
4. **Конкретні фабрики** (Concrete Factories) реалізують ці методи для одного варіанта й створюють лише продукти цього варіанта.
5. **Клієнт** (Client) працює з фабриками й продуктами лише через абстрактні інтерфейси. Хоча конкретні фабрики створюють конкретні продукти, їхні методи оголошено як такі, що повертають *абстрактні* продукти, тож клієнт ніколи не прив'язується до варіанта.

## Реалізація на Python

```python
from abc import ABC, abstractmethod


# Абстрактні продукти: по одному інтерфейсу на тип продукту.
class Chair(ABC):
    style: str

    @abstractmethod
    def sit_on(self) -> str: ...


class Sofa(ABC):
    style: str

    @abstractmethod
    def lie_on(self) -> str: ...

    def matches(self, chair: Chair) -> bool:
        # Продукти одного сімейства можуть взаємодіяти між собою.
        return self.style == chair.style


# Конкретні продукти, згруповані за варіантами.
class ModernChair(Chair):
    style = "modern"

    def sit_on(self) -> str:
        return "You sit on a minimalist chair with steel legs"


class ModernSofa(Sofa):
    style = "modern"

    def lie_on(self) -> str:
        return "You stretch out on a low grey modular sofa"


class VictorianChair(Chair):
    style = "victorian"

    def sit_on(self) -> str:
        return "You sit on a carved walnut chair with velvet padding"


class VictorianSofa(Sofa):
    style = "victorian"

    def lie_on(self) -> str:
        return "You sink into a tufted sofa with rolled arms"


# Абстрактна фабрика: по одному методу створення на тип продукту.
class FurnitureFactory(ABC):
    @abstractmethod
    def create_chair(self) -> Chair: ...

    @abstractmethod
    def create_sofa(self) -> Sofa: ...


# Конкретні фабрики: по одній на варіант.
class ModernFurnitureFactory(FurnitureFactory):
    def create_chair(self) -> Chair:
        return ModernChair()

    def create_sofa(self) -> Sofa:
        return ModernSofa()


class VictorianFurnitureFactory(FurnitureFactory):
    def create_chair(self) -> Chair:
        return VictorianChair()

    def create_sofa(self) -> Sofa:
        return VictorianSofa()


def furnish_living_room(factory: FurnitureFactory) -> None:
    # Клієнт знає лише абстрактну фабрику й абстрактні продукти.
    chairs = [factory.create_chair() for _ in range(2)]
    sofa = factory.create_sofa()
    print(sofa.lie_on())
    print(chairs[0].sit_on())
    print("Set matches:", all(sofa.matches(chair) for chair in chairs))


for factory in (ModernFurnitureFactory(), VictorianFurnitureFactory()):
    print(f"--- {type(factory).__name__} ---")
    furnish_living_room(factory)
```

Результат:

```text
--- ModernFurnitureFactory ---
You stretch out on a low grey modular sofa
You sit on a minimalist chair with steel legs
Set matches: True
--- VictorianFurnitureFactory ---
You sink into a tufted sofa with rolled arms
You sit on a carved walnut chair with velvet padding
Set matches: True
```

`furnish_living_room()` жодного разу не згадує конкретний клас. Передайте їй іншу фабрику, і вся кімната одразу й узгоджено змінить стиль.

### Пайтонівський варіант: сімейство як дані

Коли фабричні методи лише викликають конструктори, окремий клас на кожен варіант може здаватися громіздким. У Python сімейство може бути просто записом із класів:

```python
# Продовження попереднього прикладу
from dataclasses import dataclass


@dataclass(frozen=True)
class FurnitureFamily:
    chair: type[Chair]
    sofa: type[Sofa]


FAMILIES = {
    "modern": FurnitureFamily(chair=ModernChair, sofa=ModernSofa),
    "victorian": FurnitureFamily(chair=VictorianChair, sofa=VictorianSofa),
}

family = FAMILIES["victorian"]
chair, sofa = family.chair(), family.sofa()
print(type(chair).__name__, type(sofa).__name__, sofa.matches(chair))
```

Результат:

```text
VictorianChair VictorianSofa True
```

Головна гарантія (один об'єкт видає узгоджений набір) зберігається, а коду значно менше. Повноцінні класи фабрик варто обирати, коли створення продукту потребує логіки чи конфігурації, як у наступному прикладі. Ту саму роль може грати й модуль: два модулі з однаковими назвами функцій — це дві взаємозамінні «фабрики».

## Практичний приклад: локальна та хмарна інфраструктура

Інтернет-магазин зберігає чеки й ставить у чергу завдання на розсилку листів. У продакшені він використовує хмарне сховище й хмарну чергу. На ноутбуці розробника й у тестах потрібні версії в пам'яті. Змішувати їх, скажімо, справжню хмарну чергу зі сховищем у пам'яті, означало б надсилати листи про чеки, яких ніде не збережено. Ці сервіси утворюють сімейство, а середовище обирає варіант.

```python
from abc import ABC, abstractmethod
from collections import deque


class Storage(ABC):
    @abstractmethod
    def save(self, key: str, data: str) -> str: ...


class TaskQueue(ABC):
    @abstractmethod
    def push(self, task: str) -> str: ...


class InfrastructureFactory(ABC):
    @abstractmethod
    def create_storage(self) -> Storage: ...

    @abstractmethod
    def create_queue(self) -> TaskQueue: ...


# Локальне сімейство: усе в пам'яті, ідеально для розробки й тестів.
class MemoryStorage(Storage):
    def __init__(self) -> None:
        self.files: dict[str, str] = {}

    def save(self, key: str, data: str) -> str:
        self.files[key] = data
        return f"memory://{key}"


class MemoryQueue(TaskQueue):
    def __init__(self) -> None:
        self.tasks: deque[str] = deque()

    def push(self, task: str) -> str:
        self.tasks.append(task)
        return f"queued locally ({len(self.tasks)} pending)"


class LocalFactory(InfrastructureFactory):
    def create_storage(self) -> Storage:
        return MemoryStorage()

    def create_queue(self) -> TaskQueue:
        return MemoryQueue()


# Хмарне сімейство: ті самі інтерфейси; мережеві виклики тут імітовано.
class BucketStorage(Storage):
    def __init__(self, bucket: str) -> None:
        self.bucket = bucket

    def save(self, key: str, data: str) -> str:
        return f"https://{self.bucket}.storage.example.com/{key} ({len(data)} bytes)"


class CloudQueue(TaskQueue):
    def __init__(self, name: str) -> None:
        self.name = name

    def push(self, task: str) -> str:
        return f"sent to cloud queue '{self.name}'"


class CloudFactory(InfrastructureFactory):
    def __init__(self, region: str) -> None:
        self.region = region  # спільна конфігурація для всього сімейства

    def create_storage(self) -> Storage:
        return BucketStorage(f"receipts-{self.region}")

    def create_queue(self) -> TaskQueue:
        return CloudQueue(f"emails-{self.region}")


class OrderService:
    """Клієнт: залежить лише від абстрактної фабрики та продуктів."""

    def __init__(self, infra: InfrastructureFactory) -> None:
        self.storage = infra.create_storage()
        self.queue = infra.create_queue()

    def place_order(self, order_id: int, email: str) -> None:
        location = self.storage.save(f"receipt-{order_id}.txt", f"Order {order_id} paid")
        status = self.queue.push(f"email {email} about order {order_id}")
        print(f"order {order_id}: receipt at {location}; email {status}")


def make_infrastructure(config: dict[str, str]) -> InfrastructureFactory:
    # Єдине місце, що знає конкретні фабрики: виконується один раз під час запуску.
    match config["env"]:
        case "local":
            return LocalFactory()
        case "cloud":
            return CloudFactory(region=config["region"])
        case other:
            raise ValueError(f"unknown environment: {other}")


for config in ({"env": "local"}, {"env": "cloud", "region": "eu-central"}):
    print(f"--- env={config['env']} ---")
    service = OrderService(make_infrastructure(config))
    service.place_order(1001, "olena@example.com")
    service.place_order(1002, "taras@example.com")
```

Результат:

```text
--- env=local ---
order 1001: receipt at memory://receipt-1001.txt; email queued locally (1 pending)
order 1002: receipt at memory://receipt-1002.txt; email queued locally (2 pending)
--- env=cloud ---
order 1001: receipt at https://receipts-eu-central.storage.example.com/receipt-1001.txt (15 bytes); email sent to cloud queue 'emails-eu-central'
order 1002: receipt at https://receipts-eu-central.storage.example.com/receipt-1002.txt (15 bytes); email sent to cloud queue 'emails-eu-central'
```

Зверніть увагу на три речі:

- `OrderService` однаковий в обох середовищах. Конкретні класи знає лише `make_infrastructure()`, і вона виконується один раз.
- Конкретна фабрика може містити **спільну конфігурацію** (`region`), тож усі продукти сімейства налаштовано узгоджено.
- Тести отримують цілісне фейкове середовище, просто передавши `LocalFactory()`, а потім можуть перевірити `service.storage.files`.

## Коли застосовувати

- **Код має працювати з кількома сімействами пов'язаних продуктів і не повинен залежати від їхніх конкретних класів.** Класи можуть бути наперед невідомі, або ви хочете залишити місце для нових варіантів. Доки все створюється через інтерфейс фабрики, продукт, що не пасує до решти, просто не може з'явитися.
- **У класі накопичилося кілька фабричних методів, які розмивають його основний обов'язок.** Винесіть їх в окремий об'єкт-фабрику. Кожен клас має відповідати за щось одне.
- **Вибір варіанта — це рішення розгортання** (операційна система, тема, середовище, постачальник СУБД, регіон), яке слід ухвалити один раз і далі всюди дотримуватися.

## Кроки реалізації

1. Складіть матрицю: типи продуктів (рядки) проти варіантів (стовпці).
2. Оголосіть інтерфейс абстрактного продукту для кожного типу продукту й зробіть так, щоб кожен конкретний продукт реалізовував свій інтерфейс.
3. Оголосіть абстрактну фабрику з методом створення для кожного абстрактного продукту; кожен метод повертає абстрактний тип.
4. Реалізуйте по одному класу конкретної фабрики на кожен варіант.
5. Напишіть код ініціалізації, що обирає конкретну фабрику на основі конфігурації чи середовища. Передайте об'єкт фабрики всім класам, які створюють продукти.
6. Знайдіть у клієнтському коді всі прямі виклики конструкторів продуктів і замініть їх викликами відповідних методів фабрики.

## Переваги та недоліки

| Переваги | Недоліки |
|---|---|
| Продукти з однієї фабрики гарантовано сумісні. | Багато нових інтерфейсів і класів: по одному на кожен продукт кожного варіанта. |
| Клієнтський код не прив'язаний до конкретних продуктів і фабрик. | Новий *тип продукту* вимагає змін в абстрактній фабриці та в **кожній** конкретній. |
| *Принцип єдиного обов'язку*: створення продуктів зосереджено в одному місці. | Надмірний, коли тип продукту лише один або варіант лише один. |
| *Принцип відкритості/закритості*: нові варіанти додаються без змін у клієнтському коді. | Через непрямість важче побачити, які класи насправді використовуються. |

## Зв'язки з іншими патернами

- Багато архітектур починаються з **Фабричного методу** й переходять до **Абстрактної фабрики**, **Прототипу** чи **Будівельника**, коли потрібно більше гнучкості.
- Класи Абстрактної фабрики часто є набором **фабричних методів**. Їх також можна будувати на **Прототипах**: фабрика зберігає зразки об'єктів і клонує їх замість створення екземплярів класів.
- **Будівельник** конструює один складний об'єкт крок за кроком. Абстрактна фабрика створює *сімейства* об'єктів і повертає кожен продукт одразу.
- Абстрактна фабрика може замінити **Фасад**, коли потрібно лише приховати від клієнта, як створюються об'єкти підсистеми.
- З **Мостом**: якщо деякі абстракції працюють лише з певними реалізаціями, абстрактна фабрика може інкапсулювати ці пари й сховати їх від клієнта.
- Конкретні фабрики часто бувають **Одинаками**: застосунку зазвичай досить однієї фабрики на варіант. У Python це, як правило, просто один екземпляр на рівні модуля.

## Типові помилки

- **Змішування продуктів різних фабрик.** Гарантія діє, лише якщо всі продукти набору отримано від *того самого об'єкта фабрики*. Передавайте фабрику, а не окремі продукти, створені деінде.
- **Вибір фабрики глибоко в бізнес-логіці.** `ModernFurnitureFactory()` посеред методу повертає ту саму залежність, яку патерн мав прибрати. Обирайте фабрику один раз, на межі застосунку, і передавайте її далі.
- **Один загальний метод `create(kind: str)` замість окремого методу на продукт.** Виглядає коротше, але втрачається інформація про типи (кожен результат — «якийсь об'єкт»), одруківки виявляються лише під час виконання, а патерн непомітно знову перетворюється на ланцюжок `if/elif`.
- **Застосування, коли тип продукту лише один.** Тоді сімейства немає. Вистачить фабричного методу або звичайного callable.
- **Недооцінка нових типів продуктів.** Додати стовпець (варіант) дешево. Додати рядок (тип продукту) означає змінити кожну фабрику. Завдяки `@abstractmethod` Python принаймні не дасть створити фабрику, яку ви забули оновити, як показує вправа 3.

## Підсумок

- Абстрактна фабрика створює *сімейства* пов'язаних продуктів через один інтерфейс з методом на кожен тип продукту.
- Кожна конкретна фабрика відповідає одному варіанту й повертає лише продукти цього варіанта, тож продукти завжди сумісні.
- Клієнт залежить лише від абстрактної фабрики та абстрактних продуктів. Конкретну фабрику обирають один раз, зазвичай під час запуску.
- У Python продукти й фабрики описують через `ABC` (або `Protocol`). У простих випадках легкою фабрикою може слугувати заморожений dataclass чи модуль із класами одного сімейства.
- Конкретна фабрика — добре місце для конфігурації, спільної для всього сімейства.
- Варіанти додавати дешево, типи продуктів — дорого. Обирайте патерн, коли варіанти змінюються частіше, ніж типи продуктів.

## Практика

### Вправа 1: Теми інтерфейсу

Створіть абстрактні продукти `Button` (`render(label: str) -> str`) і `Checkbox` (`render(label: str, checked: bool) -> str`) та абстрактну фабрику `ThemeFactory`.

- **Світла** тема малює кнопку як `[ Save ]`, а прапорець як `[x] Remember me` або `[ ] Remember me`.
- **Темна** тема малює кнопку як `<< Save >>`, а прапорець як `(*) Remember me` або `( ) Remember me`.

Напишіть клієнтську функцію `render_login_form(factory)`, яка виводить одну кнопку й два прапорці (один позначений, другий ні), і викличте її з обома фабриками.

### Вправа 2: Рендерери документів

Звіт потрібно формувати в HTML або в Markdown. Сімейство складається з `Heading`, `Paragraph` і `BulletList` (кожен із методом `render(...) -> str`). Реалізуйте `HtmlFactory` і `MarkdownFactory`, а також клієнтську функцію `render_document(factory, title, intro, items)`, що повертає весь документ як рядок. У клієнті не має бути жодного `if` щодо формату.

### Вправа 3: Новий тип продукту

Розширте свій розв'язок вправи 1 третім продуктом `TextField` (`render(placeholder: str) -> str`): світла тема малює `[____ email ____]`, темна — `{.... email ....}`.

Спершу додайте до `ThemeFactory` лише абстрактний метод `create_text_field()` і реалізуйте його у світлій фабриці. Спробуйте створити темну фабрику й виведіть помилку. Потім завершіть темну тему й відобразіть форму з усіма трьома віджетами.

## Розв'язки

### Вправа 1

```python
from abc import ABC, abstractmethod


class Button(ABC):
    @abstractmethod
    def render(self, label: str) -> str: ...


class Checkbox(ABC):
    @abstractmethod
    def render(self, label: str, checked: bool) -> str: ...


class ThemeFactory(ABC):
    @abstractmethod
    def create_button(self) -> Button: ...

    @abstractmethod
    def create_checkbox(self) -> Checkbox: ...


class LightButton(Button):
    def render(self, label: str) -> str:
        return f"[ {label} ]"


class LightCheckbox(Checkbox):
    def render(self, label: str, checked: bool) -> str:
        return f"[{'x' if checked else ' '}] {label}"


class DarkButton(Button):
    def render(self, label: str) -> str:
        return f"<< {label} >>"


class DarkCheckbox(Checkbox):
    def render(self, label: str, checked: bool) -> str:
        return f"({'*' if checked else ' '}) {label}"


class LightThemeFactory(ThemeFactory):
    def create_button(self) -> Button:
        return LightButton()

    def create_checkbox(self) -> Checkbox:
        return LightCheckbox()


class DarkThemeFactory(ThemeFactory):
    def create_button(self) -> Button:
        return DarkButton()

    def create_checkbox(self) -> Checkbox:
        return DarkCheckbox()


def render_login_form(factory: ThemeFactory) -> None:
    checkbox = factory.create_checkbox()
    print(checkbox.render("Remember me", checked=True))
    print(checkbox.render("Subscribe to news", checked=False))
    print(factory.create_button().render("Log in"))


for theme in (LightThemeFactory(), DarkThemeFactory()):
    print(f"--- {type(theme).__name__} ---")
    render_login_form(theme)
```

Результат:

```text
--- LightThemeFactory ---
[x] Remember me
[ ] Subscribe to news
[ Log in ]
--- DarkThemeFactory ---
(*) Remember me
( ) Subscribe to news
<< Log in >>
```

### Вправа 2

```python
from abc import ABC, abstractmethod


class Heading(ABC):
    @abstractmethod
    def render(self, text: str) -> str: ...


class Paragraph(ABC):
    @abstractmethod
    def render(self, text: str) -> str: ...


class BulletList(ABC):
    @abstractmethod
    def render(self, items: list[str]) -> str: ...


class DocumentFactory(ABC):
    @abstractmethod
    def create_heading(self) -> Heading: ...

    @abstractmethod
    def create_paragraph(self) -> Paragraph: ...

    @abstractmethod
    def create_list(self) -> BulletList: ...


class HtmlHeading(Heading):
    def render(self, text: str) -> str:
        return f"<h1>{text}</h1>"


class HtmlParagraph(Paragraph):
    def render(self, text: str) -> str:
        return f"<p>{text}</p>"


class HtmlList(BulletList):
    def render(self, items: list[str]) -> str:
        lines = "".join(f"<li>{item}</li>" for item in items)
        return f"<ul>{lines}</ul>"


class MarkdownHeading(Heading):
    def render(self, text: str) -> str:
        return f"# {text}"


class MarkdownParagraph(Paragraph):
    def render(self, text: str) -> str:
        return text


class MarkdownList(BulletList):
    def render(self, items: list[str]) -> str:
        return "\n".join(f"- {item}" for item in items)


class HtmlFactory(DocumentFactory):
    def create_heading(self) -> Heading:
        return HtmlHeading()

    def create_paragraph(self) -> Paragraph:
        return HtmlParagraph()

    def create_list(self) -> BulletList:
        return HtmlList()


class MarkdownFactory(DocumentFactory):
    def create_heading(self) -> Heading:
        return MarkdownHeading()

    def create_paragraph(self) -> Paragraph:
        return MarkdownParagraph()

    def create_list(self) -> BulletList:
        return MarkdownList()


def render_document(factory: DocumentFactory, title: str, intro: str, items: list[str]) -> str:
    parts = [
        factory.create_heading().render(title),
        factory.create_paragraph().render(intro),
        factory.create_list().render(items),
    ]
    return "\n".join(parts)


items = ["Revenue up 12%", "Two new stores", "Churn down to 3%"]
for factory in (HtmlFactory(), MarkdownFactory()):
    print(render_document(factory, "Q3 report", "Highlights of the quarter:", items))
    print()
```

Результат:

```text
<h1>Q3 report</h1>
<p>Highlights of the quarter:</p>
<ul><li>Revenue up 12%</li><li>Two new stores</li><li>Churn down to 3%</li></ul>

# Q3 report
Highlights of the quarter:
- Revenue up 12%
- Two new stores
- Churn down to 3%
```

### Вправа 3

```python
from abc import ABC, abstractmethod


class Button(ABC):
    @abstractmethod
    def render(self, label: str) -> str: ...


class Checkbox(ABC):
    @abstractmethod
    def render(self, label: str, checked: bool) -> str: ...


class TextField(ABC):
    @abstractmethod
    def render(self, placeholder: str) -> str: ...


class ThemeFactory(ABC):
    @abstractmethod
    def create_button(self) -> Button: ...

    @abstractmethod
    def create_checkbox(self) -> Checkbox: ...

    @abstractmethod
    def create_text_field(self) -> TextField: ...  # новий тип продукту


class LightButton(Button):
    def render(self, label: str) -> str:
        return f"[ {label} ]"


class LightCheckbox(Checkbox):
    def render(self, label: str, checked: bool) -> str:
        return f"[{'x' if checked else ' '}] {label}"


class LightTextField(TextField):
    def render(self, placeholder: str) -> str:
        return f"[____ {placeholder} ____]"


class DarkButton(Button):
    def render(self, label: str) -> str:
        return f"<< {label} >>"


class DarkCheckbox(Checkbox):
    def render(self, label: str, checked: bool) -> str:
        return f"({'*' if checked else ' '}) {label}"


class LightThemeFactory(ThemeFactory):
    def create_button(self) -> Button:
        return LightButton()

    def create_checkbox(self) -> Checkbox:
        return LightCheckbox()

    def create_text_field(self) -> TextField:
        return LightTextField()


class DarkThemeFactory(ThemeFactory):  # ще не оновлена
    def create_button(self) -> Button:
        return DarkButton()

    def create_checkbox(self) -> Checkbox:
        return DarkCheckbox()


try:
    DarkThemeFactory()
except TypeError as error:
    print("TypeError:", error)


# Крок 2: завершуємо темне сімейство.
class DarkTextField(TextField):
    def render(self, placeholder: str) -> str:
        return f"{{.... {placeholder} ....}}"


class CompleteDarkThemeFactory(DarkThemeFactory):
    def create_text_field(self) -> TextField:
        return DarkTextField()


for theme in (LightThemeFactory(), CompleteDarkThemeFactory()):
    print(theme.create_text_field().render("email"))
    print(theme.create_checkbox().render("Remember me", checked=True))
    print(theme.create_button().render("Sign up"))
```

Результат:

```text
TypeError: Can't instantiate abstract class DarkThemeFactory without an implementation for abstract method 'create_text_field'
[____ email ____]
[x] Remember me
[ Sign up ]
{.... email ....}
(*) Remember me
<< Sign up >>
```

У реальному коді ви просто додали б метод безпосередньо в `DarkThemeFactory`; підклас тут лише для того, щоб обидва кроки було видно в одному скрипті. Висновок: один новий тип продукту змусив змінити **кожну** фабрику, тоді як нова тема (варіант) не зачепила б жодного наявного класу. Подвоєні дужки у `f"{{.... {placeholder} ....}}"` дають буквальні `{` і `}` в f-рядку.

---

*Джерела: [Refactoring.Guru — Абстрактна фабрика](https://refactoring.guru/design-patterns/abstract-factory), [Refactoring.Guru — Абстрактна фабрика на Python](https://refactoring.guru/design-patterns/abstract-factory/python/example). Адаптовано й доповнено для PyJourney.*
