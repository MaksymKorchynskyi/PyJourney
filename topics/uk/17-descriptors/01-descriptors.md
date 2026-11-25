# Дескриптори

**Дескриптор** (descriptor) — це об'єкт, який бере під контроль атрибут *іншого* класу: щоразу, коли цей атрибут читають, присвоюють чи видаляють, Python викликає методи дескриптора замість того, щоб просто звернутися до словника. Дескриптори дають змогу один раз записати правило на кшталт «має бути непорожнім рядком» і повторно використовувати його для скількох завгодно атрибутів і класів. Крім того, саме на них побудовані `property`, методи, `classmethod`, `staticmethod` і `__slots__`.

## Що ви дізнаєтесь

- Чому перевірка значень через властивості погано масштабується і як це виправляють дескриптори
- Що таке протокол дескрипторів: `__get__`, `__set__`, `__delete__` і `__set_name__`
- Як написати дескриптор-валідатор і використовувати його в кількох класах
- Який саме метод і з якими аргументами викликає Python, коли ви читаєте, присвоюєте чи видаляєте керований атрибут
- Де дескриптор має зберігати значення і які помилки виникають, коли він зберігає їх не там
- Як побудувати сімейство валідаторів на основі одного базового класу

## Проблема: та сама перевірка в кожній властивості

Припустімо, що `Person` завжди повинен мати непорожні ім'я та прізвище. Звичайні атрибути приймають будь-що, тому першим кроком зазвичай стає властивість із сетером, що перевіряє значення (див. тему «Властивості (property)»):

```python
class Person:
    def __init__(self, first_name, last_name):
        self.first_name = first_name
        self.last_name = last_name

    @property
    def first_name(self):
        return self._first_name

    @first_name.setter
    def first_name(self, value):
        if not isinstance(value, str):
            raise TypeError("The first name must be a string")
        if len(value) == 0:
            raise ValueError("The first name cannot be empty")
        self._first_name = value

    @property
    def last_name(self):
        return self._last_name

    @last_name.setter
    def last_name(self, value):
        if not isinstance(value, str):
            raise TypeError("The last name must be a string")
        if len(value) == 0:
            raise ValueError("The last name cannot be empty")
        self._last_name = value


person = Person("John", "Doe")
print(person.first_name, person.last_name)

try:
    person.last_name = ""
except ValueError as error:
    print(error)
```

Результат:

```text
John Doe
The last name cannot be empty
```

Це працює, але подивіться на ціну: два атрибути, чотири методи й ті самі перевірки, написані двічі. Додайте `middle_name`, `city` і `country` або ще один клас з обов'язковим `title`, і копіювання лише множиться. Якщо винести перевірки в допоміжну функцію, частина дублювання зникне, але кожному атрибуту однаково потрібна власна пара гетера й сетера.

Насправді хочеться описати правило «обов'язковий рядок» **один раз**, у вигляді об'єкта, а потім просто сказати: «цей атрибут дотримується такого правила». Такий об'єкт і є дескриптором.

## Дескриптор: правило як об'єкт для повторного використання

Дескриптор — це екземпляр класу, що визначає `__get__`, `__set__` та/або `__delete__`. Його розміщують в іншому класі як **атрибут класу**:

```python
class RequiredString:
    """Правило для повторного використання: атрибут має бути непорожнім рядком."""

    def __set_name__(self, owner, name):
        self.name = name  # запам'ятовуємо, який атрибут обслуговує цей дескриптор

    def __get__(self, instance, owner):
        if instance is None:  # звернення через клас: Person.first_name
            return self
        return instance.__dict__[self.name]

    def __set__(self, instance, value):
        if not isinstance(value, str):
            raise TypeError(f"{self.name} must be a string, not {type(value).__name__}")
        if not value:
            raise ValueError(f"{self.name} cannot be empty")
        instance.__dict__[self.name] = value


class Person:
    first_name = RequiredString()
    last_name = RequiredString()

    def __init__(self, first_name, last_name):
        self.first_name = first_name  # проходить крізь RequiredString.__set__
        self.last_name = last_name


class Product:
    title = RequiredString()  # те саме правило в іншому класі


person = Person("John", "Doe")
print(person.first_name, person.last_name)

for bad_value in ("", 42):
    try:
        person.first_name = bad_value
    except (TypeError, ValueError) as error:
        print(f"{type(error).__name__}: {error}")

try:
    Person("Jane", "")
except ValueError as error:
    print(f"ValueError: {error}")

book = Product()
try:
    book.title = None
except TypeError as error:
    print(f"TypeError: {error}")
```

Результат:

```text
John Doe
ValueError: first_name cannot be empty
TypeError: first_name must be a string, not int
ValueError: last_name cannot be empty
TypeError: title must be a string, not NoneType
```

