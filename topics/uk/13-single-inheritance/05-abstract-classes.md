# Абстрактні класи

**Абстрактний клас** (abstract class) існує лише для того, щоб від нього успадковувалися: створити об'єкт безпосередньо з нього не можна. Він слугує кресленням, яке каже: «кожен підклас мусить надати ці методи», і Python перевіряє це правило, коли створюється екземпляр підкласу. За допомогою абстрактних класів проєктують сімейства споріднених класів зі спільним кодом та інтерфейсом.

## Що ви дізнаєтесь

- Що таке абстрактні класи й абстрактні методи і навіщо вони потрібні
- Як оголошувати їх за допомогою модуля `abc`: `ABC` і `@abstractmethod`
- Що робить Python, коли ви намагаєтеся створити екземпляр абстрактного класу чи незавершеного підкласу
- Як побудувати невелику програму нарахування зарплати на основі абстрактного базового класу
- Абстрактні методи з реалізацією за замовчуванням, абстрактні властивості та перевірку абстрактності
- Коли абстрактний клас — правильний інструмент і які є альтернативи

## Ідея: креслення з обов'язковими частинами

Уявіть програму нарахування зарплати для компанії з двома типами працівників:

- працівники на **повній ставці** отримують фіксовану місячну зарплату;
- працівникам з **погодинною оплатою** платять за відпрацьовані години.

Обидва типи мають ім'я, прізвище та повне ім'я, і обидва мусять уміти повідомити свою зарплату. Але «загального» працівника, для якого можна було б обчислити зарплату, не існує: обчислення залежить від типу. Отже:

- спільні частини (імена, `full_name`) належать до спільного базового класу `Employee`;
- `get_salary()` має бути в кожного працівника, але сам `Employee` реалізувати його не може;
- створення звичайного об'єкта `Employee` не має сенсу, і його слід заборонити.

Саме це й виражає абстрактний клас з **абстрактним методом** (abstract method) — методом, оголошеним без придатної до використання реалізації, який підкласи мусять перевизначити.

## Оголошення абстрактного класу

В абстрактних класів у Python немає окремого ключового слова. Їх надає модуль стандартної бібліотеки `abc` («abstract base classes», абстрактні базові класи):

- успадкуйте клас від `abc.ABC`, щоб він міг бути абстрактним;
- позначте методи, які підкласи мають реалізувати, декоратором `@abstractmethod`.

```python
from abc import ABC, abstractmethod


class Employee(ABC):
    def __init__(self, first_name, last_name):
        self.first_name = first_name
        self.last_name = last_name

    @property
    def full_name(self):
        return f"{self.first_name} {self.last_name}"

    @abstractmethod
    def get_salary(self):
        pass


employee = Employee("John", "Doe")
```

Результат:

```text
Traceback (most recent call last):
  ...
TypeError: Can't instantiate abstract class Employee without an implementation for abstract method 'get_salary'
```

`Employee` поєднує конкретні частини (`__init__`, властивість `full_name`) з одним абстрактним методом. Поки хоча б один абстрактний метод не реалізовано, створити екземпляр класу неможливо.

> **Зверніть увагу:** текст помилки змінився в Python 3.12. Старіші версії пишуть `Can't instantiate abstract class Employee with abstract method get_salary`.

Тіло абстрактного методу зазвичай складається лише з `pass`, `...` або рядка документації. Через звичайні виклики воно ніколи не виконується, бо жодного об'єкта абстрактного класу існувати не може.

## Реалізація підкласів

Підклас стає **конкретним** (тобто з нього можна створювати екземпляри), щойно перевизначить усі абстрактні методи:

```python
from abc import ABC, abstractmethod


class Employee(ABC):
    def __init__(self, first_name, last_name):
        self.first_name = first_name
        self.last_name = last_name

    @property
    def full_name(self):
        return f"{self.first_name} {self.last_name}"

    @abstractmethod
    def get_salary(self):
        pass


class FulltimeEmployee(Employee):
    def __init__(self, first_name, last_name, salary):
        super().__init__(first_name, last_name)
        self.salary = salary

    def get_salary(self):
        return self.salary


class HourlyEmployee(Employee):
    def __init__(self, first_name, last_name, worked_hours, rate):
        super().__init__(first_name, last_name)
        self.worked_hours = worked_hours
        self.rate = rate

    def get_salary(self):
        return self.worked_hours * self.rate


john = FulltimeEmployee("John", "Doe", 6000)
jenifer = HourlyEmployee("Jenifer", "Smith", 200, 50)
print(john.full_name, john.get_salary())
print(jenifer.full_name, jenifer.get_salary())
print(isinstance(jenifer, Employee))
```

Результат:

```text
John Doe 6000
Jenifer Smith 10000
True
```

