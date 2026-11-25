# Перевизначення методів

Підклас успадковує всі методи батька, але успадкований метод не завжди підходить. **Перевизначення методу** (method overriding) означає, що в дочірньому класі оголошують метод із тим самим ім'ям, що й у батьківському, і тоді замість батьківської версії використовується дочірня. Так підкласи уточнюють поведінку, зберігаючи той самий інтерфейс.

## Що ви дізнаєтесь

- Як перевизначити метод батька в підкласі
- Як Python вирішує, яку версію методу виконати
- Чому метод батька, що викликає `self.something()`, автоматично використовує перевизначення з дочірнього класу
- Як перевизначати атрибути класу замість цілих методів
- Як зберігати сумісність перевизначень із батьком і позначати їх декоратором `@typing.override` (Python 3.12+)
- Пастки: одруківки, змінені сигнатури та методи `__private` з викривленням імен

## Проблема: успадкований метод не підходить

Почнімо з класу `Employee`, у якого зарплата — це просто базова ставка:

```python
class Employee:
    def __init__(self, name, base_pay):
        self.name = name
        self.base_pay = base_pay

    def get_pay(self):
        return self.base_pay


class SalesEmployee(Employee):
    def __init__(self, name, base_pay, sales_incentive):
        self.name = name
        self.base_pay = base_pay
        self.sales_incentive = sales_incentive


john = SalesEmployee("John", 5000, 1500)
print(john.get_pay())
```

Результат:

```text
5000
```

`SalesEmployee` не має власного `get_pay()`, тому Python виконує успадкований `Employee.get_pay()`, який не враховує бонус за продажі. Для працівника відділу продажів результат неправильний.

## Перевизначення методу

Щоб це виправити, оголосіть `get_pay()` ще раз у підкласі:

```python
class Employee:
    def __init__(self, name, base_pay):
        self.name = name
        self.base_pay = base_pay

    def get_pay(self):
        return self.base_pay


class SalesEmployee(Employee):
    def __init__(self, name, base_pay, sales_incentive):
        self.name = name
        self.base_pay = base_pay
        self.sales_incentive = sales_incentive

    def get_pay(self):
        return self.base_pay + self.sales_incentive


if __name__ == "__main__":
    john = SalesEmployee("John", 5000, 1500)
    print(john.get_pay())

    jane = Employee("Jane", 5000)
    print(jane.get_pay())
```

Результат:

```text
6500
5000
```

`SalesEmployee.get_pay()` **перевизначає** `Employee.get_pay()`. Кожен об'єкт виконує версію, що належить його власному класу:

- `john` — це `SalesEmployee`, тому `john.get_pay()` виконує `SalesEmployee.get_pay()`.
- `jane` — звичайний `Employee`, тому `jane.get_pay()` виконує `Employee.get_pay()`. Перевизначення ніяк не впливає на сам батьківський клас.

> **Зверніть увагу:** `__init__` — теж метод, і в цьому прикладі `SalesEmployee.__init__` уже перевизначає `Employee.__init__`. Перевизначення однаково працює для всіх методів, зокрема для спеціальних («dunder») методів.

## Як Python обирає метод

Перевизначення — не окрема функція мови. Це прямий наслідок того, як працює пошук атрибутів: Python спершу шукає в класі об'єкта, потім у його батьках і бере **перший** знайдений збіг.

```text
john.get_pay()                      jane.get_pay()
    |                                   |
    v                                   v
SalesEmployee: get_pay  <- знайдено Employee: get_pay  <- знайдено
    |
Employee: get_pay   (сюди не доходить)
```

Пошук завжди починається з `type(obj)`, тобто з класу, з якого створено об'єкт, незалежно від того, де написано виклик. Це ключ до розуміння наступного розділу.

## Перевизначення і поліморфізм

Оскільки кожен працівник має метод `get_pay()`, коду, що працює з працівниками, не потрібно знати, якого саме типу об'єкт він отримав:

```python
class Employee:
    def __init__(self, name, base_pay):
        self.name = name
        self.base_pay = base_pay

    def get_pay(self):
        return self.base_pay


class SalesEmployee(Employee):
    def __init__(self, name, base_pay, sales_incentive):
        self.name = name
        self.base_pay = base_pay
        self.sales_incentive = sales_incentive

    def get_pay(self):
        return self.base_pay + self.sales_incentive


def total_payroll(employees):
    return sum(employee.get_pay() for employee in employees)


staff = [
    Employee("Jane", 5000),
    SalesEmployee("John", 5000, 1500),
    Employee("Ostap", 4200),
]
print(total_payroll(staff))
```