Логіка перевірки тепер живе в одному класі. `Person` лише оголошує, *якими* мають бути його атрибути, а будь-який інший клас (тут `Product`) може скористатися тим самим правилом в один рядок. Перевірка працює й усередині `__init__`, бо `self.first_name = first_name` — звичайне присвоєння, яке проходить крізь дескриптор.

> **Зверніть увагу:** в оригінальному посібнику для обох видів неправильних даних генерується `ValueError`. У Python прийнято генерувати `TypeError`, коли значення має неправильний *тип*, і `ValueError`, коли тип правильний, але неприйнятний *вміст*. Саме так і зроблено в цій версії.

## Протокол дескрипторів

**Протокол дескрипторів** — це набір спеціальних методів, які Python шукає в об'єкта, знайденого в класі:

| Метод | Коли Python його викликає | Що він має робити |
|---|---|---|
| `__get__(self, instance, owner)` | `obj.attr` (тоді `instance` — це `obj`) або `Owner.attr` (тоді `instance` дорівнює `None`) | повернути значення атрибута |
| `__set__(self, instance, value)` | `obj.attr = value` | перевірити й зберегти значення |
| `__delete__(self, instance)` | `del obj.attr` | видалити значення або відмовити |
| `__set_name__(self, owner, name)` | один раз, коли створюється клас, що містить дескриптор | запам'ятати клас-власник та ім'я атрибута |

Об'єкт є **дескриптором**, якщо його клас визначає хоча б один із методів `__get__`, `__set__` чи `__delete__`. `__set_name__` необов'язковий і сам по собі не робить об'єкт дескриптором. Це гачок (hook), доступний починаючи з Python 3.6, який повідомляє дескриптору його власне ім'я. Завдяки йому більше не треба повторювати ім'я, як у `first_name = RequiredString("first_name")`, хоча в старому коді такий запис іще трапляється.

Дескриптори бувають двох видів:

- **дескриптор даних** (data descriptor) визначає `__set__` та/або `__delete__` (зазвичай разом із `__get__`);
- **дескриптор не-даних** (non-data descriptor) визначає лише `__get__`.

Від виду залежить, хто переможе, коли у власному `__dict__` екземпляра є запис із тим самим ім'ям. Цьому присвячено наступну тему, «Дескриптори даних і не-даних».

## Як працюють дескриптори: стежимо за викликами

Додамо `print()` у кожен метод і подивимося, що робить Python. `__repr__` в обох класах робить виведення читабельним (і без адрес у пам'яті):

```python
class RequiredString:
    def __set_name__(self, owner, name):
        print(f"__set_name__(owner={owner.__name__}, name={name!r})")
        self.name = name

    def __get__(self, instance, owner):
        print(f"__get__(instance={instance!r}, owner={owner.__name__})")
        if instance is None:
            return self
        return instance.__dict__[self.name]

    def __set__(self, instance, value):
        print(f"__set__(instance={instance!r}, value={value!r})")
        if not isinstance(value, str):
            raise TypeError(f"{self.name} must be a string")
        if not value:
            raise ValueError(f"{self.name} cannot be empty")
        instance.__dict__[self.name] = value

    def __repr__(self):
        return f"<RequiredString {self.name!r}>"


print("defining the class...")


class Person:
    first_name = RequiredString()
    last_name = RequiredString()

    def __repr__(self):
        return "<a Person>"


print("the class is ready")
person = Person()
person.first_name = "John"
print(person.first_name)
print(Person.first_name)
```

Результат:

```text
defining the class...
__set_name__(owner=Person, name='first_name')
__set_name__(owner=Person, name='last_name')
the class is ready
__set__(instance=<a Person>, value='John')
__get__(instance=<a Person>, owner=Person)
John
__get__(instance=None, owner=Person)
<RequiredString 'first_name'>
```

### `__set_name__`: дескриптор дізнається своє ім'я

`__set_name__` спрацював двічі **ще під час виконання інструкції `class Person:`**, коли жодного об'єкта `Person` іще не існувало. Python виконує тіло класу (створюючи два об'єкти `RequiredString`), будує об'єкт класу, а потім обходить простір імен нового класу й викликає `__set_name__` для кожного значення, яке має цей метод. Приблизно так:

```text
namespace = {"first_name": RequiredString(), "last_name": RequiredString(), ...}
Person = type("Person", (), namespace)          # створюємо клас
for name, value in namespace.items():           # потім повідомляємо дескриптори
    if hasattr(type(value), "__set_name__"):
        type(value).__set_name__(value, Person, name)
```

Отже, рядок `first_name = RequiredString()` у тілі класу призводить до виклику `RequiredString.__set_name__(descriptor, Person, "first_name")`. Дескриптор зберігає `name`, щоб `__get__` і `__set__` знали, з яким записом у словнику екземпляра працювати, а повідомлення про помилки могли назвати атрибут.

