# Приватні атрибути

**Інкапсуляція** (encapsulation) означає, що об'єкт сам відповідає за свій стан, а зовнішній код змінює цей стан лише через методи об'єкта. Багато мов забезпечують це полями `private`. Python так не робить: до кожного атрибута можна дістатися ззовні. Натомість Python пропонує дві домовленості щодо назв: одне підкреслення на початку і два підкреслення на початку. У цій темі розглянемо обидві, що вони насправді роблять і коли яку використовувати.

## Що ви дізнаєтесь

- Що таке інкапсуляція та приховування інформації і чому це важливо
- Як необмежений доступ до атрибута може перевести об'єкт у некоректний стан
- Що означає одне підкреслення на початку назви (`_attr`)
- Як крок за кроком працює спотворення імен (name mangling) для двох підкреслень на початку (`__attr`)
- Для чого насправді потрібне спотворення імен: щоб уникати конфліктів назв у підкласах
- Як властивість лише для читання безпечно відкриває внутрішній стан

## Інкапсуляція та приховування інформації

Інкапсуляція — одна з чотирьох ключових ідей об'єктно-орієнтованого програмування поряд з абстракцією, успадкуванням і поліморфізмом. Вона означає **поєднання даних із методами, що з цими даними працюють**, в одне ціле — об'єкт. Природний приклад — клас: він об'єднує атрибути й методи та надає доступ до своїх даних через методи.

З нею тісно пов'язане **приховування інформації** (information hiding): внутрішній стан тримають поза досяжністю зовнішнього коду. Якщо сторонній код може змінювати стан лише через методи, клас здатен перевіряти кожну зміну й гарантувати, що об'єкт завжди коректний. Правила на кшталт «лічильник ніколи не буває від'ємним» називають **інваріантами** об'єкта, а інкапсуляція — це спосіб, у який клас їх захищає.

## Приклад: лічильник

```python
class Counter:
    def __init__(self):
        self.current = 0

    def increment(self):
        self.current += 1

    def value(self):
        return self.current

    def reset(self):
        self.current = 0


counter = Counter()
counter.increment()
counter.increment()
counter.increment()
print(counter.value())
```

Результат:

```text
3
```

Клас має один атрибут, `current`, що починається з нуля, і три методи:

- `increment()` збільшує `current` на одиницю;
- `value()` повертає поточне значення лічильника;
- `reset()` знову встановлює `current` у нуль.

Усе працює, але ніщо не заважає зовнішньому коду обійти методи й записати будь-яке значення:

```python
class Counter:
    def __init__(self):
        self.current = 0

    def increment(self):
        self.current += 1

    def value(self):
        return self.current

    def reset(self):
        self.current = 0


counter = Counter()
counter.increment()
counter.increment()
counter.current = -999
print(counter.value())
```

Результат:

```text
-999
```

Лічильник, який двічі збільшився, тепер показує `-999`. Інваріант «ніколи не від'ємний» порушено, і клас `Counter` не мав жодної змоги цьому запобігти. Як же вберегти `current` від зовнішнього коду?

## У Python немає по-справжньому приватних атрибутів

У Java чи C# поле `private` доступне лише з методів власного класу, і це перевіряє компілятор. У Python такого ключового слова немає. **Технічно кожен атрибут доступний ззовні.**

Це свідомий вибір, який часто описують фразою «ми всі тут дорослі люди» (we are all consenting adults here). Python довіряє програмістам поважати чітко позначені межі, а не зводить стіни. А межі позначають домовленостями щодо назв.

## Одне підкреслення: «внутрішнє, не чіпати»

За домовленістю назва, що починається з **одного підкреслення**, є внутрішньою для класу:

```text
_attribute
```

Вона повідомляє іншим програмістам: це деталь реалізації, а не частина публічного інтерфейсу. Не використовуйте її ззовні й не дивуйтеся, якщо в наступній версії вона зміниться чи зникне. Ось лічильник, у якому `current` позначено як внутрішній:

```python
class Counter:
    def __init__(self):
        self._current = 0

    def increment(self):
        self._current += 1

    def value(self):
        return self._current

    def reset(self):
        self._current = 0


counter = Counter()
counter.increment()
print(counter.value())
print(counter._current)  # працює, але ви порушуєте домовленість
```

Результат:

```text
1
1
```

Сам Python нічим не заважає такому доступу. Домовленість працює, бо її поважають люди й інструменти:

- лінтери, як-от pylint, попереджають про `protected-access`, коли код звертається до `_name` іншого об'єкта;
- IDE приховують назви з підкресленням з автодоповнення або показують їх останніми;
- на рівні модуля `from module import *` пропускає назви, що починаються з підкреслення.

## Два підкреслення: спотворення імен

Якщо назва атрибута починається з **двох підкреслень** (і не закінчується двома підкресленнями), Python автоматично перейменовує її всередині класу:

```text
__attribute   стає   _ClassName__attribute
```

Таке перейменування називають **спотворенням імен** (name mangling). Зверніть увагу: підставляється саме *назва класу*, а не слово «class». Ось лічильник з атрибутом із двома підкресленнями:

```python
class Counter:
    def __init__(self):
        self.__current = 0

    def increment(self):
        self.__current += 1

    def value(self):
        return self.__current

    def reset(self):
        self.__current = 0


counter = Counter()
counter.increment()
print(counter.value())
print(vars(counter))
print(counter._Counter__current)
```

Результат:

```text
1
{'_Counter__current': 1}
1
```

Усередині класу ви пишете `self.__current`, а Python непомітно перетворює це на `self._Counter__current`. Саме таку назву й має об'єкт, як показує `vars()`. Звернення за початковою назвою ззовні не спрацює:

```python
class Counter:
    def __init__(self):
        self.__current = 0


counter = Counter()
print(counter.__current)
```

Результат:

```text
Traceback (most recent call last):
  ...
AttributeError: 'Counter' object has no attribute '__current'
```

Проте спотворена назва все одно досяжна, як показав `counter._Counter__current` вище. Спотворення імен ускладнює випадковий доступ, але це **не** механізм безпеки.

### Точні правила

- Спотворення стосується кожного ідентифікатора вигляду `__name`, написаного **всередині тіла класу**, зокрема назв методів і атрибутів інших об'єктів (`other.__secret`), а не лише `self.__attr`.
- Назви, що ще й **закінчуються** двома підкресленнями, як-от `__init__` чи `__len__`, — це спеціальні методи, і їх ніколи не спотворюють.
- Підкреслення на початку назви класу відкидаються: у `class _Vault` назва `__code` стає `_Vault__code`.
- Спотворення виконує компілятор над текстом програми. Рядки не спотворюються, тож `getattr(self, "__code")` усередині класу шукає буквально `"__code"` і не знаходить спотвореного атрибута.

### Пастка: присвоєння ззовні

Оскільки спотворення відбувається лише в тілі класу, присвоєння `obj.__name` ззовні створює **новий, зовсім не пов'язаний** атрибут:

```python
class Counter:
    def __init__(self):
        self.__current = 0

    def value(self):
        return self.__current


counter = Counter()
counter.__current = 100  # поза класом: спотворення немає
print(counter.value())
print(vars(counter))
```

Результат:

```text
0
{'_Counter__current': 0, '__current': 100}
```

Присвоєння «спрацювало» без жодної помилки, але лічильник не змінився. Тепер в об'єкта два атрибути з оманливо схожими назвами.

## Для чого насправді потрібне спотворення імен

Головне призначення спотворення імен — не приховати дані від користувачів, а **уникнути випадкових конфліктів назв між класом і його підкласами**. Уявіть базовий клас із внутрішнім `_id` і підклас, автор якого, не знаючи про це, використовує `_id` для чогось іншого:

```python
class Base:
    def __init__(self):
        self._id = 1

    def base_id(self):
        return self._id


class Child(Base):
    def __init__(self):
        super().__init__()
        self._id = "child-42"  # задумано як власний id класу Child


item = Child()
print(item.base_id())
```

Результат:

```text
child-42
```

Обидва класи зберігають значення під однаковою назвою в одному й тому самому об'єкті, тож дочірній клас непомітно перезаписав дані батьківського. З двома підкресленнями кожен клас отримує власну спотворену назву, і обидва значення співіснують:

```python
class Base:
    def __init__(self):
        self.__id = 1

    def base_id(self):
        return self.__id


class Child(Base):
    def __init__(self):
        super().__init__()
        self.__id = "child-42"

    def child_id(self):
        return self.__id


item = Child()
print(item.base_id(), item.child_id())
print(vars(item))
```

Результат:

```text
1 child-42
{'_Base__id': 1, '_Child__id': 'child-42'}
```

PEP 8 дає просте правило: для непублічних атрибутів використовуйте одне підкреслення, а до двох вдавайтеся лише тоді, коли клас розрахований на успадкування і деякі атрибути не повинні конфліктувати з назвами, які оберуть підкласи.

