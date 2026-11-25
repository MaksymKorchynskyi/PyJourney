# Принцип єдиної відповідальності

Принцип єдиної відповідальності (Single Responsibility Principle, SRP) стверджує, що клас, модуль або функція повинні мати **лише одну причину для змін**. Це літера «S» у SOLID, і саме цей принцип найбільше впливає на те, як ви ділите програму на частини. Код, що його дотримується, легше читати, тестувати й змінювати, не ламаючи при цьому чогось стороннього.

## Що ви дізнаєтесь

- Що таке SOLID і що означає кожна з п'яти літер
- Що насправді означає «одна відповідальність» (підказка: не «один метод»)
- Як помітити клас або функцію, які мають більше ніж одну причину для змін
- Як крок за кроком переробити клас, що порушує принцип, з кодом «до» і «після»
- Як зберегти зручний API після розділення (ідея фасаду) і чого це коштує
- Коли застосування SRP заходить надто далеко

## SOLID коротко

SOLID — це п'ять принципів об'єктно-орієнтованого проєктування, які зібрав Роберт К. Мартін («дядечко Боб», Uncle Bob) близько 2000 року. Сам акронім кількома роками пізніше запропонував Майкл Фезерс (Michael Feathers).

| Літера | Принцип | Коротко |
|---|---|---|
| S | Єдиної відповідальності (Single Responsibility) | Одна причина для змін |
| O | Відкритості/закритості (Open–Closed) | Додавайте поведінку, не редагуючи наявний код |
| L | Підстановки Лісков (Liskov Substitution) | Підклас мусить працювати всюди, де працює батьківський клас |
| I | Розділення інтерфейсів (Interface Segregation) | Невеликі, сфокусовані інтерфейси |
| D | Інверсії залежностей (Dependency Inversion) | Залежте від абстракцій, а не від конкретних деталей |

Ці принципи — орієнтири, а не закони. Усі вони мають одну мету: код, у якому зміна в одному місці не розходиться хвилями по всій системі.

## Що означає «одна відповідальність»

Поширене хибне тлумачення — «клас має робити лише одну річ» або «мати лише один метод». Справа не в цьому. Клас `Person` може мати десять методів і водночас одну відповідальність.

Корисне запитання звучить так: **хто або що змусить цей код змінитися?** Пізніше Роберт Мартін переформулював принцип: *«модуль має відповідати перед одним і тільки одним актором»*. Актор (actor) — це група людей або джерело вимог: бухгалтерія, дизайнери друкованого звіту, адміністратори бази даних, зовнішній API, з яким ви інтегруєтеся.

Якщо двоє різних акторів можуть незалежно один від одного попросити змінити той самий клас, у цього класу дві відповідальності. Рано чи пізно зміна на прохання одного актора зламає щось, на що покладається інший.

SRP тісно пов'язаний зі **зв'язністю** (cohesion): усе всередині одиниці коду має бути пов'язане між собою і змінюватися разом. Висока зв'язність усередині модулів і мало залежностей між ними — ось що робить код легким для змін.

## До: клас із двома обов'язками

Ось невеликий клас `Person`, який до того ж уміє сам себе зберігати:

```python
class Person:
    def __init__(self, name):
        self.name = name

    def __repr__(self):
        return f"Person(name={self.name!r})"

    def save(self):
        # Уявімо, що тут іде звернення до справжньої бази даних
        print(f"Save {self} to the database")


if __name__ == "__main__":
    p = Person("John Doe")
    p.save()
```

Результат:

```text
Save Person(name='John Doe') to the database
```

Клас має два обов'язки:

1. **Представляти людину**: зберігати ім'я та інші персональні дані, можливо, перевіряти їх.
2. **Зберігати людину**: знати про базу даних, з'єднання, SQL, структуру таблиці.

Ці обов'язки змінюються з різних причин. Нове правило на кшталт «ім'я не може бути порожнім» стосується першого. Перехід із PostgreSQL на JSON-файл чи REST API стосується другого. Коли обидва обов'язки живуть в одному класі, кожна зміна сховища означає редагувати `Person`, повторно тестувати `Person` і, можливо, зламати код, якому потрібні лише імена.

> **Зверніть увагу:** у деяких посібниках `save()` записують як `@classmethod`, що отримує людину (`Person.save(p)`). Проблема та сама: логіка збереження живе в класі, який описує дані.

## Після: окремий клас для кожної відповідальності

Перенесімо код збереження в окремий клас:

```python
class Person:
    def __init__(self, name):
        self.name = name

    def __repr__(self):
        return f"Person(name={self.name!r})"


class PersonDB:
    def save(self, person):
        print(f"Save {person} to the database")


if __name__ == "__main__":
    p = Person("John Doe")

    db = PersonDB()
    db.save(p)
```

Результат:

```text
Save Person(name='John Doe') to the database
```

Тепер:

- `Person` відповідає за дані людини і навіть не знає, що бази даних існують.
- `PersonDB` відповідає за збереження людей. Це єдине місце, яке змінюється, коли змінюється сховище.

Якщо згодом знадобиться зберігати людей у файл, ви напишете новий клас (скажімо, `PersonFile`), а `Person` залишиться без змін. Крім того, `Person` можна тестувати взагалі без бази даних.

Практичне правило: **тримайте разом те, що змінюється з однієї причини, і розділяйте те, що змінюється з різних.**

## Реалістичніший приклад

Справжні порушення рідко бувають такими очевидними, як `Person.save()`. Вони наростають по одному методу. Ось рахунок-фактура (invoice), який сам себе обчислює, форматує і серіалізує:

```python
import json


class Invoice:
    def __init__(self, customer, items):
        self.customer = customer
        self.items = items  # список кортежів (опис, ціна, кількість)

    def total(self):
        return sum(price * quantity for _, price, quantity in self.items)

    def to_text(self):
        lines = [f"Invoice for {self.customer}"]
        for description, price, quantity in self.items:
            lines.append(f"  {description:<10}{quantity:>3} x {price:>6.2f}")
        lines.append(f"  {'TOTAL':<10}{self.total():>12.2f}")
        return "\n".join(lines)

    def to_json(self):
        return json.dumps({"customer": self.customer, "items": self.items})


invoice = Invoice("Olena", [("Keyboard", 49.90, 1), ("Cable", 5.00, 3)])
print(invoice.to_text())
print(invoice.to_json())
```

Результат:

```text
Invoice for Olena
  Keyboard    1 x  49.90
  Cable       3 x   5.00
  TOTAL            64.90
{"customer": "Olena", "items": [["Keyboard", 49.9, 1], ["Cable", 5.0, 3]]}
```

Зміни тут можуть просити троє різних акторів:

- **Бухгалтерія**: «додайте ПДВ до суми» змінює `total()`.
- **Той, хто проєктує друкований рахунок**: «вирівняйте колонки інакше» змінює `to_text()`.
- **Той, хто відповідає за зберігання чи інтеграції**: «зберігайте позиції як об'єкти, а не масиви» змінює `to_json()`.

Перероблена версія дає кожному акторові власний клас:

```python
import json
from dataclasses import asdict, dataclass, field


@dataclass
class LineItem:
    description: str
    price: float
    quantity: int


@dataclass
class Invoice:
    """Лише бізнес-дані та бізнес-правила."""
    customer: str
    items: list[LineItem] = field(default_factory=list)

    def total(self):
        return sum(item.price * item.quantity for item in self.items)


class InvoiceTextFormatter:
    """Знає, як рахунок виглядає на папері."""

    def format(self, invoice):
        lines = [f"Invoice for {invoice.customer}"]
        for item in invoice.items:
            lines.append(
                f"  {item.description:<10}{item.quantity:>3} x {item.price:>6.2f}"
            )
        lines.append(f"  {'TOTAL':<10}{invoice.total():>12.2f}")
        return "\n".join(lines)


class InvoiceJsonSerializer:
    """Знає, як рахунок зберігається."""

    def dumps(self, invoice):
        return json.dumps(asdict(invoice))


invoice = Invoice(
    "Olena",
    [LineItem("Keyboard", 49.90, 1), LineItem("Cable", 5.00, 3)],
)
print(InvoiceTextFormatter().format(invoice))
print(InvoiceJsonSerializer().dumps(invoice))
```

Результат:

```text
Invoice for Olena
  Keyboard    1 x  49.90
  Cable       3 x   5.00
  TOTAL            64.90
{"customer": "Olena", "items": [{"description": "Keyboard", "price": 49.9, "quantity": 1}, {"description": "Cable", "price": 5.0, "quantity": 3}]}
```

Зверніть увагу: `total()` залишився в `Invoice`. Обчислення суми — це бізнес-правило рахунку, тож воно належить до даних рахунку. SRP не вимагає обдирати класи до голих даних; він вимагає не змішувати *непов'язані* причини для змін.

> **Порада:** у реальному коді, що працює з грошима, використовуйте `decimal.Decimal` замість `float`, щоб уникнути похибок округлення. Тут `float` узято лише для стислості прикладу.

## SRP для функцій

Принцип стосується й функцій. Ця функція розбирає вхідні дані, рахує і друкує результат:

```python
def print_expense_report(csv_text):
    total = 0.0
    for line in csv_text.strip().splitlines():
        category, amount = line.split(",")
        total += float(amount)
    print(f"Total expenses: {total:.2f}")


print_expense_report("food,12.50\ntaxi,7.25\nbooks,30")
```

Результат:

```text
Total expenses: 49.75
```

Вона працює, але розбір даних неможливо протестувати, не перехоплюючи виведення `print()`, а форматування не вдасться використати для іншого джерела даних. Розділімо її на невеликі функції, кожна з однією причиною для змін:

```python
def parse_amounts(csv_text):
    """Розбір: змінюється, коли змінюється формат вхідних даних."""
    amounts = []
    for line in csv_text.strip().splitlines():
        _category, amount = line.split(",")
        amounts.append(float(amount))
    return amounts


def format_total(total):
    """Представлення: змінюється, коли змінюється вигляд звіту."""
    return f"Total expenses: {total:.2f}"


def print_expense_report(csv_text):
    """Лише координація: з'єднує дрібні частини докупи."""
    print(format_total(sum(parse_amounts(csv_text))))


print_expense_report("food,12.50\ntaxi,7.25\nbooks,30")
print(parse_amounts("a,1\nb,2.5"))
print(format_total(0))
```

Результат:

```text
Total expenses: 49.75
[1.0, 2.5]
Total expenses: 0.00
```

`parse_amounts()` і `format_total()` — чисті функції: приймають вхідні дані й повертають результат без побічних ефектів. Тому їх дуже легко тестувати. Функція верхнього рівня лише координує роботу.

> **Порада:** у Python відповідальність не обов'язково має бути класом. Функція на рівні модуля часто є найпростішим місцем для одного обов'язку.

## Зручний API після розділення: фасад

Після розділення викликачам доводиться працювати з кількома об'єктами замість одного. **Фасад** (facade) ховає це за єдиною точкою входу. Найпростіший варіант — дозволити `Person` делегувати роботу `PersonDB`:

```python
class PersonDB:
    def save(self, person):
        print(f"Save {person} to the database")


class Person:
    def __init__(self, name):
        self.name = name
        self.db = PersonDB()

    def __repr__(self):
        return f"Person(name={self.name!r})"

    def save(self):
        self.db.save(self)


if __name__ == "__main__":
    p = Person("John Doe")
    p.save()
```

Результат:

```text
Save Person(name='John Doe') to the database
```

*Логіка* збереження й далі живе в `PersonDB`, тож перехід на іншу базу даних не зачіпає код `Person`. Але погляньте на ціну: тепер `Person` сам створює `PersonDB`. Кожен `Person` жорстко прив'язаний до цього сховища, у тесті не можна створити `Person`, не створивши заодно `PersonDB`, а перехід на збереження у файл однаково вимагає редагувати `Person.__init__`. Зчеплення (coupling), яке ми прибрали, частково повернулося.

Чистіший фасад розташований *поруч* із класами, які він координує, і отримує сховище ззовні:

```python
class PersonDB:
    def save(self, person):
        print(f"Save {person} to the database")


class PersonFile:
    def save(self, person):
        print(f"Save {person} to a file")


class Person:
    def __init__(self, name):
        self.name = name

    def __repr__(self):
        return f"Person(name={self.name!r})"


class PersonService:
    """Фасад для решти застосунку."""

    def __init__(self, storage):
        self.storage = storage

    def register(self, name):
        person = Person(name)
        self.storage.save(person)
        return person


service = PersonService(PersonDB())
service.register("John Doe")

service = PersonService(PersonFile())
service.register("Jane Doe")
```

Результат:

```text
Save Person(name='John Doe') to the database
Save Person(name='Jane Doe') to a file
```

`Person` нічого не знає про сховище, `PersonDB` і `PersonFile` нічого не знають про реєстрацію, а `PersonService` лише координує. Передавання сховища ззовні називають **впровадженням залежностей** (dependency injection). Це центральна ідея принципу інверсії залежностей, літери «D» у SOLID.

## Як помітити порушення

- Щоб описати клас, потрібне слово **«і»**: «він зберігає користувачів, *і* надсилає листи, *і* будує звіти».
- Назва розмита: `Manager`, `Helper`, `Utils`, `Processor`, `Handler` без чіткого предмета.
- Групи методів працюють із **неперетинними наборами атрибутів**. Якщо половина методів чіпає `self.items`, а друга половина — `self.connection`, перед вами два класи.
- Імпорти на початку модуля походять із непов'язаних світів: `sqlite3`, `smtplib`, `json`, `tkinter`.
- Непов'язані запити на зміни постійно потрапляють у **той самий файл**, і там часто виникають конфлікти злиття.
- Щоб протестувати просте обчислення, доводиться мокати базу даних, мережу або файлову систему.

