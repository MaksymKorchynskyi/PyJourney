# search()

`re.search()` проходить рядок зліва направо й повертає **перше** місце, де шаблон збігається. Це найзагальніша з функцій, що шукають один збіг: він може починатися й закінчуватися будь-де. Використовуйте її, щоб відповісти на запитання «чи містить цей текст ...?» і щоб витягти перше входження чогось разом із групами та позицією.

## Що ви дізнаєтесь

- Сигнатуру `re.search()` і те, що вона повертає
- Як отримати з об'єкта `Match` знайдений текст, групи й позицію
- Як нумеруються вкладені групи й що повертає `groups()`
- Чим `search()` відрізняється від `match()` і `fullmatch()`
- Чому рушій регулярних виразів повертає *крайній лівий* збіг, а не найдовший
- Як `Pattern.search(string, pos)` дозволяє продовжити пошук

## Сигнатура

```python
re.search(pattern, string, flags=0)
```

- `pattern` — регулярний вираз (сирий рядок або скомпільований `Pattern`).
- `string` — текст, у якому шукаємо.
- `flags` — необов'язковий параметр: один прапорець або кілька, об'єднаних через `|`.

`search()` пробує шаблон на позиції 0, потім 1, потім 2 і так далі та зупиняється на першій позиції, де шаблон збігся. Вона повертає об'єкт `Match` або `None`, якщо жодна позиція не підійшла.

## Пошук першого збігу

Наступний приклад знаходить перше число в рядку:

```python
import re

s = "Python 3 was released on Dec 3, 2008"
match = re.search(r"\d+", s)

print(match)
```

Результат:

```text
<re.Match object; span=(7, 8), match='3'>
```

`\d+` збігається з однією чи більше цифрами. Виведений об'єкт `Match` показує свій `span` і знайдений текст. Щоб отримати лише текст, викличте `group()` і завжди обробляйте випадок `None`:

```python
import re

s = "Python 3 was released on Dec 3, 2008"
match = re.search(r"\d+", s)

if match is not None:
    print(match.group())
else:
    print("No match found")
```

Результат:

```text
3
```

Повертається лише перше число, `3`, хоча чисел у рядку три. Щоб отримати всі, використовуйте `findall()` або `finditer()`.

## Робота з об'єктом `Match`

| Член | Значення |
|---|---|
| `m.group()` / `m.group(0)` / `m[0]` | увесь збіг |
| `m.group(n)` / `m[n]` | група `n` |
| `m.group(1, 2)` | кілька груп у вигляді кортежу |
| `m.groups()` | усі групи у вигляді кортежу |
| `m.groupdict()` | іменовані групи у вигляді словника |
| `m.start()`, `m.end()`, `m.span()` | позиція збігу |

### Вкладені групи

Цей приклад знаходить перше слово, що закінчується на `thon`:

```python
import re

s = "CPython, IronPython, or Cython"
match = re.search(r"\b((\w+)thon)\b", s)

if match is not None:
    print(match.groups())
    print(match.group(0), "|", match.group(1), "|", match.group(2))
    print(match.span())
```

Результат:

```text
('CPython', 'CPy')
CPython | CPython | CPy
(0, 7)
```

У шаблоні дві групи захоплення. Групи нумеруються за **відкривною** дужкою зліва направо:

- група 1 `((\w+)thon)` захоплює все слово,
- група 2 `(\w+)` захоплює частину перед `thon`.

`groups()` повертає їх усі у вигляді кортежу. Група 0 — це завжди весь збіг; тут вона дорівнює групі 1, бо якорі `\b` збігаються з порожніми позиціями.

### Іменовані групи

З назвами код читається легше, ніж із номерами:

```python
import re

s = "Contact: Olena Petrenko <olena@example.com>, phone 555-0199"
m = re.search(r"<(?P<user>[\w.]+)@(?P<domain>[\w.]+)>", s)

if m:
    print(m["user"], m["domain"])
    print(m.groupdict())
```

Результат:

```text
olena example.com
{'user': 'olena', 'domain': 'example.com'}
```

## Прапорці

За замовчуванням пошук чутливий до регістру. Шаблон `\bpython\b` пропускає `Python` і знаходить слово в нижньому регістрі:

```python
import re

s = "Python or python"
print(re.search(r"\bpython\b", s))
print(re.search(r"\bpython\b", s, flags=re.IGNORECASE))
```

