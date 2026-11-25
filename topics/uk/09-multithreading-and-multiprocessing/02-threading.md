# Потоки: модуль threading

Модуль `threading` дає змогу одному процесу Python виконувати кілька **потоків**: поки одна задача чекає (на сервер, диск чи таймер), інша може просуватися. Правильно застосований, він перетворює програму, що чекає на все по черзі, на програму, яка чекає на все одночасно.

## Що ви дізнаєтесь

- Чому однопотокова програма марнує час на очікування введення-виведення
- Як створити й запустити потік і дочекатися його завершення: `threading.Thread`, `start()` і `join()`
- Як передати потоку аргументи, дати йому ім'я та отримати від нього результат
- Що стається з винятками всередині потоків і що таке фонові потоки (daemon)
- Як коректно зупинити потік за допомогою `threading.Event`
- Коли потоки пришвидшують програму, а коли ні

## Однопотокова програма

Почнімо з функції, яка вдає, що пів секунди чекає на відповідь сервера:

```python
from time import perf_counter, sleep


def task():
    print("Starting a task...")
    sleep(0.5)  # імітуємо очікування на сервер
    print("done")


start_time = perf_counter()

task()
task()

end_time = perf_counter()
print(f"It took {end_time - start_time:0.2f} second(s) to complete.")
```

Результат (час може трохи відрізнятися):

```text
Starting a task...
done
Starting a task...
done
It took 1.01 second(s) to complete.
```

`perf_counter()` повертає значення годинника високої точності, тож різниця між двома викликами вимірює час, що минув. Два виклики по пів секунди займають приблизно секунду. Десять викликів забрали б п'ять секунд.

```text
головний потік: [задача 1: чекає 0.5 с][задача 2: чекає 0.5 с]   -> ~1.0 с
```

Поки працює `sleep()`, процесор для цієї програми нічого не робить. Програма має один процес з єдиним потоком — **головним** (main thread), тобто вона **однопотокова**, і головний потік не може почати другу задачу, доки не завершиться перша.

## Створення потоків: `threading.Thread`

Щоб виконати дві задачі конкурентно, створіть для кожної об'єкт `Thread`:

```python
from threading import Thread
from time import perf_counter, sleep


def task():
    print("Starting a task...")
    sleep(0.5)
    print("done")


start_time = perf_counter()

# створюємо два нові потоки
t1 = Thread(target=task)
t2 = Thread(target=task)

# запускаємо потоки
t1.start()
t2.start()

# чекаємо, поки потоки завершаться
t1.join()
t2.join()

end_time = perf_counter()
print(f"It took {end_time - start_time:0.2f} second(s) to complete.")
```

Результат (час може трохи відрізнятися):

```text
Starting a task...
Starting a task...
done
done
It took 0.50 second(s) to complete.
```

Кроки завжди однакові:

1. **Створити** потік: `Thread(target=task)`. `target` — це функція, яку треба виконати. Передавайте саму функцію, **без дужок**.
2. **Запустити** його: `t1.start()`. Python створює потік ОС і викликає в ньому `task()`. `start()` повертає керування одразу, тож головний потік переходить до наступного рядка.
3. **Дочекатися** його: `t1.join()` блокує потік, що викликає цей метод, доки `t1` не завершиться. Без `join()` головний потік вивів би час іще до завершення задач.

Під час роботи ця програма має три потоки: головний і два дочірні. Обидва очікування перекриваються, тому загальний час приблизно дорівнює одному очікуванню:

```text
головний потік: start t1, start t2, join ............ join -> print
потік t1:                [чекає 0.5 с]
потік t2:                  [чекає 0.5 с]                       -> ~0.5 с
```

Найкорисніші параметри `Thread`:

| Параметр | Значення |
|---|---|
| `target` | Функція, яку треба виконати в новому потоці |
| `args` | **Кортеж** позиційних аргументів для `target` |
| `kwargs` | Словник іменованих аргументів для `target` |
| `name` | Зрозуміле ім'я (типово `Thread-N (назва_функції)`) |
| `daemon` | Якщо `True`, потік не втримує програму від завершення (див. нижче) |

## Передавання аргументів потокам

`args` має бути кортежем. Для одного аргументу не забудьте кому в кінці: `args=(n,)`.

```python
from threading import Thread
from time import perf_counter, sleep


def task(task_id):
    print(f"Starting the task {task_id}...")
    sleep(0.5)
    print(f"The task {task_id} completed")


start_time = perf_counter()

# створюємо й запускаємо 10 потоків
threads = []
for n in range(1, 11):
    t = Thread(target=task, args=(n,))
    threads.append(t)
    t.start()

# чекаємо, поки потоки завершаться
for t in threads:
    t.join()

end_time = perf_counter()
print(f"It took {end_time - start_time:0.2f} second(s) to complete.")
```

Результат (порядок завершення щоразу інший):

```text
Starting the task 1...
Starting the task 2...
Starting the task 3...
Starting the task 4...
Starting the task 5...
Starting the task 6...
Starting the task 7...
Starting the task 8...
Starting the task 9...
Starting the task 10...
The task 6 completed
The task 4 completed
The task 8 completed
The task 7 completed
The task 9 completed
The task 10 completed
The task 5 completed
The task 2 completed
The task 1 completed
The task 3 completed
It took 0.51 second(s) to complete.
```

Десять задач по пів секунди завершуються приблизно за пів секунди. Зверніть увагу на дві речі:

- Список `threads` зберігає посилання на кожен потік, щоб потім викликати `join()` для всіх.
- Задачі завершуються в **непередбачуваному порядку**. Який потік і коли виконується, вирішує планувальник ОС. Ніколи не пишіть код, який розраховує, що потоки завершаться в порядку запуску.

> **Порада:** не викликайте `join()` у тому самому циклі, де запускаєте потоки. `t.start(); t.join()` чекає на кожен потік, перш ніж запустити наступний, і програма знову стає послідовною. Спершу запустіть усі потоки, потім дочекайтеся всіх.

Параметр тут називається `task_id`, а не `id`, як у деяких посібниках, бо `id` затулив би вбудовану функцію `id()`.

### Іменовані аргументи, імена й стан потоку

```python
import threading
import time


def greet(name, delay, punctuation="!"):
    time.sleep(delay)
    current = threading.current_thread()
    print(f"[{current.name}] Hello, {name}{punctuation}")


t1 = threading.Thread(target=greet, args=("Olena", 0.1))
t2 = threading.Thread(
    target=greet,
    args=("Max",),
    kwargs={"delay": 0.2, "punctuation": "?"},
    name="greeter-max",
)

print(t1.name, t2.name)
print("alive before start:", t1.is_alive())

t1.start()
t2.start()
print("alive after start:", t1.is_alive())

t1.join()
t2.join()
print("alive after join:", t1.is_alive())
print("main thread:", threading.current_thread().name)
```

Результат:

```text
Thread-1 (greet) greeter-max
alive before start: False
alive after start: True
[Thread-1 (greet)] Hello, Olena!
[greeter-max] Hello, Max?
alive after join: False
main thread: MainThread
```

- `threading.current_thread()` повертає об'єкт `Thread` того коду, який виконується просто зараз.
- Починаючи з Python 3.10 типове ім'я містить назву цільової функції: `Thread-1 (greet)`. Власні імена значно спрощують читання логів і трасувань стеку.
- `is_alive()` дорівнює `True` лише між `start()` і моментом, коли цільова функція повертає керування.

## Як отримати результат від потоку

Потік **відкидає значення, яке повертає** його цільова функція. Поширений прийом — дати кожному потоку власну комірку спільного списку (або ключ у словнику), куди він запише результат:

```python
import threading
import time


def fetch_size(url, results, index):
    time.sleep(0.2)            # імітуємо мережевий запит
    results[index] = len(url)  # кожен потік пише лише у свою комірку


urls = ["https://python.org", "https://pypi.org", "https://docs.python.org"]
results = [None] * len(urls)

threads = [
    threading.Thread(target=fetch_size, args=(url, results, i))
    for i, url in enumerate(urls)
]
for t in threads:
    t.start()
for t in threads:
    t.join()

print(results)
```

Результат:

```text
[18, 16, 23]
```

Це безпечно, бо жодні два потоки не пишуть в одну комірку, а головний потік читає список лише після `join()`. Коли кілька потоків змінюють **одне й те саме** значення, потрібне блокування (lock), про нього йдеться в темі про `Lock`.

> **Зверніть увагу:** для сценарію «виконати функцію й отримати результат» зазвичай простіше використати `concurrent.futures.ThreadPoolExecutor` з наступної теми: він повертає результати й повторно піднімає винятки за вас.

### Підклас `Thread`

Можна також успадкуватися від `Thread` і перевизначити `run()`. `start()` викликає `run()` у новому потоці, а сам об'єкт може зберегти результат в атрибуті:

```python
import threading
import time


class Downloader(threading.Thread):
    def __init__(self, url):
        super().__init__(name=f"dl-{url}")
        self.url = url
        self.size = None

    def run(self):
        # run() виконується в новому потоці після start()
        time.sleep(0.1)
        self.size = len(self.url) * 100


workers = [Downloader(url) for url in ("a.com", "bb.com")]
for w in workers:
    w.start()
for w in workers:
    w.join()

for w in workers:
    print(w.name, w.size)
```

Результат:

```text
dl-a.com 500
dl-bb.com 600
```

Завжди викликайте `super().__init__()` у конструкторі підкласу, інакше `start()` згенерує `RuntimeError: thread.__init__() not called`.

## Винятки в потоках

Виняток, що вийшов за межі цільової функції, **завершує лише цей потік**. До потоку, який викликає `join()`, він не доходить. Типово Python виводить трасування стеку в stderr і працює далі:

```python
import threading


def parse(text):
    print("parsing", text)
    return int(text)


t = threading.Thread(target=parse, args=("abc",))
t.start()
t.join()
print("main thread keeps running")
```

Результат (трасування скорочено):

```text
parsing abc
Exception in thread Thread-1 (parse):
Traceback (most recent call last):
  ...
  File "app.py", line 6, in parse
    return int(text)
ValueError: invalid literal for int() with base 10: 'abc'
main thread keeps running
```

Такі помилки легко проґавити. Можна встановити власний обробник через `threading.excepthook` (Python 3.8+), наприклад щоб записувати помилки в одному форматі:

```python
import threading


def parse(text):
    return int(text)


def report_error(args):
    # args містить exc_type, exc_value, exc_traceback і thread
    print(f"{args.thread.name} failed: {args.exc_type.__name__}: {args.exc_value}")


threading.excepthook = report_error

t = threading.Thread(target=parse, args=("abc",), name="parser")
t.start()
t.join()
print("main thread keeps running")
```

Результат:

```text
parser failed: ValueError: invalid literal for int() with base 10: 'abc'
main thread keeps running
```

Якщо код, що викликає `join()`, має *реагувати* на помилку, перехопіть її всередині потоку й збережіть (див. вправу 4) або скористайтеся пулом потоків, у якому `Future.result()` повторно піднімає виняток у викликача.

## Фонові потоки (daemon)

Зазвичай Python чекає завершення всіх нефонових потоків, перш ніж закінчити програму. **Фоновий потік** (`daemon=True`) не втримує програму. Коли головний потік завершується, фонові потоки зупиняються різко, на півслові:

```python
import threading
import time


def heartbeat():
    while True:
        print("still alive")
        time.sleep(0.1)


t = threading.Thread(target=heartbeat, daemon=True)
t.start()

time.sleep(0.25)
print("main thread finished")
# Тут програма завершується, і фоновий потік зупиняється без попередження.
```

Результат (кількість рядків може відрізнятися):

```text
still alive
still alive
still alive
main thread finished
```

Без `daemon=True` ця програма ніколи б не завершилася. Використовуйте фонові потоки лише для допоміжної роботи, яку не шкода втратити будь-якої миті: вони не встигнуть закрити файли чи дописати дані.

## Як коректно зупинити потік

У Python немає способу «вбити» потік ззовні. Потік має **зупинитися сам**, коли його про це попросять. Стандартний інструмент для цього — `threading.Event`, потокобезпечний прапорець:

```python
import threading
import time

stop_event = threading.Event()


def monitor(stop):
    checks = 0
    while not stop.is_set():
        checks += 1
        print(f"check #{checks}")
        stop.wait(0.1)  # спить 0.1 с, але прокидається одразу, щойно stop встановлено
    print("monitor: clean shutdown")


t = threading.Thread(target=monitor, args=(stop_event,))
t.start()

time.sleep(0.35)
stop_event.set()  # просимо потік зупинитися
t.join()
print("main: done")
```

Результат (кількість перевірок може відрізнятися):

```text
check #1
check #2
check #3
check #4
monitor: clean shutdown
main: done
```

- `event.set()` піднімає прапорець, `event.is_set()` перевіряє його, `event.clear()` знову опускає.
- `event.wait(timeout)` блокує потік, доки прапорець не піднімуть або не мине тайм-аут. Якщо використовувати його замість `time.sleep()`, потік реагує на прохання зупинитися миттєво.
- `t.join(timeout=...)` чекає не довше вказаної кількості секунд. Після цього перевірте `t.is_alive()`, щоб дізнатися, чи потік справді завершився.

## Коли використовувати потоки

Є два великі типи роботи (див. тему «Процеси та потоки»):

- задачі, **обмежені введенням-виведенням** (I/O-bound), більшість часу чекають: мережеві запити, запити до БД, читання й запис файлів;
- задачі, **обмежені процесором** (CPU-bound), більшість часу обчислюють.

У стандартному CPython потоки допомагають з **I/O-bound** роботою. Потік, що чекає, звільняє GIL (глобальне блокування інтерпретатора), тож інші потоки можуть працювати. Для **CPU-bound** коду на чистому Python потоки по черзі захоплюють GIL і пришвидшення не дають:

```python
from threading import Thread
from time import perf_counter


def countdown(n):
    while n > 0:
        n -= 1


N = 10_000_000

start = perf_counter()
countdown(N)
countdown(N)
print(f"sequential: {perf_counter() - start:.2f} s")

start = perf_counter()
threads = [Thread(target=countdown, args=(N,)) for _ in range(2)]
for t in threads:
    t.start()
for t in threads:
    t.join()
print(f"2 threads:  {perf_counter() - start:.2f} s")
```

Результат (час різниться; стандартний CPython із GIL):

```text
sequential: 0.19 s
2 threads:  0.19 s
```

