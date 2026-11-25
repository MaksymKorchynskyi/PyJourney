# Принцип розділення інтерфейсів

Принцип розділення інтерфейсів (Interface Segregation Principle, ISP) стверджує, що **клієнти не повинні залежати від методів, якими вони не користуються**. Замість одного великого, «товстого» інтерфейсу варто визначити кілька невеликих, кожен з яких описує одну роль. Це літера «I» у SOLID, і вона позбавляє класи потреби вдавати вміння, яких у них немає.

## Що ви дізнаєтесь

- Що означає «інтерфейс» у Python, де немає ключового слова `interface`
- Що стверджує ISP і чому «невеликий» не означає «з одним методом»
- Як товстий інтерфейс змушує класи реалізовувати методи, яких вони не можуть підтримати
- Як розділити його на рольові інтерфейси за допомогою `abc.ABC`, з кодом «до» і «після»
- Як описувати невеликі інтерфейси через `typing.Protocol` і як це робить стандартна бібліотека
- Компроміси між надто товстими й надто подрібненими інтерфейсами

## Інтерфейси в Python

**Інтерфейс** — це набір методів, які об'єкт обіцяє надати, без пояснення, як саме вони працюють. Натискаючи кнопку живлення на пульті телевізора, ви покладаєтеся на інтерфейс «ця кнопка вмикає телевізор», а не на електроніку всередині.

У багатьох мовах є ключове слово `interface`. У Python його немає. Python покладається на **качину типізацію** (duck typing): «якщо щось ходить як качка і крякає як качка, поводься з ним як із качкою». Функція просто викликає потрібні їй методи, і підходить будь-який об'єкт, що їх має, незалежно від класу.

Коли інтерфейс потрібно зробити явним, Python пропонує два інструменти:

- **Абстрактні базові класи** (`abc.ABC` з `@abstractmethod`): класи успадковують інтерфейс, а Python відмовляється створювати екземпляр класу, який реалізував не всі абстрактні методи.
- **Протоколи** (`typing.Protocol`, Python 3.8+): інтерфейс описується структурно, будь-який клас із відповідними методами задовольняє його без успадкування, а перевіряє це статичний перевіряльник типів.

ISP стосується обох.

## Принцип

Роберт К. Мартін сформулював ISP, коли консультував компанію Xerox у 1990-х. Їхнє програмне забезпечення для принтерів мало один великий клас `Job`, яким користувалися майже всі завдання, тож завдання зшивання знало про всі методи завдання друку, а навіть невелика зміна вимагала довгого перезбирання й повторного розгортання всього. Його порада: *«Створюйте дрібні інтерфейси, специфічні для клієнтів. Клієнтів не слід змушувати реалізовувати інтерфейси, якими вони не користуються»*.

Два моменти легко пропустити:

- **«Невеликий» означає зв'язний, а не «з одним методом».** Інтерфейс `Connection` з методами `connect()` і `disconnect()` цілком нормальний: ці методи нерозривні, а інтерфейс лише з одним із них був би неповним. Те саме стосується `__enter__()` та `__exit__()` у менеджері контексту.
- **Інтерфейси проєктують з погляду клієнта.** Питайте «що потрібно *цьому викликачу*?», а не «що вміє цей об'єкт?». Такі інтерфейси, скроєні під клієнта, часто називають **рольовими інтерфейсами** (role interfaces).

## До: товстий інтерфейс

Визначимо інтерфейс `Vehicle` із двома абстрактними методами:

```python
from abc import ABC, abstractmethod


class Vehicle(ABC):
    @abstractmethod
    def go(self):
        """Рухатися по землі."""

    @abstractmethod
    def fly(self):
        """Рухатися повітрям."""


class Aircraft(Vehicle):
    def go(self):
        print("Taxiing")

    def fly(self):
        print("Flying")


class Car(Vehicle):
    def go(self):
        print("Going")

    def fly(self):
        raise NotImplementedError("A car cannot fly")


car = Car()
car.go()
try:
    car.fly()
except NotImplementedError as error:
    print(f"Error: {error}")
```

Результат:

```text
Going
Error: A car cannot fly
```

`Car` змушений реалізувати `fly()` лише тому, що цього вимагає інтерфейс, і найкраще, що він може зробити, — завершитися помилкою. Звідси три проблеми:

1. **Інтерфейс бреше.** Усе, що має тип `Vehicle`, заявляє, що вміє літати, тож викликачі не можуть довіряти типу.
2. **Помилки переходять у час виконання.** Те, що могла б упіймати система типів, стає винятком у робочому середовищі. (Це ще й порушення принципу підстановки Лісков: `Car` не є повноцінною заміною `Vehicle`.)
3. **Зайве зчеплення.** Код, що лише керує автомобілями, однаково залежить від `Vehicle`, тож зміна «літальної» частини інтерфейсу зачіпає і його.

