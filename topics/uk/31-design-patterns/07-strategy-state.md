# Стратегія/Стан

**Стратегія** (Strategy) і **Стан** (State) — два поведінкові патерни з майже однаковою діаграмою класів: об'єкт делегує частину роботи допоміжному об'єкту, якого можна замінити. Різниця в тому, *хто* замінює помічника і *навіщо*. Стратегія дає клієнту вибрати, **як** виконати завдання. Стан дає об'єкту змінювати власну поведінку разом зі зміною його **ситуації**, ніби він перейшов в інший клас.

## Що ви дізнаєтесь

- Як Стратегія позбавляє довгих ланцюжків `if/elif`, що вибирають алгоритм
- «Пайтонівську» форму Стратегії: звичайні функції, `functools.partial` і словник-реєстр
- Як Стан перетворює поле статусу з умовами на набір класів станів
- Коли замість патерна Стан достатньо простого `Enum` і таблиці переходів
- Як розрізняти Стратегію та Стан і обирати між ними
- Типові помилки з обома патернами

## Стратегія

### Суть патерна

**Стратегія** визначає сімейство взаємозамінних алгоритмів, виносить кожен в окремий об'єкт і дає коду, що ними користується (**контексту**), працювати з будь-яким із них через один спільний інтерфейс. Алгоритм можна вибрати й замінити під час виконання, не змінюючи контекст.

### Проблема

Інтернет-магазин рахує вартість доставки. Спочатку був лише звичайний кур'єр, потім з'явилася експрес-доставка, далі пункти видачі, згодом партнерський кур'єр із фіксованим тарифом. Розрахунок розрісся в одну функцію:

```python
def shipping_cost(order, method: str) -> float:
    if method == "standard":
        return 0.0 if order.subtotal >= 1000 else 70.0
    elif method == "express":
        return 150.0 + 20.0 * order.weight_kg
    elif method == "pickup":
        return 0.0
    # кожен новий перевізник додає сюди ще одну гілку...
    raise ValueError(f"unknown shipping method: {method}")
```

Кожен новий перевізник чи зміна правил — це правка тієї самої функції. Виправлення для експрес-доставки ризикує зламати звичайну, тести всіх способів живуть разом, а двоє розробників, що додають двох перевізників, отримують конфлікти злиття в тих самих рядках. Справжні формули довші за один рядок, тож така функція швидко розростається до сотень рядків.

### Рішення

Винесіть кожен варіант алгоритму в окрему **стратегію** з однаковим інтерфейсом, наприклад методом `cost(order)`. Початковий клас стає **контекстом**: він зберігає посилання на одну стратегію й викликає її щоразу, коли потрібен результат.

Контекст сам стратегію не вибирає. Клієнт (інтерфейс користувача, конфігурація, тести) передає йому потрібну стратегію і може згодом її замінити. Оскільки контекст працює з усіма стратегіями через один інтерфейс, нові алгоритми можна додавати, не чіпаючи ні контексту, ні інших стратегій.

### Аналогія з життя

На касі магазину касир каже: «450 гривень, будь ласка». Ви можете заплатити готівкою, банківською карткою або телефоном. Усередині кожен спосіб оплати працює по-своєму, але касиру байдуже, який ви оберете, аби покупку було оплачено. Способи оплати — це стратегії, касир — контекст, а ви, клієнт, обираєте стратегію залежно від того, що маєте в кишені.

### Структура

```text
 Клієнт: обирає стратегію й передає її контексту
    |
    v
+------------------------------+     +--------------------------+
| Context (Checkout)           |     | <<Protocol>>             |
|------------------------------|     | ShippingStrategy         |
| - shipping: ShippingStrategy o---->|--------------------------|
|------------------------------|     | + cost(order) -> float   |
| + total(order):              |     +--------------------------+
|     shipping.cost(order)     |         ^         ^         ^
+------------------------------+         :         :         :
                                  Standard   Express   PickupPoint
                                  Shipping   Shipping
```

1. **Контекст** зберігає посилання на стратегію й спілкується з нею лише через інтерфейс стратегії.
2. **Інтерфейс стратегії** оголошує метод, який контекст викликає, щоб запустити алгоритм.
3. **Конкретні стратегії** реалізують різні варіанти алгоритму.
4. Контекст викликає стратегію щоразу, коли йому потрібен алгоритм. Він не знає, яка саме конкретна стратегія в нього є.
5. **Клієнт** створює конкретну стратегію й передає її контексту. Він може замінити стратегію під час виконання.

### Реалізація на Python

```python
from dataclasses import dataclass
from typing import Protocol


@dataclass
class Order:
    subtotal: float
    weight_kg: float


class ShippingStrategy(Protocol):
    def cost(self, order: Order) -> float: ...


class StandardShipping:
    def cost(self, order: Order) -> float:
        return 0.0 if order.subtotal >= 1000 else 70.0


class ExpressShipping:
    def cost(self, order: Order) -> float:
        return 150.0 + 20.0 * order.weight_kg


class PickupPoint:
    def cost(self, order: Order) -> float:
        return 0.0


class Checkout:
    """Контекст: знає, КОЛИ потрібна доставка, а не ЯК її рахувати."""

    def __init__(self, shipping: ShippingStrategy) -> None:
        self.shipping = shipping  # можна замінити будь-коли

    def total(self, order: Order) -> float:
        return order.subtotal + self.shipping.cost(order)


order = Order(subtotal=850, weight_kg=2.5)
checkout = Checkout(StandardShipping())
print("standard:", checkout.total(order))

for strategy in (ExpressShipping(), PickupPoint()):
    checkout.shipping = strategy  # заміна алгоритму під час виконання
    print(f"{type(strategy).__name__}:", checkout.total(order))
```

