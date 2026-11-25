# Послідовність Фібоначчі

Числа Фібоначчі `1, 1, 2, 3, 5, 8, 13, ...` — класичний приклад у програмуванні. На них добре видно, чому наївна рекурсія може бути катастрофічно повільною, як це виправляє кешування, а в цій темі ще й як створити власний **тип послідовності**: клас, об'єкти якого підтримують `len()`, індексацію, цикли `for`, `in` і зрізи так само, як список чи кортеж.

## Що ви дізнаєтесь

- Що таке послідовність Фібоначчі і які існують домовленості щодо індексації
- Чому наївна рекурсивна функція робить експоненційну кількість викликів
- Як `functools.lru_cache` і `functools.cache` прибирають повторну роботу і де рекурсія все одно впирається в ліміт
- Які два методи перетворюють клас на незмінювану послідовність і що Python дає «безкоштовно», щойно вони з'являються
- Як підтримати від'ємні індекси, зрізи й правильну обробку помилок у `__getitem__`

## Послідовність Фібоначчі

У послідовності Фібоначчі кожне число дорівнює сумі двох попередніх:

```text
1, 1, 2, 3, 5, 8, 13, 21, 34, 55, ...
```

У вигляді формули, якщо рахувати позиції з 1:

```text
f(1) = 1
f(2) = 1
f(n) = f(n-1) + f(n-2)    for n > 2
```

Багато джерел, зокрема більшість сучасних математичних текстів, починають послідовність із `0`: `0, 1, 1, 2, 3, 5, ...`, де `F(0) = 0` і `F(1) = 1`. Обидві домовленості описують ті самі числа, лише зсунуті на одну позицію. Ця тема слідує за джерелом і починає з `1, 1`, але рахує позиції **з 0**, як індекси в Python: елемент з індексом `0` дорівнює `1`, з індексом `1` — `1`, з індексом `2` — `2` і так далі.

Послідовність названо на честь Леонардо Пізанського, відомого як Фібоначчі, який народився близько 1170 року. Він її не відкрив: у книжці *Liber Abaci* (1202) він використав її в задачі про розмноження кроликів і так познайомив із нею європейську математику. Індійські вчені, як-от Пінгала (Pingala), Віраханка (Virahanka) та Хемачандра (Hemachandra), описали ці самі числа на століття раніше, досліджуючи ритміку віршів.

## Рекурсивна функція

Визначення напряму перекладається в рекурсивну функцію:

```python
def fib(n):
    if n < 2:
        return 1
    return fib(n - 2) + fib(n - 1)


print([fib(n) for n in range(10)])
```

Результат:

```text
[1, 1, 2, 3, 5, 8, 13, 21, 34, 55]
```

**Базовий випадок** `n < 2` повертає `1` для індексів `0` і `1`. Для кожного більшого `n` функція викликає сама себе для двох попередніх індексів і додає результати: `fib(n) = fib(n - 2) + fib(n - 1)`.

### Чому наївна версія повільна

Додайте `print()`, щоб побачити кожен виклик, який робить `fib(5)`:

```python
def fib(n):
    print(f"Calculate the Fibonacci of {n}")
    if n < 2:
        return 1
    return fib(n - 2) + fib(n - 1)


fib(5)
```

Результат:

```text
Calculate the Fibonacci of 5
Calculate the Fibonacci of 3
Calculate the Fibonacci of 1
Calculate the Fibonacci of 2
Calculate the Fibonacci of 0
Calculate the Fibonacci of 1
Calculate the Fibonacci of 4
Calculate the Fibonacci of 2
Calculate the Fibonacci of 0
Calculate the Fibonacci of 1
Calculate the Fibonacci of 3
Calculate the Fibonacci of 1
Calculate the Fibonacci of 2
Calculate the Fibonacci of 0
Calculate the Fibonacci of 1
```

`fib(3)` обчислюється двічі, а `fib(2)` — тричі. Виклики утворюють дерево, у якому ті самі піддерева повторюються знову й знову:

```text
                 fib(4)
               /        \
          fib(2)          fib(3)
          /    \          /    \
      fib(0)  fib(1)  fib(1)  fib(2)
                              /    \
                          fib(0)  fib(1)
```

Кількість викликів росте так само швидко, як самі числа Фібоначчі, — приблизно в 1.6 раза на кожному кроці:

```python
calls = 0


def fib(n):
    global calls
    calls += 1
    if n < 2:
        return 1
    return fib(n - 2) + fib(n - 1)


for n in [5, 10, 20, 25]:
    calls = 0
    fib(n)
    print(f"fib({n}) needed {calls:,} calls")
```

Результат:

```text
fib(5) needed 15 calls
fib(10) needed 177 calls
fib(20) needed 21,891 calls
fib(25) needed 242,785 calls
```

За такого темпу `fib(50)` потребувала б десятків мільярдів викликів. Це **експоненційний час**.

### Кешування результатів через lru_cache

Для того самого аргументу функція завжди повертає той самий результат, тож обчислювати значення двічі немає сенсу. Декоратор `functools.lru_cache` зберігає результат кожного виклику в словнику, ключами якого є аргументи. Наступний виклик із тим самим аргументом одразу повертає збережене значення:

```python
from functools import lru_cache


@lru_cache
def fib(n):
    print(f"Calculate the Fibonacci of {n}")
    if n < 2:
        return 1
    return fib(n - 2) + fib(n - 1)


print(fib(6))
print(fib(6))
print(fib.cache_info())
```

Результат:

```text
Calculate the Fibonacci of 6
Calculate the Fibonacci of 4
Calculate the Fibonacci of 2
Calculate the Fibonacci of 0
Calculate the Fibonacci of 1
Calculate the Fibonacci of 3
Calculate the Fibonacci of 5
13
13
CacheInfo(hits=5, misses=7, maxsize=128, currsize=7)
```

Тепер кожне значення від `0` до `6` обчислюється рівно один раз (7 «промахів», misses). Усі інші запити обслуговує кеш (5 «влучань», hits), зокрема й другий виклик `fib(6)`, який нічого не виводить. Таке збереження результатів чистої функції називається **мемоїзацією** (memoization), і вона перетворює експоненційний алгоритм на лінійний.

- `@lru_cache` без дужок працює, починаючи з Python 3.8. За замовчуванням він зберігає **128** останніх використаних результатів (*LRU* означає, що першими відкидаються «найдавніше використані» записи). `@lru_cache(maxsize=None)` або `@lru_cache(2**16)` змінюють ліміт.
- `@functools.cache` (Python 3.9+) — коротша назва для `@lru_cache(maxsize=None)`, тобто необмеженого кешу.
- Аргументи мають бути хешованими, бо вони стають ключами словника.

### Ліміт рекурсії

Кешування прибирає повторну роботу, але не саму рекурсію. Кожен виклик, який ще не повернув результат, займає кадр стека, а Python обмежує глибину (`sys.getrecursionlimit()` за замовчуванням дорівнює `1000`):

```python
from functools import cache


@cache
def fib(n):
    if n < 2:
        return 1
    return fib(n - 2) + fib(n - 1)


print(fib(100))
print(len(str(fib(1000))))

fib.cache_clear()
try:
    fib(3000)
except RecursionError as error:
    print("RecursionError:", error)
```

Результат:

```text
573147844013817084101
209
RecursionError: maximum recursion depth exceeded
```

З порожнім кешем `fib(3000)` спершу викликає `fib(2998)`, та викликає `fib(2996)` і так далі: приблизно 1500 вкладених викликів, більше, ніж дозволяє ліміт. (Оскільки першим викликається `fib(n - 2)`, глибина становить приблизно `n / 2`, тож у Python 3.14 ліміт досягається близько `n = 2000`.) Уже закешовані значення повертаються одразу, тому якщо обчислювати їх у порядку зростання, глибокої рекурсії не буде. Проте зазвичай кращим інструментом є звичайний цикл:

```python
def fib(n):
    a, b = 1, 1
    for _ in range(n):
        a, b = b, a + b
    return a


print([fib(n) for n in range(10)])
print(len(str(fib(10_000))))
```

Результат:

```text
[1, 1, 2, 3, 5, 8, 13, 21, 34, 55]
2090
```

Цикл зберігає лише два останні числа, не потребує ні рекурсії, ні кешу й легко справляється з великими індексами. Цілі числа в Python ростуть за потреби, тож `fib(10_000)` обчислюється точно. (Перетворення цілого числа, що має понад 4300 цифр, на рядок за замовчуванням генерує `ValueError`, як пояснено в темі «Цілі числа».)

## Власний тип послідовності

