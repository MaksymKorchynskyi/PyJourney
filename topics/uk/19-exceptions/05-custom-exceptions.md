# Власні винятки

Вбудовані винятки описують загальні проблеми: погане значення, відсутній ключ, невдала операція з файлом. Проблеми, специфічні для вашої програми, як-от брак коштів, невідомий товар чи температура поза підтримуваним діапазоном, заслуговують на власні назви. Власний клас винятку дає змогу викликачам перехоплювати саме *ваші* помилки, а ще він може нести структуровані дані про те, що пішло не так.

## Що ви дізнаєтесь

- Як визначити власний клас винятку і чому він має успадковуватися від `Exception`
- Як додати атрибути, властивості (property) і власне повідомлення, не зламавши `args` та `str()`
- Як побудувати ієрархію винятків і перехоплювати помилки на різних рівнях
- Коли варто додатково успадковуватися від вбудованого винятку, як-от `ValueError` чи `LookupError`
- Угоди щодо іменування та принципи проєктування
- Пастки: зламаний виклик `super().__init__()`, винятки, які не вдається серіалізувати через pickle, і забагато класів винятків

## Визначення власного винятку

Власний виняток — це звичайний клас, який успадковується від `Exception` (прямо або через один з його підкласів):

```python
class CustomException(Exception):
    """My custom exception class."""


try:
    raise CustomException("This is my custom exception")
except CustomException as ex:
    print(ex)
    print(repr(ex))
    print(ex.args)
```

Результат:

```text
This is my custom exception
CustomException('This is my custom exception')
('This is my custom exception',)
```

Тіло класу містить лише рядок документації (docstring). Docstring — це інструкція, тому `pass` не потрібен. Навіть такий мінімальний клас успадковує від `Exception` усе: `args`, повідомлення, трасування, примітки, ланцюжки через `from`. А оскільки це звичайний клас, до нього можна додати все потрібне:

- атрибути й властивості з подробицями помилки;
- методи, наприклад для форматування помилки для журналу чи інтерфейсу користувача;
- власні `__str__` і `__repr__`;
- будь-що інше, що може мати звичайний клас.

Дві угоди стосуються майже кожного власного винятку:

- **Успадковуйтеся від `Exception`, а не від `BaseException`.** Загальні обробники пишуть як `except Exception`, і вони мають перехоплювати ваші помилки. `BaseException` зарезервовано для `SystemExit`, `KeyboardInterrupt` та інших сигналів, які не є помилками програми (див. тему *Exceptions*).
- **Закінчуйте назву на `Error`**, як радить PEP 8: `InsufficientFundsError`, `ProductNotFoundError`. (Назву `CustomException` вище взято з оригінального посібника. У реальному коді віддавайте перевагу суфіксу `Error`.)

## Додавання даних до винятку

Головна перевага власного винятку в тому, що він може нести дані, потрібні викликачеві, щоб відреагувати. Тут `InsufficientFundsError` зберігає баланс і запитану суму та обчислює нестачу:

```python
class InsufficientFundsError(Exception):
    def __init__(self, balance, amount):
        super().__init__(f"cannot withdraw {amount}: balance is only {balance}")
        self.balance = balance
        self.amount = amount

    @property
    def shortfall(self):
        return self.amount - self.balance


def withdraw(balance, amount):
    if amount > balance:
        raise InsufficientFundsError(balance, amount)
    return balance - amount


print(withdraw(100, 30))
try:
    withdraw(100, 150)
except InsufficientFundsError as e:
    print(e)
    print("missing:", e.shortfall)
    print(e.args)
```

Результат:

```text
70
cannot withdraw 150: balance is only 100
missing: 50
('cannot withdraw 150: balance is only 100',)
```

Метод `__init__` викликає `super().__init__()` з готовим повідомленням. Це повідомлення стає `args[0]`, тож його показують і `str(e)`, і `print(e)`, і останній рядок трасування. Викликачеві не треба розбирати цей текст: він читає `e.balance`, `e.amount` чи `e.shortfall` напряму.

