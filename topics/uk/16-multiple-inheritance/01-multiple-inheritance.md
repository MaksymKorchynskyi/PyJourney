# Множинне успадкування

Клас у Python може успадковувати **більше ніж від одного** батьківського класу. Це називають множинним успадкуванням. Воно дає змогу поєднувати незалежні частини поведінки, але ставить запитання, з яким одиничне успадкування ніколи не стикається: якщо два батьківські класи визначають той самий метод, котрий із них переможе? Python відповідає на нього за допомогою **порядку розв'язання методів** (method resolution order, MRO), і розуміння MRO — ключ до правильного використання множинного успадкування та `super()`.

## Що ви дізнаєтесь

- Як оголосити клас із кількома батьками і що він успадковує
- Що таке порядок розв'язання методів і як його переглянути через `__mro__`
- Як Python будує MRO (C3-лінеаризація) і чому це розв'язує «проблему ромба»
- Чому `super()` означає «наступний клас у MRO», а не «мій батьківський клас»
- Як писати методи `__init__`, що злагоджено працюють із кількома батьками
- Як використовувати міксини — найпрактичнішу форму множинного успадкування

## Оголошення кількох батьківських класів

Перелічіть батьківські класи через кому в дужках після назви класу:

```python
class ChildClass(ParentClass1, ParentClass2, ParentClass3):
    pass
```

Ось простий приклад. `Car` уміє їхати, `Flyable` уміє літати, а `FlyingCar` уміє і те, і те:

```python
class Car:
    def go(self):
        print("Going")


class Flyable:
    def fly(self):
        print("Flying")


class FlyingCar(Flyable, Car):
    pass


fc = FlyingCar()
fc.go()
fc.fly()
print(isinstance(fc, Car), isinstance(fc, Flyable))
print(FlyingCar.__bases__)
```

Результат:

```text
Going
Flying
True True
(<class '__main__.Flyable'>, <class '__main__.Car'>)
```

`FlyingCar` успадковує всі методи обох батьків, а його екземпляри є екземплярами обох класів. `__bases__` містить безпосередніх батьків у тому порядку, у якому ви їх перелічили, і цей порядок має значення, як покаже наступний розділ.

## Порядок розв'язання методів (MRO)

Коли ви викликаєте метод об'єкта, Python переглядає список класів і використовує перший, у якому цей метод визначено. Цей список і є **порядком розв'язання методів**. Кожен клас зберігає його в атрибуті `__mro__` (метод `mro()` повертає те саме у вигляді списку).

Нехай обидва батьки визначають `start()`:

```python
class Car:
    def start(self):
        print("Start the Car")

    def go(self):
        print("Going")


class Flyable:
    def start(self):
        print("Start the Flyable object")

    def fly(self):
        print("Flying")


class FlyingCar(Flyable, Car):
    def start(self):
        super().start()


car = FlyingCar()
car.start()
print(FlyingCar.__mro__)
print([cls.__name__ for cls in FlyingCar.mro()])
```

Результат:

```text
Start the Flyable object
(<class '__main__.FlyingCar'>, <class '__main__.Flyable'>, <class '__main__.Car'>, <class 'object'>)
['FlyingCar', 'Flyable', 'Car', 'object']
```

MRO має вигляд `FlyingCar → Flyable → Car → object`. `Car` і `Flyable` неявно успадковують `object`, тому `object` завжди останній. `super().start()` усередині `FlyingCar` шукає `start` у класах, що стоять **після** `FlyingCar` у цьому списку, першим знаходить його у `Flyable` і викликає `Flyable.start()`. До `Car.start()` справа так і не доходить.

Поміняйте батьків місцями — і MRO зміниться разом із ними:

```python
class Car:
    def start(self):
        print("Start the Car")


class Flyable:
    def start(self):
        print("Start the Flyable object")


class FlyingCar(Car, Flyable):
    def start(self):
        super().start()


car = FlyingCar()
car.start()
print([cls.__name__ for cls in FlyingCar.__mro__])
```

Результат:

```text
Start the Car
['FlyingCar', 'Car', 'Flyable', 'object']
```

