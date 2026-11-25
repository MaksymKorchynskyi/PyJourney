# Статичні методи

**Статичний метод** (static method) — це функція, що живе всередині класу, але не отримує автоматично ні екземпляра, ні класу. Він не бачить стану об'єкта, якщо цей об'єкт не передати йому явно, проте його згруповано з класом, бо логічно він належить саме туди. Тема «Об'єктно-орієнтоване програмування в Python» лише кількома рядками познайомила з `@staticmethod`. Тут розглянемо, як він працює, чим відрізняється від методів екземпляра та методів класу і коли статичний метод — правильний інструмент.

## Що ви дізнаєтесь

- Як визначити статичний метод за допомогою `@staticmethod` і викликати його через клас або через екземпляр
- Що насправді робить `@staticmethod`: вимикає автоматичну передачу першого аргументу
- Чим статичні методи відрізняються від методів екземпляра та методів класу
- Чому статичний метод мусить називати клас на ім'я, щоб дістатися до інших його членів, і коли через це краще обрати метод класу
- Типові застосування: допоміжні функції класу та групи пов'язаних утиліт
- Коли звичайна функція в модулі краща за статичний метод

## Визначення та виклик статичного методу

Поставте декоратор `@staticmethod` над функцією, визначеною в класі. Функція не має параметра `self` чи `cls`, лише ті аргументи, які їй справді потрібні:

```text
class ClassName:
    @staticmethod
    def static_method_name(param_list):
        ...
```

Викликайте його через клас: `ClassName.static_method_name(...)`. Виклик через екземпляр теж працює й передає ті самі аргументи:

```python
class TemperatureConverter:
    @staticmethod
    def celsius_to_fahrenheit(c):
        return 9 * c / 5 + 32


print(TemperatureConverter.celsius_to_fahrenheit(35))  # через клас

converter = TemperatureConverter()
print(converter.celsius_to_fahrenheit(100))  # через екземпляр: теж працює
```

Результат:

```text
95.0
212.0
```

Результати мають тип `float`, бо `/` завжди повертає `float`. Звичний стиль — виклик через клас: він одразу показує читачеві, що жоден об'єкт тут не задіяний.

## Що насправді робить `@staticmethod`

Тема «Методи екземпляра» показала, що функція, до якої звертаються **через екземпляр**, стає **зв'язаним методом** (bound method), і екземпляр передається як перший аргумент. `@staticmethod` це вимикає. Порівняйте звичайну функцію зі статичним методом:

```python
class Demo:
    def plain(x):
        return x

    @staticmethod
    def static(x):
        return x


d = Demo()
print(Demo.plain(5), Demo.static(5), d.static(5))
print(Demo.static)
print(d.static)
print(d.plain)
print(type(Demo.__dict__["plain"]))
print(type(Demo.__dict__["static"]))

try:
    d.plain(5)
except TypeError as error:
    print("TypeError:", error)
```

Результат (адреси щоразу інші):

```text
5 5 5
<function Demo.static at 0x100a09170>
<function Demo.static at 0x100a09170>
<bound method Demo.plain of <__main__.Demo object at 0x1009d9160>>
<class 'function'>
<class 'staticmethod'>
TypeError: Demo.plain() takes 1 positional argument but 2 were given
```

- Через клас працюють обидві, бо функція, до якої звертаються через її клас, — просто функція.
- Через екземпляр `d.plain` — це зв'язаний метод: `d.plain(5)` перетворюється на `Demo.plain(d, 5)`, тобто на один аргумент більше.
- `d.static` — це **сама звичайна функція**, той самий об'єкт, що й `Demo.static`. Екземпляр не підставляється, тож `d.static(5)` — це просто `static(5)`.
- У `__dict__` класу зберігається об'єкт `staticmethod`, що обгортає функцію. Під час пошуку атрибута ця обгортка повертає початкову функцію, не зв'язуючи її з екземпляром. Такий механізм називається **дескриптором** (descriptor), і докладно про нього йдеться в одному з подальших розділів курсу.