> **Зверніть увагу:** якщо викликати `super().__init__()` **без** аргументів, `args` стане порожнім, і повідомлення зникне: `str(e)` дорівнюватиме `''`, а трасування покаже лише назву класу. Завжди передавайте базовому класу повідомлення (або початкові аргументи).

## Приклад: перетворювач температури

Припустімо, програма працює з рідкою водою за нормального атмосферного тиску, тому приймає лише температури від 32 °F (точка замерзання) до 212 °F (точка кипіння). Будь-яке інше значення — помилка в предметній області цієї програми, тож для неї створюється окремий виняток `FahrenheitError`.

> **Зверніть увагу:** в оригінальному посібнику 32 і 212 названо «мінімальним і максимальним значеннями температури за Фаренгейтом». Це не так: шкала Фаренгейта не має таких меж (−40 °F — цілком реальна зимова температура). Це межі, які приймає саме *ця програма*.

### Клас `FahrenheitError`

```python
class FahrenheitError(Exception):
    min_f = 32
    max_f = 212

    def __init__(self, f, *args):
        super().__init__(f, *args)
        self.f = f

    def __str__(self):
        return f"{self.f} °F is out of the valid range {self.min_f}..{self.max_f} °F"


def fahrenheit_to_celsius(f: float) -> float:
    if f < FahrenheitError.min_f or f > FahrenheitError.max_f:
        raise FahrenheitError(f)
    return (f - 32) * 5 / 9


for f in [50, 212, 300]:
    try:
        print(f, "->", round(fahrenheit_to_celsius(f), 2))
    except FahrenheitError as e:
        print("error:", e)
        print("args:", e.args, "| repr:", repr(e), "| f:", e.f)
```

Результат:

```text
50 -> 10.0
212 -> 100.0
error: 300 °F is out of the valid range 32..212 °F
args: (300,) | repr: FahrenheitError(300) | f: 300
```

Як це працює:

- `FahrenheitError` успадковується від `Exception`.
- Атрибути класу `min_f` і `max_f` задають допустимий діапазон. Вони належать класу, тож перетворювач може читати їх як `FahrenheitError.min_f`, не створюючи винятку.
- `__init__` приймає некоректне значення `f` і будь-які додаткові позиційні аргументи та передає **всі** їх базовому класу: `super().__init__(f, *args)`. Крім того, він зберігає `f` як атрибут.
- `__str__` будує зрозуміле повідомлення зі збережених даних. Перевизначення `__str__` змінює те, що показують `print(e)` і трасування. `repr(e)` і далі формується з `args`.

> **Зверніть увагу:** в оригінальному посібнику написано `super().__init__(args)`, тобто кортеж `args` передається як **один** аргумент. З таким викликом `FahrenheitError(300).args` дорівнює `((),)` (кортеж, що містить порожній кортеж), а `repr()` показує `FahrenheitError(())`. Значення `300` до `args` так і не потрапляє. Пишіть `super().__init__(f, *args)`.

### Програма повністю

Основна програма зчитує значення, перетворює його на число, а тоді — на градуси Цельсія. Можуть виникнути два різні винятки, і кожен має власний обробник:

```python
class FahrenheitError(Exception):
    min_f = 32
    max_f = 212

    def __init__(self, f, *args):
        super().__init__(f, *args)
        self.f = f

    def __str__(self):
        return f"{self.f} °F is out of the valid range {self.min_f}..{self.max_f} °F"


def fahrenheit_to_celsius(f: float) -> float:
    if f < FahrenheitError.min_f or f > FahrenheitError.max_f:
        raise FahrenheitError(f)
    return (f - 32) * 5 / 9


if __name__ == "__main__":
    text = input("Enter a temperature in Fahrenheit: ")
    try:
        f = float(text)
    except ValueError as ex:
        print(ex)
    else:
        try:
            c = fahrenheit_to_celsius(f)
        except FahrenheitError as ex:
            print(ex)
        else:
            print(f"{f} Fahrenheit = {c:.4f} Celsius")
```

Три запуски програми, після запрошення — те, що ввів користувач:

```text
Enter a temperature in Fahrenheit: 50
50.0 Fahrenheit = 10.0000 Celsius
```