Результат:

```text
standard: 920.0
ExpressShipping: 1050.0
PickupPoint: 850.0
```

Стратегія — звичайний публічний атрибут. У стилі Java тут з'явився б `set_strategy()` чи властивість, але в Python властивість потрібна лише тоді, коли присвоєння стратегії має робити ще щось (валідацію, логування). Стратегії не успадковують `ShippingStrategy`: `Protocol` описує потрібну форму, а статичний аналізатор перевіряє, що кожен клас їй відповідає.

### Стратегія як звичайна функція

Коли стратегія — це одна операція без стану, клас з одним методом — це просто функція в костюмі. Функції в Python є об'єктами першого класу, тож їх можна передавати так само, як об'єкти-стратегії:

```python
from collections.abc import Callable
from dataclasses import dataclass
from functools import partial


@dataclass
class Order:
    subtotal: float
    weight_kg: float


ShippingFn = Callable[[Order], float]


def standard(order: Order) -> float:
    return 0.0 if order.subtotal >= 1000 else 70.0


def express(order: Order) -> float:
    return 150.0 + 20.0 * order.weight_kg


def flat_rate(order: Order, *, price: float) -> float:
    return price


SHIPPING: dict[str, ShippingFn] = {
    "standard": standard,
    "express": express,
    "pickup": lambda order: 0.0,
    "courier": partial(flat_rate, price=120.0),  # налаштована стратегія
}


def checkout_total(order: Order, shipping: ShippingFn) -> float:
    return order.subtotal + shipping(order)


order = Order(subtotal=850, weight_kg=2.5)
for name, strategy in SHIPPING.items():
    print(f"{name:>8}: {checkout_total(order, strategy)}")
```

Результат:

```text
standard: 920.0
 express: 1050.0
  pickup: 850.0
 courier: 970.0
```

Тут працюють три інструменти Python:

- **`Callable[[Order], float]`** — це інтерфейс стратегії. Підходить будь-яка функція, лямбда, зв'язаний метод чи об'єкт із `__call__`.
- **`functools.partial`** (або замикання) перетворює загальну функцію на налаштовану стратегію, як це зробив би аргумент конструктора класу.
- **Словник-реєстр** замінює ланцюжок `if/elif` із розділу «Проблема»: вибір стратегії за назвою — це пошук у словнику, а новий перевізник — це один новий запис.

Ви постійно користуєтеся стратегіями-функціями. Аргумент `key` у `sorted()`, `min()` і `max()` — це стратегія, яка підказує алгоритму, як порівнювати елементи:

```python
words = ["banana", "Cherry", "apple", "fig"]

print(sorted(words))                   # типово: за кодами символів, "C" < "a"
print(sorted(words, key=str.lower))    # без урахування регістру
print(sorted(words, key=len))          # за довжиною (стабільно для рівних)
print(max(words, key=lambda w: w.count("a")))
```

Результат:

```text
['Cherry', 'apple', 'banana', 'fig']
['apple', 'banana', 'Cherry', 'fig']
['fig', 'apple', 'banana', 'Cherry']
banana
```

**Функція чи клас?** Беріть функцію, коли стратегія — одна операція без стану. Беріть клас, коли в стратегії кілька пов'язаних методів чи атрибутів, коли вона зберігає налаштування або внутрішній стан чи потребує зрозумілого `repr` та імені в логах.

### Практичний приклад: формати експорту звіту

Звіт можна експортувати в CSV, JSON або таблицю Markdown. Кожному формату потрібні дві речі: текст і розширення файлу. Тому клас тут доречніший за голу функцію. Формат обирається під час виконання, наприклад з прапорця командного рядка:

```python
import csv
import io
import json
from typing import Protocol

Row = dict[str, object]


class ExportFormat(Protocol):
    extension: str

    def render(self, rows: list[Row]) -> str: ...


class CsvFormat:
    extension = "csv"

    def render(self, rows: list[Row]) -> str:
        buffer = io.StringIO()
        writer = csv.DictWriter(buffer, fieldnames=list(rows[0]), lineterminator="\n")
        writer.writeheader()
        writer.writerows(rows)
        return buffer.getvalue()


class JsonFormat:
    extension = "json"

    def __init__(self, indent: int | None = None) -> None:
        self.indent = indent  # стратегії можуть мати власні налаштування

    def render(self, rows: list[Row]) -> str:
        return json.dumps(rows, indent=self.indent, ensure_ascii=False) + "\n"


class MarkdownFormat:
    extension = "md"

    def render(self, rows: list[Row]) -> str:
        headers = list(rows[0])
        lines = ["| " + " | ".join(headers) + " |",
                 "|" + "---|" * len(headers)]
        for row in rows:
            lines.append("| " + " | ".join(str(row[h]) for h in headers) + " |")
        return "\n".join(lines) + "\n"


FORMATS: dict[str, ExportFormat] = {
    "csv": CsvFormat(),
    "json": JsonFormat(),
    "md": MarkdownFormat(),
}


class ReportExporter:
    def __init__(self, fmt: ExportFormat) -> None:
        self.fmt = fmt

    def export(self, name: str, rows: list[Row]) -> tuple[str, str]:
        if not rows:
            raise ValueError("nothing to export")
        return f"{name}.{self.fmt.extension}", self.fmt.render(rows)


sales = [{"city": "Kyiv", "orders": 120}, {"city": "Lviv", "orders": 75}]

for choice in ("csv", "json", "md"):  # напр. значення з прапорця CLI чи конфігурації
    filename, content = ReportExporter(FORMATS[choice]).export("sales", sales)
    print(f"--- {filename}")
    print(content, end="")
```

