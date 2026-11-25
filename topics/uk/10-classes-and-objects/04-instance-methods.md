# Методи екземпляра

**Метод екземпляра** (instance method) — це функція, оголошена в класі, яка працює з одним конкретним об'єктом. Його викликають через крапку, `obj.method()`, і він може читати й змінювати стан цього об'єкта. У цій темі зазирнемо «під капот»: як звичайна функція всередині класу стає **зв'язаним методом** (bound method), коли до неї звертаються через екземпляр, чому Python передає екземпляр першим аргументом і чому цей аргумент називають `self`.

## Що ви дізнаєтесь

- Чим функція, оголошена в класі, відрізняється від зв'язаного методу
- Чому під час виклику методу через екземпляр цей екземпляр передається автоматично
- Чому `obj.method()` рівнозначне `Class.method(obj)`
- Що таке `self` і чому його назва — лише домовленість
- Як методи читають і змінюють стан об'єкта та викликають один одного
- Що містить об'єкт зв'язаного методу і як зберегти його як колбек

## Функція всередині класу — це просто функція

Почнімо з класу, що містить функцію без жодних параметрів:

```python
class Request:
    def send():
        print("Sent")


Request.send()
print(Request.send)
print(type(Request.send))
```

Результат (адреса щоразу різна):

```text
Sent
<function Request.send at 0x1002efd70>
<class 'function'>
```

Звертаючись до `send` **через клас**, ви отримуєте звичайний об'єкт функції, екземпляр класу `function`. Її виклик нічим не відрізняється від виклику будь-якої іншої функції.

> **Зверніть увагу:** у Python 2 для цього випадку існував окремий тип «незв'язаний метод» (unbound method). У Python 3 його прибрали: функція, до якої звертаються через її клас, — це просто функція.

## Звернення через екземпляр дає зв'язаний метод

Тепер створімо екземпляр і подивімося на ту саму назву через нього:

```python
class Request:
    def send():
        print("Sent")


http_request = Request()
print(http_request.send)
print(type(http_request.send))
print(type(Request.send) is type(http_request.send))
```

Результат (адреса щоразу різна):

```text
<bound method Request.send of <__main__.Request object at 0x1002d5160>>
<class 'method'>
False
```

`http_request.send` — уже не функція. Це **зв'язаний метод**, об'єкт класу `method`, який пов'язує функцію `send` з екземпляром `http_request`. Типи в них різні, тож порівняння дає `False`.

Що означає «зв'язаний» на практиці? Спробуймо його викликати:

```python
class Request:
    def send():
        print("Sent")


http_request = Request()
http_request.send()
```

Результат:

```text
Traceback (most recent call last):
  ...
TypeError: Request.send() takes 0 positional arguments but 1 was given
```

Ми нічого не передавали, а Python скаржиться, що `send()` отримала один аргумент. Зв'язаний метод завжди передає об'єкт, до якого він прив'язаний, **першим аргументом** функції, а в `send()` немає параметра, щоб його прийняти.

## Ловимо прихований аргумент

Щоб побачити, що саме передає Python, дозвольмо функції приймати будь-яку кількість позиційних аргументів через `*args`:

```python
class Request:
    def send(*args):
        print("Sent", args)


http_request = Request()
Request.send()
print(hex(id(http_request)))
http_request.send()
```

Результат (адреси щоразу різні, але два останні завжди збігаються):

```text
Sent ()
0x1002d52b0
Sent (<__main__.Request object at 0x1002d52b0>,)
```

Під час виклику через клас `send()` не отримує аргументів. Під час виклику через екземпляр — отримує рівно один: об'єкт за тією самою адресою, що й `http_request`. Порівнювати адреси на око незручно, тож ось та сама перевірка через `is`:

```python
class Request:
    def send(*args):
        return args


http_request = Request()
received = http_request.send()
print(len(received))
print(received[0] is http_request)
```

Результат:

```text
1
True
```

Перший аргумент — **це і є** об'єкт, на якому викликали метод.