Обидва дескриптори — звичайні **атрибути класу**. `vars(Person)` (те саме, що `Person.__dict__`) повертає «сирі» об'єкти, не викликаючи `__get__`:

```python
# Продовження попереднього прикладу
print({key: value for key, value in vars(Person).items() if not key.startswith("__")})

person = Person()
print(person.__dict__)
person.first_name = "John"
person.last_name = "Doe"
print(person.__dict__)
```

Результат:

```text
{'first_name': <RequiredString 'first_name'>, 'last_name': <RequiredString 'last_name'>}
{}
__set__(instance=<a Person>, value='John')
__set__(instance=<a Person>, value='Doe')
{'first_name': 'John', 'last_name': 'Doe'}
```

### `__set__`: присвоєння

`person.first_name = "John"` сам по собі нічого не поклав у `person.__dict__`. Python знайшов у класі дескриптор з ім'ям `first_name`, побачив, що той має `__set__`, і викликав `__set__(person, "John")`. Дескриптор перевірив значення й зберіг його через `instance.__dict__[self.name] = value`.

Значення потрапляє в словник екземпляра під **тим самим ім'ям**, що й дескриптор. Можна було б очікувати, що наступне читання `person.first_name` знайде його там і обійде дескриптор. Але ні: дескриптор із `__set__` (дескриптор даних) має перевагу над словником екземпляра, тож кожне читання однаково проходить крізь `__get__`. Точний порядок пошуку атрибутів — тема наступного уроку.

### `__get__`: читання

`person.first_name` викликав `__get__(person, Person)`: екземпляр і його клас. `Person.first_name` викликав `__get__(None, Person)`: коли атрибут читають через клас, екземпляра немає. У такому разі прийнято повертати сам дескриптор. Тоді працюють інтроспекція, `help()` і виклики на кшталт `Person.first_name.__set_name__(...)`.

### На що перетворюється звернення до атрибута

Для дескриптора, знайденого в класі, звернення до атрибута перекладається у виклики методів так (дескриптор шукається вздовж MRO, тож успадковані дескриптори теж працюють):

```text
person.first_name           ->  type(person).__dict__["first_name"].__get__(person, type(person))
Person.first_name           ->  Person.__dict__["first_name"].__get__(None, Person)
person.first_name = "Ann"   ->  type(person).__dict__["first_name"].__set__(person, "Ann")
del person.first_name       ->  type(person).__dict__["first_name"].__delete__(person)
```

Ці виклики можна зробити вручну й переконатися, що жодної магії не лишилося:

```python
class RequiredString:
    def __set_name__(self, owner, name):
        self.name = name

    def __get__(self, instance, owner):
        if instance is None:
            return self
        return instance.__dict__[self.name]

    def __set__(self, instance, value):
        if not isinstance(value, str) or not value:
            raise ValueError(f"{self.name} must be a non-empty string")
        instance.__dict__[self.name] = value


class Person:
    first_name = RequiredString()


person = Person()
descriptor = vars(Person)["first_name"]  # «сирий» об'єкт, що зберігається в класі

descriptor.__set__(person, "Ann")            # те, що робить  person.first_name = "Ann"
print(descriptor.__get__(person, Person))    # те, що робить  person.first_name
print(descriptor.__get__(None, Person) is descriptor)  # те, що робить  Person.first_name
print(person.first_name)
```

Результат:

```text
Ann
True
Ann
```

## Читання атрибута, якому нічого не присвоїли

Багато посібників (зокрема й оригінальне джерело) пишуть `__get__` як `return instance.__dict__[self.name] or None`. Тут дві проблеми:

- Якщо атрибут ще не присвоювали, звернення до словника генерує **`KeyError`**. А механізм атрибутів Python для відсутнього атрибута очікує **`AttributeError`**: на цьому тримаються `hasattr()`, `getattr(obj, name, default)` і `__getattr__`, і `KeyError` крізь них просто «пролітає».
- `or None` перетворює будь-яке *хибне* (falsy) значення на `None`. Для рядків, які ніколи не бувають порожніми, це просто зайве, але той самий прийом у числовому дескрипторі перетворив би цілком законний `0` на `None`.

```python
class RequiredString:
    def __set_name__(self, owner, name):
        self.name = name

    def __get__(self, instance, owner):
        if instance is None:
            return self
        return instance.__dict__[self.name] or None  # як у багатьох посібниках

    def __set__(self, instance, value):
        if not isinstance(value, str) or not value:
            raise ValueError(f"{self.name} must be a non-empty string")
        instance.__dict__[self.name] = value


class User:
    nickname = RequiredString()


user = User()
try:
    print(getattr(user, "nickname", "anonymous"))
except KeyError as error:
    print("KeyError:", error)
```

Результат:

```text
KeyError: 'nickname'
```