Результат:

```text
--- sales.csv
city,orders
Kyiv,120
Lviv,75
--- sales.json
[{"city": "Kyiv", "orders": 120}, {"city": "Lviv", "orders": 75}]
--- sales.md
| city | orders |
|---|---|
| Kyiv | 120 |
| Lviv | 75 |
```

`ReportExporter` містить спільну логіку (перевірку, формування імені файлу), а кожен формат уміє лише перетворювати рядки на текст. Щоб додати експорт у XML, потрібен один новий клас і один запис у словнику.

### Коли застосовувати Стратегію

- Вам потрібні різні варіанти алгоритму всередині одного об'єкта й можливість перемикатися між ними під час виконання.
- У вас багато схожих класів, які відрізняються лише тим, як виконують одну дію. Винесіть цю дію в стратегії й об'єднайте класи.
- Ви хочете відокремити деталі алгоритму (його код, дані й залежності) від бізнес-логіки, яка ним користується.
- У класі є велика умова, що обирає один із варіантів того самого алгоритму.

### Кроки реалізації Стратегії

1. Знайдіть у контексті алгоритм, який часто змінюється або ховається за великою умовою.
2. Оголосіть інтерфейс стратегії: `Protocol`, абстрактний клас або просто тип `Callable`.
3. Перенесіть кожен варіант алгоритму в окремий клас чи функцію, що відповідає інтерфейсу.
4. Додайте контексту атрибут для стратегії. Контекст має користуватися нею лише через інтерфейс. Якщо стратегіям потрібні дані контексту, передавайте їх аргументами.
5. Дайте клієнту обирати стратегію й передавати її контексту. Словник-реєстр — зручне місце, щоб зіставити назви зі стратегіями.

### Переваги та недоліки Стратегії

**Переваги:**

- Алгоритми можна змінювати під час виконання.
- Деталі реалізації алгоритму ізольовані від коду, що ним користується.
- Композиція замінює успадкування: не потрібен окремий підклас на кожен варіант.
- *Принцип відкритості/закритості*: нові стратегії не потребують змін у контексті.

**Недоліки:**

- Якщо алгоритмів два і вони стабільні, додаткові класи й інтерфейси лише додають шуму.
- Клієнти мають розуміти різницю між стратегіями, щоб вибрати потрібну.
- У Python звичайні функції часто впораються з меншою кількістю коду. Ієрархія класів для однорядкових стратегій — це надмірне ускладнення.

### Відносини з іншими патернами

- **Міст, Стан, Стратегія** (і частково **Адаптер**) мають схожу структуру, побудовану на композиції. Вони відрізняються проблемою, яку розв'язують, а назва патерна повідомляє іншим розробникам, яка саме це проблема.
- **Команда проти Стратегії.** Обидві можуть параметризувати об'єкт дією. Команда перетворює операцію на об'єкт, який можна поставити в чергу, записати в журнал, скасувати чи надіслати деінде. Стратегія описує різні способи зробити *одне й те саме*.
- **Декоратор проти Стратегії.** Декоратор змінює «оболонку» об'єкта, загортаючи його. Стратегія змінює його «нутрощі», замінюючи внутрішній алгоритм.
- **Шаблонний метод проти Стратегії.** Шаблонний метод спирається на успадкування й змінює кроки алгоритму в підкласах, тож вибір фіксований для класу. Стратегія спирається на композицію й працює на рівні об'єкта, тому її можна змінити під час виконання.
- **Стан** можна вважати розширенням Стратегії, що й показує наступна частина.

## Стан

### Суть патерна

**Стан** дає об'єкту змінювати поведінку залежно від свого внутрішнього стану. Ззовні здається, ніби об'єкт змінив свій клас.

### Проблема

Патерн Стан тісно пов'язаний зі **скінченним автоматом** (finite-state machine): у кожен момент об'єкт перебуває в одному зі скінченної кількості станів, у кожному поводиться по-різному, і між станами дозволені лише певні **переходи**.

Візьмімо замовлення в магазині. Воно може бути `new`, `paid`, `shipped` або `cancelled`, і зміст кожної дії залежить від статусу:

- `pay()` перетворює нове замовлення на оплачене, але не має сенсу для оплаченого, відправленого чи скасованого;
- `ship()` дозволено лише для оплаченого замовлення;
- `cancel()` працює для нового й оплаченого, причому за оплачене треба ще й повернути гроші.

Перша реалізація зазвичай зберігає рядок статусу й перевіряє його в кожному методі:

```python
class Order:
    def __init__(self) -> None:
        self.status = "new"

    def pay(self) -> None:
        if self.status == "new":
            self.status = "paid"
        elif self.status == "paid":
            print("already paid")
        elif self.status in ("shipped", "cancelled"):
            print(f"cannot pay a {self.status} order")

    def ship(self) -> None:
        if self.status == "paid":
            self.status = "shipped"
        elif self.status == "new":
            print("pay first")
        else:
            print(f"cannot ship a {self.status} order")

    def cancel(self) -> None:
        if self.status == "new":
            self.status = "cancelled"
        elif self.status == "paid":
            print("refunding...")
            self.status = "cancelled"
        else:
            print(f"cannot cancel a {self.status} order")
```

У кожному методі — умова по всіх станах. Додайте статус `returned`, і доведеться правити кожен метод, причому ніщо не підкаже, який ви пропустили. З ростом проєкту стає важко побачити, які переходи дозволені, бо правила розкидані по багатьох гілках.

### Рішення

Створіть клас для кожного можливого стану й перенесіть у нього всю поведінку, що залежить від цього стану. Початковий об'єкт, **контекст**, зберігає посилання на поточний об'єкт стану й делегує йому роботу, яка залежить від стану.

Щоб змінити стан, контекст замінює свій об'єкт стану на інший. Стани можуть знати один про одного й самі запускати переходи: `New.pay()` переводить замовлення в `Paid`. Це ключова відмінність від Стратегії, де стратегії майже ніколи не знають одна про одну.

### Аналогія з життя

У торговельного автомата цілий день ті самі кнопки, але натискання «видати» означає різне. Поки монет не вкинуто, кнопка лише показує «вкиньте монети». Коли грошей достатньо, та сама кнопка видає напій і повертає автомат у режим очікування. Коли автомат порожній, будь-яка кнопка показує «немає в наявності». Кнопки — це методи контексту, а поточна ситуація автомата визначає, що вони роблять.

### Структура

```text
+----------------------------------+      +------------------------------+
| Context (Order)                  |      | State (OrderState)           |
|----------------------------------|      |------------------------------|
| - _state: OrderState  o---------------->| + pay(order)                 |
|----------------------------------|      | + ship(order)                |
| + pay()    -> _state.pay(self)   |      | + cancel(order)              |
| + ship()   -> _state.ship(self)  |      +------------------------------+
| + cancel() -> _state.cancel(self)|         ^       ^       ^        ^
| + transition_to(state)           |         |       |       |        |
+----------------------------------+        New    Paid   Shipped  Cancelled
               ^                              |       |
               |   order.transition_to(Paid())|       |
               +------------------------------+-------+
                 конкретні стани запускають переходи
```

1. **Контекст** зберігає посилання на поточний стан і делегує йому роботу, що залежить від стану. Він надає спосіб змінити стан (`transition_to()`).
2. **Інтерфейс стану** оголошує методи, що залежать від стану. Вони мають бути осмисленими для кожного стану, щоб жоден стан не мав методів, які ніколи не викликаються.
3. **Конкретні стани** реалізують ці методи. Спільну поведінку можна винести в базовий клас, щоб не дублювати її.
4. Стани отримують контекст (як аргумент методу або збережене зворотне посилання), читають з нього дані й запускають переходи. Змінювати стан можуть і контекст, і самі стани.

### Реалізація на Python

Базовий клас типово відхиляє кожну дію, тож кожен конкретний стан перевизначає лише те, що в ньому дозволено. Контекст передається в кожен метод стану аргументом, а не зберігається всередині стану. Так стани не мають зворотних посилань, а стани без даних можна навіть спільно використовувати для різних замовлень.

```python
from __future__ import annotations  # посилання наперед (у 3.14+ не потрібне)


class OrderState:
    """Базовий стан: типово кожна дія відхиляється."""

    name = "?"

    def pay(self, order: Order) -> None:
        print(f"  cannot pay: order is {self.name}")

    def ship(self, order: Order) -> None:
        print(f"  cannot ship: order is {self.name}")

    def cancel(self, order: Order) -> None:
        print(f"  cannot cancel: order is {self.name}")


class New(OrderState):
    name = "new"

    def pay(self, order: Order) -> None:
        order.transition_to(Paid())

    def cancel(self, order: Order) -> None:
        order.transition_to(Cancelled())


class Paid(OrderState):
    name = "paid"

    def ship(self, order: Order) -> None:
        order.transition_to(Shipped())

    def cancel(self, order: Order) -> None:
        print("  refunding the payment")
        order.transition_to(Cancelled())


class Shipped(OrderState):
    name = "shipped"


class Cancelled(OrderState):
    name = "cancelled"


class Order:
    """Контекст: делегує кожну залежну від стану дію об'єкту стану."""

    def __init__(self, number: int) -> None:
        self.number = number
        self._state: OrderState = New()

    @property
    def status(self) -> str:
        return self._state.name

    def transition_to(self, state: OrderState) -> None:
        print(f"  order #{self.number}: {self._state.name} -> {state.name}")
        self._state = state

    def pay(self) -> None:
        self._state.pay(self)

    def ship(self) -> None:
        self._state.ship(self)

    def cancel(self) -> None:
        self._state.cancel(self)


order = Order(1)
for action in ("ship", "pay", "pay", "ship", "cancel"):
    print(f"{action}():")
    getattr(order, action)()
print("final status:", order.status)

second = Order(2)
print("pay() + cancel():")
second.pay()
second.cancel()
```