Починаючи з Python 3.10, об'єкт `staticmethod` сам по собі можна викликати, тож статичним методом можна скористатися навіть у тілі класу, наприклад щоб обчислити атрибут класу:

```python
class Config:
    @staticmethod
    def normalize(name):
        return name.strip().lower()

    DEFAULT_ENV = normalize("  Production ")  # Python 3.10+


print(Config.DEFAULT_ENV)
print(Config.normalize("  Staging"))
```

Результат:

```text
production
staging
```

У тілі класу `normalize` — це ще «сирий» об'єкт `staticmethod`, а не атрибут готового класу. До Python 3.10 такий виклик завершувався помилкою `TypeError: 'staticmethod' object is not callable`.

## Методи екземпляра, методи класу та статичні методи

У Python є три види методів. Різниця в тому, що автоматично передається як перший аргумент:

| | Метод екземпляра | Метод класу | Статичний метод |
|---|---|---|---|
| Декоратор | немає | `@classmethod` | `@staticmethod` |
| Автоматично отримує | екземпляр (`self`) | клас (`cls`) | нічого |
| Може використовувати стан об'єкта | так | ні | лише якщо об'єкт передали явно |
| Може використовувати стан класу | так, через `self` або `type(self)` | так, через `cls` | лише явно назвавши клас |
| Враховує підкласи | так | так, `cls` — це підклас | ні, вписане ім'я класу не змінюється |
| Типове застосування | поведінка одного об'єкта | альтернативні конструктори, операції над класом загалом | допоміжні функції та утиліти, пов'язані з класом |

Ось клас `Date`, що використовує всі три види:

```python
class Date:
    def __init__(self, year, month, day):
        if not self.is_valid(year, month, day):
            raise ValueError(f"invalid date: {year}-{month}-{day}")
        self.year = year
        self.month = month
        self.day = day

    # метод екземпляра: працює з однією датою
    def iso(self):
        return f"{self.year:04d}-{self.month:02d}-{self.day:02d}"

    # метод класу: альтернативний конструктор
    @classmethod
    def from_string(cls, text):
        year, month, day = map(int, text.split("-"))
        return cls(year, month, day)

    # статичні методи: допоміжні функції, яким не потрібні ні дата, ні клас
    @staticmethod
    def is_leap_year(year):
        return year % 4 == 0 and (year % 100 != 0 or year % 400 == 0)

    @staticmethod
    def is_valid(year, month, day):
        days_in_month = [31, 29 if Date.is_leap_year(year) else 28, 31, 30,
                         31, 30, 31, 31, 30, 31, 30, 31]
        return 1 <= month <= 12 and 1 <= day <= days_in_month[month - 1]


d = Date.from_string("2024-02-29")
print(d.iso())
print(Date.is_leap_year(2024), Date.is_leap_year(1900), Date.is_leap_year(2000))
print(Date.is_valid(2023, 2, 29))

try:
    Date.from_string("2023-02-29")
except ValueError as error:
    print("ValueError:", error)
```

Результат:

```text
2024-02-29
True False True
False
ValueError: invalid date: 2023-2-29
```

- `iso()` потрібні рік, місяць і день **однієї** дати, тож це метод екземпляра.
- `from_string()` має **створити** об'єкт. Він отримує `cls` і викликає `cls(...)`, тож підклас `Date` отримав би екземпляр підкласу.
- `is_leap_year()` та `is_valid()` працюють лише з переданими їм числами. Їм не потрібні ні дата, ні клас, і вони корисні ще **до** того, як з'явиться будь-яка дата: введення користувача можна перевірити через `Date.is_valid(...)`, не створюючи об'єкта. Тому це статичні методи.
- `__init__` викликає `self.is_valid(...)`: статичний метод можна викликати через `self`, як і будь-який інший метод. Проте всередині статичного методу `is_valid()` немає ні `self`, ні `cls`, тож, щоб викликати сусідній метод, йому доводиться назвати клас: `Date.is_leap_year(year)`.