> **Порада:** читайте список базових класів зліва направо як список пріоритетів: коли батьки «не згодні», перемагає крайній лівий.

## Проблема ромба та C3-лінеаризація

Найцікавіше починається, коли двоє батьків мають спільного предка. Таку форму називають **ромбом** (diamond):

```text
        A
       / \
      B   C
       \ /
        D
```

```python
class A:
    def hello(self):
        print("A.hello")


class B(A):
    def hello(self):
        print("B.hello")
        super().hello()


class C(A):
    def hello(self):
        print("C.hello")
        super().hello()


class D(B, C):
    def hello(self):
        print("D.hello")
        super().hello()


D().hello()
print([cls.__name__ for cls in D.__mro__])
```

Результат:

```text
D.hello
B.hello
C.hello
A.hello
['D', 'B', 'C', 'A', 'object']
```

Тут впадають в око дві речі:

1. `A.hello()` виконується **один раз**, хоча до `A` можна дістатися і через `B`, і через `C`.
2. `super().hello()` усередині `B` викликав `C.hello()`, а не `A.hello()`. При цьому `B` навіть не знає про існування `C`!

Python будує MRO за алгоритмом **C3-лінеаризації** (використовується з Python 2.3). Він гарантує, що:

- клас завжди стоїть **перед своїми батьками**;
- батьки класу зберігають **порядок зліва направо**, у якому їх перелічено;
- кожен клас трапляється **рівно один раз**;
- результат **узгоджується з MRO кожного з батьків**.

Для `D(B, C)` C3 зливає (merge) MRO батьків і список батьків, щоразу беручи першу «голову» списку, яка не трапляється в «хвості» жодного іншого списку:

```text
L[B] = B, A, object
L[C] = C, A, object
L[D] = D + merge([B, A, object], [C, A, object], [B, C])
     = D, B        (B — голова і не трапляється в жодному хвості)
     = D, B, C     (A є у хвості [C, A, object], пропускаємо; беремо C)
     = D, B, C, A, object
```

Наївний пошук у глибину дав би `D, B, A, C`, тобто відвідав би `A` раніше за `C`. Тоді `C.hello()`, що мав би перевизначати `A.hello()`, було б пропущено. C3 цього уникає.

### Коли узгодженого порядку не існує

Якщо всі правила задовольнити неможливо, Python відмовляється створювати клас:

```python
class A:
    pass


class B(A):
    pass


try:
    class X(A, B):
        pass
except TypeError as error:
    print(error)
```

Результат:

```text
Cannot create a consistent method resolution order (MRO) for bases A, B
```

`X(A, B)` вимагає поставити `A` перед `B`, але `B` — підклас `A`, тому `B` мусить стояти перед `A`. Виправлення — перелічити спершу специфічніший клас, `X(B, A)`, або просто `X(B)`.

## `super()` означає «наступний у MRO»

Приклад із ромбом показує найважливіший факт про `super()`:

> `super()` **не** викликає батьківський клас. Він викликає **наступний клас у MRO фактичного типу об'єкта**.

Усередині `B.hello()` результат `super()` залежить від того, чим є `self`. Для об'єкта `B` MRO має вигляд `B, A, object`, тож `super()` веде до `A`. Для об'єкта `D` MRO — `D, B, C, A, object`, і той самий рядок веде до `C`. Саме це дає змогу кільком класам **співпрацювати**: якщо кожен виконує свою роботу, а потім викликає `super()`, кожен клас у MRO спрацює рівно один раз.

Зворотний бік: один клас, що забув викликати `super()`, обриває ланцюжок для всіх, хто стоїть після нього.

```python
class A:
    def hello(self):
        print("A.hello")


class B(A):
    def hello(self):
        print("B.hello")  # тут немає super().hello()


class C(A):
    def hello(self):
        print("C.hello")
        super().hello()


class D(B, C):
    def hello(self):
        print("D.hello")
        super().hello()


D().hello()
```

Результат:

```text
D.hello
B.hello
```

`C.hello()` і `A.hello()` мовчки не виконуються.

## Множинне успадкування та `__init__`

