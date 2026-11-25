# Оператор or

Оператор `or` відповідає на запитання «чи істинне хоча б одне з цього?». Як і `and`, він обчислюється скорочено й повертає один зі своїх операндів, а не обов'язково `True`/`False`. Завдяки цьому `value or default` став популярною ідіомою для запасних значень, і водночас це джерело однієї з найпоширеніших помилок у Python.

## Що ви дізнаєтесь

- Таблицю істинності оператора `or`
- Як працює скорочене обчислення для `or`
- Чому `x or y` повертає перший істинний операнд
- Як задавати значення за замовчуванням через `or` і коли це призводить до помилок
- Як `or` поєднується з `and` (пріоритет) і в чому пастка `x == a or b`
- Коли замість `or` краще взяти `any()`, `min(..., default=...)` чи `|`

## Оператор or і його таблиця істинності

`or` — логічний оператор. Для двох булевих операндів він повертає `True`, якщо **хоча б один** з них істинний, і `False` лише тоді, коли обидва хибні:

| X | Y | X or Y |
|---|---|---|
| True | True | True |
| True | False | True |
| False | True | True |
| False | False | False |

```python
is_admin = False
is_editor = True
can_edit = is_admin or is_editor

print(can_edit)
```

Результат:

```text
True
```

## Скорочене обчислення

Якщо лівий операнд істинний, уже відомо, що результат істинний, тому Python **не обчислює правий операнд**. Це скорочене, або «ліниве», обчислення (short-circuit evaluation). Правий операнд виконується лише тоді, коли лівий хибний:

```python
def check(name, result):
    print(f"evaluating {name}")
    return result


print(check("left", True) or check("right", False))
print("---")
print(check("left", False) or check("right", False))
```

Результат:

```text
evaluating left
True
---
evaluating left
evaluating right
False
```

## or повертає один зі своїх операндів

Кожен об'єкт має логічне значення, тому `or` приймає будь-які операнди. Точне правило таке:

> `x or y` повертає `x`, якщо `x` істинне. Інакше обчислює `y` і повертає `y`.

Іншими словами, `x or y` — це стисла форма такого коду:

```python
x, y = "", "default"

if x:
    result = x
else:
    result = y

print(repr(result))
print(repr(x or y))
```

Результат:

```text
'default'
'default'
```

Ще кілька прикладів, зокрема ланцюжок із кількох `or`, який повертає **перший істинний** операнд, а якщо такого немає — **останній**:

```python
print(repr(0 or 5))
print(repr(3 or 5))
print(repr("" or "default"))
print(repr([] or None))
print(repr(3 or 1 / 0))
print(repr(None or 0 or "found" or "never"))
```

Результат:

```text
5
3
'default'
None
3
'found'
```

`3 or 1 / 0` не генерує `ZeroDivisionError`, бо ділення ніколи не обчислюється.

## Значення за замовчуванням

Оскільки `or` повертає перший істинний операнд, це короткий спосіб задати запасне значення:

```python
value = ""
default = "N/A"

var_name = value or default
print(var_name)
```

Результат:

```text
N/A
```

Якщо `value` хибне (`None`, `""`, `0`, `[]`, ...), `var_name` отримує `default`.

Класичний приклад — введення користувача. Коли користувач просто натискає Enter, `input()` повертає порожній рядок, а порожній рядок хибний:

```python
lang = input("Enter your language: ") or "Python"
print(lang)
```

Приклад запуску в терміналі, коли користувач натискає Enter, нічого не ввівши:

```text
Enter your language:
Python
```

Та сама ідея працює для необов'язкових параметрів функції:

```python
def greet(name=None):
    name = name or "guest"
    return f"Hello, {name}!"


print(greet("Olena"))
print(greet())
print(greet(""))
```

Результат:

```text
Hello, Olena!
Hello, guest!
Hello, guest!
```

### Запасний варіант для порожніх колекцій

Вбудована функція `min()` генерує `ValueError`, якщо отримує порожній ітерований об'єкт:

```python
def get_data(args=None):
    if args:
        return [1, 2, 3]
    return []


lowest = min(get_data(args=True))
print(lowest)

lowest = min(get_data())
print(lowest)
```

Результат (другий виклик падає, показано останній рядок traceback):

```text
1
ValueError: min() iterable argument is empty
```

`or` може замінити порожній список на список зі значенням за замовчуванням. А починаючи з Python 3.4, `min()` і `max()` приймають ще й іменований аргумент `default`, який виражає намір прямолінійніше:

```python
def get_data(args=None):
    if args:
        return [1, 2, 3]
    return []


lowest = min(get_data() or [0])
print(lowest)

lowest = min(get_data(), default=0)
print(lowest)

lowest = min(get_data(args=True), default=0)
print(lowest)
```

Результат:

```text
0
0
1
```

`get_data() or [0]`: порожній список хибний, тому `or` обчислює й повертає `[0]`, а `min([0])` дорівнює `0`.

