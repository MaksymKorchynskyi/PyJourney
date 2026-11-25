# nonlocal

Python дозволяє оголосити функцію всередині іншої функції. Внутрішня функція може читати змінні зовнішньої, але щоб їх **перепризначити**, їй потрібне ключове слово `nonlocal`. У цій темі розглянуто охопну (nonlocal) область видимості, пошук імен у вкладених функціях і відмінність `nonlocal` від `global`.

## Що ви дізнаєтесь

- Що таке вкладені функції і навіщо вони потрібні
- Що таке охопна (nonlocal) область видимості та яке її місце в правилі LEGB
- Як внутрішня функція читає змінні зовнішньої
- Як перепризначити змінну зовнішньої функції за допомогою `nonlocal`
- Які правила й помилки пов'язані з `nonlocal` і чим воно відрізняється від `global`

## Вкладені функції

Функція, оголошена всередині іншої функції, називається **вкладеною** (або внутрішньою):

```python
def outer():
    print("outer function")

    def inner():
        print("inner function")

    inner()


outer()
```

Результат:

```text
outer function
inner function
```

Інструкція `def inner():` виконується під час кожного виклику `outer()`. Вона створює новий об'єкт функції та прив'язує його до **локального** імені `inner` усередині `outer`. Поза `outer` імені `inner` не існує.

Навіщо взагалі вкладати функції?

- **Інкапсуляція.** Допоміжна функція, яка має сенс лише всередині однієї функції, не засмічує глобальний простір імен модуля.
- **Доступ до даних зовнішньої функції.** Внутрішня функція може користуватися параметрами й змінними зовнішньої, і їх не треба передавати явно.
- **Замикання й декоратори.** Зовнішня функція може *повернути* внутрішню разом із даними, якими та користується. Саме на цьому побудовано наступні теми.

## Охопна (nonlocal) область видимості

Кожна функція має власну локальну область видимості. Вкладена функція бачить ще й локальну область функції, що її містить. З погляду внутрішньої функції ця область не є ні локальною (вона належить іншій функції), ні глобальною (це не рівень модуля). Python називає її **охопною** (enclosing) областю видимості, а змінні в ній часто називають **нелокальними** (nonlocal).

```python
def outer():
    message = "outer function"
    print(message)

    def inner():
        print(message)

    inner()


outer()
```

Результат:

```text
outer function
outer function
```

В `inner` немає локальної змінної `message`, тож Python шукає її в охопній області (області `outer`) і знаходить там.

Це літера **E** у правилі LEGB. Коли ім'я читають, Python шукає його в такому порядку:

```text
L  Local       функція, що виконується (inner)
E  Enclosing   зовнішні функції, від найближчої (outer)
G  Global      модуль
B  Built-in    print, len, None, ...
```

Якщо в охопних областях імені немає, пошук просто продовжується в глобальній області:

```python
message = "global scope"


def outer():

    def inner():
        print(message)

    inner()


outer()
```

Результат:

```text
global scope
```

Ні `inner`, ні `outer` не визначають `message`, тож Python доходить до глобальної області.

Якщо рівнів вкладеності кілька, перемагає **найближча** охопна функція, у якій визначено це ім'я:

```python
def level1():
    name = "level1"

    def level2():
        name = "level2"

        def level3():
            print(name)

        level3()

    level2()


level1()
```

Результат:

```text
level2
```

## Присвоєння у внутрішній функції створює локальну змінну

Читати зовнішню змінну можна вільно. З присвоєнням інакше, і правило те саме, що й для глобальних змінних: якщо функція будь-де у своєму тілі присвоює значення імені, це ім'я **локальне** для функції.

```python
def outer():
    message = "outer scope"

    def inner():
        message = "inner scope"
        print("inner:", message)

    inner()
    print("outer:", message)


outer()
```

Результат:

```text
inner: inner scope
outer: outer scope
```

`inner` створила власну локальну `message`, яка затіняє зовнішню. Зовнішня змінна так і не змінилася.

Операція, яка спершу читає, а потім записує, як-от `+=`, завершується помилкою: ім'я локальне, але значення в нього ще немає:

```python
def outer():
    count = 0

    def inner():
        count += 1

    inner()


outer()
```

Результат:

```text
Traceback (most recent call last):
  File "app.py", line 10, in <module>
    outer()
    ~~~~~^^
  File "app.py", line 7, in outer
    inner()
    ~~~~~^^
  File "app.py", line 5, in inner
    count += 1
    ^^^^^
UnboundLocalError: cannot access local variable 'count' where it is not associated with a value
```

## Ключове слово `nonlocal`

Щоб перепризначити змінну охопної функції, оголосіть її у внутрішній функції як `nonlocal`:

```python
def outer():
    message = "outer scope"
    print(message)

    def inner():
        nonlocal message
        message = "inner scope"
        print(message)

    inner()

    print(message)


outer()
```

Результат:

```text
outer scope
inner scope
inner scope
```

`nonlocal message` повідомляє компілятору: «`message` у цій функції — це змінна найближчої охопної функції, де є змінна з таким ім'ям». Після виконання `inner()` функція `outer` бачить нове значення.

Те саме виправлення змушує працювати лічильник із попереднього розділу:

```python
def outer():
    count = 0

    def inner():
        nonlocal count
        count += 1

    inner()
    inner()
    inner()
    print(count)


outer()
```

Результат:

```text
3
```

### Як Python знаходить ім'я з `nonlocal`

- Python переглядає **області охопних функцій** від найближчої назовні й прив'язується до першої, де визначено це ім'я.
- Він **ніколи** не заглядає в глобальну (і вбудовану) область.
- Рішення ухвалюється **під час компіляції**. Якщо жодна охопна функція не визначає ім'я, файл не компілюється взагалі, і нічого не виконується.

```python
message = "outer scope"


def outer():
    print(message)

    def inner():
        nonlocal message
        message = "inner scope"
        print(message)

    inner()

    print(message)


outer()
```

Результат:

```text
  File "app.py", line 8
    nonlocal message
    ^^^^^^^^^^^^^^^^
SyntaxError: no binding for nonlocal 'message' found
```

`outer` лише *читає* глобальну `message`. Власної змінної з таким ім'ям у неї немає, а `nonlocal` глобальну область не розглядає, тож прив'язуватися нема до чого. Зверніть увагу: не виконався навіть перший `print()`, адже `SyntaxError` зупиняє програму ще до початку виконання. Якщо ви справді мали на увазі змінну рівня модуля, використайте `global message`.

### Інші правила

- `nonlocal` не може **створити** змінну. На відміну від `global`, ім'я вже має бути присвоєне в охопній функції.
- `nonlocal` заборонене на рівні модуля (`SyntaxError: nonlocal declaration not allowed at module level`), а невкладена функція не має охопної функції, на яку можна було б послатися.
- Ім'я не може бути водночас параметром внутрішньої функції і `nonlocal` (`SyntaxError: name 'x' is parameter and nonlocal`).
- Оголошення має стояти перед використанням імені у функції, так само як `global`.
- Можна перелічити кілька імен одразу: `nonlocal total, count`.

### Для зміни об'єкта `nonlocal` не потрібне

`nonlocal` стосується **перепризначення імен**. Якщо зовнішня змінна посилається на змінюваний об'єкт, внутрішня функція може змінити цей об'єкт без жодних оголошень, адже саме ім'я не перепризначається:

```python
def outer():
    log = []

    def inner(event):
        log.append(event)

    inner("start")
    inner("stop")
    print(log)


outer()
```

Результат:

```text
['start', 'stop']
```

`log.append(...)` читає ім'я `log` (знаходить його в охопній області) і змінює список. А от `log = log + [event]` — це вже присвоєння, і для нього `nonlocal log` *знадобилося б*.

## Практичний приклад: стан, що зберігається між викликами

Найкорисніше `nonlocal` тоді, коли зовнішня функція **повертає** внутрішню. Внутрішня функція зберігає доступ до зовнішніх змінних навіть після завершення зовнішньої (це *замикання*, про нього наступний розділ), а `nonlocal` дає змогу ці змінні оновлювати:

```python
def make_counter(start=0):
    count = start

    def increment():
        nonlocal count
        count += 1
        return count

    return increment


counter = make_counter()
print(counter())
print(counter())

other = make_counter(100)
print(other())
print(counter())
```

Результат:

```text
1
2
101
3
```

Кожен виклик `make_counter()` створює нову змінну `count`, тож `counter` і `other` мають незалежний стан. У глобальних змінних нічого не зберігається.

## `nonlocal` проти `global`

| | `global name` | `nonlocal name` |
|---|---|---|
| На що посилається | на змінну рівня модуля | на змінну найближчої охопної функції |
| Де можна використати | у будь-якій функції | лише у вкладеній функції |
| Чи може створити нову змінну | так | ні, ім'я вже має існувати |
| Чи дивиться в глобальну область | так, лише туди | ніколи |
| Помилка, якщо цілі немає | помилки немає (змінну буде створено при присвоєнні) | `SyntaxError` під час компіляції |

## Типові помилки

- **Забути `nonlocal` перед `+=`, `-=` чи `=`.** Внутрішня функція непомітно отримує власну локальну змінну (у випадку `=`) або падає з `UnboundLocalError` (у випадку `+=`).
- **Використати `nonlocal` для змінної рівня модуля.** `nonlocal` пропускає глобальну область, тож ви отримаєте `SyntaxError: no binding for nonlocal ... found`. Для імен рівня модуля потрібне `global`.
- **Додавати `nonlocal` лише для виклику методу.** `items.append(x)` чи `data["key"] = value` змінюють об'єкт і оголошення не потребують. Воно потрібне лише для присвоєння самому імені.
- **Очікувати, що `nonlocal` створить змінну.** Спершу присвойте змінну у зовнішній функції, хай навіть `None` чи `0`.
- **Зловживати вкладеним станом.** Коли кілька внутрішніх функцій ділять багато `nonlocal`-змінних, код швидко стає заплутаним. Якщо стану стає багато, зазвичай зрозуміліше написати невеликий клас.

