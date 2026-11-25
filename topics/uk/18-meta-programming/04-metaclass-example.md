# Приклад метакласу

У цій темі метакласи працюють над реалістичним завданням. Класи, які здебільшого зберігають дані, потребують багато одноманітного коду: властивостей, `__init__`, `__repr__`, `__eq__`, `__hash__`. Тут ви збудуєте метаклас `Data`, який генерує все це з простого списку назв полів. А потім порівняєте результат із `@dataclass` — інструментом стандартної бібліотеки, що розв'язує ту саму задачу.

## Що ви дізнаєтесь

- Чому класам «для даних» потрібно стільки шаблонного коду
- Як метаклас може генерувати властивості та спеціальні методи зі списку назв полів
- Як будувати методи за допомогою замикань і додавати їх до класу через `setattr()`
- Як застосувати метаклас через декоратор класу і яка пастка ховається в копіюванні `__dict__`
- Підводні камені згенерованого коду: хешування змінюваних об'єктів, мовчазні помилки в аргументах, пізнє зв'язування в циклах
- Як `@dataclass` дає ті самі можливості одним рядком

## Проблема: шаблонний код у класах даних

Ось клас `Person`, написаний вручну, з двома властивостями та звичними спеціальними методами:

```python
class Person:
    def __init__(self, name, age):
        self.name = name
        self.age = age

    @property
    def name(self):
        return self._name

    @name.setter
    def name(self, value):
        self._name = value

    @property
    def age(self):
        return self._age

    @age.setter
    def age(self, value):
        self._age = value

    def __eq__(self, other):
        return self.name == other.name and self.age == other.age

    def __hash__(self):
        return hash((self.name, self.age))

    def __repr__(self):
        return f"Person(name={self.name!r}, age={self.age!r})"


p = Person("John Doe", 25)
print(p)
print(p == Person("John Doe", 25))
```

Результат:

```text
Person(name='John Doe', age=25)
True
```

Для двох полів це вже близько 30 рядків. Типовому класу даних потрібні:

- властивість для кожного поля;
- `__init__`, що задає кожне поле;
- `__repr__` для зручного для читання подання (`print()` використовує `__str__`, а той, якщо його не визначено, звертається до `__repr__`);
- `__eq__`, що порівнює об'єкти за значеннями полів;
- `__hash__`, щоб об'єкти могли бути ключами словника чи елементами множини.

Кожен новий клас повторює той самий шаблон, лише з іншими назвами полів. Мета — писати тільки ось це, а все інше отримувати автоматично:

```python
class Person(metaclass=Data):
    props = ["name", "age"]
```

Метаклас тут підходить природно: він виконується один раз для кожного класу, який створює, і може додавати до цього класу методи.

## Крок 1: Каркас метакласу

```python
class Data(type):
    def __new__(mcs, name, bases, class_dict):
        class_obj = super().__new__(mcs, name, bases, class_dict)
        return class_obj
```

`Data.__new__` отримує назву класу, базові класи та простір імен, заповнений тілом класу, і доручає `type` збудувати клас. Як і будь-який `__new__`, це статичний метод, який Python загортає автоматично, тож `@staticmethod` не потрібен. Пам'ятайте, що він створює **клас** `Person`, а не екземпляр `Person`.

Кожен наступний крок додає дві речі: допоміжний статичний метод, який отримує новий об'єкт класу і будує щось для нього, та один рядок у `__new__`, що прикріплює результат до класу.

## Крок 2: Властивості

Спершу невеликий допоміжний клас. Об'єкт `Prop` знає назву «приватного» атрибута (наприклад, `_name`) і має три методи, які читають, записують і видаляють цей атрибут у будь-якого об'єкта:

```python
class Prop:
    def __init__(self, attr):
        self._attr = attr

    def get(self, obj):
        return getattr(obj, self._attr)

    def set(self, obj, value):
        setattr(obj, self._attr, value)

    def delete(self, obj):
        delattr(obj, self._attr)
```

Далі — статичний метод `Data`, що створює по одній властивості на кожне поле і додає її до класу. У `__new__` викликаємо його одразу після створення класу:

```python
    # усередині класу Data:
    def __new__(mcs, name, bases, class_dict):
        class_obj = super().__new__(mcs, name, bases, class_dict)

        # створюємо властивості
        mcs.define_property(class_obj)

        return class_obj

    @staticmethod
    def define_property(class_obj):
        for prop in class_obj.props:
            accessor = Prop(f"_{prop}")
            prop_obj = property(
                fget=accessor.get,
                fset=accessor.set,
                fdel=accessor.delete,
            )
            setattr(class_obj, prop, prop_obj)
```

Як це працює:

- Для поля `"name"` змінна `accessor` — це `Prop("_name")`. `accessor.get` — **зв'язаний метод** (bound method): коли властивість згодом викличе `fget(obj)`, це перетвориться на `accessor.get(obj)`, що поверне `getattr(obj, "_name")`.
- `property(fget=..., fset=..., fdel=...)` — це саме те, що за лаштунками будують декоратори `@property` і `@name.setter`.
- `setattr(class_obj, "name", prop_obj)` прикріплює властивість до класу, ніби ви написали її в тілі класу.
- Значення зберігається під ім'ям `_name`, а не `name`. Якби сетер записував у `obj.name`, він викликав би сам себе знову й знову, до нескінченної рекурсії.
- `mcs.define_property(...)` замість `Data.define_property(...)` дає змогу підкласу `Data` перевизначити цей допоміжний метод.

Навіть лише з цим кроком властивості вже працюють:

```python
class Person(metaclass=Data):
    props = ["name", "age"]


p = Person()
p.name = "John Doe"
print(p.name)
print(p.__dict__)
print([key for key in Person.__dict__ if not key.startswith("__")])

try:
    print(p.age)
except AttributeError as error:
    print("Error:", error)
```

Результат:

```text
John Doe
{'_name': 'John Doe'}
['props', 'name', 'age']
Error: 'Person' object has no attribute '_age'
```

`age` так і не задали, тому читання завершується помилкою. Це виправить `__init__`, який вимагатиме всі поля.

## Крок 3: `__init__`

Допоміжний метод `init` сам нічого не виконує. Він **будує** функцію і повертає її, а `__new__` встановлює цю функцію як `__init__` класу:

```python
        # у Data.__new__, після define_property:
        # визначаємо __init__
        setattr(class_obj, "__init__", mcs.init(class_obj))
```

```python
    # усередині класу Data:
    @staticmethod
    def init(class_obj):
        props = class_obj.props
        name = class_obj.__name__

        def _init(self, *args, **kwargs):
            if len(args) > len(props):
                raise TypeError(f"{name}() takes {len(props)} values, got {len(args)}")
            values = dict(zip(props, args))
            for key, value in kwargs.items():
                if key not in props:
                    raise TypeError(f"{name}() got an unexpected argument {key!r}")
                if key in values:
                    raise TypeError(f"{name}() got multiple values for {key!r}")
                values[key] = value
            missing = [prop for prop in props if prop not in values]
            if missing:
                raise TypeError(f"{name}() is missing values for {missing}")
            for key, value in values.items():
                setattr(self, key, value)

        return _init
```

`_init` — це **замикання** (closure): воно пам'ятає `props` і `name` з виклику `init()`. Кожен клас, створений `Data`, отримує власний `_init` із власним списком полів.

Функція приймає значення позиційно, за іменем або обома способами, як звичайний `__init__`: позиційні значення зіставляються з полями по черзі, потім додаються іменовані. Вона відхиляє невідомі назви, повтори та відсутні поля. `setattr(self, key, value)` проходить через властивість із кроку 2, тож значення потрапляє в `_name`, `_age` і так далі.

```python
p = Person("John Doe", age=25)
print(p.__dict__)

try:
    Person("John Doe", agee=25)
except TypeError as error:
    print("Error:", error)
```

Результат:

```text
{'_name': 'John Doe', '_age': 25}
Error: Person() got an unexpected argument 'agee'
```

> **Зверніть увагу:** `__init__` з оригінального посібника просто перебирав відомі поля й ігнорував усе інше. З ним друкарська помилка на кшталт `Person("John Doe", nme="x")` не спричиняла жодної помилки. Об'єкт створювався без `_age`, і проблема виринала лише згодом як `AttributeError: 'Person' object has no attribute '_age'`. Згенерований код має падати так само рано і так само зрозуміло, як написаний вручну.