Результат:

```text
15700
```

`total_payroll()` викликає метод з однаковим ім'ям на кожному об'єкті, а кожен об'єкт відповідає по-своєму. Це називають **поліморфізмом** (polymorphism). Якщо згодом додати новий тип працівника (скажімо, `Contractor` з власним `get_pay()`), змінювати `total_payroll()` не доведеться.

## Метод батька може викликати перевизначення нащадка

Перевизначення стає справді потужним, коли метод **батьківського** класу викликає інший метод через `self`. Ось клас `Parser`, що витягає з тексту email і номер телефону:

```python
import re


class Parser:
    def __init__(self, text):
        self.text = text

    def email(self):
        match = re.search(r"[a-z0-9.+_-]+@[a-z0-9.+_-]+\.[a-z]+", self.text)
        if match:
            return match.group(0)
        return None

    def phone(self):
        match = re.search(r"\d{3}-\d{3}-\d{4}", self.text)
        if match:
            return match.group(0)
        return None

    def parse(self):
        return {
            "email": self.email(),
            "phone": self.phone(),
        }


s = "Contact us via 408-205-5663 or email@test.com"
parser = Parser(s)
print(parser.parse())
```

Результат:

```text
{'email': 'email@test.com', 'phone': '408-205-5663'}
```

- `email()` знаходить адресу електронної пошти.
- `phone()` знаходить номер телефону у форматі `nnn-nnn-nnnn`, де `n` — цифра, наприклад `408-205-5663`.
- `parse()` викликає обидва методи й повертає словник.

Тепер потрібно підтримати міжнародні номери у форматі `+c-nnn-nnn-nnnn`, як-от `+1-650-453-3456`, де `c` — код країни з 1–3 цифр. Логіка email і `parse()` лишаються незмінними, тож створюємо підклас і перевизначаємо лише `phone()`:

```python
import re


class Parser:
    def __init__(self, text):
        self.text = text

    def email(self):
        match = re.search(r"[a-z0-9.+_-]+@[a-z0-9.+_-]+\.[a-z]+", self.text)
        if match:
            return match.group(0)
        return None

    def phone(self):
        match = re.search(r"\d{3}-\d{3}-\d{4}", self.text)
        if match:
            return match.group(0)
        return None

    def parse(self):
        return {
            "email": self.email(),
            "phone": self.phone(),
        }


class IntlParser(Parser):
    def phone(self):
        match = re.search(r"\+\d{1,3}-\d{3}-\d{3}-\d{4}", self.text)
        if match:
            return match.group(0)
        return None


if __name__ == "__main__":
    s2 = "Contact me via +1-650-453-3456 or email@test.co.uk"

    print(Parser(s2).parse())
    print(IntlParser(s2).parse())
```

Результат:

```text
{'email': 'email@test.co.uk', 'phone': '650-453-3456'}
{'email': 'email@test.co.uk', 'phone': '+1-650-453-3456'}
```

`IntlParser` не визначає `parse()`, тому `IntlParser(s2).parse()` виконує **батьківський** `parse()`. Усередині нього `self` — це об'єкт `IntlParser`, і пошук `self.phone()` починається з `type(self)`, тобто з `IntlParser`. Отже, код батька зрештою викликає `phone()` нащадка.

Зверніть увагу й на те, що базовий `Parser` робить із міжнародним номером: він знаходить лише `650-453-3456` і мовчки відкидає префікс `+1-`. Саме для виправлення цього й існує перевизначення.

```text
IntlParser(s2).parse()
        |
        v
Parser.parse(self)          self - це IntlParser
   |-- self.email()  ->  Parser.email       (не перевизначено)
   '-- self.phone()  ->  IntlParser.phone   (перевизначення перемагає)
```

Цей підхід (метод батька задає загальний алгоритм і викликає методи-«гачки», які перевизначають підкласи) відомий як патерн проєктування **Template Method** («шаблонний метод»).

## Перевизначення атрибутів

Іноді батьківський і дочірній класи відрізняються не логікою, а лише даними. Тут змінюється тільки регулярний вираз. Замість перевизначати весь метод `phone()`, винесіть шаблон в **атрибут класу** й перевизначте лише його:

```python
import re


class Parser:
    phone_pattern = r"\d{3}-\d{3}-\d{4}"

    def __init__(self, text):
        self.text = text

    def email(self):
        match = re.search(r"[a-z0-9.+_-]+@[a-z0-9.+_-]+\.[a-z]+", self.text)
        if match:
            return match.group(0)
        return None

    def phone(self):
        match = re.search(self.phone_pattern, self.text)
        if match:
            return match.group(0)
        return None

    def parse(self):
        return {
            "email": self.email(),
            "phone": self.phone(),
        }


class IntlParser(Parser):
    phone_pattern = r"\+\d{1,3}-\d{3}-\d{3}-\d{4}"


if __name__ == "__main__":
    s = "Contact us via 408-205-5663 or email@test.com"
    print(Parser(s).parse())

    s2 = "Contact me via +1-650-453-3456 or email@test.co.uk"
    print(IntlParser(s2).parse())
```

Результат:

```text
{'email': 'email@test.com', 'phone': '408-205-5663'}
{'email': 'email@test.co.uk', 'phone': '+1-650-453-3456'}
```

`phone()` читає `self.phone_pattern`. Пошук атрибутів працює за тими самими правилами, що й пошук методів (екземпляр, потім клас, потім батьки), тому для об'єкта `IntlParser` першим знаходиться `IntlParser.phone_pattern`. Підклас тепер займає один рядок, і тіло методу більше не дублюється.

> **Порада:** у методах батька пишіть `self.phone_pattern`, а не `Parser.phone_pattern`. Жорстко прописане ім'я класу обходить пошук, і атрибут стає неможливо перевизначити.

## Перевизначення методів, успадкованих від `object`

Кожен клас успадковує від `object` методи на кшталт `__str__`, `__repr__` та `__eq__`. Перевизначаючи їх, ви налаштовуєте виведення, порівняння та іншу вбудовану поведінку:

```python
class Employee:
    def __init__(self, name, base_pay):
        self.name = name
        self.base_pay = base_pay

    def __str__(self):
        return f"{self.name} ({self.base_pay})"


class SalesEmployee(Employee):
    def __init__(self, name, base_pay, sales_incentive):
        self.name = name
        self.base_pay = base_pay
        self.sales_incentive = sales_incentive

    def __str__(self):
        return f"{self.name} ({self.base_pay} + {self.sales_incentive})"


print(Employee("Jane", 5000))
print(SalesEmployee("John", 5000, 1500))
```

Результат:

```text
Jane (5000)
John (5000 + 1500)
```

## Заміна чи розширення

Перевизначення **повністю замінює** метод батька. Батьківська версія не виконується, якщо не викликати її явно. У прикладах вище `SalesEmployee.get_pay()` сам обчислює `self.base_pay`, тобто дублює логіку батька.

Часто потрібно інше — **розширити** поведінку батька: виконати його версію й доповнити результат. Python дає змогу викликати метод батька через `super()`:

```python
class Employee:
    def __init__(self, name, base_pay):
        self.name = name
        self.base_pay = base_pay

    def get_pay(self):
        return self.base_pay


class SalesEmployee(Employee):
    def __init__(self, name, base_pay, sales_incentive):
        self.name = name
        self.base_pay = base_pay
        self.sales_incentive = sales_incentive

    def get_pay(self):
        return super().get_pay() + self.sales_incentive


print(SalesEmployee("John", 5000, 1500).get_pay())
```

Результат:

```text
6500
```

Детально `super()` розглянуто в наступній темі.

## Сумісність перевизначень

Код на кшталт `total_payroll()` розраховує, що в кожного працівника є `get_pay()`, який можна викликати **однаково**. Якщо перевизначення змінює сигнатуру, такий код ламається:

```python
class Employee:
    def __init__(self, base_pay):
        self.base_pay = base_pay

    def get_pay(self):
        return self.base_pay


class Contractor(Employee):
    def get_pay(self, hours):  # інша сигнатура
        return hours * 50


for worker in [Employee(5000), Contractor(0)]:
    print(worker.get_pay())
```

Результат:

```text
5000
Traceback (most recent call last):
  ...
TypeError: Contractor.get_pay() missing 1 required positional argument: 'hours'
```