```text
Enter a temperature in Fahrenheit: 300
300.0 °F is out of the valid range 32..212 °F
```

```text
Enter a temperature in Fahrenheit: hot
could not convert string to float: 'hot'
```

1. `input()` повертає рядок.
2. `float(text)` генерує вбудований `ValueError`, якщо текст не є числом. Його повідомлення виводиться.
3. Лише якщо перетворення вдалося (блок `else`), виконується `fahrenheit_to_celsius()`. `FahrenheitError` виводиться за допомогою свого `__str__`. Інакше результат виводиться з чотирма знаками після коми.

(В оригінальному посібнику в блоці `else` знову викликається `float()` для значення. Це зайве, бо на той момент `f` уже має тип `float`.)

## Побудова ієрархії винятків

Бібліотека чи більший застосунок зазвичай визначає один **базовий виняток** і виводить з нього всі свої конкретні винятки. Тоді викликачі можуть самі обирати, наскільки точно перехоплювати:

```text
Exception
 +-- ShopError
      +-- ProductNotFoundError
      +-- OutOfStockError
```

```python
class ShopError(Exception):
    """Base class for all errors raised by the shop."""


class ProductNotFoundError(ShopError):
    def __init__(self, sku):
        super().__init__(f"product {sku!r} not found")
        self.sku = sku


class OutOfStockError(ShopError):
    def __init__(self, sku, requested, available):
        super().__init__(f"only {available} of {sku!r} left, requested {requested}")
        self.sku = sku
        self.requested = requested
        self.available = available


STOCK = {"apple": 5, "pear": 1}


def buy(sku, qty):
    if sku not in STOCK:
        raise ProductNotFoundError(sku)
    if STOCK[sku] < qty:
        raise OutOfStockError(sku, qty, STOCK[sku])
    STOCK[sku] -= qty
    return f"bought {qty} x {sku}"


for sku, qty in [("apple", 2), ("plum", 1), ("pear", 3)]:
    try:
        print(buy(sku, qty))
    except OutOfStockError as e:
        print(f"{e} -> offering {e.available} instead")
    except ShopError as e:
        print("shop error:", e)
```

Результат:

```text
bought 2 x apple
shop error: product 'plum' not found
only 1 of 'pear' left, requested 3 -> offering 1 instead
```

- Конкретний обробник для `OutOfStockError` використовує дані винятку, щоб відреагувати розумно.
- Обробник для базового класу `ShopError` перехоплює всі інші проблеми магазину, зокрема й класи винятків, які в магазині з'являться в майбутньому, а сторонні баги (`TypeError`, `NameError`, ...) і далі спливають на поверхню.
- Як завжди, конкретніша гілка `except` іде першою.

Тримайте ієрархію невеликою. Створюйте окремий клас винятку лише тоді, коли викликач захоче обробляти його по-іншому. Одного базового класу й кількох конкретних підкласів зазвичай достатньо.

## Успадкування ще й від вбудованих винятків

Якщо ваша помилка — окремий випадок вбудованої, успадкуйтеся також і від неї. Тоді код, який знає лише про вбудований виняток, усе одно правильно оброблятиме ваш. Товар, якого не знайдено, — це різновид невдалого пошуку, а температура поза діапазоном — некоректне значення:

```python
class ShopError(Exception):
    """Base class for all errors raised by the shop."""


class ProductNotFoundError(ShopError, LookupError):
    pass


class FahrenheitError(ValueError):
    pass


try:
    raise ProductNotFoundError("product 'plum' not found")
except LookupError as e:
    print("caught as LookupError:", repr(e))

try:
    raise FahrenheitError("300 °F is out of range")
except ValueError as e:
    print("caught as ValueError:", repr(e))

print([cls.__name__ for cls in ProductNotFoundError.__mro__])
```

Результат:

```text
caught as LookupError: ProductNotFoundError("product 'plum' not found")
caught as ValueError: FahrenheitError('300 °F is out of range')
['ProductNotFoundError', 'ShopError', 'LookupError', 'Exception', 'BaseException', 'object']
```