## Крок 4: `__repr__`

```python
        # у Data.__new__, після __init__:
        # визначаємо __repr__
        setattr(class_obj, "__repr__", mcs.repr(class_obj))
```

```python
    # усередині класу Data:
    @staticmethod
    def repr(class_obj):
        def _repr(self):
            pairs = (f"{prop}={getattr(self, prop)!r}" for prop in class_obj.props)
            return f"{class_obj.__name__}({', '.join(pairs)})"

        return _repr
```

```python
p = Person("John Doe", age=25)
print(p)
print([p])
```

Результат:

```text
Person(name='John Doe', age=25)
[Person(name='John Doe', age=25)]
```

Перетворення `!r` форматує кожне значення через `repr()`, тому рядки виводяться в лапках, а результат схожий на виклик, що створює об'єкт. Без `!r` ви отримали б `Person(name=John Doe, age=25)`, і це неоднозначно: `John Doe` — одне значення чи два? `__repr__` використовується і для `print(p)`, і для контейнерів на кшталт `[p]`, тож один метод покриває обидва випадки.

## Крок 5: `__eq__` і `__hash__`

```python
        # у Data.__new__, після __repr__:
        # визначаємо __eq__ і __hash__
        setattr(class_obj, "__eq__", mcs.eq(class_obj))
        setattr(class_obj, "__hash__", mcs.hash(class_obj))
```

```python
    # усередині класу Data:
    @staticmethod
    def eq(class_obj):
        def _eq(self, other):
            if not isinstance(other, class_obj):
                return NotImplemented
            self_values = [getattr(self, prop) for prop in class_obj.props]
            other_values = [getattr(other, prop) for prop in class_obj.props]
            return self_values == other_values

        return _eq

    @staticmethod
    def hash(class_obj):
        def _hash(self):
            return hash(tuple(getattr(self, prop) for prop in class_obj.props))

        return _hash
```

Ухвалені рішення:

- Два об'єкти рівні, коли рівні всі значення їхніх полів.
- Для об'єкта іншого типу `_eq` повертає `NotImplemented`, а не `False`. Так ми кажемо Python: «я не знаю, як порівнювати з цим», і Python може спробувати `__eq__` іншого об'єкта, перш ніж перейти до порівняння ідентичності. Оригінальний посібник повертав тут `False`, що блокує цей механізм.
- Значення обох сторін читаються за `class_obj.props`. В оригіналі читалося `other.props`, а це ламається, якщо `other` — підклас з іншим списком полів.
- `_hash` хешує кортеж тих самих значень, які порівнює `_eq`. Правило хешування таке: **рівні об'єкти мусять мати рівні хеші**. Однакові поля в обох методах це гарантують.

## Збираємо все разом