## Після: рольові інтерфейси

Розділимо товстий інтерфейс на менші, що відповідають реальним ролям. Тут усе, що літає, також уміє рухатися по землі, тож `Flyable` розширює `Movable`:

```python
from abc import ABC, abstractmethod


class Movable(ABC):
    @abstractmethod
    def go(self):
        """Рухатися по землі."""


class Flyable(Movable):
    @abstractmethod
    def fly(self):
        """Рухатися повітрям."""


class Aircraft(Flyable):
    def go(self):
        print("Taxiing")

    def fly(self):
        print("Flying")


class Car(Movable):
    def go(self):
        print("Going")


def drive_all(things: list[Movable]):
    for thing in things:
        thing.go()


def take_off(things: list[Flyable]):
    for thing in things:
        thing.fly()


drive_all([Car(), Aircraft()])
take_off([Aircraft()])
print(hasattr(Car(), "fly"))
```

Результат:

```text
Going
Taxiing
Flying
False
```

`Car` реалізує лише те, що справді вміє. `drive_all()` залежить лише від `Movable`, а `take_off()` — лише від `Flyable`. Передати автомобіль у `take_off()` випадково не вийде: перевіряльник типів повідомить про це ще до запуску програми.

```text
до:                             після:

     Vehicle                        Movable
   + go()                         + go()
   + fly()                           ^       ^
    ^       ^                        |       |
    |       |                       Car   Flyable
 Aircraft  Car (fly генерує виняток!)     + fly()
                                             ^
                                             |
                                          Aircraft
```

### Незалежні ролі та множинне успадкування

Зробити `Flyable` нащадком `Movable` — це проєктне рішення. Воно правильне, лише якщо *кожен* літальний об'єкт уміє також рухатися по землі. Дрон чи птах можуть цього не вміти. Коли ролі незалежні, тримайте інтерфейси незалежними, а клас нехай поєднує стільки з них, скільки потрібно:

```python
from abc import ABC, abstractmethod


class Drivable(ABC):
    @abstractmethod
    def go(self):
        """Рухатися по землі."""


class Flyable(ABC):
    @abstractmethod
    def fly(self):
        """Рухатися повітрям."""


class Car(Drivable):
    def go(self):
        print("Car: going")


class Drone(Flyable):
    def fly(self):
        print("Drone: flying")


class FlyingCar(Drivable, Flyable):
    def go(self):
        print("FlyingCar: going")

    def fly(self):
        print("FlyingCar: flying")


for thing in (Car(), Drone(), FlyingCar()):
    roles = [cls.__name__ for cls in (Drivable, Flyable) if isinstance(thing, cls)]
    print(type(thing).__name__, roles)
```

Результат:

```text
Car ['Drivable']
Drone ['Flyable']
FlyingCar ['Drivable', 'Flyable']
```

## Невеликі інтерфейси з `typing.Protocol`

З протоколами розділені інтерфейси майже нічого не коштують: класу не потрібно їх перелічувати, достатньо мати потрібні методи. Кожна функція оголошує саме ту роль, яка їй потрібна:

```python
from typing import Protocol


class Printer(Protocol):
    def print_document(self, text: str) -> None: ...


class Scanner(Protocol):
    def scan(self) -> str: ...


class SimplePrinter:
    def print_document(self, text):
        print(f"[printer] {text}")


class MultiFunctionDevice:
    def print_document(self, text):
        print(f"[mfd] {text}")

    def scan(self):
        return "scanned page"


def print_report(printer: Printer, lines: list[str]) -> None:
    for line in lines:
        printer.print_document(line)


def archive(scanner: Scanner) -> None:
    print(f"archived: {scanner.scan()}")


print_report(SimplePrinter(), ["Q3 report"])
print_report(MultiFunctionDevice(), ["Q4 report"])
archive(MultiFunctionDevice())
```

Результат:

```text
[printer] Q3 report
[mfd] Q4 report
archived: scanned page
```

`SimplePrinter` не довелося вдавати, що він уміє сканувати. Якби існував один великий протокол `OfficeDevice` з `print_document()`, `scan()` і `fax()`, `print_report()` взагалі не змогла б прийняти простий принтер.

### Перевірка протоколів під час виконання

За замовчуванням протоколи існують лише для перевіряльників типів. Декоратор `@runtime_checkable` дає змогу використовувати протокол в `isinstance()`, але така перевірка шукає лише атрибут із потрібною **назвою**. Вона не перевіряє ні сигнатуру, ні навіть те, чи можна цей атрибут викликати:

```python
from typing import Protocol, runtime_checkable


@runtime_checkable
class Flyable(Protocol):
    def fly(self) -> None: ...


class Duck:
    def fly(self):
        print("Duck flaps its wings")


class Car:
    def go(self):
        print("Going")


class Liar:
    fly = "not a method at all"


for obj in (Duck(), Car(), Liar()):
    print(type(obj).__name__, isinstance(obj, Flyable))
```

Результат:

```text
Duck True
Car False
Liar True
```

### Стандартна бібліотека вже так робить

`collections.abc` — добрий приклад розділених інтерфейсів. Замість одного великого інтерфейсу «контейнер» там є крихітні: `Sized` (`__len__`), `Iterable` (`__iter__`), `Container` (`__contains__`). `Collection` — це просто всі три разом. Клас, який визначає лише `__len__`, є `Sized` і не більше:

```python
from collections.abc import Collection, Iterable, Sized


class Playlist:
    def __init__(self, *songs):
        self.songs = list(songs)

    def __len__(self):
        return len(self.songs)


playlist = Playlist("Intro", "Outro")
print(isinstance(playlist, Sized))
print(isinstance(playlist, Iterable))
print(isinstance(playlist, Collection))
print(isinstance([1, 2], Collection))
print(len(playlist))
```

Результат:

```text
True
False
False
True
2
```

Вбудовані функції дотримуються тієї ж ідеї: `len()` потребує лише `Sized`, а циклу `for` достатньо `Iterable`. Жодна з них не змушує ваш клас реалізовувати те, що йому не потрібно.

## Компроміси

- **Надто товстий** інтерфейс веде до фальшивих реалізацій (`pass`, `raise NotImplementedError`), брехливих типів і зайвого зчеплення.
- **Надто подрібнений** — теж проблема. Двадцять інтерфейсів з одним методом, які завжди використовуються разом, лише ускладнюють навігацію кодом. Тримайте разом методи, що завжди йдуть у парі.
- **Качина типізація пом'якшує проблему.** Без анотацій типів функція в Python ніколи не «залежить» від методів, яких не викликає. ISP найважливіший, коли ви пишете ABC, які мають реалізовувати інші, і коли користуєтеся перевіряльником типів.
- **Ієрархія чи комбінування.** Виведення `Flyable` з `Movable` зручне, але стверджує, що кожен літальний об'єкт уміє їздити. Незалежні інтерфейси, поєднані через множинне успадкування (або кілька протоколів), гнучкіші, але багатослівніші.

## Типові помилки

- **Реалізовувати непотрібні методи як заглушки чи винятки** лише для того, щоб задовольнити базовий клас. Якщо в конкретному класі ви бачите `raise NotImplementedError("X cannot do Y")`, інтерфейс, імовірно, надто товстий.
- **Розуміти ISP як «один метод на інтерфейс».** Зв'язні методи, як-от `connect()`/`disconnect()` чи `__enter__()`/`__exit__()`, належать до одного інтерфейсу.
- **Проєктувати інтерфейси з боку реалізації.** «Усе, що вміє мій клас `Database`» — поганий інтерфейс; «те, що генераторові звітів потрібно прочитати» — добрий.
- **Надто довіряти `@runtime_checkable`.** `isinstance()` із протоколом перевіряє лише назви, а не сигнатури чи поведінку.
- **Нав'язувати ієрархію незалежним ролям.** Робіть один інтерфейс розширенням іншого, лише якщо кожна реалізація дочірнього справді підтримує методи батьківського.

## Підсумок

- Інтерфейс — це набір методів, які обіцяє об'єкт. У Python його виражають через качину типізацію, ABC або протоколи.
- ISP: жоден клієнт не повинен залежати від методів, якими не користується, чи реалізовувати їх.
- «Невеликий» означає зв'язний: групуйте методи, що належать разом, і розділяйте ті, що не належать.
- Проєктуйте інтерфейси з погляду клієнта (рольові інтерфейси).
- Методи, які в конкретному класі лише генерують `NotImplementedError`, — головний тривожний сигнал.
- Клас може реалізовувати кілька невеликих інтерфейсів через множинне успадкування або відповідаючи кільком протоколам.
- `collections.abc` (`Sized`, `Iterable`, `Container`, `Collection`) демонструє ISP у стандартній бібліотеці.

## Практика

### Вправа 1: Роботи не їдять

Переробіть цей товстий інтерфейс так, щоб `Robot` не мусив реалізовувати `eat()`. Напишіть `run_shift(workers)`, яка викликає `work()` для всіх, і `lunch_break(eaters)`, яка викликає `eat()` лише для тих, хто вміє їсти. Використайте `abc.ABC`.