Множинне успадкування тут працює, бо і `ShopError`, і `LookupError` походять від `Exception`. Один наслідок варто пам'ятати: якби в програмі-перетворювачі вище `FahrenheitError` був підкласом `ValueError`, гілка `except ValueError`, написана для `float()`, перехоплювала б і його. Окремі блоки `try` або конкретна гілка, поставлена перед загальною, дають змогу розрізнити ці два випадки.

> **Порада:** не успадковуйтеся від `KeyError` лише для того, щоб повідомити «не знайдено». `KeyError` форматує повідомлення через `repr()`, тож повідомлення на кшталт `product not found` виводиться в лапках. Для такого краще підходить базовий клас `LookupError`.

## Як зберегти можливість серіалізації (pickle)

Винятки іноді **серіалізують** через `pickle`: наприклад, коли виняток, згенерований у робочому процесі, `multiprocessing` або `concurrent.futures` пересилає назад до головного процесу. Python відтворює виняток, викликаючи його клас з `args`. Якщо `__init__` очікує не ті аргументи, що збережені в `args`, відтворення не вдається:

```python
import pickle


class InsufficientFundsError(Exception):
    def __init__(self, balance, amount):
        super().__init__(f"cannot withdraw {amount}: balance is only {balance}")
        self.balance = balance
        self.amount = amount


error = InsufficientFundsError(100, 150)
data = pickle.dumps(error)
pickle.loads(data)
```

Результат:

```text
Traceback (most recent call last):
  File "app.py", line 13, in <module>
    pickle.loads(data)
    ~~~~~~~~~~~~^^^^^^
TypeError: InsufficientFundsError.__init__() missing 1 required positional argument: 'amount'
```

У `args` лежить лише повідомлення, тож під час десеріалізації викликається `InsufficientFundsError("cannot withdraw ...")`, і другого аргументу бракує. Виправлення — той самий підхід, що й у `FahrenheitError`: передавати в `super().__init__()` **початкові аргументи**, а повідомлення будувати в `__str__`. Саме це пропонує зробити вправа 3. Якщо ваші винятки ніколи не залишають процес, це неважливо. Якщо можуть залишити, перевірте, чи переживають вони цикл `pickle` туди й назад.

## Типові помилки

- **Успадковуватися від `BaseException`.** `except Exception` такий виняток не перехопить, тож загальні обробники помилок його пропустять, і він поводитиметься як `KeyboardInterrupt`:

  ```python
  class ConfigError(BaseException):
      pass


  try:
      try:
          raise ConfigError("missing key")
      except Exception:
          print("handled")
  except BaseException as e:
      print("escaped except Exception:", repr(e))
  ```

  Результат:

  ```text
  escaped except Exception: ConfigError('missing key')
  ```

- **Передавати `args` одним аргументом.** `super().__init__(args)` зберігає кортеж усередині кортежу. Розпакуйте його: `super().__init__(f, *args)`.
- **Викликати `super().__init__()` без повідомлення.** Тоді у винятку порожнє повідомлення, а трасування показують лише назву його класу.
- **Окремий клас винятку для кожної функції.** Забагато класів ускладнюють обробку, а не спрощують її. Створюйте клас, коли викликачам потрібно відрізняти саме цю помилку, а споріднені класи об'єднуйте під одним базовим.
- **Використовувати власний виняток там, де підходить вбудований.** Функція, яка отримала від'ємну кількість, може просто згенерувати `ValueError`. Власні винятки — для помилок вашої предметної області. Якщо сумніваєтеся, успадкуйтеся від відповідного вбудованого, щоб працювали обидва види обробників.
- **Класти дані лише в повідомлення.** `raise ShopError(f"only {n} left")` змушує викликачів розбирати текст. Зберігайте значення як атрибути.

## Підсумок