Найболючіше множинне успадкування проявляється в конструкторах, бо батьківським класам часто потрібні **різні аргументи**:

```python
class Car:
    def __init__(self, door, wheel):
        print("Car.__init__")
        self.door = door
        self.wheel = wheel


class Flyable:
    def __init__(self, wing):
        print("Flyable.__init__")
        self.wing = wing


class FlyingCar(Flyable, Car):
    def __init__(self, door, wheel, wing):
        super().__init__(wing=wing)  # викликає лише Flyable.__init__
        self.door = door             # вручну дублює логіку Car
        self.wheel = wheel


fc = FlyingCar(2, 4, 2)
print(vars(fc))
```

Результат:

```text
Flyable.__init__
{'wing': 2, 'door': 2, 'wheel': 4}
```

Об'єкт отримує правильні атрибути, але `Car.__init__` так і не виконався. `FlyingCar` скопіював логіку `Car`, тож будь-яка перевірка чи додаткове налаштування, що з'являться в `Car.__init__` згодом, мовчки не потраплять у `FlyingCar`. Є два правильні рішення.

### Варіант 1: явно викликати кожного з батьків

```python
class Car:
    def __init__(self, door, wheel):
        print("Car.__init__")
        self.door = door
        self.wheel = wheel


class Flyable:
    def __init__(self, wing):
        print("Flyable.__init__")
        self.wing = wing


class FlyingCar(Flyable, Car):
    def __init__(self, door, wheel, wing):
        Flyable.__init__(self, wing)
        Car.__init__(self, door, wheel)


fc = FlyingCar(2, 4, 2)
print(vars(fc))
```

Результат:

```text
Flyable.__init__
Car.__init__
{'wing': 2, 'door': 2, 'wheel': 4}
```

Це просто й зрозуміло, коли батьки між собою не пов'язані. Але в ромбі цей підхід ламається: якщо обидва батьки мають спільну базу, її `__init__` виконується двічі:

```python
class Vehicle:
    def __init__(self):
        print("Vehicle.__init__")
        self.registered = True


class Car(Vehicle):
    def __init__(self, door, wheel):
        Vehicle.__init__(self)
        print("Car.__init__")
        self.door = door
        self.wheel = wheel


class Flyable(Vehicle):
    def __init__(self, wing):
        Vehicle.__init__(self)
        print("Flyable.__init__")
        self.wing = wing


class FlyingCar(Flyable, Car):
    def __init__(self, door, wheel, wing):
        Flyable.__init__(self, wing)
        Car.__init__(self, door, wheel)


fc = FlyingCar(2, 4, 2)
print(vars(fc))
```

Результат:

```text
Vehicle.__init__
Flyable.__init__
Vehicle.__init__
Car.__init__
{'registered': True, 'wing': 2, 'door': 2, 'wheel': 4}
```

Тут це нешкідливо, але якби `Vehicle.__init__` реєстрував транспортний засіб у базі даних чи відкривав з'єднання, тепер він робив би це двічі.

### Варіант 2: кооперативний `__init__` з іменованими аргументами

Надійний патерн — зробити кожен `__init__` в ієрархії **кооперативним**:

1. Приймайте власні параметри **за назвою**, а все інше — як `**kwargs`.
2. Передавайте решту `**kwargs` далі через `super().__init__(**kwargs)`.
3. Дайте `object.__init__()` наприкінці ланцюжка не отримати нічого (він не приймає зайвих аргументів).

```python
class Vehicle:
    def __init__(self, **kwargs):
        print("Vehicle.__init__")
        super().__init__(**kwargs)
        self.registered = True


class Car(Vehicle):
    def __init__(self, *, door, wheel, **kwargs):
        print("Car.__init__")
        super().__init__(**kwargs)
        self.door = door
        self.wheel = wheel


class Flyable(Vehicle):
    def __init__(self, *, wing, **kwargs):
        print("Flyable.__init__")
        super().__init__(**kwargs)
        self.wing = wing


class FlyingCar(Flyable, Car):
    def __init__(self, *, door, wheel, wing):
        super().__init__(door=door, wheel=wheel, wing=wing)


fc = FlyingCar(door=2, wheel=4, wing=2)
print(vars(fc))
print([cls.__name__ for cls in FlyingCar.__mro__])
print(vars(Car(door=4, wheel=4)))
```