`getattr()` зі значенням за замовчуванням мав би повернути `"anonymous"`, але він перехоплює лише `AttributeError`. Виправлення — перетворити `KeyError` на `AttributeError`. А заразом `__delete__` робить атрибут справді *обов'язковим*: після присвоєння його вже не можна видалити:

```python
class RequiredString:
    def __set_name__(self, owner, name):
        self.name = name

    def __get__(self, instance, owner):
        if instance is None:
            return self
        try:
            return instance.__dict__[self.name]
        except KeyError:
            raise AttributeError(
                f"{owner.__name__!r} object has no attribute {self.name!r}"
            ) from None

    def __set__(self, instance, value):
        if not isinstance(value, str) or not value:
            raise ValueError(f"{self.name} must be a non-empty string")
        instance.__dict__[self.name] = value

    def __delete__(self, instance):
        raise AttributeError(f"{self.name} is required and cannot be deleted")


class User:
    nickname = RequiredString()


user = User()
print(getattr(user, "nickname", "anonymous"))
print(hasattr(user, "nickname"))
try:
    user.nickname
except AttributeError as error:
    print("AttributeError:", error)

user.nickname = "max"
try:
    del user.nickname
except AttributeError as error:
    print("AttributeError:", error)
print(user.nickname)
```

Результат:

```text
anonymous
False
AttributeError: 'User' object has no attribute 'nickname'
AttributeError: nickname is required and cannot be deleted
max
```

`from None` приховує внутрішній `KeyError` у трасуванні, тож користувач бачить чистий `AttributeError`.

> **Зверніть увагу:** якщо дескриптор визначає `__set__`, але не `__delete__`, то `del obj.attr` завершується помилкою `AttributeError: __delete__`. Python **не** переходить до видалення запису зі словника екземпляра. Якщо видалення має бути дозволене, визначте `__delete__` явно.

## Сімейство валідаторів

Щойно у вас є один дескриптор-валідатор, проступає закономірність: читання, збереження й видалення завжди однакові, відрізняється лише перевірка. Винесіть спільну частину в абстрактний базовий клас, а підкласи нехай реалізують тільки `validate()`. Так само влаштовано приклад в офіційному посібнику Python «Descriptor Guide»:

```python
from abc import ABC, abstractmethod


class Validator(ABC):
    """Базовий дескриптор: зберігає значення, а перевірку доручає validate()."""

    def __set_name__(self, owner, name):
        self.name = name

    def __get__(self, instance, owner=None):
        if instance is None:
            return self
        try:
            return instance.__dict__[self.name]
        except KeyError:
            raise AttributeError(self.name) from None

    def __set__(self, instance, value):
        self.validate(value)
        instance.__dict__[self.name] = value

    @abstractmethod
    def validate(self, value):
        """Згенерувати виняток, якщо значення неприйнятне."""


class RequiredString(Validator):
    def validate(self, value):
        if not isinstance(value, str):
            raise TypeError(f"{self.name} must be a string")
        if not value.strip():
            raise ValueError(f"{self.name} cannot be empty")


class Number(Validator):
    def __init__(self, minvalue=None, maxvalue=None):
        self.minvalue = minvalue
        self.maxvalue = maxvalue

    def validate(self, value):
        if isinstance(value, bool) or not isinstance(value, (int, float)):
            raise TypeError(f"{self.name} must be a number")
        if self.minvalue is not None and value < self.minvalue:
            raise ValueError(f"{self.name} must be at least {self.minvalue}")
        if self.maxvalue is not None and value > self.maxvalue:
            raise ValueError(f"{self.name} must be at most {self.maxvalue}")


class OneOf(Validator):
    def __init__(self, *options):
        self.options = set(options)

    def validate(self, value):
        if value not in self.options:
            raise ValueError(f"{self.name} must be one of {sorted(self.options)}")


class Employee:
    name = RequiredString()
    age = Number(minvalue=18, maxvalue=70)
    department = OneOf("HR", "IT", "Sales")

    def __init__(self, name, age, department):
        self.name = name
        self.age = age
        self.department = department


olena = Employee("Olena", 31, "IT")
print(olena.name, olena.age, olena.department)

for args in [("   ", 30, "IT"), ("Max", 17, "IT"), ("Max", True, "IT"), ("Max", 40, "Legal")]:
    try:
        Employee(*args)
    except (TypeError, ValueError) as error:
        print(f"{args} -> {type(error).__name__}: {error}")
```

Результат:

```text
Olena 31 IT
('   ', 30, 'IT') -> ValueError: name cannot be empty
('Max', 17, 'IT') -> ValueError: age must be at least 18
('Max', True, 'IT') -> TypeError: age must be a number
('Max', 40, 'Legal') -> ValueError: department must be one of ['HR', 'IT', 'Sales']
```