Об'єкт підкласу має працювати всюди, де працює об'єкт батьківського класу. (Це правило відоме як принцип підстановки Лісков, Liskov Substitution Principle; про нього йдеться в розділі про SOLID.) Зберігайте ті самі параметри в перевизначеннях. Якщо нащадку потрібні додаткові дані, передайте їх у `__init__` і збережіть в атрибуті або додайте *необов'язковий* параметр зі значенням за замовчуванням.

### Позначення перевизначень декоратором `@override` (Python 3.12+)

Одруківка в імені методу-перевизначення не спричиняє жодної помилки: Python просто створює новий, ніяк не пов'язаний метод, а версія батька й далі виконується. Починаючи з Python 3.12, свій намір можна задокументувати за допомогою `typing.override`:

```python
from typing import override


class Employee:
    def get_pay(self) -> int:
        return 5000


class SalesEmployee(Employee):
    @override
    def get_pay(self) -> int:
        return 6500


print(SalesEmployee().get_pay())
print(SalesEmployee.get_pay.__override__)
```

Результат:

```text
6500
True
```

Під час виконання декоратор лише встановлює атрибут `__override__` і більше нічого не змінює. Перевірку виконує статичний аналізатор типів (mypy, pyright): якщо для методу з `@override` немає відповідного методу в батьківських класах, він повідомляє про помилку. Наприклад, з одруківкою `get_payy` mypy виводить:

```text
error: Method "get_payy" is marked as an override, but no base method was found with this name  [misc]
```

Для Python 3.11 і старіших той самий декоратор доступний як `typing_extensions.override`.

## Типові помилки

- **Одруківка в імені методу.** `def get_payy(self)` нічого не перевизначає. Батьківський `get_pay()` і далі виконується, і жодної помилки не виникає. Використовуйте `@override` та аналізатор типів, щоб це помітити.
- **Зміна сигнатури в перевизначенні.** Код, що користується інтерфейсом батька, впаде з `TypeError`. Тримайте параметри сумісними.
- **Жорстко прописане ім'я класу в методах батька.** `re.search(Parser.phone_pattern, ...)` ігнорує атрибут підкласу. Пишіть `self.phone_pattern` (або `type(self).phone_pattern`).
- **Зміна атрибута батька замість перевизначення.** Рядок `Parser.phone_pattern = ...` десь у коді змінює шаблон для *всіх* парсерів, зокрема для всіх підкласів, які його не перевизначають. Задавайте нове значення в тілі підкласу.
- **Спроба перевизначити метод `__private`.** Імена, що починаються з двох підкреслень, викривляються (name mangling) окремо для кожного класу, тож `__phone` нащадка й `__phone` батька — два різні атрибути:

  ```python
  class Parser:
      def parse(self):
          return self.__phone()  # стає self._Parser__phone()

      def __phone(self):
          return "base phone"


  class IntlParser(Parser):
      def __phone(self):  # стає _IntlParser__phone, тобто інше ім'я
          return "international phone"


  print(IntlParser().parse())
  ```

  Результат:

  ```text
  base phone
  ```

  Для методів, які підкласи мають перевизначати, використовуйте одне підкреслення (`_phone`).

## Підсумок

- Перевизначення — це оголошення в підкласі методу з тим самим ім'ям, що й у батька; для екземплярів підкласу використовується його версія.
- Python шукає метод спершу в `type(obj)`, потім у батьківських класах і бере перший збіг. Сам батьківський клас при цьому не змінюється.
- Метод батька, що викликає `self.method()`, використовує перевизначення нащадка, тож батько може задати алгоритм, а нащадки — налаштувати окремі кроки.
- Атрибути класу перевизначаються так само; перевизначити дані часто простіше, ніж цілий метод.
- Перевизначення замінює метод батька; щоб виконати й батьківську версію, використовуйте `super()`.
- Тримайте сигнатуру перевизначення сумісною з батьківською і позначайте перевизначення декоратором `@typing.override` (3.12+), щоб аналізатор типів ловив одруківки.
- Методи з іменами на кшталт `__like_this` викривляються, і перевизначити їх звичайним способом не вийде.

## Практика

### Вправа 1: Фігури

Створіть клас `Shape` з методом `area()`, що повертає `0`, і методом `describe()`, що повертає `"<ClassName> with area <area>"` (використайте `type(self).__name__` і `self.area()`). Створіть підкласи `Rectangle(width, height)` і `Circle(radius)`, які перевизначають лише `area()`. Для кола округліть площу до 2 знаків після коми через `round(..., 2)` і використайте `math.pi`. Виведіть `describe()` для `Shape()`, `Rectangle(3, 4)` і `Circle(1)`.