- Власний виняток — це клас, що успадковується від `Exception` (або його підкласу). Як тіло класу достатньо рядка документації.
- Називайте класи винятків із суфіксом `Error` і ніколи не успадковуйтеся безпосередньо від `BaseException`.
- Додавайте атрибути й властивості для даних, потрібних викликачеві, і передавайте повідомлення (або початкові аргументи) в `super().__init__()`, щоб правильно працювали `args`, `str()` і трасування.
- Перевизначайте `__str__`, щоб будувати повідомлення зі збережених даних.
- Організовуйте винятки модуля чи застосунку під одним базовим класом. Перехоплюйте конкретні класи там, де можете відреагувати, а базовий клас — щоб обробити «будь-яку помилку цього модуля».
- Успадковуйтеся ще й від вбудованого винятку (`ValueError`, `LookupError`, ...), коли ваша помилка є його окремим випадком.
- Якщо винятки можуть перетинати межі процесів, подбайте, щоб `__init__` можна було викликати з `args`, тоді вони переживуть серіалізацію через pickle.

## Практика

### Вправа 1: Помилка валідації

Визначте `ValidationError` як підклас `ValueError` з атрибутами `field` і `value` та повідомленням `"invalid <field>: <value!r>"`. Напишіть `validate_user(data)`, яка генерує цей виняток, якщо `data["name"]` порожнє або `data["age"]` не лежить у межах від 0 до 150. Покажіть, що викликач може перехопити його через `except ValueError` і все одно прочитати `e.field`.

### Вправа 2: Банківська ієрархія

Створіть базовий клас `BankError` і три підкласи: `AccountNotFoundError` (водночас і `LookupError`, з атрибутом `account`), `InsufficientFundsError` (з `balance`, `amount` і властивістю `shortfall`) та `AccountFrozenError`. Напишіть `transfer(accounts, frozen, src, dst, amount)`, де `accounts` зіставляє назви рахунків із балансами, а `frozen` — множина назв. Перевірте чотири перекази: коректний, з невідомого рахунку, з рахунку, на якому замало грошей, та із замороженого рахунку. Обробіть `InsufficientFundsError` окремим повідомленням, яке згадує нестачу, а все інше — через `except BankError`.

### Вправа 3: Зробіть виняток придатним до pickle

Перепишіть `InsufficientFundsError` з розділу «Як зберегти можливість серіалізації (pickle)» так, щоб `super().__init__()` отримував `balance` і `amount`, а повідомлення будував `__str__`. Перевірте, що після `pickle.loads(pickle.dumps(error))` копія має той самий тип, `args`, повідомлення й атрибути.

### Вправа 4: HTTP-помилки за кодом стану

Визначте `HTTPError(Exception)` з атрибутами `status` і `url` та три підкласи: `ClientError` (4xx), `NotFoundError(ClientError)` (404) і `ServerError` (5xx). Напишіть `error_for(status, url)`, яка **повертає** (а не генерує) екземпляр найконкретнішого класу для коду стану. Потім згенеруйте помилки для `(404, "/missing")`, `(403, "/admin")` і `(503, "/api")` та обробіть їх трьома гілками `except` у правильному порядку: `"page not found"`, `"fix the request"` і `"retry later"`.

## Розв'язки

### Вправа 1

```python
class ValidationError(ValueError):
    def __init__(self, field, value):
        super().__init__(f"invalid {field}: {value!r}")
        self.field = field
        self.value = value


def validate_user(data):
    if not data["name"]:
        raise ValidationError("name", data["name"])
    if not 0 <= data["age"] <= 150:
        raise ValidationError("age", data["age"])


for user in [{"name": "Olena", "age": 34}, {"name": "", "age": 20}, {"name": "Max", "age": 200}]:
    try:
        validate_user(user)
        print("ok:", user["name"])
    except ValueError as e:
        print(f"{e} (field={e.field})")
```

Результат:

```text
ok: Olena
invalid name: '' (field=name)
invalid age: 200 (field=age)
```

### Вправа 2