### Статичні методи не знають, який клас їх викликав

Останній пункт має наслідок. Статичний метод, що явно називає свій клас, завжди використовує **саме цей** клас, навіть коли його викликають через підклас. Метод класу отримує справжній клас як `cls`, а метод екземпляра знаходить потрібний клас через `self`:

```python
class Shape:
    @staticmethod
    def name():
        return "shape"

    @staticmethod
    def describe_static():
        return f"I am a {Shape.name()}"  # клас вписано жорстко

    @classmethod
    def describe_class(cls):
        return f"I am a {cls.name()}"  # cls — той клас, через який викликали метод

    def describe_instance(self):
        return f"I am a {self.name()}"  # self знаходить версію підкласу


class Square(Shape):
    @staticmethod
    def name():
        return "square"


print(Square.describe_static())
print(Square.describe_class())
print(Square().describe_instance())
```

Результат:

```text
I am a shape
I am a square
I am a square
```

`Square` перевизначає статичний метод `name()`, і `describe_class()` та `describe_instance()` підхоплюють це перевизначення. `describe_static()` — ні: його написано так, що він викликає `Shape.name()`. Практичне правило: **якщо методу потрібен клас, хай навіть лише для виклику іншого його методу чи створення екземпляра, зробіть його методом класу.** Статичний метод використовуйте лише тоді, коли функції від класу не потрібно нічого.

## Коли використовувати статичні методи

### Допоміжні функції, що належать класу

Функція, яка обслуговує один клас, але не потребує його стану, добре підходить на роль статичного методу. Її легко знайти, її можна викликати без створення об'єкта, а підклас може її перевизначити, якщо методи екземпляра викликають її через `self`:

```python
class Password:
    def __init__(self, text):
        problems = self.problems(text)
        if problems:
            raise ValueError("weak password: " + ", ".join(problems))
        self._text = text

    @staticmethod
    def problems(text):
        found = []
        if len(text) < 8:
            found.append("shorter than 8 characters")
        if not any(ch.isupper() for ch in text):
            found.append("no uppercase letter")
        if not any(ch.isdigit() for ch in text):
            found.append("no digit")
        return found


# перевіряємо поле форми, ще нічого не створюючи
print(Password.problems("hello"))
print(Password.problems("Correct horse 9"))

try:
    Password("hello")
except ValueError as error:
    print(error)
```

Результат:

```text
['shorter than 8 characters', 'no uppercase letter', 'no digit']
[]
weak password: shorter than 8 characters, no uppercase letter, no digit
```

Стандартна бібліотека робить так само. `str.maketrans()` — статичний метод класу `str`: він будує таблицю перекодування й не потребує жодного конкретного рядка:

```python
table = str.maketrans("abc", "xyz")
print("aabbcc".translate(table))         # xxyyzz
print(type(str.__dict__["maketrans"]))   # <class 'staticmethod'>
```

### Група пов'язаних утиліт

Статичні методи можуть також об'єднувати пов'язані функції під одним іменем. Ось конвертер температур із перетвореннями між шкалами Цельсія, Фаренгейта й Кельвіна та допоміжним методом форматування:

```python
class TemperatureConverter:
    KELVIN = "K"
    FAHRENHEIT = "F"
    CELSIUS = "C"

    @staticmethod
    def celsius_to_fahrenheit(c):
        return 9 * c / 5 + 32

    @staticmethod
    def fahrenheit_to_celsius(f):
        return 5 * (f - 32) / 9

    @staticmethod
    def celsius_to_kelvin(c):
        return c + 273.15

    @staticmethod
    def kelvin_to_celsius(k):
        return k - 273.15

    @staticmethod
    def fahrenheit_to_kelvin(f):
        return 5 * (f + 459.67) / 9

    @staticmethod
    def kelvin_to_fahrenheit(k):
        return 9 * k / 5 - 459.67

    @staticmethod
    def format(value, unit):
        symbol = ""
        if unit == TemperatureConverter.FAHRENHEIT:
            symbol = "°F"
        elif unit == TemperatureConverter.CELSIUS:
            symbol = "°C"
        elif unit == TemperatureConverter.KELVIN:
            symbol = " K"  # кельвіни записують без знака градуса

        return f"{round(value, 2)}{symbol}"


f = TemperatureConverter.celsius_to_fahrenheit(35)
print(TemperatureConverter.format(f, TemperatureConverter.FAHRENHEIT))

k = TemperatureConverter.celsius_to_kelvin(-40)
print(TemperatureConverter.format(k, TemperatureConverter.KELVIN))

c = TemperatureConverter.kelvin_to_celsius(300)
print(c)
print(TemperatureConverter.format(c, TemperatureConverter.CELSIUS))
```

Результат:

```text
95.0°F
233.15 K
26.850000000000023
26.85°C
```

Що варто помітити в цьому класі:

- Назви одиниць — це константи класу, тож викликач пише `TemperatureConverter.FAHRENHEIT` замість голого `"F"`, у якому легко помилитися.
- `format()` читає ці константи, явно називаючи клас, бо статичний метод не має ні `self`, ні `cls`.
- `300 - 273.15` дорівнює `26.850000000000023`, а не `26.85`: більшість десяткових дробів неможливо точно зберегти у двійковому форматі з рухомою комою. `format()` округлює значення до двох знаків для виведення.
- Шкала Кельвіна абсолютна, тому температуру записують як `233.15 K`, без знака градуса.
- Метод з іменем `format` не приховує вбудованої функції `format()`. Це атрибут класу, і дістатися до нього можна лише як `TemperatureConverter.format`.

### ...а може, просто модуль?

У Java чи C# кожна функція мусить жити в класі, тож там поширені «класи-утиліти», повні статичних методів. У Python такого правила немає. **Модуль** уже є простором імен для пов'язаних функцій, і часто простішим:

```python
# temperature.py: модуль — природний простір імен для пов'язаних функцій
def celsius_to_fahrenheit(c):
    return 9 * c / 5 + 32


def fahrenheit_to_celsius(f):
    return 5 * (f - 32) / 9
```

Інший файл використовує його так:

```python
import temperature

print(temperature.celsius_to_fahrenheit(35))  # 95.0
print(temperature.fahrenheit_to_celsius(95))  # 35.0
```

Клас, екземпляри якого ніколи не створюються і який містить лише статичні методи, зазвичай краще переписати як модуль. Статичному методу варто віддати перевагу, коли функція тісно пов'язана з класом, що має екземпляри й стан: вона перевіряє чи готує дані для цього класу, її використовують його методи, або підкласи повинні мати змогу її перевизначити.

## Типові помилки

- **Забути `@staticmethod`.** Без нього функція працює через клас, але падає під час виклику через екземпляр, бо екземпляр передається як зайвий аргумент: `TypeError: Demo.plain() takes 1 positional argument but 2 were given`.
- **Додати `self` за звичкою.** Статичний метод нічого не отримує автоматично, тож `self` поглинає справжній аргумент:

  ```python
  class Greeter:
      @staticmethod
      def greet(self, name):  # self додано за звичкою
          return f"Hello, {name}!"


  print(Greeter().greet("Olena"))
  ```

  Результат:

  ```text
  Traceback (most recent call last):
    ...
  TypeError: Greeter.greet() missing 1 required positional argument: 'name'
  ```