- `FulltimeEmployee` зберігає фіксовану зарплату й повертає її.
- `HourlyEmployee` зберігає кількість годин і погодинну ставку та перемножує їх.
- Обидва повторно використовують `__init__` і `full_name` з `Employee` завдяки успадкуванню та `super()`.

### Підклас, що забув метод

Якщо підклас реалізує не всі абстрактні методи, він лишається абстрактним, і помилка виникає **під час спроби створити об'єкт**, а не під час оголошення класу:

```python
from abc import ABC, abstractmethod


class Shape(ABC):
    @abstractmethod
    def area(self):
        ...

    @abstractmethod
    def perimeter(self):
        ...


class Square(Shape):
    def __init__(self, side):
        self.side = side

    def area(self):
        return self.side**2


print("class Square defined fine")
Square(3)
```

Результат:

```text
class Square defined fine
Traceback (most recent call last):
  ...
TypeError: Can't instantiate abstract class Square without an implementation for abstract method 'perimeter'
```

У цьому й полягає головна перевага абстрактних класів: забутий обов'язковий метод виявляється, щойно хтось намагається скористатися незавершеним класом, а повідомлення називає відсутній метод. Без `@abstractmethod` помилка проявилася б значно пізніше — як `AttributeError` десь глибоко в іншому коді.

## Програма нарахування зарплати

Клас `Payroll` збирає працівників і виводить звіт. Він покладається лише на **інтерфейс**, визначений `Employee` (властивість `full_name` і метод `get_salary()`), тож йому не потрібно знати, з яким саме типом працівника він має справу:

```python
from abc import ABC, abstractmethod


class Employee(ABC):
    def __init__(self, first_name, last_name):
        self.first_name = first_name
        self.last_name = last_name

    @property
    def full_name(self):
        return f"{self.first_name} {self.last_name}"

    @abstractmethod
    def get_salary(self):
        pass


class FulltimeEmployee(Employee):
    def __init__(self, first_name, last_name, salary):
        super().__init__(first_name, last_name)
        self.salary = salary

    def get_salary(self):
        return self.salary


class HourlyEmployee(Employee):
    def __init__(self, first_name, last_name, worked_hours, rate):
        super().__init__(first_name, last_name)
        self.worked_hours = worked_hours
        self.rate = rate

    def get_salary(self):
        return self.worked_hours * self.rate


class Payroll:
    def __init__(self):
        self.employee_list = []

    def add(self, employee):
        self.employee_list.append(employee)

    def print_report(self):
        for e in self.employee_list:
            print(f"{e.full_name:<16} ${e.get_salary()}")


if __name__ == "__main__":
    payroll = Payroll()

    payroll.add(FulltimeEmployee("John", "Doe", 6000))
    payroll.add(FulltimeEmployee("Jane", "Doe", 6500))
    payroll.add(HourlyEmployee("Jenifer", "Smith", 200, 50))
    payroll.add(HourlyEmployee("David", "Wilson", 150, 100))
    payroll.add(HourlyEmployee("Kevin", "Miller", 100, 150))

    payroll.print_report()
```

Результат:

```text
John Doe         $6000
Jane Doe         $6500
Jenifer Smith    $10000
David Wilson     $15000
Kevin Miller     $15000
```

`{e.full_name:<16}` вирівнює ім'я по лівому краю в стовпці завширшки 16 символів, щоб суми стояли рівно.

Якщо згодом у компанії з'являться працівники на комісійній оплаті, ви додасте ще один підклас `Employee` з власним `get_salary()`. `Payroll` лишиться незмінним, а абстрактний метод гарантує, що новий клас не «забуде» обчислити зарплату.

У реальному проєкті кожен клас зазвичай жив би в окремому модулі й імпортувався б:

```text
payroll_app/
    employee.py           # Employee (абстрактний)
    fulltimeemployee.py   # FulltimeEmployee
    hourlyemployee.py     # HourlyEmployee
    payroll.py            # Payroll
    app.py                # створює працівників і виводить звіт
```

## Інші можливості абстрактних класів

### Абстрактні методи можуть мати реалізацію

`@abstractmethod` змушує підкласи перевизначити метод, але сам абстрактний метод може містити корисний код. Підкласи можуть викликати його через `super()`:

```python
from abc import ABC, abstractmethod


class Report(ABC):
    @abstractmethod
    def render(self):
        return "=== REPORT ==="


class SalesReport(Report):
    def render(self):
        header = super().render()
        return f"{header}\nsales: 42"


print(SalesReport().render())
```

Результат:

```text
=== REPORT ===
sales: 42
```

### Абстрактні властивості

Щоб вимагати властивість (property), розмістіть `@property` над `@abstractmethod` (саме в такому порядку: `@abstractmethod` має бути найближчим до `def`):

