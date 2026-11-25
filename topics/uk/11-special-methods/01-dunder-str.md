# __str__

Якщо передати в `print()` об'єкт власного класу, Python покаже щось на кшталт `<__main__.Person object at 0x...>`, а читачеві це нічого не каже. Спеціальний метод `__str__` дає класу змогу самому вирішити, як його екземпляри виглядають у вигляді тексту, тож `print()`, `str()` та f-рядки виводять щось змістовне.

## Що ви дізнаєтесь

- Як виглядає текстове подання об'єкта за замовчуванням і звідки воно береться
- Як реалізувати `__str__` і що він має повертати
- Які вбудовані операції викликають `__str__`: `str()`, `print()`, f-рядки, `format()` і `%s`
- Чому списки та словники ігнорують ваш `__str__`, коли їх виводять
- Яких правил має дотримуватися коректний `__str__` і які помилки виникають, якщо їх порушити
- Як написати `__str__`, що правильно працює й у підкласах

## Текстове подання за замовчуванням

Почнімо зі звичайного класу з трьома атрибутами екземпляра:

```python
class Person:
    def __init__(self, first_name, last_name, age):
        self.first_name = first_name
        self.last_name = last_name
        self.age = age


person = Person("John", "Doe", 25)
print(person)
```

Результат (адреса змінюється з кожним запуском):

```text
<__main__.Person object at 0x1026cd160>
```

Клас не пояснює, як перетворити себе на текст, тож Python бере загальну версію, успадковану від `object`. У ній є модуль (`__main__`), назва класу й адреса об'єкта в пам'яті. Цього досить, щоб під час налагодження відрізнити два об'єкти, але про саму людину тут немає ані слова.

## Реалізація `__str__`

`__str__` — це метод екземпляра без параметрів, крім `self`. Він має **повертати** рядок:

```python
class Person:
    def __init__(self, first_name, last_name, age):
        self.first_name = first_name
        self.last_name = last_name
        self.age = age

    def __str__(self):
        return f"Person({self.first_name},{self.last_name},{self.age})"


person = Person("John", "Doe", 25)
print(person)
```

Результат:

```text
Person(John,Doe,25)
```

Це працює, але текст схожий на виклик конструктора, а такий стиль прийнято використовувати для `__repr__` (про нього йдеться в наступній темі). `__str__` призначений для **кінцевого користувача**: текст має читатися природно, як щось, що можна показати в інтерфейсі, звіті чи повідомленні журналу.

```python
class Person:
    def __init__(self, first_name, last_name, age):
        self.first_name = first_name
        self.last_name = last_name
        self.age = age

    def __str__(self):
        return f"{self.first_name} {self.last_name}, {self.age} years old"


person = Person("John", "Doe", 25)
print(person)
```

Результат:

```text
John Doe, 25 years old
```

> **Порада:** запитайте себе: «Якби користувач побачив цей об'єкт на екрані, що він очікував би прочитати?» Це і є ваш `__str__`.

## Хто викликає `__str__`

Викликати `person.__str__()` напряму майже ніколи не доводиться: це роблять вбудовані операції. `str` — вбудований тип, і `str(obj)` звертається до класу об'єкта по метод `__str__`. Усі інші операції з таблиці нижче працюють через той самий механізм:

| Операція | Що відбувається |
|---|---|
| `str(person)` | викликає `__str__` |
| `print(person)` | перетворює кожен позиційний аргумент через `str()` |
| `f"{person}"` | викликає `format(person, "")`, а той звертається до `str(person)` |
| `"{}".format(person)` | те саме, що й f-рядок |
| `"%s" % person` | викликає `str(person)` |

```python
class Person:
    def __init__(self, first_name, last_name, age):
        self.first_name = first_name
        self.last_name = last_name
        self.age = age

    def __str__(self):
        return f"{self.first_name} {self.last_name}, {self.age} years old"


person = Person("John", "Doe", 25)

print(str(person))
print(person)
print(f"Customer: {person}")
print("Customer: {}".format(person))
print("Customer: %s" % person)
print(person, "has logged in")
```