На що варто звернути увагу:

- Дескриптор може отримувати **власні налаштування** в `__init__` (`minvalue`, `maxvalue`, допустимі варіанти). Один *клас* дескриптора обслуговує багато атрибутів, і кожен атрибут має власний *екземпляр* дескриптора.
- `Number` явно відкидає `True`: `bool` — підклас `int`, тож `isinstance(True, int)` дорівнює `True`, і без цієї перевірки вік `True` прийняли б як `1`.
- `Employee` читається як специфікація. Саме в такому декларативному стилі ORM (моделі Django, SQLAlchemy) і бібліотеки валідації описують поля.

## Де дескриптор зберігає значення

На кожен атрибут припадає **один** об'єкт дескриптора, спільний для всіх екземплярів класу. Тому дескриптор не повинен тримати дані окремих екземплярів у власних атрибутах. Звичні варіанти:

| Де | Як | Примітки |
|---|---|---|
| `__dict__` екземпляра, те саме ім'я | `instance.__dict__[self.name] = value` | Просто й швидко. Працює лише для дескрипторів даних (дескриптор не-даних запис затінив би) і лише для класів, що мають `__dict__`. |
| Атрибут екземпляра з іншим ім'ям | `setattr(instance, "_" + self.name, value)` | Працює з `__slots__`, якщо приватне ім'я є слотом. Значення видно як `obj._name`. |
| Словник усередині дескриптора | `self.values[instance] = value` з `weakref.WeakKeyDictionary` | Екземпляр лишається недоторканим, але екземпляри мають бути хешованими й підтримувати слабкі посилання. Звичайний `dict` тримав би кожен екземпляр живим назавжди. |
| Власний атрибут дескриптора | `self.value = value` | **Неправильно**: одне значення на всі екземпляри (див. «Типові помилки»). |

Варіант із приватним ім'ям працює навіть для класів із `__slots__`, у яких `__dict__` екземпляра взагалі немає:

```python
class RequiredString:
    def __set_name__(self, owner, name):
        self.name = name
        self.private_name = "_" + name  # де насправді живе значення

    def __get__(self, instance, owner):
        if instance is None:
            return self
        return getattr(instance, self.private_name)

    def __set__(self, instance, value):
        if not isinstance(value, str) or not value:
            raise ValueError(f"{self.name} must be a non-empty string")
        setattr(instance, self.private_name, value)


class Tag:
    __slots__ = ("_label",)  # немає __dict__, лише слот для справжнього значення
    label = RequiredString()

    def __init__(self, label):
        self.label = label


tag = Tag("python")
print(tag.label, tag._label)
print(hasattr(tag, "__dict__"))
```

Результат:

```text
python python
False
```

## Дескриптори, якими ви вже користуєтеся

Дескриптори — не екзотика, а спосіб, у який Python реалізує кілька щоденних інструментів. Кожен із цих об'єктів, як він зберігається в класі, має метод `__get__`:

```python
class Demo:
    __slots__ = ("slot",)

    def method(self):
        pass

    @property
    def prop(self):
        return 42

    @classmethod
    def cmethod(cls):
        pass

    @staticmethod
    def smethod():
        pass


for name in ("slot", "method", "prop", "cmethod", "smethod"):
    raw = vars(Demo)[name]  # об'єкт, що зберігається в класі, без змін
    print(f"{name:8} {type(raw).__name__:18} has __get__: {hasattr(type(raw), '__get__')}")
```

Результат:

```text
slot     member_descriptor  has __get__: True
method   function           has __get__: True
prop     property           has __get__: True
cmethod  classmethod        has __get__: True
smethod  staticmethod       has __get__: True
```

- `property` — дескриптор даних, чиї `__get__`, `__set__` і `__delete__` викликають передані йому функції (вправа 4 відтворює його).
- Кожна звичайна функція — дескриптор не-даних: її `__get__` перетворює `obj.method` на *зв'язаний метод* (bound method), у якому `obj` уже підставлено як `self`.
- `classmethod` і `staticmethod` — дескриптори, чий `__get__` прив'язує клас або взагалі нічого.
- Кожне ім'я з `__slots__` стає дескриптором `member_descriptor`, що читає й записує фіксований слот у пам'яті об'єкта (див. тему `__slots__`).

Наступна тема показує, як різниця між дескрипторами даних і не-даних пояснює поведінку кожного з них.

## Типові помилки

