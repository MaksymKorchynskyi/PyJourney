# __del__

`__del__` — це спеціальний метод, який Python викликає, коли об'єкт ось-ось буде знищено. Він здається природним місцем для коду очищення, наприклад закриття файлів чи з'єднань, але *коли* він спрацює, вирішуєте не ви, а помилки всередині нього тихо поглинаються. Розуміння того, як насправді працює `__del__`, здебільшого вчить, коли його **не** варто використовувати і що використовувати натомість.

## Що ви дізнаєтесь

- Що таке `__del__` і чому це *фіналізатор*, а не деструктор
- Коли CPython викликає `__del__` і чому інструкція `del` не викликає його напряму
- Як циклічні посилання відкладають `__del__` до запуску збирача сміття
- Що відбувається з винятками, згенерованими всередині `__del__`
- Інші підводні камені: завершення інтерпретатора, «воскресіння» об'єкта, успадкування
- Надійні альтернативи: менеджери контексту, `try/finally` і `weakref.finalize`

## Що таке `__del__`

Python керує пам'яттю автоматично. Коли об'єкт стає недосяжним, його знищують, а пам'ять використовують повторно. Якщо клас об'єкта визначає `__del__(self)`, Python викликає цей метод **безпосередньо перед** знищенням об'єкта:

```python
class Person:
    def __init__(self, name, age):
        self.name = name
        self.age = age

    def __del__(self):
        print(f"__del__ was called for {self.name}")


person = Person("John Doe", 23)
person = None
print("after person = None")
```

Результат:

```text
__del__ was called for John Doe
after person = None
```

`__del__` часто називають **фіналізатором** (finalizer). Це не деструктор у сенсі C++: він нічого не знищує й не звільняє пам'ять. Об'єкт знищує інтерпретатор, а `__del__` — лише гачок, який спрацьовує перед цим.

## Коли CPython викликає `__del__`

CPython (стандартний інтерпретатор) рахує посилання на кожен об'єкт. Щойно лічильник падає до нуля, об'єкт знищується **негайно**, і саме тоді виконується `__del__`. Посилання зникає, коли ви перев'язуєте ім'я, видаляєте його через `del`, прибираєте об'єкт із контейнера або коли функція завершується і зникають її локальні змінні.

```python
class Person:
    def __init__(self, name, age):
        self.name = name
        self.age = age

    def __del__(self):
        print(f"__del__ was called for {self.name}")


person = Person("Jane Doe", 31)
del person
print("after del person")

person = Person("Max Payne", 40)
alias = person
del person
print("after del person (alias still exists)")
alias = None
print("end")
```

Результат:

```text
__del__ was called for Jane Doe
after del person
after del person (alias still exists)
__del__ was called for Max Payne
end
```

Другий об'єкт пережив `del person`, бо на нього досі посилалося `alias`. `__del__` виконався лише тоді, коли зникло **останнє** посилання.

> **Зверніть увагу:** негайна фіналізація — деталь реалізації CPython. Інші реалізації, як-от PyPy, мають інший збирач сміття і можуть викликати `__del__` значно пізніше або взагалі не встигнути до завершення програми. Переносний код не повинен залежати від того, коли саме це станеться.

### `del` — це не `__del__`

Назви плутають, тож варто сказати прямо:

- **Інструкція** `del name` видаляє ім'я (або елемент контейнера, або атрибут). Вона зменшує лічильник посилань на одиницю — і більше нічого.
- **Метод** `__del__` викликає інтерпретатор, коли об'єкт справді знищується.

Якщо викликати `__del__()` самостійно, теж нічого не знищиться. Це звичайний виклик методу:

```python
class Person:
    def __init__(self, name):
        self.name = name

    def __del__(self):
        print(f"__del__ was called for {self.name}")


person = Person("John")
person.__del__()
print("still alive:", person.name)
del person
print("end")
```

Результат:

```text
__del__ was called for John
still alive: John
__del__ was called for John
end
```

Метод спрацював двічі: раз від ручного виклику й раз, коли об'єкт справді знищили. Ніколи не викликайте `__del__` напряму.

## Циклічні посилання відкладають `__del__`

Підрахунок посилань не може звільнити об'єкти, які посилаються один на одного. Якщо `a` посилається на `b`, а `b` — на `a`, їхні лічильники ніколи не впадуть до нуля, навіть коли на них не вказує жодна змінна. Такі цикли пізніше знаходить **циклічний збирач сміття** (модуль `gc`), який запускається періодично:

```python
import gc


class Node:
    def __init__(self, name):
        self.name = name
        self.other = None

    def __del__(self):
        print(f"__del__: {self.name}")


a = Node("a")
b = Node("b")
a.other = b
b.other = a  # циклічне посилання

del a, b
print("names deleted, nothing printed yet")
gc.collect()
print("after gc.collect()")
```

Результат (порядок двох рядків `__del__` не гарантовано):

```text
names deleted, nothing printed yet
__del__: a
__del__: b
after gc.collect()
```

Тут `gc.collect()` примусово запускає збирання, щоб ефект було видно. У реальній програмі ви не знаєте, коли спрацює збирач, тож `__del__` для об'єктів у циклах виконується в непередбачуваний момент.

> **Зверніть увагу:** до Python 3.4 об'єкти з `__del__`, що входили в цикл, ніколи не збиралися: вони потрапляли в список `gc.garbage` і спричиняли витік пам'яті. Починаючи з Python 3.4 (PEP 442), такі цикли збираються звичайним чином, а `__del__` викликається для кожного об'єкта щонайбільше один раз.

## Винятки в `__del__` ігноруються

`__del__` може спрацювати майже в будь-якій точці програми, тож немає розумного місця, куди передати виняток. Тому Python **не генерує** винятки з `__del__` далі. Він виводить попередження в `stderr` і продовжує роботу:

```python
class Broken:
    def __del__(self):
        print("cleaning up...")
        raise RuntimeError("cleanup failed")


obj = Broken()
del obj
print("the program keeps running")
```

Результат у терміналі (Python 3.14; адреса й шлях відрізнятимуться, а в старіших версіях попередження починається з `Exception ignored in:`):

```text
cleaning up...
Exception ignored while calling deallocator <function Broken.__del__ at 0x10301fc10>:
Traceback (most recent call last):
  File "/home/user/broken.py", line 4, in __del__
    raise RuntimeError("cleanup failed")
RuntimeError: cleanup failed
the program keeps running
```

Код, що викликав `del`, не може перехопити цей виняток через `try/except`, і програма ніяк не дізнається, що очищення не вдалося. Якщо очищення було важливим (скинути дані на диск, звільнити блокування), збій минає непомітно.

## Інші підводні камені

- **Завершення інтерпретатора.** Документація не гарантує, що `__del__` буде викликано для об'єктів, які ще існують на момент виходу з інтерпретатора. CPython 3.14 зазвичай таки викликає його для об'єктів рівня модуля, але під час завершення інші модулі та глобальні змінні вже можуть бути знищені, тож код у `__del__`, що їх використовує, може впасти.
- **«Воскресіння» (resurrection).** `__del__` може зберегти `self` деінде (наприклад, у глобальному списку) і тим самим створити нове посилання. Тоді об'єкт виживає. Python викликає `__del__` для кожного об'єкта щонайбільше один раз, тож коли «воскреслий» об'єкт нарешті помре, метод більше не спрацює.
- **Успадкування.** Якщо базовий клас визначає `__del__`, підклас, який його перевизначає, має явно викликати `super().__del__()`, інакше очищення базового класу ніколи не відбудеться. У самого `object` методу `__del__` немає, тож викликайте його лише тоді, коли базовий клас справді його визначає.
- **Об'єкти, на які посилається знищуваний об'єкт.** Коли `__del__` завершився і об'єкт знищено, кожен об'єкт, на який він посилався, втрачає одне посилання. Знищено буде лише ті з них, на які більше ніщо не посилається.

## Кращі альтернативи

### Менеджери контексту і `try/finally`