Результат:

```text
John Doe, 25 years old
John Doe, 25 years old
Customer: John Doe, 25 years old
Customer: John Doe, 25 years old
Customer: John Doe, 25 years old
John Doe, 25 years old has logged in
```

## Контейнери не використовують `__str__`

Поширена несподіванка: покладіть об'єкт у список чи словник і виведіть контейнер.

```python
class Person:
    def __init__(self, first_name, last_name, age):
        self.first_name = first_name
        self.last_name = last_name
        self.age = age

    def __str__(self):
        return f"{self.first_name} {self.last_name}, {self.age} years old"


person = Person("John", "Doe", 25)
print([person])
print({"owner": person})
```

Результат (адреса змінюється):

```text
[<__main__.Person object at 0x100ac1160>]
{'owner': <__main__.Person object at 0x100ac1160>}
```

`str()` для списку будує текст із **`repr()`** кожного елемента, а не з `str()`. Так задумано: `["1", 1]` не повинен виглядати як `[1, 1]`. Щоб керувати цим виглядом, реалізуйте `__repr__`, про який розповідає наступна тема. Якщо ж просто потрібно гарно вивести список, перетворіть елементи самостійно:

```python
people = ["John Doe, 25 years old", "Jane Roe, 31 years old"]
print(", ".join(people))  # John Doe, 25 years old, Jane Roe, 31 years old
```

## Правила коректного `__str__`

### Він має повертати `str`

Якщо повернути щось інше, виклик `str()` згенерує `TypeError`:

```python
class Score:
    def __init__(self, points):
        self.points = points

    def __str__(self):
        return self.points  # int, а не str


try:
    print(Score(42))
except TypeError as error:
    print("TypeError:", error)
```

Результат:

```text
TypeError: __str__ returned non-string (type int)
```

Виправлення: `return str(self.points)` або, ще краще, описовий f-рядок на кшталт `f"{self.points} points"`.

### Він не повинен нічого виводити

Дуже поширена помилка початківців — виводити текст усередині `__str__` замість того, щоб повернути його. Тоді метод повертає `None`, і код, що його викликав, падає:

```python
class Product:
    def __init__(self, name, price):
        self.name = name
        self.price = price

    def __str__(self):
        print(f"{self.name}: {self.price} UAH")  # виводить, а повертає None


try:
    print(Product("Tea", 85))
except TypeError as error:
    print("TypeError:", error)
```

Результат:

```text
Tea: 85 UAH
TypeError: __str__ returned non-string (type NoneType)
```

Текст з'являється один раз як побічний ефект, а потім справжній виклик `print()` завершується помилкою.

### Він не повинен перетворювати `self` на `str`

Усередині `__str__` вирази `str(self)`, `f"{self}"` і `print(self)` знову викликають `__str__`, той знову викликає себе, і так без кінця:

```python
class Node:
    def __str__(self):
        return f"Node: {self}"  # знову викликає __str__


try:
    str(Node())
except RecursionError as error:
    print("RecursionError:", error)
```

Результат:

```text
RecursionError: maximum recursion depth exceeded
```

Будуйте рядок з **атрибутів** об'єкта.

### Він має бути швидким і безпечним

`print()` і записи в журнал трапляються в багатьох місцях, іноді просто під час обробки помилки. `__str__`, який робить запит до бази даних, змінює об'єкт або може згенерувати виняток, суттєво ускладнює налагодження. Нехай це буде дешеве форматування даних, які об'єкт уже має, без жодних змін.

## Спеціальні методи шукаються в класі

Python шукає спеціальні методи в **типі** об'єкта, а не в самому екземплярі. Якщо прикріпити функцію до одного об'єкта, `str()` цього не помітить:

```python
class Person:
    pass


person = Person()
person.__str__ = lambda: "instance-level text"

print(person.__str__())  # звичайний виклик атрибута працює
print(str(person))       # str() ігнорує атрибут екземпляра
```