Результат:

```text
<re.Match object; span=(10, 16), match='python'>
<re.Match object; span=(0, 6), match='Python'>
```

З `re.IGNORECASE` збігається вже перше слово, тож `search()` повертає `Python` на позиції 0.

## `search()`, `match()` і `fullmatch()`

Усі три повертають `Match` або `None`. Різниця в тому, де збіг може починатися й закінчуватися:

| Функція | Збіг має починатися | Збіг має закінчуватися | Запитання |
|---|---|---|---|
| `re.search()` | будь-де | будь-де | «Чи містить рядок ...?» |
| `re.match()` | на початку рядка | будь-де | «Чи починається рядок із ...?» |
| `re.fullmatch()` | на початку рядка | у кінці рядка | «Чи є рядок саме ...?» |

```python
import re

for s in ["42", "42 apples", "apples 42"]:
    print(
        f"{s!r:12}",
        "search:", bool(re.search(r"\d+", s)),
        "match:", bool(re.match(r"\d+", s)),
        "fullmatch:", bool(re.fullmatch(r"\d+", s)),
    )
```

Результат:

```text
'42'         search: True match: True fullmatch: True
'42 apples'  search: True match: True fullmatch: False
'apples 42'  search: True match: False fullmatch: False
```

Дві інші функції можна виразити через `search()` з якорями: `match(p, s)` поводиться як `search(r"\A(?:p)", s)`, а `fullmatch(p, s)` — як `search(r"\A(?:p)\Z", s)`. Спеціалізовані функції зрозуміліші й убезпечують від помилок з `^`, `$` та альтернацією.

## Перемагає крайній лівий, а не найдовший

`search()` повертає збіг, що **починається першим**, навіть якщо далі є довший:

```python
import re

print(re.search(r"\d+", "abc 12 3456"))
```

Результат:

```text
<re.Match object; span=(4, 6), match='12'>
```

На тій самій початковій позиції альтернативи перевіряються **в тому порядку, в якому ви їх записали**, і приймається перша, що спрацювала:

```python
import re

print(re.search(r"cat|category", "category"))
print(re.search(r"category|cat", "category"))
```

Результат:

```text
<re.Match object; span=(0, 3), match='cat'>
<re.Match object; span=(0, 8), match='category'>
```

Якщо одна альтернатива є префіксом іншої, ставте довшу першою або додайте межу слова: `\b(?:cat|category)\b`.

## Продовження пошуку: `Pattern.search(string, pos)`

Метод `search()` скомпільованого шаблону приймає `pos` і `endpos`. Якщо передавати як `pos` кінець попереднього збігу, можна пройти рядок збіг за збігом. По суті, саме це робить за вас `finditer()`:

```python
import re

number = re.compile(r"\d+")
text = "a1 b22 c333"

pos = 0
while m := number.search(text, pos):
    print(m[0], m.span())
    pos = m.end()
```

Результат:

```text
1 (1, 2)
22 (4, 6)
333 (8, 11)
```

> **Зверніть увагу:** з `pos` якір `^` і далі означає «справжній початок рядка», а не «позицію `pos`». У цьому відмінність від попереднього зрізу рядка.

## `search()` чи оператор `in`?

Щоб перевірити, чи містить рядок **фіксований** підрядок, оператор `in` простіший і швидший: `"error" in line`. Беріть `search()`, коли потрібен шаблон (цифри, межі слів, альтернативи), нечутливість до регістру або позиція й групи збігу.

## Типові помилки

- **Викликати `.group()` без перевірки на `None`.** Якщо збігу немає, `re.search(...).group()` генерує `AttributeError: 'NoneType' object has no attribute 'group'`. Спершу перевірте результат, наприклад через `if m := re.search(...):`.
- **Очікувати всіх збігів.** `search()` зупиняється на першому. Для всіх використовуйте `findall()` або `finditer()`.
- **Очікувати найдовшого збігу.** Перемагає крайній лівий збіг, а серед альтернатив — та, що записана першою.
- **Забутий сирий рядок.** `"\bword\b"` містить два символи backspace, а не межі слова, тож пошук мовчки не спрацьовує. Пишіть `r"\bword\b"`.
- **Будувати шаблон із даних користувача без екранування.** `re.search("1+1", s)` означає «одна чи більше `1`, потім `1`». Щоб шукати буквальний текст, використовуйте `re.search(re.escape("1+1"), s)`.

