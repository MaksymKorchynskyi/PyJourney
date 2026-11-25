# Десяткові числа (Decimal)

Двійкові float не можуть точно зберегти більшість десяткових дробів, тому `0.1 + 0.1 + 0.1` не дорівнює `0.3`. Стандартний модуль `decimal` пропонує тип `Decimal`: число з рухомою комою, що зберігається в **десятковій системі**, з точністю та округленням, якими керуєте ви. Це правильний інструмент для грошей, цін, податків і будь-якої галузі, де числа записують у десятковому вигляді й вони мають поводитися так само, як на папері.

## Що ви дізнаєтесь

- Чому `Decimal("0.1")` точне, а float `0.1` — ні, і де `Decimal` усе ж неточний
- Як правильно створювати значення `Decimal` і чому не з float
- Як `Decimal` зберігає знак, цифри та експоненту і чому `Decimal("2.50")` пам'ятає кінцевий нуль
- Як контекст керує точністю, округленням і сигналами про помилки — глобально й локально
- Як округлювати гроші через `quantize()` і вісім режимів округлення
- Чим арифметика `Decimal` відрізняється від `int` і `float`: `//`, `%`, змішування типів і функції `math`

## Проблема двійкових float

```python
x = 0.1
y = 0.1
z = 0.1

s = x + y + z

print(s)
print(s == 0.3)
```

Результат:

```text
0.30000000000000004
False
```

Float `0.1` насправді є двійковим дробом, найближчим до однієї десятої, і він трохи більший за неї (подробиці — в темі «Дробові числа (float)»). Крихітні похибки накопичуються. Якщо створити `Decimal` з рядків, те саме обчислення стає точним:

```python
from decimal import Decimal

x = Decimal("0.1")
y = Decimal("0.1")
z = Decimal("0.1")

s = x + y + z

print(s)
print(s == Decimal("0.3"))
print(repr(s - Decimal("0.3")))
```

Результат:

```text
0.3
True
Decimal('0.0')
```

`Decimal` зберігає десяткові цифри, тож `0.1` — це рівно одна десята, а додавання, віднімання й множення таких чисел дає ті результати, яких навчали в школі.

### Точний, але не безмежно точний

`Decimal` точний для чисел, які можна записати **скінченною** кількістю десяткових цифр, що вміщується в поточну точність. Одну третю так записати не можна, тож вона округлюється, за замовчуванням до 28 значущих цифр:

```python
from decimal import Decimal

third = Decimal(1) / Decimal(3)
print(third)
print(third * 3)
```

Результат:

```text
0.3333333333333333333333333333
0.9999999999999999999999999999
```

`Decimal` усуває розбіжність між двійковим і десятковим записом, а не округлення як таке. Для точної арифметики з довільними дробами, як-от `1/3`, використовуйте `fractions.Fraction`.

## Створення значень Decimal

```text
Decimal(value="0", context=None)
```

`value` може бути рядком, цілим числом, кортежем, float або іншим `Decimal`. Найчастіше ви використовуватимете **рядок**:

```python
from decimal import Decimal

print(Decimal("3.14"))
print(Decimal("  -0.001\n"))     # пробіли навколо ігноруються
print(Decimal("1_000.50"))       # підкреслення між цифрами
print(Decimal("2.5e-3"))
print(Decimal(42))
print(Decimal())
print(Decimal("Infinity"), Decimal("-inf"), Decimal("NaN"))
```

Результат:

```text
3.14
-0.001
1000.50
0.0025
42
0
Infinity -Infinity NaN
```

### Не створюйте Decimal із float

`Decimal(0.1)` дозволено, але float перетворюється **точно**, разом із двійковою похибкою:

```python
from decimal import Decimal

print(Decimal(0.1))
print(Decimal("0.1"))
print(Decimal(str(0.1)))
print(Decimal(0.5))        # 0.5 у двійковому вигляді точне
```