- **Зберігати значення в самому дескрипторі.** Дескриптор створюється один раз на клас, тож його атрибути спільні для всіх екземплярів:

  ```python
  class Positive:
      def __get__(self, instance, owner):
          return self.value

      def __set__(self, instance, value):
          if value <= 0:
              raise ValueError("must be positive")
          self.value = value  # ПОМИЛКА: значення в дескрипторі, спільне для всіх екземплярів


  class Account:
      balance = Positive()


  first = Account()
  second = Account()
  first.balance = 100
  second.balance = 5
  print(first.balance, second.balance)
  ```

  Результат:

  ```text
  5 5
  ```

  Дані окремого екземпляра зберігайте в самому екземплярі, під ім'ям атрибута:

  ```python
  class Positive:
      def __set_name__(self, owner, name):
          self.name = name

      def __get__(self, instance, owner):
          if instance is None:
              return self
          return instance.__dict__[self.name]

      def __set__(self, instance, value):
          if value <= 0:
              raise ValueError(f"{self.name} must be positive")
          instance.__dict__[self.name] = value  # кожен екземпляр має власне значення


  class Account:
      balance = Positive()


  first = Account()
  second = Account()
  first.balance = 100
  second.balance = 5
  print(first.balance, second.balance)
  ```

  Результат:

  ```text
  100 5
  ```

- **Розміщувати дескриптор в екземплярі.** Протокол працює лише для дескрипторів, знайдених у **класі** (або в його базових класах). Дескриптор в атрибуті екземпляра — просто значення:

  ```python
  class Upper:
      """Повертає збережений текст великими літерами."""

      def __get__(self, instance, owner):
          if instance is None:
              return self
          return instance._text.upper()


  class Banner:
      title = Upper()  # атрибут класу: працює

      def __init__(self, text):
          self._text = text
          self.subtitle = Upper()  # ПОМИЛКА: атрибут екземпляра — просто значення


  banner = Banner("sale")
  print(banner.title)
  print(type(banner.subtitle).__name__)
  ```

  Результат:

  ```text
  SALE
  Upper
  ```

- **Забути `if instance is None: return self`.** Тоді читання атрибута через клас (`City.name`, `help(City)`, інструменти документування) завершується незрозумілою помилкою:

  ```python
  class Name:
      def __set_name__(self, owner, name):
          self.name = name

      def __get__(self, instance, owner):
          return instance.__dict__[self.name]  # ПОМИЛКА: немає перевірки instance is None

      def __set__(self, instance, value):
          instance.__dict__[self.name] = value


  class City:
      name = Name()


  try:
      City.name
  except AttributeError as error:
      print("AttributeError:", error)
  ```

  Результат:

  ```text
  AttributeError: 'NoneType' object has no attribute '__dict__'
  ```

- **Генерувати `KeyError` (або повертати `None`) для неприсвоєного атрибута.** Генеруйте `AttributeError`, щоб `hasattr()` і `getattr(obj, name, default)` поводилися правильно.
- **Додавати дескриптор уже після створення класу.** `__set_name__` викликається автоматично лише під час виконання інструкції `class`. Дескриптор, доданий пізніше, так і не дізнається свого імені:

  ```python
  class RequiredString:
      def __set_name__(self, owner, name):
          self.name = name

      def __get__(self, instance, owner):
          if instance is None:
              return self
          return instance.__dict__[self.name]

      def __set__(self, instance, value):
          if not isinstance(value, str) or not value:
              raise ValueError(f"{self.name} must be a non-empty string")
          instance.__dict__[self.name] = value


  class Person:
      pass


  Person.nickname = RequiredString()  # додано ПІСЛЯ створення класу
  person = Person()
  try:
      person.nickname = "max"
  except AttributeError as error:
      print("AttributeError:", error)

  Person.nickname.__set_name__(Person, "nickname")  # робимо роботу Python вручну
  person.nickname = "max"
  print(person.nickname)
  ```

  Результат:

  ```text
  AttributeError: 'RequiredString' object has no attribute 'name'
  max
  ```

- **Використовувати `instance.__dict__` у класі з `__slots__`.** Такі екземпляри не мають `__dict__`. Зберігайте значення під приватним ім'ям слота через `setattr()`.

## Підсумок

- Дескриптор — об'єкт, чий клас визначає `__get__`, `__set__` та/або `__delete__`. Він працює, коли є **атрибутом класу** іншого класу.
- `__set_name__(owner, name)` викликається один раз, коли створюється клас-власник, щоб дескриптор дізнався ім'я свого атрибута.
- `obj.attr` викликає `__get__(obj, type(obj))`, `Owner.attr` — `__get__(None, Owner)`, `obj.attr = v` — `__set__(obj, v)`, а `del obj.attr` — `__delete__(obj)`.
- Коли `instance` дорівнює `None`, повертайте з `__get__` сам дескриптор, а за відсутнього значення генеруйте `AttributeError` (а не `KeyError`).
- Один об'єкт дескриптора обслуговує всі екземпляри, тому значення окремих екземплярів належать екземпляру (його `__dict__` чи приватному атрибуту), а не дескриптору.
- Базовий клас-валідатор з абстрактним `validate()` перетворює правила для полів на дескриптори, які можна повторно використовувати й налаштовувати.
- `property`, функції (методи), `classmethod`, `staticmethod` і `__slots__` побудовано на дескрипторах.

