# Клас

**Клас** (class) — це креслення, за яким створюються об'єкти. Він описує, які дані зберігає кожен об'єкт цього виду і що він уміє робити. У цій темі розглянемо, з чого складається об'єкт, як оголосити клас і створювати екземпляри, як перевірити ідентичність і тип об'єкта та чому клас сам є об'єктом.

## Що ви дізнаєтесь

- З чого складається об'єкт: стан (атрибути) і поведінка (методи)
- Як оголосити клас і назвати його відповідно до домовленостей Python
- Як створювати екземпляри та що означає те, що для них виводить `print()`
- Як перевірити ідентичність об'єкта за допомогою `id()`, а його клас — за допомогою `isinstance()` і `type()`
- Чому клас теж є об'єктом, екземпляром `type`, і що з цього випливає

## Об'єкти: стан і поведінка

Об'єкт — це контейнер, що зберігає **дані** й **функціональність** разом.

- Дані описують об'єкт у певний момент часу, тому їх називають **станом** (state) об'єкта. У Python стан моделюють **атрибутами**.
- Функціональність описує, що об'єкт уміє робити, тобто його **поведінку** (behaviour). У Python поведінку моделюють функціями. Функцію, прив'язану до об'єкта, називають **методом**.

Знайомий приклад — список. Його елементи — це стан, а методи на зразок `append()` — поведінка. Виклик методу може змінити стан:

```python
cart = ["apple", "bread"]
print(cart)
cart.append("milk")
print(cart)
```

Результат:

```text
['apple', 'bread']
['apple', 'bread', 'milk']
```

Щоб створити власний вид об'єктів, спершу оголошують **клас**. З одного класу можна створити скільки завгодно об'єктів. Об'єкти, створені з класу, називають **екземплярами** (instances) цього класу.

## Оголошення класу

Напишіть ключове слово `class`, назву класу й двокрапку. Усе, що нижче з відступом, належить до тіла класу:

```python
class Person:
    pass
```

Тіло класу не може бути порожнім, тому `pass` слугує заглушкою, доки ви не додасте справжній код. Рядок документації (docstring) теж вважається тілом, і це кращий варіант, бо він документує клас:

```python
class SalesEmployee:
    """An employee who earns a commission on sales."""


print(SalesEmployee.__doc__)
```

Результат:

```text
An employee who earns a commission on sales.
```

### Як називати класи

PEP 8, посібник зі стилю коду Python, радить називати класи у стилі **CapWords** (його ще називають PascalCase або CamelCase): кожне слово починається з великої літери, підкреслень немає.

| Добре | Краще уникати |
|---|---|
| `Person` | `person` |
| `SalesEmployee` | `sales_employee`, `Sales_Employee` |
| `HttpRequest` | `httprequest` |

Python цього не вимагає, але така домовленість дає змогу з першого погляду відрізнити класи (`Person`) від функцій і змінних (`person`, `get_person`). Вбудовані типи на кшталт `int`, `str` і `list` — історичний виняток.

### Тіло класу виконується один раз

Тіло класу — це звичайний код. Python виконує його **один раз**, коли доходить до інструкції `class`, і кожне ім'я, присвоєне в тілі, стає атрибутом класу:

```python
print("before the class")


class Greeter:
    print("running the class body")
    greeting = "Hello"


print("after the class")
print(Greeter.greeting)
```

Результат:

```text
before the class
running the class body
after the class
Hello
```

Оголошення класу не створює жодного екземпляра. Воно створює лише сам клас.

## Створення екземплярів

Щоб створити екземпляр, викличте клас із дужками, так само як функцію:

```python
class Person:
    pass


person = Person()
print(person)
```

Результат (адреса змінюється від запуску до запуску):

```text
<__main__.Person object at 0x102ec92b0>
```

Цей типовий текст складається з трьох частин:

- `__main__` — це **модуль**, у якому оголошено клас. Коли файл запускають напряму, його модуль має назву `__main__`. Якби клас був у файлі `people.py` і його імпортували, ви побачили б `people.Person`.
- `Person` — назва класу.
- `0x102ec92b0` — місце, де об'єкт розташований у пам'яті (у CPython).

Типовий текст не надто інформативний. Його можна замінити, оголосивши спеціальний метод `__repr__`, про який детально йтиметься в наступних темах:

```python
class Person:
    def __init__(self, name):
        self.name = name

    def __repr__(self):
        return f"Person(name={self.name!r})"


print(Person("John"))
```

Результат:

```text
Person(name='John')
```

### Кожен виклик створює новий об'єкт

Два виклики дають два окремі об'єкти, навіть якщо вони виглядають однаково. За замовчуванням `==` для ваших класів порівнює ідентичність, тож два різні екземпляри не рівні між собою:

```python
class Person:
    pass


a = Person()
b = Person()
print(a is b)
print(a == b)
```

Результат:

```text
False
False
```