- **Викликати сусідній статичний метод без імені класу.** Тіло класу не є охопною областю видимості для визначених у ньому функцій, тож голе ім'я шукається серед локальних і глобальних імен:

  ```python
  class TemperatureConverter:
      @staticmethod
      def celsius_to_kelvin(c):
          return c + 273.15

      @staticmethod
      def fahrenheit_to_kelvin(f):
          c = 5 * (f - 32) / 9
          return celsius_to_kelvin(c)  # помилка: тіло класу не є областю видимості для методів


  print(TemperatureConverter.fahrenheit_to_kelvin(32))
  ```

  Результат:

  ```text
  Traceback (most recent call last):
    ...
  NameError: name 'celsius_to_kelvin' is not defined
  ```

  Пишіть `TemperatureConverter.celsius_to_kelvin(c)` або перетворіть метод на метод класу й використайте `cls.celsius_to_kelvin(c)`.
- **Використовувати статичний метод як фабрику.** `return Money(...)` усередині статичного методу завжди створює базовий клас, навіть коли його викликано як `Euro.from_string(...)`. Фабрики мають бути методами класу, що викликають `cls(...)` (див. вправу 3).
- **Жорстко вписувати клас там, де треба враховувати підкласи.** Якщо статичному методу потрібно назвати власний клас, найімовірніше, він хоче бути методом класу.
- **Робити статичним те, що потребує об'єкта.** Якщо кожен викликач передає в статичний метод дані, схожі на `self`, це має бути метод екземпляра.
- **Ставити кому після константи.** `KELVIN = "K",` створює кортеж `('K',)`, тож `unit == TemperatureConverter.KELVIN` ніколи не справджується для `"K"`. Кортеж створює кома, а не дужки.
- **Будувати клас лише зі статичних методів.** Якщо в класу немає ні екземплярів, ні стану, модуль простіший.

## Підсумок

- Статичний метод визначають через `@staticmethod`, і він не отримує ні `self`, ні `cls`. Він поводиться як звичайна функція, що зберігається в просторі імен класу.
- Викликайте його через клас (`ClassName.method()`) або через екземпляр чи `self` — з тими самими аргументами.
- `@staticmethod` обгортає функцію в об'єкт `staticmethod`, який запобігає зв'язуванню. Починаючи з Python 3.10, цей об'єкт можна викликати й напряму.
- Методи екземпляра працюють з одним об'єктом, методи класу — з класом (`cls`), статичні методи — лише зі своїми аргументами.
- Статичний метод може дістатися до класу, лише назвавши його, а це ігнорує підкласи. Якщо потрібен клас, використовуйте метод класу.
- Використовуйте статичні методи для допоміжних функцій, що належать класу, і для невеликих груп пов'язаних утиліт. Для самостійних утиліт часто кращий модуль.

## Практика

### Вправа 1: Перевірка перед створенням

Створіть клас `User` зі статичним методом `is_valid_email(email)`, який повертає `True`, коли адреса містить рівно один `@`, частина перед ним не порожня, а частина після нього містить крапку, але не починається й не закінчується нею. `User(name, email)` має генерувати `ValueError` для неправильної адреси. Виведіть результат `is_valid_email()` для `"olena@example.com"`, `"olena.example.com"`, `"@example.com"`, `"a@b"`, `"a@b@c.com"` і `"max@site."`, не створюючи жодного користувача, потім створіть одного коректного користувача й спробуйте створити користувача з адресою `"max@localhost"`.

### Вправа 2: Будь-що в будь-що

Додайте статичний метод `convert(value, from_unit, to_unit)` до класу `TemperatureConverter`, що має чотири перетворення між шкалою Цельсія та двома іншими (`celsius_to_fahrenheit`, `fahrenheit_to_celsius`, `celsius_to_kelvin`, `kelvin_to_celsius`). Одиниці — `"C"`, `"F"` і `"K"`. Перетворюйте у два кроки через шкалу Цельсія, повторно використовуючи наявні методи, і округлюйте результат до двох знаків. Невідома одиниця має спричиняти `ValueError`. Перевірте на 100 C у F, 32 F у K, 0 K у C, -40 F у C і 20 C у C.