Вбудовані послідовності, як-от `list`, `tuple` і `range`, мають спільний протокол. Клас стає **незмінюваною послідовністю**, коли реалізує два спеціальні методи:

- `__len__(self)` повертає кількість елементів, завдяки чому працює `len(obj)`. Строго кажучи, ітерація та індексація працюють і без нього, але послідовність повинна мати довжину.
- `__getitem__(self, index)` повертає елемент за індексом і **генерує `IndexError`**, коли індекс поза межами. Він також може приймати об'єкт `slice`, щоб підтримати зрізи (див. тему «Зрізи докладно»).

Добрий зразок — `range`: він не зберігає свої числа, а обчислює кожне на вимогу. Послідовність `Fibonacci` може робити так само.

### Перша версія

Збережіть цей клас у файлі `fibonacci.py`:

```python
# fibonacci.py
from functools import lru_cache


class Fibonacci:
    def __init__(self, n):
        self.n = n

    def __len__(self):
        return self.n

    def __getitem__(self, index):
        if isinstance(index, int):
            if index < 0 or index > self.n - 1:
                raise IndexError

            return Fibonacci.fib(index)

    @staticmethod
    @lru_cache(2**16)
    def fib(n):
        if n < 2:
            return 1
        return Fibonacci.fib(n - 2) + Fibonacci.fib(n - 1)
```

- `__init__()` зберігає `n`, довжину послідовності. Жодних чисел іще не обчислено.
- `__len__()` повертає цю довжину.
- `__getitem__()` перевіряє, що індекс — ціле число в діапазоні `0 ... n - 1`, інакше генерує `IndexError`, і обчислює число через `fib()`.
- `fib()` — **статичний метод**: йому не потрібні ні екземпляр, ні клас, він лише логічно належить до `Fibonacci`. Його закешовано через `lru_cache`, тож кеш спільний для всіх об'єктів `Fibonacci`. Порядок декораторів важливий: `@staticmethod` має бути зовнішнім (верхнім) декоратором, щоб обгортати вже закешовану функцію.

Тепер використайте клас з іншого скрипту в тій самій теці:

```python
from fibonacci import Fibonacci

fibonacci = Fibonacci(10)

# доступ до елементів за індексами
print("Accessing Fibonacci sequence using []:")
print(fibonacci[0])
print(fibonacci[1])
print(fibonacci[2])

print("Accessing Fibonacci sequence using for loop:")
# за допомогою циклу for
for f in fibonacci:
    print(f)
```

Результат:

```text
Accessing Fibonacci sequence using []:
1
1
2
Accessing Fibonacci sequence using for loop:
1
1
2
3
5
8
13
21
34
55
```

### Чому працює цикл for

У класі немає методу `__iter__()`, проте цикл `for` працює. Коли в об'єкта немає `__iter__()`, `iter()` переходить до **протоколу послідовності**: створює ітератор, який викликає `__getitem__(0)`, `__getitem__(1)`, `__getitem__(2)`, ... і зупиняється, щойно згенеровано `IndexError`. Усе, що спирається на ітерацію, працює так само:

```python
from fibonacci import Fibonacci

fibonacci = Fibonacci(10)

print(len(fibonacci))
print(list(fibonacci))
print(21 in fibonacci, 4 in fibonacci)
print(sum(fibonacci), max(fibonacci))
print(list(reversed(fibonacci)))
first, second, *rest = fibonacci
print(first, second, len(rest))
print(type(iter(fibonacci)).__name__)
```

Результат:

```text
10
[1, 1, 2, 3, 5, 8, 13, 21, 34, 55]
True False
143 55
[55, 34, 21, 13, 8, 5, 3, 2, 1, 1]
1 1 8
iterator
```

- `list()`, `sum()`, `max()` і розпакування перебирають об'єкт.
- `in` за відсутності `__contains__()` теж переходить до ітерації й порівнює елементи по одному.
- `reversed()` потребує і `__len__()`, і `__getitem__()`: він починає з індексу `len(obj) - 1` і рахує вниз.

Ось чому так важливо генерувати саме **`IndexError`** (а не, скажімо, `ValueError`). Це сигнал, що завершує ітерацію. Якщо `__getitem__()` ніколи не генерує винятку, цикли `for` стають нескінченними, а якщо генерує інший виняток, цикли аварійно завершуються.

