# super()

Коли дочірній клас перевизначає метод, йому часто все одно потрібна батьківська версія: `__init__` батька створює атрибути, `get_pay()` батька вже виконує половину обчислень. Вбудована функція `super()` дає змогу методу **делегувати** роботу батьківському класу замість копіювати його код.

## Що ви дізнаєтесь

- Як викликати `__init__()` батька через `super().__init__()`
- Як розширити будь-який метод батька через `super().method()`
- Що насправді повертає `super()` і чому не треба передавати `self`
- Як виклики `super()` проходять крізь кілька рівнів успадкування
- Чим відрізняються `super()`, `super(Class, self)` і `Parent.method(self)`
- Типові помилки: забутий виклик, подвійний `self`, відсутній `return`, нескінченна рекурсія

## Проблема: дубльований код батька

Ось клас `Employee`, у якого зарплата — це базова ставка плюс премія:

```python
class Employee:
    def __init__(self, name, base_pay, bonus):
        self.name = name
        self.base_pay = base_pay
        self.bonus = bonus

    def get_pay(self):
        return self.base_pay + self.bonus
```

Працівник відділу продажів додатково отримує бонус за продажі. Перша спроба перевизначає обидва методи й копіює код батька:

```python
class SalesEmployee(Employee):
    def __init__(self, name, base_pay, bonus, sales_incentive):
        self.name = name
        self.base_pay = base_pay
        self.bonus = bonus
        self.sales_incentive = sales_incentive

    def get_pay(self):
        return self.base_pay + self.bonus + self.sales_incentive
```

Це працює, але три рядки `__init__` і вся формула зарплати дублюються. Якщо згодом в `Employee` з'явиться новий атрибут (скажімо, `hire_date`) або нове правило нарахування, `SalesEmployee` непомітно застаріє.

## `super().__init__()`

Замість повторювати ініціалізацію батька, викличте її:

```python
class Employee:
    def __init__(self, name, base_pay, bonus):
        self.name = name
        self.base_pay = base_pay
        self.bonus = bonus

    def get_pay(self):
        return self.base_pay + self.bonus


class SalesEmployee(Employee):
    def __init__(self, name, base_pay, bonus, sales_incentive):
        super().__init__(name, base_pay, bonus)
        self.sales_incentive = sales_incentive


john = SalesEmployee("John", 5000, 1000, 2000)
print(vars(john))
```

Результат:

```text
{'name': 'John', 'base_pay': 5000, 'bonus': 1000, 'sales_incentive': 2000}
```

Коли ви створюєте `SalesEmployee`, Python виконує `SalesEmployee.__init__`. Його перший рядок запускає `Employee.__init__` **для того самого об'єкта**, і той встановлює `name`, `base_pay` та `bonus`. Потім дочірній клас додає власний `sales_incentive`. Кожен клас відповідає лише за свої атрибути.

## Делегування іншим методам батька

`super()` не обмежується `__init__`. Будь-який перевизначений метод може викликати батьківську версію й доповнити її результат:

```python
class Employee:
    def __init__(self, name, base_pay, bonus):
        self.name = name
        self.base_pay = base_pay
        self.bonus = bonus

    def get_pay(self):
        return self.base_pay + self.bonus


class SalesEmployee(Employee):
    def __init__(self, name, base_pay, bonus, sales_incentive):
        super().__init__(name, base_pay, bonus)
        self.sales_incentive = sales_incentive

    def get_pay(self):
        return super().get_pay() + self.sales_incentive


if __name__ == "__main__":
    sales_employee = SalesEmployee("John", 5000, 1000, 2000)
    print(sales_employee.get_pay())
```

Результат:

```text
8000
```

`super().get_pay()` виконує `Employee.get_pay()`, що повертає `5000 + 1000 = 6000`, а дочірній клас додає `2000`. Тепер базова формула живе рівно в одному місці. Якщо компанія змінить правила нарахування премій, зміниться лише `Employee.get_pay()`, а працівники відділу продажів отримають це автоматично.

У цьому й полягає різниця між **заміною** методу (звичайне перевизначення) та його **розширенням** (перевизначення, що викликає `super()`).

Той самий прийом працює і для спеціальних методів, наприклад щоб розширити текстове представлення батька:

```python
class Employee:
    def __init__(self, name, base_pay):
        self.name = name
        self.base_pay = base_pay

    def __str__(self):
        return f"{self.name}, base pay {self.base_pay}"


class SalesEmployee(Employee):
    def __init__(self, name, base_pay, sales_incentive):
        super().__init__(name, base_pay)
        self.sales_incentive = sales_incentive

    def __str__(self):
        return f"{super().__str__()}, incentive {self.sales_incentive}"


print(SalesEmployee("John", 5000, 2000))
```

Результат:

```text
John, base pay 5000, incentive 2000
```

## Що насправді повертає `super()`

Часто кажуть, що «`super()` повертає батьківський клас». Це спрощення. `super()` повертає спеціальний **об'єкт-посередник** (proxy). Коли ви шукаєте на ньому атрибут, посередник пропускає поточний клас і шукає в класах, що йдуть **після** нього в порядку розв'язання методів (`__mro__`). Знайдене прив'язується до *поточного* `self`:

```python
class Employee:
    def get_pay(self):
        return 6000


class SalesEmployee(Employee):
    def get_pay(self):
        print(super())
        print(type(super()))
        print(super().get_pay)
        return super().get_pay() + 2000


print(SalesEmployee().get_pay())
```

Результат (адреса в пам'яті щоразу різна):

```text
<super: <class 'SalesEmployee'>, <SalesEmployee object>>
<class 'super'>
<bound method Employee.get_pay of <__main__.SalesEmployee object at 0x104809160>>
8000
```

З цього випливають три речі:

- `self` **не потрібно передавати** в метод батька. `super().get_pay` — це вже прив'язаний (bound) метод поточного об'єкта, так само як `self.get_pay`.
- Усередині методу батька `self` — це все ще дочірній об'єкт. Якщо метод батька викликає `self.something()`, перевизначення нащадка й далі працюють.
- Без аргументів `super()` сам визначає «поточний клас» і «поточний об'єкт». Python надає їх через приховану змінну `__class__` і перший параметр методу. Саме тому коротка форма працює лише всередині методу, оголошеного в тілі класу.

```text
SalesEmployee.__mro__ = (SalesEmployee, Employee, object)
                              ^             ^
     super() усередині        |             |
     SalesEmployee починає    +-- пропускає --> шукає звідси
```

За одиночного успадкування «наступний клас у MRO» — це просто батько, тож на практиці `super()` означає «батьківська версія цього методу». За множинного успадкування наступним може виявитися «сусідній» клас, і тому `super()` також лежить в основі кооперативного множинного успадкування (про нього йдеться в одному з наступних розділів).

## Ланцюжки викликів `super()`

У ланцюжку класів кожен `__init__` викликає той, що безпосередньо над ним. Виклики вкладаються один в одного, тому найвищий предок завершується першим:

```python
class Person:
    def __init__(self, name):
        print("Person.__init__")
        self.name = name


class Employee(Person):
    def __init__(self, name, job_title):
        print("Employee.__init__ starts")
        super().__init__(name)
        self.job_title = job_title
        print("Employee.__init__ ends")


class Manager(Employee):
    def __init__(self, name, job_title, team_size):
        print("Manager.__init__ starts")
        super().__init__(name, job_title)
        self.team_size = team_size
        print("Manager.__init__ ends")


boss = Manager("Iryna", "Head of QA", 7)
print(vars(boss))
```

Результат:

```text
Manager.__init__ starts
Employee.__init__ starts
Person.__init__
Employee.__init__ ends
Manager.__init__ ends
{'name': 'Iryna', 'job_title': 'Head of QA', 'team_size': 7}
```

`Manager` не мусить знати, що існує `Person`. Він спілкується лише зі своїм безпосереднім батьком, а кожен клас передає далі ті аргументи, яких потребує його власний батько.

### Де розмістити виклик `super()`

Синтаксичного правила немає, але порядок має значення. Зазвичай `super().__init__()` викликають **першим**: батько налаштовує об'єкт, а потім нащадок доповнює чи коригує його. Якщо присвоїти атрибут до виклику батька, батько може його перезаписати:

```python
class Employee:
    def __init__(self, name):
        self.name = name
        self.currency = "USD"


class LocalEmployee(Employee):
    def __init__(self, name):
        self.currency = "UAH"
        super().__init__(name)  # перезаписує currency


print(LocalEmployee("Olena").currency)
```

Результат:

```text
USD
```

Якщо перенести `self.currency = "UAH"` нижче рядка `super().__init__(name)`, усе запрацює. В інших методах ставте виклик `super()` туди, де його потребує логіка: перед своїм кодом, щоб обробити результат батька, або після свого коду, щоб попередньо підготувати аргументи.

## `super()` проти `super(Class, self)` проти `Parent.method(self)`

Дістатися методу батька можна трьома способами:

```python
class Employee:
    def get_pay(self):
        return 6000


class SalesEmployee(Employee):
    def get_pay(self):
        a = super().get_pay()                      # сучасна форма
        b = super(SalesEmployee, self).get_pay()   # явна форма
        c = Employee.get_pay(self)                 # прямий виклик через клас
        return a, b, c


print(SalesEmployee().get_pay())
```

Результат:

```text
(6000, 6000, 6000)
```

- `super()` (Python 3+) — саме цю форму слід використовувати. Вона коротка й не повторює ім'я класу, тож перейменування класу чи його батька нічого не зламає.
- `super(SalesEmployee, self)` — старий запис із Python 2. Його досі можна зустріти в успадкованому коді; з явними аргументами його можна використати й поза тілом методу, але таке потрібно рідко.
- `Employee.get_pay(self)` викликає звичайну функцію класу, тому `self` треба передавати самостійно. Цей спосіб жорстко прописує ім'я батька й обходить MRO, що ламає кооперативне множинне успадкування. Уникайте його, якщо тільки ви свідомо не хочете реалізацію саме певного класу.

## Типові помилки

- **Забути викликати `super().__init__()`.** `__init__` нащадка замінює `__init__` батька, тому атрибути батька так і не створюються, а успадковані методи падають з `AttributeError`.
- **Передавати `self` явно.** `super()` уже прив'язує `self`, тож повторна передача зсуває всі аргументи на одну позицію:

  ```python
  class Employee:
      def __init__(self, name, base_pay, bonus):
          self.name = name
          self.base_pay = base_pay
          self.bonus = bonus


  class SalesEmployee(Employee):
      def __init__(self, name, base_pay, bonus, sales_incentive):
          super().__init__(self, name, base_pay, bonus)  # помилка: зайвий self
          self.sales_incentive = sales_incentive


  SalesEmployee("John", 5000, 1000, 2000)
  ```

  Результат:

  ```text
  Traceback (most recent call last):
    ...
  TypeError: Employee.__init__() takes 4 positional arguments but 5 were given
  ```

- **Забути дужки.** `super.__init__(...)` (без `()` після `super`) викликає метод самого типу `super` і падає з малозрозумілим `TypeError`. Завжди пишіть `super().`.
- **Забути `return`.** `def get_pay(self): super().get_pay() + self.sales_incentive` обчислює суму й викидає її, тож метод повертає `None`.
- **Викликати `self.method()` замість `super().method()` у перевизначенні.** `self.get_pay()` усередині `get_pay()` знову викликає те саме перевизначення, що закінчується `RecursionError: maximum recursion depth exceeded`.
- **Використовувати `super()` без аргументів поза методом.** У звичайній функції, у `@staticmethod` чи у вкладеній функції всередині методу немає «поточного класу й об'єкта», і виклик падає з `RuntimeError: super(): no arguments`.

## Підсумок

- `super()` дає змогу перевизначеному методу делегувати роботу реалізації батька замість дублювати її.
- `super().__init__(...)` ініціалізує батьківську частину об'єкта; нащадок потім встановлює лише власні атрибути.
- `super().method()` розширює метод батька: викличте його, а потім доповніть результат.
- `super()` повертає посередника, який шукає в класах після поточного в MRO і прив'язує результат до поточного `self`, тому ніколи не передавайте `self` самостійно.
- У багаторівневому ланцюжку кожен клас викликає лише свого безпосереднього батька; виклики вкладаються аж до вершини ієрархії.
- Викликайте `super().__init__()` на початку, щоб батько не перезаписав те, що встановлює нащадок.
- Віддавайте перевагу `super()` без аргументів, а не `super(Class, self)` чи `Parent.method(self)`.

## Практика

### Вправа 1: Рефакторинг із `super()`

Перепишіть `Car.__init__` так, щоб він не повторював код `Vehicle.__init__`. Створіть `Car("Skoda", "Octavia", 5)` і виведіть для нього `vars()`.

```python
class Vehicle:
    def __init__(self, brand, model):
        self.brand = brand
        self.model = model
        self.mileage = 0


class Car(Vehicle):
    def __init__(self, brand, model, seats):
        self.brand = brand
        self.model = model
        self.mileage = 0
        self.seats = seats
```

### Вправа 2: Багатошарове форматування

Створіть три класи:

- `Message(text)` з методом `render()`, що повертає текст;
- `SignedMessage(text, author)`, підклас `Message`, чий `render()` повертає результат батька, після якого йде `" -- <author>"`;
- `UrgentMessage(text, author)`, підклас `SignedMessage`, чий `render()` повертає `"URGENT: "`, після якого йде результат батька.

Кожне перевизначення `render()` має використовувати `super()`, а `UrgentMessage` не повинен визначати `__init__`. Виведіть `render()` для `UrgentMessage("Server is down", "Ops")`.

### Вправа 3: Знайдіть помилки

У цьому коді три помилки, пов'язані з `super()`. Знайдіть і виправте їх, щоб програма вивела `7500`.

```python
class Account:
    def __init__(self, owner, balance):
        self.owner = owner
        self.balance = balance

    def total(self):
        return self.balance


class SavingsAccount(Account):
    def __init__(self, owner, balance, interest):
        super().__init__(self, owner, balance)
        self.interest = interest

    def total(self):
        super().total() + self.interest


class PremiumAccount(SavingsAccount):
    def total(self):
        return self.total() + 500


print(PremiumAccount("Max", 6000, 1000).total())
```

## Розв'язки

### Вправа 1

```python
class Vehicle:
    def __init__(self, brand, model):
        self.brand = brand
        self.model = model
        self.mileage = 0


class Car(Vehicle):
    def __init__(self, brand, model, seats):
        super().__init__(brand, model)
        self.seats = seats


print(vars(Car("Skoda", "Octavia", 5)))
```

Результат:

```text
{'brand': 'Skoda', 'model': 'Octavia', 'mileage': 0, 'seats': 5}
```

### Вправа 2

```python
class Message:
    def __init__(self, text):
        self.text = text

    def render(self):
        return self.text


class SignedMessage(Message):
    def __init__(self, text, author):
        super().__init__(text)
        self.author = author

    def render(self):
        return f"{super().render()} -- {self.author}"


class UrgentMessage(SignedMessage):
    def render(self):
        return f"URGENT: {super().render()}"


print(UrgentMessage("Server is down", "Ops").render())
```

Результат:

```text
URGENT: Server is down -- Ops
```

`UrgentMessage` успадковує `__init__` від `SignedMessage`, а той, своєю чергою, викликає `Message.__init__`. Кожен `render()` обгортає результат того, що вище.

### Вправа 3

Помилки:

1. `super().__init__(self, owner, balance)` передає `self` двічі. Приберіть явний `self`.
2. `SavingsAccount.total()` не має `return`, тому повертає `None`.
3. `PremiumAccount.total()` викликає `self.total()`, тобто сам себе, і рекурсія ніколи не закінчується. Тут потрібен `super().total()`.

```python
class Account:
    def __init__(self, owner, balance):
        self.owner = owner
        self.balance = balance

    def total(self):
        return self.balance


class SavingsAccount(Account):
    def __init__(self, owner, balance, interest):
        super().__init__(owner, balance)
        self.interest = interest

    def total(self):
        return super().total() + self.interest


class PremiumAccount(SavingsAccount):
    def total(self):
        return super().total() + 500


print(PremiumAccount("Max", 6000, 1000).total())
```

Результат:

```text
7500
```

---

*Джерело: [pythontutorial.net — Python super()](https://www.pythontutorial.net/python-oop/python-super/). Адаптовано й доповнено для PyJourney.*