```python
class BankError(Exception):
    """Base class for banking errors."""


class AccountNotFoundError(BankError, LookupError):
    def __init__(self, account):
        super().__init__(f"account {account!r} does not exist")
        self.account = account


class InsufficientFundsError(BankError):
    def __init__(self, balance, amount):
        super().__init__(f"cannot transfer {amount}: balance is {balance}")
        self.balance = balance
        self.amount = amount

    @property
    def shortfall(self):
        return self.amount - self.balance


class AccountFrozenError(BankError):
    pass


def transfer(accounts, frozen, src, dst, amount):
    for name in (src, dst):
        if name not in accounts:
            raise AccountNotFoundError(name)
    if src in frozen:
        raise AccountFrozenError(f"account {src!r} is frozen")
    if accounts[src] < amount:
        raise InsufficientFundsError(accounts[src], amount)
    accounts[src] -= amount
    accounts[dst] += amount


accounts = {"olena": 100, "max": 20, "ivan": 500}
frozen = {"ivan"}
for src, dst, amount in [("olena", "max", 30), ("anna", "max", 5),
                         ("max", "olena", 80), ("ivan", "olena", 10)]:
    try:
        transfer(accounts, frozen, src, dst, amount)
        print(f"{src} -> {dst}: {amount} ok")
    except InsufficientFundsError as e:
        print(f"{src} -> {dst}: {e} (short by {e.shortfall})")
    except BankError as e:
        print(f"{src} -> {dst}: {type(e).__name__}: {e}")
print(accounts)
```

Результат:

```text
olena -> max: 30 ok
anna -> max: AccountNotFoundError: account 'anna' does not exist
max -> olena: cannot transfer 80: balance is 50 (short by 30)
ivan -> olena: AccountFrozenError: account 'ivan' is frozen
{'olena': 70, 'max': 50, 'ivan': 500}
```

Усі перевірки відбуваються до того, як гроші кудись переміщуються, тож невдалий переказ не змінює балансів.

### Вправа 3

```python
import pickle


class InsufficientFundsError(Exception):
    def __init__(self, balance, amount):
        super().__init__(balance, amount)
        self.balance = balance
        self.amount = amount

    def __str__(self):
        return f"cannot withdraw {self.amount}: balance is only {self.balance}"


error = InsufficientFundsError(100, 150)
copy = pickle.loads(pickle.dumps(error))

print(type(copy).__name__, copy.args)
print(copy)
print(copy.balance, copy.amount)
print(str(copy) == str(error))
```

Результат:

```text
InsufficientFundsError (100, 150)
cannot withdraw 150: balance is only 100
100 150
True
```

Тепер `args` дорівнює `(100, 150)`, тож під час десеріалізації викликається `InsufficientFundsError(100, 150)`, що відповідає сигнатурі `__init__`. Додатковий бонус: `repr(error)` має вигляд `InsufficientFundsError(100, 150)` і показує справжні дані.

### Вправа 4

```python
class HTTPError(Exception):
    def __init__(self, status, url):
        super().__init__(f"{status} error for {url}")
        self.status = status
        self.url = url


class ClientError(HTTPError):
    """4xx: the request was wrong."""


class NotFoundError(ClientError):
    """404: the resource does not exist."""


class ServerError(HTTPError):
    """5xx: the server failed."""


def error_for(status, url):
    if status == 404:
        cls = NotFoundError
    elif 400 <= status < 500:
        cls = ClientError
    elif 500 <= status < 600:
        cls = ServerError
    else:
        cls = HTTPError
    return cls(status, url)


for status, url in [(404, "/missing"), (403, "/admin"), (503, "/api")]:
    try:
        raise error_for(status, url)
    except NotFoundError as e:
        print(e, "-> page not found")
    except ClientError as e:
        print(e, "-> fix the request")
    except ServerError as e:
        print(e, "-> retry later")
```

Результат:

```text
404 error for /missing -> page not found
403 error for /admin -> fix the request
503 error for /api -> retry later
```

`NotFoundError` має стояти перед `ClientError`, бо є його підкласом. У зворотному порядку код 404 повідомлявся б як «fix the request». Фабрична функція, яка *повертає* виняток, залишає `raise` видимим саме там, де виникає помилка.

---

*Джерело: [pythontutorial.net — Python Custom Exception](https://www.pythontutorial.net/python-oop/python-custom-exception/). Адаптовано й доповнено для PyJourney.*