Результат:

```text
Flyable.__init__
Car.__init__
Vehicle.__init__
{'registered': True, 'door': 2, 'wheel': 4, 'wing': 2}
['FlyingCar', 'Flyable', 'Car', 'Vehicle', 'object']
Car.__init__
Vehicle.__init__
{'registered': True, 'door': 4, 'wheel': 4}
```

Кожен `__init__` виконується рівно один раз, у порядку MRO. `Flyable` забирає `wing` і передає `door` та `wheel` далі; `super()` усередині `Flyable` веде до `Car` (наступного класу в MRO `FlyingCar`), який забирає `door` і `wheel`; `Vehicle` не отримує нічого зайвого. Той самий клас `Car` і далі працює самостійно, як показує останній рядок.

> **Зверніть увагу:** `FlyingCar.__init__` тут лише передає аргументи далі, тож його можна взагалі прибрати. Його залишено, щоб показати виклик явно.

## Міксини

Найпоширеніше й найменш ризиковане застосування множинного успадкування — **міксин** (mixin): невеликий клас, що додає одну чітко визначену можливість і не призначений для самостійного використання. Міксин зазвичай не має ні `__init__`, ні власного стану.

```python
import json


class ToDictMixin:
    """Додає to_dict(): публічні атрибути екземпляра у вигляді словника."""

    def to_dict(self):
        return {k: v for k, v in vars(self).items() if not k.startswith("_")}


class JsonMixin:
    """Додає to_json(). Очікує, що клас також надає to_dict()."""

    def to_json(self):
        return json.dumps(self.to_dict())


class Person:
    def __init__(self, name, age):
        self.name = name
        self.age = age
        self._password_hash = "x9f3..."


class Employee(JsonMixin, ToDictMixin, Person):
    def __init__(self, name, age, salary):
        super().__init__(name, age)
        self.salary = salary


emp = Employee("Olena", 30, 5000)
print(emp.to_dict())
print(emp.to_json())
print([cls.__name__ for cls in Employee.__mro__])
```

Результат:

```text
{'name': 'Olena', 'age': 30, 'salary': 5000}
{"name": "Olena", "age": 30, "salary": 5000}
['Employee', 'JsonMixin', 'ToDictMixin', 'Person', 'object']
```

Домовленості, що допомагають тримати міксини під контролем:

- Давайте їм суфікс `Mixin`, щоб читач знав, що це не самостійні класи.
- Перелічуйте міксини **першими**, а основний базовий клас — **останнім**: так методи міксинів матимуть пріоритет, а «справжній» батько опиниться наприкінці MRO.
- Тримайте кожен міксин зосередженим на одній можливості й документуйте, чого він очікує від класу-господаря (як `JsonMixin` очікує `to_dict()`).

Стандартна бібліотека теж використовує цей патерн, наприклад `socketserver.ThreadingMixIn`, який перетворює будь-який сокет-сервер на такий, що обробляє кожен запит в окремому потоці.

## Коли варто уникати множинного успадкування

- **Глибокі чи широкі ієрархії** швидко стають важкими для розуміння: щоб знати, який метод виконається, доводиться обчислювати MRO в голові.
- **Батьки зі станом** (власним `__init__` та атрибутами) можуть конфліктувати: двоє батьків, які використовують `self.name` для різних речей, перезаписуватимуть одне одного.
- **Відношення «має»** (has-a) краще моделювати композицією. `FlyingCar`, який *має* об'єкти `Engine` і `Wings`, часто зрозуміліший за той, що *є* водночас `Car` і `Plane`.

Добре практичне правило: використовуйте множинне успадкування для **міксинів** і для реалізації кількох невеликих **інтерфейсів** (абстрактних базових класів), а для всього іншого віддавайте перевагу композиції.

## Типові помилки