```python
from abc import ABC, abstractmethod


class Animal(ABC):
    @property
    @abstractmethod
    def sound(self):
        ...

    def speak(self):
        return f"{type(self).__name__} says {self.sound}"


class Dog(Animal):
    @property
    def sound(self):
        return "woof"


class Fish(Animal):
    pass


print(Dog().speak())
Fish()
```

Результат:

```text
Dog says woof
Traceback (most recent call last):
  ...
TypeError: Can't instantiate abstract class Fish without an implementation for abstract method 'sound'
```

Так само можна поєднувати декоратор із `@classmethod` і `@staticmethod`: `@abstractmethod` ставте безпосередньо над `def`.

### Перевірка абстрактності

Python записує імена нереалізованих абстрактних методів в атрибут класу `__abstractmethods__`, а `inspect.isabstract()` показує, чи можна створити екземпляр класу:

```python
import inspect
from abc import ABC, abstractmethod


class Shape(ABC):
    @abstractmethod
    def area(self):
        ...

    @abstractmethod
    def perimeter(self):
        ...


class Square(Shape):
    def area(self):
        return 9


print(sorted(Shape.__abstractmethods__))
print(sorted(Square.__abstractmethods__))
print(inspect.isabstract(Shape), inspect.isabstract(Square))
print(type(Shape))
```

Результат:

```text
['area', 'perimeter']
['perimeter']
True True
<class 'abc.ABCMeta'>
```

Останній рядок показує, як усе влаштовано всередині: `ABC` — це просто зручний клас, метакласом якого є `abc.ABCMeta`. Запис `class Shape(metaclass=ABCMeta):` рівнозначний `class Shape(ABC):`. Саме `ABCMeta` збирає абстрактні методи й блокує створення екземплярів.

## Коли використовувати абстрактні класи

Абстрактний базовий клас доречний, коли:

- кілька **тісно пов'язаних** класів мають спільний код (як `full_name` та `__init__` у прикладі із зарплатою) **і** спільний інтерфейс;
- ви хочете, щоб Python гарантував, що кожен підклас реалізує певні методи;
- інший код (як-от `Payroll`) має працювати з «будь-яким працівником», не зважаючи на конкретний тип.

Є й альтернативи. Python підтримує **качину типізацію** (duck typing): у `Payroll` спрацював би будь-який об'єкт із методом `get_salary()`, навіть без спільного базового класу. Для статичних аналізаторів типів `typing.Protocol` описує інтерфейс без успадкування. А стандартна бібліотека містить багато готових абстрактних базових класів у `collections.abc` (`Iterable`, `Mapping`, `Sequence`, ...): успадкувавшись від них, ви отримуєте перевірку обов'язкових методів і частину методів у подарунок.

## Типові помилки

- **Забути успадкуватися від `ABC`.** `@abstractmethod` діє лише завдяки метакласу `ABCMeta`. У звичайному класі декоратор нічого не робить:

  ```python
  from abc import abstractmethod


  class Employee:  # без ABC!
      @abstractmethod
      def get_salary(self):
          pass


  employee = Employee()
  print(employee.get_salary())
  ```

  Результат:

  ```text
  None
  ```

- **Вважати, що успадкування від `ABC` уже робить клас абстрактним.** Клас, який успадковує `ABC`, але не має абстрактних методів, можна створювати як завжди. Абстрактність визначають саме абстрактні методи.
- **Одруківка в імені методу-перевизначення.** `def get_salery(self)` у підкласі лишає `get_salary` абстрактним, і створення об'єкта генерує `TypeError`. Добра новина: повідомлення називає відсутній метод.
- **Неправильний порядок декораторів для абстрактних властивостей.** Пишіть спершу `@property`, а потім `@abstractmethod` (найближче до `def`). Зворотний порядок генерує `AttributeError` ще під час оголошення класу.
- **Використовувати абстрактний клас там, де вистачить простої функції.** Якщо реалізація лише одна і спільного коду немає, базовий клас додає церемоній без жодної користі.

## Підсумок

- З абстрактного класу не можна створити екземпляр; він слугує кресленням для підкласів.
- Оголошуйте його, успадкувавши від `abc.ABC` і позначивши обов'язкові методи декоратором `@abstractmethod`.
- Підклас стає конкретним, лише коли перевизначить усі абстрактні методи; інакше спроба створити екземпляр генерує `TypeError` з іменами відсутніх методів.
- Абстрактні класи можуть містити звичайні методи, властивості та `__init__`, які підкласи повторно використовують.
- Абстрактні методи можуть мати тіло, яке підкласи викликають через `super()`; для абстрактних властивостей `@property` ставлять над `@abstractmethod`.
- `@abstractmethod` працює лише в класах, метаклас яких — `ABCMeta` (тобто в підкласах `ABC`).
- Використовуйте абстрактні класи для сімейств тісно пов'язаних класів зі спільним кодом та інтерфейсом.