## Компроміси: коли SRP заходить задалеко

SRP має свою ціну, і розділення не завжди є виграшем.

- **Більше частин — більше непрямості.** Кожен додатковий клас — це ще одна назва, яку треба запам'ятати, і ще один файл, який треба відкрити. Десять однорядкових класів можуть читатися гірше, ніж один зв'язний клас на 50 рядків.
- **Розділити неправильно гірше, ніж не розділяти.** Якщо дві частини завжди змінюються разом, їх розділення означає лише те, що кожна зміна зачіпатиме два місця (таку ваду іноді називають *хірургією дробовиком*, shotgun surgery).
- **Відповідальність — питання судження.** «Сформувати звіт» у невеликому скрипті може бути однією відповідальністю, а у великому продукті — трьома (верстка, локалізація, експорт). Розділяйте, коли друга причина для змін справді з'являється або очевидно наближається, а не «про всяк випадок».

Добрий підхід за замовчуванням: почніть просто, помітьте, коли клас починає змінюватися з двох різних причин, і тоді розділіть його.

## Типові помилки

- **Розуміти SRP як «один метод на клас».** Клас може мати багато методів, що служать одній меті. Критерій — кількість причин для змін, а не кількість методів.
- **Переносити логіку у фасад, який сам створює свої залежності.** `self.db = PersonDB()` усередині `Person` повертає зчеплення, якого ви намагалися позбутися. Краще передавати залежності ззовні.
- **Створювати «класи-боги» (god classes).** `UserManager`, який перевіряє, зберігає, надсилає листи, логує й відображає користувачів, — класичне порушення. Він розростається, доки ніхто не наважується його чіпати.
- **Надмірне розділення.** Створювати `NameValidator`, `NameNormalizer` і `NameStorage` для скрипта на 20 рядків означає додавати структуру без жодної користі.
- **Змішувати введення-виведення з логікою.** Функцію, яка і обчислює, і друкує чи записує результат, важко повторно використати й протестувати. Повертайте значення з логіки, а введення-виведення виконуйте на краях програми.

## Підсумок

- SOLID — це п'ять принципів проєктування; SRP — літера «S».
- SRP: клас, модуль чи функція повинні мати одну причину для змін, тобто відповідати перед одним актором.
- «Одна відповідальність» не означає «один метод». Це висока зв'язність: те, що змінюється разом, тримається разом.
- Відокремлюйте бізнес-дані та правила від представлення, зберігання та іншої інфраструктури.
- Невеликі чисті функції — природний спосіб застосовувати SRP у Python.
- Фасад повертає зручний API після розділення; нехай він отримує залежності ззовні, а не створює їх сам.
- Не розділяйте надміру: розділяйте, коли з'являється реальна друга причина для змін.

## Практика

### Вправа 1: Знайдіть причини для змін

Перелічіть усі причини, з яких цей клас може змінитися, і хто міг би про це попросити. Потім розділіть клас так, щоб кожна частина мала одну причину для змін, і покажіть, що результат той самий.

```python
class Order:
    def __init__(self, customer, amounts):
        self.customer = customer
        self.amounts = amounts

    def total(self):
        return sum(self.amounts)

    def total_with_discount(self):
        total = self.total()
        return total * 0.9 if total > 100 else total

    def email_text(self):
        return f"Dear {self.customer}, you owe {self.total_with_discount():.2f} UAH."

    def to_csv_row(self):
        return f"{self.customer},{self.total():.2f}"


order = Order("Taras", [80, 40])
print(order.email_text())
print(order.to_csv_row())
```

Результат:

```text
Dear Taras, you owe 108.00 UAH.
Taras,120.00
```

### Вправа 2: Розділіть функцію

Перепишіть `summarize_orders()` як три функції з одним призначенням кожна: `parse_orders(text)`, `active_orders(orders)` і `format_order(order)`, а також коротку `summarize_orders()`, яка їх поєднує. Доведіть, що нова версія повертає точно такий самий рядок, як і стара.

```python
def summarize_orders(text):
    result = []
    for line in text.strip().splitlines():
        item, qty, price = line.split(";")
        qty = int(qty)
        if qty == 0:
            continue
        price = float(price)
        result.append(f"{item}: {qty} x {price:.2f} = {qty * price:.2f}")
    return "\n".join(result)


data = """
apple;3;0.5
pear;0;0.8
melon;1;2.75
"""
print(summarize_orders(data))
```