### Вправа 3: Виправте фабрику

`Euro.from_string("12.50")` має повертати `Euro`, але повертає звичайний `Money`. Виправте клас. Розбір рядка залиште в статичному допоміжному методі `parse_cents(text)`, що повертає суму в центах, а фабрика має працювати для будь-якого підкласу.

```python
class Money:
    def __init__(self, cents):
        self.cents = cents

    def show(self):
        return f"{self.cents // 100}.{self.cents % 100:02d}"

    @staticmethod
    def from_string(text):
        units, cents = text.split(".")
        return Money(int(units) * 100 + int(cents))


class Euro(Money):
    def show(self):
        return "EUR " + super().show()


price = Euro.from_string("12.50")
print(type(price).__name__, price.show())
```

### Вправа 4: Передбачте результат

Запишіть чотири рядки, які виведе ця програма, а потім запустіть її. Яка одна зміна змусить `SalesReport.title()` повертати `"SALES!"`?

```python
class Report:
    @staticmethod
    def header():
        return "REPORT"

    @staticmethod
    def title():
        return Report.header() + "!"

    def render(self):
        return self.header() + " / " + self.title()


class SalesReport(Report):
    @staticmethod
    def header():
        return "SALES"


r = SalesReport()
print(r.render())
print(SalesReport.title())
print(r.header is SalesReport.header)
print(Report.header())
```

## Розв'язки

### Вправа 1

```python
class User:
    def __init__(self, name, email):
        if not self.is_valid_email(email):
            raise ValueError(f"invalid email: {email!r}")
        self.name = name
        self.email = email

    @staticmethod
    def is_valid_email(email):
        if email.count("@") != 1:
            return False
        local, domain = email.split("@")
        return (
            local != ""
            and "." in domain
            and not domain.startswith(".")
            and not domain.endswith(".")
        )


for address in ["olena@example.com", "olena.example.com", "@example.com",
                "a@b", "a@b@c.com", "max@site."]:
    print(f"{address:<18} {User.is_valid_email(address)}")

user = User("Olena", "olena@example.com")
print(user.name, user.email)

try:
    User("Max", "max@localhost")
except ValueError as error:
    print("ValueError:", error)
```

Результат:

```text
olena@example.com  True
olena.example.com  False
@example.com       False
a@b                False
a@b@c.com          False
max@site.          False
Olena olena@example.com
ValueError: invalid email: 'max@localhost'
```

Перевірці потрібен лише рядок, тож вона статична, і цикл використовує її, не створивши жодного `User`. `__init__` викликає її через `self`, а це дало б змогу підкласу із суворішими правилами її перевизначити. Справжня перевірка адрес електронної пошти значно складніша. На практиці перевіряють загальну форму адреси, а потім надсилають лист із підтвердженням.

### Вправа 2

```python
class TemperatureConverter:
    @staticmethod
    def celsius_to_fahrenheit(c):
        return 9 * c / 5 + 32

    @staticmethod
    def fahrenheit_to_celsius(f):
        return 5 * (f - 32) / 9

    @staticmethod
    def celsius_to_kelvin(c):
        return c + 273.15

    @staticmethod
    def kelvin_to_celsius(k):
        return k - 273.15

    @staticmethod
    def convert(value, from_unit, to_unit):
        tc = TemperatureConverter  # коротке ім'я для класу

        # крок 1: з будь-якої шкали в шкалу Цельсія
        if from_unit == "C":
            celsius = value
        elif from_unit == "F":
            celsius = tc.fahrenheit_to_celsius(value)
        elif from_unit == "K":
            celsius = tc.kelvin_to_celsius(value)
        else:
            raise ValueError(f"unknown unit: {from_unit!r}")

        # крок 2: зі шкали Цельсія в цільову шкалу
        if to_unit == "C":
            result = celsius
        elif to_unit == "F":
            result = tc.celsius_to_fahrenheit(celsius)
        elif to_unit == "K":
            result = tc.celsius_to_kelvin(celsius)
        else:
            raise ValueError(f"unknown unit: {to_unit!r}")

        return round(result, 2)


print(TemperatureConverter.convert(100, "C", "F"))
print(TemperatureConverter.convert(32, "F", "K"))
print(TemperatureConverter.convert(0, "K", "C"))
print(TemperatureConverter.convert(-40, "F", "C"))
print(TemperatureConverter.convert(20, "C", "C"))

try:
    TemperatureConverter.convert(10, "C", "X")
except ValueError as error:
    print("ValueError:", error)
```