- **Вважати, що `super()` викликає «батьківський клас».** Він викликає наступний клас у MRO фактичного об'єкта, і це може бути сусідній клас, про який ви навіть не згадували.
- **Обривати ланцюжок `super()`.** У кооперативній ієрархії один метод, що не викликає `super()`, не дає виконатися всім наступним класам.
- **Копіювати логіку батьківського `__init__`** замість того, щоб викликати його (як у першому `FlyingCar.__init__` вище). Тоді зміни в батьківському класі мовчки губляться.
- **Змішувати в одному ромбі явні виклики `Parent.__init__(self)` і `super()`.** Одні ініціалізатори виконаються двічі, інші — жодного разу.
- **Передавати позиційні аргументи крізь кооперативний ланцюжок.** Позиції зсуваються від класу до класу; використовуйте іменовані аргументи.
- **Ставити клас перед його власним підкласом** (`class X(A, B)`, де `B` успадковує `A`). Python генерує `TypeError`, бо узгодженого MRO не існує.

## Підсумок

- `class C(A, B)` успадковує і `A`, і `B`; екземпляри є екземплярами обох класів.
- MRO (`C.__mro__`, `C.mro()`) — упорядкований список класів, у яких Python шукає атрибути та методи.
- MRO обчислюється C3-лінеаризацією: нащадки перед батьками, порядок базових класів зліва направо, кожен клас один раз, узгодженість з MRO батьків.
- У ромбі спільна база трапляється один раз, наприкінці; неможливий порядок призводить до `TypeError`.
- `super()` делегує виклик наступному класу в MRO фактичного типу об'єкта, що уможливлює кооперативні методи.
- Кооперативні методи `__init__` приймають власні аргументи за назвою і передають `**kwargs` у `super().__init__()`.
- Міксини — невеликі класи без стану, що додають одну можливість; перелічуйте їх перед основним базовим класом.

## Практика

### Вправа 1: Передбачте ланцюжок

Не запускаючи програму, передбачте три рядки, які вона виведе. Поясніть, чому `super()` у класі `Left` дає різні результати в перших двох рядках.

```python
class Base:
    def who(self):
        return ["Base"]


class Left(Base):
    def who(self):
        return ["Left"] + super().who()


class Right(Base):
    def who(self):
        return ["Right"] + super().who()


class Bottom(Left, Right):
    def who(self):
        return ["Bottom"] + super().who()


print(Bottom().who())
print(Left().who())
print([cls.__name__ for cls in Bottom.__mro__])
```

### Вправа 2: Кооперативний конструктор

Створіть `Person` (приймає `name`), `Employee(Person)` (додає `salary`) і `Student(Person)` (додає `school`). Потім створіть `WorkingStudent(Employee, Student)` **без** власного `__init__` так, щоб `WorkingStudent(name="Taras", salary=800, school="KPI")` встановлював усі три атрибути, а кожен `__init__` виконувався рівно один раз. `Student(name="Olena", school="KNU")` має й далі працювати самостійно. Що станеться, якщо забути `school`?

### Вправа 3: Два міксини

Напишіть `ReprMixin`, чий `__repr__` повертає `ClassName(attr=value, ...)`, побудований з атрибутів екземпляра, і `EqualityMixin`, чий `__eq__` вважає два об'єкти рівними, якщо вони мають однаковий тип і однакові атрибути. Застосуйте обидва до класів `Point(x, y)` і `Product(title, price)`, не пишучи в них ні `__repr__`, ні `__eq__`.

### Вправа 4: Виправте MRO

Це оголошення класу завершується помилкою. Поясніть чому і виправте його так, щоб `App().log("started")` використовував `FileLogger.log()`.

```python
class Logger:
    def log(self, message):
        print(f"[log] {message}")


class FileLogger(Logger):
    def log(self, message):
        print(f"[file] {message}")


class App(Logger, FileLogger):
    pass
```

## Розв'язки

### Вправа 1

Результат:

```text
['Bottom', 'Left', 'Right', 'Base']
['Left', 'Base']
['Bottom', 'Left', 'Right', 'Base', 'object']
```