## Практика

### Вправа 1: Простежте виклики

Не запускаючи код, запишіть усе, що він виведе. Потім запустіть і порівняйте.

```python
class Traced:
    def __set_name__(self, owner, name):
        print(f"set_name {name}")
        self.name = name

    def __get__(self, instance, owner):
        print(f"get {self.name} (instance is None: {instance is None})")
        if instance is None:
            return self
        return instance.__dict__.get(self.name, "?")

    def __set__(self, instance, value):
        print(f"set {self.name} = {value!r}")
        instance.__dict__[self.name] = value


print("start")


class Point:
    x = Traced()
    y = Traced()

    def __init__(self, x):
        self.x = x


p = Point(3)
print(p.x + 1)
print(p.y)
print(type(Point.x).__name__)
```

### Вправа 2: Додатні числа

Напишіть дескриптор `PositiveNumber`, який приймає лише значення типу `int` чи `float`, більші за нуль. Неправильний тип має генерувати `TypeError`, недодатне число — `ValueError`, і обидва повідомлення мають називати атрибут. Значення `bool` треба відкидати. Використайте дескриптор для `price` і `quantity` у класі `Product(title, price, quantity)` із властивістю лише для читання `total`. Покажіть, що невдалі присвоєння не псують попередніх значень.

### Вправа 3: Типізовані атрибути зі значеннями за замовчуванням

Напишіть дескриптор `Typed(kind, default=...)`:

- присвоєння значення, яке не є екземпляром `kind`, генерує `TypeError`;
- читання атрибута, якому нічого не присвоювали, повертає `default` або генерує `AttributeError`, якщо значення за замовчуванням не задано;
- `del obj.attr` видаляє збережене значення, тож знову стає видно значення за замовчуванням; видалення неприсвоєного атрибута генерує `AttributeError`.

Використайте його в класі `Config` з `host = Typed(str)`, `port = Typed(int, default=8080)` і `debug = Typed(bool, default=False)`. Зважте, що `None` теж має бути допустимим значенням за замовчуванням, тож для позначки «значення за замовчуванням немає» потрібен інший спосіб.

### Вправа 4: Власна property

Напишіть клас `MyProperty`, що працює як спрощена вбудована `property`: приймає функції `fget`, `fset` і `fdel`, може використовуватися як декоратор і має метод `setter()`, щоб працював запис `@radius.setter`. Відсутні функції мають генерувати `AttributeError` зі зрозумілим повідомленням. Перевірте його на класі `Circle` з перевіреним `radius` і доступним лише для читання `diameter`.

## Розв'язки

### Вправа 1

Результат:

```text
start
set_name x
set_name y
set x = 3
get x (instance is None: False)
4
get y (instance is None: False)
?
get x (instance is None: True)
Traced
```

- Обидва рядки `set_name` з'являються під час виконання інструкції `class Point:`, ще до створення будь-якого об'єкта.
- `Point(3)` виконує `__init__`, і `self.x = x` проходить крізь `__set__`.
- `p.y` ніхто не присвоював, тож `__get__` не знаходить ключа `"y"` у словнику екземпляра, і `.get(self.name, "?")` повертає запасне значення.
- `Point.x` викликає `__get__` з `instance=None`, а той повертає сам дескриптор, тому його тип — `Traced`.

### Вправа 2

```python
class PositiveNumber:
    def __set_name__(self, owner, name):
        self.name = name

    def __get__(self, instance, owner):
        if instance is None:
            return self
        try:
            return instance.__dict__[self.name]
        except KeyError:
            raise AttributeError(self.name) from None

    def __set__(self, instance, value):
        # bool — підклас int, але True не годиться на роль ціни
        if isinstance(value, bool) or not isinstance(value, (int, float)):
            raise TypeError(f"{self.name} must be a number, not {type(value).__name__}")
        if value <= 0:
            raise ValueError(f"{self.name} must be positive, got {value}")
        instance.__dict__[self.name] = value


class Product:
    price = PositiveNumber()
    quantity = PositiveNumber()

    def __init__(self, title, price, quantity):
        self.title = title
        self.price = price
        self.quantity = quantity

    @property
    def total(self):
        return self.price * self.quantity


laptop = Product("Laptop", 999.5, 2)
print(laptop.total)

for field, value in [("price", 0), ("quantity", -3), ("price", "10"), ("quantity", True)]:
    try:
        setattr(laptop, field, value)
    except (TypeError, ValueError) as error:
        print(f"{type(error).__name__}: {error}")

print(laptop.price, laptop.quantity)
```

Результат:

```text
1999.0
ValueError: price must be positive, got 0
ValueError: quantity must be positive, got -3
TypeError: price must be a number, not str
TypeError: quantity must be a number, not bool
999.5 2
```

