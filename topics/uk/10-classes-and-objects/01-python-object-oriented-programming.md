# Об'єктно-орієнтоване програмування в Python

Об'єктно-орієнтоване програмування (ООП) будує програму навколо **об'єктів**: одиниць, що поєднують дані з функціями, які з цими даними працюють. Python об'єктно-орієнтований до самої основи, адже кожне значення в ньому є об'єктом. Ця тема — оглядова екскурсія основними інструментами ООП у Python. Кожному з них далі в розділі присвячено окрему детальну тему.

## Що ви дізнаєтесь

- Що таке об'єкти, класи та екземпляри і що означає «все є об'єктом»
- Як оголосити клас, створювати екземпляри й ініціалізувати їхні атрибути в `__init__`
- Чим відрізняються методи екземпляра, методи класу та статичні методи
- Як атрибути класу спільно використовуються всіма екземплярами
- Як успадкування та `super()` дають змогу одному класу перевикористати й розширити інший
- Як перевизначення методу дає поліморфізм

## Об'єкти: стан і поведінка

Об'єкт має дві сторони:

- **Стан** (state): дані, які він зберігає зараз (значення числа, елементи списку, ім'я користувача).
- **Поведінка** (behaviour): те, що він уміє робити. Її виражають **методи**, тобто функції, прикріплені до об'єкта.

Ви весь час працювали з об'єктами. Цілі числа, рядки й навіть функції — це об'єкти, які мають тип і методи:

```python
count = 42
words = "hello world"

print(type(count))
print(count.bit_length())
print(type(words))
print(words.title())
print(type(len))
```

Результат:

```text
<class 'int'>
6
<class 'str'>
Hello World
<class 'builtin_function_or_method'>
```

Значення `42` — це стан об'єкта `count`, а `bit_length()` — одна з форм його поведінки. Його тип, `int`, є **класом**: описом стану й поведінки, спільних для всіх цілих чисел.

Клас схожий на креслення, а об'єкти, збудовані за ним, — це його **екземпляри** (instances). Один клас `int` — мільйони екземплярів-чисел.

```text
            class Person            <- креслення
          /        |        \
  екземпляр    екземпляр    екземпляр
  "John", 25   "Jane", 22   "Olena", 31
```

### Навіщо потрібне ООП?

Коли програма росте, тримати дані окремо від коду, що їх змінює, стає дедалі складніше. ООП об'єднує їх і дає чотири класичні ідеї:

| Ідея | Що вона означає в Python |
|---|---|
| Інкапсуляція (encapsulation) | Об'єкт поєднує свої дані з методами, які з ними працюють, і контролює, як ці дані змінюються. |
| Абстракція (abstraction) | Користувачі класу викликають прості методи й не мусять знати, як ті влаштовані всередині. |
| Успадкування (inheritance) | Новий клас може перевикористати наявний клас і додати або змінити поведінку. |
| Поліморфізм (polymorphism) | Різні класи можуть по-своєму відповідати на виклик того самого методу. |

## Оголошення класу та створення об'єктів

Скористайтеся ключовим словом `class`, після нього вкажіть назву й двокрапку. Тіло класу пишеться з відступом. `pass` — заглушка для порожнього тіла:

```python
class Person:
    pass


person = Person()
print(type(person))
print(isinstance(person, Person))
```

Результат:

```text
<class '__main__.Person'>
True
```

Екземпляр створюють, **викликаючи** клас як функцію: `Person()`. Класи можна викликати, і кожен виклик дає новий, незалежний об'єкт:

```python
class Person:
    pass


first = Person()
second = Person()
print(first is second)
```

Результат:

```text
False
```

## Атрибути екземпляра

Python — динамічна мова: прикріпити атрибут до об'єкта можна будь-коли через крапку. Але атрибут, доданий так, існує лише в *цьому одному* об'єкті:

```python
class Person:
    pass


person = Person()
person.name = "John"
print(person.name)

other = Person()
print(hasattr(other, "name"))
```

Результат:

```text
John
False
```

Додавати атрибути вручну ненадійно: легко про щось забути, і ніщо не гарантує, що кожен `Person` матиме `name`. Стандартне рішення — спеціальний метод `__init__`. Python викликає його автоматично одразу після створення нового екземпляра, тож саме тут задають атрибути, які повинен мати кожен екземпляр:

```python
class Person:
    def __init__(self, name, age):
        self.name = name
        self.age = age


person = Person("John", 25)
print(person.name)
print(person.age)
```

Результат:

```text
John
25
```

Що відбувається під час виклику `Person("John", 25)`:

1. Python створює новий порожній об'єкт `Person`.
2. Викликає `__init__(новий_об'єкт, "John", 25)`. Новий об'єкт потрапляє в перший параметр, `self`.
3. `self.name = name` зберігає значення як атрибут **саме цього об'єкта**.
4. Готовий об'єкт повертається й прив'язується до імені `person`.

## Методи екземпляра

Функція, оголошена всередині класу, — це **метод**. Метод екземпляра отримує екземпляр першим параметром, `self`, тож може читати й змінювати його стан:

```python
class Person:
    def __init__(self, name, age):
        self.name = name
        self.age = age

    def greet(self):
        return f"Hi, it's {self.name}."


person = Person("John", 25)
print(person.greet())
```

Результат:

```text
Hi, it's John.
```

Метод викликають через крапку. `self` вручну не передають: `person.greet()` перетворюється на `Person.greet(person)`, тож об'єкт перед крапкою стає `self`.

## Атрибути класу

Атрибут, присвоєний безпосередньо в тілі класу, належить **класу** і спільний для всіх екземплярів. Використовуйте такі атрибути для констант і для даних про клас загалом, наприклад для кількості створених екземплярів:

```python
class Person:
    counter = 0

    def __init__(self, name, age):
        self.name = name
        self.age = age
        Person.counter += 1

    def greet(self):
        return f"Hi, it's {self.name}."


p1 = Person("John", 25)
p2 = Person("Jane", 22)
print(Person.counter)
print(p1.counter)
```

Результат:

```text
2
2
```

Атрибут класу можна прочитати через клас (`Person.counter`) або через будь-який екземпляр (`p1.counter`). Якщо в екземпляра немає атрибута з такою назвою, Python шукає його в класі.

> **Зверніть увагу:** щоб *змінити* атрибут класу, присвоюйте через клас: `Person.counter += 1`. Запис `self.counter += 1` створив би окремий атрибут екземпляра в одному об'єкті, а спільний лічильник залишився б незмінним (див. «Типові помилки»).

## Методи класу

**Метод класу** (class method) працює з класом, а не з окремим екземпляром. Його позначають декоратором `@classmethod`. Python передає першим аргументом сам клас, і за домовленістю цей параметр називають `cls`. Найчастіше метод класу слугує **альтернативним конструктором**, тобто іншим способом створити екземпляр:

```python
class Person:
    counter = 0

    def __init__(self, name, age):
        self.name = name
        self.age = age
        Person.counter += 1

    @classmethod
    def create_anonymous(cls):
        return cls("Anonymous", 22)


anonymous = Person.create_anonymous()
print(anonymous.name)
print(Person.counter)
```

Результат:

```text
Anonymous
1
```

Зверніть увагу: `cls("Anonymous", 22)`, а не `Person("Anonymous", 22)`. Коли метод викликає підклас, `cls` дорівнює цьому підкласу, тож фабрика створює об'єкт правильного типу. Якщо жорстко прописати `Person`, результатом завжди буде звичайний `Person`.

## Статичні методи

**Статичний метод** (static method) не отримує автоматично ні екземпляр, ні клас. Це звичайна функція, розміщена в класі, бо вона логічно до нього належить. Позначають її декоратором `@staticmethod`:

```python
class TemperatureConverter:
    @staticmethod
    def celsius_to_fahrenheit(c):
        return 9 * c / 5 + 32

    @staticmethod
    def fahrenheit_to_celsius(f):
        return 5 * (f - 32) / 9


f = TemperatureConverter.celsius_to_fahrenheit(30)
print(f)
print(TemperatureConverter.fahrenheit_to_celsius(86))
```

Результат:

```text
86.0
30.0
```

Результат — `86.0`, а не `86`: у Python 3 оператор `/` завжди повертає `float`, навіть коли ділення без остачі.

### Три види методів поруч

| | Метод екземпляра | Метод класу | Статичний метод |
|---|---|---|---|
| Декоратор | немає | `@classmethod` | `@staticmethod` |
| Перший параметр (передається автоматично) | екземпляр, `self` | клас, `cls` | нічого |
| Доступ до стану екземпляра | так | ні | ні |
| Доступ до стану класу | так, через `self` або `type(self)` | так, через `cls` | лише явно вказавши назву класу |
| Типове застосування | поведінка одного об'єкта | альтернативні конструктори, операції над класом загалом | допоміжні функції, пов'язані з класом |

## Успадкування

Клас може **успадковувати** інший клас. Дочірній клас (підклас) автоматично отримує всі атрибути й методи батьківського (базового) класу і може додавати нові або замінювати наявні.

```python
class Person:
    def __init__(self, name, age):
        self.name = name
        self.age = age

    def greet(self):
        return f"Hi, it's {self.name}."


class Employee(Person):
    def __init__(self, name, age, job_title):
        super().__init__(name, age)
        self.job_title = job_title

    def greet(self):
        return super().greet() + f" I'm a {self.job_title}."


employee = Employee("John", 25, "Python Developer")
print(employee.greet())
print(employee.age)
print(isinstance(employee, Person))
print(issubclass(Employee, Person))
```

Результат:

```text
Hi, it's John. I'm a Python Developer.
25
True
True
```

Головне:

- `class Employee(Person)` вказує батьківський клас у дужках.
- `super().__init__(name, age)` запускає ініціалізатор батьківського класу, тож `name` і `age` налаштовуються так само, як у `Person`. Потім дочірній клас додає власний `job_title`.
- Повторне оголошення `greet()` в `Employee` **перевизначає** (override) батьківську версію. Усередині неї `super().greet()` усе одно викликає оригінал, тож дочірній клас *розширює* поведінку, а не переписує її з нуля.
- `Employee` **є** `Person`: це підтверджує `isinstance()`, і в нього є `age`, хоча сам він цього атрибута не оголошує.

## Поліморфізм

Оскільки кожен `Person` має метод `greet()`, код може працювати з сумішшю звичайних осіб і працівників, не перевіряючи їхній точний тип. Кожен об'єкт відповідає по-своєму:

```python
class Person:
    def __init__(self, name, age):
        self.name = name
        self.age = age

    def greet(self):
        return f"Hi, it's {self.name}."


class Employee(Person):
    def __init__(self, name, age, job_title):
        super().__init__(name, age)
        self.job_title = job_title

    def greet(self):
        return super().greet() + f" I'm a {self.job_title}."


people = [Person("Jane", 22), Employee("John", 25, "Python Developer")]
for someone in people:
    print(someone.greet())
```

Результат:

```text
Hi, it's Jane.
Hi, it's John. I'm a Python Developer.
```

Цикл викликає метод з однією й тією самою назвою, а Python обирає потрібну реалізацію залежно від класу кожного об'єкта. Це і є поліморфізм, і саме тому успадкування та перевизначення такі корисні.

## Типові помилки

- **Забути `self` в оголошенні методу.** Python завжди передає екземпляр, тож метод без параметра для нього падає під час виклику:

  ```python
  class Person:
      def greet():
          return "Hi!"


  Person().greet()
  ```

  Результат:

  ```text
  Traceback (most recent call last):
    ...
  TypeError: Person.greet() takes 0 positional arguments but 1 was given
  ```

- **Забути дужки.** `person.greet` (без `()`) не викликає метод. Ви отримаєте об'єкт зв'язаного методу, і `print` покаже щось на зразок `<bound method Person.greet of <__main__.Person object at 0x...>>`.

- **Жорстко прописати назву класу в методі класу.** Це непомітно ламає підкласи:

  ```python
  class Person:
      def __init__(self, name, age):
          self.name = name
          self.age = age

      @classmethod
      def create_anonymous(cls):
          return Person("Anonymous", 22)  # помилка: cls ігнорується


  class Employee(Person):
      pass


  print(type(Employee.create_anonymous()).__name__)
  ```

  Результат:

  ```text
  Person
  ```

  З `return cls("Anonymous", 22)` результатом був би `Employee`.

- **Не викликати `super().__init__()` у підкласі.** Якщо дочірній клас оголошує власний `__init__` і пропускає батьківський, атрибути батьківського класу так і не з'являються, а спроба ними скористатися спричиняє `AttributeError`.

- **Оновлювати спільний лічильник через `self`.** `self.counter += 1` читає атрибут класу, додає 1 і зберігає результат як *новий атрибут екземпляра*. Атрибут класу не змінюється:

  ```python
  class Person:
      counter = 0

      def __init__(self):
          self.counter += 1


  a = Person()
  b = Person()
  print(Person.counter, a.counter, b.counter)
  ```

  Результат:

  ```text
  0 1 1
  ```

## Підсумок

- У Python усе є об'єктом зі станом (даними) і поведінкою (методами). Клас їх описує, а екземпляри — це об'єкти, створені з класу.
- Клас оголошують через `class Name:`, а екземпляри створюють, викликаючи його: `Name(...)`.
- `__init__` автоматично виконується після створення екземпляра й налаштовує його атрибути через `self`.
- Методи екземпляра отримують екземпляр як `self`. Методи класу (`@classmethod`) отримують клас як `cls`. Статичні методи (`@staticmethod`) автоматично не отримують нічого.
- Атрибути класу зберігаються в класі й спільні для всіх екземплярів. Змінюйте їх через назву класу.
- Підклас успадковує батьківський клас, може перевизначати методи й викликати батьківську версію через `super()`.
- Поліморфізм означає, що один виклик методу працює з об'єктами різних класів, і кожен відповідає по-своєму.

## Практика

### Вправа 1: Клас Book

Оголосіть клас `Book`, чий `__init__` приймає `title` і `author`. Додайте метод `describe()`, який повертає рядок на зразок `'Dune' by Frank Herbert`. Створіть дві книжки й виведіть їхні описи.

### Вправа 2: Лічильник і альтернативний конструктор

Розширте `Book`:

- додайте атрибут класу `total`, що рахує, скільки книжок створено;
- додайте метод класу `from_string(text)`, який приймає `"Title;Author"` і повертає нову книжку (використайте `cls`).

Створіть одну книжку звичайним способом, а другу — через `from_string("Kobzar;Taras Shevchenko")`, потім виведіть обидва описи та `Book.total`.

### Вправа 3: Підклас EBook

Створіть `EBook(Book)`, який додатково приймає `size_mb`. Перевизначте `describe()` так, щоб він перевикористовував батьківський текст через `super()` і додавав розмір, наприклад `'Dune' by Frank Herbert [2.5 MB]`. Покладіть `Book` і `EBook` у список і в циклі виведіть `describe()` для кожного. Також перевірте, що `EBook.from_string()`, викликаний на підкласі, повертає `EBook` (передайте розмір додатковим аргументом зі значенням за замовчуванням).

### Вправа 4: Виправте лічильник

Цей клас мав би рахувати створені сесії, але виводить `0`. Поясніть чому й виправте.

```python
class Session:
    count = 0

    def __init__(self, user):
        self.user = user
        self.count += 1


Session("max")
Session("olena")
print(Session.count)
```

## Розв'язки

### Вправа 1

```python
class Book:
    def __init__(self, title, author):
        self.title = title
        self.author = author

    def describe(self):
        return f"'{self.title}' by {self.author}"


dune = Book("Dune", "Frank Herbert")
hobbit = Book("The Hobbit", "J. R. R. Tolkien")
print(dune.describe())
print(hobbit.describe())
```

Результат:

```text
'Dune' by Frank Herbert
'The Hobbit' by J. R. R. Tolkien
```

### Вправа 2

```python
class Book:
    total = 0

    def __init__(self, title, author):
        self.title = title
        self.author = author
        Book.total += 1

    def describe(self):
        return f"'{self.title}' by {self.author}"

    @classmethod
    def from_string(cls, text):
        title, author = text.split(";")
        return cls(title, author)


dune = Book("Dune", "Frank Herbert")
kobzar = Book.from_string("Kobzar;Taras Shevchenko")
print(dune.describe())
print(kobzar.describe())
print(Book.total)
```

Результат:

```text
'Dune' by Frank Herbert
'Kobzar' by Taras Shevchenko
2
```

`from_string()` лише розбирає текст, а далі делегує роботу `cls(...)`, тож `__init__` однаково виконується і лічильник збільшується.

### Вправа 3

```python
class Book:
    total = 0

    def __init__(self, title, author):
        self.title = title
        self.author = author
        Book.total += 1

    def describe(self):
        return f"'{self.title}' by {self.author}"

    @classmethod
    def from_string(cls, text, *args):
        title, author = text.split(";")
        return cls(title, author, *args)


class EBook(Book):
    def __init__(self, title, author, size_mb=1.0):
        super().__init__(title, author)
        self.size_mb = size_mb

    def describe(self):
        return super().describe() + f" [{self.size_mb} MB]"


library = [Book("The Hobbit", "J. R. R. Tolkien"), EBook("Dune", "Frank Herbert", 2.5)]
for book in library:
    print(book.describe())

ebook = EBook.from_string("Kobzar;Taras Shevchenko", 0.8)
print(type(ebook).__name__, "-", ebook.describe())
print(Book.total)
```

Результат:

```text
'The Hobbit' by J. R. R. Tolkien
'Dune' by Frank Herbert [2.5 MB]
EBook - 'Kobzar' by Taras Shevchenko [0.8 MB]
3
```

Оскільки `from_string()` використовує `cls`, виклик на `EBook` створює `EBook`. Додаткові `*args` передаються далі в `__init__` підкласу.

### Вправа 4

`self.count += 1` означає `self.count = self.count + 1`. Читання `self.count` знаходить атрибут класу (`0`), але присвоєння створює новий атрибут **екземпляра** `count` в одній конкретній сесії. `Session.count` залишається `0`. Присвоюйте через клас:

```python
class Session:
    count = 0

    def __init__(self, user):
        self.user = user
        Session.count += 1


Session("max")
Session("olena")
print(Session.count)
```

Результат:

```text
2
```

---

*Джерело: [pythontutorial.net — Python Object-oriented Programming](https://www.pythontutorial.net/python-oop/python-object-oriented-programming/). Адаптовано й доповнено для PyJourney.*