### Вправа 2: Привітання

Створіть клас `Greeter` з атрибутом класу `greeting = "Hello"` і методом `greet(name)`, що повертає `"<greeting>, <name>!"`. Створіть підклас `SpanishGreeter`, який змінює привітання на `"Hola"`, **не** перевизначаючи `greet()`. Покажіть, що обидва класи працюють і що `Greeter` і далі каже `"Hello"`.

### Вправа 3: Передбачте результат

Не запускаючи код, запишіть, що він виведе. Поясніть кожен рядок.

```python
class Report:
    def render(self):
        return f"[{self.header()}] {self.body()}"

    def header(self):
        return "REPORT"

    def body(self):
        return "empty"


class SalesReport(Report):
    def body(self):
        return "sales: 42"


class AnnualSalesReport(SalesReport):
    def header(self):
        return "ANNUAL"


print(Report().render())
print(SalesReport().render())
print(AnnualSalesReport().render())
```

### Вправа 4: Ціна зі знижкою

Створіть клас `Product(name, price)` з методом `final_price()`, що повертає ціну, і методом `label()`, що повертає `"<name>: <final_price> UAH"`. Створіть підклас `DiscountedProduct(name, price, percent)`, який перевизначає лише `final_price()`, щоб застосувати знижку, з округленням до 2 знаків. Усередині перевизначення використайте `super().final_price()`, щоб не дублювати логіку базової ціни. Виведіть мітки для `Product("Book", 400)` і `DiscountedProduct("Lamp", 1250, 15)`.

## Розв'язки

### Вправа 1

```python
import math


class Shape:
    def area(self):
        return 0

    def describe(self):
        return f"{type(self).__name__} with area {self.area()}"


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
        return round(math.pi * self.radius**2, 2)


for shape in [Shape(), Rectangle(3, 4), Circle(1)]:
    print(shape.describe())
```

Результат:

```text
Shape with area 0
Rectangle with area 12
Circle with area 3.14
```

`describe()` написано один раз у `Shape`, проте він показує правильну площу для кожного підкласу, бо `self.area()` шукається в класі конкретного об'єкта.

### Вправа 2

```python
class Greeter:
    greeting = "Hello"

    def greet(self, name):
        return f"{self.greeting}, {name}!"


class SpanishGreeter(Greeter):
    greeting = "Hola"


print(Greeter().greet("Taras"))
print(SpanishGreeter().greet("Taras"))
print(Greeter.greeting)
```

Результат:

```text
Hello, Taras!
Hola, Taras!
Hello
```

### Вправа 3

Результат:

```text
[REPORT] empty
[REPORT] sales: 42
[ANNUAL] sales: 42
```

- `Report().render()` використовує лише методи `Report`.
- `SalesReport` перевизначає `body()`, але успадковує `header()` і `render()`, тому заголовок лишається `REPORT`.
- `AnnualSalesReport` перевизначає `header()` і успадковує `body()` від `SalesReport`. Пошук `body` проходить `AnnualSalesReport -> SalesReport`, де метод і знаходиться.

В усіх випадках `render()` — це один і той самий метод із `Report`; відрізняються лише «гачки», які він викликає.

### Вправа 4

```python
class Product:
    def __init__(self, name, price):
        self.name = name
        self.price = price

    def final_price(self):
        return self.price

    def label(self):
        return f"{self.name}: {self.final_price()} UAH"


class DiscountedProduct(Product):
    def __init__(self, name, price, percent):
        self.name = name
        self.price = price
        self.percent = percent

    def final_price(self):
        return round(super().final_price() * (1 - self.percent / 100), 2)


print(Product("Book", 400).label())
print(DiscountedProduct("Lamp", 1250, 15).label())
```

Результат:

```text
Book: 400 UAH
Lamp: 1062.5 UAH
```

`label()` з `Product` викликає `self.final_price()`, і для товару зі знижкою спрацьовує перевизначення. Воно повторно використовує батьківський `final_price()` через `super()`, а не читає `self.price` напряму.

---

*Джерело: [pythontutorial.net — Python Overriding Method](https://www.pythontutorial.net/python-oop/python-overriding-method/). Адаптовано й доповнено для PyJourney.*