Результат:

```text
ship():
  cannot ship: order is new
pay():
  order #1: new -> paid
pay():
  cannot pay: order is paid
ship():
  order #1: paid -> shipped
cancel():
  cannot cancel: order is shipped
final status: shipped
pay() + cancel():
  order #2: new -> paid
  refunding the payment
  order #2: paid -> cancelled
```

Порівняйте з версією на умовах: в `Order` немає жодного `if`. Усе про статус `paid` живе в `Paid`, тож новий стан `Returned` — це один клас і перехід у нього з `Shipped`.

> **Зверніть увагу:** `from __future__ import annotations` дає змогу згадувати `Order` в анотаціях до того, як клас визначено. Починаючи з Python 3.14 анотації обчислюються ліниво, тому там цей імпорт зайвий, але він зберігає сумісність коду з 3.10–3.13.

### Практичний приклад: рецензування документа

На платформі публікацій документи бувають у станах `Draft`, `Moderation` і `Published`, і те, що може зробити користувач, залежить і від стану, і від ролі користувача. Тут стани генерують `PermissionError` на заборонені дії, а абстрактні методи змушують кожен новий стан явно вирішити, як він обробляє `edit()` і `publish()`:

```python
from __future__ import annotations

from abc import ABC, abstractmethod
from dataclasses import dataclass, field


@dataclass(frozen=True)
class User:
    name: str
    is_admin: bool = False


class DocumentState(ABC):
    @abstractmethod
    def edit(self, doc: Document, user: User, text: str) -> None: ...

    @abstractmethod
    def publish(self, doc: Document, user: User) -> None: ...

    def reject(self, doc: Document, user: User, reason: str) -> None:
        raise PermissionError(f"cannot reject a document in {type(self).__name__}")


class Draft(DocumentState):
    def edit(self, doc: Document, user: User, text: str) -> None:
        if user != doc.author:
            raise PermissionError("only the author edits a draft")
        doc.text = text

    def publish(self, doc: Document, user: User) -> None:
        doc.change_state(Moderation())  # автор надсилає на перевірку


class Moderation(DocumentState):
    def edit(self, doc: Document, user: User, text: str) -> None:
        raise PermissionError("the document is under review")

    def publish(self, doc: Document, user: User) -> None:
        if not user.is_admin:
            raise PermissionError("only an admin can publish")
        doc.change_state(Published())

    def reject(self, doc: Document, user: User, reason: str) -> None:
        doc.history.append(f"rejected: {reason}")
        doc.change_state(Draft())


class Published(DocumentState):
    def edit(self, doc: Document, user: User, text: str) -> None:
        raise PermissionError("published documents are read-only")

    def publish(self, doc: Document, user: User) -> None:
        pass  # уже опубліковано: робити нічого


@dataclass
class Document:
    author: User
    text: str = ""
    state: DocumentState = field(default_factory=Draft)
    history: list[str] = field(default_factory=list)

    def change_state(self, state: DocumentState) -> None:
        self.history.append(f"{type(self.state).__name__} -> {type(state).__name__}")
        self.state = state

    def edit(self, user: User, text: str) -> None:
        self.state.edit(self, user, text)

    def publish(self, user: User) -> None:
        self.state.publish(self, user)

    def reject(self, user: User, reason: str) -> None:
        self.state.reject(self, user, reason)


olena = User("olena")
admin = User("admin", is_admin=True)

doc = Document(author=olena)
doc.edit(olena, "Design patterns, part 1")
doc.publish(olena)                       # Draft -> Moderation

for attempt in (lambda: doc.edit(olena, "typo fix"), lambda: doc.publish(olena)):
    try:
        attempt()
    except PermissionError as exc:
        print("denied:", exc)

doc.reject(admin, "add examples")        # Moderation -> Draft
doc.edit(olena, "Design patterns, part 1 (with examples)")
doc.publish(olena)                       # Draft -> Moderation
doc.publish(admin)                       # Moderation -> Published
doc.publish(admin)                       # нічого не відбувається

print(type(doc.state).__name__, "|", doc.text)
print(*doc.history, sep="\n")
```

Результат:

```text
denied: the document is under review
denied: only an admin can publish
Published | Design patterns, part 1 (with examples)
Draft -> Moderation
rejected: add examples
Moderation -> Draft
Draft -> Moderation
Moderation -> Published
```

Той самий виклик `publish()` означає «надіслати на перевірку» в `Draft`, «опублікувати, якщо ви адміністратор» у `Moderation` і «нічого не робити» в `Published`. Вебшар просто викликає `doc.publish(current_user)` і перетворює `PermissionError` на відповідь HTTP 403.