Значення зберігається лише після того, як пройдено обидві перевірки, тож невдале присвоєння ніколи не псує об'єкт. `setattr(laptop, "price", 0)` — те саме, що `laptop.price = 0`, тому теж проходить крізь дескриптор.

### Вправа 3

```python
_MISSING = object()  # унікальна позначка: «значення за замовчуванням не задано»


class Typed:
    def __init__(self, kind, default=_MISSING):
        self.kind = kind
        self.default = default

    def __set_name__(self, owner, name):
        self.name = name

    def __get__(self, instance, owner):
        if instance is None:
            return self
        if self.name in instance.__dict__:
            return instance.__dict__[self.name]
        if self.default is not _MISSING:
            return self.default
        raise AttributeError(f"{self.name} is not set")

    def __set__(self, instance, value):
        if not isinstance(value, self.kind):
            raise TypeError(
                f"{self.name} must be {self.kind.__name__}, not {type(value).__name__}"
            )
        instance.__dict__[self.name] = value

    def __delete__(self, instance):
        try:
            del instance.__dict__[self.name]
        except KeyError:
            raise AttributeError(f"{self.name} is not set") from None


class Config:
    host = Typed(str)
    port = Typed(int, default=8080)
    debug = Typed(bool, default=False)


config = Config()
print(config.port, config.debug)
try:
    config.host
except AttributeError as error:
    print("AttributeError:", error)

config.host = "localhost"
config.port = 9000
print(config.host, config.port)

try:
    config.port = "9000"
except TypeError as error:
    print("TypeError:", error)

del config.port
print(config.port)
try:
    del config.port
except AttributeError as error:
    print("AttributeError:", error)
```

Результат:

```text
8080 False
AttributeError: host is not set
localhost 9000
TypeError: port must be int, not str
8080
AttributeError: port is not set
```

Приватний об'єкт-позначка (sentinel) `_MISSING` відрізняє «значення за замовчуванням немає» від «значення за замовчуванням — `None`». Значення за замовчуванням зберігається в дескрипторі, і це нормально: воно однакове для всіх екземплярів і ніколи не змінюється. Пам'ятайте, що `isinstance(True, int)` дорівнює `True`, тож `config.port = True` пройде перевірку. Якщо це важливо, додайте явну перевірку на `bool`.

### Вправа 4

```python
class MyProperty:
    """Спрощена версія вбудованої property на чистому Python."""

    def __init__(self, fget=None, fset=None, fdel=None):
        self.fget = fget
        self.fset = fset
        self.fdel = fdel

    def __set_name__(self, owner, name):
        self.name = name

    def __get__(self, instance, owner=None):
        if instance is None:
            return self
        if self.fget is None:
            raise AttributeError(f"property {self.name!r} has no getter")
        return self.fget(instance)

    def __set__(self, instance, value):
        if self.fset is None:
            raise AttributeError(f"property {self.name!r} has no setter")
        self.fset(instance, value)

    def __delete__(self, instance):
        if self.fdel is None:
            raise AttributeError(f"property {self.name!r} has no deleter")
        self.fdel(instance)

    def setter(self, fset):
        # повертаємо НОВИЙ дескриптор, як це робить і вбудована property
        return type(self)(self.fget, fset, self.fdel)


class Circle:
    def __init__(self, radius):
        self.radius = radius

    @MyProperty
    def radius(self):
        return self._radius

    @radius.setter
    def radius(self, value):
        if value < 0:
            raise ValueError("radius cannot be negative")
        self._radius = value

    @MyProperty
    def diameter(self):
        return self.radius * 2


circle = Circle(5)
print(circle.radius, circle.diameter)
circle.radius = 7
print(circle.diameter)

try:
    circle.radius = -1
except ValueError as error:
    print("ValueError:", error)

try:
    circle.diameter = 20
except AttributeError as error:
    print("AttributeError:", error)

print(type(Circle.radius).__name__)
```

Результат:

```text
5 10
14
ValueError: radius cannot be negative
AttributeError: property 'diameter' has no setter
MyProperty
```

`@MyProperty` над `def radius` означає `radius = MyProperty(radius)`. `@radius.setter` викликає метод `setter()` цього об'єкта, той повертає новий дескриптор з обома функціями, і саме цей новий об'єкт займає місце `radius` у тілі класу. `diameter` не має сетера, але `MyProperty` однаково визначає `__set__`, тож це дескриптор даних: присвоєння доходить до `__set__` і отримує відмову, а не тихо створює атрибут екземпляра. Вбудована `property` поводиться так само.

---

*Джерело: [pythontutorial.net — Python Descriptors](https://www.pythontutorial.net/python-oop/python-descriptors/). Адаптовано й доповнено для PyJourney.*