Для CPU-bound роботи використовуйте `multiprocessing` або `ProcessPoolExecutor` (далі в цьому розділі). У збірці CPython без GIL (необов'язкова з 3.13, офіційно підтримувана з 3.14) GIL немає, і потокова версія вище справді працює на двох ядрах.

## Практичний приклад: заміна тексту в багатьох файлах

Припустімо, треба замінити підрядок у багатьох текстових файлах. Приклад нижче створює десять тимчасових файлів, тож запуститься будь-де, а потім обробляє їх один раз послідовно й один раз з окремим потоком на кожен файл:

```python
import tempfile
from pathlib import Path
from threading import Thread
from time import perf_counter


def replace(filename, substr, new_substr):
    print(f"Processing the file {filename.name}")
    content = filename.read_text()
    content = content.replace(substr, new_substr)
    filename.write_text(content)


def create_files(folder, count=10):
    filenames = []
    for i in range(1, count + 1):
        path = folder / f"test{i}.txt"
        path.write_text("user_ids,order_ids\n" * 10_000)
        filenames.append(path)
    return filenames


def run_sequential(filenames):
    for filename in filenames:
        replace(filename, "ids", "id")


def run_threaded(filenames):
    threads = [
        Thread(target=replace, args=(filename, "id", "ids"))
        for filename in filenames
    ]
    for thread in threads:
        thread.start()
    for thread in threads:
        thread.join()


if __name__ == "__main__":
    with tempfile.TemporaryDirectory() as tmp:
        filenames = create_files(Path(tmp))

        start = perf_counter()
        run_sequential(filenames)  # "ids" -> "id"
        print(f"Sequential: {perf_counter() - start:0.4f} s")
        print(filenames[0].read_text().splitlines()[0])

        start = perf_counter()
        run_threaded(filenames)    # "id" -> "ids" (повертаємо назад)
        print(f"Threaded:   {perf_counter() - start:0.4f} s")
        print(filenames[0].read_text().splitlines()[0])
```

Результат (час різниться; порядок рядків потокової версії теж може змінюватися):

```text
Processing the file test1.txt
Processing the file test2.txt
Processing the file test3.txt
Processing the file test4.txt
Processing the file test5.txt
Processing the file test6.txt
Processing the file test7.txt
Processing the file test8.txt
Processing the file test9.txt
Processing the file test10.txt
Sequential: 0.0052 s
user_id,order_id
Processing the file test1.txt
Processing the file test2.txt
Processing the file test3.txt
Processing the file test4.txt
Processing the file test5.txt
Processing the file test6.txt
Processing the file test7.txt
Processing the file test8.txt
Processing the file test9.txt
Processing the file test10.txt
Threaded:   0.0047 s
user_ids,order_ids
```

Потокова версія дає той самий результат, але тут майже не швидша. Невеликі локальні файли ОС віддає з кешу за мікросекунди, тож перекривати майже нічого, а `str.replace()` — це робота процесора, під час якої GIL захоплено. Потоки окупаються, коли кожна операція містить справжнє очікування: мережеві диски, повільні носії, HTTP-запити, бази даних. Завжди **вимірюйте**, перш ніж вважати, що потоки щось пришвидшать.

> **Зверніть увагу:** виведення `print()` з кількох потоків може перемішуватися. Зазвичай кожен виклик друкує цілий рядок, але порядок не гарантовано, а зрідка частини двох рядків можуть змішатися. У серйозних програмах використовуйте модуль `logging`, він потокобезпечний.

## Типові помилки

- **Викликати функцію замість того, щоб передати її.** `Thread(target=task())` одразу виконує `task()` у головному потоці й передає як `target` її результат (`None`). Пишіть `Thread(target=task)`.
- **Передати в `args` не кортеж.** `args=(5)` — це просто ціле число `5`, і потік падає з `TypeError: ... argument after * must be an iterable, not int`. Пишіть `args=(5,)`.
- **Викликати `join()` у циклі запуску.** Потоки виконуватимуться один за одним. Спершу запустіть усі, потім дочекайтеся всіх.
- **Викликати `run()` замість `start()`.** `t.run()` виконує цільову функцію в *поточному* потоці, жодної конкурентності.
- **Запускати потік двічі.** Об'єкт `Thread` можна запустити лише один раз. Повторний `start()` генерує `RuntimeError: threads can only be started once`. Створіть новий об'єкт.
- **Чекати, що результат або виняток цільової функції дійдуть до викликача.** І те, і те втрачається, якщо ви не збережете їх самі (або не використаєте пул потоків).
- **Використовувати потоки для CPU-bound роботи** у стандартному CPython. Беріть процеси.
- **Намагатися «вбити» потік.** Підтримуваного способу немає. Проєктуйте потоки так, щоб вони перевіряли `Event` і зупинялися самі.

## Підсумок

- `threading.Thread(target=func, args=(...), kwargs={...})` створює потік, `start()` запускає його, `join()` чекає на його завершення.
- `args` має бути кортежем: `args=(value,)` для одного аргументу.
- Спершу запустіть усі потоки, потім дочекайтеся всіх. Порядок завершення непередбачуваний.
- Потоки відкидають повернені значення, а їхні винятки не доходять до `join()`. Зберігайте результати самі, налаштуйте `threading.excepthook` або використайте пул потоків.
- Фонові потоки (daemon) різко зупиняються, коли програма завершується. Доручайте їм лише роботу, яку не шкода втратити.
- Потоки не можна «вбити». Зупиняйте їх за домовленістю через `threading.Event`.
- У стандартному CPython потоки пришвидшують I/O-bound роботу, а не CPU-bound. Вимірюйте, щоб переконатися в реальному виграші.

## Практика

### Вправа 1: Виправте потоки

Ця програма має виконувати обидві задачі конкурентно й завершуватися приблизно за 0,2 секунди. У ній три помилки. Знайдіть і виправте їх.

```python
from threading import Thread
from time import perf_counter, sleep


def task(n):
    sleep(0.2)
    print(f"task {n} done")


start = perf_counter()
first = Thread(target=task(1))
second = Thread(target=task, args=(2))
threads = [first, second]
for t in threads:
    t.start()
    t.join()
print(f"It took {perf_counter() - start:.1f} s")
```

### Вправа 2: Конкурентні «завантаження»

Напишіть `download(url)`, яка імітує запит через `time.sleep(0.3)` і зберігає `len(url) * 1000` (уявний розмір сторінки) у глобальному словнику `sizes` за ключем `url`. Завантажте п'ять URL нижче в п'яти потоках, виведіть кожен URL з його розміром у початковому порядку, а також загальний час. Він має бути близько 0,3 секунди, а не 1,5.

```python
urls = [
    "https://example.com/a",
    "https://example.com/bb",
    "https://example.com/ccc",
    "https://example.com/dddd",
    "https://example.com/eeeee",
]
```

### Вправа 3: Чекати з тайм-аутом, потім скасувати

Напишіть `long_job(cancel)`, яка виконує 10 кроків `time.sleep(0.05)` і перед кожним кроком перевіряє `threading.Event` з назвою `cancel`. Якщо подію встановлено, функція виводить, на якому кроці зупинилася, і повертає керування. У головному потоці запустіть задачу, чекайте на неї не довше 0,2 секунди через `join(timeout=...)`, і якщо вона ще працює, встановіть подію, знову викличте `join()` і виведіть, чи робочий потік ще живий.

### Вправа 4: Потік, що повертає результат

Створіть підклас `ResultThread` класу `Thread`, у якого `join()` **повертає** результат цільової функції або **повторно піднімає** виняток, який вона згенерувала. Перевірте його на функції, що після короткої паузи повертає `7 * 7`, і на функції, що генерує `ValueError("bad input")`.

## Розв'язки

### Вправа 1

Помилки:

1. `target=task(1)` одразу викликає `task(1)` у головному потоці. Потік отримує `target=None` і нічого не робить.
2. `args=(2)` — це ціле число `2`, а не кортеж. Другий потік падає з `TypeError`.
3. `join()` у циклі запуску змушує потоки виконуватися один за одним.

```python
from threading import Thread
from time import perf_counter, sleep


def task(n):
    sleep(0.2)
    print(f"task {n} done")


start = perf_counter()
first = Thread(target=task, args=(1,))
second = Thread(target=task, args=(2,))
threads = [first, second]
for t in threads:
    t.start()
for t in threads:
    t.join()
print(f"It took {perf_counter() - start:.1f} s")
```

Результат (порядок перших двох рядків може змінюватися):

```text
task 2 done
task 1 done
It took 0.2 s
```

### Вправа 2

```python
import threading
import time

sizes = {}


def download(url):
    time.sleep(0.3)                 # імітуємо затримку мережі
    sizes[url] = len(url) * 1000    # нехай це буде розмір сторінки


urls = [
    "https://example.com/a",
    "https://example.com/bb",
    "https://example.com/ccc",
    "https://example.com/dddd",
    "https://example.com/eeeee",
]

start = time.perf_counter()
threads = [threading.Thread(target=download, args=(url,)) for url in urls]
for t in threads:
    t.start()
for t in threads:
    t.join()
elapsed = time.perf_counter() - start

for url in urls:
    print(url, sizes[url])
print(f"Downloaded {len(sizes)} pages in {elapsed:.2f} s")
```

Результат (час може трохи відрізнятися):

```text
https://example.com/a 21000
https://example.com/bb 22000
https://example.com/ccc 23000
https://example.com/dddd 24000
https://example.com/eeeee 25000
Downloaded 5 pages in 0.31 s
```

Кожен потік пише інший ключ, а головний потік читає `sizes` лише після всіх викликів `join()`, тому блокування не потрібне. Обхід `urls`, а не `sizes`, зберігає початковий порядок, хоч би в якому порядку завершилися потоки.

### Вправа 3

```python
import threading
import time


def long_job(cancel):
    for step in range(1, 11):
        if cancel.is_set():
            print(f"job: cancelled before step {step}")
            return
        time.sleep(0.05)  # одна невелика порція роботи
    print("job: finished all steps")


cancel = threading.Event()
worker = threading.Thread(target=long_job, args=(cancel,))
worker.start()

worker.join(timeout=0.2)
if worker.is_alive():
    print("main: still running after 0.2 s, cancelling")
    cancel.set()
    worker.join()

print("main: worker alive?", worker.is_alive())
```

Результат (номер кроку може відрізнятися на одиницю):

```text
main: still running after 0.2 s, cancelling
job: cancelled before step 5
main: worker alive? False
```

`join(timeout=0.2)` повертає керування через 0,2 секунди, хоча задачі потрібно близько 0,5. Лише `is_alive()` показує, чи потік справді завершився. Задача помічає подію під час наступної перевірки й завершується, тож другий `join()` короткий.

### Вправа 4

```python
import threading
import time


class ResultThread(threading.Thread):
    def __init__(self, target, args=(), kwargs=None):
        super().__init__()
        self._func = target
        self._func_args = args
        self._func_kwargs = kwargs or {}
        self.result = None
        self.error = None

    def run(self):
        try:
            self.result = self._func(*self._func_args, **self._func_kwargs)
        except Exception as exc:
            self.error = exc

    def join(self, timeout=None):
        super().join(timeout)
        if self.error is not None:
            raise self.error
        return self.result


def slow_square(x):
    time.sleep(0.1)
    return x * x


def broken():
    raise ValueError("bad input")


t1 = ResultThread(target=slow_square, args=(7,))
t2 = ResultThread(target=broken)
t1.start()
t2.start()

print("result:", t1.join())
try:
    t2.join()
except ValueError as exc:
    print("caught in main thread:", exc)
```

Результат:

```text
result: 49
caught in main thread: bad input
```

Атрибути навмисно названо `_func`, `_func_args` і `_func_kwargs`. `Thread` уже використовує всередині `_target`, `_args` і `_kwargs`, і повторне використання цих імен конфліктувало б з його власною логікою. Виняток перехоплюється в `run()`, де він виникає, а потім повторно піднімається в потоці, що викликає `join()`.

---

*Джерело: [pythontutorial.net — Python Threading](https://www.pythontutorial.net/advanced-python/python-threading/). Адаптовано й доповнено для PyJourney.*