Результат (адреса змінюється):

```text
instance-level text
<__main__.Person object at 0x104bc1160>
```

Завжди визначайте `__str__` у тілі класу.

## `__str__` і успадкування

Підкласи успадковують `__str__`, як і будь-який інший метод. Якщо жорстко вписати назву класу в текст, кожен підклас показуватиме неправильну назву. Використовуйте `type(self).__name__`, щоб отримати назву фактичного класу:

```python
class Animal:
    def __init__(self, name):
        self.name = name

    def __str__(self):
        return f"{type(self).__name__} named {self.name}"


class Dog(Animal):
    pass


class Cat(Animal):
    pass


print(Animal("Generic"))
print(Dog("Rex"))
print(Cat("Tom"))
```

Результат:

```text
Animal named Generic
Dog named Rex
Cat named Tom
```

## Граничний випадок: специфікатори формату у f-рядках

`__str__` дає звичайний текст. А **специфікатор формату** після двокрапки, як-от `:>30`, обробляє інший спеціальний метод — `__format__`. Типовий `object.__format__` відмовляється приймати будь-який непорожній специфікатор:

```python
class Person:
    def __init__(self, first_name, last_name, age):
        self.first_name = first_name
        self.last_name = last_name
        self.age = age

    def __str__(self):
        return f"{self.first_name} {self.last_name}, {self.age} years old"


person = Person("John", "Doe", 25)

try:
    print(f"[{person:>30}]")
except TypeError as error:
    print("TypeError:", error)

print(f"[{person!s:>30}]")
```

Результат:

```text
TypeError: unsupported format string passed to Person.__format__
[        John Doe, 25 years old]
```

Перетворення `!s` спершу робить з об'єкта рядок через `str()` і лише потім застосовує `>30` до цього рядка. Те саме дає `str(person)` усередині фігурних дужок.

## Типові помилки

- **Виводити текст замість повертати.** `__str__` має повертати текст через `return`. Якщо він виводить текст, то повертає `None`, і ви отримуєте `TypeError: __str__ returned non-string (type NoneType)`.
- **Повертати не рядок.** `return self.age` не спрацює. Загорніть значення в рядок: `return f"{self.age}"`.
- **Викликати `str(self)` або писати `f"{self}"` усередині `__str__`.** Це нескінченна рекурсія і `RecursionError`.
- **Очікувати, що `print(my_list)` використає `__str__`.** Контейнери показують свої елементи через `repr()`. Реалізуйте також `__repr__` або самі з'єднайте `str()` елементів.
- **Застосовувати специфікатор формату прямо до об'єкта.** `f"{obj:>10}"` генерує `TypeError`, якщо клас не реалізує `__format__`. Пишіть `f"{obj!s:>10}"`.
- **Присвоювати `__str__` екземпляру.** `obj.__str__ = ...` ігнорують і `str()`, і `print()`. Визначайте метод у класі.

## Підсумок

- Без `__str__` об'єкт виводиться як `<module.ClassName object at 0x...>`.
- `__str__(self)` повертає зрозумілий людині рядок (`str`), що описує об'єкт.
- `str()`, `print()`, f-рядки, `str.format()` і `%s` працюють через `__str__`.
- Списки, словники та інші контейнери показують свої елементи через `repr()`, а не `str()`.
- `__str__` має повертати `str`, не повинен нічого виводити й не повинен викликати `str(self)`.
- Спеціальні методи шукаються в класі, тому визначайте `__str__` у тілі класу.
- Використовуйте `type(self).__name__`, щоб текст лишався правильним і в підкласах.

## Практика

### Вправа 1: Зрозуміла книжка

Напишіть клас `Book` з атрибутами `title`, `author` і `year`. Виклик `print(Book("Kobzar", "Taras Shevchenko", 1840))` має вивести:

```text
"Kobzar" by Taras Shevchenko (1840)
```

Потім використайте книжку всередині f-рядка: `f"Now reading: {book}"`.

