# Прапорці регулярних виразів

Прапорці (flags) змінюють те, *як* рушій регулярних виразів тлумачить шаблон, не змінюючи сам шаблон: ігнорувати регістр літер, змусити `^` і `$` працювати для кожного рядка, дозволити `.` збігатися з переведенням рядка, писати коментарі всередині шаблону тощо. Їх приймає кожна функція модуля `re` (`search`, `match`, `fullmatch`, `findall`, `finditer`, `sub`, `subn`, `split`, `compile`).

## Що ви дізнаєтесь

- Що таке прапорці регулярних виразів і як їх передавати та поєднувати
- Повний перелік прапорців з короткими назвами та вбудованими формами
- Як `IGNORECASE`, `MULTILINE`, `DOTALL`, `VERBOSE` та `ASCII` змінюють пошук
- Для чого потрібні `LOCALE`, `UNICODE`, `DEBUG` і `NOFLAG`
- Як записувати прапорці всередині шаблону — для всього шаблону `(?i)` або для його частини `(?i:...)`
- Класичну помилку з позиційною передачею прапорців у `sub()` і `split()`

## Що таке прапорець

Починаючи з Python 3.6, прапорці — це члени переліку `re.RegexFlag`, який є `IntFlag`. Кожен прапорець — степінь двійки, тож кілька прапорців можна об'єднати в одне значення побітовим «або» `|`:

```python
import re

print(re.IGNORECASE, int(re.IGNORECASE))
print(re.IGNORECASE | re.MULTILINE)
print(type(re.IGNORECASE | re.MULTILINE))
```

Результат:

```text
re.IGNORECASE 2
re.IGNORECASE|re.MULTILINE
<flag 'RegexFlag'>
```

Застосувати прапорці можна трьома способами:

1. Передати їх у функцію: `re.findall(pattern, s, flags=re.IGNORECASE)`.
2. Передати один раз у `re.compile(pattern, flags)`. Тоді їх використовує кожен метод скомпільованого шаблону.
3. Записати їх **усередині** шаблону як вбудовані прапорці: `r"(?i)pattern"`.

## Усі прапорці одним поглядом

| Прапорець | Коротко | Вбудований | Значення |
|---|---|---|---|
| `re.IGNORECASE` | `re.I` | `(?i)` | Пошук без урахування регістру: `[a-z]` збігається й з великими літерами. |
| `re.MULTILINE` | `re.M` | `(?m)` | `^` і `$` збігаються також на початку й у кінці кожного рядка тексту, а не лише всього рядка. |
| `re.DOTALL` | `re.S` | `(?s)` | `.` збігається з будь-яким символом, **зокрема** з переведенням рядка. |
| `re.VERBOSE` | `re.X` | `(?x)` | Пробіли в шаблоні ігноруються, а `#` починає коментар, тож шаблон можна гарно розмітити й задокументувати. |
| `re.ASCII` | `re.A` | `(?a)` | `\w`, `\W`, `\b`, `\B`, `\d`, `\D`, `\s`, `\S` збігаються лише з ASCII-символами. Має сенс тільки для шаблонів типу `str`. |
| `re.UNICODE` | `re.U` | `(?u)` | Пошук з урахуванням Unicode. Для шаблонів `str` це вже поведінка за замовчуванням, тож прапорець надлишковий і лишився для сумісності. |
| `re.LOCALE` | `re.L` | `(?L)` | `\w`, `\W`, `\b`, `\B` і пошук без урахування регістру залежать від поточної локалі. Лише для шаблонів `bytes`, несумісний з `re.ASCII`, використовувати не рекомендується. |
| `re.DEBUG` | немає | немає | Виводить налагоджувальну інформацію про скомпільований шаблон. |
| `re.NOFLAG` | немає | немає | Значення `0`, тобто «без прапорців» (Python 3.11+). |

## `re.IGNORECASE`

Без прапорця `[a-z]+` збігається лише з малими літерами, тому `P` пропускається:

```python
import re

s = "Python is awesome"

print(re.findall(r"[a-z]+", s))
print(re.findall(r"[a-z]+", s, flags=re.IGNORECASE))
```

Результат:

```text
['ython', 'is', 'awesome']
['Python', 'is', 'awesome']
```

З `re.IGNORECASE` набір `[a-z]` збігається також з `A`-`Z`. Нечутливість до регістру працює й для нелатинських абеток:

```python
import re

print(re.findall(r"київ", "Київ КИЇВ київ", flags=re.IGNORECASE))
```

Результат:

```text
['Київ', 'КИЇВ', 'київ']
```

## `re.MULTILINE`

За замовчуванням `^` збігається лише на початку всього рядка, а `$` — лише в його кінці (або безпосередньо перед завершальним переведенням рядка). З `re.MULTILINE` вони збігаються на початку й у кінці **кожного рядка тексту**:

```python
import re

s = """Regex
Flags"""

print(re.findall(r"^\w+", s))
print(re.findall(r"^\w+", s, flags=re.MULTILINE))
```

Результат:

```text
['Regex']
['Regex', 'Flags']
```

Те саме стосується `$`:

```python
import re

s = "one\ntwo\nthree"

print(re.findall(r"\w+$", s))
print(re.findall(r"\w+$", s, flags=re.MULTILINE))
```

Результат:

```text
['three']
['one', 'two', 'three']
```

На `\A` і `\Z` прапорець **не** впливає. Вони завжди означають початок і самий кінець усього рядка, що зручно, коли в одному шаблоні потрібні обидва види якорів.

## `re.DOTALL`

За замовчуванням `.` збігається з будь-яким символом, крім переведення рядка `\n`. Тому `.+` зупиняється в кінці кожного рядка тексту:

```python
import re

s = """Regex
Flags"""

print(re.findall(r".+", s))
print(re.findall(r".+", s, flags=re.DOTALL))
```

Результат:

```text
['Regex', 'Flags']
['Regex\nFlags']
```

З `re.DOTALL` крапка перетинає межі рядків, і `.+` збігається з усім текстом. Саме це потрібно, щоб витягти блок, який займає кілька рядків:

```python
import re

text = "header\nBEGIN\nline 1\nline 2\nEND\nfooter"

print(re.findall(r"BEGIN\n(.*?)\nEND", text))
print(re.findall(r"BEGIN\n(.*?)\nEND", text, flags=re.DOTALL))
```

Результат:

```text
[]
['line 1\nline 2']
```

> **Порада:** `MULTILINE` і `DOTALL` легко сплутати. `MULTILINE` змінює якорі `^` і `$`. `DOTALL` змінює крапку `.`. Вони незалежні й часто використовуються разом.

## `re.VERBOSE`

Довгі шаблони швидко стають нечитабельними. `re.VERBOSE` дозволяє розмістити шаблон на кількох рядках і додати коментарі:

```python
import re

s = "Python 3"

pattern = r"""
    ^(\w+)   # один або більше символів слова на початку рядка
    \s*      # нуль або більше пробільних символів
    (\d+)$   # одна або більше цифр у кінці рядка
"""

print(re.findall(pattern, s, flags=re.VERBOSE))
```

Результат:

```text
[('Python', '3')]
```

Правила докладного (verbose) режиму:

- Пробіли в шаблоні ігноруються, **крім** тих, що стоять усередині символьного класу `[...]` або екрановані зворотною скісною рискою.
- `#` починає коментар до кінця рядка, крім випадків усередині символьного класу або коли він екранований як `\#`.

Ці правила — водночас і головна пастка. Буквальний пробіл чи `#` треба записувати явно:

```python
import re

s = "a b #12"

print(re.findall(r"a b", s, flags=re.VERBOSE))
print(re.findall(r"a\ b", s, flags=re.VERBOSE))
print(re.findall(r"a[ ]b", s, flags=re.VERBOSE))
print(re.findall(r"\#\d+", s, flags=re.VERBOSE))
```

Результат:

```text
[]
['a b']
['a b']
['#12']
```

У першому виклику пробіл зникає, і шаблон перетворюється на `ab`, якого в рядку немає. Приклад із життя — номер телефону:

```python
import re

phone = re.compile(
    r"""
    \(? (\d{3}) \)?   # код зони, можливо в дужках
    [\s.-]?           # необов'язковий роздільник
    (\d{3})           # перші три цифри
    [\s.-]?           # необов'язковий роздільник
    (\d{4})           # останні чотири цифри
    """,
    re.VERBOSE,
)

for s in ["(212) 456-7890", "212.456.7890", "2124567890"]:
    print(phone.fullmatch(s).groups())
```

Результат:

```text
('212', '456', '7890')
('212', '456', '7890')
('212', '456', '7890')
```