## Безпечний доступ до внутрішнього стану: властивість лише для читання

Часто потрібно, щоб сторонній код міг **читати** значення, але не **записувати** його. У Python для цього є **властивість** (property). Вона дає змогу звертатися до методу як до атрибута. Властивість без сетера доступна лише для читання:

```python
class Counter:
    def __init__(self):
        self._current = 0

    def increment(self):
        self._current += 1

    def reset(self):
        self._current = 0

    @property
    def value(self):
        return self._current


counter = Counter()
counter.increment()
counter.increment()
print(counter.value)

try:
    counter.value = -999
except AttributeError as error:
    print("AttributeError:", error)
```

Результат:

```text
2
AttributeError: property 'value' of 'Counter' object has no setter
```

Зовнішній код читає `counter.value` як атрибут, але змінити значення лічильника можна лише через `increment()` і `reset()`. Внутрішній `_current` технічно все ще досяжний, проте публічний інтерфейс тепер чітко показує, як слід користуватися об'єктом. Властивостям, зокрема сетерам із перевіркою значень, присвячено окрему тему далі.

## Типові помилки

- **Вважати підкреслення засобом безпеки.** Будь-хто може прочитати `obj._secret` або `obj._ClassName__secret`. Ніколи не покладайтеся на домовленості щодо назв для захисту паролів, токенів чи інших чутливих даних.

- **Присвоювати `obj.__name` поза класом.** Так створюється окремий атрибут, а справжній (спотворений) лишається незмінним, і жодної помилки при цьому немає.

- **Використовувати два підкреслення за замовчуванням.** Спотворені назви ускладнюють успадкування й налагодження. Підклас не може дістатися до батьківського `__attr` через `self.__attr`, бо всередині підкласу ця назва спотворюється з назвою *підкласу*:

  ```python
  class Counter:
      def __init__(self):
          self.__current = 0


  class LoudCounter(Counter):
      def shout(self):
          return f"COUNT: {self.__current}"


  LoudCounter().shout()
  ```

  Результат:

  ```text
  Traceback (most recent call last):
    ...
  AttributeError: 'LoudCounter' object has no attribute '_LoudCounter__current'. Did you mean: '_Counter__current'?
  ```

  Підказка в повідомленні показує обидві спотворені назви поруч. Якщо підкласи мають користуватися атрибутом, правильний вибір — одне підкреслення.

- **Покладатися на `_internal`-назви сторонніх об'єктів.** Вони не є частиною публічного інтерфейсу бібліотеки й можуть змінитися в будь-якому випуску.

- **Плутати `__name` з `__name__`.** Два підкреслення на початку вмикають спотворення. Два підкреслення на початку *й* у кінці позначають спеціальні (dunder) назви, зарезервовані для Python. Не вигадуйте власних назв у стилі `__name__`.

## Підсумок

- Інкапсуляція поєднує дані з методами, що з ними працюють, і дає класу змогу захищати свій стан. Приховування інформації тримає внутрішні деталі подалі від зовнішнього коду.
- У Python немає примусово приватних атрибутів. До кожного атрибута можна дістатися ззовні.
- Одне підкреслення на початку (`_attr`) — домовленість, що означає «внутрішнє, не частина публічного інтерфейсу».
- Два підкреслення на початку (`__attr`) у тілі класу перетворюються на `_ClassName__attr` (спотворення імен). За цією назвою атрибут і далі доступний.
- Спотворення імен існує передусім для того, щоб запобігати випадковим конфліктам назв між класом і його підкласами. Це не механізм безпеки.
- Віддавайте перевагу одному підкресленню. Використовуйте властивість лише для читання, щоб сторонній код міг читати внутрішній стан, але не змінювати його.

## Практика

### Вправа 1: Захищений банківський рахунок

Напишіть клас `BankAccount`, який зберігає баланс у `_balance` (спочатку 0). Додайте:

- `deposit(amount)`, що генерує `ValueError`, якщо `amount` не додатна;
- `withdraw(amount)`, що генерує `ValueError`, якщо `amount` не додатна або перевищує баланс;
- властивість `balance`, доступну лише для читання.

Покладіть 100, зніміть 40 і виведіть баланс. Потім покажіть, що `account.balance = 1_000_000` не спрацьовує, а `account.withdraw(500)` відхиляється.

### Вправа 2: Передбачте результат

Запишіть, що виведе кожен рядок, а потім запустіть код.

```python
class Safe:
    def __init__(self):
        self.__code = 1234

    def code(self):
        return self.__code


safe = Safe()
safe.__code = 0
print(safe.code())
print(safe.__code)
print(safe._Safe__code)
print(sorted(vars(safe)))
```