Пояснити класу, що означає «рівні», можна, оголосивши метод `__eq__`. Доки цього не зроблено, кожен екземпляр дорівнює лише самому собі.

## Ідентичність об'єкта: `id()`

Кожен об'єкт має ідентичність (identity), яку повертає вбудована функція `id()`. У CPython це адреса об'єкта в пам'яті, те саме число, що ви бачили в типовому виведенні. `hex()` перетворює його на звичну форму `0x...`:

```python
class Person:
    pass


person = Person()
print(person)
print(id(person))
print(hex(id(person)))
```

Результат (числа змінюються від запуску до запуску):

```text
<__main__.Person object at 0x102ec92b0>
4344025776
0x102ec92b0
```

Ідентичність унікальна **лише серед об'єктів, що існують одночасно**. Після знищення об'єкта його `id()` може дістатися новому об'єкту. Використовуйте ідентичність для порівнянь (`a is b`), але ніколи не зберігайте її як ключ і не прописуйте в коді.

## Перевірка класу: `isinstance()` і `type()`

`isinstance(obj, cls)` повертає `True`, якщо `obj` є екземпляром `cls` **або будь-якого його підкласу**. `type(obj)` повертає точний клас об'єкта:

```python
class Person:
    pass


class Employee(Person):
    pass


worker = Employee()
print(isinstance(worker, Employee))
print(isinstance(worker, Person))
print(type(worker))
print(type(worker) is Person)
print(isinstance(42, (int, float)))
```

Результат:

```text
True
True
<class '__main__.Employee'>
False
True
```

`Employee` *є* `Person`, тож `isinstance()` повертає `True`, а перевірка точного типу `type(worker) is Person` дає `False`. Останній рядок показує, що `isinstance()` приймає й кортеж класів і повертає `True`, якщо підходить будь-який із них.

> **Порада:** для перевірки типу віддавайте перевагу `isinstance()`. Ця функція враховує успадкування, тож підкласи працюватимуть усюди, де працює батьківський клас. `type(obj) is Cls` використовуйте лише тоді, коли справді треба виключити підкласи.

## Клас теж є об'єктом

У Python усе є об'єктом, і класи не виняток. Виконуючи інструкцію `class`, Python створює **об'єкт класу** й прив'язує його до назви класу. Як і будь-який об'єкт, він має атрибути:

```python
class Person:
    pass


print(Person.__name__)
print(Person.__module__)
print(type(Person))
print(isinstance(Person, type))
```

Результат:

```text
Person
__main__
<class 'type'>
True
```

Типом класу є `type`. Інакше кажучи, `Person` — це **екземпляр `type`**, так само як `person` — екземпляр `Person`. А поведінка об'єкта класу полягає в тому, що під час виклику він створює нові екземпляри.

```text
person  --екземпляр-->  Person  --екземпляр-->  type
```

### Класи — повноправні значення

Оскільки клас — звичайний об'єкт, його можна прив'язати до іншого імені, передати у функцію, повернути з неї або зберегти в контейнері:

```python
class Cat:
    pass


class Dog:
    pass


def make(animal_class):
    return animal_class()


Pet = Dog
print(Pet.__name__)
print(type(make(Cat)).__name__)

registry = {"cat": Cat, "dog": Dog}
print(type(registry["dog"]()).__name__)
```

Результат:

```text
Dog
Cat
Dog
```

Саме так працюють фабрики й реєстри плагінів: код обирає клас під час виконання, а потім викликає його.

### Створення класу через `type()`

Оскільки класи є екземплярами `type`, клас можна створити й прямим викликом `type(name, bases, namespace)`. Інструкція `class` — просто читабельніший спосіб зробити те саме:

```python
Point = type("Point", (), {"x": 0, "y": 0})

p = Point()
print(Point.__name__, p.x, p.y)
print(type(Point))
```

Результат:

```text
Point 0 0
<class 'type'>
```

У повсякденному коді це знадобиться рідко, але приклад показує, що в класах немає нічого магічного: це об'єкти, які створює `type`.

## Типові помилки

- **Забути дужки.** `person = Person` не створює екземпляр, а лише дає класу друге ім'я:

  ```python
  class Person:
      pass


  person = Person
  print(person)
  print(person is Person)
  ```

  Результат:

  ```text
  <class '__main__.Person'>
  True
  ```

- **Залишити тіло класу порожнім.** Рядок `class` без жодного рядка з відступом після нього — синтаксична помилка. Використайте `pass`, `...` або рядок документації:

  ```text
  IndentationError: expected an indented block after class definition on line 1
  ```

- **Називати класи як функції.** `class sales_employee:` працює, але порушує домовленість, за якою кожен Python-розробник розпізнає класи.

- **Очікувати, що `==` порівнює атрибути.** Два окремо створені екземпляри з однаковими даними *не* рівні, якщо клас не оголошує `__eq__`.