```python
class Prop:
    def __init__(self, attr):
        self._attr = attr

    def get(self, obj):
        return getattr(obj, self._attr)

    def set(self, obj, value):
        setattr(obj, self._attr, value)

    def delete(self, obj):
        delattr(obj, self._attr)


class Data(type):
    def __new__(mcs, name, bases, class_dict):
        class_obj = super().__new__(mcs, name, bases, class_dict)

        # створюємо властивості
        mcs.define_property(class_obj)

        # визначаємо __init__
        setattr(class_obj, "__init__", mcs.init(class_obj))

        # визначаємо __repr__
        setattr(class_obj, "__repr__", mcs.repr(class_obj))

        # визначаємо __eq__ і __hash__
        setattr(class_obj, "__eq__", mcs.eq(class_obj))
        setattr(class_obj, "__hash__", mcs.hash(class_obj))

        return class_obj

    @staticmethod
    def define_property(class_obj):
        for prop in class_obj.props:
            accessor = Prop(f"_{prop}")
            prop_obj = property(
                fget=accessor.get,
                fset=accessor.set,
                fdel=accessor.delete,
            )
            setattr(class_obj, prop, prop_obj)

    @staticmethod
    def init(class_obj):
        props = class_obj.props
        name = class_obj.__name__

        def _init(self, *args, **kwargs):
            if len(args) > len(props):
                raise TypeError(f"{name}() takes {len(props)} values, got {len(args)}")
            values = dict(zip(props, args))
            for key, value in kwargs.items():
                if key not in props:
                    raise TypeError(f"{name}() got an unexpected argument {key!r}")
                if key in values:
                    raise TypeError(f"{name}() got multiple values for {key!r}")
                values[key] = value
            missing = [prop for prop in props if prop not in values]
            if missing:
                raise TypeError(f"{name}() is missing values for {missing}")
            for key, value in values.items():
                setattr(self, key, value)

        return _init

    @staticmethod
    def repr(class_obj):
        def _repr(self):
            pairs = (f"{prop}={getattr(self, prop)!r}" for prop in class_obj.props)
            return f"{class_obj.__name__}({', '.join(pairs)})"

        return _repr

    @staticmethod
    def eq(class_obj):
        def _eq(self, other):
            if not isinstance(other, class_obj):
                return NotImplemented
            self_values = [getattr(self, prop) for prop in class_obj.props]
            other_values = [getattr(other, prop) for prop in class_obj.props]
            return self_values == other_values

        return _eq

    @staticmethod
    def hash(class_obj):
        def _hash(self):
            return hash(tuple(getattr(self, prop) for prop in class_obj.props))

        return _hash


class Person(metaclass=Data):
    props = ["name", "age"]


if __name__ == "__main__":
    print(list(Person.__dict__))

    p1 = Person("John Doe", age=25)
    p2 = Person("Jane Doe", age=25)
    print(p1, p2)
    print(p1.__dict__)

    print(p1 == p2)
    p2.name = "John Doe"
    print(p1 == p2)
    print(len({p1, p2}))

    try:
        Person("John Doe", 25, nme="x")
    except TypeError as error:
        print("Error:", error)
```

Результат (Python 3.14):

```text
['__module__', '__firstlineno__', 'props', '__static_attributes__', '__dict__', '__weakref__', '__doc__', 'name', 'age', '__init__', '__repr__', '__eq__', '__hash__']
Person(name='John Doe', age=25) Person(name='Jane Doe', age=25)
{'_name': 'John Doe', '_age': 25}
False
True
1
Error: Person() got an unexpected argument 'nme'
```

Тіло класу містило лише `props`, проте тепер у `Person.__dict__` є дві властивості та чотири спеціальні методи. Після `p2.name = "John Doe"` об'єкти стали рівними й мають однаковий хеш, тому множина залишає лише один із них.

## Застосування метакласу через декоратор

Писати `metaclass=Data` у заголовку кожного класу трохи громіздко. Оригінальний посібник пропонував декоратор, який перебудовує клас за допомогою `Data`. Продовжуємо програму вище:

```python
def data(cls):
    return Data(cls.__name__, cls.__bases__, dict(cls.__dict__))


@data
class Employee:
    props = ["name", "job_title"]


e = Employee(name="John Doe", job_title="Python Developer")
print(e)
print(type(Employee).__name__)

try:
    print(e.__dict__)
except TypeError as error:
    print("Error:", error)
```

Результат:

```text
Employee(name='John Doe', job_title='Python Developer')
Data
Error: descriptor '__dict__' for 'Employee' objects doesn't apply to a 'Employee' object
```

На перший погляд клас працює, але `e.__dict__` (і `vars(e)`) зламані. Причина в тому, що `cls.__dict__` *початкового* класу містить два дескриптори, `__dict__` і `__weakref__`, які належать саме тому класу. Скопійовані в новий клас, вони змушують `e.__dict__` використовувати дескриптор, що приймає лише екземпляри **старого** `Employee`. Виправлення — прибрати ці два записи перед перебудовою:

```python
def data(cls):
    namespace = dict(cls.__dict__)
    # ці два дескриптори належать початковому класу: прибираємо їх
    namespace.pop("__dict__", None)
    namespace.pop("__weakref__", None)
    return Data(cls.__name__, cls.__bases__, namespace)


@data
class Employee:
    props = ["name", "job_title"]


e = Employee(name="John Doe", job_title="Python Developer")
print(e)
print(e.__dict__)


class Manager(Employee):
    pass


print(type(Manager).__name__, Manager("Olena", "CTO"))
```