Для об'єкта `Bottom` MRO має вигляд `Bottom, Left, Right, Base, object`, тож `super()` усередині `Left.who()` веде до `Right`. Для звичайного об'єкта `Left` MRO — `Left, Base, object`, і той самий `super()` веде одразу до `Base`. `super()` іде за MRO фактичного об'єкта, а не класу, у якому написано код.

### Вправа 2

```python
class Person:
    def __init__(self, *, name, **kwargs):
        super().__init__(**kwargs)
        self.name = name


class Employee(Person):
    def __init__(self, *, salary, **kwargs):
        super().__init__(**kwargs)
        self.salary = salary


class Student(Person):
    def __init__(self, *, school, **kwargs):
        super().__init__(**kwargs)
        self.school = school


class WorkingStudent(Employee, Student):
    pass


ws = WorkingStudent(name="Taras", salary=800, school="KPI")
print(vars(ws))
print([cls.__name__ for cls in WorkingStudent.__mro__])
print(vars(Student(name="Olena", school="KNU")))
try:
    WorkingStudent(name="Ivan", salary=900)
except TypeError as error:
    print(error)
```

Результат:

```text
{'name': 'Taras', 'school': 'KPI', 'salary': 800}
['WorkingStudent', 'Employee', 'Student', 'Person', 'object']
{'name': 'Olena', 'school': 'KNU'}
Student.__init__() missing 1 required keyword-only argument: 'school'
```

`Employee` забирає `salary` і передає решту далі, `Student` забирає `school`, а `Person` забирає `name` і викликає `object.__init__()`, коли нічого не лишилося. Параметри лише за назвою (після `*`) змушують забутий аргумент гучно завершитися помилкою, а повідомлення точно називає клас, якому він був потрібен.

### Вправа 3

```python
class ReprMixin:
    def __repr__(self):
        fields = ", ".join(f"{key}={value!r}" for key, value in vars(self).items())
        return f"{type(self).__name__}({fields})"


class EqualityMixin:
    def __eq__(self, other):
        if type(other) is not type(self):
            return NotImplemented
        return vars(self) == vars(other)


class Point(ReprMixin, EqualityMixin):
    def __init__(self, x, y):
        self.x = x
        self.y = y


class Product(ReprMixin, EqualityMixin):
    def __init__(self, title, price):
        self.title = title
        self.price = price


print(Point(1, 2))
print(Point(1, 2) == Point(1, 2), Point(1, 2) == Point(2, 1))
print(Product("Pen", 9.5))
print(Product("Pen", 9.5) == Point(1, 2))
```

Результат:

```text
Point(x=1, y=2)
True False
Product(title='Pen', price=9.5)
False
```

Повернення `NotImplemented` для іншого типу дає Python змогу спробувати другий операнд, а зрештою порівняти об'єкти за ідентичністю, що дає `False`. Зверніть увагу: клас, який визначає `__eq__` без `__hash__`, отримує `__hash__ = None`, тож ці об'єкти не можна хешувати. Для змінюваних об'єктів це правильна поведінка за замовчуванням.

### Вправа 4

`App(Logger, FileLogger)` вимагає поставити `Logger` перед `FileLogger`, але `FileLogger` — підклас `Logger` і мусить стояти перед ним. Жоден порядок не задовольняє обидві умови, тому Python генерує `TypeError`. Оскільки `FileLogger` уже містить усе, що має `Logger`, достатньо успадковувати лише його:

```python
class Logger:
    def log(self, message):
        print(f"[log] {message}")


class FileLogger(Logger):
    def log(self, message):
        print(f"[file] {message}")


try:
    class App(Logger, FileLogger):
        pass
except TypeError as error:
    print(error)


class App(FileLogger):
    pass


App().log("started")
print([cls.__name__ for cls in App.__mro__])
```

Результат:

```text
Cannot create a consistent method resolution order (MRO) for bases Logger, FileLogger
[file] started
['App', 'FileLogger', 'Logger', 'object']
```

`class App(FileLogger, Logger)` теж спрацював би, але згадка `Logger` нічого не додає.

---

*Джерело: [pythontutorial.net — Python Multiple Inheritance](https://www.pythontutorial.net/python-oop/python-multiple-inheritance/). Адаптовано й доповнено для PyJourney.*