### Вправа 3: Знайдіть спотворену назву

Назва класу нижче починається з підкреслення. Не підглядаючи в розв'язок, передбачте, під якою назвою зберігається `__code`. Потім перевірте це через `vars()`, прочитайте значення за спотвореною назвою й поясніть, що повертає `reveal()`.

```python
class _Vault:
    def __init__(self):
        self.__code = 1234

    def reveal(self):
        return getattr(self, "__code", "not found")


vault = _Vault()
```

### Вправа 4: Усуньте конфлікт

`Widget` і його підклас `Button` обидва зберігають щось під назвою `_state`, і програма падає. Поясніть чому, а потім виправте це за допомогою спотворення імен, щоб кожен клас мав власний стан. Після виправлення програма має виводити `widget is running` і `pressed: True`.

```python
class Widget:
    def __init__(self):
        self._state = "idle"

    def start(self):
        self._state = "running"

    def status(self):
        return f"widget is {self._state}"


class Button(Widget):
    def __init__(self, label):
        super().__init__()
        self.label = label
        self._state = {"pressed": False}

    def press(self):
        self._state["pressed"] = True

    def is_pressed(self):
        return self._state["pressed"]


button = Button("OK")
button.start()
button.press()
print(button.status())
print("pressed:", button.is_pressed())
```

## Розв'язки

### Вправа 1

```python
class BankAccount:
    def __init__(self):
        self._balance = 0

    def deposit(self, amount):
        if amount <= 0:
            raise ValueError("deposit must be positive")
        self._balance += amount

    def withdraw(self, amount):
        if amount <= 0:
            raise ValueError("withdrawal must be positive")
        if amount > self._balance:
            raise ValueError("insufficient funds")
        self._balance -= amount

    @property
    def balance(self):
        return self._balance


account = BankAccount()
account.deposit(100)
account.withdraw(40)
print(account.balance)

try:
    account.balance = 1_000_000
except AttributeError as error:
    print("AttributeError:", error)

try:
    account.withdraw(500)
except ValueError as error:
    print("ValueError:", error)

print(account.balance)
```

Результат:

```text
60
AttributeError: property 'balance' of 'BankAccount' object has no setter
ValueError: insufficient funds
60
```

### Вправа 2

Результат:

```text
1234
0
1234
['_Safe__code', '__code']
```

`safe.__code = 0` виконується поза класом, тож назва не спотворюється, і з'являється новий атрибут, що буквально називається `__code`. Метод `code()` читає спотворений `_Safe__code`, де й далі лежить `1234`.

### Вправа 3

```python
class _Vault:
    def __init__(self):
        self.__code = 1234

    def reveal(self):
        return getattr(self, "__code", "not found")


vault = _Vault()
print(vars(vault))
print(vault._Vault__code)
print(vault.reveal())
```

Результат:

```text
{'_Vault__code': 1234}
1234
not found
```

Підкреслення на початку назви класу відкидається, тож спотворена назва — `_Vault__code`, а не `__Vault__code`. `reveal()` повертає `"not found"`, бо рядок `"__code"` не спотворюється: `getattr()` шукає атрибут, що буквально називається `__code`, а такого немає.

### Вправа 4

Обидва класи зберігають дані в одному й тому самому атрибуті одного об'єкта. `Button.__init__` замінює віджетове `"idle"` на словник, потім `start()` замінює словник на рядок `"running"`, і `press()` падає з `TypeError: 'str' object does not support item assignment`. З двома підкресленнями кожен клас отримує власний спотворений атрибут:

```python
class Widget:
    def __init__(self):
        self.__state = "idle"

    def start(self):
        self.__state = "running"

    def status(self):
        return f"widget is {self.__state}"


class Button(Widget):
    def __init__(self, label):
        super().__init__()
        self.label = label
        self.__state = {"pressed": False}

    def press(self):
        self.__state["pressed"] = True

    def is_pressed(self):
        return self.__state["pressed"]


button = Button("OK")
button.start()
button.press()
print(button.status())
print("pressed:", button.is_pressed())
print(vars(button))
```

Результат:

```text
widget is running
pressed: True
{'_Widget__state': 'running', 'label': 'OK', '_Button__state': {'pressed': True}}
```

---

*Джерело: [pythontutorial.net — Python Private Attributes](https://www.pythontutorial.net/python-oop/python-private-attributes/). Адаптовано й доповнено для PyJourney.*