Результат:

```text
Employee(name='John Doe', job_title='Python Developer')
{'_name': 'John Doe', '_job_title': 'Python Developer'}
Data Manager(name='Olena', job_title='CTO')
```

Ще дві речі, які варто знати про цей декоратор:

- Клас будується **двічі**: спершу через `type` (звичайна інструкція `class`), а потім знову через `Data`. Перший об'єкт класу просто викидається.
- Повернений клас є екземпляром `Data`, тож його підкласи (як-от `Manager`) теж проходять через `Data`. У цьому випадку декоратор і ключове слово `metaclass=` дають однаковий результат.

## Стандартне рішення: `@dataclass`

Починаючи з Python 3.7 у стандартній бібліотеці є модуль `dataclasses` (PEP 557). Він уміє все, що вміє метаклас `Data`, і навіть більше, використовуючи декоратор класу та анотації типів:

```python
from dataclasses import dataclass


@dataclass
class Person:
    name: str
    age: int


p1 = Person("John Doe", age=25)
p2 = Person("John Doe", 25)
print(p1)
print(p1 == p2)
print(Person.__hash__)

try:
    Person("John Doe")
except TypeError as error:
    print("Error:", error)


@dataclass(frozen=True)
class Point:
    x: int
    y: int


print({Point(1, 2), Point(1, 2)})
```

Результат:

```text
Person(name='John Doe', age=25)
True
None
Error: Person.__init__() missing 1 required positional argument: 'age'
{Point(x=1, y=2)}
```

Зверніть увагу: `Person.__hash__` дорівнює `None`. Звичайний (змінюваний) клас даних навмисно **не хешується** з причини, поясненої в розділі *Типові помилки*. Клас із `frozen=True` не можна змінити після створення, тому він отримує безпечний `__hash__`.

| Можливість | Метаклас `Data` | `@dataclass` |
|---|---|---|
| Список полів | `props = [...]` | анотації типів |
| `__init__` зі справжньою сигнатурою, значення за замовчуванням | ні (загальний `*args, **kwargs`) | так |
| `__repr__`, `__eq__` | так | так |
| `__hash__` | завжди, навіть для змінюваних об'єктів | лише коли це безпечно (`frozen=True`) або на запит |
| Упорядкування (`<`, `>`), `__slots__`, поля лише за іменем | ні | так (`order=True`, `slots=True`, `kw_only=True`) |
| Підтримка в IDE і статичних аналізаторах типів | погана | повна |

У реальних проєктах використовуйте `@dataclass` (або бібліотеки на кшталт attrs чи Pydantic). Метаклас `Data` цінний як вправа: він показує, що саме генерують для вас такі інструменти.

## Типові помилки

- **Робити змінювані об'єкти хешованими.** `Data` дає кожному класу `__hash__` на основі значень полів, але поля можуть змінюватися. Якщо об'єкт змінився, поки лежить у множині чи слугує ключем словника, він зберігається під *старим* хешем, і знайти його вже неможливо. Продовжуємо повну програму:

  ```python
  team = {Person("John Doe", 25)}
  member = next(iter(team))
  member.age = 26

  print(member in team)
  print(Person("John Doe", 26) in team)
  ```

  Результат:

  ```text
  False
  False
  ```

  Об'єкт у множині є, проте множина його не знаходить. Або робіть такі об'єкти незмінюваними (як класи даних із `frozen=True`), або залишайте їх нехешованими.