## `obj.method()` — це `Class.method(obj)`

Звідси випливає ключове правило. Виклик методу

```python
http_request.send()
```

рівнозначний виклику функції

```python
Request.send(http_request)
```

Оскільки перший параметр завжди отримує екземпляр, кожен метод екземпляра оголошує для нього параметр. За домовленістю його називають `self`:

```python
class Request:
    def __init__(self, url):
        self.url = url

    def send(self):
        print(f"Sending request to {self.url}")


http_request = Request("https://example.com")
http_request.send()
Request.send(http_request)
```

Результат:

```text
Sending request to https://example.com
Sending request to https://example.com
```

Обидва рядки роблять те саме. У повсякденному коді завжди пишуть першу форму, але знання другої пояснює кожну помилку на кшталт «бракує / зайвий позиційний аргумент», яку ви зустрінете з методами.

Те саме правило діє і для вбудованих типів. `str.upper` — функція класу `str`, тож її можна передати будь-куди, де очікується функція з одним аргументом:

```python
print("kyiv".upper())
print(str.upper("kyiv"))
print(list(map(str.upper, ["kyiv", "lviv"])))
```

Результат:

```text
KYIV
KYIV
['KYIV', 'LVIV']
```

### Про `self`

- `self` — звичайний параметр, а не ключове слово. `def send(this):` теж працюватиме, але PEP 8 радить завжди використовувати `self`, і саме його очікує кожен, хто читає Python-код.
- Якщо ви знаєте Java, C# або JavaScript, то `self` відіграє роль `this`. Різниця в тому, що Python робить його **явним**: ви оголошуєте його в сигнатурі й мусите писати `self.url`, щоб дістатися до атрибута. Просто `url` усередині методу означає локальну чи глобальну змінну, а не атрибут об'єкта.

## Методи працюють зі станом об'єкта

Справжнє призначення методу екземпляра — читати й оновлювати стан свого об'єкта. Через `self` метод може також викликати інші методи того самого об'єкта:

```python
class ShoppingCart:
    def __init__(self):
        self.items = []

    def add(self, name, price, quantity=1):
        self.items.append((name, price, quantity))

    def total(self):
        return sum(price * quantity for _, price, quantity in self.items)

    def summary(self):
        return f"{len(self.items)} item(s), total {self.total():.2f}"


cart = ShoppingCart()
cart.add("Book", 12.5)
cart.add("Pen", 1.25, quantity=4)
print(cart.total())
print(cart.summary())

other = ShoppingCart()
print(other.summary())
```

Результат:

```text
17.5
2 item(s), total 17.50
0 item(s), total 0.00
```

- `add()` змінює стан того кошика, на якому його викликали.
- `summary()` викликає `self.total()`, інший метод того самого об'єкта.
- `other` має власний список `items`, тому методи `other` бачать порожній кошик. Один клас — багато незалежних об'єктів, і саме через `self` кожен виклик методу знає, з яким об'єктом він працює.

## Зв'язаний метод зблизька

Зв'язаний метод зберігає два посилання: на функцію (`__func__`) і на об'єкт (`__self__`). Виклик зв'язаного методу просто викликає `__func__(__self__, ...)`:

```python
class Request:
    def __init__(self, url):
        self.url = url

    def send(self):
        return f"Sending request to {self.url}"


http_request = Request("https://example.com")
method = http_request.send

print(method.__self__ is http_request)
print(method.__func__ is Request.send)
print(method.__func__(method.__self__))
```

Результат:

```text
True
True
Sending request to https://example.com
```

Кожне звернення до атрибута створює **новий** об'єкт зв'язаного методу, тож два звернення дають рівні, але не тотожні об'єкти:

```python
class Request:
    def send(self):
        pass


http_request = Request()
print(http_request.send is http_request.send)
print(http_request.send == http_request.send)
```

Результат:

```text
False
True
```

### Зв'язаний метод як колбек