## Пастка: допустимі значення, які є хибними

`value or default` замінює **будь-яке** хибне значення, а не лише `None`. Якщо `0`, `""`, `False` чи порожній список — цілком законні значення, `or` мовчки їх відкидає:

```python
settings = {"retries": 0, "name": ""}

retries = settings.get("retries") or 3
print(retries)  # неправильно: користувач явно задав 0 повторних спроб

retries = settings.get("retries")
if retries is None:
    retries = 3
print(retries)

print(settings.get("retries", 3))
print(settings.get("timeout", 30))
```

Результат:

```text
3
0
0
30
```

Практичні правила:

- Використовуйте `value or default`, коли **всі** хибні значення означають «не задано» (типово для імен та іншого тексту).
- Використовуйте `default if value is None else value` (або явне `if value is None:`), коли `0`, `""` чи `False` — допустимі значення.
- Для словників `d.get(key, default)` підставляє значення за замовчуванням лише тоді, коли ключа **немає**.

## Пріоритет: or разом з and

`and` має вищий пріоритет, ніж `or`, тому `a or b and c` означає `a or (b and c)`:

```python
is_admin, is_owner, is_locked = True, False, True

print(is_admin or is_owner and not is_locked)
print(is_admin or (is_owner and not is_locked))
print((is_admin or is_owner) and not is_locked)
```

Результат:

```text
True
True
False
```

Перші два рядки — один і той самий вираз. Третій групує інакше й дає іншу відповідь. Поєднуючи `and` і `or`, пишіть дужки явно, навіть якщо вони збігаються з типовим пріоритетом.

## Пастка `x == a or b`

Дуже поширена помилка новачків — записувати порівняння з кількома значеннями так, як це звучить уголос:

```python
color = "green"

print(repr(color == "red" or "blue"))

if color == "red" or "blue":
    print("this always runs!")

print(color == "red" or color == "blue")
print(color in ("red", "blue"))
```

Результат:

```text
'blue'
this always runs!
False
False
```

Python читає `color == "red" or "blue"` як `(color == "red") or "blue"`. Порівняння дає `False`, тож `or` повертає `"blue"` — непорожній, а отже істинний рядок. Умова справджується завжди. Або повторюйте порівняння для кожного значення, або, що краще, використовуйте оператор належності `in`.

## any(): or для багатьох значень

`any(iterable)` повертає `True`, якщо хоча б один елемент істинний. Це читабельна форма довгого ланцюжка `or`, і з виразом-генератором вона зупиняється на першому істинному елементі:

```python
def is_negative(n):
    print(f"checking {n}")
    return n < 0


print(any(is_negative(n) for n in [3, -1, 2]))
print(any([]))
print(any(["", 0, None]))
```

Результат:

```text
checking 3
checking -1
True
False
False
```

На відміну від `or`, `any()` завжди повертає справжній `bool`. Для порожнього ітерованого об'єкта вона повертає `False`.

## or проти |

Оператор `|` схожий на вигляд, але це інший інструмент. Він ніколи не обчислюється скорочено, а його зміст залежить від типів операндів:

```python
print(True | False)
print(6 | 3)                     # побітово: 110 | 011 = 111
print({1, 2} | {2, 3})           # об'єднання множин
print({"a": 1} | {"b": 2})       # злиття словників (Python 3.9+)
print(int | None)                # об'єднання типів (Python 3.10+)
```

Результат:

```text
True
7
{1, 2, 3}
{'a': 1, 'b': 2}
int | None
```

Як і `&`, оператор `|` має вищий пріоритет, ніж порівняння, тож `x > 0 | x < -5` означає зовсім не те, що здається. Для логіки використовуйте `or`.

## Типові помилки

- **Писати `x == a or b`.** Такий вираз завжди істинний, якщо `b` істинне. Використовуйте `x in (a, b)` або `x == a or x == b`.
- **Задавати значення за замовчуванням через `or`, коли хибні значення допустимі.**

  ```python
  def connect(timeout=None):
      timeout = timeout or 30
      return f"timeout={timeout}"


  print(connect(5))
  print(connect(0))   # 0 означає «не чекати», але перетворився на 30
  ```

  Результат:

  ```text
  timeout=5
  timeout=30
  ```

  Виправлення: `timeout = 30 if timeout is None else timeout`.

- **Очікувати bool.** `name or "guest"` повертає рядок. Зазвичай саме це й потрібно, але пам'ятайте про це, коли зберігаєте чи порівнюєте результат. Якщо потрібне саме `True`/`False`, обгорніть вираз у `bool()` або скористайтеся `any()`.
- **Змішувати `and` і `or` без дужок.** `a or b and c` — це `a or (b and c)`. Робіть групування явним.
- **Використовувати `|` замість `or`.** `|` обчислює обидві частини й має інший пріоритет.
- **Писати `min(data or [0])`, маючи на увазі `min(data, default=0)`.** Працює і те, і те, але аргумент `default` точно описує ваш намір.