```python
from abc import ABC, abstractmethod


class Worker(ABC):
    @abstractmethod
    def work(self): ...

    @abstractmethod
    def eat(self): ...


class Human(Worker):
    def work(self):
        print("Human works")

    def eat(self):
        print("Human eats")


class Robot(Worker):
    def work(self):
        print("Robot works")

    def eat(self):
        raise NotImplementedError("Robots do not eat")
```

### Вправа 2: Функція, якій потрібен лише `read()`

Напишіть протокол `Readable` з єдиним методом `read() -> str` і функцію `word_count(source: Readable) -> int`. Покажіть, що вона працює з `io.StringIO` зі стандартної бібліотеки і з вашим власним класом `Note`, хоча жоден із них не успадковує `Readable`.

### Вправа 3: Читачі й записувачі

Розділіть цей інтерфейс репозиторію на ABC `Reader` (`get`, `all`) і `Writer` (`add`). Реалізуйте `InMemoryRepository`, що підтримує обидва, і `ReadOnlySnapshot`, що підтримує лише читання (дані він отримує в `__init__`). Напишіть `report(reader)`, яка друкує всі елементи у відсортованому порядку, і покажіть, що вона приймає обидва класи. Наостанок покажіть через `isinstance()`, що знімок (snapshot) не є `Writer`.

```python
from abc import ABC, abstractmethod


class Repository(ABC):
    @abstractmethod
    def get(self, key): ...

    @abstractmethod
    def all(self): ...

    @abstractmethod
    def add(self, key, value): ...
```

## Розв'язки

### Вправа 1

```python
from abc import ABC, abstractmethod


class Workable(ABC):
    @abstractmethod
    def work(self): ...


class Eatable(ABC):
    @abstractmethod
    def eat(self): ...


class Human(Workable, Eatable):
    def work(self):
        print("Human works")

    def eat(self):
        print("Human eats")


class Robot(Workable):
    def work(self):
        print("Robot works")


def run_shift(workers: list[Workable]):
    for worker in workers:
        worker.work()


def lunch_break(eaters: list[Eatable]):
    for eater in eaters:
        eater.eat()


staff = [Human(), Robot()]
run_shift(staff)
lunch_break([member for member in staff if isinstance(member, Eatable)])
```

Результат:

```text
Human works
Robot works
Human eats
```

Інтерфейси незалежні (`Eatable` не розширює `Workable`), бо не все, що їсть, мусить працювати.

### Вправа 2

```python
import io
from typing import Protocol


class Readable(Protocol):
    def read(self) -> str: ...


def word_count(source: Readable) -> int:
    return len(source.read().split())


class Note:
    def __init__(self, text):
        self.text = text

    def read(self):
        return self.text


print(word_count(io.StringIO("Small interfaces are easy to satisfy")))
print(word_count(Note("Hello PyJourney")))
```

Результат:

```text
6
2
```

Оскільки `word_count()` вимагає лише `read()`, вона працює з файлами, `StringIO`, мережевими потоками даних і вашими власними класами. Якби вона вимагала повний «файловий» інтерфейс із `seek()`, `write()` і `close()`, `Note` довелося б підробляти всі ці методи.

### Вправа 3

```python
from abc import ABC, abstractmethod


class Reader(ABC):
    @abstractmethod
    def get(self, key): ...

    @abstractmethod
    def all(self): ...


class Writer(ABC):
    @abstractmethod
    def add(self, key, value): ...


class InMemoryRepository(Reader, Writer):
    def __init__(self):
        self._items = {}

    def get(self, key):
        return self._items.get(key)

    def all(self):
        return list(self._items.values())

    def add(self, key, value):
        self._items[key] = value


class ReadOnlySnapshot(Reader):
    def __init__(self, items):
        self._items = dict(items)

    def get(self, key):
        return self._items.get(key)

    def all(self):
        return list(self._items.values())


def report(reader: Reader):
    for item in sorted(reader.all()):
        print(f"- {item}")


repo = InMemoryRepository()
repo.add(1, "pear")
repo.add(2, "apple")
report(repo)

snapshot = ReadOnlySnapshot({1: "melon", 2: "kiwi"})
report(snapshot)
print(isinstance(snapshot, Reader), isinstance(snapshot, Writer))
```

Результат:

```text
- apple
- pear
- kiwi
- melon
True False
```

`report()` залежить лише від `Reader`, тож працює з обома класами, а `ReadOnlySnapshot` ніколи не доводиться вдавати, що він уміє `add()`.

---

*Джерело: [pythontutorial.net — Python Interface Segregation Principle](https://www.pythontutorial.net/python-oop/python-interface-segregation-principle/). Адаптовано й доповнено для PyJourney.*