## Підсумок

- Вкладена функція — це функція, оголошена всередині іншої функції. Вона створюється заново під час кожного виконання зовнішньої.
- Область видимості зовнішньої функції — це **охопна** (nonlocal) область для внутрішньої, літера **E** в LEGB.
- Внутрішні функції можуть читати зовнішні змінні без жодних оголошень. Перемагає найближче охопне визначення.
- Присвоєння імені у внутрішній функції робить його локальним, якщо ім'я не оголошено як `nonlocal`.
- `nonlocal name` перепризначає змінну в найближчій охопній функції. Воно ніколи не дивиться в глобальні змінні, не може створювати змінні, а помилки виявляються під час компіляції.
- Для зміни зовнішнього об'єкта (наприклад, `list.append`) `nonlocal` не потрібне.
- У поєднанні з поверненням внутрішньої функції `nonlocal` дає змогу зберігати приватний стан між викликами без глобальних змінних.

## Практика

### Вправа 1: Передбачте результат

Що виведе ця програма? Спершу дайте відповідь, потім запустіть.

```python
x = "global"


def a():
    x = "a"

    def b():
        x = "b"

        def c():
            nonlocal x
            x = "c"

        c()
        print("in b:", x)

    b()
    print("in a:", x)


a()
print("global:", x)
```

### Вправа 2: Виправте лічильник кліків

`track_clicks()` має виводити `Clicks: 3`, але генерує `UnboundLocalError`. Виправте це, змінивши один рядок.

```python
def track_clicks():
    clicks = 0

    def click():
        clicks += 1

    click()
    click()
    click()
    print("Clicks:", clicks)


track_clicks()
```

### Вправа 3: Ковзне середнє

Напишіть `make_averager()`, яка повертає функцію `add(value)`. Кожен виклик додає число й повертає середнє всіх доданих досі чисел. Зберігайте лише поточні `total` і `count`, а не список.

```python
avg = make_averager()
print(avg(10))  # 10.0
print(avg(20))  # 15.0
print(avg(60))  # 30.0
```

### Вправа 4: Маленький банківський рахунок

Напишіть `make_account(balance)`, яка повертає **три** функції: `deposit(amount)`, `withdraw(amount)` і `get_balance()`. Усі три мають працювати з тим самим балансом. `withdraw` має генерувати `ValueError("insufficient funds")`, якщо сума більша за баланс. Продемонструйте поповнення, зняття та невдалу спробу зняття.

## Розв'язки

### Вправа 1

Результат:

```text
in b: c
in a: a
global: global
```

`nonlocal x` у `c` прив'язується до **найближчої** охопної функції, що визначає `x`, тобто до `b`. Тому змінюється лише змінна `b`. Змінна `x` функції `a` і глобальна `x` лишаються незмінними.

### Вправа 2

Додайте `nonlocal clicks` у внутрішню функцію:

```python
def track_clicks():
    clicks = 0

    def click():
        nonlocal clicks
        clicks += 1

    click()
    click()
    click()
    print("Clicks:", clicks)


track_clicks()
```

Результат:

```text
Clicks: 3
```

### Вправа 3

```python
def make_averager():
    total = 0
    count = 0

    def add(value):
        nonlocal total, count
        total += value
        count += 1
        return total / count

    return add


avg = make_averager()
print(avg(10))
print(avg(20))
print(avg(60))
```

Результат:

```text
10.0
15.0
30.0
```

І `total`, і `count` перепризначаються через `+=`, тож обидві змінні треба оголосити як `nonlocal`.

### Вправа 4

```python
def make_account(balance):
    def deposit(amount):
        nonlocal balance
        balance += amount
        return balance

    def withdraw(amount):
        nonlocal balance
        if amount > balance:
            raise ValueError("insufficient funds")
        balance -= amount
        return balance

    def get_balance():
        return balance

    return deposit, withdraw, get_balance


deposit, withdraw, get_balance = make_account(100)
print(deposit(50))
print(withdraw(30))
try:
    withdraw(500)
except ValueError as error:
    print("Error:", error)
print(get_balance())
```

Результат:

```text
150
120
Error: insufficient funds
120
```

Параметр `balance` функції `make_account` — це локальна змінна зовнішньої функції, тож внутрішні функції можуть посилатися на неї через `nonlocal`. `get_balance` лише читає баланс, тому оголошення їй не потрібне.

---

*Джерело: [pythontutorial.net — Python nonlocal](https://www.pythontutorial.net/advanced-python/python-nonlocal/). Адаптовано й доповнено для PyJourney.*