Коли ресурс треба звільнити у відомий момент, звільняйте його явно. **Менеджер контексту** (об'єкт з `__enter__` і `__exit__`) в інструкції `with` гарантує, що очищення відбудеться наприкінці блоку, навіть якщо виник виняток:

```python
class LogFile:
    def __init__(self, path):
        self.path = path
        self.closed = False
        print(f"open {self.path}")

    def write(self, text):
        if self.closed:
            raise ValueError("write to a closed log")
        print(f"write {text!r}")

    def close(self):
        if not self.closed:
            self.closed = True
            print(f"close {self.path}")

    def __enter__(self):
        return self

    def __exit__(self, exc_type, exc_value, traceback):
        self.close()
        return False


with LogFile("app.log") as log:
    log.write("started")
    log.write("finished")
print("after the with block, closed =", log.closed)

try:
    with LogFile("error.log") as log:
        log.write("about to fail")
        raise RuntimeError("boom")
except RuntimeError as error:
    print("caught:", error)
```

Результат:

```text
open app.log
write 'started'
write 'finished'
close app.log
after the with block, closed = True
open error.log
write 'about to fail'
close error.log
caught: boom
```

`__exit__` повертає `False`, тому виняток не поглинається: спершу журнал закривається, а потім виняток доходить до коду, що викликав блок. Без менеджера контексту таку саму гарантію дає `try: ... finally: log.close()`. Вбудовані ресурси — файли, блокування, сокети — уже є менеджерами контексту.

### `weakref.finalize` як страховка

Іноді потрібен і явний `close()`, **і** запасний варіант на випадок, якщо користувач забуде його викликати. `weakref.finalize(obj, func, *args)` реєструє виклик `func(*args)`, який відбудеться, коли `obj` буде знищено. На відміну від `__del__`, фіналізатор спрацьовує щонайбільше один раз, його можна викликати заздалегідь уручну, і за замовчуванням він спрацьовує також під час завершення інтерпретатора:

```python
import weakref


class TempDir:
    def __init__(self, name):
        self.name = name
        print(f"create {name}")
        self._finalizer = weakref.finalize(self, TempDir._remove, name)

    @staticmethod
    def _remove(name):
        print(f"remove {name}")

    def cleanup(self):
        self._finalizer()


first = TempDir("tmp1")
first.cleanup()
first.cleanup()  # другий виклик нічого не робить

second = TempDir("tmp2")
del second

third = TempDir("tmp3")
print("end of script")
```

Результат:

```text
create tmp1
remove tmp1
create tmp2
remove tmp2
create tmp3
end of script
remove tmp3
```

> **Порада:** функція зворотного виклику та її аргументи не повинні посилатися на сам об'єкт (наприклад, не передавайте зв'язаний метод на кшталт `self.cleanup`). Інакше фіналізатор утримуватиме об'єкт живим, і той ніколи не буде знищений. Саме тому `_remove` — статичний метод, який отримує лише `name`.

## Типові помилки

- **Звільняти важливі ресурси в `__del__`.** Момент його виклику непередбачуваний (цикли, інші реалізації Python, завершення інтерпретатора), а його помилки непомітні. Використовуйте `with`, `try/finally` або явний `close()`.
- **Очікувати, що `del obj` викличе `__del__`.** `del` прибирає одне посилання. `__del__` спрацьовує лише тоді, коли зникає останнє.
- **Викликати `obj.__del__()` вручну.** Очищення виконається, але об'єкт не знищиться, тож пізніше очищення спрацює вдруге.
- **Генерувати винятки в `__del__` або покладатися на них.** Їх виводять у `stderr` і ігнорують.
- **Використовувати в `__del__` глобальні змінні чи інші модулі.** Під час завершення інтерпретатора їх уже може не бути.
- **Забувати `super().__del__()`**, коли базовий клас має власний фіналізатор.

## Підсумок

- `__del__` — фіналізатор: Python викликає його безпосередньо перед знищенням об'єкта. Сам він об'єкт не знищує.
- У CPython об'єкт знищується, щойно його лічильник посилань сягає нуля, тож `__del__` зазвичай спрацьовує одразу після зникнення останнього посилання.
- Інструкція `del` лише прибирає ім'я чи посилання; це не виклик `__del__`.
- Об'єкти в циклічних посиланнях знищуються лише тоді, коли спрацює циклічний збирач сміття.
- Винятки всередині `__del__` виводяться в `stderr` і ігноруються; програма не може їх перехопити.
- Немає гарантії, що `__del__` спрацює під час завершення інтерпретатора, і для кожного об'єкта він викликається щонайбільше один раз.
- Для очищення віддавайте перевагу менеджерам контексту, `try/finally` і `weakref.finalize`. На практиці `__del__` знадобиться вам рідко.

## Практика

### Вправа 1: Передбачте порядок

Передбачте повний результат, перш ніж запускати код:

```python
class Token:
    def __init__(self, name):
        self.name = name

    def __del__(self):
        print(f"del {self.name}")


a = Token("A")
b = Token("B")
box = [a, b]
print(1)
del a
print(2)
box.pop()
print(3)
b = None
print(4)
box.clear()
print(5)
```

### Вправа 2: Від `__del__` до менеджера контексту

Цей клас закриває з'єднання в `__del__`, тож не можна бути певним, коли саме воно закриється. Перепишіть клас із методом `close()` і підтримкою менеджера контексту, щоб з'єднання закривалося наприкінці блоку `with`, навіть якщо всередині виник виняток.

```python
class Connection:
    def __init__(self, host):
        self.host = host
        self.is_open = True
        print(f"connect to {host}")

    def query(self, sql):
        return f"result of {sql!r}"

    def __del__(self):
        print(f"disconnect from {self.host}")
```

### Вправа 3: Дерево без циклів

