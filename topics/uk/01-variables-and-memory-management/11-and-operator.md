# Оператор and

Оператор `and` поєднує умови: «має виконуватися і це, **і** те». У Python він робить більше, ніж просто повертає `True` чи `False`. Він припиняє обчислення, щойно відповідь стає відомою (скорочене обчислення), і повертає один зі своїх операндів, а не обов'язково булеве значення. Обидві властивості важливі, щоб писати безпечні умови й розуміти чужий код.

## Що ви дізнаєтесь

- Таблицю істинності оператора `and`
- Що таке скорочене обчислення і як використовувати його як «запобіжник»
- Чому `x and y` повертає `x` або `y`, а не `True`/`False`
- Як `and` поєднується з `or`, `not` і порівняннями (пріоритет операторів)
- Чим `and` відрізняється від побітового `&`
- Коли `all()` кращий за довгий ланцюжок `and`

## Оператор and і його таблиця істинності

`and` — логічний оператор. Найчастіше його застосовують до двох булевих виразів, і він повертає `True` лише тоді, коли **обидва** істинні:

| X | Y | X and Y |
|---|---|---|
| True | True | True |
| True | False | False |
| False | True | False |
| False | False | False |

З таблиці варто запам'ятати дві речі:

- Якщо `X` дорівнює `False`, результат — `False` незалежно від `Y`.
- Якщо `X` дорівнює `True`, результат просто збігається з `Y`.

```python
timeout = False
pending_job = True
execute_next = timeout and pending_job

print(execute_next)
```

Результат:

```text
False
```

`timeout` дорівнює `False`, тож увесь вираз дорівнює `False`.

## Скорочене обчислення

Оскільки хибний лівий операнд уже визначає результат, Python у такому разі **не обчислює правий операнд**. Це називають скороченим обчисленням (short-circuit evaluation).

Ось код, який падає з помилкою:

```python
a = 10
b = 0
c = a / b
print(c)
```

Результат (останній рядок traceback):

```text
ZeroDivisionError: division by zero
```

Сховайте ділення за `and` — і помилка зникне:

```python
a = 10
b = 0
c = b and a / b
print(c)
```

Результат:

```text
0
```

`b` дорівнює `0`, тобто є хибним значенням. Python уже знає результат, тому `a / b` ніколи не обчислюється. Якщо `b` не нуль, права частина виконується як звичайно:

```python
a = 10
b = 5
c = b and a / b
print(c)
```

Результат:

```text
2.0
```

Скорочене обчислення можна побачити на власні очі за допомогою функції, яка повідомляє про кожен виклик:

```python
def check(name, result):
    print(f"evaluating {name}")
    return result


print(check("left", False) and check("right", True))
print("---")
print(check("left", True) and check("right", True))
```

Результат:

```text
evaluating left
False
---
evaluating left
evaluating right
True
```

### `and` як запобіжник

Завдяки скороченому обчисленню лівий операнд може «захищати» правий: ліва частина перевіряє, що праву безпечно обчислювати:

```python
class User:
    def __init__(self, name, is_active):
        self.name = name
        self.is_active = is_active


def greet(user):
    if user is not None and user.is_active:
        print(f"Welcome back, {user.name}!")
    else:
        print("Please sign in.")


greet(User("Olena", True))
greet(User("Taras", False))
greet(None)

items = []
if items and items[0] == "urgent":
    print("handle urgent item first")
print("no crash on an empty list")
```

Результат:

```text
Welcome back, Olena!
Please sign in.
Please sign in.
no crash on an empty list
```

Для `None` вираз `user.is_active` не обчислюється, тож `AttributeError` не виникає. Для порожнього списку не обчислюється `items[0]`, тож немає й `IndexError`. **Порядок операндів важливий**: запобіжник має стояти першим.

## and повертає один зі своїх операндів

`and` працює з будь-якими об'єктами, а не лише з булевими, бо кожен об'єкт має логічне значення. Точне правило таке:

> `x and y` повертає `x`, якщо `x` хибне. Інакше обчислює `y` і повертає `y`.

Отже, результат — це завжди один з операндів:

```python
print(repr(0 and 5))
print(repr(3 and 5))
print(repr("" and "hi"))
print(repr([1] and "hi"))
print(repr(None and 1))
print(repr(1 and 2 and 3))
print(repr(1 and 0 and 3))
```

Результат:

```text
0
5
''
'hi'
None
3
0
```

Якщо операндів кілька, `a and b and c` повертає **перший хибний** операнд, а якщо всі істинні — **останній**.

Тому вираз `c = b and a / b` рівнозначний такій інструкції `if`:

```python
a, b = 10, 0

c = b and a / b

if b:
    d = a / b
else:
    d = b

print(c, d)
```

Результат:

```text
0 0
```

Коли результат потрапляє в умову `if` чи `while`, усе це не має значення: Python дивиться лише на логічне значення, а логічне значення `x and y` точно дорівнює `bool(x) and bool(y)`. Значення має тоді, коли ви зберігаєте чи повертаєте результат, як показує наступний приклад.

## Приклад: обчислення середнього

Ось функція, яка повертає середнє значення своїх аргументів або `0`, якщо аргументів немає:

```python
def avg(*numbers):
    total = sum(numbers)
    n = len(numbers)
    if n > 0:
        return total / n
    return 0


if __name__ == "__main__":
    print(avg(1, 2, 3))
    print(avg())
```

Результат:

```text
2.0
0
```

Блок `if` можна скоротити за допомогою `and`. Коли `n` дорівнює `0`, вираз повертає `n` (тобто `0`) без ділення. Інакше він повертає `total / n`:

```python
def avg(*numbers):
    total = sum(numbers)
    n = len(numbers)
    return n and total / n


print(avg(1, 2, 3))
print(avg())
print(type(avg(1, 2, 3)).__name__, type(avg()).__name__)
```

Результат:

```text
2.0
0
float int
```

Це працює, але зверніть увагу на останній рядок: в одному випадку функція повертає `float`, а в іншому — `int`. До того ж багатьом читачам доведеться зупинитися й подумати, що означає `n and total / n`. Умовний вираз такий самий короткий, але явніший, і дозволяє вибрати тип запасного значення:

```python
def avg(*numbers):
    n = len(numbers)
    return sum(numbers) / n if n else 0.0


print(avg(1, 2, 3))
print(avg())
```

Результат:

```text
2.0
0.0
```

> **Порада:** користуйтеся тим, що `and` повертає операнд, коли це робить код зрозумілішим, наприклад `text and text[0]`. Якщо трюк доводиться пояснювати в коментарі, то `if` чи умовний вираз зазвичай кращий вибір.

## Пріоритет: not, and, or

Логічні оператори мають різний пріоритет: найвищий у `not`, далі `and`, потім `or`. Усі оператори порівняння (`<`, `==`, `in`, `is`, ...) мають вищий пріоритет за будь-який із них.

```python
print(True or False and False)    # спершу and: True or (False and False)
print((True or False) and False)

x = 5
print(not x > 3 and x < 10)       # (not (x > 3)) and (x < 10)
print(x > 0 and x < 10)
print(0 < x < 10)                 # ланцюжок порівнянь, той самий зміст
```

Результат:

```text
True
False
False
True
True
```

Коли змішуєте `and` і `or`, ставте дужки, навіть якщо вони не обов'язкові. Читач не повинен пам'ятати таблицю пріоритетів.

Ланцюжок порівнянь на кшталт `0 < x < 10` означає `0 < x and x < 10`, але `x` обчислюється лише раз. Він також обчислюється скорочено.

## and проти побітового &

`&` — **побітовий** оператор AND. Це інший інструмент:

- Він завжди обчислює обидва операнди (без скороченого обчислення).
- Для цілих чисел він поєднує біти; для значень `bool` повертає `bool`.
- Він має **вищий** пріоритет, ніж порівняння, що призводить до несподіваних результатів.

```python
print(True & False)
print(6 & 3)       # побітово: 110 & 011 = 010

x = 5
print(x > 0 and x < 3)
print(x > 0 & x < 3)       # розбирається як x > (0 & x) < 3
print((x > 0) & (x < 3))
```

Результат:

```text
False
2
False
True
False
```

Четвертий рядок неправильний, і це легко пропустити: спершу обчислюється `0 & x`, що дає `0`, а далі виходить ланцюжок порівнянь `x > 0 < 3`. До того ж `&` не має скороченого обчислення:

```python
def check(name, result):
    print(f"evaluating {name}")
    return result


print(check("left", False) & check("right", True))
```

Результат:

```text
evaluating left
evaluating right
False
```

Для логіки використовуйте `and`. З `&` для булевих значень ви зустрінетеся переважно в NumPy і pandas, де `and` не може працювати поелементно. Там порівняння завжди треба брати в дужки: `(a > 0) & (a < 3)`.

## all(): and для багатьох умов

Коли умов багато або є колекція значень, `all()` читається краще за довгий ланцюжок `and`. `all(iterable)` повертає `True`, якщо кожен елемент істинний. З виразом-генератором вона теж обчислюється скорочено й зупиняється на першому хибному елементі:

```python
order = {"paid": True, "items": 3, "address": ""}

ready = all([
    order["paid"],
    order["items"] > 0,
    order["address"],
])
print(ready)


def positive(n):
    print(f"checking {n}")
    return n > 0


print(all(positive(n) for n in [3, -1, 2]))
print(all([]))
```

Результат:

```text
False
checking 3
checking -1
False
True
```

Дві деталі: *список* усередині `all([...])` будується повністю ще до запуску `all()`, тож усі його елементи обчислюються; «лінивий» лише генератор. А `all()` для порожнього ітерованого об'єкта повертає `True`, бо в ньому немає жодного хибного елемента.

## Типові помилки

- **Ставити запобіжник другим.** Лівий операнд обчислюється першим, тож перевірка, яка захищає праву частину, має стояти ліворуч:

  ```python
  items = []
  if items[0] == "urgent" and items:
      print("urgent")
  ```

  Результат (останній рядок traceback):

  ```text
  IndexError: list index out of range
  ```

  Пишіть `if items and items[0] == "urgent":`.

- **Очікувати, що `and` повертає bool.** Якщо ви зберігаєте чи виводите результат, ви отримуєте один з операндів:

  ```python
  name = None
  display = name and name.upper()
  print(f"Hello, {display}!")
  ```

  Результат:

  ```text
  Hello, None!
  ```

  Якщо потрібне справжнє булеве значення, пишіть `bool(x and y)`, або явно обробіть запасний варіант.

- **Використовувати `&` замість `and` з порівняннями.** `x > 0 & x < 3` означає зовсім не те, що здається, а `&` ніколи не обчислюється скорочено.
- **Ховати побічні ефекти за `and`.** `is_valid and save()` мовчки пропускає `save()`, коли `is_valid` хибне. Явне `if is_valid: save()` прямо каже, що ви маєте на увазі.
- **Різні типи результату.** `n and total / n` в одному випадку повертає `0` (`int`), а в іншому — `float`. Якщо тип важливий, віддайте перевагу умовному виразу.

## Підсумок