Результат:

```text
0.1000000000000000055511151231257827021181583404541015625
0.1
0.1
0.5
```

На момент виклику `Decimal(0.1)` літерал `0.1` уже став двійковим float, і інформація «одна десята» втрачена. Створюйте десяткові числа з рядків, цілих чисел або кортежів. Якщо float надходить ззовні, `Decimal(str(x))` дасть коротку десяткову форму, яку Python виводить для цього числа.

### З кортежу

Кортеж описує десяткове число трьома частинами: **знак** (`0` — додатне, `1` — від'ємне), кортеж **цифр** і ціла **експонента** (степінь десяти). Наприклад, `3.14` — це `314 * 10**-2`:

```python
from decimal import Decimal

x = Decimal((0, (3, 1, 4), -2))
print(x)
print(Decimal((1, (1, 2, 5), -1)))
print(Decimal("12.50").as_tuple())
```

Результат:

```text
3.14
-12.5
DecimalTuple(sign=0, digits=(1, 2, 5, 0), exponent=-2)
```

`as_tuple()` виконує зворотне перетворення. Саме у вигляді трійки «знак — цифри — експонента» `Decimal` і зберігається всередині.

### Некоректні дані

Рядок, який не є коректним числом, генерує `decimal.InvalidOperation` (підклас `ArithmeticError`), а не `ValueError`:

```python
from decimal import Decimal, InvalidOperation

try:
    Decimal("12,50")
except InvalidOperation as error:
    print("InvalidOperation:", error)
```

Результат:

```text
InvalidOperation: [<class 'decimal.ConversionSyntax'>]
```

### Decimal.from_number() (Python 3.14+)

У Python 3.14 з'явився метод класу `Decimal.from_number()`. Він приймає значення `int`, `float` і `Decimal`, але відхиляє рядки, і це корисно, коли рядок на вході свідчить про помилку в програмі:

```python
from decimal import Decimal

print(Decimal.from_number(42))
print(Decimal.from_number(0.25))

try:
    Decimal.from_number("1.5")
except TypeError as error:
    print("TypeError:", error)
```

Результат:

```text
42
0.25
TypeError: conversion from str to Decimal is not supported
```

## Кінцеві нулі мають значення

Оскільки `Decimal` зберігає цифри та експоненту, `Decimal("1.30")` і `Decimal("1.3")` **рівні**, але не однакові: перше пам'ятає два знаки після коми. Арифметика враховує це природним чином:

```python
from decimal import Decimal

a = Decimal("1.30")
b = Decimal("1.20")
print(a + b)
print(Decimal("2.5") * Decimal("2.50"))
print(a == Decimal("1.3"))
print(repr(Decimal("2.50").normalize()))
print(repr(Decimal("100").normalize()))
```

Результат:

```text
2.50
6.250
True
Decimal('2.5')
Decimal('1E+2')
```

- Додавання зберігає більшу кількість знаків після коми: `1.30 + 1.20 = 2.50`, як ви записали б у рахунку.
- Множення додає кількості знаків: у `2.5 * 2.50` їх три.
- `normalize()` прибирає кінцеві нулі. Обережно: для цілих чисел результат може опинитися в експоненційному записі, як-от `1E+2`.

## Контекст: точність, округлення та сигнали

Кожна арифметична операція над `Decimal` виконується в певному **контексті** — об'єкті, який визначає:

- `prec` — кількість **значущих цифр** у результатах (за замовчуванням `28`);
- `rounding` — як результати округлюються до цієї точності (за замовчуванням `ROUND_HALF_EVEN`);
- `traps` і `flags` — які виняткові ситуації генерують виняток і які вже траплялися;
- `Emin` і `Emax` — діапазон експоненти.

`decimal.getcontext()` повертає поточний контекст. Кожен потік має власний поточний контекст, тож зміна в одному потоці не впливає на інші:

```python
import decimal

ctx = decimal.getcontext()

print(ctx.prec)
print(ctx.rounding)
print(ctx)
```

Результат:

```text
28
ROUND_HALF_EVEN
Context(prec=28, rounding=ROUND_HALF_EVEN, Emin=-999999, Emax=999999, capitals=1, clamp=0, flags=[], traps=[InvalidOperation, DivisionByZero, Overflow])
```

Режими округлення — це константи модуля, як-от `decimal.ROUND_HALF_UP`. Їхні значення — звичайні рядки на зразок `'ROUND_HALF_UP'`.

### Точність

Точність застосовується до результатів **арифметичних операцій**, а не до конструктора. `Decimal`, створений із рядка, зберігає всі свої цифри:

```python
import decimal
from decimal import Decimal

decimal.getcontext().prec = 2

pi = Decimal("3.14159")
radius = 1

print(pi)

area = pi * radius * radius
print(area)
print(+pi)                          # унарний плюс застосовує контекст
print(Decimal("123456") * 1)        # точність рахує значущі цифри
```

Результат:

```text
3.14159
3.1
3.1
1.2E+5
```

`prec` рахує **значущі цифри, а не знаки після коми**. З `prec=2` вираз `123456 * 1` перетворюється на `1.2E+5`. Для «двох знаків після коми» використовуйте `quantize()`, про який ідеться нижче. Стандартної точності в 28 цифр вистачає для більшості грошових обчислень, а за потреби її можна підняти значно вище.

### Округлення

`round(d, n)` для `Decimal` використовує режим округлення поточного контексту. За замовчуванням це округлення половини до парного (див. тему «Округлення»):

```python
from decimal import Decimal

x = Decimal("2.25")
y = Decimal("3.35")

print(round(x, 1))
print(round(y, 1))
```

Результат:

```text
2.2
3.4
```

На відміну від float `2.25` і `3.35`, ці десяткові числа — точні «половинки». `2.25` іде до парного `2.2`, а `3.35` — до парного `3.4`. Якщо змінити режим округлення в контексті, зміниться й результат:

```python
import decimal
from decimal import Decimal

ctx = decimal.getcontext()
ctx.rounding = decimal.ROUND_HALF_UP

x = Decimal("2.25")
y = Decimal("3.35")

print(round(x, 1))
print(round(y, 1))
```

Результат:

```text
2.3
3.4
```

### Локальні контексти

Присвоєння атрибутам `getcontext()` змінює контекст для **всього** коду поточного потоку, зокрема для бібліотек, які ви викликаєте. Зазвичай зміна потрібна лише для одного фрагмента коду. `decimal.localcontext()` створює копію поточного контексту, робить її активною всередині блоку `with`, а потім відновлює початковий контекст:

```python
import decimal
from decimal import Decimal

x = Decimal("2.25")
y = Decimal("3.35")

with decimal.localcontext() as ctx:
    print("Local context:")
    ctx.rounding = decimal.ROUND_HALF_UP
    print(round(x, 1))
    print(round(y, 1))

print("Global context:")
print(round(x, 1))
print(round(y, 1))
```

Результат:

```text
Local context:
2.3
3.4
Global context:
2.2
3.4
```

Починаючи з Python 3.11, `localcontext()` приймає налаштування також як іменовані аргументи:

```python
from decimal import Decimal, getcontext, localcontext

with localcontext(prec=50):
    print(Decimal(2).sqrt())

print(Decimal(2).sqrt())
print(getcontext().prec)
```

Результат:

```text
1.4142135623730950488016887242096980785696718753769
1.414213562373095048801688724
28
```

### Режими округлення

Модуль `decimal` визначає вісім режимів округлення. Таблиця нижче округлює кілька значень до одного знака після коми кожним із них:

```python
import decimal
from decimal import Decimal

modes = [
    "ROUND_UP", "ROUND_DOWN", "ROUND_CEILING", "ROUND_FLOOR",
    "ROUND_HALF_UP", "ROUND_HALF_DOWN", "ROUND_HALF_EVEN", "ROUND_05UP",
]
values = [Decimal(v) for v in ["2.25", "2.35", "2.31", "-2.25", "2.01"]]
step = Decimal("0.1")

print(f"{'mode':<16}" + "".join(f"{str(v):>7}" for v in values))
for mode in modes:
    rounding = getattr(decimal, mode)
    row = [v.quantize(step, rounding=rounding) for v in values]
    print(f"{mode:<16}" + "".join(f"{str(r):>7}" for r in row))
```

Результат:

```text
mode               2.25   2.35   2.31  -2.25   2.01
ROUND_UP            2.3    2.4    2.4   -2.3    2.1
ROUND_DOWN          2.2    2.3    2.3   -2.2    2.0
ROUND_CEILING       2.3    2.4    2.4   -2.2    2.1
ROUND_FLOOR         2.2    2.3    2.3   -2.3    2.0
ROUND_HALF_UP       2.3    2.4    2.3   -2.3    2.0
ROUND_HALF_DOWN     2.2    2.3    2.3   -2.2    2.0
ROUND_HALF_EVEN     2.2    2.4    2.3   -2.2    2.0
ROUND_05UP          2.2    2.3    2.3   -2.2    2.1
```

| Режим | Правило |
|---|---|
| `ROUND_UP` | від нуля |
| `ROUND_DOWN` | до нуля (відкидання дробової частини) |
| `ROUND_CEILING` | у бік плюс нескінченності |
| `ROUND_FLOOR` | у бік мінус нескінченності |
| `ROUND_HALF_UP` | до найближчого, половинки від нуля |
| `ROUND_HALF_DOWN` | до найближчого, половинки до нуля |
| `ROUND_HALF_EVEN` | до найближчого, половинки до парної цифри (за замовчуванням) |
| `ROUND_05UP` | до нуля, але якщо остання цифра була б 0 або 5 — від нуля |

Назви легко прочитати неправильно. `ROUND_UP` означає «від нуля», а не «в бік плюс нескінченності» (це `ROUND_CEILING`), а `ROUND_HALF_UP` округлює `-2.25` до `-2.3`. Зауважте також, що це налаштування стосується лише `Decimal`. Вбудована `round()` для float завжди округлює половини до парного, хоч би що було в десятковому контексті.

## Округлення грошей через quantize()

`d.quantize(exp)` округлює `d` так, щоб воно мало ту саму експоненту, що й `exp`. `Decimal("0.01")` означає «два знаки після коми» — саме так зазвичай округлюють гроші:

```python
from decimal import Decimal, ROUND_HALF_UP

CENT = Decimal("0.01")

price = Decimal("19.99")
tax_rate = Decimal("0.075")

tax = price * tax_rate
print(tax)
print(tax.quantize(CENT))
print(Decimal("7.325").quantize(CENT))
print(Decimal("7.325").quantize(CENT, rounding=ROUND_HALF_UP))
print(Decimal("5").quantize(CENT))
```

Результат:

```text
1.49925
1.50
7.32
7.33
5.00
```

- Множення зберігає всі цифри (`1.49925`). Коли й як округлювати, вирішуєте ви.
- Без `rounding=` метод `quantize()` використовує режим контексту (половини до парного, тож `7.325 -> 7.32`). Багато податкових і бухгалтерських правил вимагають `ROUND_HALF_UP` — передавайте його явно.
- `quantize()` уміє й **додавати** знаки після коми: `5` стає `5.00`, готовим до виведення.

Якщо результат потребуватиме більше цифр, ніж дозволяє точність, `quantize()` згенерує `InvalidOperation`, а не втратить цифри мовчки.

## Сигнали: коли щось іде не так

Виняткові ситуації в десятковій арифметиці називаються **сигналами** (signals). Кожен із них встановлює **прапорець** (flag) у контексті, а якщо для сигналу ввімкнено **пастку** (trap), ще й генерує виняток. За замовчуванням пастки ввімкнено для `InvalidOperation`, `DivisionByZero` і `Overflow`:

```python
from decimal import Decimal

print(Decimal(1) / Decimal(0))
```

Результат (останній рядок трасування):

```text
decimal.DivisionByZero: [<class 'decimal.DivisionByZero'>]
```

Інші сигнали лише встановлюють прапорець. `Inexact` означає, що результат довелося округлити. Прапорець можна перевірити, а можна ввімкнути для нього пастку й узагалі заборонити округлення:

```python
from decimal import Decimal, Inexact, localcontext

with localcontext() as ctx:
    print(Decimal(1) / Decimal(8), ctx.flags[Inexact])
    print(Decimal(1) / Decimal(3), ctx.flags[Inexact])

with localcontext() as ctx:
    ctx.traps[Inexact] = True
    try:
        Decimal(10) / Decimal(3)
    except Inexact:
        print("the result had to be rounded")
```

Результат:

```text
0.125 False
0.3333333333333333333333333333 True
the result had to be rounded
```

Сигнал `FloatOperation` виявляє випадкове змішування float і десяткових чисел. За замовчуванням пастку для нього вимкнено; якщо її ввімкнути, `Decimal(0.1)` і порівняння на більше/менше з float генеруватимуть виняток:

```python
from decimal import Decimal, FloatOperation, localcontext

print(Decimal("0.1") < 0.2)          # за замовчуванням дозволено, порівняння точне

with localcontext() as ctx:
    ctx.traps[FloatOperation] = True
    try:
        Decimal(0.1)
    except FloatOperation:
        print("FloatOperation: Decimal(0.1)")
    try:
        Decimal("0.1") < 0.2
    except FloatOperation:
        print("FloatOperation: Decimal < float")
```

Результат:

```text
True
FloatOperation: Decimal(0.1)
FloatOperation: Decimal < float
```

Увімкнути цю пастку у фінансовому коді — дешевий спосіб знайти всі місця, куди непомітно потрапляє float.

## Чим відрізняється арифметика Decimal

### Змішування з іншими числовими типами

`Decimal` працює разом з `int`, але арифметика з `float` генерує `TypeError`. Python відмовляється вгадувати, яку точність ви мали на увазі:

```python
from decimal import Decimal

price = Decimal("1.50")
print(price * 3)
print(price + 1)
print(price + 1.5)
```

Результат (останній рядок завершується помилкою, показано останній рядок трасування):

```text
4.50
2.50
TypeError: unsupported operand type(s) for +: 'decimal.Decimal' and 'float'
```

Порівняння з float дозволені й **точні**, тобто порівнюють зі справжнім двійковим значенням float:

```python
from decimal import Decimal

print(Decimal("0.1") == 0.1)
print(Decimal("0.5") == 0.5)
```

Результат:

```text
False
True
```

### `//` і `%` відкидають дробову частину

Для цілих чисел `//` округлює вниз, а `%` набуває знака дільника (див. теми «Цілочисельне ділення (floor division)» та «Остача від ділення (modulo)»). `Decimal` натомість дотримується специфікації General Decimal Arithmetic: `//` повертає цілу частину частки, **відкидаючи дробову частину в бік нуля**, а `%` набуває знака **діленого**. Тотожність `x == y * (x // y) + x % y` при цьому зберігається:

```python
from decimal import Decimal

x, y = Decimal(-7), Decimal(4)
print(x // y, x % y, divmod(x, y))
print(-7 // 4, -7 % 4, divmod(-7, 4))
print(y * (x // y) + x % y == x)
```

Результат:

```text
-1 -3 (Decimal('-1'), Decimal('-3'))
-2 1 (-2, 1)
True
```

З додатними операндами результати такі самі, як для цілих чисел. З від'ємними не замінюйте `int` на `Decimal` (і навпаки) без перевірки.

### Математичні функції

Функції модуля `math` спершу перетворюють `Decimal` на `float`, тож результатом буде float із точністю float. `Decimal` має власні методи для найпоширеніших функцій, які обчислюються з точністю контексту:

```python
import math
from decimal import Decimal

two = Decimal(2)
print(math.sqrt(two), type(math.sqrt(two)))
print(two.sqrt())
print(Decimal(1).exp())
print(Decimal(1000).log10())
print(two ** 10, two ** Decimal("0.5"))
```

Результат:

```text
1.4142135623730951 <class 'float'>
1.414213562373095048801688724
2.718281828459045235360287471
3
1024 1.414213562373095048801688724
```

Серед доступних методів — `sqrt()`, `exp()`, `ln()`, `log10()` та оператор `**`. Тригонометричних функцій немає. Для них доведеться або змиритися з точністю float, або взяти сторонню бібліотеку, як-от `mpmath`.

## Коли використовувати Decimal

| Потреба | Добрий вибір |
|---|---|
| Гроші, ціни, податки, рахунки | `Decimal` або цілі центи (копійки) |
| Десяткові дані, які мають точно зберігатися (`"19.99"`) | `Decimal` |
| Налаштовувана точність чи правила округлення | `Decimal` |
| Точні дроби на зразок `1/3` | `fractions.Fraction` |
| Наука, графіка, великі обсяги даних, швидкість | `float` |

`Decimal` реалізовано мовою C (починаючи з Python 3.3), і як для своїх можливостей він швидкий, але все одно помітно повільніший за апаратні float. Використовуйте його там, де важлива десяткова точність, а не всюди.

## Типові помилки

- **Створювати Decimal із float.** `Decimal(0.1)` дорівнює `0.1000000000000000055...`. Передавайте рядок: `Decimal("0.1")`.
- **Вважати `prec` кількістю знаків після коми.** `prec` рахує значущі цифри. Для двох знаків після коми використовуйте `quantize(Decimal("0.01"))`.
- **Змінювати глобальний контекст у спільному коді.** `getcontext().rounding = ...` впливає на весь інший код потоку. Використовуйте `localcontext()`.
- **Змішувати `Decimal` і `float` в арифметиці.** Це генерує `TypeError`. Перетворюйте вхідні дані на `Decimal` на межі програми й вмикайте пастку `FloatOperation`, щоб знайти «протікання».
- **Використовувати функції `math`.** `math.sqrt(Decimal(2))` повертає float. Пишіть `Decimal(2).sqrt()`.
- **Очікувати від `//` і `%` поведінки цілих чисел.** З від'ємними числами `Decimal` відкидає дробову частину в бік нуля.
- **Неправильно читати назви режимів округлення.** `ROUND_UP` — це «від нуля», а `ROUND_HALF_UP` округлює половини від нуля, зокрема й для від'ємних чисел.
- **Перехоплювати `ValueError` для некоректних даних.** `Decimal("abc")` генерує `decimal.InvalidOperation`.

## Підсумок

- `Decimal` зберігає числа в десятковій системі, тож значення на кшталт `0.1` точні, а арифметика з ними поводиться так, як на папері.
- Створюйте десяткові числа з рядків, цілих чисел або кортежів. `Decimal(float)` копіює двійкову похибку float.
- `Decimal` — це знак, кортеж цифр і експонента. Кінцеві нулі зберігаються: `Decimal("1.30") + Decimal("1.20")` дорівнює `2.50`.
- Контекст задає точність (значущі цифри, за замовчуванням 28), округлення (за замовчуванням `ROUND_HALF_EVEN`) і те, які сигнали генерують винятки.
- Для тимчасових змін використовуйте `localcontext()`, а для округлення грошей — `quantize()` з явно вказаним режимом.
- `Decimal` не змішується з `float` в арифметиці. `//` і `%` відкидають дробову частину в бік нуля. Функції `math` повертають float.
- `Decimal` точний лише для скінченних десяткових дробів. `1/3` усе одно округлюється. Для точних раціональних чисел є `Fraction`.

## Практика

### Вправа 1: Передбачте результат

Запишіть, що виведе кожен рядок, потім запустіть код і поясніть кожен результат.

```python
from decimal import Decimal

print(Decimal(0.5) == Decimal("0.5"))
print(Decimal(0.1) == Decimal("0.1"))
print(Decimal("1.10") + Decimal("2.20"))
print(Decimal("1.10") + Decimal("2.20") == Decimal("3.3"))
print(Decimal(-9) // Decimal(4), Decimal(-9) % Decimal(4))
print(round(Decimal("0.125"), 2))
```

### Вправа 2: Рахунок

Ціни надходять рядками. Обчисліть рахунок для цих товарів за допомогою `Decimal`:

```python
items = [("Notebook", "2.35", 3), ("Pen", "0.99", 7), ("Backpack", "24.90", 1)]
```

Виведіть кожен рядок рахунку (назва, кількість, ціна, сума за рядок), потім проміжну суму, ПДВ 20%, округлений до центів (копійок) у режимі `ROUND_HALF_UP`, і загальну суму. Наостанок обчисліть проміжну суму через float і порівняйте.

### Вправа 3: Перевірка ціни

Напишіть `parse_price(text)`, яка повертає `Decimal` рівно з двома знаками після коми або генерує `ValueError` зі зрозумілим повідомленням, якщо текст не є числом, не є скінченним (`NaN`, `Infinity`), не є додатним або має більше двох знаків після коми. Перевірте функцію на `"19.99"`, `"5"`, `"0.5"`, `" 7.10 "`, `"1e2"`, `"1.999"`, `"abc"`, `"NaN"` і `"-3"`.

### Вправа 4: Поділити рахунок

Напишіть `split(total, n)`, яка ділить суму `Decimal` на `n` частин, кожна з яких — ціла кількість центів, так, щоб частини в сумі давали **рівно** `total` і відрізнялися одна від одної щонайбільше на один цент. `split(Decimal("100.00"), 3)` має повернути `33.34`, `33.33` і `33.33`. Якщо `total` містить частки цента, генеруйте `ValueError`.

## Розв'язки

### Вправа 1

Результат:

```text
True
False
3.30
True
-2 -1
0.12
```

- `0.5` у двійковому вигляді точне, тож `Decimal(0.5)` дорівнює рівно `0.5`.
- Float `0.1` неточний, і `Decimal(0.1)` зберігає його похибку.
- Додавання зберігає два знаки після коми: `3.30`.
- Кінцеві нулі не впливають на рівність: `3.30 == 3.3`.
- `-9 / 4` дорівнює `-2.25`. `Decimal` відкидає дробову частину в бік нуля й дає `-2`, а остача `-1` має знак діленого: `4 * (-2) + (-1) == -9`.
- `0.125` як `Decimal` — точна «половинка», і округлення до парного дає `0.12`.

### Вправа 2

```python
from decimal import Decimal, ROUND_HALF_UP

CENT = Decimal("0.01")
VAT_RATE = Decimal("0.20")

items = [("Notebook", "2.35", 3), ("Pen", "0.99", 7), ("Backpack", "24.90", 1)]

subtotal = Decimal("0.00")
for name, price, qty in items:
    line = Decimal(price) * qty
    subtotal += line
    print(f"{name:<10} {qty:>2} x {price:>6} = {line:>7}")

vat = (subtotal * VAT_RATE).quantize(CENT, rounding=ROUND_HALF_UP)
total = subtotal + vat
print(f"{'Subtotal':<24} {subtotal:>7}")
print(f"{'VAT 20%':<24} {vat:>7}")
print(f"{'Total':<24} {total:>7}")

float_subtotal = sum(float(price) * qty for _, price, qty in items)
print(float_subtotal)
```

Результат:

```text
Notebook    3 x   2.35 =    7.05
Pen         7 x   0.99 =    6.93
Backpack    1 x  24.90 =   24.90
Subtotal                   38.88
VAT 20%                     7.78
Total                      46.66
38.879999999999995
```

Десяткова проміжна сума дорівнює рівно `38.88`. ПДВ становить `7.776`, і `quantize()` округлює його до `7.78`. Проміжна сума у float неточна ще до будь-якого округлення, а в реальній системі такі дрібні похибки обертаються розбіжностями в один цент між рахунками й платежами.

### Вправа 3

```python
from decimal import Decimal, InvalidOperation

CENT = Decimal("0.01")


def parse_price(text):
    try:
        price = Decimal(text)
    except InvalidOperation:
        raise ValueError(f"not a number: {text!r}") from None
    if not price.is_finite():
        raise ValueError(f"not a finite number: {text!r}")
    if price <= 0:
        raise ValueError(f"price must be positive: {text!r}")
    if price.as_tuple().exponent < -2:
        raise ValueError(f"more than two decimal places: {text!r}")
    return price.quantize(CENT)


for text in ["19.99", "5", "0.5", " 7.10 ", "1e2", "1.999", "abc", "NaN", "-3"]:
    try:
        print(f"{text!r:>9} -> {parse_price(text)!r}")
    except ValueError as error:
        print(f"{text!r:>9} -> ValueError: {error}")
```

Результат:

```text
  '19.99' -> Decimal('19.99')
      '5' -> Decimal('5.00')
    '0.5' -> Decimal('0.50')
 ' 7.10 ' -> Decimal('7.10')
    '1e2' -> Decimal('100.00')
  '1.999' -> ValueError: more than two decimal places: '1.999'
    'abc' -> ValueError: not a number: 'abc'
    'NaN' -> ValueError: not a finite number: 'NaN'
     '-3' -> ValueError: price must be positive: '-3'
```

Експонента з `as_tuple()` показує, скільки знаків після коми мало вхідне число: для `1.999` це `-3`. Перевірка на скінченність має стояти перед `price <= 0`, бо порівняння `NaN` через `<=` генерує `InvalidOperation`. `from None` приховує внутрішній виняток `decimal` у трасуванні, тож код, що викликає функцію, бачить лише зрозумілий `ValueError`.

### Вправа 4

```python
from decimal import Decimal


def split(total, n):
    cents = int(total * 100)
    if cents != total * 100:
        raise ValueError("total must be a whole number of cents")
    share, extra = divmod(cents, n)
    return [Decimal(share + (i < extra)).scaleb(-2) for i in range(n)]


for total, n in [(Decimal("100.00"), 3), (Decimal("0.05"), 2), (Decimal("10"), 4)]:
    parts = split(total, n)
    print(total, n, parts, sum(parts) == total)
```

Результат:

```text
100.00 3 [Decimal('33.34'), Decimal('33.33'), Decimal('33.33')] True
0.05 2 [Decimal('0.03'), Decimal('0.02')] True
10 4 [Decimal('2.50'), Decimal('2.50'), Decimal('2.50'), Decimal('2.50')] True
```

Перехід до цілих центів зводить задачу до `divmod()`: кожен отримує `share` центів, а перші `extra` людей — на один цент більше. `i < extra` — булеве значення, яке рахується як `1` або `0`. `scaleb(-2)` ділить на 100, зсуваючи експоненту, тож `250` стає `2.50` і обидва знаки після коми зберігаються.

---

*Джерело: [pythontutorial.net — Python Decimal](https://www.pythontutorial.net/advanced-python/python-decimal/). Адаптовано й доповнено для PyJourney.*