- **Мовчки ігнорувати неправильні аргументи.** Згенеровані методи `__init__` мають відхиляти невідомі, повторені й відсутні поля, як у кроці 3. Інакше друкарські помилки перетворюються на заплутані помилки далеко від свого джерела.
- **Бездумно копіювати `cls.__dict__`, перебудовуючи клас.** Спершу приберіть `__dict__` і `__weakref__`, як це робить виправлений декоратор `data`.
- **Повертати з `__eq__` `False` замість `NotImplemented`.** Для непідтримуваного типу повертайте `NotImplemented`, і нехай Python спробує інший операнд.
- **Створювати в циклі функції, що використовують змінну циклу.** Замикання шукають змінні тоді, коли їх *викликають*, а не тоді, коли їх створюють, тому кожна функція бачить останнє значення:

  ```python
  class Box:
      pass


  box = Box()
  box._name, box._age = "Olena", 31

  getters = {}
  for field in ["name", "age"]:
      getters[field] = lambda obj: getattr(obj, f"_{field}")

  print(getters["name"](box))
  print(getters["age"](box))
  ```

  Результат:

  ```text
  31
  31
  ```

  Обидва гетери читають `_age`. Саме тому `define_property` створює окремий об'єкт `Prop` для кожного поля, і саме тому допоміжні функції, які отримують поле як параметр, — безпечний спосіб будувати функції для кожного поля.

## Підсумок

- Класи, що зберігають дані, знову й знову потребують того самого шаблонного коду: властивостей, `__init__`, `__repr__`, `__eq__`, `__hash__`.
- Метаклас може генерувати цей код один раз для кожного класу, під час створення класу, з декларативного списку полів на кшталт `props = ["name", "age"]`.
- Допоміжні функції-«будівельники» повертають замикання, а `setattr(class_obj, "__init__", ...)` прикріплює їх до класу.
- Згенеровані методи мають поводитися як добре написані вручну: суворо перевіряти аргументи, використовувати `!r` у `__repr__`, `NotImplemented` в `__eq__` і однакові поля в `__eq__` та `__hash__`.
- Декоратор класу може застосувати метаклас, але, копіюючи простір імен, він має прибрати дескриптори `__dict__` і `__weakref__`.
- Хешовані об'єкти мають бути незмінюваними. Зміна хешованого об'єкта ламає множини та словники.
- У реальному коді використовуйте `@dataclass`, який дає все це і навіть більше.

## Практика

### Вправа 1: Автоматичний `__repr__`

Напишіть метаклас `AutoRepr`, який дає кожному створеному ним класу `__repr__` на основі атрибута класу `fields` — кортежу назв атрибутів. Застосуйте його до класу `City` з полями `name` і `population`, щоб `print(City("Kyiv", 2_950_000))` виводив `City(name='Kyiv', population=2950000)`.

### Вправа 2: Спосіб dataclass

Оголосіть клас `Book` з полями `title`, `author` і `year` як незмінюваний (frozen) клас даних. Покажіть, що дві книжки, створені з однаковими значеннями (одна з позиційними аргументами, друга з іменованими), рівні, що множина зберігає лише одну з них і що зміна `year` генерує `dataclasses.FrozenInstanceError`.

### Вправа 3: Властивості з перевіркою типу