- `x and y` істинне лише тоді, коли обидва операнди істинні.
- `and` обчислюється скорочено: якщо `x` хибне, `y` не обчислюється. Використовуйте це, щоб захищати ризиковані операції, і ставте запобіжник першим.
- `x and y` повертає `x`, якщо `x` хибне, інакше — `y`. Ланцюжок повертає перший хибний операнд або останній.
- В умовах `if`/`while` важить лише логічне значення. Коли зберігаєте результат, пам'ятайте, що це може бути не `bool`.
- Пріоритет: порівняння, потім `not`, потім `and`, потім `or`. Змішуючи їх, ставте дужки.
- `&` — побітовий AND: без скороченого обчислення і з вищим пріоритетом, ніж порівняння.
- `all()` — читабельна заміна довгого ланцюжка `and`, яка з генераторами теж обчислюється скорочено.

## Практика

### Вправа 1: Передбачте результат

Не запускаючи код, запишіть, що виведе кожен рядок. Потім перевірте.

```python
print(repr(0 and 1))
print(repr(1 and 0))
print(repr("a" and "b"))
print(repr([] and None))
print(repr(None and []))
print(repr(2 and 3 and 4))
print(repr(2 and 0 and 4))
print(repr(True and "yes"))
```

### Вправа 2: Перший символ без ризику

Напишіть однорядкову функцію `first_char(text)`, яка повертає перший символ `text`. Для порожнього рядка вона має повертати `""`, а для `None` — `None`, без винятків і без інструкції `if`.

### Вправа 3: Виправте падіння

Ця функція визначає, чи має кошик право на знижку (середня ціна товару більша за 50). Для порожнього кошика вона падає. Виправте її, змінивши лише порядок умов, і перевірте на порожньому кошику.

```python
def has_discount(cart):
    return cart["total"] / cart["items"] > 50 and cart["items"] > 0


print(has_discount({"total": 120, "items": 2}))
print(has_discount({"total": 0, "items": 0}))
```

### Вправа 4: Надійність пароля

Напишіть функцію `is_strong(password)`, яка повертає `True`, лише якщо пароль має щонайменше 8 символів **і** містить хоча б одну цифру, одну велику та одну малу літеру. Використайте один `return` з `and` та `any()`. Перевірте функцію на `"short1A"`, `"longpassword"`, `"LongPassword"` і `"LongPassw0rd"`.

## Розв'язки

### Вправа 1

Результат:

```text
0
0
'b'
[]
None
4
0
'yes'
```

`and` повертає перший хибний операнд (`0`, `0`, `[]`, `None`, `0`), а якщо такого немає — останній операнд (`'b'`, `4`, `'yes'`).

### Вправа 2

```python
def first_char(text):
    return text and text[0]


print(repr(first_char("Python")))
print(repr(first_char("")))
print(repr(first_char(None)))
```

Результат:

```text
'P'
''
None
```

Для `""` і `None` лівий операнд хибний, тому він повертається як є, а `text[0]` не обчислюється.

### Вправа 3

```python
def has_discount(cart):
    return cart["items"] > 0 and cart["total"] / cart["items"] > 50


print(has_discount({"total": 120, "items": 2}))
print(has_discount({"total": 120, "items": 3}))
print(has_discount({"total": 0, "items": 0}))
```

Результат:

```text
True
False
False
```

Коли запобіжник стоїть першим, ділення пропускається, якщо `cart["items"]` дорівнює `0`.

### Вправа 4

```python
def is_strong(password):
    return (
        len(password) >= 8
        and any(ch.isdigit() for ch in password)
        and any(ch.isupper() for ch in password)
        and any(ch.islower() for ch in password)
    )


for password in ["short1A", "longpassword", "LongPassword", "LongPassw0rd"]:
    print(f"{password:<14} {is_strong(password)}")
```

Результат:

```text
short1A        False
longpassword   False
LongPassword   False
LongPassw0rd   True
```

Дужки дають змогу розбити вираз на кілька рядків. Завдяки скороченому обчисленню дешева перевірка довжини виконується першою, а перебір символів відбувається лише доти, доки всі попередні перевірки проходять.

---

*Джерело: [pythontutorial.net — Python and Logical Operator](https://www.pythontutorial.net/advanced-python/python-and/). Адаптовано й доповнено для PyJourney.*