## Підсумок

- `re.search(pattern, string, flags=0)` повертає `Match` для першого місця, де шаблон збігся, або `None`.
- Збіг може починатися й закінчуватися будь-де в рядку.
- Для результату використовуйте `group()`, `groups()`, `groupdict()` і `span()`. Групи нумеруються за відкривною дужкою.
- `match()` обмежує початок, `fullmatch()` — обидва кінці, а `search()` не обмежує нічого.
- Рушій повертає крайній лівий збіг і перевіряє альтернативи в записаному порядку.
- `Pattern.search(string, pos)` продовжує пошук із заданої позиції.

## Практика

### Вправа 1: Перший рік

Напишіть `first_year(text)`, яка повертає перший чотиризначний рік від 1900 до 2099 як `int` або `None`, якщо такого немає. Перевірте її на `"Founded in 1998, renamed in 2015"`, `"Room 12345, built 2003"` та `"no years here"`.

### Вправа 2: Номери версій

За допомогою `search()` та іменованих груп витягніть версію з `"Python 3.14.0 (main, Oct  7 2025)"` і виведіть `major`, `minor` і `micro` як цілі числа.

### Вправа 3: Слова із заданим закінченням

Напишіть `first_word_ending_with(text, suffix)`, яка повертає перше ціле слово, що закінчується на `suffix`, або `None`. Закінчення може містити спеціальні символи, тож екрануйте його. Перевірте на `("CPython, IronPython, or Cython", "thon")`, `("We use C++ and g++", "++")` та `("nothing", "xyz")`.

### Вправа 4: Власний `findall()`

Не використовуючи `findall()` чи `finditer()`, напишіть `all_numbers(text)`, яка повертає список усіх чисел у тексті. Скористайтеся скомпільованим шаблоном і його методом `search()` з `pos`. Перевірте на `"7 days, 24 hours, 1440 minutes"`.

## Розв'язки

### Вправа 1

```python
import re


def first_year(text):
    m = re.search(r"\b(?:19|20)\d{2}\b", text)
    return int(m[0]) if m else None


print(first_year("Founded in 1998, renamed in 2015"))
print(first_year("Room 12345, built 2003"))
print(first_year("no years here"))
```

Результат:

```text
1998
2003
None
```

Межі слова не дають знайти збіг усередині `12345`. Незахоплювальна група `(?:19|20)` обмежує століття.

### Вправа 2

```python
import re

banner = "Python 3.14.0 (main, Oct  7 2025)"
m = re.search(r"(?P<major>\d+)\.(?P<minor>\d+)\.(?P<micro>\d+)", banner)

if m:
    version = {name: int(value) for name, value in m.groupdict().items()}
    print(version)
```

Результат:

```text
{'major': 3, 'minor': 14, 'micro': 0}
```

### Вправа 3

```python
import re


def first_word_ending_with(text, suffix):
    m = re.search(r"\w*" + re.escape(suffix) + r"(?!\w)", text)
    return m[0] if m else None


print(first_word_ending_with("CPython, IronPython, or Cython", "thon"))
print(first_word_ending_with("We use C++ and g++", "++"))
print(first_word_ending_with("nothing", "xyz"))
```

Результат:

```text
CPython
C++
None
```

`re.escape("++")` дає `\+\+`, тож плюси шукаються буквально. Завершальний `\b` після небуквеного символу на кшталт `+` не спрацював би, тому замість нього використано негативний перегляд уперед `(?!\w)`: він означає «після цього немає символу слова».

### Вправа 4

```python
import re


def all_numbers(text):
    number = re.compile(r"\d+")
    result = []
    pos = 0
    while (m := number.search(text, pos)) is not None:
        result.append(m[0])
        pos = m.end()
    return result


print(all_numbers("7 days, 24 hours, 1440 minutes"))
```

Результат:

```text
['7', '24', '1440']
```

Кожен пошук починається там, де закінчився попередній збіг, тож збіги не перекриваються. Оскільки `\d+` не може збігтися з порожнім рядком, `pos` завжди рухається вперед, і цикл завершується.

---

*Джерело: [pythontutorial.net — Python Regex search()](https://www.pythontutorial.net/python-regex/python-regex-search/). Адаптовано й доповнено для PyJourney.*