Оскільки зв'язаний метод пам'ятає свій об'єкт, його можна зберегти в змінній (без дужок!) і викликати пізніше. Саме так зазвичай працюють обробники натискань кнопок, таймери та інші колбеки:

```python
class Counter:
    def __init__(self):
        self.value = 0

    def increment(self):
        self.value += 1


counter = Counter()
click = counter.increment  # зберігаємо зв'язаний метод, але ще не викликаємо
for _ in range(3):
    click()
print(counter.value)
```

Результат:

```text
3
```

> **Зверніть увагу:** для допитливих: функції є *дескрипторами* (descriptors). Коли ви звертаєтеся до `http_request.send`, Python знаходить функцію `send` у класі й викликає її метод `__get__()` з екземпляром, а вже цей виклик створює зв'язаний метод. Тема про дескриптори пояснює цей механізм докладно.

## Типові помилки

- **Забути `self` в оголошенні.** Виклик `obj.method()` передає екземпляр, і метод без параметра для нього падає з `TypeError: ... takes 0 positional arguments but 1 was given`.

- **Викликати метод екземпляра через клас без екземпляра.**

  ```python
  class Request:
      def send(self):
          print("Sent", self)


  Request.send()
  ```

  Результат:

  ```text
  Traceback (most recent call last):
    ...
  TypeError: Request.send() missing 1 required positional argument: 'self'
  ```

  Спершу створіть екземпляр або передайте його явно: `Request.send(Request())`.

- **Забути `self.` усередині методу.** Просту назву Python шукає серед локальних і глобальних змінних. Починаючи з Python 3.12, повідомлення про помилку навіть підказує виправлення:

  ```python
  class Request:
      def __init__(self, url):
          self.url = url

      def send(self):
          print(f"Sending request to {url}")


  Request("https://example.com").send()
  ```

  Результат:

  ```text
  Traceback (most recent call last):
    ...
  NameError: name 'url' is not defined. Did you mean: 'self.url'?
  ```

- **Забути дужки в умові.** Об'єкт зв'язаного методу завжди істинний, тож ця перевірка ніколи не робить того, що здається:

  ```python
  class Cart:
      def __init__(self):
          self.items = []

      def is_empty(self):
          return not self.items


  cart = Cart()
  cart.items.append("book")
  if cart.is_empty:  # помилка: треба cart.is_empty()
      print("Cart is empty")
  ```

  Результат:

  ```text
  Cart is empty
  ```

- **Назвати атрибут так само, як метод.** `self.total = 0` в `__init__` створює атрибут екземпляра, який затуляє метод `total()`. Тоді виклик `cart.total()` падає з `TypeError: 'int' object is not callable`. Використовуйте різні назви, наприклад `self._total` і `total()`.

## Підсумок

- Функція, оголошена в класі, — це звичайна функція, коли до неї звертаються через клас (`Request.send`).
- Під час звернення через екземпляр вона стає зв'язаним методом (`http_request.send`), який пам'ятає екземпляр.
- Виклик зв'язаного методу передає екземпляр першим аргументом: `obj.method(x)` — те саме, що `Class.method(obj, x)`.
- Перший параметр методу екземпляра за домовленістю називають `self`. Усередині методу до атрибутів та інших методів звертаються через `self.`.
- Методи екземпляра читають і змінюють стан саме того об'єкта, на якому їх викликали.
- Зв'язаний метод має `__self__` (об'єкт) і `__func__` (функцію). Кожне звернення створює новий зв'язаний метод, який можна зберегти й викликати пізніше як колбек.

## Практика

### Вправа 1: Банківський рахунок

Напишіть клас `BankAccount`, що має:

- `__init__(self, owner, balance=0)`;
- `deposit(amount)`, який додає гроші й повертає новий баланс;
- `withdraw(amount)`, який знімає гроші й повертає новий баланс, але генерує `ValueError("insufficient funds")`, якщо коштів недостатньо.

Створіть рахунок для `"Olena"`, покладіть 100, зніміть 30, потім спробуйте зняти 500 і виведіть повідомлення про помилку. Наприкінці виведіть баланс.