### Полегшена альтернатива: `Enum` і таблиця переходів

Якщо стани відрізняються лише тим, **які переходи дозволені**, а не поведінкою, окремі класи — це надмірність. `Enum` і словник переходів описують увесь автомат в одному місці:

```python
from enum import StrEnum


class Status(StrEnum):
    NEW = "new"
    PAID = "paid"
    SHIPPED = "shipped"
    CANCELLED = "cancelled"


TRANSITIONS: dict[tuple[Status, str], Status] = {
    (Status.NEW, "pay"): Status.PAID,
    (Status.NEW, "cancel"): Status.CANCELLED,
    (Status.PAID, "ship"): Status.SHIPPED,
    (Status.PAID, "cancel"): Status.CANCELLED,
}


class Order:
    def __init__(self) -> None:
        self.status = Status.NEW

    def fire(self, action: str) -> None:
        try:
            self.status = TRANSITIONS[self.status, action]
        except KeyError:
            print(f"cannot {action}: order is {self.status}")


order = Order()
for action in ("ship", "pay", "ship", "cancel"):
    order.fire(action)
print(order.status)
```

Результат:

```text
cannot ship: order is new
cannot cancel: order is shipped
shipped
```

Таблицю легко читати, тестувати й навіть завантажувати з конфігурації. Її межа проявляється на поверненні коштів: «скасування оплаченого замовлення ще й повертає гроші» — це *поведінка*, і чиста таблиця не виразить її без додаткових колбеків. Коли кожен стан приносить власну логіку, переходьте на патерн Стан. (`StrEnum` з'явився в Python 3.11.)

### Коли застосовувати Стан

- Об'єкт поводиться по-різному залежно від поточного стану, станів багато, а код, що залежить від стану, часто змінюється.
- Клас переповнений великими умовами, які змінюють поведінку залежно від значень його полів.
- В автоматі на умовах багато дубльованого коду для схожих станів і переходів. Класи станів можуть ділитися ним через базовий клас.

### Кроки реалізації Стану

1. Оберіть клас контексту: наявний клас із кодом, що залежить від стану, або новий.
2. Оголосіть інтерфейс стану з методами, поведінка яких залежить від стану. Дзеркалити всі методи контексту не обов'язково.
3. Створіть клас для кожного стану й перенесіть у нього відповідні гілки умов із контексту.
4. Вирішіть, як стани отримують доступ до контексту: як аргумент методу (просто, без циклічних посилань) чи як збережене в стані зворотне посилання. Якщо стану потрібні приватні деталі контексту, додайте до контексту невеликий публічний метод, а не лізьте в приватні атрибути.
5. Дайте контексту посилання на поточний стан і метод, щоб його замінити.
6. Замініть умови в контексті викликами об'єкта стану.
7. Запускайте переходи зі станів (або з контексту), передаючи новий об'єкт стану. Той, хто створює новий стан, залежить від його конкретного класу.

### Переваги та недоліки Стану

**Переваги:**

- *Принцип єдиного обов'язку*: код кожного стану живе у власному класі.
- *Принцип відкритості/закритості*: нові стани можна додавати, не змінюючи наявні стани чи контекст.
- Контекст позбувається громіздких умов скінченного автомата.
- Дозволені переходи видно в одному місці для кожного стану.

**Недоліки:**

- Для автомата з двома-трьома станами, що рідко змінюється, патерн надмірний. Досить `Enum` із таблицею чи навіть `bool`.
- Переходи розкидані по класах станів, тож загальний граф видно гірше, ніж у таблиці.
- Стани, що знають один про одного, залежать від класів один одного.

### Відносини з іншими патернами

- **Міст, Стан, Стратегія** (і частково **Адаптер**) мають спільну структуру на основі композиції, але розв'язують різні проблеми.
- **Стан як розширення Стратегії.** Обидва змінюють поведінку контексту, делегуючи роботу допоміжним об'єктам. Стратегії незалежні й нічого не знають одна про одну. Стани можуть знати один про одного й самостійно перемикати контекст з одного стану в інший.
- **Легковаговик** (Flyweight). Об'єкти станів без даних можна спільно використовувати в багатьох контекстах, як екземпляри на рівні модуля в розв'язку з турнікетом нижче.

## Стратегія проти Стану

| Питання | Стратегія | Стан |
|---|---|---|
| Що представляє допоміжний об'єкт? | *Як* виконати одне завдання (алгоритм) | *У якій ситуації* перебуває об'єкт |
| Хто його обирає чи замінює? | Клієнт, ззовні | Зазвичай самі стани як реакція на власні методи контексту |
| Чи знають помічники одне про одного? | Ні, вони незалежні | Так, стан створює наступний стан |
| Як часто він змінюється? | Рідко: обирається раз на конфігурацію чи виклик | Постійно, як частина звичайної поведінки |
| Скільки методів в інтерфейсі? | Зазвичай один | Зазвичай кілька: кожна операція, що залежить від стану |
| Чи потрібен помічнику контекст? | Рідко, дані надходять аргументами | Часто, щоб читати дані й перемикати стани |
| Полегшена форма в Python | Функція і словник-реєстр | `Enum` і таблиця переходів |

Як обрати:

- Запитайте **«хто вирішує перемкнути?»**. Якщо рішення ухвалює той, хто викликає («експортуй у JSON», «відправ експрес-доставкою»), це Стратегія. Якщо об'єкт перемикається сам унаслідок власних операцій («після `pay()` замовлення оплачене»), це Стан.
- Запитайте **«чи є перемикання частиною життєвого циклу об'єкта?»**. Стани утворюють граф із дозволеними й забороненими переходами. Стратегії утворюють меню рівноправних варіантів.
- Код може виглядати однаково. Назва патерна документує намір: `checkout.shipping = ExpressShipping()` каже читачеві «конфігурація», а `order.transition_to(Paid())` — «життєвий цикл».
- Їх добре поєднувати: об'єкт стану може використовувати стратегію, а контекст може мати і те, і те (стан `Paid` зі змінною стратегією повернення коштів).

## Типові помилки

- **Стратегії, які насправді не взаємозамінні.** Усі стратегії мають повертати однаковий тип результату. Класичний промах — одна стратегія повертає ітератор, а інша список:

  ```python
  def ascending(data: list[int]) -> list[int]:
      return sorted(data)


  def descending(data: list[int]) -> list[int]:
      return reversed(sorted(data))  # ПОМИЛКА: повертає ітератор, а не список


  for strategy in (ascending, descending):
      result = strategy([3, 1, 2])
      try:
          print(strategy.__name__, "->", result[0])
      except TypeError as exc:
          print(strategy.__name__, "->", exc)
  ```

  Результат:

  ```text
  ascending -> 1
  descending -> 'list_reverseiterator' object is not subscriptable
  ```

  Використовуйте `sorted(data, reverse=True)`. Статичний аналізатор теж помітив би цю невідповідність завдяки анотації `-> list[int]`.

- **Контекст перевіряє свою стратегію.** `if isinstance(self.strategy, ExpressShipping): ...` усередині контексту повертає ту саму умову, яку патерн мав прибрати. Якщо контексту потрібне щось додаткове, додайте це до інтерфейсу стратегії.
- **Ієрархія класів для однорядкових стратегій.** У Python часто досить функції, лямбди чи `functools.partial`.
- **Спільний об'єкт стану з даними конкретного контексту.** Ділити екземпляри станів між контекстами можна лише тоді, коли стани не мають даних. Стан, що зберігає, скажімо, лічильник спроб, треба створювати для кожного контексту окремо.
- **Дубльована логіка переходів.** Якщо і контекст, і стани вирішують, куди йти далі, правила розходяться. Оберіть одне місце для переходів.
- **Патерн Стан для тривіального автомата.** Два стани, що ніколи не змінюються, — це `bool`. Кілька станів без власної поведінки — це `Enum` і словник.
- **Пропущений метод у новому стані.** Зі звичайним базовим класом новий стан мовчки успадковує типову поведінку. Позначайте `@abstractmethod` операції, щодо яких кожен стан має ухвалити явне рішення.

## Підсумок

- Стратегія виносить взаємозамінні алгоритми за один інтерфейс. Клієнт обирає алгоритм, а контекст просто ним користується.
- У Python стратегія часто є просто функцією. Типи `Callable`, `functools.partial` і словник-реєстр замінюють ієрархії класів і ланцюжки `if/elif`.
- Стан переносить поведінку, що залежить від стану, у класи станів. Контекст делегує роботу поточному стану, а стани запускають переходи.
- Простий `Enum` із таблицею переходів достатній, коли стани відрізняються лише дозволеними переходами.
- Обидва патерни використовують композицію й схожі зовні. Стратегія — про те, *як* виконати завдання, і обирається ззовні. Стан — про те, *що* об'єкт може робити зараз, і змінюється зсередини.
- Не застосовуйте жоден із них до двох стабільних варіантів: проста умова зрозуміліша.

## Практика

### Вправа 1: Стратегії знижок

`Cart` зберігає список цін і стратегію знижки — функцію, яка отримує ціни й повертає суму, яку треба відняти. Реалізуйте `no_discount`, фабрику `percent_off(percent)`, фабрику `fixed_off(amount, minimum=0)`, яка спрацьовує лише тоді, коли сума кошика досягає `minimum`, і `three_for_two`, яка робить безкоштовним найдешевший товар із кожних трьох. Виведіть суму кошика `[300, 120, 80, 500]` з кожною стратегією.

### Вправа 2: Турнікет

Змоделюйте турнікет у метро за допомогою патерна Стан. Він має два стани, `Locked` і `Unlocked`, і дві події, `coin()` і `push()`:

- `Locked` + `coin` → зарахувати оплату й розблокувати;
- `Locked` + `push` → вивести тривогу;
- `Unlocked` + `push` → зарахувати пасажира й заблокувати;
- `Unlocked` + `coin` → повернути монету.

Стани не мають даних, тож створіть по одному спільному екземпляру кожного. Запустіть події `push, coin, coin, push, push` і виведіть лічильники.

### Вправа 3: Стратегія чи Стан?

Для кожного випадку вирішіть, який патерн пасує краще, і поясніть чому одним-двома реченнями:

1. Графічний редактор дає користувачу обрати алгоритм масштабування: найближчий сусід, білінійний чи бікубічний.
2. Мережеве з'єднання поводиться по-різному, коли воно `Connecting`, `Open` чи `Closed`: `send()` ставить дані в чергу, надсилає їх або генерує помилку.
3. HTTP-клієнт можна налаштувати політикою повторів: без повторів, із фіксованою затримкою або з експоненційною затримкою.
4. Ігровий персонаж буває `Normal`, `Poisoned` чи `Invisible`. Ефекти минають через кілька ходів, а рух і шкода персонажа залежать від ефекту.

## Розв'язки

### Вправа 1

```python
from collections.abc import Callable

Discount = Callable[[list[float]], float]  # повертає суму, яку треба відняти


def no_discount(prices: list[float]) -> float:
    return 0.0


def percent_off(percent: float) -> Discount:
    def discount(prices: list[float]) -> float:
        return round(sum(prices) * percent / 100, 2)
    return discount


def fixed_off(amount: float, minimum: float = 0.0) -> Discount:
    def discount(prices: list[float]) -> float:
        total = sum(prices)
        return min(amount, total) if total >= minimum else 0.0
    return discount


def three_for_two(prices: list[float]) -> float:
    """Кожен третій товар (починаючи з найдешевших) безкоштовний."""
    ordered = sorted(prices)
    free_items = len(prices) // 3
    return sum(ordered[:free_items])


class Cart:
    def __init__(self, prices: list[float], discount: Discount = no_discount) -> None:
        self.prices = prices
        self.discount = discount

    def total(self) -> float:
        return sum(self.prices) - self.discount(self.prices)


cart = Cart([300.0, 120.0, 80.0, 500.0])
for name, strategy in [
    ("none", no_discount),
    ("10%", percent_off(10)),
    ("-150 from 900", fixed_off(150, minimum=900)),
    ("3 for 2", three_for_two),
]:
    cart.discount = strategy
    print(f"{name:>14}: {cart.total():.2f}")
```

Результат:

```text
          none: 1000.00
           10%: 900.00
 -150 from 900: 850.00
       3 for 2: 920.00
```

`percent_off` і `fixed_off` — фабрики: вони повертають налаштовану стратегію (замикання). `Cart` працює з будь-якою функцією потрібної форми й ніколи не перевіряє, яку саме отримав.

### Вправа 2

```python
from __future__ import annotations

from abc import ABC, abstractmethod


class TurnstileState(ABC):
    @abstractmethod
    def coin(self, gate: Turnstile) -> None: ...

    @abstractmethod
    def push(self, gate: Turnstile) -> None: ...


class Locked(TurnstileState):
    def coin(self, gate: Turnstile) -> None:
        gate.paid += 1
        print("coin accepted, unlocking")
        gate.state = UNLOCKED

    def push(self, gate: Turnstile) -> None:
        print("ALARM: pay first")


class Unlocked(TurnstileState):
    def coin(self, gate: Turnstile) -> None:
        print("already unlocked, coin returned")

    def push(self, gate: Turnstile) -> None:
        gate.passed += 1
        print("welcome, locking behind you")
        gate.state = LOCKED


# Стани не мають власних даних, тож по одному екземпляру можна ділити
LOCKED, UNLOCKED = Locked(), Unlocked()


class Turnstile:
    def __init__(self) -> None:
        self.state: TurnstileState = LOCKED
        self.paid = 0
        self.passed = 0

    def coin(self) -> None:
        self.state.coin(self)

    def push(self) -> None:
        self.state.push(self)


gate = Turnstile()
for event in ("push", "coin", "coin", "push", "push"):
    getattr(gate, event)()
print(f"paid={gate.paid}, passed={gate.passed}, state={type(gate.state).__name__}")
```

Результат:

```text
ALARM: pay first
coin accepted, unlocking
already unlocked, coin returned
welcome, locking behind you
ALARM: pay first
paid=1, passed=1, state=Locked
```

Усі дані (лічильники) живуть у контексті, тому два об'єкти станів можуть безпечно обслуговувати скільки завгодно турнікетів.

### Вправа 3

1. **Стратегія.** Користувач обирає один із кількох рівноцінних алгоритмів для того самого завдання. Алгоритми не перемикаються один на одного.
2. **Стан.** З'єднання переходить між станами внаслідок власних операцій (підключення, закриття, помилки), і `send()` має поводитися в кожному по-різному.
3. **Стратегія.** Політика повторів обирається конфігурацією й не змінюється. Політики взаємозамінні й незалежні.
4. **Стан.** Ефект персонажа змінюється з часом через ігрові події й сам минає через кілька ходів, а від ефекту залежать рух і шкода. Поточний ефект усередині все одно може використовувати стратегії (наприклад, формулу шкоди).

---

*Джерела: [Refactoring.Guru — Стратегія](https://refactoring.guru/design-patterns/strategy), [Refactoring.Guru — Стратегія на Python](https://refactoring.guru/design-patterns/strategy/python/example), [Refactoring.Guru — Стан](https://refactoring.guru/design-patterns/state), [Refactoring.Guru — Стан на Python](https://refactoring.guru/design-patterns/state/python/example). Адаптовано й доповнено для PyJourney.*