Результат:

```text
apple: 3 x 0.50 = 1.50
melon: 1 x 2.75 = 2.75
```

### Вправа 3: Додайте формат, не чіпаючи клас даних

Винесіть форматування CSV із `Report` в окремий клас `CsvReportFormatter`. Потім додайте `MarkdownReportFormatter`, який виводить однорядкову Markdown-таблицю, **не** змінюючи `Report` удруге.

```python
class Report:
    def __init__(self, title, scores):
        self.title = title
        self.scores = scores

    def average(self):
        return sum(self.scores) / len(self.scores)

    def to_csv(self):
        return f"title,average\n{self.title},{self.average():.1f}"


print(Report("Week 1", [4, 5, 3]).to_csv())
```

Результат:

```text
title,average
Week 1,4.0
```

## Розв'язки

### Вправа 1

Причини для змін:

- **Дані замовлення** (клієнт, суми, спосіб підсумовування): основна предметна область.
- **Правило знижки** («10% знижки понад 100»): маркетинг або відділ продажів.
- **Текст листа**: служба підтримки або відділ комунікацій.
- **Формат CSV**: бухгалтерія або той, хто імпортує файл.

```python
class Order:
    def __init__(self, customer, amounts):
        self.customer = customer
        self.amounts = amounts

    def total(self):
        return sum(self.amounts)


class DiscountPolicy:
    def apply(self, total):
        return total * 0.9 if total > 100 else total


class OrderEmailComposer:
    def compose(self, order, amount_due):
        return f"Dear {order.customer}, you owe {amount_due:.2f} UAH."


class OrderCsvExporter:
    def to_row(self, order):
        return f"{order.customer},{order.total():.2f}"


order = Order("Taras", [80, 40])
due = DiscountPolicy().apply(order.total())
print(OrderEmailComposer().compose(order, due))
print(OrderCsvExporter().to_row(order))
```

Результат:

```text
Dear Taras, you owe 108.00 UAH.
Taras,120.00
```

`OrderEmailComposer` отримує суму до сплати, а не обчислює її сам, тож нове правило знижки ніколи не зачепить код листа.

### Вправа 2

```python
def summarize_orders_old(text):
    result = []
    for line in text.strip().splitlines():
        item, qty, price = line.split(";")
        qty = int(qty)
        if qty == 0:
            continue
        price = float(price)
        result.append(f"{item}: {qty} x {price:.2f} = {qty * price:.2f}")
    return "\n".join(result)


def parse_orders(text):
    orders = []
    for line in text.strip().splitlines():
        item, qty, price = line.split(";")
        orders.append((item, int(qty), float(price)))
    return orders


def active_orders(orders):
    return [order for order in orders if order[1] > 0]


def format_order(order):
    item, qty, price = order
    return f"{item}: {qty} x {price:.2f} = {qty * price:.2f}"


def summarize_orders(text):
    return "\n".join(format_order(o) for o in active_orders(parse_orders(text)))


data = """
apple;3;0.5
pear;0;0.8
melon;1;2.75
"""
print(summarize_orders(data))
print(summarize_orders(data) == summarize_orders_old(data))
print(active_orders([("x", 0, 1.0), ("y", 2, 1.0)]))
```

Результат:

```text
apple: 3 x 0.50 = 1.50
melon: 1 x 2.75 = 2.75
True
[('y', 2, 1.0)]
```

Тепер кожну невелику функцію можна тестувати окремо, як показує останній рядок для `active_orders()`.

### Вправа 3

```python
class Report:
    def __init__(self, title, scores):
        self.title = title
        self.scores = scores

    def average(self):
        return sum(self.scores) / len(self.scores)


class CsvReportFormatter:
    def format(self, report):
        return f"title,average\n{report.title},{report.average():.1f}"


class MarkdownReportFormatter:
    def format(self, report):
        return (
            "| title | average |\n"
            "|---|---|\n"
            f"| {report.title} | {report.average():.1f} |"
        )


report = Report("Week 1", [4, 5, 3])
print(CsvReportFormatter().format(report))
print(MarkdownReportFormatter().format(report))
```

Результат:

```text
title,average
Week 1,4.0
| title | average |
|---|---|
| Week 1 | 4.0 |
```

Щоб додати формат Markdown, знадобився лише новий клас. `Report` залишився недоторканим, і саме про це наступний принцип — принцип відкритості/закритості.

---

*Джерело: [pythontutorial.net — Python Single Responsibility Principle](https://www.pythontutorial.net/python-oop/python-single-responsibility-principle/). Адаптовано й доповнено для PyJourney.*