### Вправа 2: Два способи виклику

На прикладі вашого `BankAccount` покажіть, що `account.deposit(50)` і `BankAccount.deposit(account, 50)` дають однаковий ефект. Потім виведіть, чи `account.deposit.__self__` є `account` і чи `account.deposit.__func__` є `BankAccount.deposit`.

### Вправа 3: Диспетчер команд

Напишіть клас `Light` з атрибутом `is_on` (спочатку `False`) і методами `turn_on()`, `turn_off()` та `toggle()`, кожен з яких виводить новий стан. Збережіть **зв'язані методи** однієї лампи у словнику `{"on": ..., "off": ..., "toggle": ...}` і виконайте команди `["on", "toggle", "toggle", "off"]`, шукаючи їх у словнику.

### Вправа 4: Ланцюжок викликів

Напишіть клас `TextBuilder` з методами `add(text)` і `newline()`, які обидва повертають `self`, і методом `build()`, що повертає зібраний текст одним рядком. Побудуйте цей текст одним ланцюжковим виразом і виведіть його:

```text
Hello, world!
Bye.
```

## Розв'язки

### Вправа 1

```python
class BankAccount:
    def __init__(self, owner, balance=0):
        self.owner = owner
        self.balance = balance

    def deposit(self, amount):
        self.balance += amount
        return self.balance

    def withdraw(self, amount):
        if amount > self.balance:
            raise ValueError("insufficient funds")
        self.balance -= amount
        return self.balance


account = BankAccount("Olena")
print(account.deposit(100))
print(account.withdraw(30))
try:
    account.withdraw(500)
except ValueError as error:
    print("Error:", error)
print(account.owner, account.balance)
```

Результат:

```text
100
70
Error: insufficient funds
Olena 70
```

Невдале зняття генерує виняток ще до будь-яких змін, тож баланс лишається узгодженим.

### Вправа 2

```python
class BankAccount:
    def __init__(self, owner, balance=0):
        self.owner = owner
        self.balance = balance

    def deposit(self, amount):
        self.balance += amount
        return self.balance


account = BankAccount("Olena")
print(account.deposit(50))
print(BankAccount.deposit(account, 50))
print(account.deposit.__self__ is account)
print(account.deposit.__func__ is BankAccount.deposit)
```

Результат:

```text
50
100
True
True
```

Обидва виклики запустили ту саму функцію з тим самим об'єктом як `self`, тому кожен додав 50 до одного й того самого балансу.

### Вправа 3

```python
class Light:
    def __init__(self):
        self.is_on = False

    def turn_on(self):
        self.is_on = True
        self.report()

    def turn_off(self):
        self.is_on = False
        self.report()

    def toggle(self):
        self.is_on = not self.is_on
        self.report()

    def report(self):
        print("Light is", "ON" if self.is_on else "OFF")


light = Light()
commands = {"on": light.turn_on, "off": light.turn_off, "toggle": light.toggle}

for name in ["on", "toggle", "toggle", "off"]:
    commands[name]()
```

Результат:

```text
Light is ON
Light is OFF
Light is ON
Light is OFF
```

Кожне значення в `commands` — це зв'язаний метод, який пам'ятає `light`, тож `commands[name]()` не потребує аргументів.

### Вправа 4

```python
class TextBuilder:
    def __init__(self):
        self.parts = []

    def add(self, text):
        self.parts.append(text)
        return self

    def newline(self):
        self.parts.append("\n")
        return self

    def build(self):
        return "".join(self.parts)


text = TextBuilder().add("Hello, ").add("world!").newline().add("Bye.").build()
print(text)
```

Результат:

```text
Hello, world!
Bye.
```

Оскільки `add()` і `newline()` повертають той самий об'єкт, на якому їх викликали, наступний метод у ланцюжку теж викликається на цьому об'єкті.

---

*Джерело: [pythontutorial.net — Python Methods](https://www.pythontutorial.net/python-oop/python-methods/). Адаптовано й доповнено для PyJourney.*