## Практика

### Вправа 1: Фігури з контрактом

Створіть абстрактний клас `Shape` з абстрактними методами `area()` і `perimeter()` та конкретним методом `describe()`, що повертає `"<ClassName>: area=<area>, perimeter=<perimeter>"`. Реалізуйте `Rectangle(width, height)` і `Circle(radius)`; значення для кола округліть до 2 знаків після коми. Виведіть `describe()` для `Rectangle(3, 4)` і `Circle(1)`, а потім покажіть, що `Shape()` створити не можна (перехопіть `TypeError` і виведіть його).

### Вправа 2: Сповіщення

Створіть абстрактний клас `Notifier` з:

- абстрактним методом `send(message)`;
- конкретним методом `notify_all(messages)`, що викликає `self.send()` для кожного повідомлення й повертає кількість надісланих.

Реалізуйте `EmailNotifier(address)`, чий `send()` виводить `"Email to <address>: <message>"`, і `SmsNotifier(phone)`, чий `send()` виводить `"SMS to <phone>: <message>"`. Викличте `notify_all()` для обох із двома повідомленнями й виведіть повернені кількості.

### Вправа 3: Абстрактна властивість

Створіть абстрактний клас `Account` з абстрактною властивістю `fee_percent` і конкретним методом `fee(amount)`, що повертає `amount * fee_percent / 100`. Реалізуйте `BasicAccount` (комісія 2%) і `PremiumAccount` (комісія 0.5%). Виведіть комісію з `1000` для обох рахунків. Потім оголосіть `class BrokenAccount(Account): pass` і покажіть, яку помилку ви отримаєте під час його створення.

## Розв'язки

### Вправа 1

```python
import math
from abc import ABC, abstractmethod


class Shape(ABC):
    @abstractmethod
    def area(self):
        ...

    @abstractmethod
    def perimeter(self):
        ...

    def describe(self):
        return f"{type(self).__name__}: area={self.area()}, perimeter={self.perimeter()}"


class Rectangle(Shape):
    def __init__(self, width, height):
        self.width = width
        self.height = height

    def area(self):
        return self.width * self.height

    def perimeter(self):
        return 2 * (self.width + self.height)


class Circle(Shape):
    def __init__(self, radius):
        self.radius = radius

    def area(self):
        return round(math.pi * self.radius**2, 2)

    def perimeter(self):
        return round(2 * math.pi * self.radius, 2)


print(Rectangle(3, 4).describe())
print(Circle(1).describe())

try:
    Shape()
except TypeError as error:
    print(error)
```

Результат:

```text
Rectangle: area=12, perimeter=14
Circle: area=3.14, perimeter=6.28
Can't instantiate abstract class Shape without an implementation for abstract methods 'area', 'perimeter'
```

### Вправа 2

```python
from abc import ABC, abstractmethod


class Notifier(ABC):
    @abstractmethod
    def send(self, message):
        ...

    def notify_all(self, messages):
        for message in messages:
            self.send(message)
        return len(messages)


class EmailNotifier(Notifier):
    def __init__(self, address):
        self.address = address

    def send(self, message):
        print(f"Email to {self.address}: {message}")


class SmsNotifier(Notifier):
    def __init__(self, phone):
        self.phone = phone

    def send(self, message):
        print(f"SMS to {self.phone}: {message}")


messages = ["Build passed", "Deploy started"]
for notifier in [EmailNotifier("dev@example.com"), SmsNotifier("+380501234567")]:
    sent = notifier.notify_all(messages)
    print("sent:", sent)
```

Результат:

```text
Email to dev@example.com: Build passed
Email to dev@example.com: Deploy started
sent: 2
SMS to +380501234567: Build passed
SMS to +380501234567: Deploy started
sent: 2
```

`notify_all()` написано один раз в абстрактному класі, і він працює для кожного способу сповіщення, бо кожен підклас гарантовано має `send()`.

### Вправа 3

```python
from abc import ABC, abstractmethod


class Account(ABC):
    @property
    @abstractmethod
    def fee_percent(self):
        ...

    def fee(self, amount):
        return amount * self.fee_percent / 100


class BasicAccount(Account):
    @property
    def fee_percent(self):
        return 2


class PremiumAccount(Account):
    @property
    def fee_percent(self):
        return 0.5


class BrokenAccount(Account):
    pass


print(BasicAccount().fee(1000))
print(PremiumAccount().fee(1000))

try:
    BrokenAccount()
except TypeError as error:
    print(error)
```

Результат:

```text
20.0
5.0
Can't instantiate abstract class BrokenAccount without an implementation for abstract method 'fee_percent'
```

---

*Джерело: [pythontutorial.net — Python Abstract Classes](https://www.pythontutorial.net/python-oop/python-abstract-class/). Адаптовано й доповнено для PyJourney.*