### Слабкі місця першої версії

Перша версія обробляє лише невід'ємні цілі числа. Усе інше тихо працює неправильно:

```python
from fibonacci import Fibonacci

fibonacci = Fibonacci(10)

print(fibonacci[1:5])
print(fibonacci["one"])
try:
    fibonacci[-1]
except IndexError:
    print("IndexError for -1")
```

Результат:

```text
None
None
IndexError for -1
```

- Зріз чи рядок — не `int`, тож `if` пропускається, метод доходить до кінця й повертає `None` замість того, щоб згенерувати помилку.
- Від'ємні індекси відхиляються, хоча їх приймає кожна вбудована послідовність.
- `raise IndexError` без повідомлення ускладнює налагодження.

## Зрізи, від'ємні індекси й перевірка типів

Коли ви пишете `fibonacci[1:5]`, Python передає в `__getitem__()` об'єкт `slice`. Його метод `indices(length)` перетворює зріз з усіма значеннями за замовчуванням, від'ємними значеннями й межами поза послідовністю на конкретні `(start, stop, step)` для `range()`. Замініть вміст `fibonacci.py` на покращену версію:

```python
# fibonacci.py
import operator
from functools import cache


class Fibonacci:
    def __init__(self, n):
        if n < 0:
            raise ValueError("length must not be negative")
        self.n = n

    def __len__(self):
        return self.n

    def __getitem__(self, index):
        if isinstance(index, slice):
            indices = index.indices(self.n)
            return [Fibonacci.fib(k) for k in range(*indices)]

        index = operator.index(index)   # TypeError для str, float, ...
        if index < 0:
            index += self.n
        if not 0 <= index < self.n:
            raise IndexError("Fibonacci index out of range")
        return Fibonacci.fib(index)

    def __repr__(self):
        return f"Fibonacci({self.n})"

    @staticmethod
    @cache
    def fib(n):
        if n < 2:
            return 1
        return Fibonacci.fib(n - 2) + Fibonacci.fib(n - 1)
```

```python
from fibonacci import Fibonacci

fibonacci = Fibonacci(10)
print(fibonacci)
print(fibonacci[1:5])
print(fibonacci[-1], fibonacci[-2])
print(fibonacci[::3])
print(fibonacci[-3:])
print(fibonacci[:-5:-1])

for key in ["one", 2.0, 10]:
    try:
        fibonacci[key]
    except (TypeError, IndexError) as error:
        print(f"{type(error).__name__}: {error}")
```

Результат:

```text
Fibonacci(10)
[1, 2, 3, 5]
55 34
[1, 3, 13, 55]
[21, 34, 55]
[55, 34, 21, 13]
TypeError: 'str' object cannot be interpreted as an integer
TypeError: 'float' object cannot be interpreted as an integer
IndexError: Fibonacci index out of range
```

Що змінилося:

- **Зрізи** проходять через `index.indices(self.n)` і `range()`, тож працюють усі форми зрізів, зокрема з від'ємним кроком. Результатом є список, бо частина послідовності (наприклад, елементи з `1` до `4`) сама не є об'єктом `Fibonacci(n)`.
- **`operator.index()`** приймає цілі числа й «цілочисельні» об'єкти (усе, що має `__index__()`, зокрема `bool`) і генерує зрозумілий `TypeError` для рядків, float та інших типів. Саме так списки поводяться зі своїми індексами.
- **Від'ємні індекси** перетворюються додаванням довжини, як у вбудованих послідовностях.
- `IndexError` має повідомлення, `__init__()` перевіряє свій аргумент, а `__repr__()` робить об'єкт зрозумілим під час виведення.

Щоб іще й безкоштовно отримати `index()`, `count()` і підтримку `isinstance(obj, Sequence)`, успадкуйте клас від `collections.abc.Sequence`, як показано в темі «Послідовності в Python» і у вправі 4 нижче.

## Типові помилки