## `re.ASCII`

У Python 3 шаблони `str` враховують Unicode: `\w` збігається з літерами будь-якої абетки, а `\d` — з цифрами будь-якої писемності. `re.ASCII` обмежує `\w`, `\W`, `\b`, `\B`, `\d`, `\D`, `\s` і `\S` лише ASCII-символами. Шаблон нижче шукає слова з двох символів:

```python
import re

s = "作法 is Pythonic in Japanese"

print(re.findall(r"\b\w{2}\b", s))
print(re.findall(r"\b\w{2}\b", s, flags=re.ASCII))
```

Результат:

```text
['作法', 'is', 'in']
['is', 'in']
```

З `re.ASCII` японське слово вже не складається із «символів слова», тож воно виключається. Прапорець важливий і для цифр: за замовчуванням `\d` збігається, наприклад, і з арабсько-індійськими цифрами, які приймає `int()`, але може не прийняти суворе поле ідентифікатора:

```python
import re

s = "Total: ٣٤ and 34"

print(re.findall(r"\d+", s))
print(re.findall(r"\d+", s, flags=re.ASCII))
```

Результат:

```text
['٣٤', '34']
['34']
```

> **Зверніть увагу:** `re.ASCII` має сенс лише для шаблонів `str`. Шаблони `bytes` і так працюють тільки з ASCII, тож там прапорець нічого не змінює.

## `re.LOCALE` і `re.UNICODE`

`re.LOCALE` робить `\w`, `\b` і пошук без урахування регістру залежними від поточної локалі. Він працює лише з шаблонами `bytes`, не поєднується з `re.ASCII` і не рекомендований, бо локалі ненадійні. Із шаблоном `str` він спричиняє помилку:

```python
import re

try:
    re.compile(r"\w+", re.LOCALE)
except ValueError as e:
    print("ValueError:", e)
```

Результат:

```text
ValueError: cannot use LOCALE flag with a str pattern
```

`re.UNICODE` (`re.U`) вмикає пошук з урахуванням Unicode, а це й так поведінка за замовчуванням для шаблонів `str`. Ви побачите його в старому коді та в значенні `flags` скомпільованих шаблонів, але передавати його ніколи не потрібно.

## `re.DEBUG`

`re.DEBUG` виводить, як рушій розібрав і скомпілював шаблон. Це інструмент для допитливих і для налагодження дуже складних шаблонів:

```python
import re

re.compile(r"\d+", re.DEBUG)
```

Результат (точний формат може відрізнятися між версіями Python):

```text
MAX_REPEAT 1 MAXREPEAT
  IN
    CATEGORY CATEGORY_DIGIT

 0. INFO 4 0b0 1 MAXREPEAT (to 5)
 5: REPEAT_ONE 9 1 MAXREPEAT (to 15)
 9.   IN 4 (to 14)
11.     CATEGORY UNI_DIGIT
13.     FAILURE
14:   SUCCESS
15: SUCCESS
```

Перша частина — дерево розбору: «повторити щонайменше раз символ із категорії цифр». Друга — скомпільований байт-код, який виконує рушій.

## Поєднання прапорців

Прапорці поєднують через `|`. Порядок значення не має:

```python
import re

log = """Error: disk full
ok: backup done
ERROR: network down"""

print(re.findall(r"^error.*$", log, flags=re.IGNORECASE | re.MULTILINE))
```

Результат:

```text
['Error: disk full', 'ERROR: network down']
```

Не використовуйте `+`. Для різних прапорців він випадково працює, але якщо додати той самий прапорець двічі, вийде зовсім інший прапорець: `re.I + re.I` дорівнює `4`, тобто `re.LOCALE`:

```python
import re

print(re.I | re.I)
print(re.I + re.I)
```

Результат:

```text
re.IGNORECASE
4
```

`re.NOFLAG` (Python 3.11+) — зрозуміле початкове значення, коли прапорці формуються за умовою:

```python
import re


def find_word(word, text, ignore_case=False):
    flags = re.NOFLAG
    if ignore_case:
        flags |= re.IGNORECASE
    return re.findall(rf"\b{re.escape(word)}\b", text, flags=flags)


print(find_word("python", "Python and python"))
print(find_word("python", "Python and python", ignore_case=True))
```

Результат:

```text
['python']
['Python', 'python']
```