Результат:

```text
212.0
273.15
-273.15
-40.0
20
ValueError: unknown unit: 'X'
```

Перетворення через шкалу Цельсія означає по два перетворення на кожну шкалу замість окремого для кожної пари, а нова шкала потребує лише двох нових методів. Останній результат — `20`, а не `20.0`, бо перетворення не відбувалося, і `round(20, 2)` залишає ціле число. Оскільки `convert()` мусить називати клас, щоб викликати сусідні методи, підклас не зміг би підмінити для нього, скажімо, `celsius_to_kelvin()`. Якщо це важливо, зробіть `convert()` методом класу й викликайте `cls.celsius_to_kelvin(...)`.

### Вправа 3

```python
class Money:
    def __init__(self, cents):
        self.cents = cents

    def show(self):
        return f"{self.cents // 100}.{self.cents % 100:02d}"

    @staticmethod
    def parse_cents(text):
        """Turn '12.50' into 1250. A pure helper: needs no class and no object."""
        units, cents = text.split(".")
        return int(units) * 100 + int(cents)

    @classmethod
    def from_string(cls, text):
        return cls(cls.parse_cents(text))  # cls — це Euro, коли викликають Euro.from_string


class Euro(Money):
    def show(self):
        return "EUR " + super().show()


price = Euro.from_string("12.50")
print(type(price).__name__, price.show())
print(Money.from_string("3.05").show())
print(Money.parse_cents("7.99"))
```

Результат:

```text
Euro EUR 12.50
3.05
799
```

Початкова фабрика була статичною й жорстко створювала `Money(...)`, тож не могла знати, що її викликали через `Euro`. Як метод класу вона отримує `cls`, а це `Euro` у першому виклику й `Money` у другому. Розбору рядка нічого не потрібно від класу, тож він лишається статичним.

### Вправа 4

Результат:

```text
SALES / REPORT!
REPORT!
True
REPORT
```

- `render()` викликає `self.header()`, що знаходить `SalesReport.header`, тож перша частина — `SALES`. Потім викликається `self.title()`, тобто успадкований статичний `title()`, а той викликає `Report.header()` на ім'я й дає `REPORT!`.
- `SalesReport.title()` — той самий успадкований статичний метод, тому теж повертає `REPORT!`.
- Через екземпляр чи через клас статичний метод — це той самий об'єкт звичайної функції, тож `r.header is SalesReport.header` дорівнює `True`.
- На `Report.header()` підклас ніяк не впливає.

Щоб `title()` враховував підкласи, перетворіть його на метод класу:

```python
class Report:
    @staticmethod
    def header():
        return "REPORT"

    @classmethod
    def title(cls):
        return cls.header() + "!"

    def render(self):
        return self.header() + " / " + self.title()


class SalesReport(Report):
    @staticmethod
    def header():
        return "SALES"


print(SalesReport().render())
print(SalesReport.title())
```

Результат:

```text
SALES / SALES!
SALES!
```

---

*Джерело: [pythontutorial.net — Python Static Methods](https://www.pythontutorial.net/python-oop/python-static-methods/). Адаптовано й доповнено для PyJourney.*