## Підсумок

- `x or y` істинне, якщо хоча б один операнд істинний.
- `or` обчислюється скорочено: якщо `x` істинне, `y` не обчислюється.
- `x or y` повертає `x`, якщо воно істинне, інакше `y`. Ланцюжок повертає перший істинний операнд або останній.
- `value or default` — стислий спосіб задати запасне значення, але він замінює **всі** хибні значення. Коли `0`, `""` чи `False` допустимі, використовуйте перевірку `is None` або `dict.get(key, default)`.
- `and` має вищий пріоритет, ніж `or`. Змішуючи їх, ставте дужки.
- `x == a or b` — це помилка. Пишіть `x in (a, b)`.
- `any()` — це `or` для колекції, і вона завжди повертає `bool`. `min()`/`max()` мають аргумент `default` для порожніх даних.

## Практика

### Вправа 1: Передбачте результат

Запишіть, що виведе кожен рядок, а потім запустіть код і перевірте.

```python
print(repr(0 or 1))
print(repr(1 or 0))
print(repr("" or "default"))
print(repr([] or {}))
print(repr(None or 0 or ""))
print(repr(0 or 2 or 3))
print(repr("a" or 1 / 0))
print(repr(False or None))
```

### Вправа 2: Виправте перевірку вихідних

У цій функції є помилка. Поясніть, що повертає `is_weekend("Mon")` і чому, а потім виправте функцію.

```python
def is_weekend(day):
    return day == "Sat" or "Sun"


print(is_weekend("Sat"), is_weekend("Mon"))
```

### Вправа 3: Перше значення, що не є None

Програма читає налаштування з трьох місць у такому порядку: значення з командного рядка, значення зі змінної оточення та вбудоване значення за замовчуванням. Перші два можуть дорівнювати `None` (не задано). `0` — допустиме значення. Напишіть функцію `get_setting(cli_value, env_value, default)`, яка повертає перше значення, що не є `None`. Потім порівняйте `get_setting(0, 5, 10)` з ланцюжком `0 or 5 or 10` і поясніть різницю.

### Вправа 4: Ім'я для відображення

Напишіть функцію `display_name(user)` для словника, який може містити ключі `"nickname"` і `"full_name"`. Поверніть нікнейм; якщо його немає або він порожній — повне ім'я; а якщо порожні або відсутні обидва — `"Anonymous"`. Використайте один вираз з `or`. Поясніть, чому тут, на відміну від вправи 3, `or` — правильний вибір.

## Розв'язки

### Вправа 1

Результат:

```text
1
1
'default'
{}
''
2
'a'
None
```

`or` повертає перший істинний операнд (`1`, `1`, `'default'`, `2`, `'a'`). Коли всі операнди хибні, він повертає останній (`{}`, `''`, `None`). `1 / 0` ніколи не обчислюється.

### Вправа 2

`is_weekend("Mon")` повертає `'Sun'`. Вираз — це `(day == "Sat") or "Sun"`: порівняння дає `False`, тож `or` повертає непорожній рядок `"Sun"`, який є істинним. Функція «погоджується» для будь-якого дня.

```python
def is_weekend(day):
    return day in ("Sat", "Sun")


print(is_weekend("Sat"), is_weekend("Sun"), is_weekend("Mon"))
```

Результат:

```text
True True False
```

### Вправа 3

```python
def first_not_none(*values):
    for value in values:
        if value is not None:
            return value
    return None


def get_setting(cli_value, env_value, default):
    return first_not_none(cli_value, env_value, default)


print(get_setting(None, "8080", "80"))
print(get_setting(None, None, 10))
print(get_setting(0, 5, 10))
print(0 or 5 or 10)   # ланцюжок `or` пропускає допустиме значення 0
```

Результат:

```text
8080
10
0
5
```

Ланцюжок `or` пропускає значення `0` з командного рядка, бо воно хибне, і переходить до `5`. Перевірка `is not None` вважає `0` справжнім значенням.

### Вправа 4

```python
def display_name(user):
    return user.get("nickname") or user.get("full_name") or "Anonymous"


print(display_name({"nickname": "max", "full_name": "Maksym K."}))
print(display_name({"nickname": "", "full_name": "Maksym K."}))
print(display_name({"full_name": ""}))
print(display_name({}))
```

Результат:

```text
max
Maksym K.
Anonymous
Anonymous
```

Тут порожній рядок *не є* змістовним іменем, тож пропуск усіх хибних значень (`None` для відсутнього ключа та `""`) — саме та поведінка, яка потрібна.

---

*Джерело: [pythontutorial.net — How to Use the Python or Operator More Effectively](https://www.pythontutorial.net/advanced-python/python-or/). Адаптовано й доповнено для PyJourney.*