## Вбудовані прапорці

Прапорці можна записувати й усередині шаблону. Це зручно, коли шаблон зберігається у файлі конфігурації або передається у функцію, яка не приймає прапорців.

**Глобальні вбудовані прапорці** діють на весь шаблон і мають стояти на самому його початку. Кілька літер можна поєднувати: `(?im)`.

```python
import re

log = "Error: a\nok\nERROR: b"
print(re.findall(r"(?im)^error.*$", log))
```

Результат:

```text
['Error: a', 'ERROR: b']
```

З Python 3.11 глобальний вбудований прапорець не на початку шаблону — це помилка:

```python
import re

try:
    re.compile(r"abc(?i)")
except re.error as e:
    print(type(e).__name__, "-", e)
```

Результат:

```text
PatternError - global flags not at the start of the expression at position 3
```

**Локальні вбудовані прапорці** (Python 3.6+) діють лише на частину шаблону. `(?i:...)` вмикає прапорець для групи, а `(?-i:...)` вимикає його:

```python
import re

print(re.findall(r"(?i:error) ID-\d+", "ERROR ID-1 error id-2 Error ID-3"))
print(re.findall(r"(?i)hello (?-i:World)", "HELLO World hello world"))
```

Результат:

```text
['ERROR ID-1', 'Error ID-3']
['HELLO World']
```

У першому шаблоні регістр ігнорується лише для слова «error», а `ID` має бути великими літерами. У другому регістр ігнорується всюди, крім `World`.

## Прапорці та скомпільовані шаблони

Прапорці зберігаються в скомпільованому шаблоні. Їх показує атрибут `flags`, зокрема й неявний `re.UNICODE` (значення `32`), який має кожен шаблон `str`:

```python
import re

p = re.compile(r"x", re.IGNORECASE)
print(p)
print(p.flags, re.RegexFlag(p.flags))
```

Результат:

```text
re.compile('x', re.IGNORECASE)
34 re.IGNORECASE|re.UNICODE
```

До вже скомпільованого шаблону прапорці додати не можна:

```python
import re

p = re.compile(r"x")
try:
    re.search(p, "X", flags=re.IGNORECASE)
except ValueError as e:
    print("ValueError:", e)
```

Результат:

```text
ValueError: cannot process flags argument with a compiled pattern
```

## Типові помилки

- **Передавати прапорці позиційно в `sub()`, `subn()` або `split()`.** Їхній четвертий параметр — `count`/`maxsplit`, а не `flags`. `re.sub(p, r, s, re.I)` означає «не більше 2 замін з урахуванням регістру». Python 3.13+ видає `DeprecationWarning`. Завжди пишіть `flags=...`.
- **Поєднувати прапорці через `+`.** Використовуйте `|`. `re.I + re.I` непомітно перетворюється на `re.LOCALE`.
- **Ставити глобальний вбудований прапорець усередині шаблону.** `r"abc(?i)"` — помилка з Python 3.11. Перенесіть його на початок або використайте локальний прапорець `(?i:...)`.
- **Забувати, що `VERBOSE` прибирає пробіли.** Буквальний пробіл пишіть як `\ ` або `[ ]`, а буквальний `#` — як `\#`.
- **Плутати `MULTILINE` і `DOTALL`.** `MULTILINE` стосується `^`/`$`, `DOTALL` — `.`.
- **Вважати, що `re.ASCII` — для байтів.** Він для шаблонів `str`. Лише з байтами працює якраз `re.LOCALE`.

## Підсумок

- Прапорці — члени `re.RegexFlag` (це `IntFlag`). Поєднуйте їх через `|`, ніколи через `+`.
- Передавайте їх як `flags=...`, у `re.compile()` або вбудовуйте в шаблон.
- `IGNORECASE` ігнорує регістр. `MULTILINE` змушує `^`/`$` працювати для кожного рядка. `DOTALL` дозволяє `.` збігатися з переведенням рядка. `VERBOSE` дозволяє пробіли й коментарі.
- `ASCII` обмежує `\w`, `\d`, `\s` і `\b` ASCII-символами в шаблонах `str`. `LOCALE` працює лише з байтами й не рекомендований. `UNICODE` — поведінка за замовчуванням.
- `DEBUG` виводить розібраний і скомпільований шаблон. `NOFLAG` (3.11+) — значення «без прапорців».
- Глобальні вбудовані прапорці, як-от `(?im)`, мають починати шаблон. Локальні `(?i:...)` і `(?-i:...)` діють лише на свою групу.