- **Наївна рекурсія без кешування.** Звичайна рекурсивна `fib()` робить експоненційну кількість викликів. Додайте `@cache`/`@lru_cache` або використайте цикл.
- **Вважати, що кешування розв'язує проблему глибокої рекурсії.** Із порожнім кешем усе одно потрібно приблизно `n / 2` вкладених викликів. Для великих `n` обчислюйте ітеративно.
- **Плутати домовленості щодо індексації.** `0, 1, 1, 2, ...` і `1, 1, 2, 3, ...` зсунуті на одну позицію. Явно вказуйте, яку з них використовує ваш код.
- **Генерувати не той виняток у `__getitem__()`.** Ітерація зупиняється лише на `IndexError`. Будь-який інший виняток виходить назовні, а якщо винятку немає взагалі, цикли стають нескінченними.
- **Повертати `None` для непідтримуваних ключів.** Пропущена гілка `else` мовчки повертає `None`. Генеруйте натомість `TypeError`, наприклад через `operator.index()`.
- **Ставити `@lru_cache` над `@staticmethod`.** `@staticmethod` має бути найзовнішнішим декоратором.
- **Забувати, що необмежений кеш зберігає все.** `@cache` ніколи не забуває результатів. Якщо можливих аргументів дуже багато, використовуйте `@lru_cache(maxsize=...)`.

## Підсумок

- Кожне число Фібоначчі дорівнює сумі двох попередніх. У цій темі послідовність — `1, 1, 2, 3, ...`, а позиції рахуються з 0.
- Наївна рекурсивна функція знову й знову обчислює ті самі значення й потребує експоненційної кількості викликів.
- `@lru_cache` і `@cache` мемоїзують результати, тож кожне значення обчислюється один раз. Глибока рекурсія все одно може впертися в ліміт, а цикл цього уникає.
- Клас із `__len__()` і `__getitem__()`, який генерує `IndexError`, є незмінюваною послідовністю. Тоді автоматично працюють `for`, `in`, `list()`, `sum()`, `reversed()` і розпакування.
- Для зрізу `__getitem__()` отримує об'єкт `slice`. `slice.indices(len(self))` разом із `range()` обробляє будь-яку форму зрізу.
- Використовуйте `operator.index()`, щоб приймати цілочисельні індекси й відхиляти все інше, а від'ємні індекси перетворюйте додаванням довжини.

## Практика

### Вправа 1: Порахуйте виклики

Використовуючи наївну рекурсивну `fib()` з лічильником викликів, перевірте для кожного `n` від `0` до `20`, що кількість викликів дорівнює `2 * fib(n) - 1`. Виведіть, чи справджується формула, і скільки викликів потребує `fib(20)`. Потім поясніть, чому формула правильна.

### Вправа 2: Нескінченний генератор

Напишіть функцію-генератор `fibonacci()`, яка нескінченно видає `1, 1, 2, 3, 5, ...`. За допомогою `itertools.islice()` виведіть перші 10 чисел і числа з індексами від `20` до `24`. Потім знайдіть індекс першого числа Фібоначчі, яке має щонайменше 100 цифр, і виведіть його перші десять цифр.

### Вправа 3: Зовсім без рекурсії

Перепишіть клас послідовності `Fibonacci` так, щоб він ніколи не використовував рекурсію: зберігайте на рівні класу список `_values = [1, 1]`, який росте на вимогу, коли запитують більший індекс. Підтримайте від'ємні індекси та зрізи. Покажіть, що `Fibonacci(5000)[-1]` працює (виведіть кількість його цифр), виведіть перші десять елементів і покажіть, що список спільний для всіх екземплярів.

### Вправа 4: Справжня Sequence

На основі покращеного `fibonacci.py` створіть клас `FibonacciSequence(Fibonacci, Sequence)`, який додатково успадковує `collections.abc.Sequence`. Покажіть, що початковий клас не розпізнається як `Sequence`, а новий — розпізнається, і скористайтеся успадкованими `index()`, `count()` і `reversed()`. Наостанок перевизначте `__contains__()` так, щоб `value in seq` зупинявся, щойно числа стають більшими за `value`, і перевірте це на `FibonacciSequence(10**6)`.

## Розв'язки

### Вправа 1

```python
calls = 0


def fib(n):
    global calls
    calls += 1
    if n < 2:
        return 1
    return fib(n - 2) + fib(n - 1)


results = []
for n in range(21):
    calls = 0
    value = fib(n)
    results.append(calls == 2 * value - 1)

print(all(results))
calls = 0
print(fib(20), calls)
```

Результат:

```text
True
10946 21891
```