### Вправа 2: Виправте зламаний `__str__`

Цей код один раз виводить текст, а потім падає. Поясніть чому і виправте його так, щоб `print(Product("Tea", 85))` виводив `Tea: 85 UAH` рівно один раз.

```python
class Product:
    def __init__(self, name, price):
        self.name = name
        self.price = price

    def __str__(self):
        print(f"{self.name}: {self.price} UAH")


print(Product("Tea", 85))
```

### Вправа 3: Вирівняні температури

Напишіть клас `Temperature`, який зберігає градуси Цельсія. Його `__str__` має показувати один знак після коми та одиницю `C`, наприклад `21.5 C`. Потім виведіть показники `21.456`, `-3` і `100`, вирівняні праворуч у стовпці завширшки 8 символів, кожен у квадратних дужках.

### Вправа 4: Багаторядковий чек

Напишіть клас `Cart` з методом `add(name, price)`. Для порожнього кошика його `__str__` має повертати `Cart is empty`. Інакше він повертає чек: по рядку на кожен товар (назва вирівняна ліворуч у 10 символах, ціна вирівняна праворуч у 8 символах з 2 знаками після коми), рядок-розділювач із 18 дефісів і рядок `Total` у тому самому форматі.

## Розв'язки

### Вправа 1

```python
class Book:
    def __init__(self, title, author, year):
        self.title = title
        self.author = author
        self.year = year

    def __str__(self):
        return f'"{self.title}" by {self.author} ({self.year})'


book = Book("Kobzar", "Taras Shevchenko", 1840)
print(book)
print(f"Now reading: {book}")
```

Результат:

```text
"Kobzar" by Taras Shevchenko (1840)
Now reading: "Kobzar" by Taras Shevchenko (1840)
```

### Вправа 2

`__str__` вивів текст, а потім неявно повернув `None`. `print()` викликав `str()` для об'єкта, отримав `None` замість рядка й згенерував `TypeError: __str__ returned non-string (type NoneType)`. Виправлення — повернути рядок:

```python
class Product:
    def __init__(self, name, price):
        self.name = name
        self.price = price

    def __str__(self):
        return f"{self.name}: {self.price} UAH"


print(Product("Tea", 85))
```

Результат:

```text
Tea: 85 UAH
```

### Вправа 3

```python
class Temperature:
    def __init__(self, celsius):
        self.celsius = celsius

    def __str__(self):
        return f"{self.celsius:.1f} C"


readings = [Temperature(21.456), Temperature(-3), Temperature(100)]
for t in readings:
    print(f"[{t!s:>8}]")
```

Результат:

```text
[  21.5 C]
[  -3.0 C]
[ 100.0 C]
```

`!s` спершу перетворює кожен об'єкт на рядок, тому вирівнювання `>8` застосовується саме до рядка. Без `!s` вираз `f"{t:>8}"` згенерував би `TypeError`.

### Вправа 4

```python
class Cart:
    def __init__(self):
        self.items = []

    def add(self, name, price):
        self.items.append((name, price))

    def __str__(self):
        if not self.items:
            return "Cart is empty"
        lines = [f"{name:<10}{price:>8.2f}" for name, price in self.items]
        total = sum(price for _, price in self.items)
        lines.append("-" * 18)
        lines.append(f"{'Total':<10}{total:>8.2f}")
        return "\n".join(lines)


cart = Cart()
print(cart)
cart.add("Coffee", 4.5)
cart.add("Croissant", 2.25)
cart.add("Juice", 3)
print(cart)
```

Результат:

```text
Cart is empty
Coffee        4.50
Croissant     2.25
Juice         3.00
------------------
Total         9.75
```

`__str__` може повертати кілька рядків. Збирайте їх у список і з'єднуйте через `"\n"`, а не виводьте по одному.

---

*Джерело: [pythontutorial.net — Python __str__](https://web.archive.org/web/2026/https://www.pythontutorial.net/python-oop/python-__str__/). Адаптовано й доповнено для PyJourney.*