## Практика

### Вправа 1: Рядки з попередженнями

З журналу нижче витягніть кожен **цілий рядок**, що починається з `warn` або `warning` у будь-якому регістрі. Використайте один виклик `findall()` з двома прапорцями. Очікуваний результат: `['WARN: low memory', 'Warning: disk 91%']`.

```python
log = """INFO: started
WARN: low memory
info: warnings are suppressed
Warning: disk 91%"""
```

### Вправа 2: Багаторядковий блок

Витягніть SQL-текст між `-- begin` і `-- end` (без рядків-маркерів) з рядка нижче за допомогою `re.search()` і відповідного прапорця.

```python
script = """-- begin
SELECT name
FROM users
WHERE active = 1;
-- end"""
```

### Вправа 3: Читабельний шаблон дати

Перепишіть `r"(\d{4})-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])"` з `re.VERBOSE`, по одному рядку з коментарем на кожну частину. Переконайтеся, що обидві версії дають однаковий результат для `"Dates: 2024-03-15, 2024-13-01, 2023-12-31"`.

### Вправа 4: Локальні прапорці

Напишіть один шаблон **без** аргументу `flags`, який знаходить коди товарів на кшталт `sku-123`: префікс `sku` у будь-якому регістрі, потім `-` і рівно три цифри. Цифри мають бути лише ASCII, хоча у вхідних даних трапляються й інші. Перевірте на `"SKU-123, sku-45, Sku-999, sku-١٢٣"`; очікуваний результат — `['SKU-123', 'Sku-999']`.

## Розв'язки

### Вправа 1

```python
import re

log = """INFO: started
WARN: low memory
info: warnings are suppressed
Warning: disk 91%"""

print(re.findall(r"^warn(?:ing)?\b.*$", log, flags=re.IGNORECASE | re.MULTILINE))
```

Результат:

```text
['WARN: low memory', 'Warning: disk 91%']
```

`MULTILINE` дозволяє `^` і `$` збігатися в кожному рядку тексту, а `IGNORECASE` приймає будь-який регістр. Завдяки `^` слово «warnings» усередині рядка `info` не враховується. А `\b` після `warn(?:ing)?` відхилив би й рядок, що починається з довшого слова, як-от «Warnings» чи «Warned».

### Вправа 2

```python
import re

script = """-- begin
SELECT name
FROM users
WHERE active = 1;
-- end"""

m = re.search(r"-- begin\n(.*?)\n-- end", script, flags=re.DOTALL)
print(m[1])
```

Результат:

```text
SELECT name
FROM users
WHERE active = 1;
```

Без `re.DOTALL` `.*?` не може перетнути переведення рядків, і `search()` повертає `None`.

### Вправа 3

```python
import re

compact = re.compile(r"(\d{4})-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])")

verbose = re.compile(
    r"""
    (\d{4})                  # рік: чотири цифри
    -
    (0[1-9]|1[0-2])          # місяць: 01-12
    -
    (0[1-9]|[12]\d|3[01])    # день: 01-31
    """,
    re.VERBOSE,
)

text = "Dates: 2024-03-15, 2024-13-01, 2023-12-31"
print(compact.findall(text))
print(verbose.findall(text))
print(compact.findall(text) == verbose.findall(text))
```

Результат:

```text
[('2024', '03', '15'), ('2023', '12', '31')]
[('2024', '03', '15'), ('2023', '12', '31')]
True
```

`2024-13-01` відхиляють обидві версії, бо `13` — некоректний місяць.

### Вправа 4

```python
import re

text = "SKU-123, sku-45, Sku-999, sku-١٢٣"
print(re.findall(r"(?i:sku)-(?a:\d{3})\b", text))
```

Результат:

```text
['SKU-123', 'Sku-999']
```

`(?i:sku)` робить нечутливим до регістру лише префікс. `(?a:\d{3})` обмежує `\d` ASCII-цифрами всередині цієї групи, тож арабсько-індійські цифри в `sku-١٢٣` не підходять. У `sku-45` лише дві цифри.

---

*Джерело: [pythontutorial.net — Python Regex Flags](https://www.pythontutorial.net/python-regex/python-regex-flags/). Адаптовано й доповнено для PyJourney.*