У дереві кожен дочірній вузол часто зберігає посилання на батьківський, а батьківський — на свої дочірні. Це утворює цикли, тож `__del__` спрацьовує лише тоді, коли до нього дійде збирач сміття. Напишіть клас `TreeNode(name, parent=None)`, у якому посилання на батьківський вузол є **слабким** (`weakref.ref`), відкрийте його через властивість `parent` і покажіть, що видалення останнього імені кореня негайно фіналізує і корінь, і його дочірній вузол.

### Вправа 4: Сесія зі страховкою

Напишіть клас `Session(session_id)`, який виводить `session <id> closed` рівно один раз: або під час виклику `close()` (скільки б разів його не викликали), або коли об'єкт знищено без закриття, або під час завершення інтерпретатора. Додайте властивість лише для читання `closed`. Використайте `weakref.finalize`, а не `__del__`.

## Розв'язки

### Вправа 1

Результат:

```text
1
2
3
del B
4
del A
5
```

- `del a`: список досі тримає `A`, тож нічого не знищується.
- `box.pop()` прибирає `B` зі списку, але ім'я `b` досі на нього посилається.
- `b = None` прибирає останнє посилання на `B`, тому `del B` з'являється перед `4`.
- `box.clear()` прибирає останнє посилання на `A`, тому `del A` з'являється перед `5`.

### Вправа 2

```python
class Connection:
    def __init__(self, host):
        self.host = host
        self.is_open = True
        print(f"connect to {host}")

    def query(self, sql):
        if not self.is_open:
            raise RuntimeError("connection is closed")
        return f"result of {sql!r}"

    def close(self):
        if self.is_open:
            self.is_open = False
            print(f"disconnect from {self.host}")

    def __enter__(self):
        return self

    def __exit__(self, exc_type, exc_value, traceback):
        self.close()
        return False


with Connection("db.local") as conn:
    print(conn.query("SELECT 1"))

try:
    with Connection("db.local") as conn:
        conn.query("SELECT 2")
        raise ValueError("bad data")
except ValueError as error:
    print("error:", error)
print("is_open:", conn.is_open)
```

Результат:

```text
connect to db.local
result of 'SELECT 1'
disconnect from db.local
connect to db.local
disconnect from db.local
error: bad data
is_open: False
```

`close()` ідемпотентний (повторний виклик нічого не ламає), а `__exit__` гарантує, що його буде викликано наприкінці блоку — і за звичайного завершення, і через виняток.

### Вправа 3

```python
import weakref


class TreeNode:
    def __init__(self, name, parent=None):
        self.name = name
        self.children = []
        self._parent = weakref.ref(parent) if parent is not None else None
        if parent is not None:
            parent.children.append(self)

    @property
    def parent(self):
        return self._parent() if self._parent is not None else None

    def __del__(self):
        print(f"__del__: {self.name}")


root = TreeNode("root")
leaf = TreeNode("leaf", parent=root)
print(leaf.parent.name)
del leaf
print("leaf name deleted")
del root
print("root name deleted")
```

Результат:

```text
root
leaf name deleted
__del__: root
__del__: leaf
root name deleted
```

Після `del leaf` список `children` кореня досі тримає листок, тож той виживає. Листок посилається на корінь лише слабко, тому `del root` прибирає останнє сильне посилання на корінь. Корінь фіналізується негайно, його список `children` зникає, а за ним і листок — усе це ще до виведення `"root name deleted"`. Виклик слабкого посилання (`self._parent()`) повертає батьківський вузол або `None`, якщо його вже не існує.

### Вправа 4

```python
import weakref


def report_closed(session_id):
    print(f"session {session_id} closed")


class Session:
    def __init__(self, session_id):
        self.session_id = session_id
        self._finalizer = weakref.finalize(self, report_closed, session_id)

    def close(self):
        self._finalizer()

    @property
    def closed(self):
        return not self._finalizer.alive


s1 = Session(1)
s1.close()
s1.close()
print("s1 closed:", s1.closed)

s2 = Session(2)
print("s2 closed:", s2.closed)
del s2
print("after del s2")

s3 = Session(3)
print("end of script")
```

Результат:

```text
session 1 closed
s1 closed: True
s2 closed: False
session 2 closed
after del s2
end of script
session 3 closed
```

Фіналізатор спрацьовує щонайбільше один раз, після чого його атрибут `alive` стає `False`. `s2` фіналізується в момент знищення, а `s3`, який наприкінці ще живий, — під час завершення інтерпретатора.

---

*Джерело: [pythontutorial.net — Python __del__](https://web.archive.org/web/2026/https://www.pythontutorial.net/python-oop/python-__del__/). Адаптовано й доповнено для PyJourney.*