Нехай `c(n)` — кількість викликів. Для `n < 2` виклик один, і `2 * 1 - 1 = 1`. Для більших `n` один виклик породжує виклики `fib(n - 2)` і `fib(n - 1)`: `c(n) = 1 + c(n - 2) + c(n - 1)`. Якщо формула справджується для менших значень, то `c(n) = 1 + (2 * fib(n - 2) - 1) + (2 * fib(n - 1) - 1) = 2 * fib(n) - 1`. Отже, кількість викликів росте рівно так само швидко, як самі числа Фібоначчі.

### Вправа 2

```python
from itertools import islice


def fibonacci():
    a, b = 1, 1
    while True:
        yield a
        a, b = b, a + b


print(list(islice(fibonacci(), 10)))
print(list(islice(fibonacci(), 20, 25)))

for index, value in enumerate(fibonacci()):
    if len(str(value)) >= 100:
        print(index, str(value)[:10] + "...")
        break
```

Результат:

```text
[1, 1, 2, 3, 5, 8, 13, 21, 34, 55]
[10946, 17711, 28657, 46368, 75025]
475 1344719667...
```

Генератор видає значення лише на запит, тож нескінченна послідовність нічого не коштує, доки ви її не споживаєте. `islice()` бере її скінченну частину, адже нескінченний генератор не можна зрізати через `[]`. Цикл `for` із `break` зупиняється на першому збігу. За домовленості `0, 1, 1, 2, ...` те саме число має індекс `476`.

### Вправа 3

```python
import operator


class Fibonacci:
    _values = [1, 1]            # спільний для всіх екземплярів, росте на вимогу

    def __init__(self, n):
        self.n = n

    def __len__(self):
        return self.n

    def __getitem__(self, index):
        if isinstance(index, slice):
            return [self._value(k) for k in range(*index.indices(self.n))]
        index = operator.index(index)
        if index < 0:
            index += self.n
        if not 0 <= index < self.n:
            raise IndexError("Fibonacci index out of range")
        return self._value(index)

    @classmethod
    def _value(cls, k):
        values = cls._values
        while len(values) <= k:
            values.append(values[-1] + values[-2])
        return values[k]


big = Fibonacci(5000)
print(len(str(big[-1])))
print(big[:10])
print(Fibonacci(20)[-1], len(Fibonacci._values))
```

Результат:

```text
1045
[1, 1, 2, 3, 5, 8, 13, 21, 34, 55]
6765 5000
```

`_value()` доповнює список у циклі, доки в ньому не з'явиться індекс `k`, тож рекурсії немає, і кожне число обчислюється один раз. Список — атрибут класу: після `big[-1]` у ньому вже 5000 значень, і `Fibonacci(20)[-1]` просто читає одне з них. Зауважте, що список росте до найбільшого будь-коли запитаного індексу, а це коштує пам'яті.

### Вправа 4

```python
from collections.abc import Sequence

from fibonacci import Fibonacci


class FibonacciSequence(Fibonacci, Sequence):
    def __contains__(self, value):
        a, b = 1, 1
        for _ in range(self.n):
            if a >= value:            # значення ніколи не зменшуються
                return a == value
            a, b = b, a + b
        return False


print(isinstance(Fibonacci(10), Sequence))

seq = FibonacciSequence(10)
print(isinstance(seq, Sequence))
print(seq.index(21), seq.count(1))
print(list(reversed(seq))[:3])
print(21 in seq, 4 in seq)

huge = FibonacciSequence(10**6)
print(4 in huge, 10**20 in huge, 12200160415121876738 in huge)
```

Результат:

```text
False
True
7 2
[55, 34, 21]
True False
False False True
```

`collections.abc.Sequence` не розпізнає класи автоматично лише через наявність `__len__()` і `__getitem__()`, тому початковий клас не є `Sequence`. Успадкування від неї додає методи-домішки (mixin) `index()`, `count()`, `__iter__()`, `__reversed__()` і `__contains__()`, побудовані на `__getitem__()` і `__len__()`. Успадкований `__contains__()` перебирав би елементи по одному через `__getitem__()`, аж до мільйона елементів. Перевизначений метод спирається на те, що послідовність ніколи не спадає: він генерує числа циклом і зупиняється на першому, яке не менше за `value`, — для цих значень менш ніж за 100 кроків.

---

*Джерело: [pythontutorial.net — Python Fibonacci Sequence](https://www.pythontutorial.net/advanced-python/python-fibonacci-sequence/). Адаптовано й доповнено для PyJourney.*