- **Перевіряти тип через `type(obj) == Cls`.** Така перевірка відкидає підкласи. Використовуйте `isinstance(obj, Cls)`.

- **Покладатися на значення `id()` або адреси.** Вони змінюються між запусками й можуть повторно використовуватися після знищення об'єкта.

## Підсумок

- Об'єкт поєднує стан (атрибути) і поведінку (методи). Клас — це креслення, а створені з нього об'єкти — його екземпляри.
- Клас оголошують через `class Name:` і називають у стилі CapWords. Для порожнього тіла використовуйте `pass` або рядок документації.
- Тіло класу виконується один раз, під час оголошення. Екземпляри створюються пізніше, викликом класу: `Name()`.
- Кожен виклик створює новий окремий об'єкт. За замовчуванням `==` між екземплярами порівнює ідентичність.
- `id()` повертає ідентичність об'єкта (у CPython — його адресу). Вона унікальна лише серед живих об'єктів.
- `isinstance()` перевіряє клас з урахуванням успадкування. `type()` повертає точний клас.
- Клас сам є об'єктом, екземпляром `type`, тож його можна передавати, зберігати й створювати динамічно.

## Практика

### Вправа 1: Дві машини

Оголосіть клас `Car`, тіло якого складається лише з рядка документації. Створіть два екземпляри й виведіть:

1. чи це той самий об'єкт;
2. чи обидва є екземплярами `Car`;
3. рядок документації класу.

### Вправа 2: Опис будь-якого класу

Напишіть функцію `describe_class(cls)`, яка повертає рядок такого формату:

```text
<name> from module <module>, an instance of <metaclass name>
```

Викличте її для власного класу `Car` і для вбудованого класу `int`. Про що свідчить результат для `int`?

### Вправа 3: Фабрика фігур

Оголосіть три порожні класи: `Circle`, `Square` і `Triangle`. Збережіть їх у словнику під ключами `"circle"`, `"square"` і `"triangle"`. Напишіть функцію `create(kind)`, яка повертає новий екземпляр відповідного класу або генерує `ValueError` зі зрозумілим повідомленням для невідомого виду. Створіть фігури зі списку `["circle", "square"]`, виведіть назви їхніх класів, а потім покажіть, що станеться для `"hexagon"`.

### Вправа 4: Передбачте результат

Запишіть, що виведе кожен рядок, перш ніж запускати код.

```python
class Animal:
    pass


class Dog(Animal):
    pass


rex = Dog()
print(isinstance(rex, Animal))
print(type(rex) is Animal)
print(isinstance(Dog, type))
print(isinstance(rex, type))
print(type(Dog) is type(Animal))
```

## Розв'язки

### Вправа 1

```python
class Car:
    """A car that can be driven around."""


first = Car()
second = Car()
print(first is second)
print(isinstance(first, Car) and isinstance(second, Car))
print(Car.__doc__)
```

Результат:

```text
False
True
A car that can be driven around.
```

### Вправа 2

```python
class Car:
    """A car that can be driven around."""


def describe_class(cls):
    return f"{cls.__name__} from module {cls.__module__}, an instance of {type(cls).__name__}"


print(describe_class(Car))
print(describe_class(int))
```

Результат:

```text
Car from module __main__, an instance of type
int from module builtins, an instance of type
```

Вбудовані типи теж є класами. `int` міститься в модулі `builtins` і, як і ваші власні класи, є екземпляром `type`.

### Вправа 3

```python
class Circle:
    pass


class Square:
    pass


class Triangle:
    pass


SHAPES = {"circle": Circle, "square": Square, "triangle": Triangle}


def create(kind):
    try:
        shape_class = SHAPES[kind]
    except KeyError:
        raise ValueError(f"unknown shape: {kind!r}") from None
    return shape_class()


for kind in ["circle", "square"]:
    print(type(create(kind)).__name__)

try:
    create("hexagon")
except ValueError as error:
    print("Error:", error)
```

Результат:

```text
Circle
Square
Error: unknown shape: 'hexagon'
```

Словник зберігає **об'єкти класів**, а не екземпляри. `shape_class()` викликає обраний клас і щоразу створює новий екземпляр. `from None` приховує внутрішній `KeyError` у трасуванні стека, бо `ValueError` і так пояснює проблему.

### Вправа 4

Результат:

```text
True
False
True
False
True
```

- `isinstance(rex, Animal)`: `Dog` є `Animal` завдяки успадкуванню.
- `type(rex) is Animal`: точний тип — `Dog`, а не `Animal`.
- `isinstance(Dog, type)`: кожен клас є екземпляром `type`.
- `isinstance(rex, type)`: `rex` — звичайний об'єкт, а не клас.
- `type(Dog) is type(Animal)`: обидва класи є екземплярами того самого `type`.

---

*Джерело: [pythontutorial.net — Python Class](https://www.pythontutorial.net/python-oop/python-class/). Адаптовано й доповнено для PyJourney.*