Напишіть метаклас `Typed`, який читає атрибут класу `fields` — словник на кшталт `{"name": str, "age": int}` — і створює властивість для кожного поля. Сетер має генерувати `TypeError`, коли значення має неправильний тип, наприклад `age must be int, got str`. Зберігайте значення в `_name`, `_age` і так далі. Переконайтеся, що кожна властивість перевіряє *свій* тип (згадайте пастку пізнього зв'язування).

### Вправа 4: Незмінювані об'єкти-значення

Напишіть метаклас `Frozen`, який читає кортеж `fields` і генерує:

- `__init__(*args)`, що вимагає рівно одне значення на кожне поле;
- `__setattr__`, що завжди генерує `AttributeError("<Name> objects are read-only")`;
- `__eq__`, `__hash__` і `__repr__` на основі значень полів.

Перевірте його на `class Money(metaclass=Frozen): fields = ("amount", "currency")`. Підказка: усередині `__init__` потрібен спосіб задати атрибути, оминаючи ваш власний `__setattr__`.

## Розв'язки

### Вправа 1

```python
class AutoRepr(type):
    def __new__(mcs, name, bases, namespace):
        cls = super().__new__(mcs, name, bases, namespace)

        def __repr__(self):
            pairs = ", ".join(f"{field}={getattr(self, field)!r}" for field in self.fields)
            return f"{type(self).__name__}({pairs})"

        cls.__repr__ = __repr__
        return cls


class City(metaclass=AutoRepr):
    fields = ("name", "population")

    def __init__(self, name, population):
        self.name = name
        self.population = population


print(City("Kyiv", 2_950_000))
print([City("Lviv", 717_000)])
```

Результат:

```text
City(name='Kyiv', population=2950000)
[City(name='Lviv', population=717000)]
```

### Вправа 2

```python
from dataclasses import FrozenInstanceError, dataclass


@dataclass(frozen=True)
class Book:
    title: str
    author: str
    year: int


b1 = Book("Dune", "Frank Herbert", 1965)
b2 = Book(title="Dune", author="Frank Herbert", year=1965)
print(b1)
print(b1 == b2, len({b1, b2}))

try:
    b1.year = 2000
except FrozenInstanceError as error:
    print("Error:", error)
```

Результат:

```text
Book(title='Dune', author='Frank Herbert', year=1965)
True 1
Error: cannot assign to field 'year'
```

П'ять рядків оголошення класу замінюють увесь метаклас `Data`, а оскільки об'єкти незмінювані, хешувати їх безпечно.

### Вправа 3

```python
class Typed(type):
    def __new__(mcs, name, bases, namespace):
        cls = super().__new__(mcs, name, bases, namespace)
        for field, expected in cls.fields.items():
            setattr(cls, field, mcs.make_property(field, expected))
        return cls

    @staticmethod
    def make_property(field, expected):
        attr = f"_{field}"

        def getter(self):
            return getattr(self, attr)

        def setter(self, value):
            if not isinstance(value, expected):
                raise TypeError(
                    f"{field} must be {expected.__name__}, got {type(value).__name__}"
                )
            setattr(self, attr, value)

        return property(getter, setter)


class Person(metaclass=Typed):
    fields = {"name": str, "age": int}

    def __init__(self, name, age):
        self.name = name
        self.age = age


p = Person("Olena", 31)
print(p.name, p.age)

try:
    p.age = "thirty"
except TypeError as error:
    print("Error:", error)

try:
    Person(42, 31)
except TypeError as error:
    print("Error:", error)
```

Результат:

```text
Olena 31
Error: age must be int, got str
Error: name must be str, got int
```

`make_property()` — окрема функція, тому кожен її виклик створює нові змінні `field`, `expected` і `attr` для своїх замикань. Якби `getter` і `setter` визначалися прямо в циклі `for`, кожна властивість використовувала б останнє поле.

### Вправа 4

```python
class Frozen(type):
    def __new__(mcs, name, bases, namespace):
        cls = super().__new__(mcs, name, bases, namespace)
        fields = cls.fields

        def values(self):
            return tuple(getattr(self, field) for field in fields)

        def __init__(self, *args):
            if len(args) != len(fields):
                raise TypeError(f"{name}() expects {len(fields)} values, got {len(args)}")
            for field, value in zip(fields, args):
                object.__setattr__(self, field, value)

        def __setattr__(self, key, value):
            raise AttributeError(f"{name} objects are read-only")

        def __eq__(self, other):
            if not isinstance(other, cls):
                return NotImplemented
            return values(self) == values(other)

        def __hash__(self):
            return hash(values(self))

        def __repr__(self):
            pairs = ", ".join(f"{f}={v!r}" for f, v in zip(fields, values(self)))
            return f"{name}({pairs})"

        for method in (__init__, __setattr__, __eq__, __hash__, __repr__):
            setattr(cls, method.__name__, method)
        return cls


class Money(metaclass=Frozen):
    fields = ("amount", "currency")


price = Money(10, "UAH")
print(price)
print(price == Money(10, "UAH"))
print(len({price, Money(10, "UAH"), Money(5, "EUR")}))

try:
    price.amount = 0
except AttributeError as error:
    print("Error:", error)
```

Результат:

```text
Money(amount=10, currency='UAH')
True
2
Error: Money objects are read-only
```

`object.__setattr__(self, field, value)` напряму викликає базову реалізацію й оминає блокувальний `__setattr__`. Той самий прийом використовують і незмінювані класи даних. Щоб заблокувати ще й `del price.amount`, додайте так само `__delattr__`, що генерує виняток.

---

*Джерело: [pythontutorial.net — Python Metaclass Example](https://www.pythontutorial.net/python-oop/python-metaclass-example/). Адаптовано й доповнено для PyJourney.*
